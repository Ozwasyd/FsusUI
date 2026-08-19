#!/usr/bin/env python3
"""X11 native-input helper for the FsusUI native IME acceptance harness.

The harness runs on Linux + X11. This helper:

- locates a mapped top-level window by WM_CLASS and _NET_WM_PID,
- verifies a target screen point lies inside that window,
- activates the window through EWMH and X input focus,
- delivers real pointer and keyboard events through XTEST.

Every stdout line is either a machine-readable `X11_STATUS <json>` record or a
diagnostic line. Non-zero exit codes signal that the Node harness must fail
with the category named in the status record.
"""

import argparse
import json
import os
import sys
import time

from Xlib import X, XK, display, error
from Xlib.ext import xtest
from Xlib.protocol import event


def window_tree(dpy, root):
    """Yield (window, info) with absolute geometry for mapped windows."""

    def walk(w, parent_x, parent_y):
        try:
            geom = w.get_geometry()
            attrs = w.get_attributes()
        except error.XError:
            return
        abs_x = parent_x + geom.x
        abs_y = parent_y + geom.y
        try:
            name = w.get_wm_name()
        except error.XError:
            name = None
        try:
            wm_class = w.get_wm_class()
        except error.XError:
            wm_class = None
        try:
            pid_prop = w.get_full_property(
                dpy.intern_atom('_NET_WM_PID'), X.AnyPropertyType
            )
            pid = pid_prop.value[0] if pid_prop else None
        except error.XError:
            pid = None
        info = {
            'id': w.id,
            'name': name,
            'class': wm_class,
            'pid': pid,
            'mapped': attrs.map_state == 2,  # IsViewable
            'map_state': int(attrs.map_state),
            'x': abs_x,
            'y': abs_y,
            'width': geom.width,
            'height': geom.height,
        }
        yield w, info
        try:
            children = w.query_tree().children
        except error.XError:
            return
        for child in children:
            yield from walk(child, abs_x, abs_y)

    return walk(root, 0, 0)


def read_property(dpy, window, name):
    try:
        prop = window.get_full_property(dpy.intern_atom(name), X.AnyPropertyType)
        return prop.value if prop else None
    except error.XError:
        return None


def jsonable(value):
    if isinstance(value, bytes):
        return value.decode('utf-8', 'replace')
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    return value


def status(record):
    print(
        'X11_STATUS '
        + json.dumps(jsonable(record), ensure_ascii=False, sort_keys=True)
    )


def fail(category, message):
    status({'ok': False, 'category': category, 'message': message})
    sys.exit(1)


def find_window(dpy, root, expect_class, expect_pid):
    candidates = []
    for window, info in window_tree(dpy, root):
        usable = info['mapped'] or (info['width'] >= 200 and info['height'] >= 200)
        if not usable:
            continue
        if expect_pid is not None and info['pid'] != expect_pid:
            continue
        if expect_class:
            wm_class = info['class'] or ('', '')
            joined = ' '.join(str(part) for part in wm_class)
            if expect_class not in joined:
                continue
        candidates.append((window, info))
    if not candidates:
        found = []
        for _, info in window_tree(dpy, root):
            if info['class'] and (info['mapped'] or info['width'] >= 200):
                found.append(
                    {
                        'id': info['id'],
                        'class': info['class'],
                        'pid': info['pid'],
                        'geometry': [info['x'], info['y'], info['width'], info['height']],
                    }
                )
        fail(
            'window-pid-mismatch',
            'no mapped window matches class={!r} pid={!r}; mapped candidates={}'.format(
                expect_class, expect_pid, found[:12]
            ),
        )
    if len(candidates) > 1:
        candidates.sort(
            key=lambda item: item[1]['width'] * item[1]['height'],
            reverse=True,
        )
    return candidates[0]


def activate(dpy, root, window):
    try:
        window.map()
        dpy.sync()
        for _ in range(25):
            attrs = window.get_attributes()
            if attrs.map_state == 2:
                break
            time.sleep(0.08)
            window.map()
            dpy.sync()
    except error.XError:
        pass
    message = event.ClientMessage(
        window=window,
        client_type=dpy.intern_atom('_NET_ACTIVE_WINDOW'),
        data=(32, [1, X.CurrentTime, 0, 0, 0]),
    )
    root.send_event(
        message,
        event_mask=X.SubstructureRedirectMask | X.SubstructureNotifyMask,
    )
    dpy.sync()
    time.sleep(0.25)
    try:
        dpy.set_input_focus(window, X.RevertToParent, X.CurrentTime)
        dpy.sync()
    except error.XError as exc:
        fail('input-not-delivered', 'set_input_focus failed: {}'.format(exc))


def click(dpy, x, y):
    root = dpy.screen().root
    root.warp_pointer(x, y)
    dpy.sync()
    time.sleep(0.15)
    xtest.fake_input(dpy, X.ButtonPress, 1)
    dpy.sync()
    time.sleep(0.06)
    xtest.fake_input(dpy, X.ButtonRelease, 1)
    dpy.sync()
    time.sleep(0.35)


