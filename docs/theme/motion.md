# Motion Token Stability

FsusUI adds a motion system on top of Element Plus component behavior. The
public contract is the ConfigProvider `motion` setting plus the high-level
tokens listed below.

## ConfigProvider Contract

```vue
<template>
  <el-config-provider :motion="{ mode: 'system', preset: 'smooth' }">
    <AppShell />
  </el-config-provider>
</template>
```

Supported modes are `system`, `enabled`, `reduced`, and `disabled`. Supported
presets are `standard`, `smooth`, and `expressive`.

## Preview Public Tokens

| Token                        | Standard value                 | Purpose                                             |
| ---------------------------- | ------------------------------ | --------------------------------------------------- |
| `--fsus-motion-standard`     | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing for ordinary transitions.            |
| `--fsus-motion-emphasized`   | `cubic-bezier(0.2, 0, 0, 1)`   | Easing for stronger entrance or reveal transitions. |
| `--fsus-motion-control-fast` | `140ms`                        | Fast control feedback.                              |
| `--fsus-motion-control`      | `220ms`                        | Default control feedback.                           |
| `--fsus-motion-panel`        | `360ms`                        | Panel and larger surface transitions.               |
| `--fsus-motion-overlay`      | `260ms`                        | Overlay enter and leave transitions.                |

Use these tokens for app-level transitions that should follow FsusUI motion
settings.

```css
.settings-panel {
  transition:
    opacity var(--fsus-motion-panel) var(--fsus-motion-standard),
    transform var(--fsus-motion-panel) var(--fsus-motion-emphasized);
}
```

## Experimental Tokens

The following token families are experimental because they tune specific
component physics or visual traces:

- `--fsus-motion-slider-*`
- `--fsus-motion-scroll-*`
- `--fsus-motion-drag-*`
- `--fsus-motion-blur`
- `--fsus-motion-trail`
- `--fsus-motion-spring-*`

Use them only in product integrations that can tolerate minor-release changes.

## Reduced And Disabled Motion

`mode: 'system'` follows `prefers-reduced-motion: reduce`. Reduced and disabled
motion collapse public durations to `1ms`, remove blur and offsets, and make
trail colors transparent.

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

## Usage Rules

- Prefer public timing and easing tokens over hard-coded values.
- Keep transitions optional for core workflows.
- Do not use motion as the only state indicator.
- Test complex interactions with `system`, `reduced`, and `disabled`.
- Do not depend on low-level scroll, drag, spring, or trail tokens unless the
  integration owns compatibility testing.
