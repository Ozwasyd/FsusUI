# Data table

Component ID: `data-table`

## Avalonia API

Use `FsusTable`, `FsusDataTable`, `FsusDataTableColumn`,
`FsusDataTableRow`, `FsusDataTableCellAddress`, and
`FsusDataTableBudgets`.

## Vue Contract Mapping

Vue table columns, row keys, fixed columns, sorting, row state, empty/loading
state, and virtualization budgets map to typed column and row models.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for table layout, frozen column shadows, and virtualization thresholds.

## Theme Tokens

Use surface, border, focus, text, muted-text, density, and loading resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var table = new FsusDataTable { AccessibleName = "Invoices" };
table.Columns.Add(new FsusDataTableColumn("number", "Invoice"));
table.Rows.Add(new FsusDataTableRow("inv-1"));
```

## Known Limitations

Server-side sorting, filtering, and paging remain product data-source work.
