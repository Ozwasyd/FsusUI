# Motion Token Stability

FsusUI's motion layer extends Element Plus behavior. The public contract is the
ConfigProvider `motion` setting and the high-level tokens below; the
platform-neutral authority is [`spec/motion/README.md`](../../spec/motion/README.md).

## ConfigProvider contract

```vue
<template>
  <el-config-provider :motion="{ mode: 'system', preset: 'standard' }">
    <AppShell />
  </el-config-provider>
</template>
```

Modes are `system`, `enabled`, `reduced`, and `disabled`; presets are
`standard`, `smooth`, and `expressive`. `standard` is the implicit default: it
caps controls at `220ms`, panels at `360ms`, and uses no blur, glow, or trail.
`smooth` and `expressive` require explicit application selection.

## Preview public tokens

| Token | Standard value | Purpose |
| --- | --- | --- |
| `--fsus-motion-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Ordinary transition easing. |
| `--fsus-motion-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Stronger entrance/reveal easing. |
| `--fsus-motion-control-fast` | `140ms` | Fast control feedback. |
| `--fsus-motion-control` | `220ms` | Default control feedback. |
| `--fsus-motion-panel` | `360ms` | Panel and large-surface transitions. |
| `--fsus-motion-overlay` | `300ms` | Overlay enter/leave transitions. |

The theme layer also owns View Transition snapshot tokens:

| Token | Standard value | Purpose |
| --- | --- | --- |
| `--fsus-view-transition-duration` | `240ms` | Root snapshot crossfade. |
| `--fsus-view-transition-shared-duration` | `360ms` | Bounded shared snapshot. |
| `--fsus-view-transition-easing` | decelerating | Root snapshot easing. |
| `--fsus-view-transition-shared-easing` | standard | Shared snapshot easing. |
| `--fsus-view-transition-z-index` | `2147483000` | Isolated browser snapshot layer. |

Use these aliases for app transitions that follow FsusUI:

```css
.settings-panel {
  transition:
    opacity var(--fsus-motion-panel) var(--fsus-motion-standard),
    transform var(--fsus-motion-panel) var(--fsus-motion-emphasized);
}
```

## Experimental tokens

These families tune component physics or visual traces and may change in minor
releases:

- `--fsus-motion-slider-*`, `--fsus-motion-scroll-*`,
  `--fsus-motion-drag-*`;
- `--fsus-motion-blur`, `--fsus-motion-trail`; and
- `--fsus-motion-spring-*`.

Use them only in integrations that own compatibility testing.

## Reduced and disabled motion

`mode: 'system'` follows `prefers-reduced-motion: reduce`. Reduced/disabled
motion collapses public durations to `1ms`, removes blur and offsets, and makes
trail colors transparent. Runtime helpers land directly in the terminal state
with `transform: none` and `filter: none`, preventing displaced frames and
layout jumps.

The same contract governs same-document View Transition pseudo-elements:
`theme-chalk` owns root/shared durations, easing, normal blend mode, isolation,
and z-index. Reduced/disabled modes and the system media query collapse their
animation to `1ms`; product CSS needs no global `::view-transition-*` override.
Temporary shared names are runtime-owned and must not be persisted in markup,
URLs, storage, or application logs.

```vue
<template>
  <el-config-provider :motion="{ mode: 'reduced' }">
    <AppShell />
  </el-config-provider>
</template>
```

```vue
<template>
  <el-config-provider :motion="{ mode: 'disabled' }">
    <AppShell />
  </el-config-provider>
</template>
```

## Legacy Vue transition names

Compatibility names used by Tag, Badge, list, Menu, Dropdown, Popover, and
anchored-overlay consumers resolve through the
[legacy transition semantic registry](../../spec/motion/legacy-transition-registry.json).
It owns recipe consumers, Vue phases, placement branches, and terminal motion;
legacy names do not create a second visual path. Inline feedback is opacity-only,
lists travel at most 8px without stagger, and anchored overlays compose 4–8px
translate/scale with Popper layout transforms. Reduced/disabled modes retain
Vue lifecycle timing at exactly `1ms` with zero delay and remove only
motion-owned translate/scale, preserving Badge and Popper positioning.

## Reading surfaces

Mark long-form content with `.fsus-reading-surface` or
`data-fsus-surface="reading"`. Every allowed preset resolves there to
`filter: none`, transparent trails, zero glow, and no translate-based paragraph
reveal; route and anchor feedback remain opacity-only. The guard applies to
final inline styles and CSS tokens.

## Functional continuous motion

Continuous motion is reserved for ongoing-work states. `ElProgress` applies it
to `indeterminate` and `stripedFlow` only when explicitly opted in, using
`--fsus-progress-animation-duration` and
`--fsus-progress-animation-easing` rather than raw animation shorthands.
Reduced motion collapses each loop to one `1ms` iteration while preserving bar
fill, text, and status color.

## Usage and app boundary

- Prefer public timing/easing tokens over hard-coded values.
- Keep transitions optional for core workflows; motion must not be the only
  state indicator.
- Test complex interactions with `system`, `reduced`, and `disabled`.
- Do not depend on low-level scroll, drag, spring, or trail tokens without
  owning compatibility testing.
- Motion recipes sit above presets and the runtime budget. Prefer
  `state-settled`, `route-crossfade`, and `reading-anchor-highlight`; avoid
  blanket `fade-up` for article bodies and `list-stagger` for long lists. The
  default stagger budget is 20 items.

Use `motionTokenAliases` for app semantics such as `blog.motion.fast` or
`admin.motion.panel`; aliases remain tied to FsusUI CSS variables:

```ts
import { motionTokenAliases } from '@ozwasyd/element-plus'

export const blogMotion = {
  fast: motionTokenAliases.fast,
  panel: motionTokenAliases.panel,
  route: motionTokenAliases.route,
}
```

Use `useMotionPreference()`, `getPrefersReducedMotion()`, and
`resolveMotionScrollBehavior()` instead of app-local media-query helpers.
Reduced/disabled modes must collapse smooth scrolling, movement, scale, blur,
and loops while preserving meaning through text, opacity, color, border, or
background. Apps may map semantic names to FsusUI recipes/presets, but should
not define raw keyframes, import raw animation engines, or duplicate reduced
motion behavior.