KEY_ALIASES = {
    'space': 'space',
    'Return': 'Return',
    'Escape': 'Escape',
    'BackSpace': 'BackSpace',
    'Down': 'Down',
    'Up': 'Up',
    'Left': 'Left',
    'Right': 'Right',
    'ctrl': 'Control_L',
    'shift': 'Shift_L',
    'Hangul': 'Hangul',
    'Zenkaku_Hankaku': 'Zenkaku_Hankaku',
    'Hiragana_Katakana': 'Hiragana_Katakana',
}


def keycode_for(dpy, name):
    keysym = XK.string_to_keysym(name)
    if not keysym:
        raise ValueError('unknown keysym: {}'.format(name))
    keycode = dpy.keysym_to_keycode(keysym)
    if not keycode:
        raise ValueError('no keycode for {}'.format(name))
    return keycode


def send_keys(dpy, tokens):
    held = {}

    def press(name):
        keycode = keycode_for(dpy, name)
        xtest.fake_input(dpy, X.KeyPress, keycode)
        dpy.sync()
        time.sleep(0.04)
        held[name] = keycode

    def release(name):
        keycode = held.pop(name, None) or keycode_for(dpy, name)
        xtest.fake_input(dpy, X.KeyRelease, keycode)
        dpy.sync()
        time.sleep(0.05)

    for token in tokens:
        if token.startswith('delay='):
            time.sleep(float(token.split('=', 1)[1]) / 1000.0)
            continue
        if '+' in token:
            parts = token.split('+')
            for part in parts[:-1]:
                press(KEY_ALIASES.get(part, part))
            last = parts[-1]
            last_name = KEY_ALIASES.get(last, last)
            keycode = keycode_for(dpy, last_name)
            xtest.fake_input(dpy, X.KeyPress, keycode)
            dpy.sync()
            time.sleep(0.05)
            xtest.fake_input(dpy, X.KeyRelease, keycode)
            dpy.sync()
            time.sleep(0.08)
            for part in reversed(parts[:-1]):
                release(KEY_ALIASES.get(part, part))
            continue
        if token.startswith('keycode='):
            keycode = int(token.split('=', 1)[1])
            xtest.fake_input(dpy, X.KeyPress, keycode)
            dpy.sync()
            time.sleep(0.05)
            xtest.fake_input(dpy, X.KeyRelease, keycode)
            dpy.sync()
            time.sleep(0.1)
            continue
        name = KEY_ALIASES.get(token, token)
        keycode = keycode_for(dpy, name)
        xtest.fake_input(dpy, X.KeyPress, keycode)
        dpy.sync()
        time.sleep(0.05)
        xtest.fake_input(dpy, X.KeyRelease, keycode)
        dpy.sync()
        time.sleep(0.1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expect-class', default='Google-chrome')
    parser.add_argument('--expect-pid', type=int)
    parser.add_argument('--target-x', type=int)
    parser.add_argument('--target-y', type=int)
    parser.add_argument('--activate', action='store_true')
    parser.add_argument('--click', action='store_true')
    parser.add_argument('--keys', nargs='*', default=[])
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()

    display_name = os.environ.get('DISPLAY')
    if not display_name:
        fail('prerequisite-missing', 'DISPLAY is not set')
    try:
        dpy = display.Display(display_name)
    except error.DisplayConnectionError as exc:
        fail('prerequisite-missing', 'cannot open DISPLAY {}: {}'.format(display_name, exc))

    root = dpy.screen().root
    window, info = find_window(dpy, root, args.expect_class, args.expect_pid)

    result = {
        'ok': True,
        'window': {
            'id': info['id'],
            'pid': info['pid'],
            'class': info['class'],
            'name': info['name'],
            'geometry': [info['x'], info['y'], info['width'], info['height']],
            'active': bool(read_property(dpy, root, '_NET_ACTIVE_WINDOW')) and
            read_property(dpy, root, '_NET_ACTIVE_WINDOW')[0] == info['id'],
            'desktop': (
                list(read_property(dpy, root, '_NET_CURRENT_DESKTOP') or [])
                or [None]
            )[0],
        },
    }

    if args.target_x is not None and args.target_y is not None:
        inside = (
            info['x'] <= args.target_x < info['x'] + info['width']
            and info['y'] <= args.target_y < info['y'] + info['height']
        )
        if not inside:
            fail(
                'window-pid-mismatch',
                'target ({}, {}) is outside window {} geometry {}'.format(
                    args.target_x,
                    args.target_y,
                    info['id'],
                    [info['x'], info['y'], info['width'], info['height']],
                ),
            )
        result['target'] = {'x': args.target_x, 'y': args.target_y, 'inside': True}

    if args.activate:
        activate(dpy, root, window)
    if args.click:
        if args.target_x is None or args.target_y is None:
            fail('input-not-delivered', '--click requires --target-x and --target-y')
        click(dpy, args.target_x, args.target_y)
    if args.keys:
        try:
            send_keys(dpy, args.keys)
        except ValueError as exc:
            fail('input-not-delivered', str(exc))

    focus = dpy.get_input_focus()
    result['focus'] = {'window': focus.focus.id if focus.focus else None}
    result['keys'] = args.keys
    status(result)
    dpy.close()


if __name__ == '__main__':
    main()
