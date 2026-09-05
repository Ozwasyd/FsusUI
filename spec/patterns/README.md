# UX Pattern Schema

Patterns define reusable product layouts and flows above raw controls. Product
apps can compose them; product-specific copy, routes, and data models remain
outside FsusUI core.

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

`app-shell`, `sidebar`, `topbar`, `breadcrumb`, `settings-page`, `list-page`,
`detail-page`, `form-page`, `table-toolbar`, `empty-state`, `error-state`, and
`confirm-danger-action`.
