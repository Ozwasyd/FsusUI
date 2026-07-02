using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusUploadTransferPrimitiveTests
{
  [Fact]
  public void UploadQueueHandlesAddProgressErrorRetryRemoveValidationAndDisabled()
  {
    var upload = new FsusUpload
    {
      AccessibleName = "Evidence upload",
      IsConfirmRemoveRequired = true,
      ValidateItem = (item) => item.SizeBytes > 1024 ? "File is too large." : null,
    };

    var accepted = upload.AddItem("report.pdf", 640, "application/pdf");
    var rejected = upload.AddItem("movie.mov", 2048, "video/quicktime");

    Assert.NotNull(accepted);
    Assert.NotNull(rejected);
    Assert.Equal(FsusUploadItemStatus.Queued, accepted!.Status);
    Assert.Equal(FsusUploadItemStatus.Error, rejected!.Status);
    Assert.Equal("File is too large.", rejected.ErrorMessage);
    Assert.Equal(2, upload.Items.Count);
    Assert.Equal("Remove report.pdf", accepted.RemoveActionName);

    Assert.True(upload.SetProgress(accepted.Id, 0.4));
    Assert.Equal(FsusUploadItemStatus.Uploading, accepted.Status);
    Assert.Equal(0.4, accepted.Progress);

    Assert.True(upload.MarkError(accepted.Id, "Network interrupted"));
    Assert.Equal(FsusUploadItemStatus.Error, accepted.Status);
    Assert.Equal("Network interrupted", accepted.ErrorMessage);

    Assert.True(upload.Retry(accepted.Id));
    Assert.Equal(FsusUploadItemStatus.Queued, accepted.Status);
    Assert.Equal(1, accepted.RetryCount);

    Assert.False(upload.RemoveItem(accepted.Id, confirmed: false));
    Assert.True(upload.RemoveItem(accepted.Id, confirmed: true));
    Assert.DoesNotContain(upload.Items, (item) => item.Id == accepted.Id);
    Assert.Contains("fsus-has-errors", upload.Classes);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(upload));
    Assert.Equal("Evidence upload", AutomationProperties.GetName(upload));
    Assert.Equal("1 files, 1 errors", AutomationProperties.GetItemStatus(upload));

    upload.IsDisabled = true;

    Assert.Null(upload.AddItem("blocked.txt", 10, "text/plain"));
    Assert.Contains("fsus-disabled", upload.Classes);
  }

  [Fact]
  public async Task TransferFiltersSelectsMovesAndSupportsKeyboardOnlyOperation()
  {
    var transfer = new KeyboardTransfer
    {
      AccessibleName = "Review routing",
      IsFilterable = true,
    };
    transfer.Items.Add(new FsusTransferItem("alpha", "Alpha"));
    transfer.Items.Add(new FsusTransferItem("beta", "Beta"));
    transfer.Items.Add(new FsusTransferItem("gamma", "Gamma") { IsDisabled = true });
    transfer.Items.Add(new FsusTransferItem("delta", "Delta"));
    transfer.RefreshLists();

    transfer.ApplyFilter("a");

    Assert.Equal(new[] { "Alpha", "Beta", "Gamma", "Delta" }, transfer.FilteredLeftItems.Select((item) => item.Label));
    Assert.Equal(0, transfer.HighlightedLeftIndex);

    Assert.True(transfer.ToggleLeftSelection("alpha"));
    Assert.False(transfer.ToggleLeftSelection("gamma"));
    Assert.True(transfer.MoveSelectedRight());

    Assert.Equal(new object?[] { "alpha" }, transfer.TargetValues);
    Assert.Contains("fsus-has-target", transfer.Classes);

    Assert.True(await transfer.PressAsync(Key.Space));
    Assert.Contains("beta", transfer.SelectedLeftValues);
    Assert.True(await transfer.PressAsync(Key.Enter));

    Assert.Equal(new object?[] { "alpha", "beta" }, transfer.TargetValues);

    transfer.ToggleRightSelection("alpha");
    Assert.True(transfer.MoveSelectedLeft());

    Assert.Equal(new object?[] { "beta" }, transfer.TargetValues);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(transfer));
    Assert.Equal("Review routing", AutomationProperties.GetName(transfer));
    Assert.Equal("3 source, 1 target", AutomationProperties.GetItemStatus(transfer));
  }

  [Fact]
  public void TransferLargeListsStayWithinVirtualizationBudgetShape()
  {
    var transfer = new FsusTransfer
    {
      VirtualizationThreshold = 100,
      VisibleItemLimit = 40,
    };
    for (var index = 0; index < 1000; index++)
    {
      transfer.Items.Add(new FsusTransferItem(index, $"Item {index:0000}"));
    }

    transfer.RefreshLists();

    Assert.True(transfer.IsVirtualized);
    Assert.Equal(1000, transfer.SourceCount);
    Assert.Equal(40, transfer.VirtualizedLeftItems.Count);
    Assert.True(transfer.EstimatedRetainedItemControls <= 80);

    transfer.ScrollLeftTo(500);

    Assert.Equal(500, transfer.VirtualizedLeftStartIndex);
    Assert.Equal("Item 0500", transfer.VirtualizedLeftItems[0].Label);
  }

  [Fact]
  public void UploadTransferThemeVisualAutomationAndPerformanceBaselinesCoverStable30()
  {
    var uploadTransfer = ReadControlTheme("UploadTransfer.axaml");
    Assert.Contains("fsus|FsusUpload", uploadTransfer);
    Assert.Contains("fsus|FsusTransfer", uploadTransfer);
    Assert.Contains("FsusThemeUploadSurfaceBrush", uploadTransfer);
    Assert.Contains("FsusMotionDurationEffective", uploadTransfer);
    Assert.Contains("FsusDensityControlDefaultY", uploadTransfer);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/UploadTransfer.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("upload-transfer-stable30-web-avalonia", visualFixture);

    var performanceMeasurements = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "performance",
      "avalonia-measurements.json"));
    Assert.Contains("upload-transfer-large-list-stable30", performanceMeasurements);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"upload-transfer\"", performanceBudgets);
  }

  private sealed class KeyboardTransfer : FsusTransfer
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
