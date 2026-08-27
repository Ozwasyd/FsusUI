using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
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
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusSwitchTemplateHeadlessTests
{
  [AvaloniaFact]
  public void OpeningSecondNativeWindowCompletesLayoutWithFsusTemplateParts()
  {
    ApplyTheme(FsusThemeVariant.Light);
    var firstWindow =
      MountWindow([("first", new FsusSwitch { Content = "First" })]);
    firstWindow.Show();

    var checkedSwitch = new FsusSwitch
    {
      AccessibleName = "Second checked",
      IsChecked = true,
      Content = "Checked",
    };
    var uncheckedSwitch = new FsusSwitch
    {
      AccessibleName = "Second unchecked",
      Content = "Unchecked",
    };
    var nativeToggleSwitch = new ToggleSwitch
    {
      Content = "Native toggle",
    };
    var secondWindow = MountWindow(
      [
        ("checked", checkedSwitch),
        ("unchecked", uncheckedSwitch),
        ("native", nativeToggleSwitch),
      ]);
    secondWindow.Show();

    foreach (var control in new Control[] { checkedSwitch, uncheckedSwitch, nativeToggleSwitch })
    {
      Assert.True(control.IsMeasureValid, $"{control.Name} measure should complete.");
      Assert.True(control.IsArrangeValid, $"{control.Name} arrange should complete.");
      Assert.True(control.Bounds.Width > 0, $"{control.Name} should have a measured width.");
      Assert.True(control.Bounds.Height > 0, $"{control.Name} should have a measured height.");

      var knobTrack = RequirePart<Border>(control, "PART_KnobTrack");
      var switchKnob = RequirePart<Canvas>(control, "PART_SwitchKnob");
      var movingKnobs = RequirePart<Panel>(control, "PART_MovingKnobs");

      Assert.True(knobTrack.Bounds.Width >= movingKnobs.Bounds.Width * 2);
      Assert.Equal(switchKnob.Bounds.Width, movingKnobs.Bounds.Width);
    }

    AssertKnobAtStart(uncheckedSwitch);
    AssertKnobFullyTraveled(checkedSwitch);

    secondWindow.Close();
    firstWindow.Close();
  }

  [AvaloniaFact]
  public void PointerClickOnSecondWindowTogglesSwitchAndAutomationState()
  {
    ApplyTheme(FsusThemeVariant.Light);
    var target = new FsusSwitch
    {
      AccessibleName = "Pointer toggle",
      Content = "Pointer",
    };
    var window = MountWindow([("target", target)]);
    window.Show();

    ClickKnob(window, target);
    Assert.True(target.IsChecked == true);
    AssertToggleState(target, ToggleState.On);
    Assert.True(target.IsKeyboardFocusWithin);
    Assert.Contains("fsus-focus-visible", target.Classes);

    ClickKnob(window, target);
    Assert.False(target.IsChecked == true);
    AssertToggleState(target, ToggleState.Off);

    window.Close();
  }

  [AvaloniaFact]
  public void SpaceKeyTogglesFocusedSwitchAndAutomationState()
  {
    ApplyTheme(FsusThemeVariant.Light);
    var target = new FsusSwitch
    {
      AccessibleName = "Keyboard toggle",
      Content = "Keyboard",
    };
    var loading = new FsusSwitch
    {
      AccessibleName = "Loading toggle",
      IsLoading = true,
      Content = "Loading",
    };
    var window = MountWindow(
      [("keyboard", target), ("loading", loading)]);
    window.Show();

    target.Focus();
    Assert.True(target.IsFocused);

    window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
    Assert.True(target.IsChecked == true);
    AssertToggleState(target, ToggleState.On);

    loading.Focus();
    window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
    Assert.False(loading.IsChecked == true);

    window.Close();
  }

  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void SwitchTogglesWithPointerAndKeyboardAcrossThemeVariants(FsusThemeVariant variant)
  {
    ApplyTheme(variant);
    var pointerTarget = new FsusSwitch
    {
      AccessibleName = $"{variant} pointer",
      Content = $"{variant} pointer",
    };
    var keyboardTarget = new FsusSwitch
    {
      AccessibleName = $"{variant} keyboard",
      IsChecked = true,
      Content = $"{variant} keyboard",
    };
    var window = MountWindow(
      [("pointer", pointerTarget), ("keyboard", keyboardTarget)],
      width: 520);
    window.Show();

    ClickKnob(window, pointerTarget);
    Assert.True(pointerTarget.IsChecked == true);

    keyboardTarget.Focus();
    window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
    Assert.False(keyboardTarget.IsChecked == true);
    AssertToggleState(pointerTarget, ToggleState.On);
    AssertToggleState(keyboardTarget, ToggleState.Off);
    Assert.Contains("fsus-checked", pointerTarget.Classes);
    Assert.Contains("fsus-unchecked", keyboardTarget.Classes);

    window.Close();
  }

  [AvaloniaFact]
  public void ReducedMotionStillReachesTerminalKnobPosition()
  {
    ApplyTheme(FsusThemeVariant.Light, FsusMotionMode.Reduced);
    var target = new FsusSwitch
    {
      AccessibleName = "Reduced motion",
      IsChecked = true,
      Content = "Reduced motion",
    };
    var window = MountWindow([("reduced", target)]);
    window.Show();

    AssertKnobFullyTraveled(target);

    target.ToggleValue();
    AssertKnobAtStart(target);

    window.Close();
  }

  [AvaloniaFact]
  public void SizeVariantsApplyDensityTrackAndKnobGeometry()
  {
    ApplyTheme(FsusThemeVariant.Light);
    var small = new FsusSwitch
      { AccessibleName = "Small", Size = FsusComponentSize.Sm, Content = "Small" };
    var medium = new FsusSwitch { AccessibleName = "Medium", Content = "Medium" };
    var large = new FsusSwitch
      { AccessibleName = "Large", Size = FsusComponentSize.Lg, Content = "Large" };
    var window = MountWindow(
      [("small", small), ("medium", medium), ("large", large)],
      width: 560);
    window.Show();

    AssertPill(small, expectedWidth: 32, expectedHeight: 20, expectedKnob: 12);
    AssertPill(medium, expectedWidth: 38, expectedHeight: 24, expectedKnob: 14);
    AssertPill(large, expectedWidth: 48, expectedHeight: 30, expectedKnob: 18);

    window.Close();
  }

  [AvaloniaFact]
  public void LoadingAndDisabledStatesDimSwitchAndBlockInteraction()
  {
    ApplyTheme(FsusThemeVariant.Light);
    var loading = new FsusSwitch
    {
      AccessibleName = "Loading states",
      IsLoading = true,
      Content = "Loading",
    };
    var disabled = new FsusSwitch
    {
      AccessibleName = "Disabled states",
      IsEnabled = false,
      Content = "Disabled",
    };
    var window = MountWindow(
      [("loading", loading), ("disabled", disabled)],
      width: 560);
    window.Show();

    Assert.False(loading.IsEnabled);
    Assert.Contains("fsus-loading", loading.Classes);
    Assert.Contains("fsus-disabled", loading.Classes);
    Assert.Contains("fsus-disabled", disabled.Classes);

    Assert.True(
      loading.TryFindResource(
        FsusThemeResourceKeys.DisabledOpacity,
        out var disabledOpacityResource),
      "DisabledOpacity resource should resolve from the mounted theme.");
    var disabledOpacity = Assert.IsType<double>(disabledOpacityResource);
    Assert.Equal(disabledOpacity, loading.Opacity);
    Assert.Equal(disabledOpacity, disabled.Opacity);

    loading.Focus();
    window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
    Assert.False(loading.IsChecked == true);
    AssertToggleState(loading, ToggleState.Off, expectedItemStatus: "loading");

    window.Close();
  }

  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void RealHeadlessSkiaRenderProducesInspectableStateEvidence(
    FsusThemeVariant variant)
  {
    ApplyTheme(variant, FsusMotionMode.Reduced);
    var controls = new[]
    {
      new FsusSwitch
      {
        AccessibleName = "Notifications off",
        Content = "Notifications off",
      },
      new FsusSwitch
      {
        AccessibleName = "Notifications on",
        Content = "Notifications on",
        IsChecked = true,
      },
      new FsusSwitch
      {
        AccessibleName = "Keyboard focus",
        Content = "Keyboard focus",
      },
      new FsusSwitch
      {
        AccessibleName = "Loading preferences",
        Content = "Loading preferences",
        IsLoading = true,
      },
      new FsusSwitch
      {
        AccessibleName = "Disabled preference",
        Content = "Disabled preference",
        IsEnabled = false,
      },
      new FsusSwitch
      {
        AccessibleName = "Compact density",
        Content = "Compact density",
        Size = FsusComponentSize.Sm,
      },
      new FsusSwitch
      {
        AccessibleName = "Large density",
        Content = "Large density",
        IsChecked = true,
        Size = FsusComponentSize.Lg,
      },
    };
    var stack = new StackPanel
    {
      Margin = new Thickness(24),
      Spacing = 8,
    };
    foreach (var control in controls)
    {
      stack.Children.Add(control);
    }

    var surface = new Border
    {
      Width = 640,
      Padding = new Thickness(24),
      Child = stack,
    };
    var window = new Window
    {
      Width = 640,
      Height = 440,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    Assert.True(
      window.TryFindResource(
        FsusThemeResourceKeys.BackgroundBrush,
        out var backgroundResource));
    surface.Background = Assert.IsAssignableFrom<IBrush>(backgroundResource);

    window.Show();
    controls[2].Focus();
    window.Measure(new Size(640, 440));
    window.Arrange(new Rect(0, 0, 640, 440));
    surface.Arrange(new Rect(0, 0, 640, 440));

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-switch-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(
      outputRoot,
      $"switch-state-matrix-{variant.ToString().ToLowerInvariant()}.png");
    using var bitmap =
      new RenderTargetBitmap(new PixelSize(640, 440), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    Assert.True(File.Exists(outputPath));
    Assert.True(new FileInfo(outputPath).Length > 1_000);
    Assert.All(controls, control =>
    {
      Assert.True(control.IsMeasureValid);
      Assert.True(control.IsArrangeValid);
      Assert.True(control.Bounds.Width > 0);
      Assert.True(control.Bounds.Height > 0);
      _ = RequirePart<Panel>(control, "PART_MovingKnobs");
    });
    Assert.Contains("fsus-focus-visible", controls[2].Classes);
    window.Close();
  }

  // Theme resources and styles are scoped to the windows this suite mounts so
  // the shared headless application (and other suites' tracked render
  // artifacts) never observe application-level FsusUI styling.
  private static FsusThemeOptions themeOptions = new();

  private static void ApplyTheme(
    FsusThemeVariant variant,
    FsusMotionMode motionMode = FsusMotionMode.Enabled)
  {
    themeOptions = new FsusThemeOptions
    {
      Variant = variant,
      MotionMode = motionMode,
    };
  }

  private static void AttachFsusTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, themeOptions);

    // Issue Ozwasyd/FsusUI#656 territory: the shared focus styles consume
    // FsusThemeFocusThickness as a Thickness, while the light/dark palettes
    // currently publish it as a Double. Repointing that resource belongs to
    // the parallel focus contract branch, so this harness publishes the
    // intended uniform thickness here to keep switch scenarios exercisable.
    resources[FsusThemeResourceKeys.FocusThickness] = new Thickness(2);
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }

  private static Window MountWindow(
    (string name, Control content)[] children,
    double width = 480)
  {
    var stack = new StackPanel { Margin = new Thickness(16), Spacing = 8 };
    foreach (var child in children)
    {
      child.content.Name = child.name;
      stack.Children.Add(child.content);
    }

    var window = new Window
    {
      Width = width,
      Height = 360,
      Content = stack,
    };
    AttachFsusTheme(window);

    return window;
  }

  private static void ClickKnob(Window window, Control control)
  {
    var knobTrack = RequirePart<Border>(control, "PART_KnobTrack");
    var centerInTrack = new Point(
      knobTrack.Bounds.Width / 2,
      knobTrack.Bounds.Height / 2);
    var centerInWindow =
      knobTrack.TranslatePoint(centerInTrack, window)
      ?? throw new InvalidOperationException($"{control.Name} is not attached to the window.");

    window.MouseDown(centerInWindow, MouseButton.Left);
    window.MouseUp(centerInWindow, MouseButton.Left);
  }

  private static T RequirePart<T>(Control control, string name)
    where T : class
  {
    foreach (var descendant in control.GetVisualDescendants())
    {
      if (descendant is Visual && descendant.Name == name && descendant is T typed)
      {
        return typed;
      }
    }

    throw new Xunit.Sdk.XunitException(
      $"Template part '{name}' was not found for '{control.Name}'.");
  }

  private static Canvas SwitchKnob(Control control) =>
    RequirePart<Canvas>(control, "PART_SwitchKnob");

  private static double KnobLeft(FsusSwitch control) =>
    Canvas.GetLeft(RequirePart<Panel>(control, "PART_MovingKnobs"));

  private static void AssertKnobAtStart(FsusSwitch control) =>
    Assert.Equal(0, KnobLeft(control));

  private static void AssertKnobFullyTraveled(FsusSwitch control) =>
    Assert.Equal(SwitchKnob(control).Bounds.Width, KnobLeft(control));

  private static void AssertPill(
    FsusSwitch control,
    double expectedWidth,
    double expectedHeight,
    double expectedKnob)
  {
    var knobTrack = RequirePart<Border>(control, "PART_KnobTrack");
    var movingKnobs = RequirePart<Panel>(control, "PART_MovingKnobs");
    Assert.Equal(expectedWidth, knobTrack.Bounds.Width);
    Assert.Equal(expectedHeight, knobTrack.Bounds.Height);
    Assert.Equal(expectedKnob, movingKnobs.Bounds.Width);
    Assert.Equal(expectedKnob, movingKnobs.Bounds.Height);
  }

  private static void AssertToggleState(
    Control control,
    ToggleState expected,
    string? expectedItemStatus = null)
  {
    var peer = ControlAutomationPeer.CreatePeerForElement(control);
    Assert.NotNull(peer);
    var toggleProvider = Assert.IsAssignableFrom<IToggleProvider>(peer);
    Assert.Equal(expected, toggleProvider.ToggleState);
    Assert.Equal(
      expectedItemStatus ?? (expected == ToggleState.On ? "checked" : "unchecked"),
      AutomationProperties.GetItemStatus(control));
  }

  private static string FindRepositoryRoot()
  {
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null)
    {
      if (
        File.Exists(Path.Combine(directory.FullName, "package.json")) &&
        Directory.Exists(Path.Combine(directory.FullName, "dotnet")))
      {
        return directory.FullName;
      }

      directory = directory.Parent;
    }

    throw new DirectoryNotFoundException(
      "Could not find the FsusUI repository root.");
  }
}
