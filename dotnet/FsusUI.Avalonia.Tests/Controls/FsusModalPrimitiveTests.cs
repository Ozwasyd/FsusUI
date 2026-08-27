using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusModalPrimitiveTests
{
  [Fact]
  public async Task DialogOpensThroughOverlayHostAndHonorsAsyncCloseGuard()
  {
    var host = new FsusOverlayHost();
    var restoreTarget = new Button { Content = "Open dialog" };
    var confirm = new Button { Content = "Confirm" };
    var cancel = new Button { Content = "Cancel" };
    var guardReasons = new List<FsusModalCloseReason>();
    var allowClose = false;
    var dialog = new KeyboardDialog
    {
      Title = "Delete article",
      BodyContent = "This action cannot be undone.",
      FooterContent = "Dialog footer",
      ConfirmContent = "Delete",
      CancelContent = "Keep draft",
      IsDangerous = true,
      IsLoading = true,
      CloseOnPointerOutside = false,
      RestoreFocusTo = restoreTarget,
      BeforeClose = (request) =>
      {
        guardReasons.Add(request.Reason);
        return ValueTask.FromResult(allowClose);
      },
    };
    dialog.FocusScope.Add(confirm);
    dialog.FocusScope.Add(cancel);

    var opened = dialog.Open(host);

    Assert.Same(opened, host.Topmost);
    Assert.Same(dialog, opened.Content);
    Assert.True(dialog.IsOpen);
    Assert.Equal(FsusPanelMotionState.Open, dialog.MotionState);
    Assert.True(opened.IsModal);
    Assert.False(opened.Options.CloseOnPointerOutside);
    Assert.Same(confirm, opened.FocusedElement);
    Assert.Contains("fsus-dangerous", dialog.Classes);
    Assert.Contains("fsus-loading", dialog.Classes);
    Assert.Equal("Delete article", AutomationProperties.GetName(dialog));
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(dialog));
    Assert.Equal("Dialog", AutomationProperties.GetClassNameOverride(dialog));
    Assert.Equal("modal open dangerous loading", AutomationProperties.GetItemStatus(dialog));

    Assert.False(await dialog.CancelAsync());
    Assert.True(dialog.IsOpen);
    Assert.Equal(new[] { FsusModalCloseReason.Cancel }, guardReasons);

    Assert.True(host.MoveFocus(FsusFocusNavigationDirection.Next));
    Assert.Same(cancel, opened.FocusedElement);

    allowClose = true;

    Assert.True(await dialog.PressAsync(Key.Escape));
    Assert.False(dialog.IsOpen);
    Assert.Equal(FsusPanelMotionState.Hidden, dialog.MotionState);
    Assert.Same(restoreTarget, host.LastRestoredFocus);
    Assert.Empty(host.OpenOverlays);
    Assert.Equal(new[] { FsusModalCloseReason.Cancel, FsusModalCloseReason.Keyboard }, guardReasons);
  }

  [Fact]
  public async Task DrawerUsesSharedHostPanelMotionAndClosePolicies()
  {
    var host = new FsusOverlayHost();
    var closeEvents = new List<FsusModalCloseReason>();
    var drawer = new FsusDrawer
    {
      Title = "Filters",
      BodyContent = "Narrow the result set",
      Placement = FsusDrawerPlacement.Right,
      ClosePolicy = FsusModalClosePolicy.ExplicitOnly,
      CloseOnEscape = false,
    };
    drawer.Closed += (_, args) => closeEvents.Add(args.Reason);

    var entry = host.OpenDrawer(drawer);

    Assert.Same(drawer, entry.Content);
    Assert.Same(entry, drawer.OverlayEntry);
    Assert.True(drawer.IsOpen);
    Assert.Equal(FsusPanelMotionState.Open, drawer.MotionState);
    Assert.False(entry.Options.CloseOnEscape);
    Assert.False(entry.Options.CloseOnPointerOutside);
    Assert.Contains("fsus-drawer-right", drawer.Classes);
    Assert.Equal("Filters", AutomationProperties.GetName(drawer));
    Assert.Equal(AutomationControlType.Pane, AutomationProperties.GetControlTypeOverride(drawer));

    Assert.False(await host.DismissPointerOutsideAsync(new Point(-1, -1)));
    Assert.True(drawer.IsOpen);

    Assert.True(await drawer.RequestCloseAsync(FsusModalCloseReason.Cancel));
    Assert.False(drawer.IsOpen);
    Assert.Empty(host.OpenOverlays);
    Assert.Equal(new[] { FsusModalCloseReason.Cancel }, closeEvents);
  }

  [Fact]
  public async Task MessageBoxServiceReturnsDeterministicCancellationAwareResults()
  {
    var host = new FsusOverlayHost();
    var service = new FsusMessageBoxService(host);
    using var canceledSource = new CancellationTokenSource();
    canceledSource.Cancel();

    var dangerous = service.Show(new FsusMessageBoxOptions
    {
      Title = "Delete permanently?",
      Message = "The article cannot be restored.",
      IsDangerous = true,
      ConfirmText = "Delete",
      CancelText = "Cancel",
    });

    Assert.Same(dangerous, host.Topmost?.Content);
    Assert.True(dangerous.IsOpen);
    Assert.Contains("fsus-dangerous", dangerous.Classes);
    Assert.Equal(FsusMessageBoxResult.None, await dangerous.ConfirmAsync(canceledSource.Token));
    Assert.True(dangerous.IsOpen);

    Assert.Equal(FsusMessageBoxResult.Confirm, await dangerous.ConfirmAsync());
    Assert.False(dangerous.IsOpen);
    Assert.Equal(FsusMessageBoxResult.Confirm, dangerous.Result);
    Assert.Empty(host.OpenOverlays);

    var cancel = service.Show(new FsusMessageBoxOptions { Title = "Cancel publish?", Message = "Discard changes." });

    Assert.Equal(FsusMessageBoxResult.Cancel, await cancel.CancelAsync());
    Assert.Equal(FsusMessageBoxResult.Cancel, cancel.Result);

    var keyboard = service.Show(new FsusMessageBoxOptions { Title = "Close with keyboard", Message = "Escape closes." });

    Assert.True(await host.DismissKeyboardAsync());
    Assert.Equal(FsusMessageBoxResult.Closed, keyboard.Result);
    Assert.False(keyboard.IsOpen);
  }

  [Fact]
  public void ModalThemeVisualAndAutomationBaselinesCoverStable24()
  {
    var card = ReadControlTheme("Card.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusDialog",
      "fsus|FsusDrawer",
      "fsus|FsusMessageBox",
    })
    {
      Assert.Contains(selector, card);
    }

    Assert.Contains("FsusComponentOverlayScrimBrush", card);
    Assert.Contains("FsusMotionDurationEffective", card);
    Assert.Contains("FsusZOverlayDialog", card);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("modal-panel-stable24-web-avalonia", visualFixture);

    var automation = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("dialog-stable24", automation);
    Assert.Contains("drawer-stable24", automation);
    Assert.Contains("message-box-stable24", automation);

    var accessibilityContracts = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "contracts.json"));
    Assert.Contains("\"id\": \"drawer\"", accessibilityContracts);
    Assert.Contains("\"id\": \"message-box\"", accessibilityContracts);
  }

  [Fact]
  public async Task DialogScrollableBodySupportsViewportConstraintAndKeyScrolling()
  {
    var dialog = new KeyboardDialog
    {
      Title = "Form Dialog",
      Content = "Fallback body text",
      ConfirmContent = "Save",
      CancelContent = "Cancel",
    };

    Assert.False(dialog.IsBodyScrollable);
    Assert.Equal(double.PositiveInfinity, dialog.MaxBodyHeight);
    Assert.True(double.IsNaN(dialog.ViewportHeightConstraint));
    Assert.Equal("Fallback body text", dialog.EffectiveBodyContent);
    Assert.NotNull(dialog.EffectiveFooterContent);
    Assert.DoesNotContain("scrollable", AutomationProperties.GetItemStatus(dialog));
    Assert.DoesNotContain("fsus-scrollable-body", dialog.Classes);

    dialog.IsBodyScrollable = true;
    dialog.ViewportHeightConstraint = 480;
    dialog.MaxBodyHeight = 240;

    Assert.True(dialog.IsBodyScrollable);
    Assert.Equal(240, dialog.MaxBodyHeight);
    Assert.Equal(480, dialog.ViewportHeightConstraint);
    Assert.Equal(480, dialog.ResolveMaxViewportHeight());
    Assert.Contains("fsus-scrollable-body", dialog.Classes);
    Assert.Contains("scrollable", AutomationProperties.GetItemStatus(dialog));

    dialog.Measure(new Size(500, double.PositiveInfinity));
    Assert.True(dialog.DesiredSize.Height <= 480);

    // Keyboard PageDown/PageUp handling
    Assert.True(await dialog.PressAsync(Key.PageDown));
    Assert.True(await dialog.PressAsync(Key.PageUp));
  }

  private sealed class KeyboardDialog : FsusDialog
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
