# Motion Semantics

Motion semantics align with the Web-side implementation tracked in issue #16.
The source contract is platform-neutral; each implementation maps it to CSS,
Vue Transition, GSAP, Avalonia animation resources, or disabled terminal states.

## Modes

| Mode       | Meaning                                            |
| ---------- | -------------------------------------------------- |
| `system`   | follow the user's platform reduced-motion setting  |
| `enabled`  | full semantic motion                               |
| `reduced`  | preserve state changes while removing travel/scale |
| `disabled` | collapse animations to immediate terminal states   |

## Preset Families

| Preset Family | Intent                                     |
| ------------- | ------------------------------------------ |
| `standard`    | default control and small surface feedback |
| `smooth`      | calmer content and panel transitions       |
| `expressive`  | stronger but still bounded entrance motion |

## Required Semantic Presets

- `fade-up`
- `scale-fade`
- `slide-right`
- `list-stagger`
- `route-fade`

Implementations may add more presets, but they must document intent, duration,
distance, easing, reduced-motion fallback, and applicable component or pattern
targets.
