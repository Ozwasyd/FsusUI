# Component Contract Schema

Component specs describe public behavior, not implementation structure.

## Component Record

| Field                | Required | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `id`                 | yes      | stable kebab-case component id                   |
| `displayName`        | yes      | public design-system name                        |
| `props`              | yes      | public inputs with values, defaults, and meaning |
| `states`             | yes      | visual and interaction states                    |
| `events`             | yes      | public output events                             |
| `contentRegions`     | yes      | named content areas, not framework slots         |
| `keyboard`           | yes      | platform-neutral keyboard behavior               |
| `accessibility`      | yes      | role, name, state, and description requirements  |
| `tokens`             | yes      | token dependencies by semantic purpose           |
| `allowedDifferences` | no       | references to platform override entries          |

## Initial Component Set

The initial cross-platform contract set is tracked in
[`catalog.md`](./catalog.md):

- button
- icon-button
- input
- textarea
- checkbox
- radio
- switch
- card
- divider
- tag
- badge
- alert
- tooltip
- dialog
- tabs
- menu

Implementation packages may expose platform-native APIs, but those APIs must
map back to these public concepts.
