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

## Data List

Use `FsusDataList` with `variant="navigation"` for a compact collection whose
rows navigate to, preview, or select one record. The variant owns the row
height, cell insets, hover and focus surfaces, active indicator, and end-column
alignment; consumers should not target `.el-data-list__row` or
`.el-data-list__cell`.

```vue
<FsusDataList
  :rows="regions"
  :columns="[
    { key: 'name', label: 'Region' },
    { key: 'indicator', label: 'Open', align: 'end' },
  ]"
  row-key="code"
  :active-key="selectedCode"
  :href="regionHref"
  density="compact"
  variant="navigation"
  :show-header="false"
/>
```

Slotted content can consume `--el-data-list-row-accent-color` and
`--el-data-list-row-accent-opacity` so its icon or indicator follows hover,
keyboard focus, and active state without reaching into component internals.
Products may map the documented
`--el-data-list-hover-background`, `--el-data-list-active-background`,
`--el-data-list-focus-ring`, and `--el-data-list-active-indicator` variables to
their semantic theme tokens on the component root.

An end column that contains an icon must reserve the icon width plus the
variant's 16px trailing inset. A 22px indicator therefore uses a track of at
least 40px; narrower tracks can force the cell outside its row.

### Controlled activation and disabled state

Each row belongs to a list item and contains a native button, or a link when
`href` supplies a destination. Buttons retain native Tab, Enter, and Space
behavior; links retain native Tab and Enter behavior. `active-key` exposes the
current row through `aria-current`. The component emits `change(row, key, event)`
and `row-click(row, key, event)` without changing the current identity. Use a
stable, unique `row-key` and update `active-key` only after accepting activation.

`disabled` rejects activation across the collection. `disabled-keys` rejects
specific stable keys. `loading` makes the collection busy and disables every
row; `loading-key` makes one row busy and disabled. These states reject native
and synthetic clicks as well as native keyboard and touch activation. Disabled
buttons use native disabling. Disabled links retain link semantics, remove the
destination, leave the tab order, and reject navigation. Busy and disabled rows
announce their state; the cell slot receives `disabled` and `loading` alongside
`row`, `column`, `value`, and `active`.

```vue
<FsusDataList
  :rows="records"
  :columns="columns"
  row-key="id"
  :active-key="selectedId"
  :disabled-keys="unavailableIds"
  :loading="loadingRecords"
  :loading-key="openingId"
  aria-label="Records"
  variant="navigation"
  :show-header="false"
  @change="acceptRecord"
/>
```

Interactive rows provide a system-color focus outline in forced-colors mode.
With `interactive="false"` and no destination, rows are passive content and do
not emit activation. Empty, loading, and error copy remains consumer owned;
compose public feedback components through the empty slot or next to the list.

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
