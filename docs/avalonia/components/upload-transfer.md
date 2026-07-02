# Upload and transfer

Component ID: `upload-transfer`

## Avalonia API

Use `FsusUpload`, `FsusUploadItem`, `FsusTransfer`, and `FsusTransferItem` for
file queue state, retry/remove actions, and two-pane transfer flows.

## Vue Contract Mapping

Vue file list, status, retry, remove, target keys, selected keys, disabled
items, and empty states map to public item records and control properties.

## Supported Platform Differences

File picker integration and keyboard focus follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Upload and transfer controls use border, focus, surface, text, danger, loading,
density, and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var upload = new FsusUpload { AccessibleName = "Attachments" };
upload.Items.Add(new FsusUploadItem("report.csv", 42_000, FsusUploadItemStatus.Ready));
```

## Known Limitations

The control does not perform network upload by itself; product apps own the IO
adapter.
