# Metric primitives

Generic metric primitives compose restrained metric rows, proportional
distribution rows, key/value summaries, status rows, diagnostics lists, and
copyable technical details.

FsusUI provides generic data-display primitives only. Downstream apps own
metric labels, thresholds, data contracts, and operational meanings.

Do not create product-specific dashboard, health, backup, cache, search, or
observability templates in FsusUI.

## Metric List

```vue
<FsusMetricList>
  <FsusMetricItem
    label="Metric Alpha"
    primary="P75 22ms"
    :secondary="['Avg 23ms']"
    meta="58 samples"
  />
</FsusMetricList>
```

`FsusKpiGroup` can place metric lists and key/value grids in a responsive KPI
layout without introducing a dashboard template.

## Distribution List

```vue
<FsusDistributionList>
  <FsusDistributionBarRow label="Segment A" value="245" :ratio="1" />
  <FsusDistributionBarRow label="Segment B" value="106" :ratio="0.43" />
</FsusDistributionList>
```

The text value remains primary. The bar is a visual aid and is rendered with
`aria-hidden="true"`.

## Key Value Grid

```vue
<FsusKeyValueGrid>
  <FsusKeyValueItem label="State" value="Ready" />
  <FsusKeyValueItem label="Queue" value="0 / 0" monospace />
</FsusKeyValueGrid>
```

Use the badge slot for generic status tags. Product-specific thresholds and
health semantics stay in the consuming app.

## Status Summary

```vue
<FsusStatusSummary
  label="Generic status"
  status="Stable"
  updated-at="2026-06-14 20:30"
>
  <template #detail>
    Product-owned detail copy belongs here.
  </template>
</FsusStatusSummary>
```

## Diagnostics

```vue
<FsusDiagnosticsList>
  <FsusDiagnosticsItem
    title="diagnostic.event"
    message="Recent event summary."
    meta="warning - 17:48:11 - 3 times"
    detail="diagnostic-node:runCheck:sample-0001"
  >
    <template #actions>
      <FsusCopyableDetail
        value="diagnostic-node:runCheck:sample-0001"
        label="Copy detail"
      />
    </template>
  </FsusDiagnosticsItem>
</FsusDiagnosticsList>
```

Details are collapsed by default through native `details` / `summary`, so the
toggle remains keyboard reachable.

## Empty States

Use `FsusEmptyState size="inline"` from the empty-state primitive for local
empty metric, distribution, or diagnostics sections.

```vue
<FsusEmptyState
  size="inline"
  title="No metrics"
  description="Downstream apps supply the exact copy."
/>
```

## Accessibility Notes

- Distribution bars are visual aids only and must stay `aria-hidden`.
- Text labels and numeric values remain available to screen readers.
- Do not rely on color alone for status; provide explicit text.
- Numeric values use tabular alignment where appropriate.
- Copy buttons require accessible labels.
- Mobile stacking preserves logical source order.
- Reduced motion must not animate bars by default.
