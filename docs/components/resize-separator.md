# ResizeSeparator

> **Role:** Web/Vue component public contract
> **Applies to:** `ElResizeSeparator` and `FsusResizeSeparator`
> **Authority:** [API stability](../api-stability.md), [design contract](../design.md), and [theme tokens](../theme/tokens.md)

ResizeSeparator is a preview public input primitive between consumer-owned
regions. It renders one focusable separator handle and emits resize proposals.
It does not render, measure, size, hide, mount, scroll, or persist either region.
The consumer remains the sole layout and accepted-value owner.

## Supported imports

```ts
import {
  ElResizeSeparator,
  FsusResizeSeparator,
  type ResizeSeparatorPayload,
  type ResizeSeparatorCancelPayload,
  type ResizeSeparatorCoordinateRange,
  type ResizeSeparatorInstance,
  type ResizeSeparatorProps,
  type ResizeSeparatorEmits,
  type ResizeSeparatorCancelReason,
} from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/fsus.css'
```

Both names share the same props, events, and exposed method. The default library
plugin installs both names. Documented compatibility component/style imports
also follow [API stability](../api-stability.md); source directories and private
DOM selectors are not consumer API. This new capability is a source addition;
availability in an npm version requires the normal release process.

`ElSplitPane` / `FsusSplitPane` remain the fixed inbox list/detail primitives.
They do not provide a controlled ratio or resize interaction. Undocumented drag
hooks and Slider/Scrollbar/Carousel internals are not this public contract.

## Props

| Prop                | Type                             | Default      | Contract                                                                                                                                   |
| ------------------- | -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`             | `number`                         | required     | Accepted consumer value. Finite values outside the bounds are clamped for ARIA and the interaction origin; no correction event is emitted. |
| `min`               | `number`                         | `0`          | Closed lower bound.                                                                                                                        |
| `max`               | `number`                         | `1`          | Closed upper bound, greater than `min`. The numeric span must be finite.                                                                   |
| `step`              | `number`                         | `0.01`       | Positive finite proposal increment, anchored at `min`.                                                                                     |
| `label`             | `string`                         | required     | Nonempty accessible name for the primary region's resizing control.                                                                        |
| `primaryRegionId`   | `string`                         | required     | Nonempty ID of the primary region; the value expresses its size in consumer units.                                                         |
| `secondaryRegionId` | `string`                         | —            | Optional companion region ID. Both IDs are included in `aria-controls`; the consumer supplies the actual regions.                          |
| `valueText`         | `string`                         | —            | Optional consumer-formatted `aria-valuetext`, derived from accepted `value`.                                                               |
| `orientation`       | `'vertical' \| 'horizontal'`     | `'vertical'` | Orientation of the separator itself: vertical uses clientX, horizontal uses clientY.                                                       |
| `coordinateRange`   | `ResizeSeparatorCoordinateRange` | required     | `{ start, end }`: viewport CSS-pixel coordinates corresponding to `min` and `max` on the selected axis.                                    |
| `disabled`          | `boolean`                        | `false`      | Suppresses input and cancels an active interaction.                                                                                        |

Invalid numeric bounds, value, step, coordinate mapping, or required naming
disable input and remove the handle from tab order. Coordinates must be finite
and distinct, with a finite nonzero value-per-pixel scale. Invalid value/bounds/
step omit numeric ARIA attributes rather than expose invalid numbers.

## Coordinate mapping and proposals

The consumer supplies coordinates from its own current layout measurement.
Use viewport `clientX` / `clientY` units, not page coordinates, device pixels,
`offsetX`, or coordinates measured on a private FsusUI node. For a ratio owner
whose usable region extent is `W`, a vertical mapping is:

```ts
const coordinateRange = {
  start: contentLeft + min * W,
  end: contentLeft + max * W,
}
```

The owner determines `W` after its chrome, gap, min-width, safe-area and overflow
policy. Reversed ranges (`start > end`) explicitly reverse pointer and physical
arrow direction; RTL does not silently change the mapping.

Pointerdown captures on the handle and records the accepted value and pointer
axis coordinate. It emits `start` without jumping the ratio. Subsequent movement
uses this frozen origin:

```text
candidate = initialValue
          + (clientAxis - initialClientAxis) * (max - min) / (end - start)
