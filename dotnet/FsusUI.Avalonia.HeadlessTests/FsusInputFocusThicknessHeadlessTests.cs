using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Templates;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.Themes.Fluent;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

// Regression coverage for Ozwasyd/FsusUI#656: focus styles bound BorderThickness to
// FsusThemeFocusThickness (x:Double), throwing InvalidCastException while the :focus
// class applied. The setters must resolve a typed Thickness resource instead.
public class FsusInputFocusThicknessHeadlessTests
{
  private const string FocusBorderThicknessKey = "FsusThemeFocusBorderThickness";

  public static IEnumerable<object[]> ThemeVariants()
  {
    yield return new object[] { nameof(FsusThemeVariant.Light), false, 2d };
    yield return new object[] { nameof(FsusThemeVariant.Dark), false, 2d };
    yield return new object[] { "HighContrast", true, 3d };
  }

  [AvaloniaTheory]
  [MemberData(nameof(ThemeVariants))]
  public void FocusedControlsResolveTypedFocusThicknessWithoutThrowing(
    string themeName,
    bool highContrast,
    double expectedThickness)
  {
    var input = new FsusInput { AccessibleName = $"{themeName} input" };
    var textarea = new FsusTextarea { AccessibleName = $"{themeName} textarea" };
    var inputNumber = new FsusInputNumber { AccessibleName = $"{themeName} number" };
    var textBox = new TextBox { PlaceholderText = $"{themeName} textbox" };
    var checkBox = new CheckBox { Content = $"{themeName} checkbox" };
    var radioButton = new RadioButton { Content = $"{themeName} radio" };
    var toggleSwitch = WithHeadlessSwitchTemplate(
      new ToggleSwitch { Content = $"{themeName} toggle" });
    var fsusCheckbox = new FsusCheckbox
    {
      AccessibleName = $"{themeName} Fsus checkbox",
      Content = $"{themeName} Fsus checkbox",
    };
    var fsusRadio = new FsusRadio
    {
      AccessibleName = $"{themeName} Fsus radio",
      Content = $"{themeName} Fsus radio",
    };
    var fsusSwitch = WithHeadlessSwitchTemplate(
      new FsusSwitch
      {
        AccessibleName = $"{themeName} Fsus switch",
        Content = $"{themeName} Fsus switch",
      });
    var scrollbar = new FsusScrollbar { AccessibleName = $"{themeName} scrollbar" };

    var window = CreateStyledWindow();
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = highContrast ? FsusThemeVariant.Dark : Enum.Parse<FsusThemeVariant>(themeName),
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });

    var panel = new StackPanel();
    foreach (var control in new Control[]
      {
        input,
        textarea,
        inputNumber,
        textBox,
        checkBox,
        radioButton,
        toggleSwitch,
        fsusCheckbox,
        fsusRadio,
        fsusSwitch,
        scrollbar,
      })
    {
      panel.Children.Add(control);
    }

    window.Content = panel;
    window.Show();

    // Real mounting plus real Focus(): a mis-typed BorderThickness resource escapes as
    // InvalidCastException here while the :focus class applies, mirroring how the
    // exception surfaced through FsusInput.OnPropertyChanged.
    foreach (var control in panel.Children)
    {
      Assert.True(control.Focus(), $"{control.GetType().Name} should take keyboard focus");
      Dispatcher.UIThread.RunJobs();
      Assert.True(control.IsFocused, $"{control.GetType().Name} should stay focused");
      Assert.Equal(
        new Thickness(expectedThickness),
        control.GetValue(TemplatedControl.BorderThicknessProperty));
    }

    window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRenderCapturesInputSelectionAndScrollbarFocusStates()
  {
    var repositoryRoot = FindRepositoryRoot();
    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      repositoryRoot,
      "issue-656-input-focus");

    var captures = new List<FocusRenderCapture>();
    foreach (var (themeName, highContrast, expectedThickness) in new[]
      {
        (ThemeName: "Light", HighContrast: false, ExpectedThickness: 2d),
        (ThemeName: "Dark", HighContrast: false, ExpectedThickness: 2d),
        (ThemeName: "HighContrast", HighContrast: true, ExpectedThickness: 3d),
      })
    {
      captures.Add(RenderFocusedControl(
        outputRoot,
        themeName,
        highContrast,
        expectedThickness,
        "input",
        () => new TextBox
        {
          Text = "FsusUI focus regression",
          PlaceholderText = $"{themeName} project name",
          CaretBrush = Brushes.Transparent,
        }));
      captures.Add(RenderFocusedControl(
        outputRoot,
        themeName,
        highContrast,
        expectedThickness,
        "selection",
        () => new FsusCheckbox
        {
          AccessibleName = $"{themeName} keep local changes",
          Content = "Keep local changes",
          IsChecked = true,
        }));
      captures.Add(RenderFocusedControl(
        outputRoot,
        themeName,
        highContrast,
        expectedThickness,
        "scrollbar",
        () => new FsusScrollbar
        {
          AccessibleName = $"{themeName} activity feed",
          Content = new TextBlock
          {
            Text = "Activity feed · keyboard-scrollable",
            TextWrapping = TextWrapping.Wrap,
          },
        }));
    }

    Assert.Equal(9, captures.Count);
    Assert.All(captures, capture =>
    {
      Assert.Equal(64, capture.Sha256.Length);
      Assert.True(capture.PixelSize.Width > 0);
      Assert.True(capture.PixelSize.Height > 0);
      Assert.True(File.Exists(
        HeadlessVisualEvidenceOutput.ResolveRecordedPath(repositoryRoot, capture.File)));
    });

    var manifestPath = Path.Combine(
      outputRoot,
      "issue-656-avalonia-focus-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          generatedBy =
            "FsusInputFocusThicknessHeadlessTests.RealHeadlessSkiaRenderCapturesInputSelectionAndScrollbarFocusStates",
          outputRoot = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, outputRoot),
          manifestPath = HeadlessVisualEvidenceOutput.RecordPath(repositoryRoot, manifestPath),
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
          },
          issue = 656,
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.True(File.Exists(manifestPath));
  }

  [Fact]
  public void ThemeManagerPaletteWritesTypedFocusThicknessAndKeepsLegacyDouble()
  {
    var variants = new[]
      {
        (Variant: FsusThemeVariant.Light, HighContrast: false, Expected: 2d),
        (Variant: FsusThemeVariant.Dark, HighContrast: false, Expected: 2d),
        (Variant: FsusThemeVariant.Dark, HighContrast: true, Expected: 3d),
      };

    foreach (var (variant, highContrast, expected) in variants)
    {
      var resources = new ResourceDictionary();

      new FsusThemeManager().Apply(
        resources,
        new FsusThemeOptions { Variant = variant, HighContrast = highContrast });

      Assert.IsType<double>(resources[FsusThemeResourceKeys.FocusThickness]);
      Assert.Equal(expected, resources[FsusThemeResourceKeys.FocusThickness]);
      Assert.Equal(new Thickness(expected), resources[FocusBorderThicknessKey]);
    }
  }

  [AvaloniaFact]
  public void ThemeDictionariesExposeTypedFocusBorderThicknessAliases()
  {
    var dictionaries = new[]
      {
        (Name: "FsusLight", Value: new Thickness(2)),
        (Name: "FsusDark", Value: new Thickness(2)),
        (Name: "FsusHighContrast", Value: new Thickness(3)),
      };

    foreach (var (name, expected) in dictionaries)
    {
      var include = new ResourceInclude(
        new Uri("avares://FsusUI.Avalonia.Themes"))
      {
        Source = new Uri($"avares://FsusUI.Avalonia.Themes/Themes/{name}.axaml"),
      };
      var window = CreateStyledWindow();
      window.Resources.MergedDictionaries.Add(include);
      window.Show();

      var dictionary = Assert.IsType<ResourceDictionary>(include.Loaded);
      Assert.Equal(expected, Assert.IsType<Thickness>(dictionary[FocusBorderThicknessKey]));
      Assert.IsType<double>(dictionary[FsusThemeResourceKeys.FocusThickness]);

      window.Close();
    }
  }

  // Mirrors the consumer composition from the demo App: FluentTheme followed by the
  // full FsusTheme styles+resources include inside one styling host, with variant
  // overrides applied through the same public FsusThemeManager API used by smoke tests.
  private static Window CreateStyledWindow()
  {
    var window = new Window
    {
      Width = 420,
      Height = 640,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private static FocusRenderCapture RenderFocusedControl(
    string outputRoot,
    string themeName,
    bool highContrast,
    double expectedThickness,
    string surface,
    Func<Control> createControl)
  {
    var control = createControl();
    control.Width = 420;
    control.MinHeight = 44;

    var window = CreateStyledWindow();
    window.Width = 520;
    window.Height = 180;
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = highContrast
          ? FsusThemeVariant.Dark
          : Enum.Parse<FsusThemeVariant>(themeName),
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
    var content = new StackPanel
    {
      Spacing = 12,
      Children =
      {
        new TextBlock
        {
          Text = $"{themeName} · {surface} focus · {expectedThickness:0} DIP",
          FontWeight = FontWeight.SemiBold,
          Foreground = Assert.IsAssignableFrom<IBrush>(
            window.Resources[FsusThemeResourceKeys.TextBrush]),
        },
        control,
        new TextBlock
        {
          Text = "Keyboard focus is rendered by the production FsusTheme styles.",
          TextWrapping = TextWrapping.Wrap,
          Foreground = Assert.IsAssignableFrom<IBrush>(
            window.Resources[FsusThemeResourceKeys.TextBrush]),
        },
      },
    };
    var surfaceRoot = new Border
    {
      Width = 520,
      Height = 180,
      Padding = new Thickness(24),
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = content,
    };
    window.Content = surfaceRoot;
    window.Show();
    Assert.True(control.Focus(), $"{control.GetType().Name} should take keyboard focus");
    Dispatcher.UIThread.RunJobs();
    Assert.True(control.IsFocused);
    Assert.Equal(
      new Thickness(expectedThickness),
      control.GetValue(TemplatedControl.BorderThicknessProperty));

    window.Measure(new Size(520, 180));
    window.Arrange(new Rect(0, 0, 520, 180));
    surfaceRoot.Measure(new Size(520, 180));
    surfaceRoot.Arrange(new Rect(0, 0, 520, 180));

    using var bitmap = new RenderTargetBitmap(new PixelSize(520, 180), new Vector(96, 96));
    bitmap.Render(surfaceRoot);
    var fileName =
      $"issue-656-focus-{themeName.ToLowerInvariant()}-{surface}.png";
    var outputPath = Path.Combine(outputRoot, fileName);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }
    window.Close();

    return new FocusRenderCapture(
      HeadlessVisualEvidenceOutput.RecordPath(FindRepositoryRoot(), outputPath),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
      new PixelDimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      themeName,
      surface,
      expectedThickness,
      control.GetType().Name,
      "keyboard");
  }

  private static T WithHeadlessSwitchTemplate<T>(T toggleSwitch)
    where T : ToggleSwitch
  {
    toggleSwitch.Template = new FuncControlTemplate<ToggleSwitch>(
      (_, nameScope) =>
      {
        var movingKnobs = new Canvas
        {
          Name = "PART_MovingKnobs",
          Width = 32,
          Height = 20,
        };
        nameScope.Register("PART_MovingKnobs", movingKnobs);
        return movingKnobs;
      });
    return toggleSwitch;
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

  private sealed record PixelDimension(int Width, int Height);

  private sealed record FocusRenderCapture(
    string File,
    string Sha256,
    PixelDimension PixelSize,
    string Theme,
    string Surface,
    double ThicknessDip,
    string Control,
    string InputMode);
}
