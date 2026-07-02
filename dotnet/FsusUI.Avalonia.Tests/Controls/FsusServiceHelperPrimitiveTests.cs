using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusServiceHelperPrimitiveTests
{
  [Fact]
  public async Task MessageAndNotificationServicesGroupCloseAndDisposeCleanly()
  {
    var host = new FsusOverlayHost();
    var messages = new FsusMessageService(host);
    using var canceledSource = new CancellationTokenSource();
    canceledSource.Cancel();

    var canceled = await messages.ShowAsync(
      new FsusMessageOptions { Message = "Canceled", Type = FsusServiceType.Warning },
      canceledSource.Token);

    Assert.Null(canceled);
    Assert.Empty(messages.ActiveMessages);
    Assert.Empty(host.OpenOverlays);

    var first = await messages.ShowAsync(new FsusMessageOptions
    {
      Message = "Saved",
      Type = FsusServiceType.Success,
      GroupKey = "save",
      GroupSimilar = true,
      Duration = TimeSpan.FromSeconds(3),
    });
    var second = await messages.ShowAsync(new FsusMessageOptions
    {
      Message = "Saved again",
      Type = FsusServiceType.Success,
      GroupKey = "save",
      GroupSimilar = true,
    });

    Assert.NotNull(first);
    Assert.Same(first, second);
    Assert.Single(messages.ActiveMessages);
    Assert.Single(host.OpenOverlays);
    Assert.Equal(2, first!.Control.GroupCount);
    Assert.Contains("fsus-success", first.Control.Classes);
    Assert.Equal("Saved again", first.Control.Message);
    Assert.Equal("success grouped x2", AutomationProperties.GetItemStatus(first.Control));

    Assert.True(await first.CloseAsync());
    Assert.True(first.IsClosed);
    Assert.Empty(messages.ActiveMessages);
    Assert.Empty(host.OpenOverlays);
    Assert.Empty(host.Children);

    var notifications = new FsusNotificationService(host);
    var notification = await notifications.ShowAsync(new FsusNotificationOptions
    {
      Title = "Build complete",
      Message = "Artifacts are ready.",
      Type = FsusServiceType.Info,
      Placement = FsusServicePlacement.BottomRight,
      CloseOnClick = true,
    });

    Assert.NotNull(notification);
    Assert.Single(notifications.ActiveNotifications);
    Assert.Contains("fsus-placement-bottom-right", notification!.Control.Classes);
    Assert.Equal("Build complete", AutomationProperties.GetName(notification.Control));
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(notification.Control));

    Assert.True(await notification.CloseAsync());
    Assert.Empty(notifications.ActiveNotifications);
    Assert.Empty(host.OpenOverlays);
  }

  [Fact]
  public async Task LoadingServiceAttachesDetachesScopeAndHonorsCancellation()
  {
    var scope = new Border();
    var loading = new FsusLoadingService();
    using var canceledSource = new CancellationTokenSource();
    canceledSource.Cancel();

    var canceled = await loading.ShowAsync(
      scope,
      new FsusLoadingOptions { Text = "Canceled" },
      canceledSource.Token);

    Assert.Null(canceled);
    Assert.False(loading.IsScopeBusy(scope));

    var handle = await loading.ShowAsync(scope, new FsusLoadingOptions
    {
      Text = "Loading articles",
      ReducedMotion = true,
    });

    Assert.NotNull(handle);
    Assert.True(loading.IsScopeBusy(scope));
    Assert.Same(scope, handle!.Control.Scope);
    Assert.Contains("fsus-loading-overlay", handle.Control.Classes);
    Assert.Contains("fsus-motion-reduced", handle.Control.Classes);
    Assert.Equal("Loading articles", AutomationProperties.GetName(handle.Control));
    Assert.Equal(AutomationControlType.ProgressBar, AutomationProperties.GetControlTypeOverride(handle.Control));

    Assert.True(await handle.CloseAsync());
    Assert.True(handle.IsClosed);
    Assert.False(loading.IsScopeBusy(scope));

    var second = await loading.ShowAsync(scope, new FsusLoadingOptions { Text = "Reloading" });
    Assert.NotNull(second);
    Assert.True(await second!.DisposeAsync());
    Assert.False(loading.IsScopeBusy(scope));
    Assert.Empty(loading.ActiveScopes);
  }

  [Fact]
  public async Task AffixAndBacktopReactToScrollThresholdAndKeyboard()
  {
    var affixChanges = new List<bool>();
    var affix = new FsusAffix
    {
      Threshold = 64,
      Offset = 12,
      ScrollTarget = "article-scroll",
    };
    affix.AffixedChanged += (_, args) => affixChanges.Add(args.IsAffixed);

    affix.UpdateScroll(20);
    Assert.False(affix.IsAffixed);

    affix.UpdateScroll(80);
    Assert.True(affix.IsAffixed);
    Assert.Contains("fsus-affixed", affix.Classes);
    Assert.Equal(12, affix.CurrentOffset);
    Assert.Equal(new[] { true }, affixChanges);

    var requested = 0;
    var backtop = new KeyboardBacktop
    {
      VisibilityHeight = 100,
      ScrollTarget = "article-scroll",
    };
    backtop.BacktopRequested += (_, _) => requested++;

    backtop.UpdateScroll(120);

    Assert.True(backtop.IsVisible);
    Assert.Contains("fsus-visible", backtop.Classes);
    Assert.Equal(AutomationControlType.Button, AutomationProperties.GetControlTypeOverride(backtop));

    Assert.True(await backtop.PressAsync(Key.Enter));
    Assert.Equal(1, requested);
    Assert.Equal(0, backtop.ScrollOffset);
    Assert.False(backtop.IsVisible);
  }

  [Fact]
  public void ServiceHelperThemeVisualAndPerformanceBaselinesCoverStable26()
  {
    var services = ReadControlTheme("Services.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusMessageToast",
      "fsus|FsusNotification",
      "fsus|FsusLoadingOverlay",
      "fsus|FsusAffix",
      "fsus|FsusBacktop",
    })
    {
      Assert.Contains(selector, services);
    }

    Assert.Contains("FsusThemeLoadingBrush", services);
    Assert.Contains("FsusMotionDurationEffective", services);
    Assert.Contains("FsusDensityControlDefaultY", services);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Services.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("service-helper-stable26-web-avalonia", visualFixture);

    var performanceMeasurements = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "performance",
      "avalonia-measurements.json"));
    Assert.Contains("service-helper-stable26-repeated-show-close", performanceMeasurements);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"service-helper\"", performanceBudgets);
  }

  private sealed class KeyboardBacktop : FsusBacktop
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
