using Avalonia;
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusOverlayHostTests
{
  [Fact]
  public void OpenTracksNestedOverlayOrderAndModalStack()
  {
    var host = new FsusOverlayHost();
    var firstFocus = new Button { Content = "First" };
    var nestedFocus = new Button { Content = "Nested" };

    var first = host.Open(
      new Border(),
      new FsusOverlayOptions
      {
        IsModal = true,
        FocusScope = [firstFocus],
      });
    var nested = host.Open(
      new Border(),
      new FsusOverlayOptions
      {
        IsModal = true,
        FocusScope = [nestedFocus],
      });

    Assert.Equal(2, host.OpenOverlays.Count);
    Assert.Same(nested, host.Topmost);
    Assert.True(nested.ZIndex > first.ZIndex);
    Assert.Equal(new[] { first, nested }, host.ModalStack);
    Assert.Contains(first.Content, host.Children);
    Assert.Contains(nested.Content, host.Children);
  }

  [Fact]
  public void DialogSurfacesOpenThroughTheSharedHost()
  {
    var host = new FsusOverlayHost();
    var dialog = new FsusDialog { IsModal = true };

    var entry = host.OpenDialog(dialog);

    Assert.Same(dialog, entry.Content);
    Assert.True(entry.IsModal);
    Assert.Same(entry, host.Topmost);
    Assert.Contains(dialog, host.Children);
  }

  [Fact]
  public async Task ContainsFocusClosesWithKeyboardAndRestoresFocus()
  {
    var host = new FsusOverlayHost();
    var restoreTarget = new Button { Content = "Restore" };
    var primary = new Button { Content = "Primary" };
    var secondary = new Button { Content = "Secondary" };
    host.LastFocusedElement = restoreTarget;

    var entry = host.Open(
      new Border(),
      new FsusOverlayOptions
      {
        IsModal = true,
        CloseOnEscape = true,
        RestoreFocusTo = restoreTarget,
        FocusScope = [primary, secondary],
      });

    Assert.Same(primary, entry.FocusedElement);

    Assert.True(host.MoveFocus(FsusFocusNavigationDirection.Next));
    Assert.Same(secondary, entry.FocusedElement);
    Assert.True(host.MoveFocus(FsusFocusNavigationDirection.Next));
    Assert.Same(primary, entry.FocusedElement);

    Assert.True(await host.CloseTopAsync(
      FsusOverlayCloseReason.Keyboard,
      TestContext.Current.CancellationToken));
    Assert.True(entry.IsClosed);
    Assert.Same(restoreTarget, host.LastRestoredFocus);
    Assert.Empty(host.OpenOverlays);
  }

  [Fact]
  public async Task PointerDismissHonorsCancellationAndBoundaryFlipping()
  {
    var host = new FsusOverlayHost();
    var allowClose = false;
    var entry = host.Open(
      new Border(),
      new FsusOverlayOptions
      {
        CloseOnPointerOutside = true,
        AnchorBounds = new Rect(20, 92, 10, 6),
        OverlaySize = new Size(40, 30),
        ViewportBounds = new Rect(0, 0, 100, 100),
        Closing = _ => ValueTask.FromResult(allowClose),
      });

    Assert.Equal(FsusOverlayPlacement.TopStart, entry.Placement);

    Assert.False(await host.DismissPointerOutsideAsync(
      new Point(2, 2),
      TestContext.Current.CancellationToken));
    Assert.False(entry.IsClosed);
    Assert.Single(host.OpenOverlays);

    allowClose = true;

    Assert.False(await host.DismissPointerOutsideAsync(
      entry.Bounds.Center,
      TestContext.Current.CancellationToken));
    Assert.True(await host.DismissPointerOutsideAsync(
      new Point(2, 2),
      TestContext.Current.CancellationToken));
    Assert.True(entry.IsClosed);
    Assert.Empty(host.OpenOverlays);
  }

  [Fact]
  public void ClosedOverlaysAreNotRetainedByTheHost()
  {
    var host = new FsusOverlayHost();
    var weakReference = OpenAndCloseOverlay(host);

    for (var attempt = 0; attempt < 3 && weakReference.IsAlive; attempt++)
    {
      GC.Collect();
      GC.WaitForPendingFinalizers();
      GC.Collect();
    }

    Assert.False(weakReference.IsAlive);
    Assert.Empty(host.OpenOverlays);
    Assert.Empty(host.Children);
  }

  private static WeakReference OpenAndCloseOverlay(FsusOverlayHost host)
  {
    var content = new Border();
    var entry = host.Open(content);
    Assert.True(host.CloseAsync(entry).AsTask().GetAwaiter().GetResult());
    return new WeakReference(content);
  }
}
