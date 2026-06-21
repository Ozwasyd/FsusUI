# Avalonia Motion Runtime

`FsusMotionService` is the Avalonia-native motion contract for stable controls.
It maps shared motion tokens to platform plans without depending on DOM,
GSAP, CSS transitions, or Web-only preset mechanics.

## Modes

| Requested mode | Effective behavior                                                             |
| -------------- | ------------------------------------------------------------------------------ |
| `System`       | `Reduced` when the caller reports platform reduced motion, otherwise `Enabled` |
| `Enabled`      | Token-backed duration, easing, delay, opacity, and transform states            |
| `Reduced`      | `1ms` plans with terminal transforms and unchanged final state                 |
| `Disabled`     | immediate terminal state, `0ms`, and `IsAnimated = false`                      |

Call `SetMode` at runtime when the application, OS preference bridge, or user
setting changes. `MotionModeChanged` reports previous and current effective
modes so component hosts can invalidate cached plans.

## Presets

| Preset               | Intent                                                                        |
| -------------------- | ----------------------------------------------------------------------------- |
| `ControlFeedback`    | Button and small control response using `motion.duration.control.fast`        |
| `PanelEnter`         | Panel/dialog enter motion using `motion.duration.panel` and emphasized easing |
| `OverlayTransition`  | Overlay surface transitions with reduced travel                               |
| `ListItemAppearance` | List item enter with bounded stagger delay                                    |
| `ActionRowSafe`      | Data-table/action-row feedback that never translates layout                   |

Stable controls must request a plan from `FsusMotionService` instead of
hard-coding durations, easing, transitions, transforms, or opacity animations.
`check:avalonia-motion-contract` enforces that policy for Avalonia control and
theme sources.
