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
  // StorageItems preserves the typed Avalonia file objects. Files is the
  // convenience path projection for local-path consumers.
  foreach (var file in args.StorageItems)
  {
    Console.WriteLine($"Dropped storage item: {file.Name}");
  }

  foreach (var path in args.Files)
  {
    Console.WriteLine($"Dropped: {path}");
  }
};

var upload = new FsusUpload { AccessibleName = "Attachments" };
upload.Items.Add(new FsusUploadItem("report.csv", 42_000, "text/csv"));
```

`FilesDropped` and `FilesRejected` expose accepted and rejected storage items
and path projections. Folder items and validation-predicate exceptions fail
closed as rejected input. Successful drops expose a short accepted state;
rejected, disabled, loading, and application-error states remain distinct
without changing the control bounds.

Enter, Space, pointer activation, and the automation Invoke pattern raise
`BrowseRequested` and execute the optional `BrowseCommand`. The control also
publishes an accessible name, help text, polite live status, and distinct
ready, drag-over, accepted, rejected, disabled, loading, and error statuses.

## Known Limitations

The control does not perform network upload or file reading by itself; product
apps own the file IO and network adapter. It does not open an operating-system
file picker: consumers handle `BrowseRequested` or `BrowseCommand` and choose
the picker integration. Headless automation coverage validates Avalonia
properties and the production automation peer; consumers remain responsible
for platform assistive-technology validation in their supported environments.
