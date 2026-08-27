using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

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
}
