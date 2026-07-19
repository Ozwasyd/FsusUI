# Task Page Header

`ElTaskPageHeader` provides the canonical top-level heading grammar for task
surfaces. It is also exported as `FsusTaskPageHeader` for Fsus applications.

Use it at the start of account, settings, dashboard, collection,
administration, and form routes. The consumer owns the title, description,
actions, permissions, routing, and workflow copy.

```vue
<FsusTaskPageHeader
  title="Account settings"
  description="Manage profile and security preferences."
>
  <template #actions>
    <el-button>Edit profile</el-button>
  </template>
</FsusTaskPageHeader>
```

## Contract

| Role            | Contract                                                                    |
| --------------- | --------------------------------------------------------------------------- |
| Title           | `24px / 700 / 1.2`, left aligned at every viewport                          |
| Description     | Optional `14px / 400 / 1.65` readable secondary text                        |
| Actions         | Caller-owned controls, after the heading in DOM/source order                |
| Default density | `24px` grid gap and `8px` title-to-description gap                          |
| Compact density | `16px` grid gap and `4px` title-to-description gap; typography is unchanged |

`title-tag` defaults to `h1` and accepts `h1` through `h6`. Select a value that
preserves the page heading order when the component appears inside a demo,
embedded flow, or nested application shell. Supply a `title` prop or the
`#title` slot. Empty descriptions are not rendered.

```vue
<FsusTaskPageHeader density="compact" title-tag="h2">
  <template #title>Collection results</template>
  <template #description>
    Review filters before exporting the current result set.
  </template>
  <template #actions>
    <el-button>Export</el-button>
    <el-button type="primary">Create item</el-button>
  </template>
</FsusTaskPageHeader>
```

The public props, `TaskPageHeaderSlots`, and intentionally empty
`TaskPageHeaderEmits` contract are exported from the component package. The
component does not infer button behavior or emit navigation events.

## Mobile and accessibility

The DOM order is always heading followed by actions. At `760px` and below the
layout changes from two columns to one column without moving or duplicating
actions, so keyboard and screen-reader order stays stable. Action controls
remain caller-owned and must keep their own accessible names.

The root is a semantic `header`; it does not add a landmark role, an aria label,
or an empty description. Dark mode uses the standard primary and secondary text
tokens without component-specific color overrides.

## Difference from `ElPageHeader`

`ElPageHeader` is navigation-oriented. It owns a back action and supports icon,
divider, breadcrumb, content, and extra regions. Keep using it when the primary
purpose is navigation back to a parent surface.

`FsusTaskPageHeader` is a task-surface heading. It deliberately has no back,
breadcrumb, eyebrow, kicker, icon, slogan, feature-list, card, gradient, glow,
or shadow API. Do not recreate those roles with wrapper CSS around the
component.

## Migration

Replacing a local `<header><h1><p>` wrapper is an intentional harmonization,
not a pixel-preserving extraction. Expected changes are limited to a stable
24px title, readable 14px description, standard spacing, desktop action
alignment, and mobile source-order stacking. Do not redesign navigation,
cards, forms, data surfaces, or page content below the header as part of this
migration.
