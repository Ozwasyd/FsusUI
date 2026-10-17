using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusNativeMenuHeadlessTests
{
  [AvaloniaFact]
  public void NativeMenuAttachesToWindowAndSynchronouslyReflectsCommandState()
  {
    var executed = false;
    var saveCommand = new FsusPlatformCommand("doc.save", "Save", FsusPlatformRole.FileSave)
    {
      Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
      ExecuteAction = _ => executed = true,
      IsEnabled = true,
    };

    var fileMenu = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(saveCommand));

    var window = new Window();
    using var builder = new FsusNativeMenuBuilder();
    builder.AttachTo(window, [fileMenu], FsusShortcutPlatform.Windows);

    var menu = NativeMenu.GetMenu(window);
    Assert.NotNull(menu);

    var fileItem = Assert.IsType<NativeMenuItem>(Assert.Single(menu.Items, i => i is NativeMenuItem m && m.Header == "File"));
    Assert.NotNull(fileItem.Menu);
    var saveItem = Assert.IsType<NativeMenuItem>(Assert.Single(fileItem.Menu.Items, i => i is NativeMenuItem m && m.Header == "Save"));

    Assert.True(saveItem.IsEnabled);
    Assert.NotNull(saveItem.Gesture);
    Assert.Equal(Key.S, saveItem.Gesture.Key);

    // Execute via command attached to item
    Assert.NotNull(saveItem.Command);
    saveItem.Command.Execute(null);
    Assert.True(executed);

    // Synchronous update on state change
    saveCommand.IsEnabled = false;
    Assert.False(saveItem.IsEnabled);

    // Synchronous update on shortcut change
    saveCommand.Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control | KeyModifiers.Shift);
    Assert.True(saveItem.Gesture.KeyModifiers.HasFlag(KeyModifiers.Shift));

    window.Close();
  }

  [AvaloniaFact]
  public void InitiallyDisabledCommandStaysDisabledInRenderedMenu()
  {
    var executed = false;
    var saveCommand = new FsusPlatformCommand("doc.save", "Save", FsusPlatformRole.FileSave)
    {
      Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
      ExecuteAction = _ => executed = true,
      IsEnabled = false,
    };

    var fileMenu = FsusNativeMenuItemModel.SubMenu(
      "File",
      FsusNativeMenuItemModel.Action(saveCommand));

    var window = new Window();
    using var builder = new FsusNativeMenuBuilder();
    builder.AttachTo(window, [fileMenu], FsusShortcutPlatform.Windows);

    var menu = NativeMenu.GetMenu(window);
    Assert.NotNull(menu);

    var fileItem = Assert.IsType<NativeMenuItem>(Assert.Single(menu.Items, i => i is NativeMenuItem m && m.Header == "File"));
    Assert.NotNull(fileItem.Menu);
    var saveItem = Assert.IsType<NativeMenuItem>(Assert.Single(fileItem.Menu.Items, i => i is NativeMenuItem m && m.Header == "Save"));

    // A command disabled before the first build must render disabled through
    // the attached (rendered) menu path instead of being coerced to enabled.
    Assert.False(saveItem.IsEnabled);
    Assert.NotNull(saveItem.Command);
    Assert.False(saveItem.Command!.CanExecute(null));
    Assert.Equal("Save", FsusNativeMenuMetadata.GetAutomationName(saveItem));
    Assert.Equal("doc.save", FsusNativeMenuMetadata.GetCommandId(saveItem));

    // The execution guard still prevents activation while disabled.
    saveItem.Command.Execute(null);
    Assert.False(executed);

    // Automation-relevant state stays bound: enabling the command updates the
    // rendered item synchronously.
    saveCommand.IsEnabled = true;
    Assert.True(saveItem.IsEnabled);
    Assert.True(saveItem.Command.CanExecute(null));

    window.Close();
  }

  [AvaloniaFact]
  public void PreserveRootsProfileAttachesExactlySuppliedRootsAndKeepsCommandState()
  {
    var lockCommand = new FsusPlatformCommand("edit.lockSession", "Lock Session")
    {
      IsEnabled = false,
      ExecuteAction = _ => { },
    };
    var roots = new[]
    {
      FsusNativeMenuItemModel.SubMenu(
        "Edit",
        FsusPlatformRole.Edit,
        FsusNativeMenuItemModel.Action(lockCommand)),
      FsusNativeMenuItemModel.SubMenu("Help", FsusPlatformRole.Help),
    };

    var window = new Window();
    using var builder = new FsusNativeMenuBuilder();
    builder.AttachTo(
      window,
      roots,
      new FsusNativeMenuOptions
      {
        Profile = FsusNativeMenuProfile.PreserveRoots,
      },
      FsusShortcutPlatform.macOS);

    var menu = NativeMenu.GetMenu(window);
    Assert.NotNull(menu);
    Assert.Equal(
      ["Edit", "Help"],
      menu.Items
        .OfType<NativeMenuItem>()
        .Select(item => item.Header ?? string.Empty)
        .ToArray());

    var editItem = Assert.IsType<NativeMenuItem>(menu.Items[0]);
    var lockItem = Assert.IsType<NativeMenuItem>(Assert.Single(editItem.Menu!.Items));
    Assert.False(lockItem.IsEnabled);
    Assert.Equal("edit.lockSession", FsusNativeMenuMetadata.GetCommandId(lockItem));

    lockCommand.IsEnabled = true;
    Assert.True(lockItem.IsEnabled);

    window.Close();
  }

  [AvaloniaFact]
  public void CommandPaletteIntegratesWithSharedCommandsInHeadless()
  {
    var undoInvoked = false;
    var undoCommand = new FsusPlatformCommand("edit.undo", "Undo", FsusPlatformRole.EditUndo)
    {
      Category = "Edit",
      Description = "Undo previous change",
      Gesture = new FsusShortcutGesture(Key.Z, KeyModifiers.Control),
      ExecuteAction = _ => undoInvoked = true,
    };

    var redoCommand = new FsusPlatformCommand("edit.redo", "Redo", FsusPlatformRole.EditRedo)
    {
      Category = "Edit",
      Description = "Redo next change",
      Gesture = new FsusShortcutGesture(Key.Y, KeyModifiers.Control),
      IsEnabled = false,
    };

    var palette = new FsusCommandPaletteModel([undoCommand, redoCommand]);

    // Search query
    var results = palette.Search("und", FsusShortcutPlatform.Windows);
    Assert.Single(results);
    var result = results[0];
    Assert.Equal("edit.undo", result.CommandId);
    Assert.Equal("Undo", result.Label);
    Assert.True(result.IsEnabled);
    Assert.Equal("Ctrl+Z", result.DisplayShortcut);

    result.Execute();
    Assert.True(undoInvoked);

    // Search empty query returns all
    var all = palette.Search();
    Assert.Equal(2, all.Count);
  }
}
