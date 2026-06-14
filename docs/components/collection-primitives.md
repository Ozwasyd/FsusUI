# Collection Primitives

FsusUI provides generic collection primitives only. Business pages must own
their domain copy, routes, actions, permissions, and data semantics.

These components are layout and interaction helpers for lists, tables, and
record collections. They do not know about admin pages, articles, comments,
users, CRUD, or write actions.

## Toolbar

Use `FsusCollectionToolbar` to compose search, filters, and collection-level
actions.

```vue
<FsusCollectionToolbar aria-label="Collection controls">
  <template #primary>
    <el-input placeholder="Search" />
  </template>

  <template #filters>
    <FsusFilterGroup label="State">
      <FsusSegmentedControl
        v-model="state"
        :items="stateItems"
        aria-label="Filter state"
      />
    </FsusFilterGroup>
  </template>

  <template #actions>
    <el-button>Refresh</el-button>
  </template>
</FsusCollectionToolbar>
```

The toolbar stays flat. It does not create a card, hero, glass panel, gradient,
or promotional control block.

## Filter Group

Use `FsusFilterGroup` to label a small group of selects, inputs, toggles, date
ranges, or custom filter controls.

```vue
<FsusFilterGroup label="Filter" density="compact">
  <el-select aria-label="Filter">
    <el-option label="All" value="all" />
  </el-select>
</FsusFilterGroup>
```

## Segmented Control

Use `FsusSegmentedControl` for finite state or category filters.

```vue
<FsusSegmentedControl
  v-model="state"
  :items="[
    { label: 'All', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'Closed', value: 'closed' },
  ]"
  aria-label="Filter state"
/>
```

It uses radio semantics and supports arrow, Home, and End keyboard navigation.

## Summary

Use `FsusCollectionSummary` near the collection body to express count and
filtered state.

```vue
<FsusCollectionSummary
  title="Results"
  :total="42"
  :visible="12"
  state="Filtered"
/>
```

Live region behavior is opt-in:

```vue
<FsusCollectionSummary title="Results" :total="0" aria-live="polite" />
```

## Empty State

Use `FsusEmptyState size="inline"` inside compact collection bodies. Do not
place full/page empty states inside table, list, or panel bodies.

```vue
<FsusEmptyState
  size="inline"
  title="No results"
  description="Adjust filters and try again."
  action-variant="link"
/>
```

Downstream products provide the copy. The component library only provides the
placement and density grammar.

## Pagination

Use `FsusPaginationBar` to keep summary text and pagination controls attached
to the collection.

```vue
<FsusPaginationBar aria-label="Results pagination">
  <template #summary>Page 1 of 5</template>
  <template #pagination>
    <el-pagination layout="prev, pager, next" :total="50" />
  </template>
</FsusPaginationBar>
```

On mobile, the summary and controls stack in source order.

## Dark Mode And Mobile

The primitives use existing text, fill, border, and radius tokens. They avoid
chart dependencies, gradients, glow, and heavy illustrations. Controls wrap on
small screens while preserving logical tab order.
