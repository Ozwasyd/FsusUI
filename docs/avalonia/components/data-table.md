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

Table layout, frozen column shadows, and virtualization thresholds follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Tables use surface, border, focus, text, muted text, density, loading, and
motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var table = new FsusDataTable { AccessibleName = "Invoices" };
table.Columns.Add(new FsusDataTableColumn("number", "Invoice"));
table.Rows.Add(new FsusDataTableRow("inv-1"));
```

## Known Limitations

Server-side sorting, filtering, and paging remain product data-source work.
