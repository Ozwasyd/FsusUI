using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusCommandPaletteTests
{
  [Fact]
  public async Task FiltersLocalAndAsyncCommandsCaseInsensitivelyWithPublicMetadata()
  {
    var hidden = true;
    var enabled = false;
    var save = new FsusPlatformCommand("document.save", "Save Draft")
    {
      Category = "File",
      Description = "Save the active document",
      IconKey = "FsusIconSaveAll",
      Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
    };
    var publish = new FsusPlatformCommand("document.publish", "Publish Article")
    {
      Category = "Publishing",
      Description = "Send the reviewed article to production",
      IsEnabledPredicate = () => enabled,
    };
    var hiddenCommand = new FsusPlatformCommand("document.hidden", "Hidden command")
    {
      IsVisiblePredicate = () => !hidden,
    };
    var providerCommand = new FsusPlatformCommand("workspace.publish-log", "Open Publish Log")
    {
      Category = "Workspace",
      Description = "Inspect the most recent publish operation",
      IconKey = "FsusIconFileDocument",
    };

    var palette = new FsusCommandPalette
    {
      CommandTree =
      [
        FsusNativeMenuItemModel.Action(save),
        FsusNativeMenuItemModel.Action(publish),
        FsusNativeMenuItemModel.Action(hiddenCommand),
      ],
      Providers =
      [
        (query, _) => ValueTask.FromResult<IReadOnlyList<FsusPlatformCommand>>(
          query.Contains("publish", StringComparison.OrdinalIgnoreCase)
            ? [providerCommand]
            : []),
      ],
      ShortcutPlatform = FsusShortcutPlatform.Windows,
    };
    var host = new FsusOverlayHost();
    palette.Open(host);

    await palette.SetQueryAsync("PUBLISH");

    Assert.Equal(2, palette.Results.Count);
    Assert.Equal(
      ["document.publish", "workspace.publish-log"],
      palette.Results.Select((result) => result.CommandId).ToArray());
    var local = palette.Results[0];
    Assert.Equal("Publishing", local.Category);
    Assert.Equal("Send the reviewed article to production", local.Description);
    Assert.False(local.IsEnabled);
    var provider = palette.Results[1];
    Assert.Equal("FsusIconFileDocument", provider.IconKey);
    Assert.Equal("Workspace", provider.Category);

    enabled = true;
    hidden = false;
    publish.NotifyStateChanged();
    hiddenCommand.NotifyStateChanged();
    await palette.SetQueryAsync("DOCUMENT");

    Assert.Contains(palette.Results, (result) => result.CommandId == "document.hidden");
    Assert.True(Assert.Single(
      palette.Results,
      (result) => result.CommandId == "document.publish").IsEnabled);
    var saveResult = Assert.Single(
      palette.Results,
      (result) => result.CommandId == "document.save");
    Assert.Equal("Ctrl+S", saveResult.DisplayShortcut);
    Assert.Equal("FsusIconSaveAll", saveResult.IconKey);
  }

  [Fact]
  public async Task WraparoundNavigationNestedBackImeAndEscapeUsePublicControlApi()
  {
    var child = new FsusPlatformCommand("format.heading", "Heading")
    {
      Category = "Format",
    };
    var group = FsusNativeMenuItemModel.SubMenu(
      "Format",
      FsusNativeMenuItemModel.Action(child));
    group.Id = "group.format";
    var open = new FsusPlatformCommand("file.open", "Open File");
    var invoker = new Button { Content = "Open commands", Focusable = true };
    var palette = new FsusCommandPalette
    {
      CommandTree = [group, FsusNativeMenuItemModel.Action(open)],
    };
    var host = new FsusOverlayHost();
    await palette.OpenAsync(host, invoker);

    Assert.Equal("group.format", palette.SelectedCommandId);
    Assert.True(await palette.HandleKeyAsync(Key.Up));
    Assert.Equal("file.open", palette.SelectedCommandId);
    Assert.True(await palette.HandleKeyAsync(Key.Down));
    Assert.Equal("group.format", palette.SelectedCommandId);
    Assert.True(await palette.HandleKeyAsync(Key.Enter));
    Assert.Equal(["Format"], palette.CurrentPath);
    Assert.Equal("format.heading", palette.SelectedCommandId);

    Assert.True(await palette.NavigateBackAsync());
    Assert.Empty(palette.CurrentPath);
    Assert.Equal("group.format", palette.SelectedCommandId);

    palette.BeginImeComposition();
    palette.UpdateImeComposition("op");
    Assert.Equal(string.Empty, palette.Query);
    Assert.False(await palette.HandleKeyAsync(Key.Down));
    palette.CommitImeComposition("open");
    await palette.RefreshAsync();
    Assert.Equal("open", palette.Query);
    Assert.Equal("file.open", Assert.Single(palette.Results).CommandId);

    Assert.True(await palette.HandleKeyAsync(Key.Escape));
    Assert.False(palette.IsOpen);
    Assert.Same(invoker, host.LastRestoredFocus);
  }

  [Fact]
  public async Task ExecutesSyncAndAsyncCommandsWithBusyFailureAndDisabledGuards()
  {
    var syncExecutions = 0;
    var sync = new FsusPlatformCommand("document.sync", "Synchronize document")
    {
      ExecuteAction = _ => syncExecutions++,
    };
    var syncPalette = new FsusCommandPalette
    {
      CommandTree = [FsusNativeMenuItemModel.Action(sync)],
    };
    var host = new FsusOverlayHost();
    await syncPalette.OpenAsync(host);

    Assert.True(await syncPalette.ActivateSelectedAsync());
    Assert.Equal(1, syncExecutions);
    Assert.False(syncPalette.IsOpen);

    var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var asyncCommand = new FsusPlatformCommand("workspace.refresh", "Refresh workspace")
    {
      ExecuteAsyncAction = async (_, cancellationToken) =>
      {
        await completion.Task.WaitAsync(cancellationToken);
      },
    };
    var asyncPalette = new FsusCommandPalette
    {
      CommandTree = [FsusNativeMenuItemModel.Action(asyncCommand)],
    };
    await asyncPalette.OpenAsync(host);
    var execution = asyncPalette.ActivateSelectedAsync().AsTask();

    Assert.True(asyncPalette.IsBusy);
    Assert.Equal(FsusCommandPaletteState.Executing, asyncPalette.State);
    completion.SetResult();
    while (!execution.IsCompleted)
    {
      Dispatcher.UIThread.RunJobs();
      Thread.Yield();
    }
    Assert.True(await execution);
    Assert.False(asyncPalette.IsOpen);

    var disabledExecutions = 0;
    var disabled = new FsusPlatformCommand("workspace.disabled", "Disabled action")
    {
      IsEnabled = false,
      ExecuteAction = _ => disabledExecutions++,
    };
    var disabledPalette = new FsusCommandPalette
    {
      CommandTree = [FsusNativeMenuItemModel.Action(disabled)],
    };
    await disabledPalette.OpenAsync(host);
    Assert.Equal(-1, disabledPalette.SelectedIndex);
    Assert.False(await disabledPalette.ActivateSelectedAsync());
    Assert.Equal(0, disabledExecutions);
    await disabledPalette.CloseAsync();

    var failure = new InvalidOperationException("Workspace is unavailable");
    var failing = new FsusPlatformCommand("workspace.fail", "Failing action")
    {
      ExecuteAsyncAction = (_, _) => ValueTask.FromException(failure),
    };
    var failurePalette = new FsusCommandPalette
    {
      CommandTree = [FsusNativeMenuItemModel.Action(failing)],
    };
    FsusCommandPaletteFailedEventArgs? failed = null;
    failurePalette.Failed += (_, args) => failed = args;
    await failurePalette.OpenAsync(host);

    Assert.False(await failurePalette.ActivateSelectedAsync());
    Assert.True(failurePalette.IsOpen);
    Assert.Equal(FsusCommandPaletteState.Failed, failurePalette.State);
    Assert.Equal("Workspace is unavailable", failurePalette.FailureMessage);
    Assert.Equal(FsusCommandPaletteFailureStage.Execution, failed?.Stage);
    Assert.Equal("workspace.fail", failed?.CommandId);
  }

}
