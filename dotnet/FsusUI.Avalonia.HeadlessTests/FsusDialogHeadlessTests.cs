using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Input.Raw;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.Themes.Fluent;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusDialogHeadlessTests
{
  [AvaloniaFact]
  public void DialogTemplateRendersSemanticSlotsFromPublicProperties()
  {
    var body = new TextBlock { Text = "Preference body" };
    var footer = new StackPanel { Children = { new FsusButton { Content = "Save" } } };
    var dialog = new FsusDialog
    {
      Width = 420,
      Title = "Preferences",
      BodyContent = body,
      FooterContent = footer,
      ConfirmContent = new FsusButton { Content = "Confirm" },
      CancelContent = new FsusButton { Content = "Cancel" },
    };

    var window = CreateStyledWindow();
    window.Content = dialog;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    var header = RequirePart<ContentPresenter>(dialog, "PART_HeaderPresenter");
    var bodyPresenter = RequirePart<ContentPresenter>(dialog, "PART_BodyPresenter");
    var footerPresenter = RequirePart<ContentPresenter>(dialog, "PART_FooterPresenter");
    var confirmPresenter = RequirePart<ContentPresenter>(dialog, "PART_ConfirmPresenter");
    var cancelPresenter = RequirePart<ContentPresenter>(dialog, "PART_CancelPresenter");

    Assert.Equal("Preferences", header.Content);
    Assert.True(header.IsVisible);
    Assert.Same(body, bodyPresenter.Content);
    Assert.True(bodyPresenter.IsVisible);
    Assert.Same(footer, footerPresenter.Content);
    Assert.True(footerPresenter.IsVisible);
    Assert.True(confirmPresenter.IsVisible);
    Assert.True(cancelPresenter.IsVisible);
    Assert.Null(dialog.Find<ScrollViewer>("PART_BodyScrollViewer"));

    dialog.Title = null;
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
    Assert.False(header.IsVisible);
    Assert.True(bodyPresenter.IsVisible);

    window.Close();
  }

  [AvaloniaFact]
  public async Task ModalDialogOpensCenteredWithScrimAndEscapeClosesEligibleOverlay()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    var restoreTarget = new Button { Content = "Restore" };
    var root = new Panel();
    root.Children.Add(restoreTarget);
    root.Children.Add(host);
    window.Content = root;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();
    var viewport = new Rect(0, 0, host.Bounds.Width, host.Bounds.Height);

    var confirm = new FsusButton { Content = "Confirm" };
    var cancel = new FsusButton { Content = "Cancel" };
    var dialog = new FsusDialog
    {
      Width = 320,
      Height = 180,
      Title = "Delete file",
      BodyContent = new TextBlock { Text = "This cannot be undone." },
      FooterContent = new StackPanel
      {
        Orientation = Orientation.Horizontal,
        Children = { confirm, cancel },
      },
    };
    dialog.FocusScope.Add(confirm);
    dialog.FocusScope.Add(cancel);

    var closedReasons = new List<FsusModalCloseReason>();
    dialog.Closed += (_, e) => closedReasons.Add(e.Reason);

    var entry = host.OpenDialog(
      dialog,
      new FsusOverlayOptions
      {
        OverlaySize = new Size(320, 180),
        ViewportBounds = viewport,
        RestoreFocusTo = restoreTarget,
      });
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusOverlayPlacement.Center, entry.Placement);
    Assert.True(entry.IsModal);
    var scrim = Assert.IsType<Border>(Assert.Single(
      host.Children.OfType<Border>(),
      child => child.Classes.Contains("fsus-overlay")));
    Assert.True(scrim.IsVisible);
    Assert.Contains(dialog, host.Children);

    var hostWidth = host.Bounds.Width;
    var hostHeight = host.Bounds.Height;
    var center = dialog.Bounds.Center;
    Assert.InRange(center.X, hostWidth / 2 - 1, hostWidth / 2 + 1);
    Assert.InRange(center.Y, hostHeight / 2 - 1, hostHeight / 2 + 1);

    Assert.True(confirm.IsFocused);
    Assert.False(restoreTarget.IsFocused);

    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Dispatcher.UIThread.RunJobs();

    Assert.True(entry.IsClosed);
    Assert.Empty(host.OpenOverlays);
    Assert.Empty(host.Children);
    Assert.Equal([FsusModalCloseReason.Keyboard], closedReasons);
    Assert.True(restoreTarget.IsFocused);

    window.Close();
  }

  [AvaloniaFact]
  public void EscapeRespectsClosePolicyCloseOnEscapeAndBeforeClose()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var blockedDialog = new FsusDialog
    {
      Width = 280,
      Height = 160,
      Title = "Blocked",
      ClosePolicy = FsusModalClosePolicy.ExplicitOnly,
    };
    var blockedEntry = host.OpenDialog(
      blockedDialog,
      new FsusOverlayOptions { ViewportBounds = new Rect(0, 0, 600, 480) });
    Dispatcher.UIThread.RunJobs();
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Dispatcher.UIThread.RunJobs();
    Assert.False(blockedEntry.IsClosed);
    host.CloseAsync(blockedEntry).AsTask().GetAwaiter().GetResult();

    var noEscapeDialog = new FsusDialog
    {
      Width = 280,
      Height = 160,
      Title = "No escape",
      CloseOnEscape = false,
    };
    var noEscapeEntry = host.OpenDialog(
      noEscapeDialog,
      new FsusOverlayOptions { ViewportBounds = new Rect(0, 0, 600, 480) });
    Dispatcher.UIThread.RunJobs();
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Dispatcher.UIThread.RunJobs();
    Assert.False(noEscapeEntry.IsClosed);
    host.CloseAsync(noEscapeEntry).AsTask().GetAwaiter().GetResult();

    var vetoedDialog = new FsusDialog
    {
      Width = 280,
      Height = 160,
      Title = "Vetoed",
      BeforeClose = request =>
        ValueTask.FromResult(request.Reason == FsusModalCloseReason.Programmatic),
    };
    var vetoedEntry = host.OpenDialog(
      vetoedDialog,
      new FsusOverlayOptions { ViewportBounds = new Rect(0, 0, 600, 480) });
    Dispatcher.UIThread.RunJobs();
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Dispatcher.UIThread.RunJobs();
    Assert.False(vetoedEntry.IsClosed);
    host.CloseAsync(vetoedEntry).AsTask().GetAwaiter().GetResult();

    var allowedDialog = new FsusDialog
    {
      Width = 280,
      Height = 160,
      Title = "Allowed",
      BeforeClose = _ => ValueTask.FromResult(true),
    };
    var allowedEntry = host.OpenDialog(
      allowedDialog,
      new FsusOverlayOptions { ViewportBounds = new Rect(0, 0, 600, 480) });
    Dispatcher.UIThread.RunJobs();
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Dispatcher.UIThread.RunJobs();
    Assert.True(allowedEntry.IsClosed);

    window.Close();
  }

  [AvaloniaFact]
  public void PointerPressOutsideTopmostClosesAndInsideKeepsOpen()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.UpdateLayout();

    var dialog = new FsusDialog
    {
      Width = 300,
      Height = 200,
      Title = "Pointer outside",
    };
    var entry = host.OpenDialog(
      dialog,
      new FsusOverlayOptions
      {
        OverlaySize = new Size(300, 200),
        ViewportBounds = new Rect(0, 0, (int)host.Bounds.Width, (int)host.Bounds.Height),
      });
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();

    PressAt(host, window, new Point(8, 8));
    Dispatcher.UIThread.RunJobs();
    Assert.True(entry.IsClosed);

    var second = host.OpenDialog(
      new FsusDialog
      {
        Width = 300,
        Height = 200,
        Title = "Pointer inside",
      },
      new FsusOverlayOptions
      {
        OverlaySize = new Size(300, 200),
        ViewportBounds = new Rect(0, 0, (int)host.Bounds.Width, (int)host.Bounds.Height),
      });
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();

    PressAt(
      host,
      window,
      new Point(host.Bounds.Width / 2, host.Bounds.Height / 2));
    Dispatcher.UIThread.RunJobs();
    Assert.False(second.IsClosed);
    Assert.Single(host.OpenOverlays);

    window.Close();
  }

  private static void PressAt(FsusOverlayHost host, Window window, Point position)
  {
    var pointer = new Pointer(Pointer.GetNextFreeId(), PointerType.Mouse, true);
    var args = new PointerPressedEventArgs(
      host,
      pointer,
      window,
      position,
      0UL,
      new PointerPointProperties(RawInputModifiers.LeftMouseButton, PointerUpdateKind.LeftButtonPressed),
      KeyModifiers.None);
    host.RaiseEvent(args);
  }

  private static Window CreateStyledWindow()
  {
    var window = new Window
    {
      Width = 600,
      Height = 480,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private static T RequirePart<T>(Control control, string name)
    where T : Control
  {
    var part = control
      .GetVisualDescendants()
      .OfType<T>()
      .SingleOrDefault(candidate => candidate.Name == name);
    return Assert.IsType<T>(part);
  }
}
