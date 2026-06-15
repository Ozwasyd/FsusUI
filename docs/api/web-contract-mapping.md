# Web Contract Mapping

This document maps the current Web/Vue implementation to the platform-neutral
contract under `spec/`. It preserves Element Plus compatibility while marking
which APIs are cross-platform FsusUI contracts.

## Mapping Status

| Component   | Web API Surface                    | Contract Status | Notes                                                               |
| ----------- | ---------------------------------- | --------------- | ------------------------------------------------------------------- |
| button      | `ElButton`, `inlineAction`, motion | partial         | Contract matches behavior; #56 tracks variant-specific hover opacity and state detail. |
| icon-button | `ElButton` with `icon`/`circle`    | matching        | Icon-only usage must provide `aria-label` or `aria-labelledby`.     |
| input       | `ElInput`                          | matching        | Native input semantics remain the Web adapter.                      |
| textarea    | `ElInput` textarea mode            | matching        | Maps to multiline text-input contract with 2px inset Scholarly Blue focus parity. |
| checkbox    | `ElCheckbox`                       | matching        | Native checkbox and ARIA state are Web-specific adapters.           |
| radio       | `ElRadio`/`ElRadioGroup`           | matching        | Arrow-key group behavior remains required.                          |
| switch      | `ElSwitch`                         | matching        | Loading/disabled states map to the shared switch contract.          |
| card        | `ElCard`, `.is-interactive`        | matching        | DOM structure is not public contract.                               |
| divider     | `ElDivider`                        | matching        | Orientation maps to `divider`.                                      |
| tag         | `ElTag`, `ElCheckTag`              | matching        | Uppercase visual treatment is Web styling, not a contract field.    |
| badge       | `ElBadge`                          | matching        | Count and status variants map to `badge`.                           |
| alert       | `ElAlert`                          | matching        | Dismissible state and role map to `alert`.                          |
| dialog      | `ElDialog`                         | partial         | Vue transition implementation is not public contract; #56 tracks panel leave duration and close target details. |
| tabs        | `ElTabs`                           | matching        | Card/border-card visuals are Web adapter details; active/focus indicators use Scholarly Blue. |
| menu        | `ElMenu`                           | matching        | DOM class names and submenu templates are not public contract.      |
| dropdown    | `ElDropdown`, dropdown menu        | partial         | #56 tracks default `8px 0` menu padding and selectable state details. |
| table       | `ElTable`, `ElTableV2`             | partial         | #56 tracks 16px horizontal cell padding and quiet row hover treatment. |
| public-shell | `ElPublicShell`                   | matching        | Focus rings are 2px inset; active navigation uses a stable Scholarly Blue underline. |

## Token Migration

Web theme code consumes generated tokens from
`packages/theme-chalk/src/generated/tokens.scss` through
`packages/theme-chalk/src/common/fsus-tokens.scss`. Existing preview CSS
variables such as `--fsus-scholarly-blue`, `--fsus-motion-control`, and
Element Plus-compatible `--el-*` aliases remain available as compatibility
aliases.

New public Web theme variables should be added to `spec/tokens/tokens.json` and
generated with `pnpm run tokens:generate`. Product apps should not define new
FsusUI contract tokens directly in app CSS.

## Motion Alignment

The Web implementation may use CSS transitions, Vue Transition, GSAP wrappers,
or motion-dom internally. The external contract is the platform-neutral motion
mode and preset semantics in `spec/motion/`.

Dense operation rows use the public helper selectors `.fsus-action-row`,
`.fsus-table-actions`, `[data-fsus-action-row]`, and
`[data-fsus-table-actions]`. These selectors keep table/list actions
motion-safe by disabling translate/scale transforms for nested buttons and tags
while preserving color, opacity, and focus state transitions.

## Web-Only And Unsupported APIs

The following surfaces remain Web-only and are not cross-platform contracts:

- undocumented Element Plus classes, generated DOM structure, and deep package
  paths
- Popper.js placement internals and Teleport implementation details
- DOM selectors inside component templates
- Web-only WASM runtime paths
- product-specific selectors from FsusBlog, FsusPanel, or downstream apps

Product apps must consume documented component props, public package exports,
tokens, and helper selectors. They must not depend on internal Element Plus
classes, generated build internals, or private workspace package paths.
