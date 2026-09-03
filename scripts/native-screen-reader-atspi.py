#!/usr/bin/env python3
"""Dump AT-SPI accessible tree for the FsusUI markdown editor window."""

from __future__ import annotations

import json
import sys
import time

try:
    import pyatspi
    BACKEND = 'pyatspi'
except ModuleNotFoundError:
    import gi
    gi.require_version('Atspi', '2.0')
    from gi.repository import Atspi
    BACKEND = 'gi-atspi'


def role_name(accessible):
    return accessible.getRoleName() if BACKEND == 'pyatspi' else accessible.get_role_name()


def accessible_name(accessible):
    return (accessible.name if BACKEND == 'pyatspi' else accessible.get_name()) or ''


def child_count(accessible):
    return accessible.childCount if BACKEND == 'pyatspi' else accessible.get_child_count()


def child_at(accessible, index):
    return accessible.getChildAtIndex(index) if BACKEND == 'pyatspi' else accessible.get_child_at_index(index)


def desktop():
    return pyatspi.Registry.getDesktop(0) if BACKEND == 'pyatspi' else Atspi.get_desktop(0)


def node_brief(accessible, depth=0, limit=400, collected=None):
    if collected is None:
        collected = []
    if len(collected) >= limit:
        return collected
    try:
        role = role_name(accessible)
        name = accessible_name(accessible)
        states = []
        if BACKEND == 'pyatspi':
            states = [str(state) for state in accessible.getState().getStates()]
        else:
            state_set = accessible.get_state_set()
            states = [str(state) for state in (state_set.get_states() or [])]
        attrs = {}
        try:
            if BACKEND == 'pyatspi':
                attrs = dict(accessible.getAttributes() or [])
            else:
                for entry in accessible.get_attributes_as_array() or []:
                    key, _, value = entry.partition(':')
                    attrs[key] = value
        except Exception:
            attrs = {}
        collected.append(
            {
                'depth': depth,
                'role': role,
                'name': name,
                'states': states,
                'attributes': attrs,
            }
        )
        count = child_count(accessible)
        for index in range(count):
            child = child_at(accessible, index)
            if child is None:
                continue
            node_brief(child, depth + 1, limit, collected)
    except Exception as exc:
        collected.append({'depth': depth, 'error': str(exc)})
    return collected


def find_apps(deadline):
    apps = []
    while time.time() < deadline:
        root = desktop()
        apps = [child_at(root, index) for index in range(child_count(root))]
        apps = [app for app in apps if app]
        names = [accessible_name(app) for app in apps]
        if any(
            'chrom' in (name or '').lower()
            or 'firefox' in (name or '').lower()
            or 'minibrowser' in (name or '').lower()
            or 'webkit' in (name or '').lower()
            for name in names
        ):
            return apps
        time.sleep(0.4)
    return apps


def is_browser_app(app):
    name = accessible_name(app).lower()
    return any(token in name for token in ('chrom', 'firefox', 'minibrowser', 'webkit'))


def main():
    deadline = time.time() + 20
    apps = [app for app in find_apps(deadline) if is_browser_app(app)]
    trees = []
    for app in apps:
        try:
            trees.append(
                {
                    'app': accessible_name(app),
                    'nodes': node_brief(app, limit=500),
                }
            )
        except Exception as exc:
            trees.append({'app': accessible_name(app), 'error': str(exc)})

    textboxes = []
    live_regions = []
    articles = []
    for tree in trees:
        for node in tree.get('nodes') or []:
            role = (node.get('role') or '').lower()
            name = node.get('name') or ''
            if role in {'text', 'entry', 'password text', 'document text', 'paragraph'}:
                if 'markdown' in name.lower() or role in {'text', 'entry', 'document text'}:
                    textboxes.append(node)
            if 'live' in json.dumps(node.get('attributes') or {}).lower() or 'aria-live' in json.dumps(node).lower():
                live_regions.append(node)
            if role == 'article':
                articles.append(node)

    named_markdown_editables = [
        node
        for node in textboxes
        if 'markdown' in (node.get('name') or '').lower()
        and ('editor' in (node.get('name') or '').lower() or '编辑' in (node.get('name') or ''))
    ]
    result = {
        'ok': bool(apps) and bool(named_markdown_editables),
        'backend': BACKEND,
        'appCount': len(trees),
        'apps': [tree.get('app') for tree in trees],
        'textboxCount': len(textboxes),
        'markdownEditableCount': len(named_markdown_editables),
        'articleCount': len(articles),
        'liveRegionCount': len(live_regions),
        'textboxes': textboxes[:20],
        'markdownEditables': named_markdown_editables[:20],
        'liveRegions': live_regions[:20],
        'trees': trees,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
        sys.exit(2)
