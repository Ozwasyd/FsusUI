using Avalonia.Headless.XUnit;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusVirtualListEmptyTransitionHeadlessTests
{
  [AvaloniaTheory]
  [InlineData(false)]
  [InlineData(true)]
  public async Task EmptyTransitionCancelsLoadEvenBeforeFirstRealization(bool lateFailure)
  {
    var list = new FsusVirtualList { ItemCount = 1 };
    var pending = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    CancellationToken observed = default;
    list.SourceProvider = (_, token) =>
    {
      observed = token;
      return new(pending.Task);
    };
    var loading = list.LoadWindowAsync();
    list.ItemCount = 0;
    list.RefreshWindow();
    Assert.True(observed.IsCancellationRequested);
    if (lateFailure)
    {
      pending.SetException(new InvalidOperationException("late provider failure"));
    }
    else
    {
      pending.SetResult([new(0, "stale", "Stale")]);
    }
    Assert.False(await loading);
    Assert.Empty(list.LoadedItems);
    Assert.Equal(FsusVirtualListState.Ready, list.State);
    Assert.Equal("No items", list.DisplayText);
  }

  [AvaloniaFact]
  public async Task RefreshWhileInitiallyEmptyDoesNotCancelAnActiveLoad()
  {
    var list = new FsusVirtualList { ItemCount = 0 };
    var pending = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    CancellationToken observed = default;
    list.SourceProvider = (_, token) =>
    {
      observed = token;
      return new(pending.Task);
    };
    var loading = list.LoadWindowAsync();
    list.RefreshWindow();
    Assert.False(observed.IsCancellationRequested);
    pending.SetResult([new(0, "fresh", "Fresh")]);
    Assert.True(await loading);
    Assert.Equal("fresh", Assert.Single(list.LoadedItems).Key);
  }
}
