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

## Recipe Layer

Recipes describe business intent above preset mechanics. Implementations must
provide at least these recipes:

- `content-enter`
- `article-list-enter`
- `island-enter`
- `state-pending`
- `state-settled`
- `state-error`
- `route-crossfade`
- `reading-anchor-highlight`
- `panel-enter`
- `list-enter-small`
- `card-interactive`

Each recipe must declare intent, default preset, duration class, allowed
targets, reduced fallback, disabled fallback, and performance budget. Reduced
and disabled modes must resolve to terminal visual state without layout travel.

## Scroll Timeline

Scroll timeline support must preserve native scrolling:

- no hidden natural scrollbar
- no forced page snapping
- no wheel or touch blocking
- no default admin-page narrative scroll effects
- no large parallax in reading surfaces

## Shared Element And FLIP

Shared-element and FLIP helpers may be framework adapters, but the platform
contract is transform/opacity only, reduced-motion safe, and non-blocking when
measurement fails.

## Motion Budget

Default budget:

| Field                         | Default |
| ----------------------------- | ------- |
| `maxStaggerItems`             | `20`    |
| `maxAnimatedNodesPerViewport` | `40`    |
| `disableScrollEffectsBelowFps`| `45`    |
| `disableBlurOnLowPower`       | `true`  |
| `disableParallaxOnTouch`      | `true`  |
| `preferCssWhenPossible`       | `true`  |

Presets and recipes should animate only `transform`, `opacity`, and
budget-controlled `filter`.
