# FsusUI.Avalonia

Shared Avalonia-side constants and first-pass controls generated from the
platform-neutral FsusUI contract. The generated constants live under
`Generated/` and are refreshed by:

```bash
pnpm run tokens:generate
```

## First Control Subset

The first preview subset is intentionally small and contract-driven:

- `FsusButton`
- `FsusIconButton`
- `FsusInput`
- `FsusTextarea`
- `FsusCheckbox`
- `FsusRadio`
- `FsusSwitch`
- `FsusCard`
- `FsusDivider`
- `FsusTag`
- `FsusBadge`
- `FsusAlert`
- `FsusDialog`
- `FsusTabs`
- `FsusMenu`

Contracts are documented in
[`spec/components/avalonia-first-subset.yaml`](../../spec/components/avalonia-first-subset.yaml).
The controls expose Fsus-owned names and state classes; visual resources come
from `FsusUI.Avalonia.Themes`.

Keyboard and accessibility requirements are inherited from native Avalonia
controls where possible and documented in the contract file. Custom wrappers must
preserve focusability, disabled state, checked/selected state, accessible names,
and loading-state behavior without exposing Web DOM or Element Plus internals.
