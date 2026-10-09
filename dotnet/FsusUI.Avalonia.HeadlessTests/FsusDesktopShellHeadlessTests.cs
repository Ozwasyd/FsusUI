using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusDesktopShellHeadlessTests
{
  [AvaloniaFact]
  public void DocumentTabsCancelClosePreserveDirtyStateReorderAndSelectAdjacentFallback()
  {
    var tabs = CreatePrimitiveDocumentTabs();
    var closeReasons = new List<FsusDocumentTabCloseReason>();
    var reorderEvents = new List<FsusDocumentTabReorderedEventArgs>();
    tabs.CloseRequested += (_, e) =>
    {
      closeReasons.Add(e.Reason);
      e.Cancel = e.Key == "draft";
    };
    tabs.Reordered += (_, e) => reorderEvents.Add(e);

    tabs.SelectKey("draft");
    Assert.Contains("unsaved changes", AutomationProperties.GetItemStatus(tabs.Documents[1]));
    Assert.False(tabs.RequestClose("draft", FsusDocumentTabCloseReason.CloseButton));
    Assert.Contains(tabs.Documents, (document) => document.Key == "draft");

    Assert.True(tabs.ReorderDocument("notes", 0, FsusDocumentTabReorderSource.Pointer));
    Assert.Equal("notes", tabs.Documents[0].Key);
    Assert.Equal(2, reorderEvents[0].OldIndex);
    Assert.Equal(0, reorderEvents[0].NewIndex);
    Assert.Equal(FsusDocumentTabReorderSource.Pointer, reorderEvents[0].Source);

    tabs.SelectKey("readme");
    Assert.True(tabs.RequestClose("readme", FsusDocumentTabCloseReason.MiddleClick));
    Assert.Equal("draft", tabs.SelectedKey);
    Assert.Equal(FsusDocumentTabCloseReason.MiddleClick, closeReasons[^1]);

    Assert.True(tabs.CycleDocuments());
    Assert.Equal("notes", tabs.SelectedKey);
    Assert.True(tabs.CycleDocuments(reverse: true));
    Assert.Equal("draft", tabs.SelectedKey);

    tabs.AddDocument(new FsusDocumentTab { Key = "disabled", IsEnabled = false });
    Assert.True(tabs.CycleDocuments());
    Assert.Equal("notes", tabs.SelectedKey);
    Assert.True(tabs.CycleDocuments(reverse: true));
    Assert.Equal("draft", tabs.SelectedKey);
    var notes = tabs.Documents.Single((document) => document.Key == "notes");
    notes.IsEnabled = false;
    var draft = tabs.Documents.Single((document) => document.Key == "draft");
    draft.IsClosable = false;
    var closeCount = closeReasons.Count;
    Assert.False(tabs.RequestClose("missing"));
    Assert.False(tabs.RequestClose("notes"));
    Assert.False(tabs.RequestClose("draft"));
    Assert.Equal(closeCount, closeReasons.Count);
    Assert.False(tabs.ReorderDocument("missing", 0));
    Assert.False(tabs.ReorderDocument("draft", 1));
    Assert.Single(reorderEvents);
    Assert.False(tabs.RequestDocumentContext("missing", FsusTreeInteractionSource.Keyboard));
    Assert.False(tabs.RequestDocumentContext("notes", FsusTreeInteractionSource.Keyboard));
    Assert.False(tabs.CycleDocuments());
    Assert.False(tabs.CycleDocuments(reverse: true));
    tabs.SelectKey("notes");
    Assert.Equal("draft", tabs.SelectedKey);
    Assert.Equal("draft", tabs.FocusedKey);
  }

  [AvaloniaFact]
  public void DocumentContextRequestReturnsTypedStableAnchorWithoutSelectingTarget()
  {
    var tabs = CreatePrimitiveDocumentTabs();
    FsusDocumentTabContextRequestedEventArgs? request = null;
    tabs.DocumentContextRequested += (_, e) => request = e;
    tabs.SelectKey("readme");
    tabs.Measure(new Size(640, 300));
    tabs.Arrange(new Rect(0, 0, 640, 300));

    Assert.True(tabs.RequestDocumentContext("notes", FsusTreeInteractionSource.Keyboard));
    Assert.NotNull(request);
    Assert.Equal("notes", request!.Key);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, request.InteractionSource);
    Assert.Same(tabs.Documents.Single((document) => document.Key == "notes"), request.Anchor);
    Assert.Equal("readme", tabs.SelectedKey);
  }

  [AvaloniaFact]
  public void ActivityRailPointerKeyboardResizeBoundsAndDoubleClickResetWorkInWindow()
  {
    var shell = BuildActivityShell();
    var window = MountWindow(shell, 960, 620);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var search = shell.Sections.Single((section) => section.Key == "search");
    Click(window, search, MouseButton.Left);
    Assert.Equal("search", shell.SelectedKey);
    Assert.True(shell.IsPaneOpen);

    Click(window, search, MouseButton.Left);
    Assert.False(shell.IsPaneOpen);
    shell.ShowPane();

    var thumb = shell.GetVisualDescendants()
      .OfType<Thumb>()
      .Single((candidate) => candidate.Classes.Contains("fsus-contextual-pane-resizer"));
    Assert.True(thumb.Focus(NavigationMethod.Tab));
    var originalWidth = shell.PaneWidth;
    window.KeyPress(Key.Right, RawInputModifiers.None, PhysicalKey.ArrowRight, string.Empty);
    Assert.Equal(originalWidth + shell.KeyboardResizeStep, shell.PaneWidth);
    window.KeyPress(Key.Left, RawInputModifiers.Shift, PhysicalKey.ArrowLeft, string.Empty);
    Assert.Equal(originalWidth - (shell.KeyboardResizeStep * 3), shell.PaneWidth);

    var start = CenterIn(window, thumb);
    window.MouseMove(start);
    window.MouseDown(start, MouseButton.Left);
    window.MouseMove(new Point(start.X + 12, start.Y));
    window.MouseMove(new Point(start.X + 90, start.Y));
    window.MouseUp(new Point(start.X + 90, start.Y), MouseButton.Left);
    Assert.True(
      shell.PaneWidth > originalWidth,
      $"Pointer resize width {shell.PaneWidth} should exceed starting width {originalWidth}; thumb bounds are {thumb.Bounds}.");
    Assert.InRange(shell.PaneWidth, shell.MinPaneWidth, shell.MaxPaneWidth);

    shell.ResizePane(360);
    thumb.RaiseEvent(new TappedEventArgs(InputElement.DoubleTappedEvent, null!)
    {
      Source = thumb,
    });
    Assert.Equal(shell.DefaultPaneWidth, shell.PaneWidth);

    window.Close();
  }

  [AvaloniaTheory]
  [InlineData(120d)]
  [InlineData(220d)]
  public void DocumentTabsSupportCloseDragReorderOverflowContextAndPlatformCycling(double headerWidth)
  {
    var tabs = BuildDocumentTabs(9);
    foreach (var document in tabs.Documents)
    {
      document.Width = headerWidth;
    }
    var closeRequests = new List<FsusDocumentTabCloseRequestedEventArgs>();
    var reorderRequests = new List<FsusDocumentTabReorderedEventArgs>();
    var contextRequests = new List<FsusDocumentTabContextRequestedEventArgs>();
    tabs.CloseRequested += (_, e) =>
    {
      closeRequests.Add(e);
      e.Cancel = e.Key == "draft";
    };
    tabs.Reordered += (_, e) => reorderRequests.Add(e);
    tabs.DocumentContextRequested += (_, e) => contextRequests.Add(e);

    var window = MountWindow(tabs, 520, 360);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(
      tabs.CanScrollForward,
      $"Header extent {tabs.HeaderExtentWidth} must exceed viewport {tabs.HeaderViewportWidth}.");
    tabs.SelectKey("document-8");
    Dispatcher.UIThread.RunJobs();
    Assert.True(tabs.CanScrollBackward);

    var firstKey = tabs.Documents[0].Key;
    tabs.SelectKey(firstKey);
    Assert.True(tabs.Focus(NavigationMethod.Tab));
    window.KeyPress(Key.Tab, RawInputModifiers.Control, PhysicalKey.Tab, "\t");
    Assert.Equal(tabs.Documents[1].Key, tabs.SelectedKey);
    window.KeyPress(
      Key.Tab,
      RawInputModifiers.Control | RawInputModifiers.Shift,
      PhysicalKey.Tab,
      "\t");
    Assert.Equal(firstKey, tabs.SelectedKey);
    Assert.Equal(firstKey, tabs.FocusedKey);
    Assert.Same(tabs.Documents[0], window.FocusManager!.GetFocusedElement());
    window.KeyPress(Key.Tab, RawInputModifiers.Meta, PhysicalKey.Tab, "\t");
    Assert.Equal(tabs.Documents[1].Key, tabs.SelectedKey);
    Assert.Equal(tabs.SelectedKey, tabs.FocusedKey);
    Assert.Same(tabs.Documents[1], window.FocusManager.GetFocusedElement());
    window.KeyPress(
      Key.Tab,
      RawInputModifiers.Meta | RawInputModifiers.Shift,
      PhysicalKey.Tab,
      "\t");
    Assert.Equal(firstKey, tabs.SelectedKey);
    Assert.Equal(firstKey, tabs.FocusedKey);

    var contextTarget = tabs.Documents[2];
    ScrollHeaderIntoView(window, tabs, contextTarget);
    Click(window, contextTarget, MouseButton.Right);
    Assert.Single(contextRequests);
    Assert.Equal(contextTarget.Key, contextRequests[^1].Key);
    Assert.True(contextRequests[^1].AnchorBounds.Width > 0);
    Assert.Equal(firstKey, tabs.SelectedKey);
    Assert.Equal(firstKey, tabs.FocusedKey);
    Assert.Same(contextTarget, contextRequests[^1].Anchor);
    Assert.Equal(FsusTreeInteractionSource.Pointer, contextRequests[^1].InteractionSource);
    Assert.True(contextTarget.Focus(NavigationMethod.Tab));
    var contextRequestCount = contextRequests.Count;
    window.KeyPress(Key.F10, RawInputModifiers.Shift, PhysicalKey.F10, string.Empty);
    Assert.Equal(contextRequestCount + 1, contextRequests.Count);
    Assert.Equal(contextTarget.Key, contextRequests[^1].Key);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, contextRequests[^1].InteractionSource);
    Assert.Equal(firstKey, tabs.SelectedKey);
    contextRequestCount = contextRequests.Count;
    window.KeyPress(Key.Apps, RawInputModifiers.None, PhysicalKey.ContextMenu, string.Empty);
    Assert.Equal(contextRequestCount + 1, contextRequests.Count);
    Assert.Equal(contextTarget.Key, contextRequests[^1].Key);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, contextRequests[^1].InteractionSource);
    Assert.Equal(firstKey, tabs.SelectedKey);

    var cleanTarget = tabs.Documents[3];
    var cleanKey = cleanTarget.Key;
    tabs.SelectKey(cleanKey);
    Dispatcher.UIThread.RunJobs();
    ScrollHeaderIntoView(window, tabs, cleanTarget);
    Click(window, cleanTarget, MouseButton.Middle);
    Assert.DoesNotContain(tabs.Documents, (document) => document.Key == cleanKey);
    Assert.Equal(FsusDocumentTabCloseReason.MiddleClick, closeRequests[^1].Reason);
    Assert.Equal("accessibility", tabs.SelectedKey);
    Assert.Equal(tabs.SelectedKey, tabs.FocusedKey);
    Assert.Same(tabs.Documents[3], window.FocusManager!.GetFocusedElement());

    var dirty = tabs.Documents.Single((document) => document.Key == "draft");
    var closeButton = dirty.GetVisualDescendants()
      .OfType<Button>()
      .Single((button) => button.Name == "PART_CloseButton");
    ScrollHeaderIntoView(window, tabs, closeButton);
    Click(window, closeButton, MouseButton.Left);
    Assert.Contains(tabs.Documents, (document) => document.Key == "draft");
    Assert.True(closeRequests[^1].Cancel);

    var dragTarget = tabs.Documents[0];
    var oldIndex = tabs.Documents.ToList().IndexOf(dragTarget);
    tabs.SelectKey(dragTarget.Key);
    Dispatcher.UIThread.RunJobs();
    var start = CenterIn(window, dragTarget);
    var next = tabs.Documents[1];
    var end = CenterIn(window, next);
    window.MouseMove(start);
    window.MouseDown(start, MouseButton.Left);
    window.MouseMove(end);
    window.MouseUp(end, MouseButton.Left);
    Assert.NotEmpty(reorderRequests);
    Assert.Equal(FsusDocumentTabReorderSource.Pointer, reorderRequests[^1].Source);
    Assert.NotEqual(oldIndex, tabs.Documents.ToList().IndexOf(dragTarget));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(dragTarget.Key, tabs.SelectedKey);
    Assert.Equal(dragTarget.Key, tabs.FocusedKey);
    Assert.Same(dragTarget, tabs.SelectedItem);
    Assert.Same(dragTarget, window.FocusManager!.GetFocusedElement());
    Assert.Single(tabs.Documents, (document) => document.IsSelected);

    var other = tabs.Documents.First((document) => document != dragTarget);
    var otherIndex = tabs.Documents.ToList().IndexOf(other);
    Assert.True(tabs.ReorderDocument(other.Key, otherIndex == 0 ? 1 : 0));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(dragTarget.Key, tabs.SelectedKey);
    Assert.Equal(dragTarget.Key, tabs.FocusedKey);
    Assert.Same(dragTarget, tabs.SelectedItem);
    Assert.Same(dragTarget, window.FocusManager.GetFocusedElement());

    NavigationMethod? lastFocusOrigin = null;
    dragTarget.AddHandler(InputElement.GotFocusEvent, (_, e) =>
    {
      if (ReferenceEquals(e.NewFocusedElement, dragTarget))
      {
        lastFocusOrigin = e.NavigationMethod;
      }
    }, handledEventsToo: true);
    foreach (var focusOrigin in new[]
    {
      NavigationMethod.Tab,
      NavigationMethod.Directional,
      NavigationMethod.Pointer,
      NavigationMethod.Unspecified,
    })
    {
      Assert.True(other.Focus(NavigationMethod.Pointer));
      Assert.Same(other, window.FocusManager.GetFocusedElement());
      Assert.True(dragTarget.Focus(focusOrigin));
      Assert.Equal(focusOrigin, lastFocusOrigin);
      Dispatcher.UIThread.RunJobs();
      var focusVisible = focusOrigin is NavigationMethod.Tab or NavigationMethod.Directional;
      Assert.Equal(focusVisible, dragTarget.Classes.Contains(":focus-visible"));

      var index = tabs.Documents.ToList().IndexOf(dragTarget);
      Assert.True(tabs.ReorderDocument(dragTarget.Key, index == 0 ? 1 : 0));
      Dispatcher.UIThread.RunJobs();
      Assert.Same(dragTarget, window.FocusManager.GetFocusedElement());
      Assert.Equal(focusVisible, dragTarget.Classes.Contains(":focus-visible"));
      Assert.Equal(focusOrigin, lastFocusOrigin);
      if (focusVisible)
      {
        Assert.Same(window.Resources[FsusThemeResourceKeys.FocusBrush], dragTarget.BorderBrush);
        Assert.Equal(
          Assert.IsType<Thickness>(window.Resources["FsusThemeFocusBorderThickness"]),
          dragTarget.BorderThickness);
      }

      otherIndex = tabs.Documents.ToList().IndexOf(other);
      lastFocusOrigin = null;
      Assert.True(tabs.ReorderDocument(other.Key, otherIndex == 0 ? 1 : 0));
      Dispatcher.UIThread.RunJobs();
      Assert.Same(dragTarget, window.FocusManager.GetFocusedElement());
      Assert.Equal(focusVisible, dragTarget.Classes.Contains(":focus-visible"));
      Assert.Null(lastFocusOrigin);
      if (focusVisible)
      {
        Assert.Same(window.Resources[FsusThemeResourceKeys.FocusBrush], dragTarget.BorderBrush);
        Assert.Equal(
          Assert.IsType<Thickness>(window.Resources["FsusThemeFocusBorderThickness"]),
          dragTarget.BorderThickness);
      }
      Assert.Equal(dragTarget.Key, tabs.SelectedKey);
      Assert.Equal(dragTarget.Key, tabs.FocusedKey);
      Assert.Same(dragTarget, tabs.SelectedItem);
    }

    window.Close();
  }

  [AvaloniaFact]
  public void NativeTitleBarTracksWindowActionsFullscreenThemeAndNoDragSlots()
  {
    var saveButton = new Button { Content = "Save" };
    var titleBar = new FsusNativeTitleBar
    {
      DocumentTitle = "Release plan.md",
      DocumentPath = "/workspace/docs/release-plan.md",
      Status = "Unsaved changes",
      TrailingActions = saveButton,
      Platform = FsusDesktopPlatform.Linux,
    };
    var content = new Grid();
    content.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    content.RowDefinitions.Add(new RowDefinition(GridLength.Star));
    Grid.SetRow(titleBar, 0);
    content.Children.Add(titleBar);
    content.Children.Add(new TextBlock { Text = "Document surface", Margin = new Thickness(24) });
    Grid.SetRow(content.Children[^1], 1);

    var actions = new List<FsusNativeWindowActionEventArgs>();
    titleBar.WindowActionInvoked += (_, e) => actions.Add(e);
    var window = MountWindow(content, 900, 600);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    titleBar.AttachTo(window);

    Assert.Same(window, titleBar.AttachedWindow);
    Assert.True(window.ExtendClientAreaToDecorationsHint);
    Assert.True(FsusNativeTitleBar.GetIsNoDrag(saveButton));

    Assert.True(titleBar.InvokeWindowAction(FsusNativeWindowAction.Maximize));
    Assert.True(titleBar.IsMaximized);
    Assert.Contains("fsus-maximized", titleBar.Classes);
    Assert.Equal(FsusNativeWindowAction.Maximize, actions[^1].Action);
    Assert.True(titleBar.InvokeWindowAction(FsusNativeWindowAction.Restore));
    Assert.False(titleBar.IsMaximized);

    window.WindowState = WindowState.FullScreen;
    Dispatcher.UIThread.RunJobs();
    Assert.True(titleBar.IsFullScreen);
    Assert.Contains("fsus-fullscreen", titleBar.Classes);

    window.WindowState = WindowState.Normal;
    window.RequestedThemeVariant = ThemeVariant.Dark;
    Dispatcher.UIThread.RunJobs();
    Assert.Contains("fsus-theme-dark", titleBar.Classes);
    Assert.Contains("linux", AutomationProperties.GetItemStatus(titleBar));

    titleBar.Detach();
    Assert.Null(titleBar.AttachedWindow);
    window.Close();
  }

  [AvaloniaFact]
  public void AutomationPeersExposeSelectionDirtyExpandedAndCloseSemantics()
  {
    var tabs = BuildDocumentTabs(4);
    tabs.SelectKey("draft");
    var shell = BuildActivityShell();
    shell.MainContent = tabs;
    var window = MountWindow(shell, 960, 620);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var shellProvider = Assert.IsAssignableFrom<ISelectionProvider>(
      ControlAutomationPeer.CreatePeerForElement(shell));
    var tabsProvider = Assert.IsAssignableFrom<ISelectionProvider>(
      ControlAutomationPeer.CreatePeerForElement(tabs));
    Assert.Single(shellProvider.GetSelection());
    Assert.Single(tabsProvider.GetSelection());
    Assert.Contains("pane expanded", AutomationProperties.GetItemStatus(shell.Sections[0]));

    var dirty = tabs.Documents.Single((document) => document.Key == "draft");
    Assert.Contains("selected", AutomationProperties.GetItemStatus(dirty));
    Assert.Contains("unsaved changes", AutomationProperties.GetItemStatus(dirty));
    var close = dirty.GetVisualDescendants()
      .OfType<Button>()
      .Single((button) => button.Name == "PART_CloseButton");
    Assert.Equal("Close Release draft.md", AutomationProperties.GetName(close));
    Assert.Equal(AutomationControlType.Button, AutomationProperties.GetControlTypeOverride(close));

    window.Close();
  }

  [AvaloniaFact]
  public void ProductionFixtureRendersDesktopLightDarkAndNarrowEvidence()
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "issue-642-desktop-shell");
    Directory.CreateDirectory(outputRoot);

    var scenarios = new[]
    {
      new RenderScenario("desktop-light", FsusThemeVariant.Light, FsusDensity.Default, 1280, 720, "explorer", false),
      new RenderScenario("desktop-dark", FsusThemeVariant.Dark, FsusDensity.Default, 1280, 720, "search", false),
      new RenderScenario("narrow-dark-compact", FsusThemeVariant.Dark, FsusDensity.Compact, 760, 640, "outline", true),
    };
    var captures = scenarios.Select((scenario) => Render(outputRoot, scenario)).ToArray();

    Assert.Equal(3, captures.Length);
    Assert.All(captures, (capture) =>
    {
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.File)));
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.AutomationFile)));
      Assert.Equal(64, capture.Sha256.Length);
      Assert.Equal(64, capture.AutomationSha256.Length);
    });

    var manifestPath = Path.Combine(outputRoot, "desktop-shell-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 642,
          generatedBy =
            "FsusDesktopShellHeadlessTests.ProductionFixtureRendersDesktopLightDarkAndNarrowEvidence",
          fixtureClass = "production",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
          },
          simulation =
            "Local deterministic Headless Skia simulation on Linux; no physical Windows or macOS execution is represented.",
          motion = "reduced, terminal-state 1ms plans",
          captures,
        },
        new JsonSerializerOptions
        {
          WriteIndented = true,
          PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        }) + "\n");
    Assert.True(new FileInfo(manifestPath).Length > 1_000);
  }

  private static RenderCapture Render(string outputRoot, RenderScenario scenario)
  {
    var shell = BuildProductionFixture();
    if (shell.SelectedKey == scenario.ActivityKey)
    {
      shell.ShowPane();
    }
    else
    {
      shell.ActivateKey(scenario.ActivityKey);
    }
    if (scenario.Narrow)
    {
      shell.ResizePane(shell.MinPaneWidth);
    }
    var titleBar = new FsusNativeTitleBar
    {
      AccessibleName = "Markdown workspace title bar",
      DocumentTitle = "Architecture notes.md",
      DocumentPath = "/workspace/docs/architecture-notes.md",
      Status = scenario.Narrow ? "Unsaved" : "Saved locally",
      LeadingActions = new Button { Content = "Workspace", MinWidth = 92 },
      TrailingActions = new Button { Content = "Preview", MinWidth = 72 },
      Platform = FsusDesktopPlatform.Linux,
    };
    var root = new Grid();
    root.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    root.RowDefinitions.Add(new RowDefinition(GridLength.Star));
    Grid.SetRow(titleBar, 0);
    Grid.SetRow(shell, 1);
    root.Children.Add(titleBar);
    root.Children.Add(shell);

    var window = MountWindow(root, scenario.Width, scenario.Height, scenario.Variant, scenario.Density);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    shell.Measure(new Size(scenario.Width, scenario.Height - 40));
    shell.Arrange(new Rect(0, 40, scenario.Width, scenario.Height - 40));
    Dispatcher.UIThread.RunJobs();

    var tabs = Assert.IsType<FsusDocumentTabs>(shell.MainContent);
    tabs.SelectKey(scenario.Narrow ? "release" : "architecture");
    Dispatcher.UIThread.RunJobs();
    var dirty = tabs.Documents.Single((document) => document.Key == "release");
    Assert.True(dirty.IsDirty);
    Assert.Equal(scenario.ActivityKey, shell.SelectedKey);
    Assert.Equal(scenario.Narrow ? shell.MinPaneWidth : 280d, shell.PaneWidth);

    root.Background = Assert.IsAssignableFrom<IBrush>(
      window.Resources[FsusThemeResourceKeys.BackgroundBrush]);
    root.Measure(new Size(scenario.Width, scenario.Height));
    root.Arrange(new Rect(0, 0, scenario.Width, scenario.Height));
    Dispatcher.UIThread.RunJobs();

    var leadingAction = Assert.IsType<Button>(titleBar.LeadingActions);
    var expectedLeadingActionHeight = scenario.Density == FsusDensity.Compact
      ? 40d
      : 44d;
    Assert.InRange(
      leadingAction.Bounds.Height,
      expectedLeadingActionHeight,
      expectedLeadingActionHeight + 0.1d);
    Assert.True(titleBar.Bounds.Height >= leadingAction.Bounds.Height);

    using var bitmap = new RenderTargetBitmap(
      new PixelSize((int)scenario.Width, (int)scenario.Height),
      new Vector(96, 96));
    bitmap.Render(root);
    var imagePath = Path.Combine(outputRoot, $"desktop-shell-{scenario.Name}.png");
    using (var stream = File.Create(imagePath))
    {
      bitmap.Save(stream);
    }

    var automationPath = Path.Combine(
      outputRoot,
      $"desktop-shell-{scenario.Name}-automation.json");
    var shellProvider = Assert.IsAssignableFrom<ISelectionProvider>(
      ControlAutomationPeer.CreatePeerForElement(shell));
    var tabsProvider = Assert.IsAssignableFrom<ISelectionProvider>(
      ControlAutomationPeer.CreatePeerForElement(tabs));
    File.WriteAllText(
      automationPath,
      JsonSerializer.Serialize(
        new
        {
          titleBar = new
          {
            name = AutomationProperties.GetName(titleBar),
            status = AutomationProperties.GetItemStatus(titleBar),
          },
          activityRail = new
          {
            name = AutomationProperties.GetName(shell),
            status = AutomationProperties.GetItemStatus(shell),
            selectedCount = shellProvider.GetSelection().Count,
            sections = shell.Sections.Select((section) => new
            {
              section.Key,
              name = AutomationProperties.GetName(section),
              status = AutomationProperties.GetItemStatus(section),
            }),
          },
          documents = new
          {
            status = AutomationProperties.GetItemStatus(tabs),
            selectedCount = tabsProvider.GetSelection().Count,
            items = tabs.Documents.Select((document) => new
            {
              document.Key,
              name = AutomationProperties.GetName(document),
              status = AutomationProperties.GetItemStatus(document),
              closeName = document.GetVisualDescendants()
                .OfType<Button>()
                .Where((button) => button.Name == "PART_CloseButton")
                .Select(AutomationProperties.GetName)
                .SingleOrDefault(),
            }),
          },
        },
        new JsonSerializerOptions
        {
          WriteIndented = true,
          PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        }) + "\n");

    window.Close();
    return new RenderCapture(
      Path.GetRelativePath(FindRepositoryRoot(), imagePath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(imagePath))),
      Path.GetRelativePath(FindRepositoryRoot(), automationPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(automationPath))),
      scenario.Name,
      scenario.Variant.ToString(),
      scenario.Density.ToString(),
      scenario.Width,
      scenario.Height,
      scenario.ActivityKey,
      tabs.SelectedKey,
      shell.PaneWidth,
      shell.IsPaneOpen,
      titleBar.Bounds.Height,
      leadingAction.Bounds.Height);
  }

  private static FsusActivityRailShell BuildProductionFixture()
  {
    var shell = BuildActivityShell();
    shell.MainContent = BuildDocumentTabs(8);
    return shell;
  }

  private static FsusActivityRailShell BuildActivityShell()
  {
    var shell = new FsusActivityRailShell
    {
      AccessibleName = "Editor workspace navigation",
      PaneWidth = 280,
      DefaultPaneWidth = 280,
      MinPaneWidth = 220,
      MaxPaneWidth = 420,
    };
    shell.Sections.Add(new FsusActivityRailSection
    {
      Key = "explorer",
      Header = "Explorer",
      Icon = new TextBlock { Text = "EX", FontWeight = FontWeight.Bold },
      Content = BuildContextPane("Explorer", "docs", "spec", "dotnet", "vue"),
    });
    shell.Sections.Add(new FsusActivityRailSection
    {
      Key = "search",
      Header = "Search",
      Icon = new TextBlock { Text = "SE", FontWeight = FontWeight.Bold },
      Content = BuildContextPane("Search", "Find in workspace", "Replace", "Match case"),
    });
    shell.Sections.Add(new FsusActivityRailSection
    {
      Key = "outline",
      Header = "Document outline",
      Icon = new TextBlock { Text = "OU", FontWeight = FontWeight.Bold },
      Content = BuildContextPane("Outline", "Summary", "API boundary", "Verification"),
    });
    return shell;
  }

  private static Control BuildContextPane(string title, params string[] rows)
  {
    var panel = new StackPanel { Spacing = 12 };
    panel.Children.Add(new TextBlock
    {
      Text = title,
      FontSize = 16,
      FontWeight = FontWeight.Bold,
    });
    foreach (var row in rows)
    {
      panel.Children.Add(new TextBlock { Text = row, TextWrapping = TextWrapping.Wrap });
    }
    return panel;
  }

  private static FsusDocumentTabs BuildDocumentTabs(int count)
  {
    var tabs = new FsusDocumentTabs { AccessibleName = "Open documents" };
    var fixtures = new[]
    {
      ("architecture", "Architecture notes.md", false),
      ("draft", "Release draft.md", true),
      ("release", "Release checklist.md", true),
      ("tokens", "Theme token audit.md", false),
      ("accessibility", "Accessibility findings.md", false),
      ("platform", "Platform differences.md", false),
      ("runtime", "Runtime state boundaries.md", false),
      ("verification", "Verification record.md", false),
      ("document-8", "Long document title for overflow.md", false),
    };
    foreach (var (key, title, dirty) in fixtures.Take(count))
    {
      tabs.AddDocument(new FsusDocumentTab
      {
        Key = key,
        Header = title,
        IsDirty = dirty,
        Content = new ScrollViewer
        {
          Content = new TextBlock
          {
            Margin = new Thickness(24),
            Text =
              $"{title}\n\nReview the public API, interaction model, accessibility semantics, " +
              "theme behavior, and verification evidence before publishing.",
            TextWrapping = TextWrapping.Wrap,
          },
        },
      });
    }
    return tabs;
  }

  private static Window MountWindow(
    Control content,
    double width,
    double height,
    FsusThemeVariant variant = FsusThemeVariant.Light,
    FsusDensity density = FsusDensity.Default)
  {
    var window = new Window
    {
      Width = width,
      Height = height,
      ShowInTaskbar = false,
      Content = content,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = variant,
        Density = density,
        MotionMode = FsusMotionMode.Reduced,
      });
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
    return window;
  }

  private static FsusDocumentTabs CreatePrimitiveDocumentTabs()
  {
    var tabs = new FsusDocumentTabs { AccessibleName = "Open documents" };
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "readme",
      Header = "README.md",
      Content = "README",
    });
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "draft",
      Header = "Release draft.md",
      IsDirty = true,
      Content = "Draft",
    });
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "notes",
      Header = "Architecture notes.md",
      Content = "Notes",
    });
    return tabs;
  }

  private static void ScrollHeaderIntoView(
    Window window,
    FsusDocumentTabs tabs,
    Control target)
  {
    Dispatcher.UIThread.RunJobs();
    var scrollViewer = tabs.GetVisualDescendants()
      .OfType<ScrollViewer>()
      .Single((viewer) => viewer.Name == "PART_HeaderScrollViewer");
    var origin = Assert.NotNull(scrollViewer.TranslatePoint(default, window));
    var viewport = new Rect(origin, scrollViewer.Viewport);
    for (var attempt = 0; attempt < tabs.Documents.Count * 2; attempt++)
    {
      var point = CenterIn(window, target);
      if (viewport.Contains(point))
      {
        return;
      }
      Assert.True(tabs.ScrollHeaders(forward: point.X >= viewport.Right));
      Dispatcher.UIThread.RunJobs();
    }
    Assert.True(viewport.Contains(CenterIn(window, target)), "Pointer target must be visible in the header viewport.");
  }

  private static void Click(Window window, Control control, MouseButton button)
  {
    var point = CenterIn(window, control);
    window.MouseMove(point);
    window.MouseDown(point, button, RawInputModifiers.None);
    window.MouseUp(point, button, RawInputModifiers.None);
    Dispatcher.UIThread.RunJobs();
  }

  private static Point CenterIn(Window window, Control control)
  {
    var origin = Assert.NotNull(control.TranslatePoint(default, window));
    return new Point(
      origin.X + (control.Bounds.Width / 2d),
      origin.Y + (control.Bounds.Height / 2d));
  }

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }
    throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");
  }

  private sealed record RenderScenario(
    string Name,
    FsusThemeVariant Variant,
    FsusDensity Density,
    double Width,
    double Height,
    string ActivityKey,
    bool Narrow);

  private sealed record RenderCapture(
    string File,
    string Sha256,
    string AutomationFile,
    string AutomationSha256,
    string Scenario,
    string Theme,
    string Density,
    double WidthDip,
    double HeightDip,
    string ActivityKey,
    string DocumentKey,
    double PaneWidth,
    bool PaneOpen,
    double TitleBarHeight,
    double LeadingActionHeight);
}
