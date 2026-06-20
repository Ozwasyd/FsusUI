# Component Contract Schema

Component specs describe public behavior, not implementation structure. The
stable source registry now lives under
[`contracts/v1/vue-public-contracts.json`](./contracts/v1/vue-public-contracts.json)
and is validated by `pnpm run conformance:contracts`.

## Component Record

| Field                    | Required | Description                                              |
| ------------------------ | -------- | -------------------------------------------------------- |
| `id`                     | yes      | stable kebab-case component id                           |
| `displayName`            | yes      | public design-system name                                |
| `props`                  | yes      | public inputs with values, defaults, and meaning         |
| `states`                 | yes      | visual and interaction states                            |
| `events`                 | yes      | public output events                                     |
| `contentRegions`         | yes      | named content areas, not framework slots                 |
| `keyboard`               | yes      | platform-neutral keyboard behavior                       |
| `accessibility`          | yes      | role, name, state, and description requirements          |
| `tokens`                 | yes      | token dependencies by semantic purpose                   |
| `motionPolicy`           | yes      | reduced-motion and animation policy                      |
| `performanceBudget`      | yes      | render, interaction, and retained-state budget           |
| `platformClassification` | yes      | portable, native-adapter, platform-override, or web-only |
| `allowedDifferences`     | no       | references to platform override entries                  |

## Stable Registry

The v1 registry is generated from `spec/baselines/vue-current.json`. Every Vue
public component, directive, and service must either have a contract record or
an explicit web-only decision.

Implementation packages may expose platform-native APIs, but those APIs must
map back to these public concepts.

The legacy `avalonia-first-subset.yaml` remains as historical preview context;
it is no longer the conformance source of truth.

Complex Avalonia component planning is tracked separately in
[`complex-components-roadmap.yaml`](./complex-components-roadmap.yaml). Those
entries are deferred architecture targets, not part of the first basic control
subset.