```

Each proposal clamps to `[min, max]`, then rounds to the nearest step anchored
at `min` (positive half-step ties round upward). Both endpoints are reachable
even when the span is not divisible by step. Floating-point results use up to
15 significant digits; if an extremely small step overflows the step count,
the bounded candidate is retained. Repeated identical pointer proposals are
suppressed. The exact initial coordinate retains the initial accepted value,
including an off-step value; a stationary gesture does not snap it. Pointerup
samples its final coordinate before `end`.

There is no local accepted value and no `update:value`, `change`, or implicit
command. Ignoring `proposal` leaves the rendered ARIA value unchanged; accepting
it requires passing the accepted `value` back. Finite controlled updates during
a drag do not reset its origin. To invalidate an old interaction when consumer
identity or accepted state changes, call `cancel()` before changing that state.
Changing mapping endpoints, bounds, step, orientation, names, or region IDs
cancels the interaction; identical mapping values do not. A nonfinite value
also cancels. The consumer must refresh or invalidate measurements on scroll,
resize, zoom, or chrome changes.

## Events and cancellation

`ResizeSeparatorPayload` is `{ value, source: 'pointer' | 'keyboard', pointerId }`.
Keyboard payloads have `pointerId: null`. `ResizeSeparatorCancelPayload` adds
`reason`.

| Event      | Meaning                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `start`    | Initial bounded accepted value; one interaction has begun.                                                  |
| `proposal` | Bounded suggested value, with no acceptance or persistence.                                                 |
| `end`      | Last suggested value, or initial value if no proposal occurred. It is not proof of a committed transaction. |
| `cancel`   | Last suggested value plus reason; no rollback/correction proposal is emitted.                               |

Every started interaction has exactly one `end` or `cancel`, including
cancellation from a synchronous event listener. Cancellation reasons are
`pointercancel`, `lostpointercapture`, `escape`, `disabled`,
`configuration-change`, `consumer`, and `unmount`. Capture failure emits no
start or proposal. Only the primary pointer's primary button starts a drag;
other pointer IDs and additional pointerdowns are ignored. Pointer capture and
release belong to this handle. No document/window drag listeners are installed.

Cancellation reports the previous interaction's bounded value, even when new
bounds caused cancellation. Consumers must not treat that payload as accepted
state under the new configuration.

The exposed `cancel(): void` terminates any active interaction with reason
`consumer`. It is safe to call repeatedly. The consumer decides whether to
retain, commit, or revert accepted state on cancellation. Product identities,
group/session registries, epochs, opaque ratio refs, CAS, joint transactions,
collapse/restore, snapshots, receipts, and commands stay in the consuming app.

## Keyboard and accessibility

The handle exposes `role="separator"`, `aria-orientation`, `aria-label`,
`aria-controls`, and numeric `aria-valuemin/max/now`. `aria-valuenow` follows
accepted props, never the pending proposal. Disabled handles expose
`aria-disabled="true"` and `tabindex="-1"`.

- Vertical: Left/Right propose one physical-axis step.
- Horizontal: Up/Down propose one physical-axis step.
- A reversed coordinate range reverses each arrow's value direction.
- Home/End propose the exact min/max.
- Each effective keydown emits start, one proposal, then end. Key repeat reads
  the current accepted prop each time. Bound no-ops emit nothing.
- Escape cancels an active pointer interaction; resizing keys are ignored while
  pointer input is active. Alt/Ctrl/Meta modified resizing keys are ignored.
- Tab follows normal browser focus navigation. Pointer start focuses only the
  handle with `preventScroll`; the component never changes region focus.

## Controlled usage

```vue
<script setup lang="ts">
import {
  FsusResizeSeparator,
  type ResizeSeparatorPayload,
} from '@ozwasyd/element-plus'

// All values, coordinates, IDs, and the acceptance callback come from the
// consuming layout owner. Accept/reject inside that owner's transaction.
defineProps<{
  value: number
  min: number
  max: number
  coordinateRange: { start: number; end: number }
  primaryRegionId: string
  secondaryRegionId: string
  propose: (payload: ResizeSeparatorPayload) => void
}>()
</script>

<template>
  <FsusResizeSeparator
    :value="value"
    :min="min"
    :max="max"
    :step="0.01"
    label="Resize primary region"
    :primary-region-id="primaryRegionId"
    :secondary-region-id="secondaryRegionId"
    :coordinate-range="coordinateRange"
    @proposal="propose"
  />
</template>
```

## Styling and verification limits

The handle reserves the canonical `--fsus-icon-target` extent along the resize
axis; its line uses `--el-border-width` and `--el-border-color`. The consumer
accounts for this handle extent in its own layout. Hover and keyboard focus use
existing interaction/focus tokens; disabled uses the disabled-border role.
There is no width animation or decorative grip. Forced-colors rules use system
colors. No new theme tokens or region layout authority are introduced.

Source, static SFC/TypeScript/style checks and simulated DOM input tests do not
qualify native pointer capture, browser geometry, touch, screen readers, themes,
zoom, consumer integration, or independent UX acceptance. Those require the
normal [visual workflow](../workflows/visual-change.md) on the consuming
candidate before release/acceptance. This contract targets Web/Vue; no Avalonia
resize capability or cross-platform conformance is claimed.
