#!/usr/bin/env python3
"""Dump AT-SPI accessible tree for the FsusUI markdown editor window."""

from __future__ import annotations

import json
import sys
import time

import pyatspi


def node_brief(accessible, depth=0, limit=400, collected=None):
    if collected is None:
        collected = []
    if len(collected) >= limit:
        return collected
    try:
        role = accessible.getRoleName()
        name = accessible.name or ''
        states = [str(state) for state in accessible.getState().getStates()]
        attrs = {}
        try:
            attrs = dict(accessible.getAttributes() or [])
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
        count = accessible.childCount
        for index in range(count):
            child = accessible.getChildAtIndex(index)
            if child is None:
                continue
            node_brief(child, depth + 1, limit, collected)
    except Exception as exc:
        collected.append({'depth': depth, 'error': str(exc)})
    return collected


def find_apps(deadline):
    apps = []
    while time.time() < deadline:
        desktop = pyatspi.Registry.getDesktop(0)
        apps = [app for app in desktop if app]
        names = [app.name for app in apps]
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


def main():
    deadline = time.time() + 20
    apps = find_apps(deadline)
    trees = []
    for app in apps:
        try:
            trees.append(
                {
                    'app': app.name,
                    'nodes': node_brief(app, limit=500),
                }
            )
        except Exception as exc:
            trees.append({'app': getattr(app, 'name', None), 'error': str(exc)})

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

    result = {
        'ok': True,
        'appCount': len(trees),
        'apps': [tree.get('app') for tree in trees],
        'textboxCount': len(textboxes),
        'articleCount': len(articles),
        'liveRegionCount': len(live_regions),
        'textboxes': textboxes[:20],
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
