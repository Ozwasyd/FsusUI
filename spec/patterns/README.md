# UX Pattern Schema

Patterns define reusable product layouts and flows above raw controls.

## Pattern Record

| Field           | Required | Description                                      |
| --------------- | -------- | ------------------------------------------------ |
| `id`            | yes      | stable pattern id                                |
| `intent`        | yes      | user problem solved by the pattern               |
| `regions`       | yes      | named layout/content regions                     |
| `components`    | yes      | component contract ids used by the pattern       |
| `states`        | yes      | loading, empty, error, permission, and selection |
| `keyboard`      | yes      | focus order and shortcut behavior                |
| `accessibility` | yes      | landmarks, names, and announcements              |
| `tokens`        | yes      | semantic layout and surface token dependencies   |
| `platformNotes` | no       | references to registered platform overrides      |

## Initial Patterns

- `app-shell`
- `sidebar`
- `topbar`
- `breadcrumb`
- `settings-page`
- `list-page`
- `detail-page`
- `form-page`
- `table-toolbar`
- `empty-state`
- `error-state`
- `confirm-danger-action`

Product apps can compose these patterns, but product-specific copy, routes, and
data models stay outside FsusUI core.
