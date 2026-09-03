using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Layout;
using FsusUI.Avalonia.Controls;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusInfiniteScrollBehaviorTests
{
  [AvaloniaFact]
  public void ScrollingToBottomFiresLoadedOnce()
  {
    var content = new StackPanel
    {
      Orientation = Orientation.Vertical,
      Children =
      {
        new Border { Height = 500 },
        new Border { Height = 500 },
        new Border { Height = 500 },
      },
    };
    var scroll = new ScrollViewer
    {
      Content = content,
      Width = 200,
      Height = 150,
    };

    var fired = 0;
    var behavior = new FsusInfiniteScroll(
      scroll,
      () => fired++,
      distance: 0);

    var window = new Window
    {
      Width = 200,
      Height = 150,
      Content = scroll,
      ShowInTaskbar = false,
    };
    window.Show();
    window.Measure(new Size(200, 150));
    window.Arrange(new Rect(0, 0, 200, 150));

    behavior.Attach();

    // Not yet at the bottom -> should not fire.
    Assert.Equal(0, fired);
    Assert.Equal(0, behavior.FiredCount);

    // Scroll to the bottom.
    scroll.Offset = new Vector(0, scroll.Extent.Height - scroll.Viewport.Height);

    Assert.Equal(1, fired);
    Assert.Equal(1, behavior.FiredCount);
    window.Close();
  }
}
