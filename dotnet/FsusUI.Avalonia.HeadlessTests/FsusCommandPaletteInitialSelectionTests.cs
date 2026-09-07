using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusCommandPaletteInitialSelectionTests
{
  [AvaloniaTheory]
  [InlineData(FsusCommandPaletteInitialSelection.FirstEnabled, 0, "Command results")]
  [InlineData(FsusCommandPaletteInitialSelection.None, -1, "Available commands")]
  public async Task InitialSelectionAndResultsAccessibleNameAreConsumerConfigurable(
    FsusCommandPaletteInitialSelection policy,
    int expectedSelectedIndex,
    string expectedResultsName)
  {
    var invoker = new Button { Content = "Open commands", Focusable = true };
    var host = new FsusOverlayHost();
    var window = new Window
    {
      Width = 900,
      Height = 620,
      ShowInTaskbar = false,
      Content = host,
    };
    host.Children.Add(invoker);
    window.Show();

    var command = new FsusPlatformCommand("workspace.open", "Open workspace")
    {
      ExecuteAction = _ => { },
    };
    var palette = new FsusCommandPalette
    {
      CommandTree = [FsusNativeMenuItemModel.Action(command)],
      InitialSelection = policy,
      ResultsAccessibleName = expectedResultsName,
    };

    await palette.OpenAsync(host, invoker);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(expectedSelectedIndex, palette.SelectedIndex);
    Assert.Equal(
      expectedSelectedIndex == 0 ? "workspace.open" : string.Empty,
      palette.SelectedCommandId);
    if (policy == FsusCommandPaletteInitialSelection.None)
    {
      Assert.False(await palette.HandleKeyAsync(Key.Enter));
    }

    Assert.True(await palette.HandleKeyAsync(Key.Down));
    if (policy == FsusCommandPaletteInitialSelection.None)
    {
      Assert.Equal(0, palette.SelectedIndex);
      Assert.True(await palette.HandleKeyAsync(Key.Enter));
      Assert.False(palette.IsOpen);
    }

    var list = Assert.Single(palette.GetVisualDescendants().OfType<FsusVirtualList>());
    Assert.Equal(expectedResultsName, list.AccessibleName);
    window.Close();
  }
}
