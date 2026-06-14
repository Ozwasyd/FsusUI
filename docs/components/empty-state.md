# Empty State

`ElEmptyState` is the lightweight empty-state primitive for product surfaces.
It is also exported as `FsusEmptyState` for Fsus application code.

Use it when a table body, list, drawer, panel, or page has no data. Keep
`ElEmpty` for legacy illustration-heavy placeholders.

## Sizes

### Inline

Use `size="inline"` inside a list body, table fallback, small form section, or
filter result area. It has no illustration by default and uses a link-style
action default.

```vue
<FsusEmptyState
  title="No rows"
  description="Change the filters or create a new item."
>
  <el-button text type="primary" inline-action>Clear filters</el-button>
</FsusEmptyState>
```

### Compact

Use `size="compact"` inside a panel, drawer, tab pane, or dashboard block. It is
still flat and does not create a card around itself.

```vue
<FsusEmptyState
  size="compact"
  title="Nothing selected"
  description="Select an item to view details."
>
  <el-button>Browse items</el-button>
</FsusEmptyState>
```

### Page

Use `size="page"` only when the whole page or route is empty. It may show the
small neutral illustration automatically. Primary actions are reserved for
explicit creation or recovery flows.

```vue
<FsusEmptyState
  size="page"
  title="No results"
  description="Try a broader search term."
  action-variant="primary"
>
  <el-button type="primary">Create item</el-button>
</FsusEmptyState>
```

## Illustration Policy

The `illustration` prop defaults to `auto`.

- Inline and compact states do not render an illustration by default.
- Page states render the neutral mark by default.
- Pass `:illustration="false"` to suppress the mark.
- Pass a custom `#illustration` slot only when the image is decorative or has
  nearby text that explains the state.

```vue
<FsusEmptyState size="page" title="No archived items" :illustration="false" />
```

## Accessibility

The component does not set `role` or `aria-live` by default. Add them only for
states that appear after an async update and need announcement.

```vue
<FsusEmptyState title="No matching rows" role="status" aria-live="polite" />
```

Use `title-tag` when the empty state is the main heading for a page section.
The default is `p` so inline empty states do not disturb document heading order.
