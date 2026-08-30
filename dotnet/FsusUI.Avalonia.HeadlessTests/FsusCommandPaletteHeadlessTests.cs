using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
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
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusCommandPaletteHeadlessTests
{
  [AvaloniaFact]
  public async Task LivePredicatesRefreshMountedVisibilityAndEnabledState()
  {
    var hidden = true;
    var enabled = false;
    var visibleCommand = new FsusPlatformCommand("workspace.visible", "Visible command")
    {
      IsEnabledPredicate = () => enabled,
    };
    var hiddenCommand = new FsusPlatformCommand("workspace.hidden", "Hidden command")
    {
      IsVisiblePredicate = () => !hidden,
    };
    var palette = new FsusCommandPalette
    {
      CommandTree =
      [
        FsusNativeMenuItemModel.Action(visibleCommand),
        FsusNativeMenuItemModel.Action(hiddenCommand),
      ],
    };
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(900, 620, host);
    await palette.OpenAsync(host);

    Assert.Single(palette.Results);
    Assert.False(palette.Results[0].IsEnabled);

    hidden = false;
    enabled = true;
    visibleCommand.NotifyStateChanged();
    hiddenCommand.NotifyStateChanged();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(2, palette.Results.Count);
    Assert.True(Assert.Single(
      palette.Results,
      result => result.CommandId == "workspace.visible").IsEnabled);
    Assert.Contains(
      palette.Results,
      result => result.CommandId == "workspace.hidden");
    window.Close();
  }

  [AvaloniaFact]
  public async Task CancelsSupersededProviderSearchAndReportsCurrentSearchFailure()
  {
    var slowStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var current = new FsusPlatformCommand("remote.current", "Current provider result");
    var palette = new FsusCommandPalette
    {
      Providers =
      [
        async (query, cancellationToken) =>
        {
          if (query == "slow")
          {
            slowStarted.SetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
          }
          if (query == "fail")
          {
            throw new InvalidOperationException("Provider is unavailable");
          }
          return query == "current" ? [current] : [];
        },
      ],
    };
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(900, 620, host);
    await palette.OpenAsync(host);

    var slowSearch = palette.SetQueryAsync("slow").AsTask();
    await slowStarted.Task;
    await palette.SetQueryAsync("current");
    await slowSearch;

    Assert.Equal(FsusCommandPaletteState.Ready, palette.State);
    Assert.Equal("remote.current", Assert.Single(palette.Results).CommandId);

    FsusCommandPaletteFailedEventArgs? failed = null;
    palette.Failed += (_, args) => failed = args;
    await palette.SetQueryAsync("fail");

    Assert.Equal(FsusCommandPaletteState.Failed, palette.State);
    Assert.Equal("Provider is unavailable", palette.FailureMessage);
    Assert.Equal(FsusCommandPaletteFailureStage.Search, failed?.Stage);
    Assert.Null(failed?.CommandId);
    window.Close();
  }

  [AvaloniaFact]
  public async Task RoutedKeyboardEntersNestedCommandsExecutesAndEscapesToInvoker()
  {
    var executions = 0;
    var child = new FsusPlatformCommand("format.heading", "Apply heading")
    {
      ExecuteAction = _ => executions++,
    };
    var group = FsusNativeMenuItemModel.SubMenu(
      "Format",
      FsusNativeMenuItemModel.Action(child));
    group.Id = "group.format";
    var palette = new FsusCommandPalette
    {
      CommandTree = [group],
      OverlaySize = new Size(640, 420),
      ViewportBounds = new Rect(0, 0, 900, 620),
    };
    var invoker = new Button { Content = "Open commands", Focusable = true };
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(900, 620, host, invoker);
    await palette.OpenAsync(host, invoker);
    Layout(window);
    var search = Assert.Single(palette.GetVisualDescendants().OfType<FsusInput>());

    Assert.True(RaiseKey(search, Key.Enter).Handled);
    Assert.Equal(["Format"], palette.CurrentPath);
    Assert.Equal("format.heading", palette.SelectedCommandId);
    Assert.True(RaiseKey(search, Key.Enter).Handled);
    Assert.Equal(1, executions);
    Assert.False(palette.IsOpen);
    Assert.Same(invoker, host.LastRestoredFocus);

    await palette.OpenAsync(host, invoker);
    Layout(window);
    Assert.True(RaiseKey(search, Key.Escape).Handled);
    Assert.False(palette.IsOpen);
    Assert.Same(invoker, host.LastRestoredFocus);
    window.Close();
  }

  [AvaloniaFact]
  public async Task MountedPaletteSynchronizesVirtualizedKeyboardPointerAndAutomationPaths()
  {
    var invoked = string.Empty;
    var commands = Enumerable.Range(0, 120)
      .Select(index => FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand($"workspace.command-{index:D3}", $"Workspace command {index:D3}")
        {
          Category = index % 2 == 0 ? "Workspace" : "Document",
          Description = $"Execute production command {index:D3}",
          ExecuteAction = _ => invoked = $"workspace.command-{index:D3}",
        }))
      .ToArray();
    var palette = new FsusCommandPalette
    {
      CommandTree = commands,
      OverlaySize = new Size(640, 420),
      ViewportBounds = new Rect(0, 0, 900, 620),
      AccessibleName = "Workspace commands",
      SearchAccessibleName = "Search workspace commands",
    };
    var invoker = new Button { Content = "Open commands", Focusable = true };
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(900, 620, host, invoker);

    await palette.OpenAsync(host, invoker);
    Layout(window);

    var list = Assert.Single(
      palette.GetVisualDescendants().OfType<FsusVirtualList>());
    var search = Assert.Single(
      palette.GetVisualDescendants().OfType<FsusInput>());
    Assert.True(
      search.Bounds.Width > 0 && search.Bounds.Height > 0,
      $"Search input must be laid out, actual bounds: {search.Bounds}.");
    Assert.True(
      search.GetVisualDescendants().Any(),
      $"Search input template must be realized; bounds={search.Bounds}.");
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(list));
    Assert.True(list.IsVirtualized);
    Assert.True(list.RealizedContainerCount < palette.Results.Count);
    Assert.Equal(0, palette.SelectedIndex);

    for (var index = 0; index < 40; index++)
    {
      Assert.True(await palette.HandleKeyAsync(Key.Down));
    }
    Layout(window);

    Assert.Equal(40, palette.SelectedIndex);
    Assert.True(list.ScrollOffset > 0);
    var selected = Assert.Single(
      list.RealizedContainers,
      container => container.Index == palette.SelectedIndex);
    Assert.Equal(AutomationControlType.ListItem, AutomationProperties.GetControlTypeOverride(selected));
    Assert.Equal("Workspace command 040", AutomationProperties.GetName(selected));
    Assert.Equal(41, AutomationProperties.GetPositionInSet(selected));
    Assert.Equal(120, AutomationProperties.GetSizeOfSet(selected));
    Assert.Contains("selected", AutomationProperties.GetItemStatus(selected));
    Assert.Contains("Workspace", AutomationProperties.GetHelpText(selected));
    Assert.True(
      selected.Bounds.Width >= list.Bounds.Width - 1,
      $"Virtualized command rows must fill the results viewport ({selected.Bounds.Width} < {list.Bounds.Width}).");

    var pointerTarget = Assert.Single(
      list.RealizedContainers.OrderBy(container => container.Index).Take(1));
    var pointerCommandId = palette.Results[pointerTarget.Index].CommandId;
    Press(pointerTarget, window);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(pointerCommandId, invoked);
    Assert.False(palette.IsOpen);
    Assert.Same(invoker, host.LastRestoredFocus);
    window.Close();
  }

  [AvaloniaFact]
  public async Task AsyncProviderAndCommandCompleteThroughMountedDispatcher()
  {
    var releaseSearch = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var releaseExecution = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var providerCommand = new FsusPlatformCommand("remote.publish", "Publish workspace")
    {
      Description = "Publish the current workspace through an asynchronous provider",
      Category = "Remote",
      ExecuteAsyncAction = async (_, cancellationToken) =>
        await releaseExecution.Task.WaitAsync(cancellationToken),
    };
    var palette = new FsusCommandPalette
    {
      Providers =
      [
        async (_, cancellationToken) =>
        {
          await releaseSearch.Task.WaitAsync(cancellationToken);
          return [providerCommand];
        },
      ],
      OverlaySize = new Size(640, 420),
      ViewportBounds = new Rect(0, 0, 900, 620),
    };
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(900, 620, host);

    palette.Open(host);
    Assert.Equal(FsusCommandPaletteState.Searching, palette.State);
    releaseSearch.SetResult();
    await PumpUntilAsync(() => palette.State != FsusCommandPaletteState.Searching);

    Assert.Equal("remote.publish", palette.SelectedCommandId);
    var execution = palette.ActivateSelectedAsync().AsTask();
    Assert.Equal(FsusCommandPaletteState.Executing, palette.State);
    releaseExecution.SetResult();
    await PumpUntilAsync(() => execution.IsCompleted);

    Assert.True(await execution);
    Assert.False(palette.IsOpen);
    window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRenderProducesCommandPaletteEvidenceMatrix()
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "issue-646-command-palette");
    Directory.CreateDirectory(outputRoot);
    var scenarios = new[]
    {
      new RenderScenario("light-default", FsusThemeVariant.Light, false, 900, 620, "ready"),
      new RenderScenario("dark-nested", FsusThemeVariant.Dark, false, 900, 620, "nested"),
      new RenderScenario("dark-high-contrast-focus", FsusThemeVariant.Dark, true, 900, 620, "focus"),
      new RenderScenario("light-narrow", FsusThemeVariant.Light, false, 540, 620, "ready"),
      new RenderScenario("light-zoom-equivalent-200", FsusThemeVariant.Light, false, 450, 310, "ready"),
      new RenderScenario("light-searching", FsusThemeVariant.Light, false, 900, 620, "searching"),
      new RenderScenario("light-busy", FsusThemeVariant.Light, false, 900, 620, "busy"),
      new RenderScenario("dark-failure", FsusThemeVariant.Dark, false, 900, 620, "failure"),
      new RenderScenario("light-empty", FsusThemeVariant.Light, false, 900, 620, "empty"),
    };

    var captures = scenarios.Select(scenario => Render(outputRoot, scenario)).ToArray();
    Assert.Equal(9, captures.Length);
    Assert.All(captures, capture =>
    {
      Assert.Equal(64, capture.Sha256.Length);
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.File)));
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.AutomationFile)));
    });

    var manifestPath = Path.Combine(outputRoot, "command-palette-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 646,
          generatedBy =
            "FsusCommandPaletteHeadlessTests.RealHeadlessSkiaRenderProducesCommandPaletteEvidenceMatrix",
          fixtureClass = "production",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
          },
          simulation =
            "Local deterministic Headless Skia simulation; no external hardware or CI service is represented.",
          captures,
        },
        new JsonSerializerOptions
        {
          WriteIndented = true,
          PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        }) + "\n");

    Assert.True(new FileInfo(manifestPath).Length > 1_000);
  }

  private static CommandPaletteCapture Render(string outputRoot, RenderScenario scenario)
  {
    var host = new FsusOverlayHost();
    var window = CreateStyledWindow(
      scenario.Width,
      scenario.Height,
      host,
      scenario.Variant,
      scenario.HighContrast);
    var pending = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var palette = BuildPalette(scenario.State, pending);
    palette.OverlaySize = new Size(
      Math.Min(640, scenario.Width - 32),
      Math.Min(480, scenario.Height - 32));
    palette.ViewportBounds = new Rect(0, 0, scenario.Width, scenario.Height);
    palette.Open(host);
    Layout(window);

    if (scenario.State == "nested")
    {
      palette.HandleKeyAsync(Key.Enter).GetAwaiter().GetResult();
      Layout(window);
    }
    else if (scenario.State == "focus")
    {
      palette.HandleKeyAsync(Key.Down).GetAwaiter().GetResult();
      var list = Assert.Single(palette.GetVisualDescendants().OfType<FsusVirtualList>());
      var selected = Assert.Single(
        list.RealizedContainers,
        container => container.Index == palette.SelectedIndex);
      Assert.True(selected.Focus(NavigationMethod.Tab));
      Layout(window);
    }
    else if (scenario.State == "busy")
    {
      _ = palette.ActivateSelectedAsync();
      Assert.Equal(FsusCommandPaletteState.Executing, palette.State);
      Layout(window);
    }
    else if (scenario.State == "searching")
    {
      Assert.Equal(FsusCommandPaletteState.Searching, palette.State);
      Layout(window);
    }
    else if (scenario.State == "failure")
    {
      Assert.False(palette.ActivateSelectedAsync().GetAwaiter().GetResult());
      Assert.Equal(FsusCommandPaletteState.Failed, palette.State);
      Layout(window);
    }

    var pixelWidth = Math.Max(1, (int)Math.Ceiling(scenario.Width));
    var pixelHeight = Math.Max(1, (int)Math.Ceiling(scenario.Height));
    using var bitmap = new RenderTargetBitmap(
      new PixelSize(pixelWidth, pixelHeight),
      new Vector(96, 96));
    bitmap.Render(host);
    var fileName = $"command-palette-{scenario.Name}.png";
    var outputPath = Path.Combine(outputRoot, fileName);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    var listControl = Assert.Single(palette.GetVisualDescendants().OfType<FsusVirtualList>());
    var searchControl = Assert.Single(palette.GetVisualDescendants().OfType<FsusInput>());
    var searchOrigin = searchControl.TranslatePoint(default, host);
    var automationPath = Path.Combine(
      outputRoot,
      $"command-palette-{scenario.Name}-automation.json");
    File.WriteAllText(
      automationPath,
      JsonSerializer.Serialize(
        new
        {
          name = AutomationProperties.GetName(palette),
          status = AutomationProperties.GetItemStatus(palette),
          listRole = AutomationProperties.GetControlTypeOverride(listControl).ToString(),
          itemCount = palette.Results.Count,
          selectedIndex = palette.SelectedIndex,
          selectedCommandId = palette.SelectedCommandId,
          searchBounds = searchControl.Bounds.ToString(),
          searchOrigin = searchOrigin?.ToString(),
          searchPlaceholder = searchControl.PlaceholderText,
          searchBorderThickness = searchControl.BorderThickness.ToString(),
          searchBorderBrush = searchControl.BorderBrush?.ToString(),
          realizedItemCount = listControl.RealizedContainerCount,
          isVirtualized = listControl.IsVirtualized,
          items = listControl.RealizedContainers
            .OrderBy(container => container.Index)
            .Select(container => new
            {
              container.Index,
              role = AutomationProperties.GetControlTypeOverride(container).ToString(),
              name = AutomationProperties.GetName(container),
              help = AutomationProperties.GetHelpText(container),
              status = AutomationProperties.GetItemStatus(container),
              positionInSet = AutomationProperties.GetPositionInSet(container),
              sizeOfSet = AutomationProperties.GetSizeOfSet(container),
            }),
        },
        new JsonSerializerOptions
        {
          WriteIndented = true,
          PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        }) + "\n");

    if (scenario.State is "busy" or "searching")
    {
      pending.SetResult();
      Dispatcher.UIThread.RunJobs();
    }
    window.Close();

    return new CommandPaletteCapture(
      Path.GetRelativePath(FindRepositoryRoot(), outputPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
      Path.GetRelativePath(FindRepositoryRoot(), automationPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(automationPath))),
      new PixelDimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      scenario.Name,
      scenario.Variant.ToString(),
      scenario.HighContrast,
      scenario.Width,
      scenario.Height,
      scenario.Name.Contains("zoom-equivalent", StringComparison.Ordinal)
        ? "200-percent-logical-viewport-equivalent"
        : null,
      scenario.State,
      palette.Results.Count);
  }

  private static FsusCommandPalette BuildPalette(
    string state,
    TaskCompletionSource pending)
  {
    if (state == "searching")
    {
      return new FsusCommandPalette
      {
        AccessibleName = "Workspace commands",
        SearchAccessibleName = "Search workspace commands",
        Providers =
        [
          async (_, cancellationToken) =>
          {
            await pending.Task.WaitAsync(cancellationToken);
            return [];
          },
        ],
      };
    }

    if (state == "empty")
    {
      return new FsusCommandPalette
      {
        AccessibleName = "Workspace commands",
        EmptyText = "No matching workspace commands",
      };
    }

    var open = new FsusPlatformCommand("file.open", "Open recent document")
    {
      Category = "File",
      Description = "Choose a document from the recent workspace history",
      IconKey = "FsusIconFileDocument",
      Gesture = new FsusShortcutGesture(Key.O, KeyModifiers.Control),
    };
    var publish = new FsusPlatformCommand("workspace.publish", "Publish workspace")
    {
      Category = "Workspace",
      Description = "Build and publish the active workspace",
      IconKey = "FsusIconSaveAll",
      Gesture = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift),
      ExecuteAsyncAction = state == "busy"
        ? async (_, cancellationToken) => await pending.Task.WaitAsync(cancellationToken)
        : state == "failure"
          ? (_, _) => ValueTask.FromException(
            new InvalidOperationException("Publishing service is unavailable"))
          : null,
    };
    var disabled = new FsusPlatformCommand("workspace.archive", "Archive workspace")
    {
      Category = "Workspace",
      Description = "Requires owner permission",
      IsEnabled = false,
    };
    var nested = FsusNativeMenuItemModel.SubMenu(
      "Format",
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand("format.heading", "Apply heading")
        {
          Category = "Format",
          Description = "套用標題樣式至目前段落",
          Gesture = new FsusShortcutGesture(Key.D1, KeyModifiers.Control | KeyModifiers.Alt),
        }),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand("format.code", "Toggle code block")
        {
          Category = "Format",
          Description = "Wrap the selection in a fenced code block",
        }));
    nested.Id = "group.format";

    return new FsusCommandPalette
    {
      AccessibleName = "Workspace commands",
      SearchAccessibleName = "Search workspace commands",
      SearchPlaceholder = "Search commands by name, category, or description",
      BackLabel = "Back to all commands",
      CommandTree = state is "busy" or "failure"
        ? [FsusNativeMenuItemModel.Action(publish)]
        :
        [
          nested,
          FsusNativeMenuItemModel.Action(open),
          FsusNativeMenuItemModel.Action(publish),
          FsusNativeMenuItemModel.Action(disabled),
        ],
      ShortcutPlatform = FsusShortcutPlatform.Windows,
    };
  }

  private static Window CreateStyledWindow(
    double width,
    double height,
    FsusOverlayHost host,
    Control? invoker = null) =>
    CreateStyledWindow(width, height, host, FsusThemeVariant.Light, false, invoker);

  private static Window CreateStyledWindow(
    double width,
    double height,
    FsusOverlayHost host,
    FsusThemeVariant variant,
    bool highContrast,
    Control? invoker = null)
  {
    var window = new Window
    {
      Width = width,
      Height = height,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Resources.MergedDictionaries.Add(
      new ResourceInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
      });
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = variant,
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
    if (invoker is not null)
    {
      host.Children.Add(invoker);
    }
    window.Content = host;
    window.Show();
    Layout(window);
    return window;
  }

  private static void Layout(Window window)
  {
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
  }

  private static void Press(Control target, Window window)
  {
    var pointer = new Pointer(Pointer.GetNextFreeId(), PointerType.Mouse, true);
    var args = new PointerPressedEventArgs(
      target,
      pointer,
      window,
      new Point(4, 4),
      0UL,
      new PointerPointProperties(
        RawInputModifiers.LeftMouseButton,
        PointerUpdateKind.LeftButtonPressed),
      KeyModifiers.None);
    target.RaiseEvent(args);
  }

  private static KeyEventArgs RaiseKey(Control target, Key key)
  {
    var args = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Source = target,
      Key = key,
    };
    target.RaiseEvent(args);
    Dispatcher.UIThread.RunJobs();
    return args;
  }

  private static async Task PumpUntilAsync(Func<bool> predicate)
  {
    for (var attempt = 0; attempt < 200 && !predicate(); attempt++)
    {
      Dispatcher.UIThread.RunJobs();
      await Task.Yield();
    }
    Assert.True(predicate());
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
    bool HighContrast,
    double Width,
    double Height,
    string State);

  private sealed record PixelDimension(int Width, int Height);

  private sealed record CommandPaletteCapture(
    string File,
    string Sha256,
    string AutomationFile,
    string AutomationSha256,
    PixelDimension PixelSize,
    string Scenario,
    string Theme,
    bool HighContrast,
    double WidthDip,
    double HeightDip,
    string? ZoomSimulation,
    string State,
    int ResultCount);
}
