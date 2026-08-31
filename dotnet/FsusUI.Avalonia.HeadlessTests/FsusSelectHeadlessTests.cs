using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Data;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusSelectHeadlessTests
{
  [AvaloniaFact]
  public void ProductionSelectBindsItemsDisplayAndValuePathsTwoWays()
  {
    var viewModel = new ZoomSettings { Zoom = 100 };
    var zooms = new ObservableCollection<ZoomOption>
    {
      new(80, "80%"),
      new(100, "100%"),
      new(125, "125%"),
    };
    var select = new KeyboardSelect
    {
      AccessibleName = "Editor zoom",
      DisplayMemberPath = nameof(ZoomOption.Label),
      SelectedValuePath = nameof(ZoomOption.Value),
      ItemsSource = zooms,
    };
    select.Bind(
      FsusSelect.SelectedValueProperty,
      new Binding(nameof(ZoomSettings.Zoom))
      {
        Source = viewModel,
        Mode = BindingMode.TwoWay,
      });
    select.RefreshOptions();

    Assert.Equal(3, select.TotalOptionCount);
    Assert.Equal(100, select.SelectedValue);
    Assert.Equal("100%", select.SelectedLabel);

    Assert.True(select.SelectValue(125));
    Assert.Equal(125, viewModel.Zoom);
    Assert.Equal("125%", select.SelectedLabel);

    zooms.Add(new ZoomOption(150, "150%"));
    Assert.Equal(4, select.TotalOptionCount);
  }

  [AvaloniaFact]
  public void DependentSelectFollowsParentToggleState()
  {
    var viewModel = new ZoomSettings { UseCustomZoom = false };
    var select = new FsusSelect
    {
      AccessibleName = "Custom zoom",
      ItemsSource = new[] { 80, 100, 125 },
      SelectedValue = 100,
    };
    select.Bind(
      FsusSelect.IsEnabledProperty,
      new Binding(nameof(ZoomSettings.UseCustomZoom))
      {
        Source = viewModel,
        Mode = BindingMode.OneWay,
      });

    Assert.False(select.IsEnabled);
    Assert.Contains("fsus-disabled", select.Classes);

    viewModel.UseCustomZoom = true;

    Assert.True(select.IsEnabled);
    Assert.DoesNotContain("fsus-disabled", select.Classes);
  }

  [AvaloniaFact]
  public void PointerKeyboardAndAutomationOperateWithoutConsumerOverlayCalls()
  {
    var select = CreateZoomSelect();
    var host = new StackPanel
    {
      Margin = new Thickness(24),
      Children = { select },
    };
    var window = CreateWindow(host, 420, 300);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var center = select.TranslatePoint(
      new Point(select.Bounds.Width / 2, select.Bounds.Height / 2),
      window);
    Assert.NotNull(center);
    window.MouseDown(center!.Value, MouseButton.Left);
    window.MouseUp(center.Value, MouseButton.Left);
    Dispatcher.UIThread.RunJobs();

    Assert.True(select.IsOpen);
    Assert.Contains("fsus-open", select.Classes);

    var pointerOption = window.GetVisualDescendants()
      .OfType<FsusOption>()
      .Single(option => Equals(option.Value, 125));
    var optionCenter = pointerOption.TranslatePoint(
      new Point(pointerOption.Bounds.Width / 2, pointerOption.Bounds.Height / 2),
      window);
    Assert.NotNull(optionCenter);
    window.MouseDown(optionCenter!.Value, MouseButton.Left);
    window.MouseUp(optionCenter.Value, MouseButton.Left);
    Dispatcher.UIThread.RunJobs();
    Assert.False(select.IsOpen);
    Assert.Equal(125, select.SelectedValue);

    select.SelectedValue = 100;
    Assert.True(select.Focus());
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, string.Empty);
    Assert.True(select.IsOpen);
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, string.Empty);
    window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, string.Empty);
    Dispatcher.UIThread.RunJobs();

    Assert.False(select.IsOpen);
    Assert.Equal(125, select.SelectedValue);
    Assert.Equal("125%", select.SelectedLabel);

    window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, string.Empty);
    Assert.True(select.IsOpen);
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, string.Empty);
    Assert.False(select.IsOpen);
    window.KeyPress(Key.Up, RawInputModifiers.None, PhysicalKey.ArrowUp, string.Empty);
    Assert.True(select.IsOpen);
    var optionsPanel = window.GetVisualDescendants()
      .OfType<StackPanel>()
      .Single(control => control.Name == "PART_OptionsPanel");
    Assert.Equal(
      AutomationControlType.List,
      AutomationProperties.GetControlTypeOverride(optionsPanel));
    Assert.Equal(
      AutomationControlType.List,
      Assert.IsAssignableFrom<AutomationPeer>(
        ControlAutomationPeer.CreatePeerForElement(optionsPanel))
        .GetAutomationControlType());
    var disabledOption = select.FilteredOptions.Single(option => option.IsDisabled);
    Assert.False(ControlAutomationPeer.CreatePeerForElement(disabledOption).IsEnabled());
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, string.Empty);
    Assert.False(select.IsOpen);

    var peer = Assert.IsAssignableFrom<AutomationPeer>(
      ControlAutomationPeer.CreatePeerForElement(select));
    var expandCollapse = Assert.IsAssignableFrom<IExpandCollapseProvider>(peer);
    var selection = Assert.IsAssignableFrom<ISelectionProvider>(peer);
    Assert.Equal(AutomationControlType.ComboBox, peer.GetAutomationControlType());
    Assert.Equal(ExpandCollapseState.Collapsed, expandCollapse.ExpandCollapseState);
    Assert.False(selection.CanSelectMultiple);
    Assert.Single(selection.GetSelection());

    select.IsEnabled = false;
    window.MouseDown(center.Value, MouseButton.Left);
    window.MouseUp(center.Value, MouseButton.Left);
    Dispatcher.UIThread.RunJobs();
    Assert.False(select.IsOpen);
    Assert.False(peer.IsEnabled());

    window.Close();
  }

  [AvaloniaFact]
  public void PopupFlipsAndStaysInsideANarrowViewport()
  {
    var select = CreateZoomSelect();
    select.Width = 250;
    select.VerticalAlignment = VerticalAlignment.Bottom;
    select.HorizontalAlignment = HorizontalAlignment.Right;
    select.Margin = new Thickness(8);
    var window = CreateWindow(select, 300, 210);
    window.Show();
    Assert.True(select.Focus());
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, string.Empty);
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    Assert.True(select.IsOpen);
    var popup = window.GetVisualDescendants()
      .OfType<Border>()
      .Single(control => control.Classes.Contains("fsus-select-popup-border"));
    var popupTopLeft = popup.TranslatePoint(new Point(0, 0), window);
    var selectTopLeft = select.TranslatePoint(new Point(0, 0), window);
    Assert.NotNull(popupTopLeft);
    Assert.NotNull(selectTopLeft);
    Assert.True(popupTopLeft!.Value.X >= 0);
    Assert.True(popupTopLeft.Value.Y >= 0);
    Assert.True(popupTopLeft.Value.X + popup.Bounds.Width <= window.ClientSize.Width + 1);
    Assert.True(popupTopLeft.Value.Y + popup.Bounds.Height <= window.ClientSize.Height + 1);
    Assert.True(
      popupTopLeft.Value.Y < selectTopLeft!.Value.Y,
      $"Popup {popupTopLeft.Value} {popup.Bounds} should precede select {selectTopLeft.Value} {select.Bounds}.");

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "issue-658-select");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "select-viewport-edge.png");
    using var frame = Assert.IsAssignableFrom<global::Avalonia.Media.Imaging.Bitmap>(
      window.CaptureRenderedFrame());
    frame.Save(outputPath);
    Assert.Equal(new PixelSize(300, 210), frame.PixelSize);
    Assert.True(new FileInfo(outputPath).Length > 1_000);

    window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersLightDarkAndSystemThemeDensityEvidence()
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "issue-658-select");
    Directory.CreateDirectory(outputRoot);

    var captures = new List<SelectCapture>();
    foreach (var scenario in new[]
      {
        new SelectScenario("light", FsusThemeVariant.Light, FsusDensity.Compact, false),
        new SelectScenario("dark", FsusThemeVariant.Dark, FsusDensity.Default, false),
        new SelectScenario("system", FsusThemeVariant.Light, FsusDensity.Spacious, true),
      })
    {
      captures.Add(RenderScenario(outputRoot, scenario));
    }

    Assert.Equal(3, captures.Count);
    Assert.All(captures, capture =>
    {
      Assert.True(File.Exists(capture.File));
      Assert.True(new FileInfo(capture.File).Length > 1_000);
      Assert.Equal(64, capture.Sha256.Length);
      Assert.Equal(720, capture.Width);
      Assert.Equal(520, capture.Height);
    });

    var manifestPath = Path.Combine(outputRoot, "issue-658-select-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          generatedBy =
            "FsusSelectHeadlessTests.RealHeadlessSkiaRendersLightDarkAndSystemThemeDensityEvidence",
          issue = 658,
          fixtureClass = "production",
          renderer = new
          {
            platform = "Avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
          },
          localSimulation = new
          {
            physicalMacOS = false,
            physicalWindows = false,
            note =
              "Rendered locally on Linux. The system scenario uses Avalonia ThemeVariant.Default and FollowSystemTheme=true; it is not a physical OS matrix run.",
          },
          acceptance = new
          {
            pointer = true,
            keyboard = new[] { "Down", "Up", "Enter", "Escape" },
            automation = new[] { "ComboBox", "List", "ListItem", "ExpandCollapse", "Selection" },
            themes = new[] { "light", "dark", "system" },
            densities = new[] { "compact", "default", "spacious" },
            disabledControl = true,
            disabledOption = true,
            viewportConstrainedPopup = true,
          },
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.True(File.Exists(manifestPath));
  }

  private static SelectCapture RenderScenario(
    string outputRoot,
    SelectScenario scenario)
  {
    var selected = CreateZoomSelect();
    var focused = CreateZoomSelect();
    focused.AccessibleName = "Keyboard focused zoom";
    var disabled = CreateZoomSelect();
    disabled.AccessibleName = "Dependent zoom preset";
    disabled.IsEnabled = false;

    var content = new StackPanel
    {
      Margin = new Thickness(32),
      Spacing = 10,
      Children =
      {
        new TextBlock
        {
          Text = $"Production select · {scenario.Name} · {scenario.Density}",
          FontSize = 20,
          FontWeight = FontWeight.SemiBold,
        },
        new TextBlock { Text = "Editor zoom / 編輯器縮放" },
        selected,
        new TextBlock { Text = "Dependent setting disabled while parent toggle is off" },
        new CheckBox { Content = "Use custom zoom preset", IsChecked = false },
        disabled,
        new TextBlock { Text = "Keyboard focus and rendered listbox" },
        focused,
      },
    };
    selected.Width = focused.Width = disabled.Width = 360;
    selected.HorizontalAlignment = focused.HorizontalAlignment =
      disabled.HorizontalAlignment = HorizontalAlignment.Left;

    var surface = new Border { Child = content };
    var window = CreateWindow(surface, 720, 520);
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(
      resources,
      new FsusThemeOptions
      {
        Variant = scenario.Variant,
        Density = scenario.Density,
        FollowSystemTheme = scenario.FollowSystemTheme,
        MotionMode = FsusMotionMode.Reduced,
      });
    window.Resources.MergedDictionaries.Add(resources);
    window.RequestedThemeVariant = scenario.FollowSystemTheme
      ? global::Avalonia.Styling.ThemeVariant.Default
      : scenario.Variant == FsusThemeVariant.Dark
        ? global::Avalonia.Styling.ThemeVariant.Dark
        : global::Avalonia.Styling.ThemeVariant.Light;
    surface.Background = Assert.IsAssignableFrom<IBrush>(
      resources[FsusThemeResourceKeys.BackgroundBrush]);
    var pickerSurface = Assert.IsType<SolidColorBrush>(
      resources["FsusThemePickerSurfaceBrush"]);

    window.Show();
    Assert.True(focused.Focus());
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, string.Empty);
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
    Assert.True(focused.IsOpen);
    Assert.Contains("fsus-open", focused.Classes);
    Assert.Contains(
      window.GetVisualDescendants().OfType<FsusOption>(),
      option => option.IsDisabled && !option.IsEnabled);
    Assert.Equal(pickerSurface.Color, Assert.IsType<SolidColorBrush>(selected.Background).Color);

    var file = Path.Combine(outputRoot, $"select-{scenario.Name}.png");
    using var frame = Assert.IsAssignableFrom<global::Avalonia.Media.Imaging.Bitmap>(
      window.CaptureRenderedFrame());
    frame.Save(file);
    var capture = new SelectCapture(
      file,
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(file))),
      frame.PixelSize.Width,
      frame.PixelSize.Height,
      scenario.Name,
      scenario.Density.ToString(),
      scenario.FollowSystemTheme,
      focused.SelectedLabel,
      AutomationProperties.GetName(focused) ?? string.Empty,
      AutomationProperties.GetItemStatus(focused) ?? string.Empty);
    window.Close();
    return capture;
  }

  private static FsusSelect CreateZoomSelect()
  {
    var select = new FsusSelect
    {
      AccessibleName = "Editor zoom",
      Width = 260,
      DisplayMemberPath = nameof(ZoomOption.Label),
      SelectedValuePath = nameof(ZoomOption.Value),
      ItemsSource = new object[]
      {
        new FsusOption
        {
          Value = 60,
          Label = "60% (unavailable)",
          IsDisabled = true,
        },
        new ZoomOption(80, "80%"),
        new ZoomOption(100, "100%"),
        new ZoomOption(125, "125%"),
        new ZoomOption(150, "150% · long localized option"),
      },
      SelectedValue = 100,
    };
    select.RefreshOptions();
    return select;
  }

  private static Window CreateWindow(Control content, double width, double height)
  {
    var window = new Window
    {
      Width = width,
      Height = height,
      Content = content,
      ShowInTaskbar = false,
    };
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    return window;
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

  private sealed record ZoomOption(int Value, string Label);

  private sealed class KeyboardSelect : FsusSelect
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class ZoomSettings : INotifyPropertyChanged
  {
    private int zoom;
    private bool useCustomZoom;

    public int Zoom
    {
      get => zoom;
      set
      {
        if (zoom == value)
        {
          return;
        }
        zoom = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Zoom)));
      }
    }

    public bool UseCustomZoom
    {
      get => useCustomZoom;
      set
      {
        if (useCustomZoom == value)
        {
          return;
        }
        useCustomZoom = value;
        PropertyChanged?.Invoke(
          this,
          new PropertyChangedEventArgs(nameof(UseCustomZoom)));
      }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
  }

  private sealed record SelectScenario(
    string Name,
    FsusThemeVariant Variant,
    FsusDensity Density,
    bool FollowSystemTheme);

  private sealed record SelectCapture(
    string File,
    string Sha256,
    int Width,
    int Height,
    string Theme,
    string Density,
    bool FollowSystemTheme,
    string SelectedLabel,
    string AutomationName,
    string AutomationItemStatus);
}
