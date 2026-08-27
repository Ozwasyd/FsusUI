using System.Windows.Input;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using Avalonia.Platform.Storage;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusDropZoneTests
{
  [Fact]
  public void DropZoneInitializesWithDefaultContracts()
  {
    var dropZone = new FsusDropZone
    {
      AccessibleName = "Document import zone",
      Instruction = "Drag files here or click to browse",
      HelpText = "Supported formats: PDF, PNG, CSV up to 10MB",
    };

    Assert.True(dropZone.AllowMultiple);
    Assert.True(dropZone.IsBrowseEnabled);
    Assert.True(dropZone.Focusable);
    Assert.Equal(FsusComponentSize.Md, dropZone.Size);
    Assert.False(dropZone.IsDisabled);
    Assert.False(dropZone.IsLoading);
    Assert.False(dropZone.IsError);
    Assert.False(dropZone.HasFilterError);
    Assert.False(dropZone.IsDragOver);

    Assert.Contains("fsus-drop-zone", dropZone.Classes);
    Assert.Contains("fsus-size-md", dropZone.Classes);
    Assert.Contains("fsus-multiple", dropZone.Classes);
    Assert.DoesNotContain("fsus-disabled", dropZone.Classes);
    Assert.DoesNotContain("fsus-loading", dropZone.Classes);
    Assert.DoesNotContain("fsus-dragover", dropZone.Classes);
    Assert.DoesNotContain("fsus-has-error", dropZone.Classes);

    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(dropZone));
    Assert.Equal("Document import zone", AutomationProperties.GetName(dropZone));
    Assert.Equal("Supported formats: PDF, PNG, CSV up to 10MB", AutomationProperties.GetHelpText(dropZone));
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
  }

  [Fact]
  public void DropZoneHandlesValidDropAndRaisesFilesDropped()
  {
    var dropZone = new FsusDropZone();
    FsusFileDropEventArgs? dropArgs = null;
    dropZone.FilesDropped += (_, e) => dropArgs = e;

    dropZone.HandleDrop(new[] { "invoice.pdf", "data.csv" });

    Assert.NotNull(dropArgs);
    Assert.Equal(2, dropArgs!.Files.Count);
    Assert.Contains("invoice.pdf", dropArgs.Files);
    Assert.Contains("data.csv", dropArgs.Files);
    Assert.Empty(dropArgs.RejectedFiles);
    Assert.False(dropZone.HasFilterError);
    Assert.Null(dropZone.FilterErrorMessage);
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
  }

  [Fact]
  public void DropZoneFiltersFilesByAcceptsExtensionAndMime()
  {
    var dropZone = new FsusDropZone
    {
      Accepts = ".png, image/*, application/pdf",
    };

    FsusFileDropEventArgs? dropArgs = null;
    FsusFileDropEventArgs? rejectedArgs = null;
    dropZone.FilesDropped += (_, e) => dropArgs = e;
    dropZone.FilesRejected += (_, e) => rejectedArgs = e;

    dropZone.HandleDrop(new[] { "logo.png", "photo.jpg", "doc.pdf", "archive.zip" });

    Assert.NotNull(dropArgs);
    Assert.NotNull(rejectedArgs);

    Assert.Equal(3, dropArgs!.Files.Count);
    Assert.Contains("logo.png", dropArgs.Files);
    Assert.Contains("photo.jpg", dropArgs.Files);
    Assert.Contains("doc.pdf", dropArgs.Files);

    Assert.Single(rejectedArgs!.RejectedFiles);
    Assert.Contains("archive.zip", rejectedArgs.RejectedFiles);

    Assert.True(dropZone.HasFilterError);
    Assert.NotNull(dropZone.FilterErrorMessage);
    Assert.Contains("archive.zip", dropZone.FilterErrorMessage);
    Assert.Contains("fsus-filter-error", dropZone.Classes);
    Assert.StartsWith("rejected:", AutomationProperties.GetItemStatus(dropZone));
  }

  [Fact]
  public void DropZoneAppliesCustomValidationPredicates()
  {
    var dropZone = new FsusDropZone
    {
      PathValidationPredicate = path => !path.Contains("blocked"),
    };

    FsusFileDropEventArgs? dropped = null;
    FsusFileDropEventArgs? rejected = null;
    dropZone.FilesDropped += (_, e) => dropped = e;
    dropZone.FilesRejected += (_, e) => rejected = e;

    dropZone.HandleDrop(new[] { "valid.txt", "blocked-file.txt" });

    Assert.NotNull(dropped);
    Assert.Single(dropped!.Files);
    Assert.Contains("valid.txt", dropped.Files);

    Assert.NotNull(rejected);
    Assert.Single(rejected!.RejectedFiles);
    Assert.Contains("blocked-file.txt", rejected.RejectedFiles);
    Assert.True(dropZone.HasFilterError);
  }

  [Fact]
  public void DropZoneSingleFileModeEnforcesLimit()
  {
    var dropZone = new FsusDropZone
    {
      AllowMultiple = false,
    };

    Assert.Contains("fsus-single", dropZone.Classes);
    Assert.DoesNotContain("fsus-multiple", dropZone.Classes);

    FsusFileDropEventArgs? dropped = null;
    FsusFileDropEventArgs? rejected = null;
    dropZone.FilesDropped += (_, e) => dropped = e;
    dropZone.FilesRejected += (_, e) => rejected = e;

    dropZone.HandleDrop(new[] { "first.pdf", "second.pdf", "third.pdf" });

    Assert.NotNull(dropped);
    Assert.Single(dropped!.Files);
    Assert.Equal("first.pdf", dropped.Files[0]);

    Assert.NotNull(rejected);
    Assert.Equal(2, rejected!.RejectedFiles.Count);
    Assert.Contains("second.pdf", rejected.RejectedFiles);
    Assert.Contains("third.pdf", rejected.RejectedFiles);

    Assert.True(dropZone.HasFilterError);
    Assert.Equal("Only a single file is accepted.", dropZone.FilterErrorMessage);
  }

  [Fact]
  public void DropZoneDisabledAndLoadingStatesBlockInteraction()
  {
    var dropZone = new FsusDropZone();
    var browseTriggered = false;
    dropZone.BrowseRequested += (_, _) => browseTriggered = true;

    // Disabled state
    dropZone.IsDisabled = true;
    Assert.False(dropZone.Focusable);
    Assert.Contains("fsus-disabled", dropZone.Classes);
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(dropZone));

    Assert.False(dropZone.RequestBrowse());
    Assert.False(browseTriggered);

    FsusFileDropEventArgs? droppedWhenDisabled = null;
    dropZone.FilesDropped += (_, e) => droppedWhenDisabled = e;
    dropZone.HandleDrop(new[] { "sample.txt" });
    Assert.Null(droppedWhenDisabled);

    // Re-enable and test Loading state
    dropZone.IsDisabled = false;
    dropZone.IsLoading = true;
    Assert.True(dropZone.Focusable);
    Assert.Contains("fsus-loading", dropZone.Classes);
    Assert.Equal("loading", AutomationProperties.GetItemStatus(dropZone));

    Assert.False(dropZone.RequestBrowse());
    Assert.False(browseTriggered);

    FsusFileDropEventArgs? droppedWhenLoading = null;
    dropZone.FilesDropped += (_, e) => droppedWhenLoading = e;
    dropZone.HandleDrop(new[] { "sample.txt" });
    Assert.Null(droppedWhenLoading);
  }

  [Fact]
  public void DropZoneErrorStateReflectsMessageAndStatus()
  {
    var dropZone = new FsusDropZone
    {
      IsError = true,
      ErrorMessage = "Storage volume is read-only",
    };

    Assert.Contains("fsus-has-error", dropZone.Classes);
    Assert.Equal("error: Storage volume is read-only", AutomationProperties.GetItemStatus(dropZone));
    Assert.Equal("Storage volume is read-only", AutomationProperties.GetHelpText(dropZone));
  }

  [Fact]
  public void DropZoneCommandAndBrowseRequestedActivation()
  {
    var commandExecuted = false;
    object? receivedParam = null;
    var command = new TestCommand(param =>
    {
      commandExecuted = true;
      receivedParam = param;
    });

    var eventRaised = false;
    var dropZone = new FsusDropZone
    {
      BrowseCommand = command,
      BrowseCommandParameter = "custom-folder",
    };
    dropZone.BrowseRequested += (_, _) => eventRaised = true;

    Assert.True(dropZone.RequestBrowse());
    Assert.True(commandExecuted);
    Assert.Equal("custom-folder", receivedParam);
    Assert.True(eventRaised);

    // When BrowseEnabled is false, RequestBrowse returns false and does nothing
    dropZone.IsBrowseEnabled = false;
    commandExecuted = false;
    eventRaised = false;
    Assert.False(dropZone.RequestBrowse());
    Assert.False(commandExecuted);
    Assert.False(eventRaised);
  }

  [Fact]
  public void DropZoneDistinguishableStatesProvideDistinctAutomationStatusesAndClasses()
  {
    var dropZone = new FsusDropZone();

    // 1. Ready
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-multiple", dropZone.Classes);

    // 2. Disabled
    dropZone.IsDisabled = true;
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-disabled", dropZone.Classes);

    // 3. Loading
    dropZone.IsDisabled = false;
    dropZone.IsLoading = true;
    Assert.Equal("loading", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-loading", dropZone.Classes);

    // 4. Error
    dropZone.IsLoading = false;
    dropZone.IsError = true;
    dropZone.ErrorMessage = "Network failure";
    Assert.Equal("error: Network failure", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-has-error", dropZone.Classes);

    // 5. Filter Error
    dropZone.IsError = false;
    dropZone.ErrorMessage = null;
    dropZone.HasFilterError = true;
    dropZone.FilterErrorMessage = "Unsupported file type";
    Assert.Equal("rejected: Unsupported file type", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-filter-error", dropZone.Classes);

    // Verify all statuses are mutually distinct
    var statuses = new[]
    {
      "ready",
      "disabled",
      "loading",
      "error: Network failure",
      "rejected: Unsupported file type",
    };
    Assert.Equal(statuses.Length, statuses.Distinct().Count());
  }

  [Fact]
  public void DropZoneMaintainsZeroLayoutShiftAcrossStateChanges()
  {
    var dropZone = new FsusDropZone
    {
      BorderThickness = new Thickness(1),
      Padding = new Thickness(16),
      Width = 320,
      Height = 120,
    };

    var initialThickness = dropZone.BorderThickness;
    var initialPadding = dropZone.Padding;

    // Simulate state transitions
    dropZone.Classes.Add("fsus-dragover");
    Assert.Equal(initialThickness, dropZone.BorderThickness);
    Assert.Equal(initialPadding, dropZone.Padding);

    dropZone.Classes.Remove("fsus-dragover");
    dropZone.IsDisabled = true;
    Assert.Equal(initialThickness, dropZone.BorderThickness);
    Assert.Equal(initialPadding, dropZone.Padding);

    dropZone.IsDisabled = false;
    dropZone.IsLoading = true;
    Assert.Equal(initialThickness, dropZone.BorderThickness);
    Assert.Equal(initialPadding, dropZone.Padding);

    dropZone.IsLoading = false;
    dropZone.IsError = true;
    dropZone.ErrorMessage = "Error message";
    Assert.Equal(initialThickness, dropZone.BorderThickness);
    Assert.Equal(initialPadding, dropZone.Padding);

    dropZone.IsError = false;
    dropZone.HasFilterError = true;
    Assert.Equal(initialThickness, dropZone.BorderThickness);
    Assert.Equal(initialPadding, dropZone.Padding);
  }

  private sealed class TestCommand(Action<object?> execute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => execute(parameter);
  }
}
