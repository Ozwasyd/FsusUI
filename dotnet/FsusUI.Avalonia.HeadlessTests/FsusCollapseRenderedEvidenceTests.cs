using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusCollapseRenderedEvidenceTests
{
  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light, false)]
  [InlineData(FsusThemeVariant.Light, true)]
  [InlineData(FsusThemeVariant.Dark, false)]
  [InlineData(FsusThemeVariant.Dark, true)]
  public void MountedPointerToggleSynchronizesChildrenBeforeValueChanged(
    FsusThemeVariant variant,
    bool initiallyActive)
  {
    var item = new FsusCollapseItem { Title = "Options", ItemKey = "options", Content = "Options content." };
    var collapse = new FsusCollapse
    {
      ActiveNames = initiallyActive ? new object?[] { "options" } : Array.Empty<object?>(),
      Content = item,
    };
    var window = MountCollapse(collapse, variant);
    try
    {
      AssertItemState(item, initiallyActive);
      var changes = new List<FsusCollapseValueChangedEventArgs>();
      collapse.ValueChanged += (_, args) =>
      {
        Assert.Equal(args.NewActiveNames, collapse.ActiveNames);
        AssertItemState(item, args.NewActiveNames.Contains(item.ItemKey));
        changes.Add(args);
      };

      ClickHeader(window, item);
      Assert.Equal(initiallyActive ? Array.Empty<object?>() : new object?[] { "options" }, collapse.ActiveNames);
      AssertItemState(item, !initiallyActive);
      var first = Assert.Single(changes);
      Assert.Equal(initiallyActive ? new object?[] { "options" } : Array.Empty<object?>(), first.OldActiveNames);
      Assert.Equal(collapse.ActiveNames, first.NewActiveNames);

      ClickHeader(window, item);
      Assert.Equal(initiallyActive ? new object?[] { "options" } : Array.Empty<object?>(), collapse.ActiveNames);
      AssertItemState(item, initiallyActive);
      Assert.Equal(2, changes.Count);
      Assert.Equal(first.NewActiveNames, changes[1].OldActiveNames);
      Assert.Equal(collapse.ActiveNames, changes[1].NewActiveNames);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void MountedPointerAccordionCollapsesPreviousItem(FsusThemeVariant variant)
  {
    var itemA = new FsusCollapseItem { Title = "Options", ItemKey = "options", Content = "Options content." };
    var itemB = new FsusCollapseItem { Title = "Advanced", ItemKey = "advanced", Content = "Advanced content." };
    var stack = new StackPanel();
    stack.Children.Add(itemA);
    stack.Children.Add(itemB);
    var collapse = new FsusCollapse { Accordion = true, ActiveNames = new object?[] { "options" }, Content = stack };
    var window = MountCollapse(collapse, variant);
    try
    {
      AssertItemState(itemA, true);
      AssertItemState(itemB, false);
      var changes = new List<FsusCollapseValueChangedEventArgs>();
      collapse.ValueChanged += (_, args) =>
      {
        Assert.Equal(args.NewActiveNames, collapse.ActiveNames);
        AssertItemState(itemA, args.NewActiveNames.Contains(itemA.ItemKey));
        AssertItemState(itemB, args.NewActiveNames.Contains(itemB.ItemKey));
        changes.Add(args);
      };

      ClickHeader(window, itemB);
      Assert.Equal(new object?[] { "advanced" }, collapse.ActiveNames);
      AssertItemState(itemA, false);
      AssertItemState(itemB, true);
      var first = Assert.Single(changes);
      Assert.Equal(new object?[] { "options" }, first.OldActiveNames);
      Assert.Equal(new object?[] { "advanced" }, first.NewActiveNames);

      ClickHeader(window, itemB);
      Assert.Empty(collapse.ActiveNames);
      AssertItemState(itemA, false);
      AssertItemState(itemB, false);
      Assert.Equal(2, changes.Count);
      Assert.Equal(first.NewActiveNames, changes[1].OldActiveNames);
      Assert.Empty(changes[1].NewActiveNames);

      ClickHeader(window, itemA);
      Assert.Equal(new object?[] { "options" }, collapse.ActiveNames);
      AssertItemState(itemA, true);
      AssertItemState(itemB, false);
      Assert.Equal(3, changes.Count);
      Assert.Empty(changes[2].OldActiveNames);
      Assert.Equal(collapse.ActiveNames, changes[2].NewActiveNames);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light, false)]
  [InlineData(FsusThemeVariant.Light, true)]
  [InlineData(FsusThemeVariant.Dark, false)]
  [InlineData(FsusThemeVariant.Dark, true)]
  public void MountedPointerDisabledItemPreservesModelAndChildren(
    FsusThemeVariant variant,
    bool accordion)
  {
    var itemA = new FsusCollapseItem { Title = "Options", ItemKey = "options", Content = "Options content." };
    var itemB = new FsusCollapseItem { Title = "Advanced", ItemKey = "advanced", Disabled = true, Content = "Advanced content." };
    var stack = new StackPanel();
    stack.Children.Add(itemA);
    stack.Children.Add(itemB);
    var collapse = new FsusCollapse { Accordion = accordion, ActiveNames = new object?[] { "options" }, Content = stack };
    var window = MountCollapse(collapse, variant);
    try
    {
      var initialNames = collapse.ActiveNames;
      var changes = new List<FsusCollapseValueChangedEventArgs>();
      collapse.ValueChanged += (_, args) => changes.Add(args);
      ClickHeader(window, itemB);
      Assert.Same(initialNames, collapse.ActiveNames);
      Assert.Empty(changes);
      AssertItemState(itemA, true);
      AssertItemState(itemB, false);
      Assert.Contains("fsus-disabled", itemB.Classes);

      // Programmatic changes still use the same synchronization path, including disabled items.
      collapse.ActiveNames = new object?[] { "advanced" };
      window.UpdateLayout();
      AssertItemState(itemA, false);
      AssertItemState(itemB, true);
      ClickHeader(window, itemB);
      Assert.Equal(new object?[] { "advanced" }, collapse.ActiveNames);
      AssertItemState(itemB, true);
      Assert.Empty(changes);
    }
    finally
    {
      window.Close();
    }
  }

  private static Window MountCollapse(FsusCollapse collapse, FsusThemeVariant variant)
  {
    ApplyTheme(variant);
    var window = new Window { Width = 560, Height = 440, Content = collapse, ShowInTaskbar = false };
    AttachFsusTheme(window);
    window.Show();
    window.UpdateLayout();
    return window;
  }

  private static void ClickHeader(Window window, FsusCollapseItem item)
  {
    window.UpdateLayout();
    using var frame = window.CaptureRenderedFrame();
    Assert.NotNull(frame);
    var header = Assert.Single(item.GetVisualDescendants().OfType<Border>(), border => border.Name == "PART_Header");
    Assert.True(header.Bounds.Width > 0 && header.Bounds.Height > 0);
    var point = Assert.NotNull(header.TranslatePoint(new Point(header.Bounds.Width / 2, header.Bounds.Height / 2), window));
    var hit = window.InputHitTest(point);
    Assert.True(ReferenceEquals(hit, header) ||
      hit is Visual visual && visual.GetVisualAncestors().Contains(header),
      $"Header at {point} should be hit; actual: {hit}.");
    window.MouseMove(point);
    window.MouseDown(point, MouseButton.Left);
    window.MouseUp(point, MouseButton.Left);
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
  }

  private static void AssertItemState(FsusCollapseItem item, bool active)
  {
    Assert.Equal(active, item.IsActive);
    Assert.Equal(active, item.Classes.Contains("fsus-active"));
    Assert.Equal(active ? "Expanded" : "Collapsed", AutomationProperties.GetHelpText(item));
    var content = Assert.Single(item.GetVisualDescendants().OfType<Border>(), border => border.Name == "PART_Content");
    Assert.Equal(active, content.IsVisible);
  }

  [AvaloniaFact]
  public void RendersCollapseStateMatrixToPng()
  {
    ApplyTheme(FsusThemeVariant.Light);

    var item1 = new FsusCollapseItem
    {
      Title = "Options",
      ItemKey = "options",
      Content = "Options content.",
    };
    var item2 = new FsusCollapseItem
    {
      Title = "Advanced",
      ItemKey = "advanced",
      Content = "Advanced content.",
    };
    var item3 = new FsusCollapseItem
    {
      Title = "Disabled",
      ItemKey = "disabled",
      Disabled = true,
      Content = "Disabled content.",
    };
    var collapse = new FsusCollapse
    {
      Accordion = false,
      ActiveNames = new object[] { "options" },
    };
    var stack = new StackPanel { Margin = new Thickness(24), Spacing = 0, Width = 560 };
    stack.Children.Add(item1);
    stack.Children.Add(item2);
    stack.Children.Add(item3);
    collapse.Content = stack;

    var surface = new Border
    {
      Width = 560,
      Padding = new Thickness(24),
      Background = new SolidColorBrush(Colors.White),
      Child = collapse,
    };
    var window = new Window
    {
      Width = 560,
      Height = 440,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    window.Show();

    window.Measure(new Size(560, 440));
    window.Arrange(new Rect(0, 0, 560, 440));
    surface.Arrange(new Rect(0, 0, 560, 440));

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-collapse-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "collapse-state-matrix-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(560, 440), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    Assert.True(File.Exists(outputPath));
    Assert.True(new FileInfo(outputPath).Length > 1_000);
    Assert.True(item1.IsMeasureValid);
    Assert.True(item1.IsArrangeValid);
    Assert.True(item1.Bounds.Width > 0);
    Assert.True(item1.Bounds.Height > 0);
    Assert.All(new[] { item1, item2, item3 }, item =>
    {
      Assert.True(item.IsArrangeValid, $"{item.Title} arrange should complete.");
      Assert.True(item.Bounds.Height > 0, $"{item.Title} should have a height.");
    });
    Assert.Contains("fsus-active", item1.Classes);
    Assert.DoesNotContain("fsus-active", item2.Classes);
    Assert.Contains("fsus-disabled", item3.Classes);
    window.Close();
  }

  private static FsusThemeOptions themeOptions = new();

  private static void ApplyTheme(FsusThemeVariant variant)
  {
    themeOptions = new FsusThemeOptions
    {
      Variant = variant,
      MotionMode = FsusMotionMode.Enabled,
    };
  }

  private static void AttachFsusTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, themeOptions);
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new global::Avalonia.Markup.Xaml.Styling.StyleInclude(
        new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }

  private static string FindRepositoryRoot()
  {
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null &&
           !File.Exists(Path.Combine(dir.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
    {
      dir = dir.Parent;
    }

    return dir?.FullName
      ?? throw new InvalidOperationException("Unable to locate repository root.");
  }
}
