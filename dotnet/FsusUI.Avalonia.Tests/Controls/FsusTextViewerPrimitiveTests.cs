using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTextViewerPrimitiveTests
{
  [Fact]
  public async Task TextViewerRendersStructuredMixedLanguageBlocksAndKeyboardNavigation()
  {
    var viewer = new KeyboardTextViewer
    {
      AccessibleName = "Release notes",
    };
    viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Heading, "版本 1.2 Release", Level: 1));
    viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Paragraph, "Fixes layout and accessibility regressions."));
    viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.ListItem, "支持中文、English、かな"));
    viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Code, "dotnet test", Language: "bash"));

    Assert.True(await viewer.RenderAsync());

    Assert.Equal(4, viewer.RenderedBlocks.Count);
    Assert.True(viewer.HasMixedLanguage);
    Assert.Equal("版本 1.2 Release", viewer.RenderedBlocks[0].Text);
    Assert.Equal("bash", viewer.RenderedBlocks[3].Language);
    Assert.Equal(AutomationControlType.Text, AutomationProperties.GetControlTypeOverride(viewer));
    Assert.Equal("Release notes", AutomationProperties.GetName(viewer));
    Assert.Equal("ready, 4 blocks, focus 1 of 4", AutomationProperties.GetItemStatus(viewer));

    Assert.True(await viewer.PressAsync(Key.Down));
    Assert.Equal(1, viewer.FocusedBlockIndex);
    Assert.Equal("ready, 4 blocks, focus 2 of 4", AutomationProperties.GetItemStatus(viewer));
  }

  [Fact]
  public async Task TextViewerVirtualizesLongContentAndHonorsCancellation()
  {
    var viewer = new FsusTextViewer
    {
      AccessibleName = "Long document",
      VirtualizationThreshold = 200,
      VisibleBlockLimit = 80,
    };
    for (var index = 0; index < 10_000; index++)
    {
      viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Paragraph, $"Paragraph {index}"));
    }

    Assert.True(await viewer.RenderAsync());

    Assert.True(viewer.IsVirtualized);
    Assert.Equal(80, viewer.VisibleBlocks.Count);
    Assert.True(viewer.EstimatedRetainedBlockCount <= viewer.RenderBudget.RetainedBlocks);
    Assert.True(viewer.EvaluateBudget().WithinBudget);

    viewer.ScrollToBlock(9_950);

    Assert.Equal(9_950, viewer.VisibleBlockStartIndex);
    Assert.Equal("Paragraph 9950", viewer.VisibleBlocks[0].Text);

    using var cancellation = new CancellationTokenSource();
    cancellation.Cancel();

    Assert.False(await viewer.RenderAsync(cancellation.Token));
    Assert.True(viewer.LastRenderCanceled);
    Assert.Equal("canceled", viewer.StateName);
  }

  [Fact]
  public void TextViewerThemeVisualAccessibilityAndPerformanceBaselinesCoverStable36()
  {
    var textViewer = ReadControlTheme("TextViewer.axaml");
    Assert.Contains("fsus|FsusTextViewer", textViewer);
    Assert.Contains("FsusThemeTextViewerSurfaceBrush", textViewer);
    Assert.Contains("FsusMotionDurationEffective", textViewer);
    Assert.Contains("fsus-virtualized", textViewer);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/TextViewer.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("text-viewer-stable36-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("text-viewer-stable36", accessibilityEvidence);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"text-viewer\"", performanceBudgets);
  }

  private sealed class KeyboardTextViewer : FsusTextViewer
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
