using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusAnchoredOverlayPrimitiveTests
{
  [Fact]
  public async Task TooltipPopoverAndPopconfirmUseHostTriggersAndBoundaryFlip()
  {
    var host = new FsusOverlayHost();
    var tooltip = new KeyboardTooltip
    {
      AccessibleName = "Publish help",
      OverlayContent = "Publishes the draft.",
      TriggerMode = FsusAnchoredTriggerMode.Hover,
      Placement = FsusAnchoredPlacement.BottomStart,
      Offset = 8,
      AnchorBounds = new Rect(20, 92, 10, 6),
      OverlaySize = new Size(120, 40),
      ViewportBounds = new Rect(0, 0, 200, 120),
    };

    var tooltipEntry = tooltip.Open(host, FsusAnchoredOpenReason.Hover);

    Assert.Same(tooltip, tooltipEntry.Content);
    Assert.False(tooltipEntry.IsModal);
    Assert.Equal(FsusOverlayPlacement.TopStart, tooltipEntry.Placement);
    Assert.True(tooltip.IsOpen);
    Assert.Contains("fsus-tooltip", tooltip.Classes);
    Assert.Equal("Publish help", AutomationProperties.GetName(tooltip));
    Assert.Equal(
      AutomationControlType.ToolTip,
      AutomationProperties.GetControlTypeOverride(tooltip));
    Assert.Equal("open top-start", AutomationProperties.GetItemStatus(tooltip));

    Assert.True(await tooltip.PressAsync(Key.Escape));
    Assert.False(tooltip.IsOpen);
    Assert.Empty(host.OpenOverlays);

    var popover = new KeyboardPopover
    {
      Title = "Publish settings",
      OverlayContent = "Audience and schedule",
      TriggerMode = FsusAnchoredTriggerMode.Click,
    };

    popover.TriggerClick(host);

    Assert.True(popover.IsOpen);
    Assert.Equal(
      AutomationControlType.Window,
      AutomationProperties.GetControlTypeOverride(popover));
    Assert.Equal("Popover", AutomationProperties.GetClassNameOverride(popover));

    Assert.True(await popover.PressAsync(Key.Escape));
    Assert.False(popover.IsOpen);

    var confirmed = 0;
    var canceled = 0;
    var popconfirm = new FsusPopconfirm
    {
      Title = "Delete article?",
      OverlayContent = "This cannot be undone.",
      ConfirmText = "Delete",
      CancelText = "Cancel",
      IsDangerous = true,
    };
    popconfirm.Confirmed += (_, _) => confirmed++;
    popconfirm.Canceled += (_, _) => canceled++;

    popconfirm.TriggerClick(host);

    Assert.True(popconfirm.IsOpen);
    Assert.Contains("fsus-dangerous", popconfirm.Classes);
    var popconfirmPeer = ControlAutomationPeer.CreatePeerForElement(popconfirm);
    var popconfirmProvider = Assert.IsAssignableFrom<IExpandCollapseProvider>(
      popconfirmPeer?.GetProvider<IExpandCollapseProvider>());
    Assert.Equal(
      AutomationControlType.Window,
      popconfirmPeer?.GetAutomationControlType());
    Assert.Equal(
      ExpandCollapseState.Expanded,
      popconfirmProvider.ExpandCollapseState);
    Assert.True(await popconfirm.ConfirmAsync());
    Assert.Equal(1, confirmed);
    Assert.Equal(0, canceled);
    Assert.False(popconfirm.IsOpen);
    Assert.Equal(
      ExpandCollapseState.Collapsed,
      popconfirmProvider.ExpandCollapseState);
  }

  [Fact]
  public async Task DropdownKeyboardNavigationSkipsDisabledSelectsAndDismisses()
  {
    var host = new FsusOverlayHost();
    var selectedKeys = new List<string>();
    var dropdown = new KeyboardDropdown
    {
      AccessibleName = "More actions",
      TriggerMode = FsusAnchoredTriggerMode.Click,
      Placement = FsusAnchoredPlacement.BottomEnd,
    };
    dropdown.Menu.Items.Add(new FsusDropdownItem { Key = "edit", Header = "Edit" });
    dropdown.Menu.Items.Add(new FsusDropdownItem { Key = "archive", Header = "Archive", IsEnabled = false });
    dropdown.Menu.Items.Add(new FsusDropdownItem { Key = "delete", Header = "Delete" });
    dropdown.SelectionChanged += (_, args) => selectedKeys.Add(args.SelectedKey);

    Assert.True(await dropdown.PressAsync(Key.Down, host));
    Assert.True(dropdown.IsOpen);
    Assert.Equal("edit", dropdown.Menu.FocusedKey);

    Assert.True(await dropdown.PressAsync(Key.Down, host));
    Assert.Equal("delete", dropdown.Menu.FocusedKey);

    Assert.True(await dropdown.PressAsync(Key.Enter, host));

    Assert.Equal("delete", dropdown.SelectedKey);
    Assert.Equal(new[] { "delete" }, selectedKeys);
    Assert.False(dropdown.IsOpen);
    Assert.Contains("fsus-selected", dropdown.Menu.Items[2].Classes);
    Assert.Contains("fsus-disabled", dropdown.Menu.Items[1].Classes);
    Assert.Equal(AutomationControlType.Menu, AutomationProperties.GetControlTypeOverride(dropdown));
    Assert.Equal("selected delete", AutomationProperties.GetItemStatus(dropdown));

    dropdown.IsDisabled = true;

    Assert.False(await dropdown.PressAsync(Key.Enter, host));
    Assert.False(dropdown.IsOpen);
  }

  [Fact]
  public void AnchoredOverlayAutomationPeersExposeRoleAndRealLifecycleState()
  {
    var host = new FsusOverlayHost();
    var tooltip = new FsusTooltip
    {
      AccessibleName = "Publish help",
      OverlayContent = "Publishes the draft.",
    };
    tooltip.Open(host);
    var tooltipPeer = ControlAutomationPeer.CreatePeerForElement(tooltip);
    var tooltipProvider = Assert.IsAssignableFrom<IExpandCollapseProvider>(
      tooltipPeer?.GetProvider<IExpandCollapseProvider>());

    Assert.Equal(
      AutomationControlType.ToolTip,
      tooltipPeer?.GetAutomationControlType());
    Assert.Equal(
      ExpandCollapseState.Expanded,
      tooltipProvider.ExpandCollapseState);

    tooltipProvider.Collapse();
    Assert.False(tooltip.IsOpen);
    Assert.Equal(
      ExpandCollapseState.Collapsed,
      tooltipProvider.ExpandCollapseState);

    tooltipProvider.Expand();
    Assert.True(tooltip.IsOpen);

    tooltipProvider.Collapse();
    tooltip.IsDisabled = true;
    Assert.Throws<InvalidOperationException>(tooltipProvider.Expand);
    Assert.False(tooltip.IsOpen);

    var popover = new FsusPopover
    {
      AccessibleName = "Publish settings",
      OverlayContent = "Audience and schedule",
    };
    popover.Open(host);
    var popoverPeer = ControlAutomationPeer.CreatePeerForElement(popover);
    var popoverProvider = Assert.IsAssignableFrom<IExpandCollapseProvider>(
      popoverPeer?.GetProvider<IExpandCollapseProvider>());

    Assert.Equal(
      AutomationControlType.Window,
      popoverPeer?.GetAutomationControlType());
    Assert.Equal(
      ExpandCollapseState.Expanded,
      popoverProvider.ExpandCollapseState);

    popoverProvider.Collapse();
    Assert.False(popover.IsOpen);
    popoverProvider.Expand();
    Assert.True(popover.IsOpen);
  }

  [Fact]
  public void AnchoredOverlayThemeVisualAndAutomationBaselinesCoverStable25()
  {
    var anchored = ReadControlTheme("AnchoredOverlay.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusTooltip",
      "fsus|FsusPopover",
      "fsus|FsusPopconfirm",
      "fsus|FsusDropdown",
      "fsus|FsusDropdownMenu",
      "fsus|FsusDropdownItem",
    })
    {
      Assert.Contains(selector, anchored);
    }

    Assert.Contains("FsusMotionDurationEffective", anchored);
    Assert.Contains("FsusDensityControlDefaultY", anchored);
    Assert.Contains("FsusShadowOverlayMd", anchored);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/AnchoredOverlay.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("anchored-overlay-stable25-web-avalonia", visualFixture);

    var automation = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("tooltip-stable25", automation);
    Assert.Contains("popover-stable25", automation);
    Assert.Contains("popconfirm-stable25", automation);
    Assert.Contains("dropdown-stable25", automation);

    var contracts = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "contracts.json"));
    Assert.Contains("\"id\": \"tooltip\"", contracts);
    Assert.Contains("\"id\": \"popover\"", contracts);
    Assert.Contains("\"id\": \"popconfirm\"", contracts);
    Assert.Contains("\"id\": \"dropdown\"", contracts);
  }

  private sealed class KeyboardTooltip : FsusTooltip
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardPopover : FsusPopover
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardDropdown : FsusDropdown
  {
    public ValueTask<bool> PressAsync(Key key, FsusOverlayHost host) =>
      HandleKeyAsync(key, host);
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
