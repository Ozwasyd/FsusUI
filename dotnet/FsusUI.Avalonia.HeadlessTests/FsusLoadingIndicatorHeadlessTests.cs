using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Shapes;
using Avalonia.Automation.Peers;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusLoadingIndicatorHeadlessTests
{
  public static IEnumerable<object[]> ThemeVariants()
  {
    yield return new object[] { nameof(ThemeVariant.Light) };
    yield return new object[] { nameof(ThemeVariant.Dark) };
  }

  [AvaloniaTheory]
  [MemberData(nameof(ThemeVariants))]
  public void IndicatorActiveAndIdleStatesRenderWithoutButtonChrome(string themeName)
  {
    var window = CreateStyledWindow(themeName);
    var indicator = new FsusLoadingIndicator
    {
      IsActive = true,
      Width = 16,
      Height = 16,
    };
    var field = new FsusInput();
    var row = new StackPanel
    {
      Orientation = Orientation.Horizontal,
      Spacing = 8,
      Children = { field, indicator },
    };
    window.Content = row;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    Assert.Equal(16, indicator.Bounds.Width);
    Assert.Equal(16, indicator.Bounds.Height);
    Assert.True(indicator.IsVisible);
    Assert.Contains("fsus-loading-indicator", indicator.Classes);
    Assert.Contains("fsus-active", indicator.Classes);
    Assert.Contains("fsus-indeterminate", indicator.Classes);
    Assert.DoesNotContain("fsus-button", indicator.Classes);
    Assert.Equal("Loading", AutomationProperties.GetName(indicator));
    Assert.Equal(AutomationControlType.ProgressBar, AutomationProperties.GetControlTypeOverride(indicator));
    Assert.Equal("loading", AutomationProperties.GetItemStatus(indicator));

    indicator.IsActive = false;
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();
    Assert.False(indicator.IsVisible);
    Assert.Contains("fsus-idle", indicator.Classes);
    Assert.Equal("idle", AutomationProperties.GetItemStatus(indicator));

    window.Close();
  }

  [AvaloniaFact]
  public void IndicatorReflectsMotionModeAndThemeResources()
  {
    var window = CreateStyledWindow(nameof(ThemeVariant.Light), motionMode: "reduced");
    var indicator = new FsusLoadingIndicator
    {
      IsActive = true,
      ReducedMotion = false,
      AccessibleName = "Searching",
    };
    window.Content = indicator;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.Contains("fsus-motion-reduced", indicator.Classes);
    Assert.Equal("Searching", AutomationProperties.GetName(indicator));

    var motionMode = Assert.IsType<string>(
      Application.Current!.Resources[FsusThemeResourceKeys.MotionModeCurrent]);
    Assert.Equal("reduced", motionMode);
    window.Close();
  }

  [AvaloniaTheory]
  [MemberData(nameof(ThemeVariants))]
  public void IndicatorDashLengthTracksIndeterminateAndDeterminateValues(string themeName)
  {
    var window = CreateStyledWindow(themeName);
    var indicator = new FsusLoadingIndicator { IsActive = true };
    window.Content = indicator;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    var arc = RequireArc(indicator);
    Assert.True(arc.StrokeThickness > 0);
    var indeterminateDash = ReadDash(arc);
    Assert.True(indeterminateDash > 0);

    indicator.IsIndeterminate = false;
    indicator.Value = 0.5;
    window.UpdateLayout();
    var halfDash = ReadDash(arc);

    indicator.Value = 1;
    window.UpdateLayout();
    var fullDash = ReadDash(arc);

    Assert.True(fullDash > halfDash + 0.5);
    Assert.Contains("fsus-determinate", indicator.Classes);

    window.Close();
  }

  private static double ReadDash(Shape arc) => arc.StrokeDashArray?[0] ?? 0d;

  private static Ellipse RequireArc(FsusLoadingIndicator indicator)
  {
    var arc = indicator
      .GetVisualDescendants()
      .OfType<Ellipse>()
      .SingleOrDefault(candidate => candidate.Name == "PART_Arc");
    return Assert.IsType<Ellipse>(arc);
  }

  private static Window CreateStyledWindow(string themeName, string? motionMode = null)
  {
    var window = new Window
    {
      Width = 320,
      Height = 200,
      ShowInTaskbar = false,
      RequestedThemeVariant = themeName == nameof(ThemeVariant.Dark)
        ? ThemeVariant.Dark
        : ThemeVariant.Light,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    if (motionMode is not null)
    {
      Application.Current!.Resources[FsusThemeResourceKeys.MotionModeCurrent] = motionMode;
    }
    return window;
  }
}
