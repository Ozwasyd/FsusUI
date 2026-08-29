---
'element-plus': patch
---

Ship the FsusSwitch native Avalonia control template. The FsusUI theme now
provides every template part `ToggleSwitch.OnApplyTemplate` resolves
(`PART_MovingKnobs` required by the supported Avalonia versions, plus
`PART_SwitchKnob` used for knob travel), so opening or laying out any native
window that contains an `FsusSwitch` — including additional windows beyond
the first one — no longer throws
`System.Collections.Generic.KeyNotFoundException: Could not find control 'PART_MovingKnobs'`.
Checked, unchecked, disabled, loading, focus-visible, reduced-motion, and
sm/md/lg density states are styled through the existing selection styles.
