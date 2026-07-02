using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using Avalonia.Layout;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusLayoutPrimitiveTests
{
  [Fact]
  public void SpaceRowAndColExposeTokenBackedResponsiveLayoutState()
  {
    var space = new FsusSpace
    {
      Gap = FsusLayoutGap.Md,
      Orientation = Orientation.Horizontal,
      IsWrapEnabled = true,
      Align = FsusLayoutAlignment.Center,
    };

    Assert.Contains("fsus-space", space.Classes);
    Assert.Contains("fsus-gap-md", space.Classes);
    Assert.Contains("fsus-wrap", space.Classes);
    Assert.Equal(FsusTokens.Space3Thickness.Left, space.GapSize);
    Assert.Equal(FsusLayoutAlignment.Center, space.Align);

    var row = new FsusRow
    {
      Gap = FsusLayoutGap.Lg,
      Breakpoint = FsusLayoutBreakpoint.Sm,
    };
    var col = new FsusCol
    {
      Span = 8,
      SmSpan = 12,
      MdSpan = 6,
      Order = 2,
    };
    row.Children.Add(col);

    row.RefreshResponsiveColumns(500);

    Assert.Contains("fsus-row", row.Classes);
    Assert.Contains("fsus-col", col.Classes);
    Assert.Equal(12, col.EffectiveSpan);
    Assert.Equal(0.5d, col.WidthRatio);
    Assert.Contains("fsus-breakpoint-sm", row.Classes);

    row.RefreshResponsiveColumns(900);

    Assert.Equal(6, col.EffectiveSpan);
    Assert.Equal(0.25d, col.WidthRatio);
    Assert.Contains("fsus-order-2", col.Classes);
  }

  [Fact]
  public void ContainerRegionsExposeAutomationAndNestedRegionClasses()
  {
    var container = new FsusContainer
    {
      Orientation = Orientation.Vertical,
      Gap = FsusLayoutGap.Sm,
    };
    var header = new FsusHeader { Content = "Top navigation" };
    var aside = new FsusAside { Content = "Filters" };
    var main = new FsusMain { Content = "Results" };
    var footer = new FsusFooter { Content = "Pagination" };
    container.Children.Add(header);
    container.Children.Add(aside);
    container.Children.Add(main);
    container.Children.Add(footer);

    container.RefreshRegions();

    Assert.Contains("fsus-container", container.Classes);
    Assert.Contains("fsus-nested-regions", container.Classes);
    Assert.Contains("fsus-header", header.Classes);
    Assert.Contains("fsus-aside", aside.Classes);
    Assert.Contains("fsus-main", main.Classes);
    Assert.Contains("fsus-footer", footer.Classes);
    Assert.Equal("Top navigation", AutomationProperties.GetName(header));
    Assert.Equal("Results", AutomationProperties.GetName(main));
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(container));
  }

  [Fact]
  public void ScrollbarSupportsKeyboardAndPointerScrollBehavior()
  {
    var offsets = new List<Vector>();
    var scrollbar = new KeyboardScrollbar
    {
      AccessibleName = "Results list",
      KeyboardScrollStep = 32,
      PointerScrollStep = 18,
      Content = "Long content",
    };
    scrollbar.Scrolled += (_, args) => offsets.Add(args.Offset);

    scrollbar.Press(Key.Down);
    scrollbar.Press(Key.PageDown);
    scrollbar.ScrollPointerDelta(new Vector(0, 1));
    scrollbar.Press(Key.Up);

    Assert.Contains("fsus-scrollbar", scrollbar.Classes);
    Assert.Equal(new Vector(0, 82), scrollbar.ScrollOffset);
    Assert.Equal(
      new[] { new Vector(0, 32), new Vector(0, 96), new Vector(0, 114), new Vector(0, 82) },
      offsets);
    Assert.Equal("Results list", AutomationProperties.GetName(scrollbar));
    Assert.Equal(AutomationControlType.Pane, AutomationProperties.GetControlTypeOverride(scrollbar));
  }

  [Fact]
  public void VisualHiddenParticipatesInAccessibilityButNotVisualLayout()
  {
    var hidden = new FsusVisualHidden { Content = "Filter results" };

    hidden.Measure(Size.Infinity);

    Assert.Contains("fsus-visual-hidden", hidden.Classes);
    Assert.True(hidden.IsVisible);
    Assert.False(hidden.IsHitTestVisible);
    Assert.Equal(0d, hidden.Opacity);
    Assert.Equal(new Size(1, 1), hidden.DesiredSize);
    Assert.Equal("Filter results", AutomationProperties.GetName(hidden));
    Assert.Equal(AccessibilityView.Control, AutomationProperties.GetAccessibilityView(hidden));
  }

  [Fact]
  public void LayoutThemeDocsAndVisualFixturesCoverStable22Requirements()
  {
    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Layout.axaml", theme);

    var layout = ReadControlTheme("Layout.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusSpace",
      "fsus|FsusRow",
      "fsus|FsusCol",
      "fsus|FsusContainer",
      "fsus|FsusScrollbar",
      "fsus|FsusVisualHidden",
    })
    {
      Assert.Contains(selector, layout);
    }

    Assert.Contains("FsusSpace3", layout);
    Assert.Contains("FsusDensityControlDefaultY", layout);
    Assert.Contains("FsusThemeBorderBrush", layout);

    var docs = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "docs",
      "avalonia",
      "layout-primitives.md"));
    Assert.Contains("Web flex/grid behavior", docs);
    Assert.Contains("Avalonia layout panels", docs);
    Assert.Contains("screen-reader-only", docs);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("layout-primitives-stable22-web-avalonia", visualFixture);
    Assert.Contains("avalonia-layout-panel-measure-001", visualFixture);

    var overrideFile = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "platform-overrides",
      "avalonia.yaml"));
    Assert.Contains("avalonia-layout-panel-measure-001", overrideFile);
  }

  private sealed class KeyboardScrollbar : FsusScrollbar
  {
    public void Press(Key key) => HandleKey(key);
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
