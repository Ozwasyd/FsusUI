using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.Themes.Fluent;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

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
}
