using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTransferHeadlessTests
{
  [AvaloniaFact]
  public void WindowKeyboardInputNavigatesSelectsAndMovesWithoutHelperCalls()
  {
    var transfer = new FsusTransfer { AccessibleName = "Review routing" };
    transfer.Items.Add(new FsusTransferItem("alpha", "Alpha"));
    transfer.Items.Add(new FsusTransferItem("locked", "Locked") { IsDisabled = true });
    transfer.Items.Add(new FsusTransferItem("beta", "Beta"));
    transfer.RefreshLists();
    var window = Mount(transfer);
    try
    {
      Assert.True(transfer.Focus());
      Assert.True(transfer.IsFocused);
      window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, null);
      Assert.Equal(2, transfer.HighlightedLeftIndex);
      window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, null);
      Assert.Equal(new object?[] { "beta" }, transfer.SelectedLeftValues);
      window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
      Assert.Equal(new object?[] { "beta" }, transfer.TargetValues);
      Assert.Empty(transfer.SelectedLeftValues);
      Assert.Equal(new[] { "alpha", "locked" }, transfer.FilteredLeftItems.Select(item => item.Value));
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void MountedTransferRechecksItemDisabledAfterRightSelection()
  {
    var transfer = new FsusTransfer();
    var item = new FsusTransferItem("alpha", "Alpha");
    transfer.Items.Add(item);
    transfer.RefreshLists();
    var window = Mount(transfer);
    try
    {
      Assert.True(transfer.ToggleLeftSelection(item.Value));
      Assert.True(transfer.MoveSelectedRight());
      Assert.True(transfer.ToggleRightSelection(item.Value));
      item.IsDisabled = true;

      Assert.False(transfer.MoveSelectedLeft());
      Assert.Equal(new object?[] { "alpha" }, transfer.TargetValues);
      Assert.Empty(transfer.SelectedRightValues);
      item.IsDisabled = false;
      Assert.True(transfer.ToggleRightSelection(item.Value));
      Assert.True(transfer.MoveSelectedLeft());
      Assert.Empty(transfer.TargetValues);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void DisabledParentBlocksMountedKeyboardSelectionAndBothMoves()
  {
    var transfer = new FsusTransfer();
    transfer.Items.Add(new FsusTransferItem("alpha", "Alpha"));
    transfer.Items.Add(new FsusTransferItem("beta", "Beta"));
    transfer.Items.Add(new FsusTransferItem("gamma", "Gamma"));
    transfer.RefreshLists();
    var parent = new Border { Child = transfer };
    var window = Mount(parent);
    try
    {
      transfer.ToggleLeftSelection("alpha");
      Assert.True(transfer.MoveSelectedRight());
      transfer.ToggleRightSelection("alpha");
      transfer.ToggleLeftSelection("beta");
      Assert.True(transfer.Focus());
      parent.IsEnabled = false;
      Assert.False(transfer.IsEffectivelyEnabled);
      var highlighted = transfer.HighlightedLeftIndex;

      window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, null);
      window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, null);
      window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
      Assert.False(transfer.ToggleLeftSelection("gamma"));
      Assert.False(transfer.ToggleRightSelection("alpha"));
      Assert.False(transfer.MoveSelectedLeft());
      Assert.False(transfer.MoveSelectedRight());
      Assert.Equal(highlighted, transfer.HighlightedLeftIndex);
      Assert.Equal(new object?[] { "alpha" }, transfer.TargetValues);
      Assert.Equal(new object?[] { "beta" }, transfer.SelectedLeftValues);
      Assert.Equal(new object?[] { "alpha" }, transfer.SelectedRightValues);

      parent.IsEnabled = true;
      Assert.True(transfer.Focus());
      window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
      Assert.Equal(new object?[] { "alpha", "beta" }, transfer.TargetValues);
      Assert.True(transfer.MoveSelectedLeft());
      Assert.Equal(new object?[] { "beta" }, transfer.TargetValues);
    }
    finally
    {
      window.Close();
    }
  }

  private static Window Mount(Control control)
  {
    var window = new Window { Content = control, Width = 640, Height = 240 };
    window.Show();
    window.Measure(new Size(640, 240));
    window.Arrange(new Rect(0, 0, 640, 240));
    Dispatcher.UIThread.RunJobs();
    Assert.Same(window, TopLevel.GetTopLevel(control));
    return window;
  }
}
