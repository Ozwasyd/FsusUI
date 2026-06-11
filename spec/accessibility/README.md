# Accessibility Mapping Schema

Accessibility specs define required user outcomes first, then map those
outcomes to each implementation target.

## Required Fields

| Field              | Description                                     |
| ------------------ | ----------------------------------------------- |
| `semanticRole`     | platform-neutral role or intent                 |
| `accessibleName`   | naming requirement and fallback order           |
| `description`      | optional contextual description rules           |
| `states`           | disabled, selected, expanded, busy, invalid     |
| `keyboard`         | focus entry, focus exit, activation, navigation |
| `focusVisible`     | visible focus expectations and token dependency |
| `announcements`    | live updates for async or destructive flows     |
| `platformMappings` | Web and Avalonia mapping notes                  |

## Mapping Rules

- Web mappings may use ARIA, native HTML semantics, and focus management, but
  those details are implementation adapters rather than source contracts.
- Avalonia mappings may use automation properties and control patterns, but
  those details are implementation adapters rather than source contracts.
- Disabled, loading, readonly, selected, invalid, and busy states must be
  expressed both visually and programmatically where a platform supports it.
- Motion must never be the only state indicator.
