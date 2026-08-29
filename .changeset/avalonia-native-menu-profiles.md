---
'element-plus': patch
---

Add context-specific menu profiles to the Avalonia `FsusNativeMenuBuilder`. `FsusNativeMenuOptions` selects `StandardDocumentWindow` normalization (previous default) or `PreserveRoots`, which returns exactly the supplied roots on every platform while still applying platform roles, gestures, and reactive command state, and `SynthesizedRoots` limits which missing required roots (`Application`, `File`, `Window`, `Help`) standard mode may synthesize. The options work with `Build` and both `AttachTo` overloads, so secondary windows can expose a constrained application menu without an inserted Window root or relocated File/Help entries.
