using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusContextMenuPrimitiveTests
{
  [Fact]
  public async Task AttachedGenericTargetOpensMenuChoosesTypedActionAndRestoresInvokerFocus()
  {
    var host = new FsusOverlayHost();
    var target = new Button { Content = "Doc surface" };
    var menu = new FsusContextMenu { AccessibleName = "Document actions" };
    menu.Items.Add(new FsusContextMenuSeparator());
    menu.Items.Add(new FsusContextMenuItem { Key = "rename", Header = "Rename" });
    menu.Items.Add(new FsusContextMenuItem { Key = "delete", Header = "Delete", IsDangerous = true });
    FsusContextMenuService.Attach(target, menu, host);

    Assert.True(FsusContextMenuService.Request(
      target,
      FsusTreeInteractionSource.Pointer,
      new Rect(10, 12, 40, 20)));

    Assert.True(menu.IsOpen);
    Assert.Contains("fsus-open", menu.Classes);
    Assert.Same(menu, Assert.Single(host.OpenOverlays).Content);
    Assert.Equal(FsusOverlayPlacement.BottomStart, menu.EffectivePlacement);
    Assert.Equal("rename", menu.FocusedKey);
    Assert.Contains("fsus-focused", FindItem(menu, "rename").Classes);
    Assert.Equal("open menu", AutomationProperties.GetItemStatus(menu));
    Assert.Equal(AutomationControlType.Menu,
      AutomationProperties.GetControlTypeOverride(menu));

    Assert.True(await menu.HandleKeyAsync(Key.Down));
    Assert.Equal("delete", menu.FocusedKey);
    Assert.Contains("fsus-focused", FindItem(menu, "delete").Classes);
    Assert.DoesNotContain("fsus-focused", FindItem(menu, "rename").Classes);
    Assert.Contains("fsus-dangerous", FindItem(menu, "delete").Classes);

    var actions = new List<FsusContextMenuItemActivatedEventArgs>();
    menu.ItemActivated += (_, args) => actions.Add(args);

    Assert.True(await menu.ChooseFocusedAsync());
    var action = Assert.Single(actions);
    Assert.Equal(string.Empty, action.TargetKey);
    Assert.Equal("delete", action.ActionKey);
    Assert.Equal("delete", menu.SelectedActionKey);
    Assert.False(menu.IsOpen);
    Assert.Empty(host.OpenOverlays);
    Assert.DoesNotContain("fsus-open", menu.Classes);
    Assert.Same(target, host.LastRestoredFocus);

    Assert.False(await menu.ChooseAsync("missing"));
    FsusContextMenuService.Detach(target);
    Assert.False(FsusContextMenuService.Request(
      target,
      FsusTreeInteractionSource.Pointer,
      new Rect(0, 0, 1, 1)));
  }

  [Fact]
  public async Task MenuKeyboardWalkSkipsDisabledSeparatorsClosesOnEscapeOutsideAndFlipsPlacement()
  {
    var host = new FsusOverlayHost();
    var menu = new FsusContextMenu
    {
      OverlaySize = new Size(40, 30),
      ViewportBounds = new Rect(0, 0, 100, 100),
    };
    menu.Items.Add(new FsusContextMenuItem { Key = "locked", Header = "Locked", IsEnabled = false });
    menu.Items.Add(new FsusContextMenuSeparator());
    menu.Items.Add(new FsusContextMenuItem { Key = "first", Header = "First", Accelerator = "Ctrl+F" });
    menu.Items.Add(new FsusContextMenuItem { Key = "second", Header = "Second" });

    var entry = menu.Open(host, new FsusContextMenuRequest(
      "doc-7",
      FsusTreeInteractionSource.Keyboard,
      new Rect(70, 92, 10, 6),
      null));

    Assert.Equal(FsusOverlayPlacement.TopStart, entry.Placement);
    Assert.Equal(FsusOverlayPlacement.TopStart, menu.EffectivePlacement);
    Assert.Equal(new Rect(60, 62, 40, 30), entry.Bounds);
    Assert.Equal("first", menu.FocusedKey);
    Assert.Contains(
      FindItem(menu, "first"),
      menu.Items.Where((item) => item is FsusContextMenuItem { IsEnabled: true }));

    Assert.True(await menu.HandleKeyAsync(Key.Down));
    Assert.Equal("second", menu.FocusedKey);
    Assert.True(await menu.HandleKeyAsync(Key.Down));
    Assert.Equal("first", menu.FocusedKey);
    Assert.False(await menu.HandleKeyAsync(Key.F));
    Assert.True(menu.IsOpen);
    Assert.False(await menu.ChooseAsync("locked"));
    Assert.True(menu.IsOpen);
    Assert.Equal("first", menu.FocusedKey);

    Assert.True(await menu.HandleKeyAsync(Key.Enter));
    Assert.False(menu.IsOpen);
    Assert.Empty(host.OpenOverlays);

    var reopened = menu.Open(host, new FsusContextMenuRequest(
      "doc-7",
      FsusTreeInteractionSource.Keyboard,
      new Rect(0, 0, 10, 6)));
    Assert.True(reopened.IsModal is false);
    Assert.True(await host.DismissKeyboardAsync(CancellationToken.None));
    Assert.False(menu.IsOpen);

    menu.Open(host, new FsusContextMenuRequest(
      "doc-7",
      FsusTreeInteractionSource.Pointer,
      new Rect(0, 0, 10, 6)));
    Assert.True(await host.DismissPointerOutsideAsync(
      new Point(500, 500),
      CancellationToken.None));
    Assert.False(menu.IsOpen);
  }

  [Fact]
  public async Task ServiceGuardsDisableTargetDetachesAndRepositionsSingleOpenEntry()
  {
    var host = new FsusOverlayHost();
    var target = new Button { Content = "Panel", IsEnabled = false };
    var menu = new FsusContextMenu();
    menu.Items.Add(new FsusContextMenuItem { Key = "refresh", Header = "Refresh" });
    FsusContextMenuService.Attach(target, menu, host);

    Assert.False(FsusContextMenuService.Request(
      target,
      FsusTreeInteractionSource.Keyboard,
      new Rect(0, 0, 4, 4)));
    Assert.Empty(host.OpenOverlays);

    target.IsEnabled = true;
    Assert.True(FsusContextMenuService.Request(
      target,
      FsusTreeInteractionSource.Keyboard,
      new Rect(0, 0, 4, 4)));
    var current = menu.OverlayEntry;

    Assert.True(FsusContextMenuService.Request(
      target,
      FsusTreeInteractionSource.Pointer,
      new Rect(8, 8, 4, 4)));
    Assert.NotSame(current, menu.OverlayEntry);
    Assert.True(current!.IsClosed);
    Assert.False(menu.OverlayEntry!.IsClosed);
    Assert.Equal(new Rect(8, 12, 200, 240), menu.OverlayEntry.Bounds);
    Assert.Single(host.OpenOverlays);

    FsusContextMenuService.Attach(target, menu, host);
    Assert.False(await menu.CloseAsync());
    Assert.False(menu.IsOpen);
    Assert.Empty(host.OpenOverlays);
  }

  [Fact]
  public void TreeNodeContextRequestSyncsSelectionAndFocusWithoutActivation()
  {
    var tree = new FsusTree();
    var root = new FsusTreeNode("root", "Root");
    root.Children.Add(new FsusTreeNode("file-a", "File A"));
    root.Children.Add(new FsusTreeNode("file-b", "File B") { IsDisabled = true });
    tree.Nodes.Add(root);
    tree.RefreshView();

    var requests = new List<FsusTreeNodeContextEventArgs>();
    tree.NodeContextRequested += (_, args) => requests.Add(args);
    var activations = new List<FsusTreeNodeActivatedEventArgs>();
    tree.NodeActivated += (_, args) => activations.Add(args);

    Assert.True(tree.RequestNodeContext("file-a", FsusTreeInteractionSource.Pointer));
    var request = Assert.Single(requests);
    Assert.Equal("file-a", request.Key);
    Assert.Equal(FsusTreeInteractionSource.Pointer, request.InteractionSource);
    Assert.True(tree.GetNodeState("file-a").Selected);
    Assert.Equal("file-a", tree.FocusedKey);

    Assert.True(tree.RequestNodeContext("file-a", FsusTreeInteractionSource.Pointer));
    Assert.True(tree.GetNodeState("file-a").Selected);
    Assert.Equal(2, requests.Count);

    Assert.False(tree.RequestNodeContext("file-b", FsusTreeInteractionSource.Keyboard));
    Assert.False(tree.RequestNodeContext("missing", FsusTreeInteractionSource.Pointer));
    Assert.Equal(2, requests.Count);
    Assert.Empty(activations);
  }

  [Fact]
  public void TreeKeyboardContextMenuRespondsToAppsAndShiftF10Only()
  {
    var tree = new FsusTree();
    tree.Nodes.Add(new FsusTreeNode("file-a", "File A"));
    tree.Nodes.Add(new FsusTreeNode("file-b", "File B"));
    tree.RefreshView();

    var requests = new List<FsusTreeNodeContextEventArgs>();
    tree.NodeContextRequested += (_, args) => requests.Add(args);

    tree.FocusNode("file-a");
    Assert.True(Press(tree, Key.Apps, KeyModifiers.None).Handled);
    var appsRequest = Assert.Single(requests);
    Assert.Equal("file-a", appsRequest.Key);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, appsRequest.InteractionSource);

    tree.FocusNode("file-b");
    Assert.True(Press(tree, Key.F10, KeyModifiers.Shift).Handled);
    Assert.Equal(2, requests.Count);
    Assert.Equal("file-b", requests[^1].Key);

    Assert.False(Press(tree, Key.F10, KeyModifiers.None).Handled);
    Assert.Equal(2, requests.Count);
  }

  [Fact]
  public void TabPaneContextRequestRaisesTypedEventWithoutChangingSelection()
  {
    var tabs = new FsusTabs();
    tabs.Panes.Add(new FsusTabPane { Key = "overview", Header = "Overview" });
    tabs.Panes.Add(new FsusTabPane { Key = "activity", Header = "Activity", IsEnabled = false });
    tabs.SelectKey("overview");

    var requests = new List<FsusTabPaneContextEventArgs>();
    tabs.PaneContextRequested += (_, args) => requests.Add(args);
    var selections = new List<FsusNavigationSelectionChangedEventArgs>();
    tabs.SelectionChanged += (_, args) => selections.Add(args);

    Assert.True(tabs.RequestPaneContext("overview", FsusTreeInteractionSource.Pointer));
    var request = Assert.Single(requests);
    Assert.Equal("overview", request.PaneKey);
    Assert.Equal(FsusTreeInteractionSource.Pointer, request.InteractionSource);
    Assert.Equal("overview", tabs.SelectedKey);
    Assert.Equal("overview", tabs.FocusedKey);
    Assert.Empty(selections);

    Assert.False(tabs.RequestPaneContext("activity", FsusTreeInteractionSource.Pointer));
    Assert.False(tabs.RequestPaneContext("missing", FsusTreeInteractionSource.Pointer));
    Assert.Single(requests);
    Assert.Empty(selections);
  }

  private static KeyEventArgs Press(Control control, Key key, KeyModifiers modifiers)
  {
    var args = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = key,
      KeyModifiers = modifiers,
    };
    control.RaiseEvent(args);
    return args;
  }

  private static FsusContextMenuItem FindItem(FsusContextMenu menu, string key) =>
    menu.Items.OfType<FsusContextMenuItem>().Single((item) => item.Key == key);
}
