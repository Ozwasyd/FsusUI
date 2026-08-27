# Upload and transfer

Component ID: `upload-transfer`

## Avalonia API

Use `FsusDropZone`, `FsusFileDropEventArgs`, `FsusUpload`, `FsusUploadItem`,
`FsusTransfer`, and `FsusTransferItem` for file drop zones, file queue state,
retry/remove actions, and two-pane transfer flows.

## Vue Contract Mapping

Vue file list, upload dragger, status, retry, remove, target keys, selected
keys, disabled items, and empty states map to public item records and control
properties.

## Supported Platform Differences

File picker integration, drag-and-drop file access, and keyboard focus follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Upload and transfer controls use border, focus, surface, text, danger, loading,
density, and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var dropZone = new FsusDropZone
{
  AccessibleName = "Attachment import",
  Instruction = "Drop files here or click to browse",
  HelpText = "PDF or PNG up to 25MB",
  Accepts = ".pdf, .png",
};

dropZone.FilesDropped += (sender, args) =>
{
  foreach (var path in args.Files)
  {
    Console.WriteLine($"Dropped: {path}");
  }
};

var upload = new FsusUpload { AccessibleName = "Attachments" };
upload.Items.Add(new FsusUploadItem("report.csv", 42_000, "text/csv"));
```

## Known Limitations

The control does not perform network upload or file reading by itself; product
apps own the file IO and network adapter.
