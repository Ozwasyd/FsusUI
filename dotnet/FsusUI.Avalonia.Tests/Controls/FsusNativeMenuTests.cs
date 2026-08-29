using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows.Input;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusNativeMenuTests
{
  [Fact]
  public void SameCommandModelUsableByCommandPaletteAndNativeMenu()
  {
    var saveCommand = new FsusPlatformCommand("file.save", "Save Document", FsusPlatformRole.FileSave)
    {
      Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
      Category = "File",
      Description = "Save active file",
    };

    var exportCommand = new FsusPlatformCommand("file.export", "Export PDF", FsusPlatformRole.FileExport)
    {
      Gesture = new FsusShortcutGesture(Key.E, KeyModifiers.Control | KeyModifiers.Shift),
      Category = "File",
      Description = "Export file to PDF",
    };

    var commands = new[] { saveCommand, exportCommand };

    // 1. Used by NativeMenu builder
    var fileMenuModel = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(saveCommand),
      FsusNativeMenuItemModel.Action(exportCommand));

    using var builder = new FsusNativeMenuBuilder();
    var nativeMenu = builder.Build([fileMenuModel], FsusShortcutPlatform.Windows);

    Assert.NotNull(nativeMenu);
    var rootFile = Assert.IsType<NativeMenuItem>(Assert.Single(nativeMenu.Items, i => i is NativeMenuItem m && m.Header == "File"));
    Assert.NotNull(rootFile.Menu);
    var saveItem = Assert.IsType<NativeMenuItem>(rootFile.Menu.Items.First(i => i is NativeMenuItem m && m.Header == "Save Document"));
    Assert.Equal("Save Document", saveItem.Header);
    Assert.NotNull(saveItem.Gesture);
    Assert.Equal(Key.S, saveItem.Gesture.Key);

    // 2. Used by Command Palette
    var palette = new FsusCommandPaletteModel(commands);
    var searchResults = palette.Search("save");
    Assert.Single(searchResults);
    Assert.Equal("file.save", searchResults[0].CommandId);
    Assert.Equal("Save Document", searchResults[0].Label);
    Assert.Equal("File", searchResults[0].Category);
    Assert.Equal("Ctrl+S", searchResults[0].DisplayShortcut);
    Assert.True(searchResults[0].IsEnabled);

    // Execute via palette
    var executed = false;
    saveCommand.ExecuteAction = _ => executed = true;
    searchResults[0].Execute();
    Assert.True(executed);
  }

  [Fact]
  public void DocumentStateChangesSynchronouslyUpdateItemEnabledState()
  {
    var saveCommand = new FsusPlatformCommand("file.save", "Save", FsusPlatformRole.FileSave)
    {
      IsEnabled = true,
    };

    var exportCommand = new FsusPlatformCommand("file.export", "Export", FsusPlatformRole.FileExport)
    {
      IsEnabled = true,
    };

    var fileMenu = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(saveCommand),
      FsusNativeMenuItemModel.Action(exportCommand));

    using var builder = new FsusNativeMenuBuilder();
    var menu = builder.Build([fileMenu], FsusShortcutPlatform.Windows);

    var fileMenuItem = (NativeMenuItem)menu.Items.First(i => i is NativeMenuItem m && m.Header == "File");
    var saveMenuItem = (NativeMenuItem)fileMenuItem.Menu!.Items.First(i => i is NativeMenuItem m && m.Header == "Save");
    var exportMenuItem = (NativeMenuItem)fileMenuItem.Menu.Items.First(i => i is NativeMenuItem m && m.Header == "Export");

    Assert.True(saveMenuItem.IsEnabled);
    Assert.True(exportMenuItem.IsEnabled);

    // Document state change: disable Save and Export
    saveCommand.IsEnabled = false;
    exportCommand.IsEnabled = false;

    // Immediately synchronously updated on NativeMenuItem!
    Assert.False(saveMenuItem.IsEnabled);
    Assert.False(exportMenuItem.IsEnabled);

    // Document dirty state: re-enable Save
    saveCommand.IsEnabled = true;
    Assert.True(saveMenuItem.IsEnabled);
    Assert.False(exportMenuItem.IsEnabled);
  }

  [Fact]
  public void CustomShortcutUpdateImmediatelyRefreshesNativeMenuAccelerator()
  {
    var command = new FsusPlatformCommand("file.save", "Save", FsusPlatformRole.FileSave)
    {
      Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
    };

    var fileMenu = FsusNativeMenuItemModel.SubMenu("File", FsusNativeMenuItemModel.Action(command));
    using var builder = new FsusNativeMenuBuilder();
    var menu = builder.Build([fileMenu], FsusShortcutPlatform.Windows);

    var fileItem = (NativeMenuItem)menu.Items.First(i => i is NativeMenuItem m && m.Header == "File");
    var saveItem = (NativeMenuItem)fileItem.Menu!.Items.First(i => i is NativeMenuItem m && m.Header == "Save");

    Assert.NotNull(saveItem.Gesture);
    Assert.Equal(Key.S, saveItem.Gesture.Key);
    Assert.True(saveItem.Gesture.KeyModifiers.HasFlag(KeyModifiers.Control));

    // User updates shortcut to Ctrl+Shift+S
    command.Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control | KeyModifiers.Shift);

    // Immediately refreshed accelerator!
    Assert.NotNull(saveItem.Gesture);
    Assert.Equal(Key.S, saveItem.Gesture.Key);
    Assert.True(saveItem.Gesture.KeyModifiers.HasFlag(KeyModifiers.Control));
    Assert.True(saveItem.Gesture.KeyModifiers.HasFlag(KeyModifiers.Shift));
  }

  [Fact]
  public void MacPlatformRolesInCorrectPositionsAndOtherPlatformsDoNotHaveInvalidItems()
  {
    var aboutCmd = new FsusPlatformCommand("app.about", "About FsusUI", FsusPlatformRole.About);
    var prefCmd = new FsusPlatformCommand("app.pref", "Preferences", FsusPlatformRole.Preferences);
    var servicesCmd = new FsusPlatformCommand("app.services", "Services", FsusPlatformRole.Services);
    var hideCmd = new FsusPlatformCommand("app.hide", "Hide", FsusPlatformRole.Hide);
    var hideOthersCmd = new FsusPlatformCommand("app.hideOthers", "Hide Others", FsusPlatformRole.HideOthers);
    var showAllCmd = new FsusPlatformCommand("app.showAll", "Show All", FsusPlatformRole.ShowAll);
    var quitCmd = new FsusPlatformCommand("app.quit", "Quit", FsusPlatformRole.Quit);
    var newCmd = new FsusPlatformCommand("file.new", "New", FsusPlatformRole.FileNew);

    var appMenu = FsusNativeMenuItemModel.SubMenu(
      "Application",
      FsusPlatformRole.About,
      FsusNativeMenuItemModel.Action(aboutCmd),
      FsusNativeMenuItemModel.Separator(),
      FsusNativeMenuItemModel.Action(prefCmd),
      FsusNativeMenuItemModel.Separator(),
      FsusNativeMenuItemModel.Action(servicesCmd),
      FsusNativeMenuItemModel.Separator(),
      FsusNativeMenuItemModel.Action(hideCmd),
      FsusNativeMenuItemModel.Action(hideOthersCmd),
      FsusNativeMenuItemModel.Action(showAllCmd),
      FsusNativeMenuItemModel.Separator(),
      FsusNativeMenuItemModel.Action(quitCmd));

    var fileMenu = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(newCmd));

    var rootMenus = new[] { appMenu, fileMenu };

    // 1. Build for macOS
    using var macBuilder = new FsusNativeMenuBuilder();
    var macMenu = macBuilder.Build(rootMenus, FsusShortcutPlatform.macOS);

    var macAppMenu = (NativeMenuItem)macMenu.Items[0];
    Assert.Equal("Application", macAppMenu.Header);
    var macAppItems = macAppMenu.Menu!.Items.OfType<NativeMenuItem>().Select(i => i.Header).ToList();
    Assert.Contains("About FsusUI", macAppItems);
    Assert.Contains("Preferences", macAppItems);
    Assert.Contains("Services", macAppItems);
    Assert.Contains("Hide", macAppItems);
    Assert.Contains("Hide Others", macAppItems);
    Assert.Contains("Show All", macAppItems);
    Assert.Contains("Quit", macAppItems);

    // 2. Build for Windows
    using var winBuilder = new FsusNativeMenuBuilder();
    var winMenu = winBuilder.Build(rootMenus, FsusShortcutPlatform.Windows);

    // Windows menu must NOT have Application menu, Services, Hide, Hide Others, or Show All
    var topLevelHeaders = winMenu.Items.OfType<NativeMenuItem>().Select(i => i.Header).ToList();
    Assert.DoesNotContain("Application", topLevelHeaders);
    Assert.Equal("File", topLevelHeaders[0]);
    Assert.Equal("Help", topLevelHeaders[1]);

    var winFileMenu = (NativeMenuItem)winMenu.Items.First(i => i is NativeMenuItem m && m.Header == "File");
    var winFileHeaders = winFileMenu.Menu!.Items.OfType<NativeMenuItem>().Select(i => i.Header).ToList();
    Assert.Contains("New", winFileHeaders);
    Assert.Contains("Preferences", winFileHeaders);
    Assert.Contains("Exit", winFileHeaders);
    Assert.DoesNotContain("Services", winFileHeaders);
    Assert.DoesNotContain("Hide", winFileHeaders);
    Assert.DoesNotContain("Hide Others", winFileHeaders);
    Assert.DoesNotContain("Show All", winFileHeaders);

    var winHelpMenu = (NativeMenuItem)winMenu.Items.First(i => i is NativeMenuItem m && m.Header == "Help");
    var winHelpHeaders = winHelpMenu.Menu!.Items.OfType<NativeMenuItem>().Select(i => i.Header).ToList();
    Assert.Contains("About FsusUI", winHelpHeaders);
  }

  [Fact]
  public void InitiallyDisabledCommandStaysDisabledAfterBuildAndReflectsNestedState()
  {
    var executed = false;
    var saveCommand = new FsusPlatformCommand("file.save", "Save", FsusPlatformRole.FileSave)
    {
      IsEnabled = false,
      ExecuteAction = _ => executed = true,
    };

    var fileMenu = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(saveCommand));

    using var builder = new FsusNativeMenuBuilder();
    var menu = builder.Build([fileMenu], FsusShortcutPlatform.Windows);

    var fileMenuItem = (NativeMenuItem)menu.Items.First(i => i is NativeMenuItem m && m.Header == "File");
    var saveMenuItem = (NativeMenuItem)fileMenuItem.Menu!.Items.First(i => i is NativeMenuItem m && m.Header == "Save");

    // Item disabled before the first Build must not be coerced back to enabled
    // by assigning the generated command.
    Assert.False(saveMenuItem.IsEnabled);
    Assert.NotNull(saveMenuItem.Command);
    Assert.False(saveMenuItem.Command!.CanExecute(null));

    // The execution guard still blocks a disabled command.
    saveMenuItem.Command.Execute(null);
    Assert.False(executed);

    // CanExecuteChanged fires when the source command state changes.
    var canExecuteChangedCount = 0;
    saveMenuItem.Command.CanExecuteChanged += (_, _) => canExecuteChangedCount++;

    saveCommand.IsEnabled = true;
    Assert.True(saveMenuItem.IsEnabled);
    Assert.True(saveMenuItem.Command.CanExecute(null));
    Assert.Equal(1, canExecuteChangedCount);

    // Nested command state participates in CanExecute like the execute guard.
    // FsusPlatformCommand.Command changes carry no change notification, so the
    // generated CanExecute reflects the live state without moving IsEnabled.
    saveCommand.Command = new DelegateICommand(_ => { }, canExecute: false);
    Assert.False(saveMenuItem.Command.CanExecute(null));

    saveCommand.Command = new DelegateICommand(_ => { }, canExecute: true);
    Assert.True(saveMenuItem.Command.CanExecute(null));
    Assert.True(saveMenuItem.IsEnabled);
  }

  private sealed class DelegateICommand(Action<object?> execute, bool canExecute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => canExecute;

    public void Execute(object? parameter) => execute(parameter);
  }

  [Fact]
  public void PreserveRootsProfileReturnsExactlySuppliedRootsWithMetadataAndCommandState()
  {
    var aboutCommand =
      new FsusPlatformCommand("app.about", "About FsusUI", FsusPlatformRole.About);
    var lockCommand = new FsusPlatformCommand("edit.lockSession", "Lock Session")
    {
      IsEnabled = false,
    };
    var roots = new[]
    {
      FsusNativeMenuItemModel.SubMenu(
        "Application",
        FsusPlatformRole.Application,
        FsusNativeMenuItemModel.Action(aboutCommand)),
      FsusNativeMenuItemModel.SubMenu(
        "Edit",
        FsusPlatformRole.Edit,
        FsusNativeMenuItemModel.Action(lockCommand)),
      FsusNativeMenuItemModel.SubMenu("Help", FsusPlatformRole.Help),
    };
    var options = new FsusNativeMenuOptions
    {
      Profile = FsusNativeMenuProfile.PreserveRoots,
    };

    using var builder = new FsusNativeMenuBuilder();
    var macMenu = builder.Build(roots, options, FsusShortcutPlatform.macOS);

    Assert.Equal(["Application", "Edit", "Help"], Headers(macMenu));
    var applicationItem = Assert.IsType<NativeMenuItem>(macMenu.Items[0]);
    Assert.Equal(
      FsusPlatformRole.Application,
      FsusNativeMenuMetadata.GetRole(applicationItem));
    var aboutItem = Assert.IsType<NativeMenuItem>(Assert.Single(applicationItem.Menu!.Items));
    Assert.Equal(
      FsusPlatformRole.About,
      FsusNativeMenuMetadata.GetRole(aboutItem));
    Assert.Equal("app.about", FsusNativeMenuMetadata.GetCommandId(aboutItem));

    var editItem = Assert.IsType<NativeMenuItem>(macMenu.Items[1]);
    var lockItem = Assert.IsType<NativeMenuItem>(Assert.Single(editItem.Menu!.Items));
    Assert.False(lockItem.IsEnabled);
    Assert.Equal("edit.lockSession", FsusNativeMenuMetadata.GetCommandId(lockItem));
    lockCommand.IsEnabled = true;
    Assert.True(lockItem.IsEnabled);

    var winMenu = builder.Build(roots, options, FsusShortcutPlatform.Windows);
    Assert.Equal(["Application", "Edit", "Help"], Headers(winMenu));

    var app = new Application();
    builder.AttachTo(app, roots, options, FsusShortcutPlatform.Windows);
    Assert.Equal(
      ["Application", "Edit", "Help"],
      Headers(NativeMenu.GetMenu(app)!));
  }

  [Fact]
  public void SynthesizedRootsOptionGatesMissingRequiredRoots()
  {
    var newCommand = new FsusPlatformCommand("file.new", "New", FsusPlatformRole.FileNew);
    var quitCommand =
      new FsusPlatformCommand("app.quit", "Quit FsusUI", FsusPlatformRole.Quit);
    var suppliedRoots = new[]
    {
      FsusNativeMenuItemModel.SubMenu(
        "File",
        FsusPlatformRole.File,
        FsusNativeMenuItemModel.Action(newCommand)),
      FsusNativeMenuItemModel.SubMenu("Edit", FsusPlatformRole.Edit),
      FsusNativeMenuItemModel.SubMenu("Help", FsusPlatformRole.Help),
    };

    using var builder = new FsusNativeMenuBuilder();
    var defaultMac = builder.Build(suppliedRoots, FsusShortcutPlatform.macOS);
    Assert.Contains("Application", Headers(defaultMac));
    Assert.Contains("Window", Headers(defaultMac));

    var constrainedMac = builder.Build(
      suppliedRoots,
      new FsusNativeMenuOptions
      {
        SynthesizedRoots = FsusNativeMenuSynthesizedRoots.File |
          FsusNativeMenuSynthesizedRoots.Help,
      },
      FsusShortcutPlatform.macOS);
    Assert.Equal(["File", "Edit", "Help"], Headers(constrainedMac));

    var editOnly = new[]
    {
      FsusNativeMenuItemModel.SubMenu("Edit", FsusPlatformRole.Edit),
    };
    var defaultWin = builder.Build(editOnly, FsusShortcutPlatform.Windows);
    Assert.Equal(["File", "Edit", "Help"], Headers(defaultWin));
    var constrainedWin = builder.Build(
      editOnly,
      new FsusNativeMenuOptions
      {
        SynthesizedRoots = FsusNativeMenuSynthesizedRoots.None,
      },
      FsusShortcutPlatform.Windows);
    Assert.Equal(["Edit"], Headers(constrainedWin));

    var appWithQuit = FsusNativeMenuItemModel.SubMenu(
      "Application",
      FsusPlatformRole.Application,
      FsusNativeMenuItemModel.Action(quitCommand));
    var constrainedWithApplication = builder.Build(
      [appWithQuit, .. editOnly],
      new FsusNativeMenuOptions
      {
        SynthesizedRoots = FsusNativeMenuSynthesizedRoots.None,
      },
      FsusShortcutPlatform.Windows);
    Assert.Equal(["Application", "Edit"], Headers(constrainedWithApplication));
    var applicationItem =
      Assert.IsType<NativeMenuItem>(constrainedWithApplication.Items[0]);
    Assert.Contains(
      applicationItem.Menu!.Items.OfType<NativeMenuItem>(),
      item => item.Header == "Quit FsusUI");
  }

  [Fact]
  public void DockMenuContractAndWindowlessRoutingFallbackWorks()
  {
    Assert.True(FsusDockMenuContract.IsSupported(FsusShortcutPlatform.macOS));
    Assert.False(FsusDockMenuContract.IsSupported(FsusShortcutPlatform.Windows));
    Assert.False(FsusDockMenuContract.IsSupported(FsusShortcutPlatform.Linux));

    var opened = new List<string>();
    var cleared = false;
    var recentFiles = new[] { "/path/to/file1.txt", "/path/to/file2.txt" };

    // macOS builds dock menu
    var macDock = FsusDockMenuContract.BuildDockMenu(
      recentFiles,
      openRecentAction: path => opened.Add(path),
      clearRecentAction: () => cleared = true,
      platform: FsusShortcutPlatform.macOS);

    Assert.NotNull(macDock);
    Assert.Equal(4, macDock.Items.Count); // 2 files + separator + clear
    var firstItem = (NativeMenuItem)macDock.Items[0];
    Assert.Equal("/path/to/file1.txt", firstItem.Header);
    firstItem.Command!.Execute(null);
    Assert.Single(opened);
    Assert.Equal("/path/to/file1.txt", opened[0]);

    Assert.False(cleared);
    var clearItem = (NativeMenuItem)macDock.Items[3];
    Assert.Equal("Clear Recent", clearItem.Header);
    clearItem.Command!.Execute(null);
    Assert.True(cleared);

    // Windows / Linux degrades safely to null without throwing
    var winDock = FsusDockMenuContract.BuildDockMenu(
      recentFiles,
      platform: FsusShortcutPlatform.Windows);
    Assert.Null(winDock);

    // A dock command that starts disabled keeps its disabled state.
    var disabledDockCommand = new FsusPlatformCommand(
      "dock.disabled",
      "Disabled Action",
      FsusPlatformRole.DockOpen)
    {
      IsEnabled = false,
    };
    var dockWithDisabled = FsusDockMenuContract.BuildDockMenu(
      [],
      additionalCommands: [disabledDockCommand],
      platform: FsusShortcutPlatform.macOS);
    Assert.NotNull(dockWithDisabled);
    var dockDisabledItem = (NativeMenuItem)dockWithDisabled.Items.Single(
      i => i is NativeMenuItem m && m.Header == "Disabled Action");
    Assert.False(dockDisabledItem.IsEnabled);
    Assert.False(dockDisabledItem.Command!.CanExecute(null));

    // Dock menu windowless router
    var router = new FsusDockMenuRouter();
    var windowlessInvoked = false;
    var normalInvoked = false;

    router.RegisterRoute("app.newWindow", _ => normalInvoked = true);
    router.RegisterWindowlessRoute("app.newWindow", _ => windowlessInvoked = true);

    // With active window
    router.Route("app.newWindow", hasActiveWindow: true);
    Assert.True(normalInvoked);
    Assert.False(windowlessInvoked);

    // Without active window (windowless launch)
    router.Route("app.newWindow", hasActiveWindow: false);
    Assert.True(windowlessInvoked);
  }

  [Fact]
  public void PlatformSimulationBindsRolesAndCanonicalTopLevelOrder()
  {
    var appMenu = FsusNativeMenuItemModel.SubMenu(
      "Application",
      FsusPlatformRole.Application,
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.quit",
          "Quit FsusUI",
          FsusPlatformRole.Quit)),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.services",
          "Services",
          FsusPlatformRole.Services)),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.about",
          "About FsusUI",
          FsusPlatformRole.About)),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.hideOthers",
          "Hide Others",
          FsusPlatformRole.HideOthers)),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.preferences",
          "Preferences",
          FsusPlatformRole.Preferences)),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.showAll",
          "Show All",
          FsusPlatformRole.ShowAll)),
      FsusNativeMenuItemModel.Action(
        new FsusPlatformCommand(
          "app.hide",
          "Hide FsusUI",
          FsusPlatformRole.Hide)));
    var roots = new[]
    {
      FsusNativeMenuItemModel.SubMenu("Help"),
      FsusNativeMenuItemModel.SubMenu(
        "Window",
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "window.bringAllToFront",
            "Bring All to Front",
            FsusPlatformRole.WindowBringAllToFront)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "window.zoom",
            "Zoom",
            FsusPlatformRole.WindowZoom)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "window.minimize",
            "Minimize",
            FsusPlatformRole.WindowMinimize))),
      FsusNativeMenuItemModel.SubMenu("View"),
      appMenu,
      FsusNativeMenuItemModel.SubMenu("Edit"),
      FsusNativeMenuItemModel.SubMenu("File"),
    };

    using var macBuilder = new FsusNativeMenuBuilder();
    var mac = macBuilder.Build(roots, FsusShortcutPlatform.macOS);
    Assert.Equal(
      ["Application", "File", "Edit", "View", "Window", "Help"],
      Headers(mac));

    var macApplication = Assert.IsType<NativeMenuItem>(mac.Items[0]);
    Assert.Equal(
      FsusPlatformRole.Application,
      FsusNativeMenuMetadata.GetRole(macApplication));
    var macRoleOrder = macApplication.Menu!.Items
      .OfType<NativeMenuItem>()
      .Select(FsusNativeMenuMetadata.GetRole)
      .Where(role => role != FsusPlatformRole.None)
      .ToArray();
    Assert.Equal(
      [
        FsusPlatformRole.About,
        FsusPlatformRole.Preferences,
        FsusPlatformRole.Services,
        FsusPlatformRole.Hide,
        FsusPlatformRole.HideOthers,
        FsusPlatformRole.ShowAll,
        FsusPlatformRole.Quit,
      ],
      macRoleOrder);
    var servicesItem = macApplication.Menu.Items
      .OfType<NativeMenuItem>()
      .Single(item =>
        FsusNativeMenuMetadata.GetRole(item) == FsusPlatformRole.Services);
    Assert.NotNull(servicesItem.Menu);
    var macWindow = Assert.IsType<NativeMenuItem>(mac.Items[4]);
    Assert.Equal(
      [
        FsusPlatformRole.WindowMinimize,
        FsusPlatformRole.WindowZoom,
        FsusPlatformRole.WindowBringAllToFront,
      ],
      macWindow.Menu!.Items
        .OfType<NativeMenuItem>()
        .Select(FsusNativeMenuMetadata.GetRole)
        .Where(role => role != FsusPlatformRole.None)
        .ToArray());

    foreach (var platform in new[]
      {
        FsusShortcutPlatform.Windows,
        FsusShortcutPlatform.Linux,
      })
    {
      using var builder = new FsusNativeMenuBuilder();
      var menu = builder.Build(roots, platform);
      Assert.Equal(
        ["File", "Edit", "View", "Window", "Help"],
        Headers(menu));
      Assert.DoesNotContain(
        EnumerateItems(menu),
        item => FsusNativeMenuMetadata.GetRole(item) is
          FsusPlatformRole.Services or
          FsusPlatformRole.Hide or
          FsusPlatformRole.HideOthers or
          FsusPlatformRole.ShowAll or
          FsusPlatformRole.WindowMinimize or
          FsusPlatformRole.WindowZoom or
          FsusPlatformRole.WindowClose or
          FsusPlatformRole.WindowBringAllToFront);
    }
  }

  [Fact]
  public void RebuildAndDisposeDetachPreviousCommandListeners()
  {
    var command =
      new FsusPlatformCommand("file.save", "Save", FsusPlatformRole.FileSave);
    var root = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(command));
    using var builder = new FsusNativeMenuBuilder();

    var first = builder.Build([root], FsusShortcutPlatform.Windows);
    var firstSave = FindItem(first, "Save");
    var initialSubscriptionCount = builder.ActiveSubscriptionCount;
    Assert.True(initialSubscriptionCount > 0);

    var second = builder.Build([root], FsusShortcutPlatform.Windows);
    var secondSave = FindItem(second, "Save");
    Assert.Equal(initialSubscriptionCount, builder.ActiveSubscriptionCount);

    command.Label = "Save Document";
    Assert.Equal("Save", firstSave.Header);
    Assert.Equal("Save Document", secondSave.Header);

    builder.Dispose();
    Assert.Equal(0, builder.ActiveSubscriptionCount);
    command.Label = "Save Project";
    Assert.Equal("Save Document", secondSave.Header);
  }

  [Fact]
  public void RecentSubmenuRebuildAndDockAttachmentUseNeutralRoles()
  {
    var opened = new List<string>();
    var cleared = false;
    var recent = FsusNativeMenuItemModel.RecentGroup(
      "Open Recent",
      ["/work/draft.md", "/work/review.md"],
      opened.Add,
      () => cleared = true);
    var file = FsusNativeMenuItemModel.SubMenu("File", recent);
    using var builder = new FsusNativeMenuBuilder();

    var first = builder.Build([file], FsusShortcutPlatform.macOS);
    var openRecent = FindItem(first, "Open Recent");
    Assert.Equal(
      FsusPlatformRole.FileOpenRecent,
      FsusNativeMenuMetadata.GetRole(openRecent));
    var draft = Assert.IsType<NativeMenuItem>(openRecent.Menu!.Items[0]);
    draft.Command!.Execute(null);
    Assert.Equal(["/work/draft.md"], opened);
    var clear = FindItem(openRecent.Menu, "Clear Recent");
    clear.Command!.Execute(null);
    Assert.True(cleared);

    recent.RecentItems.Clear();
    recent.RecentItems.Add("/work/final.md");
    var rebuilt = builder.Build([file], FsusShortcutPlatform.macOS);
    var rebuiltRecent = FindItem(rebuilt, "Open Recent");
    Assert.Single(
      rebuiltRecent.Menu!.Items.OfType<NativeMenuItem>(),
      item =>
        FsusNativeMenuMetadata.GetRole(item) ==
        FsusPlatformRole.FileOpenRecent);
    Assert.Equal(
      "/work/final.md",
      rebuiltRecent.Menu.Items
        .OfType<NativeMenuItem>()
        .Single(item =>
          FsusNativeMenuMetadata.GetRole(item) ==
          FsusPlatformRole.FileOpenRecent)
        .Header);

    var target = new AvaloniaObject();
    var open = new FsusPlatformCommand(
      "dock.open",
      "Open",
      FsusPlatformRole.DockOpen);
    var dock = FsusDockMenuContract.AttachTo(
      target,
      ["/work/final.md"],
      additionalCommands: [open],
      platform: FsusShortcutPlatform.macOS);
    Assert.Same(dock, NativeDock.GetMenu(target));
    Assert.Contains(
      dock!.Items.OfType<NativeMenuItem>(),
      item => FsusNativeMenuMetadata.GetRole(item) ==
              FsusPlatformRole.DockOpen);
    Assert.Contains(
      dock.Items.OfType<NativeMenuItem>(),
      item => FsusNativeMenuMetadata.GetRole(item) ==
              FsusPlatformRole.DockOpenRecent);
  }

  [Fact]
  public void LocalPlatformSimulationProducesBoundEvidence()
  {
    var save =
      new FsusPlatformCommand("file.save", "Save", FsusPlatformRole.FileSave)
      {
        Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
      };
    var roots = new[]
    {
      FsusNativeMenuItemModel.SubMenu(
        "Application",
        FsusPlatformRole.Application,
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.about",
            "About",
            FsusPlatformRole.About)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.preferences",
            "Preferences",
            FsusPlatformRole.Preferences)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.services",
            "Services",
            FsusPlatformRole.Services)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.hide",
            "Hide",
            FsusPlatformRole.Hide)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.hideOthers",
            "Hide Others",
            FsusPlatformRole.HideOthers)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.showAll",
            "Show All",
            FsusPlatformRole.ShowAll)),
        FsusNativeMenuItemModel.Action(
          new FsusPlatformCommand(
            "app.quit",
            "Quit",
            FsusPlatformRole.Quit))),
      FsusNativeMenuItemModel.SubMenu(
        "File",
        FsusNativeMenuItemModel.Action(save)),
      FsusNativeMenuItemModel.SubMenu("Edit"),
      FsusNativeMenuItemModel.SubMenu("View"),
      FsusNativeMenuItemModel.SubMenu("Window"),
      FsusNativeMenuItemModel.SubMenu("Help"),
    };
    var platformEvidence = new List<object>();

    foreach (var platform in new[]
      {
        FsusShortcutPlatform.macOS,
        FsusShortcutPlatform.Windows,
        FsusShortcutPlatform.Linux,
      })
    {
      using var builder = new FsusNativeMenuBuilder();
      var menu = builder.Build(roots, platform);
      platformEvidence.Add(new
      {
        platform = platform.ToString(),
        localSimulation = true,
        physicalHardware = false,
        topLevelOrder = Headers(menu),
        roles = EnumerateItems(menu)
          .Select(item => new
          {
            header = item.Header,
            role = FsusNativeMenuMetadata.GetRole(item).ToString(),
            commandId = FsusNativeMenuMetadata.GetCommandId(item),
            automationName =
              FsusNativeMenuMetadata.GetAutomationName(item),
          })
          .ToArray(),
        activeSubscriptions = builder.ActiveSubscriptionCount,
      });
    }

    var json = JsonSerializer.Serialize(
      new
      {
        schemaVersion = 1,
        issues = new[] { 648, 649 },
        fixtureClass = "reproducible-local-platform-simulation",
        hostPlatform = Environment.OSVersion.Platform.ToString(),
        note =
          "macOS and Windows native-menu roles are simulated locally; this is not a physical-hardware claim.",
        platforms = platformEvidence,
      },
      new JsonSerializerOptions { WriteIndented = true }) + "\n";
    var digest =
      Convert.ToHexStringLower(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json)));
    Assert.Equal(64, digest.Length);
    Assert.Contains("\"macOS\"", json);
    Assert.Contains("\"Windows\"", json);
    Assert.Contains("\"Linux\"", json);

    var outputRoot =
      Environment.GetEnvironmentVariable("FSUS_PR675_PLATFORM_EVIDENCE_ROOT");
    if (!string.IsNullOrWhiteSpace(outputRoot))
    {
      Directory.CreateDirectory(outputRoot);
      File.WriteAllText(
        Path.Combine(outputRoot, "native-menu-platform-simulation.json"),
        json);
      File.WriteAllText(
        Path.Combine(outputRoot, "native-menu-platform-simulation.sha256"),
        $"{digest}  native-menu-platform-simulation.json\n");
    }
  }

  private static string[] Headers(NativeMenu menu) =>
    menu.Items.OfType<NativeMenuItem>()
      .Select(item => item.Header ?? string.Empty)
      .ToArray();

  private static NativeMenuItem FindItem(NativeMenu menu, string header) =>
    EnumerateItems(menu).Single(item => item.Header == header);

  private static IEnumerable<NativeMenuItem> EnumerateItems(NativeMenu menu)
  {
    foreach (var item in menu.Items.OfType<NativeMenuItem>())
    {
      yield return item;
      if (item.Menu is null)
      {
        continue;
      }

      foreach (var child in EnumerateItems(item.Menu))
      {
        yield return child;
      }
    }
  }
}
