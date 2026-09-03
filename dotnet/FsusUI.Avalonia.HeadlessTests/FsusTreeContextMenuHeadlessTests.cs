using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeContextMenuHeadlessTests
{
  private const string CandidateEnvironmentVariable = "FSUS_PR668_CANDIDATE_SHA";

  [AvaloniaFact]
  public async Task RealPointerKeyboardOverlayAndAutomationPathsAreComposable()
  {
    EnsureFullTheme();
    var fixture = CreateFixture(FsusThemeVariant.Light, 900);
    fixture.Window.Show();
    Arrange(fixture.Root, 900, 520);

    var activationKeys = new List<string>();
    fixture.Tree.NodeActivated += (_, args) =>
    {
      args.Handled = true;
      activationKeys.Add(args.Key);
    };
    var expansions = new List<FsusTreeExpansionChangedEventArgs>();
    fixture.Tree.ExpansionChanged += (_, args) => expansions.Add(args);

    var rootRow = FindByAutomationId(fixture.Tree, "fsus-tree-node-src");
    var rootOrigin = rootRow.TranslatePoint(default, fixture.Window) ?? default;
    Click(
      fixture.Window,
      new Point(rootOrigin.X + 8, rootOrigin.Y + rootRow.Bounds.Height / 2),
      MouseButton.Left);
    Assert.False(expansions[^1].IsExpanded);
    Assert.Equal(FsusTreeInteractionSource.Pointer, expansions[^1].Source);
    rootRow = FindByAutomationId(fixture.Tree, "fsus-tree-node-src");
    rootOrigin = rootRow.TranslatePoint(default, fixture.Window) ?? default;
    Click(
      fixture.Window,
      new Point(rootOrigin.X + 8, rootOrigin.Y + rootRow.Bounds.Height / 2),
      MouseButton.Left);
    Assert.True(expansions[^1].IsExpanded);
    Assert.Empty(activationKeys);
    Arrange(fixture.Root, 900, 520);

    var fileRow = FindByAutomationId(fixture.Tree, "fsus-tree-node-editor");
    var filePoint = Center(fileRow, fixture.Window);
    var diagnostics =
      $"point={filePoint} row={fileRow.Bounds} tree={fixture.Tree.Bounds} host={fixture.Host.Bounds} window={fixture.Window.Bounds}";
    Click(fixture.Window, filePoint, MouseButton.Left);
    Assert.True(
      activationKeys.SequenceEqual(["editor"]),
      $"Expected real pointer activation; {diagnostics}.");
    Assert.Contains("editor", fixture.Tree.SelectedKeys);
    Assert.Equal("editor", fixture.Tree.FocusedKey);
    Assert.Contains("selected", AutomationProperties.GetItemStatus(fileRow));

    Assert.True(fixture.Tree.FocusNode("readme"));
    fixture.Window.KeyPress(
      Key.Space,
      RawInputModifiers.None,
      PhysicalKey.Space,
      null);
    Assert.Contains("readme", fixture.Tree.SelectedKeys);

    var serviceRow = FindByAutomationId(fixture.Tree, "fsus-tree-node-service");
    Click(fixture.Window, Center(serviceRow, fixture.Window), MouseButton.Right);
    Arrange(fixture.Root, 900, 520);

    Assert.True(fixture.Menu.IsOpen);
    Assert.Equal("service", fixture.Menu.TargetKey);
    Assert.Contains("service", fixture.Tree.SelectedKeys);
    Assert.Equal("service", fixture.Tree.FocusedKey);
    Assert.Equal(["editor"], activationKeys);
    Assert.Equal(FsusOverlayPlacement.BottomStart, fixture.Menu.EffectivePlacement);
    Assert.Equal(fixture.Menu.OverlayEntry!.Bounds, fixture.Menu.Bounds);
    Assert.Equal(5, fixture.Menu.GetLogicalDescendants().OfType<FsusContextMenuEntry>().Count());
    Assert.Equal(AutomationControlType.Menu,
      AutomationProperties.GetControlTypeOverride(fixture.Menu));
    Assert.All(
      fixture.Menu.Items.OfType<FsusContextMenuItem>(),
      item => Assert.Equal(
        AutomationControlType.MenuItem,
        AutomationProperties.GetControlTypeOverride(item)));

    fixture.Window.KeyPress(
      Key.End,
      RawInputModifiers.None,
      PhysicalKey.End,
      null);
    Assert.Equal("delete", fixture.Menu.FocusedKey);
    var activated = new List<FsusContextMenuItemActivatedEventArgs>();
    fixture.Menu.ItemActivated += (_, args) => activated.Add(args);
    fixture.Window.KeyPress(
      Key.Enter,
      RawInputModifiers.None,
      PhysicalKey.Enter,
      null);
    var action = Assert.Single(activated);
    Assert.Equal("service", action.TargetKey);
    Assert.Equal("delete", action.ActionKey);
    Assert.Same(fixture.Tree, fixture.Host.LastRestoredFocus);

    fixture.Host.IsHitTestVisible = false;
    fixture.Tree.Focus();
    Assert.True(fixture.Tree.FocusNode("editor"));
    fixture.Window.KeyPress(
      Key.F10,
      RawInputModifiers.Shift,
      PhysicalKey.F10,
      null);
    Arrange(fixture.Root, 900, 520);
    Assert.True(fixture.Menu.IsOpen);
    Assert.Equal("editor", fixture.Menu.TargetKey);
    fixture.Window.KeyPress(
      Key.Escape,
      RawInputModifiers.None,
      PhysicalKey.Escape,
      null);
    Assert.False(fixture.Menu.IsOpen);

    fixture.Host.IsHitTestVisible = false;
    fixture.Tree.Focus();
    fixture.Window.KeyPress(
      Key.Enter,
      RawInputModifiers.None,
      PhysicalKey.Enter,
      null);
    Assert.Equal(["editor", "editor"], activationKeys);

    fixture.Host.IsHitTestVisible = false;
    fixture.Tabs.SelectKey("editor-tab");
    var selectionBefore = fixture.Tabs.SelectedKey;
    var pane = fixture.Tabs.Panes.Single(candidate => candidate.Key == "service-tab");
    var panePoint = Center(pane, fixture.Window);
    Click(fixture.Window, panePoint, MouseButton.Right);
    Assert.Equal(selectionBefore, fixture.Tabs.SelectedKey);
    Assert.True(
      fixture.Tabs.FocusedKey == "service-tab",
      $"Expected service tab context focus; point={panePoint} pane={pane.Bounds} tabs={fixture.Tabs.Bounds}.");
    Assert.True(fixture.Menu.IsOpen);
    Assert.Equal("service-tab", fixture.Menu.TargetKey);
    Click(fixture.Window, new Point(600, 400), MouseButton.Left);
    Assert.False(fixture.Menu.IsOpen);
    Assert.Same(fixture.Tabs, fixture.Host.LastRestoredFocus);

    fixture.Host.IsHitTestVisible = false;
    fixture.Tabs.Focus();
    fixture.Window.KeyPress(
      Key.F10,
      RawInputModifiers.Shift,
      PhysicalKey.F10,
      null);
    Arrange(fixture.Root, 900, 520);
    Assert.True(fixture.Menu.IsOpen);
    Assert.Equal("service-tab", fixture.Menu.TargetKey);
    Assert.True(await fixture.Menu.CloseAsync());

    fixture.Host.IsHitTestVisible = false;
    Click(
      fixture.Window,
      Center(fixture.GeneralContextTarget, fixture.Window),
      MouseButton.Right);
    Arrange(fixture.Root, 900, 520);
    Assert.True(fixture.Menu.IsOpen);
    Assert.Same(fixture.GeneralContextTarget, fixture.Menu.Invoker);
    var disabledItem = fixture.Menu.Items.OfType<FsusContextMenuItem>()
      .Single(item => item.Key == "paste");
    Click(fixture.Window, Center(disabledItem, fixture.Window), MouseButton.Left);
    Assert.True(fixture.Menu.IsOpen);
    Assert.DoesNotContain(
      activated,
      action => action.TargetKey == string.Empty);
    var renameItem = fixture.Menu.Items.OfType<FsusContextMenuItem>()
      .Single(item => item.Key == "rename");
    var renamePoint = Center(renameItem, fixture.Window);
    Click(fixture.Window, renamePoint, MouseButton.Left);
    Assert.False(
      fixture.Menu.IsOpen,
      $"Expected pointer menu activation; point={renamePoint} item={renameItem.Bounds} menu={fixture.Menu.Bounds} host={fixture.Host.Bounds}.");
    var pointerAction = activated.Last();
    Assert.Equal(string.Empty, pointerAction.TargetKey);
    Assert.Equal("rename", pointerAction.ActionKey);
    Assert.Same(fixture.GeneralContextTarget, fixture.Host.LastRestoredFocus);

    var firstItem = fixture.Menu.Items.OfType<FsusContextMenuItem>()
      .First(item => item.IsEnabled);
    Assert.True(firstItem.Bounds.Height >= 44);
    Assert.Equal("Ctrl+N", AutomationProperties.GetHelpText(firstItem));
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(
      fixture.Menu.Items.OfType<FsusContextMenuItem>()
        .Single(item => item.Key == "paste")));
    Assert.Contains("dangerous", AutomationProperties.GetItemStatus(
      fixture.Menu.Items.OfType<FsusContextMenuItem>()
        .Single(item => item.Key == "delete")));

    Assert.NotNull(ControlAutomationPeer.CreatePeerForElement(fixture.Menu));
    Assert.All(
      fixture.Menu.Items.OfType<FsusContextMenuItem>(),
      item => Assert.NotNull(ControlAutomationPeer.CreatePeerForElement(item)));
    fixture.Window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersThemeZoomReducedMotionAndAutomationEvidence()
  {
    EnsureFullTheme();
    var outputRoot =
      Environment.GetEnvironmentVariable("FSUS_PR668_EVIDENCE_ROOT")
      ?? Path.Combine(
        AppContext.BaseDirectory,
        "TestResults",
        "fsus-pr668-rendered-evidence",
        "after");
    Directory.CreateDirectory(outputRoot);
    var captures = new List<RenderCapture>();
    foreach (var (theme, density, zoom) in new[]
    {
      (FsusThemeVariant.Light, FsusDensity.Default, 100),
      (FsusThemeVariant.Dark, FsusDensity.Default, 100),
      (FsusThemeVariant.Light, FsusDensity.Compact, 200),
      (FsusThemeVariant.Dark, FsusDensity.Spacious, 200),
    })
    {
      const int width = 900;
      const int height = 520;
      var fixture = CreateFixture(theme, width, density);
      fixture.Window.Show();
      Arrange(fixture.Root, width, height);
      var serviceRow =
        FindByAutomationId(fixture.Tree, "fsus-tree-node-service");
      var serviceOrigin =
        serviceRow.TranslatePoint(default, fixture.Window) ?? default;
      var contextPoint = new Point(
        serviceOrigin.X + Math.Max(1, serviceRow.Bounds.Width - 24),
        serviceOrigin.Y + serviceRow.Bounds.Height / 2);
      Click(fixture.Window, contextPoint, MouseButton.Right);
      Arrange(fixture.Root, width, height);
      Assert.True(fixture.Menu.IsOpen);
      Assert.Equal("service", fixture.Menu.TargetKey);
      Assert.Equal("service", fixture.Tree.FocusedKey);
      Assert.Contains("service", fixture.Tree.SelectedKeys);
      Assert.Equal(
        new Rect(
          fixture.Window.TranslatePoint(contextPoint, fixture.Host) ??
            contextPoint,
          new Size(1, 1)),
        fixture.Menu.OverlayEntry!.Options.AnchorBounds);
      var fileName =
        $"tree-context-menu-{theme.ToString().ToLowerInvariant()}-{density.ToString().ToLowerInvariant()}-zoom-{zoom}.png";
      var path = Path.Combine(outputRoot, fileName);
      var scale = zoom / 100d;
      using var bitmap = new RenderTargetBitmap(
        new PixelSize((int)(width * scale), (int)(height * scale)),
        new Vector(96 * scale, 96 * scale));
      bitmap.Render(fixture.Root);
      using (var stream = File.Create(path))
      {
        bitmap.Save(stream);
      }

      var items = fixture.Menu.Items.OfType<FsusContextMenuItem>().ToArray();
      var expectedItemHeight = density switch
      {
        FsusDensity.Compact => 40d,
        FsusDensity.Spacious => 48d,
        _ => 44d,
      };
      Assert.True(fixture.Menu.Bounds.Width > 0);
      Assert.True(fixture.Menu.Bounds.Height > 0);
      Assert.All(items, item =>
      {
        Assert.True(item.Bounds.Width > 0);
        Assert.InRange(
          item.Bounds.Height,
          expectedItemHeight,
          expectedItemHeight + 1.1d);
      });
      Assert.InRange(
        items.Min(item => item.Bounds.Height),
        expectedItemHeight,
        expectedItemHeight + 0.1d);
      Assert.True(fixture.Menu.Bounds.Right <= width);
      Assert.True(fixture.Menu.Bounds.Bottom <= height);
      Assert.Equal(
        TimeSpan.FromMilliseconds(1),
        Assert.IsType<TimeSpan>(
          Application.Current!.Resources[FsusThemeResourceKeys.MotionDurationEffective]));
      var menuBounds = fixture.Menu.Bounds;
      var menuPlacement = fixture.Menu.EffectivePlacement.ToString();
      var contextAnchorBounds = fixture.Menu.OverlayEntry.Options.AnchorBounds;
      var treeRows = fixture.Tree.GetLogicalDescendants()
        .OfType<Border>()
        .Where(row => (AutomationProperties.GetAutomationId(row) ?? string.Empty)
          .StartsWith("fsus-tree-node-", StringComparison.Ordinal))
        .Select(row => new TreeRowCapture(
          AutomationProperties.GetAutomationId(row) ?? string.Empty,
          AutomationProperties.GetName(row) ?? string.Empty,
          AutomationProperties.GetItemStatus(row) ?? string.Empty,
          new Rect(
            row.TranslatePoint(default, fixture.Root) ?? default,
            row.Bounds.Size)))
        .ToArray();
      fixture.Window.KeyPress(
        Key.Escape,
        RawInputModifiers.None,
        PhysicalKey.Escape,
        null);
      Arrange(fixture.Root, width, height);
      Assert.False(fixture.Menu.IsOpen);
      Assert.Same(fixture.Tree, fixture.Host.LastRestoredFocus);
      captures.Add(new RenderCapture(
        path,
        theme.ToString().ToLowerInvariant(),
        density.ToString().ToLowerInvariant(),
        zoom,
        Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(path))),
        menuPlacement,
        menuBounds,
        expectedItemHeight,
        items.Select(item => item.Bounds).ToArray(),
        contextAnchorBounds,
        fixture.Menu.TargetKey,
        fixture.Tree.FocusedKey,
        fixture.Tree.SelectedKeys.ToArray(),
        treeRows,
        "Escape",
        ReferenceEquals(fixture.Tree, fixture.Host.LastRestoredFocus)));
      fixture.Window.Close();
    }

    var collision = CreateFixture(FsusThemeVariant.Light, 450);
    collision.Menu.ViewportBounds = new Rect(0, 0, 450, 520);
    collision.Menu.OverlaySize = new Size(250, 240);
    var collisionTarget = new Button
    {
      Content = "Bottom-edge target",
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Bottom,
      Margin = new Thickness(180, 0, 0, 8),
    };
    collision.Root.Children.Insert(
      collision.Root.Children.Count - 1,
      collisionTarget);
    FsusContextMenuService.Attach(collisionTarget, collision.Menu, collision.Host);
    collision.Window.Show();
    Arrange(collision.Root, 450, 520);
    Click(
      collision.Window,
      Center(collisionTarget, collision.Window),
      MouseButton.Right);
    Arrange(collision.Root, 450, 520);
    Assert.Equal(FsusOverlayPlacement.TopStart, collision.Menu.EffectivePlacement);
    Assert.Equal(collision.Menu.OverlayEntry!.Bounds, collision.Menu.Bounds);
    var collisionPath =
      Path.Combine(
        outputRoot,
        "tree-context-menu-light-collision-top-start-zoom-100.png");
    using (var collisionBitmap = new RenderTargetBitmap(
      new PixelSize(450, 520),
      new Vector(96, 96)))
    {
      collisionBitmap.Render(collision.Root);
      using var stream = File.Create(collisionPath);
      collisionBitmap.Save(stream);
    }
    var collisionDigest = Convert.ToHexStringLower(
      SHA256.HashData(File.ReadAllBytes(collisionPath)));
    var collisionAnchorBounds =
      collision.Menu.OverlayEntry.Options.AnchorBounds;
    var collisionBounds = collision.Menu.Bounds;
    collision.Window.Close();

    var screenReaderReportPath =
      Path.Combine(outputRoot, "screen-reader-local-simulation.json");
    var screenReaderFixture = CreateFixture(FsusThemeVariant.Dark, 900);
    screenReaderFixture.Window.Show();
    Arrange(screenReaderFixture.Root, 900, 520);
    screenReaderFixture.Tree.RequestNodeContext(
      "service",
      FsusTreeInteractionSource.Keyboard);
    Arrange(screenReaderFixture.Root, 900, 520);
    var screenReaderReport = new
    {
      evidenceClass = "local-screen-reader-automation-simulation",
      limitation =
        "AutomationPeer and AutomationProperties inspection; not a claim of a real OS screen reader or hardware run.",
      tree = new
      {
        name = AutomationProperties.GetName(screenReaderFixture.Tree),
        controlType = AutomationProperties.GetControlTypeOverride(screenReaderFixture.Tree).ToString(),
        status = AutomationProperties.GetItemStatus(screenReaderFixture.Tree),
      },
      rows = screenReaderFixture.Tree.GetLogicalDescendants()
        .OfType<Border>()
        .Where(row => (AutomationProperties.GetAutomationId(row) ?? string.Empty)
          .StartsWith("fsus-tree-node-", StringComparison.Ordinal))
        .Select(row => new
        {
          id = AutomationProperties.GetAutomationId(row),
          name = AutomationProperties.GetName(row),
          controlType = AutomationProperties.GetControlTypeOverride(row).ToString(),
          status = AutomationProperties.GetItemStatus(row),
          live = AutomationProperties.GetLiveSetting(row).ToString(),
        })
        .ToArray(),
      menu = new
      {
        name = AutomationProperties.GetName(screenReaderFixture.Menu),
        controlType =
          AutomationProperties.GetControlTypeOverride(screenReaderFixture.Menu).ToString(),
        status = AutomationProperties.GetItemStatus(screenReaderFixture.Menu),
      },
      items = screenReaderFixture.Menu.Items.OfType<FsusContextMenuItem>()
        .Select(item => new
        {
          name = AutomationProperties.GetName(item),
          help = AutomationProperties.GetHelpText(item),
          status = AutomationProperties.GetItemStatus(item),
          controlType = AutomationProperties.GetControlTypeOverride(item).ToString(),
          peer = ControlAutomationPeer.CreatePeerForElement(item)?.GetType().Name,
        })
        .ToArray(),
    };
    File.WriteAllText(
      screenReaderReportPath,
      JsonSerializer.Serialize(
        screenReaderReport,
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    screenReaderFixture.Window.Close();

    var defaultDensityCapture = captures.Single(capture =>
      capture.Theme == "light" &&
      capture.Density == "default" &&
      capture.ZoomPercent == 100);
    var touchReportPath =
      Path.Combine(outputRoot, "touch-target-local-simulation.json");
    var touchReport = new
    {
      evidenceClass = "local-touch-target-geometry-and-context-request-simulation",
      limitation =
        "Default-density target geometry plus the shared pointer ContextRequested contract; not a claim of a physical touch device or OS long-press stack.",
      minimumTargetHeight =
        defaultDensityCapture.ItemBounds.Min(bounds => bounds.Height),
      allDefaultDensityTargetsAtLeast44 =
        defaultDensityCapture.ItemBounds.All(bounds => bounds.Height >= 44),
      contextRequestSource = FsusTreeInteractionSource.Pointer.ToString(),
    };
    Assert.True(touchReport.allDefaultDensityTargetsAtLeast44);
    File.WriteAllText(
      touchReportPath,
      JsonSerializer.Serialize(
        touchReport,
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    var manifest = new
    {
      schemaVersion = 1,
      candidateSha =
        Environment.GetEnvironmentVariable(CandidateEnvironmentVariable) ??
        "working-tree-candidate",
      evidenceClass = "local-headless-skia-and-input-simulation",
      productionFixture = true,
      simulatedExternalCoverage = new[]
      {
        "mouse pointer activation through Avalonia headless input",
        "touch target geometry and shared ContextRequested semantics through a labeled local simulation",
        "screen-reader semantics through AutomationPeer and AutomationProperties",
        "high-DPI behavior through 100% and 200% Skia render targets",
      },
      limitations = new[]
      {
        "No claim of a physical touch device.",
        "No claim of a real Windows, macOS, or Linux screen-reader session.",
      },
      motionMode = "reduced",
      captures,
      screenReaderReport = new
      {
        path = screenReaderReportPath,
        sha256 = Convert.ToHexStringLower(
          SHA256.HashData(File.ReadAllBytes(screenReaderReportPath))),
      },
      touchReport = new
      {
        path = touchReportPath,
        sha256 = Convert.ToHexStringLower(
          SHA256.HashData(File.ReadAllBytes(touchReportPath))),
      },
      collision = new
      {
        placement = FsusOverlayPlacement.TopStart.ToString(),
        bounds = collisionBounds,
        anchorBounds = collisionAnchorBounds,
        artifact = new
        {
          path = collisionPath,
          sha256 = collisionDigest,
        },
      },
    };
    File.WriteAllText(
      Path.Combine(outputRoot, "manifest.json"),
      JsonSerializer.Serialize(
        manifest,
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.Equal(4, captures.Count);
  }

  private static Fixture CreateFixture(
    FsusThemeVariant theme,
    int width,
    FsusDensity density = FsusDensity.Default)
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    new FsusThemeManager().Apply(
      application,
      new FsusThemeOptions
      {
        Variant = theme,
        Density = density,
        MotionMode = FsusMotionMode.Reduced,
      });
    var tree = new FsusTree
    {
      AccessibleName = "Workspace files",
      SelectionMode = FsusTreeSelectionMode.Single,
    };
    var source = new FsusTreeNode("src", "src");
    source.Children.Add(new FsusTreeNode("editor", "EditorView.axaml"));
    source.Children.Add(new FsusTreeNode("service", "WorkspaceService.cs"));
    tree.Nodes.Add(source);
    tree.Nodes.Add(new FsusTreeNode("readme", "README.md"));
    tree.RefreshView();
    tree.Expand("src");

    var tabs = new FsusTabs
    {
      AccessibleName = "Open documents",
      Margin = new Thickness(20, 0, 0, 0),
    };
    tabs.Panes.Add(new FsusTabPane
    {
      Key = "editor-tab",
      Header = "EditorView.axaml",
      Content = "Document editor",
    });
    tabs.Panes.Add(new FsusTabPane
    {
      Key = "service-tab",
      Header = "WorkspaceService.cs",
      Content = "Document editor",
    });

    var content = new Grid
    {
      Margin = new Thickness(20),
      Background = Assert.IsAssignableFrom<IBrush>(
        application.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      ColumnDefinitions = new ColumnDefinitions("320,*"),
      RowDefinitions = new RowDefinitions("Auto,*"),
    };
    var heading = new TextBlock
    {
      Text = "Workspace actions",
      FontSize = 18,
      FontWeight = FontWeight.Bold,
      Margin = new Thickness(0, 0, 0, 16),
    };
    Grid.SetColumnSpan(heading, 2);
    content.Children.Add(heading);
    var generalContextTarget = new Button
    {
      Content = "Workspace menu",
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Right,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
    };
    Grid.SetColumn(generalContextTarget, 1);
    content.Children.Add(generalContextTarget);
    Grid.SetRow(tree, 1);
    content.Children.Add(tree);
    Grid.SetRow(tabs, 1);
    Grid.SetColumn(tabs, 1);
    content.Children.Add(tabs);

    var host = new FsusOverlayHost
    {
      Width = width,
      Height = 520,
      Background = Brushes.Transparent,
      IsHitTestVisible = false,
    };
    var root = new Grid
    {
      Width = width,
      Height = 520,
      Background = Assert.IsAssignableFrom<IBrush>(
        application.Resources[FsusThemeResourceKeys.BackgroundBrush]),
    };
    root.Children.Add(content);
    root.Children.Add(host);
    var menu = new FsusContextMenu
    {
      AccessibleName = "File actions",
      OverlaySize = new Size(250, 240),
      ViewportBounds = new Rect(0, 0, width, 520),
    };
    menu.Items.Add(new FsusContextMenuItem
    {
      Key = "new-file",
      Header = "New file",
      IconContent = new TextBlock { Text = "+" },
      Accelerator = "Ctrl+N",
    });
    menu.Items.Add(new FsusContextMenuItem
    {
      Key = "rename",
      Header = "Rename",
      Accelerator = "F2",
    });
    menu.Items.Add(new FsusContextMenuSeparator());
    menu.Items.Add(new FsusContextMenuItem
    {
      Key = "paste",
      Header = "Paste",
      Accelerator = "Ctrl+V",
      IsEnabled = false,
    });
    menu.Items.Add(new FsusContextMenuItem
    {
      Key = "delete",
      Header = "Move to Trash",
      Accelerator = "Del",
      IsDangerous = true,
    });
    tree.NodeAnchorBoundsResolver = key =>
    {
      var row = FindByAutomationId(tree, $"fsus-tree-node-{key}");
      return new Rect(
        row.TranslatePoint(default, host) ?? default,
        row.Bounds.Size);
    };
    tree.NodeContextRequested += (_, args) =>
    {
      host.IsHitTestVisible = true;
      menu.Open(
        host,
        new FsusContextMenuRequest(
          args.Key,
          args.InteractionSource,
          args.AnchorBounds,
          tree));
    };
    tabs.PaneContextRequested += (_, args) =>
    {
      host.IsHitTestVisible = true;
      var origin = args.Pane.TranslatePoint(default, host) ?? default;
      menu.Open(
        host,
        new FsusContextMenuRequest(
          args.PaneKey,
          args.InteractionSource,
          new Rect(origin, args.Pane.Bounds.Size),
          tabs));
    };
    generalContextTarget.ContextRequested += (_, _) =>
      host.IsHitTestVisible = true;
    FsusContextMenuService.Attach(generalContextTarget, menu, host);
    var window = new Window
    {
      Width = width,
      Height = 520,
      Content = root,
      ShowInTaskbar = false,
    };
    return new Fixture(
      window,
      root,
      host,
      tree,
      tabs,
      menu,
      generalContextTarget);
  }

  private static void EnsureFullTheme()
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    application.Styles.Add(new StyleInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri(
        "avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
  }

  private static void Arrange(Control control, double width, double height)
  {
    control.InvalidateMeasure();
    control.InvalidateArrange();
    control.Measure(new Size(width, height));
    control.Arrange(new Rect(0, 0, width, height));
    AvaloniaHeadlessPlatform.ForceRenderTimerTick();
  }

  private static Control FindByAutomationId(Control root, string automationId) =>
    root.GetLogicalDescendants()
      .OfType<Control>()
      .Single(control =>
        AutomationProperties.GetAutomationId(control) == automationId);

  private static Point Center(Control control, Visual relativeTo)
  {
    var origin = control.TranslatePoint(default, relativeTo) ?? default;
    return new Point(
      origin.X + Math.Max(1, control.Bounds.Width / 2),
      origin.Y + Math.Max(1, control.Bounds.Height / 2));
  }

  private static void Click(
    TopLevel window,
    Point point,
    MouseButton button)
  {
    window.MouseMove(point);
    window.MouseDown(point, button, RawInputModifiers.None);
    window.MouseUp(point, button, RawInputModifiers.None);
  }

  private sealed record Fixture(
    Window Window,
    Grid Root,
    FsusOverlayHost Host,
    FsusTree Tree,
    FsusTabs Tabs,
    FsusContextMenu Menu,
    Button GeneralContextTarget);

  private sealed record RenderCapture(
    string Path,
    string Theme,
    string Density,
    int ZoomPercent,
    string Sha256,
    string Placement,
    Rect MenuBounds,
    double ExpectedItemHeight,
    IReadOnlyList<Rect> ItemBounds,
    Rect ContextAnchorBounds,
    string TargetKey,
    string FocusedTreeKey,
    IReadOnlyList<string> SelectedTreeKeys,
    IReadOnlyList<TreeRowCapture> TreeRows,
    string ClosedBy,
    bool FocusRestored);

  private sealed record TreeRowCapture(
    string AutomationId,
    string Name,
    string Status,
    Rect Bounds);
}
