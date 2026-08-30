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
  public void DocumentTabsCancelClosePreserveDirtyStateReorderAndSelectAdjacentFallback()
  {
    var tabs = CreateDocumentTabs();
    var closeReasons = new List<FsusDocumentTabCloseReason>();
    var reorderEvents = new List<FsusDocumentTabReorderedEventArgs>();
    tabs.CloseRequested += (_, e) =>
    {
      closeReasons.Add(e.Reason);
      e.Cancel = e.Key == "draft";
    };
    tabs.Reordered += (_, e) => reorderEvents.Add(e);

    tabs.SelectKey("draft");
    Assert.Contains("unsaved changes", AutomationProperties.GetItemStatus(tabs.Documents[1]));
    Assert.False(tabs.RequestClose("draft", FsusDocumentTabCloseReason.CloseButton));
    Assert.Contains(tabs.Documents, (document) => document.Key == "draft");

    Assert.True(tabs.ReorderDocument("notes", 0, FsusDocumentTabReorderSource.Pointer));
    Assert.Equal("notes", tabs.Documents[0].Key);
    Assert.Equal(2, reorderEvents[0].OldIndex);
    Assert.Equal(0, reorderEvents[0].NewIndex);
    Assert.Equal(FsusDocumentTabReorderSource.Pointer, reorderEvents[0].Source);

    tabs.SelectKey("readme");
    Assert.True(tabs.RequestClose("readme", FsusDocumentTabCloseReason.MiddleClick));
    Assert.Equal("draft", tabs.SelectedKey);
    Assert.Equal(FsusDocumentTabCloseReason.MiddleClick, closeReasons[^1]);

    Assert.True(tabs.CycleDocuments());
    Assert.Equal("notes", tabs.SelectedKey);
    Assert.True(tabs.CycleDocuments(reverse: true));
    Assert.Equal("draft", tabs.SelectedKey);
  }

  [Fact]
  public void DocumentContextRequestReturnsTypedStableAnchorWithoutSelectingTarget()
  {
    var tabs = CreateDocumentTabs();
    FsusDocumentTabContextRequestedEventArgs? request = null;
    tabs.DocumentContextRequested += (_, e) => request = e;
    tabs.SelectKey("readme");
    tabs.Measure(new Size(640, 300));
    tabs.Arrange(new Rect(0, 0, 640, 300));

    Assert.True(tabs.RequestDocumentContext("notes", FsusTreeInteractionSource.Keyboard));
    Assert.NotNull(request);
    Assert.Equal("notes", request!.Key);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, request.InteractionSource);
    Assert.Same(tabs.Documents.Single((document) => document.Key == "notes"), request.Anchor);
    Assert.Equal("readme", tabs.SelectedKey);
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

  private static FsusDocumentTabs CreateDocumentTabs()
  {
    var tabs = new FsusDocumentTabs { AccessibleName = "Open documents" };
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "readme",
      Header = "README.md",
      Content = "README",
    });
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "draft",
      Header = "Release draft.md",
      IsDirty = true,
      Content = "Draft",
    });
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "notes",
      Header = "Architecture notes.md",
      Content = "Notes",
    });
    return tabs;
  }
}
