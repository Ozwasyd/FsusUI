using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusDesktopShellPrimitiveTests
{
  [Fact]
  public void ActivityRailOwnsKeyedToggleResizeBoundsAndTypedEvents()
  {
    var activations = new List<FsusActivitySectionActivatedEventArgs>();
    var resizeEvents = new List<FsusContextualPaneResizedEventArgs>();
    var shell = new FsusActivityRailShell
    {
      MinPaneWidth = 220,
      MaxPaneWidth = 420,
      DefaultPaneWidth = 280,
      PaneWidth = 280,
    };
    shell.SectionActivated += (_, e) => activations.Add(e);
    shell.PaneResized += (_, e) => resizeEvents.Add(e);
    shell.Sections.Add(new FsusActivityRailSection
    {
      Key = "explorer",
      Header = "Explorer",
      Icon = "EX",
      Content = "Explorer pane",
    });
    shell.Sections.Add(new FsusActivityRailSection
    {
      Key = "search",
      Header = "Search",
      Icon = "SE",
      Content = "Search pane",
    });

    Assert.Equal(52d, shell.ActivityRailWidth);
    Assert.Equal("explorer", shell.SelectedKey);
    Assert.True(shell.IsPaneOpen);

    shell.ActivateKey("search", FsusActivityRailInteractionSource.Pointer);
    Assert.Equal("search", shell.SelectedKey);
    Assert.True(shell.IsPaneOpen);
    Assert.Equal(FsusActivityRailInteractionSource.Pointer, activations[^1].InteractionSource);

    shell.ActivateKey("search", FsusActivityRailInteractionSource.Keyboard);
    Assert.False(shell.IsPaneOpen);
    Assert.Equal(FsusActivityRailInteractionSource.Keyboard, activations[^1].InteractionSource);

    shell.ShowPane();
    Assert.True(shell.IsPaneOpen);
    Assert.Equal(220d, shell.ResizePane(80, FsusContextualPaneResizeReason.Pointer));
    Assert.Equal(420d, shell.ResizePane(800, FsusContextualPaneResizeReason.Keyboard));
    Assert.Equal(280d, shell.ResetPaneWidth());
    Assert.Equal(FsusContextualPaneResizeReason.Reset, resizeEvents[^1].Reason);
    Assert.True(resizeEvents[^1].IsCompleted);
    Assert.DoesNotContain("storage", AutomationProperties.GetItemStatus(shell), StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void NativeTitleBarExposesTypedSlotsPlatformAndNoDragContract()
  {
    var action = new Button { Content = "Save" };
    var titleBar = new FsusNativeTitleBar
    {
      DocumentTitle = "Architecture notes.md",
      DocumentPath = "/workspace/docs/architecture-notes.md",
      Status = "Saved",
      LeadingActions = "Workspace",
      TrailingActions = action,
      Platform = FsusDesktopPlatform.Windows,
    };
    FsusNativeTitleBar.SetIsNoDrag(action, true);

    Assert.Equal(FsusDesktopPlatform.Windows, titleBar.EffectivePlatform);
    Assert.True(FsusNativeTitleBar.GetIsNoDrag(action));
    Assert.Null(titleBar.AttachedWindow);
    Assert.False(titleBar.InvokeWindowAction(FsusNativeWindowAction.Minimize));
    Assert.Contains("Architecture notes.md", AutomationProperties.GetItemStatus(titleBar));
    Assert.Contains("windows", AutomationProperties.GetItemStatus(titleBar));
  }

}
