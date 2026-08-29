using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusImageViewerHeadlessTests
{
  [AvaloniaFact]
  public async Task ImageViewerHeadlessRendersActiveSourceAndSwitchesIndexInMountedWindow()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();

    var viewer = new FsusImageViewer
    {
      AccessibleName = "Mounted gallery",
      Sources = { "source-1.png", "source-2.png" },
      ImageLoader = (src, _) => Task.FromResult<object?>(new Border
      {
        Width = 200,
        Height = 150,
        Child = new TextBlock { Text = $"content:{src}" },
      }),
    };

    var entry = viewer.Open(host);
    Assert.True(viewer.IsOpen);
    Assert.Single(host.OpenOverlays);

    Assert.True(await viewer.LoadActiveSourceAsync());
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    Assert.Contains("fsus-loaded", viewer.Classes);
    var border1 = Assert.IsType<Border>(viewer.Content);
    var text1 = Assert.IsType<TextBlock>(border1.Child);
    Assert.Equal("content:source-1.png", text1.Text);

    // Layout completes
    Assert.True(viewer.IsMeasureValid);
    Assert.True(viewer.IsArrangeValid);
    Assert.True(viewer.Bounds.Width > 0);
    Assert.True(viewer.Bounds.Height > 0);

    // Switch index
    Assert.True(await viewer.NextAsync());
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(1, viewer.ActiveIndex);
    Assert.Equal("source-2.png", viewer.ActiveSource);
    var border2 = Assert.IsType<Border>(viewer.Content);
    var text2 = Assert.IsType<TextBlock>(border2.Child);
    Assert.Equal("content:source-2.png", text2.Text);

    await viewer.CloseAsync();
    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerHeadlessExposesLoadingLoadedAndErrorThemeClasses()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();

    var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
    var viewer = new FsusImageViewer
    {
      AccessibleName = "State gallery",
      Sources = { "deferred.png" },
      ImageLoader = (_, _) => tcs.Task,
    };

    viewer.Open(host);
    var loadTask = viewer.LoadActiveSourceAsync();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Loading, viewer.Status);
    Assert.Contains("fsus-loading", viewer.Classes);
    Assert.DoesNotContain("fsus-loaded", viewer.Classes);
    Assert.DoesNotContain("fsus-error", viewer.Classes);

    tcs.SetResult(new TextBlock { Text = "resolved" });
    Assert.True(await loadTask);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Loaded, viewer.Status);
    Assert.Contains("fsus-loaded", viewer.Classes);
    Assert.DoesNotContain("fsus-loading", viewer.Classes);

    viewer.ImageLoader = (_, _) => throw new InvalidOperationException("Failed to decode vector asset.");
    Assert.False(await viewer.RefreshAsync());
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(FsusImageStatus.Error, viewer.Status);
    Assert.Contains("fsus-error", viewer.Classes);
    Assert.DoesNotContain("fsus-loaded", viewer.Classes);
    Assert.Equal("Failed to decode vector asset.", viewer.ErrorMessage);
    Assert.Null(viewer.Content);

    await viewer.CloseAsync();
    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerHeadlessCancelsStaleInFlightLoadsAndDisposesReplacedContent()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();

    var disposable1 = new DisposableControl("first");
    var disposable2 = new DisposableControl("second");
    var slowDisposable = new DisposableControl("slow-stale");

    var viewer = new FsusImageViewer
    {
      Sources = { "first.png", "second.png", "slow.png", "fast.png" },
      ImageLoader = (src, _) =>
      {
        return src switch
        {
          "first.png" => Task.FromResult<object?>(disposable1),
          "second.png" => Task.FromResult<object?>(disposable2),
          _ => Task.FromResult<object?>(null),
        };
      },
    };

    viewer.Open(host);
    Assert.True(await viewer.LoadActiveSourceAsync());
    Dispatcher.UIThread.RunJobs();
    Assert.False(disposable1.IsDisposed);

    // Change to index 1: disposable1 must be replaced and disposed
    viewer.ActiveIndex = 1;
    Assert.True(await viewer.CurrentLoadTask!);
    Dispatcher.UIThread.RunJobs();

    Assert.True(disposable1.IsDisposed);
    Assert.False(disposable2.IsDisposed);

    // Stale cancellation: slow load started, then rapidly switched to fast
    var slowStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
    var slowTcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
    CancellationToken observedToken = default;

    viewer.ImageLoader = (src, token) =>
    {
      if (src == "slow.png")
      {
        observedToken = token;
        slowStarted.SetResult(true);
        return slowTcs.Task;
      }

      return Task.FromResult<object?>(new TextBlock { Text = src });
    };

    viewer.ActiveIndex = 2; // slow
    await slowStarted.Task;
    Assert.False(observedToken.IsCancellationRequested);
    var slowTask = viewer.CurrentLoadTask;

    viewer.ActiveIndex = 3; // fast
    Assert.True(observedToken.IsCancellationRequested);
    Assert.True(await viewer.CurrentLoadTask!);
    Dispatcher.UIThread.RunJobs();

    Assert.True(disposable2.IsDisposed);
    var fastContent = Assert.IsType<TextBlock>(viewer.LoadedContent);
    Assert.Equal("fast.png", fastContent.Text);

    slowTcs.SetResult(slowDisposable);
    if (slowTask is not null)
    {
      await slowTask;
    }
    Dispatcher.UIThread.RunJobs();
    Assert.True(slowDisposable.IsDisposed);
    Assert.Same(fastContent, viewer.LoadedContent);

    await viewer.CloseAsync();
    viewer.Dispose();
    window.Close();
  }

  [AvaloniaFact]
  public async Task ImageViewerHeadlessKeyboardNavigationEscapeAndFocusRestoration()
  {
    var window = CreateStyledWindow();
    var host = new FsusOverlayHost();
    var triggerButton = new Button { Content = "Open Viewer" };
    var layout = new StackPanel { Children = { triggerButton, host } };
    window.Content = layout;
    window.Show();

    Assert.True(triggerButton.Focus());
    Dispatcher.UIThread.RunJobs();
    Assert.True(triggerButton.IsFocused);

    var viewer = new KeyboardImageViewer
    {
      AccessibleName = "Headless gallery",
      Sources = { "pic-1.png", "pic-2.png", "pic-3.png" },
      ImageLoader = (src, _) => Task.FromResult<object?>(new TextBlock { Text = src }),
    };

    viewer.Open(host, triggerButton);
    Assert.True(viewer.IsOpen);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal("Headless gallery", AutomationProperties.GetName(viewer));
    Assert.Equal(AutomationControlType.Image, AutomationProperties.GetControlTypeOverride(viewer));
    Assert.Equal("image 1 of 3", AutomationProperties.GetItemStatus(viewer));

    // Right key
    Assert.True(await viewer.PressAsync(Key.Right));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(1, viewer.ActiveIndex);
    Assert.Equal("pic-2.png", viewer.ActiveSource);
    Assert.Equal("image 2 of 3", AutomationProperties.GetItemStatus(viewer));

    // Left key
    Assert.True(await viewer.PressAsync(Key.Left));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(0, viewer.ActiveIndex);
    Assert.Equal("pic-1.png", viewer.ActiveSource);
    Assert.Equal("image 1 of 3", AutomationProperties.GetItemStatus(viewer));

    // Escape closes viewer and restores focus
    Assert.True(await viewer.PressAsync(Key.Escape));
    Dispatcher.UIThread.RunJobs();
    Assert.False(viewer.IsOpen);
    Assert.Empty(host.OpenOverlays);
    Assert.Same(triggerButton, host.LastRestoredFocus);

    window.Close();
  }

  private static Window CreateStyledWindow()
  {
    var window = new Window
    {
      Width = 600,
      Height = 400,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private sealed class DisposableControl(string name) : Control, IDisposable
  {
    public string NameTag { get; } = name;
    public bool IsDisposed { get; private set; }
    public void Dispose() => IsDisposed = true;
  }

  private sealed class KeyboardImageViewer : FsusImageViewer
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }
}
