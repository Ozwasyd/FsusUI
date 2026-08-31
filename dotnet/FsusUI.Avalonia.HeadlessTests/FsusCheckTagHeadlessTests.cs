using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusCheckTagHeadlessTests
{
  [AvaloniaFact]
  public void KeyboardFocusAppliesOverlayRingWithoutChangingControlBounds()
  {
    var checkTag = new FsusCheckTag { Content = "Check tag" };
    var window = new Window { Content = checkTag, Width = 320, Height = 160 };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Show();
    window.UpdateLayout();
    var before = checkTag.Bounds.Size;

    Assert.True(checkTag.Focus(NavigationMethod.Tab));
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    var focusRing = Assert.Single(
      checkTag.GetVisualDescendants().OfType<Border>(),
      border => border.Name == "PART_FocusRing");
    Assert.Equal(new Thickness(2), focusRing.BorderThickness);
    Assert.True(window.TryFindResource("FsusThemeFocusBrush", out var focusBrush));
    Assert.Equal(focusBrush, focusRing.BorderBrush);
    Assert.Null(checkTag.FocusAdorner);
    Assert.Equal(before, checkTag.Bounds.Size);
    window.Close();
  }
}
