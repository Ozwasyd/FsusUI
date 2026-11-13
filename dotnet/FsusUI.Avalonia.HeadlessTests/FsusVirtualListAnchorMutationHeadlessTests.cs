using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusVirtualListAnchorMutationHeadlessTests
{
  [AvaloniaFact]
  public void MeasuredShortRowsCoverTheMountedViewportWithinExistingBudget()
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.Overscan = 0;
    for (var index = 0; index < 20; index++)
    {
      fixture.List.SetMeasuredSize(index, 16);
    }
    fixture.List.RefreshWindow();
    fixture.Settle();

    var last = fixture.List.RealizedContainers.MaxBy(item => item.Index)!;
    var bottom = last.TranslatePoint(new Point(0, last.Bounds.Height), fixture.List.ScrollHost)!.Value.Y;
    Assert.True(bottom >= fixture.List.ScrollHost.Viewport.Height,
      $"Realized rows end at {bottom}, viewport ends at {fixture.List.ScrollHost.Viewport.Height}.");
    Assert.Equal(20, fixture.List.RealizedContainerCount);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaFact]
  public void MissingInsertionNotificationChangesVisibleIdentityAsANegativeControl()
  {
    using var fixture = new MountedList();
    fixture.Window.MouseWheel(new Point(120, 80), new Vector(0, -80));
    fixture.Settle();
    Assert.True(fixture.List.ScrollHost.Offset.Y > 320);
    var before = fixture.VisibleItem();

    fixture.Keys.Insert(50, "inserted");
    fixture.List.ItemCount = fixture.Keys.Count;
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.NotEqual(before.Key, fixture.VisibleItem().Key);
    Assert.Equal(before.Top, fixture.VisibleItem().Top, 5);
  }

  [AvaloniaFact]
  public void MountedOffsetInsertionPreservesVisibleIdentityWithoutMovingKeyboardFocus()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    Assert.Equal(0, fixture.List.FocusedIndex);
    var before = fixture.VisibleItem();
    Assert.Equal("item-100", before.Key);
    Assert.Equal(-7, before.Top, 5);

    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3239, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(0, fixture.List.FocusedIndex);
  }

  [AvaloniaFact]
  public void MountedWheelInsertionUsesVisibleAnchorRatherThanFocusOrOverscan()
  {
    using var fixture = new MountedList();
    fixture.Window.MouseWheel(new Point(120, 80), new Vector(0, -80));
    fixture.Settle();
    Assert.True(fixture.List.ScrollHost.Offset.Y > 320);
    Assert.Equal(0, fixture.List.FocusedIndex);
    var before = fixture.VisibleItem();
    var visibleIndex = fixture.Keys.IndexOf(before.Key);
    Assert.True(fixture.List.RealizedItems[0].Index < visibleIndex);

    fixture.Keys.Insert(visibleIndex, "inserted");
    fixture.List.NotifyItemsInserted(visibleIndex, 1);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(before.Key, fixture.List.AnchorKey);
    Assert.Equal(0, fixture.List.FocusedIndex);
  }

  [AvaloniaFact]
  public void OffscreenMeasurementUpdatesActualScrollHostAndVisiblePosition()
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    var before = fixture.VisibleItem();
    Assert.DoesNotContain(fixture.List.RealizedContainers, item => item.Index == 0);

    fixture.List.SetMeasuredSize(0, 64);
    fixture.Settle();

    Assert.Equal(3239, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(fixture.Keys.Count * 32 + 32, fixture.List.ScrollHost.Extent.Height, 5);
  }

  [AvaloniaTheory]
  [InlineData(0)]
  [InlineData(98)]
  [InlineData(100)]
  [InlineData(105)]
  [InlineData(999)]
  public void InsertionCompensatesOnlyAtOrBeforeVisibleAnchor(int index)
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    var before = fixture.VisibleItem();

    fixture.Keys.Insert(index, "inserted");
    fixture.List.NotifyItemsInserted(index, 1);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(index <= 100 ? 3239 : 3207, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(index == 0 ? 1 : 0, fixture.List.FocusedIndex);
    Assert.Equal(before.Key, fixture.List.AnchorKey);
  }

  [AvaloniaFact]
  public async Task FocusShiftsIndependentlyFromWheelAnchorAndKeyboardStillNavigates()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToIndex(100);
    fixture.Settle();
    Assert.True(fixture.List.RealizedContainers.Single(item => item.Index == 100).IsFocused);
    fixture.Window.MouseWheel(new Point(120, 80), new Vector(0, -16));
    fixture.Settle();
    var before = fixture.VisibleItem();
    Assert.NotEqual("item-100", before.Key);

    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(101, fixture.List.FocusedIndex);
    Assert.Equal("item-100", fixture.Keys[fixture.List.FocusedIndex]);
    Assert.True(await fixture.List.PressAsync(Key.Down));
    fixture.Settle();
    Assert.Equal(102, fixture.List.FocusedIndex);
    Assert.True(fixture.List.RealizedContainers.Single(item => item.Index == 102).IsFocused);
  }

  [AvaloniaFact]
  public void InsertionRetainsActualFocusOnTheSameVisibleIdentity()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToIndex(100);
    fixture.Settle();
    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();

    var focused = Assert.Single(fixture.List.RealizedContainers, item => item.IsFocused);
    Assert.Equal("item-100", focused.Key);
    Assert.Equal(101, focused.Index);
    Assert.Equal(101, fixture.List.FocusedIndex);
  }

  [AvaloniaFact]
  public void VariableMeasurementsAndInsertionKeepPartialVisibleRowStable()
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.SetMeasuredSize(0, 64);
    fixture.List.SetMeasuredSize(98, 48);
    fixture.List.SetMeasuredSize(100, 80);
    fixture.List.ScrollToIndex(100);
    fixture.List.ScrollToOffset(fixture.List.ScrollOffset + 7);
    fixture.Settle();
    var before = fixture.VisibleItem();
    Assert.Equal(("item-100", -7d), before);

    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(48, fixture.List.GetResolvedSize(99));
    Assert.Equal(80, fixture.List.GetResolvedSize(101));

    fixture.List.SetMeasuredSize(50, 16);
    fixture.Settle();
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaFact]
  public void MeasurementAfterViewportUpdatesExtentWithoutMovingVisibleRow()
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    var before = fixture.VisibleItem();

    fixture.List.SetMeasuredSize(900, 96);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3207, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(32064, fixture.List.ScrollHost.Extent.Height, 5);
  }

  [AvaloniaFact]
  public void CacheEvictionCompensatesNetPrefixChangeAndFixedModeKeepsItsEstimate()
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.VirtualizationBudget = fixture.List.VirtualizationBudget with { RetainedMeasurements = 1 };
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    var before = fixture.VisibleItem();
    fixture.List.SetMeasuredSize(0, 64);
    fixture.List.SetMeasuredSize(1, 48);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3223, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(1, fixture.List.RetainedMeasurementCount);
    Assert.Equal(32, fixture.List.GetResolvedSize(0));
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);

    using var fixedFixture = new MountedList();
    fixedFixture.List.ScrollToOffset(3207);
    fixedFixture.Settle();
    fixedFixture.List.SetMeasuredSize(0, 64);
    fixedFixture.Settle();
    Assert.Equal(3207, fixedFixture.List.ScrollOffset, 5);
    Assert.Equal(fixedFixture.List.ScrollOffset, fixedFixture.List.ScrollHost.Offset.Y, 5);
  }

  [AvaloniaFact]
  public void TailRemovalClampsAndEmptyResetSynchronizesActualHostWithoutResolvingAnItem()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToIndex(990);
    fixture.Settle();
    fixture.Keys.RemoveRange(900, 100);
    fixture.List.ItemCount = fixture.Keys.Count;
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.Equal(28480, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.InRange(fixture.List.FocusedIndex, 0, 899);
    Assert.All(fixture.List.RealizedContainers, item => Assert.InRange(item.Index, 0, 899));

    fixture.Keys.Clear();
    fixture.List.ItemCount = 0;
    fixture.List.RefreshWindow();
    fixture.Settle();
    Assert.Equal(0, fixture.List.ScrollOffset);
    Assert.Equal(0, fixture.List.ScrollHost.Offset.Y);
    Assert.Empty(fixture.List.RealizedContainers);
    Assert.Empty(fixture.List.VisualHost.Children);
    Assert.Equal(string.Empty, fixture.List.CaptureAnchor().Key);
    Assert.Equal("No items", fixture.List.DisplayText);

    fixture.Keys.Add("reset-item");
    fixture.List.ItemCount = 1;
    fixture.List.RefreshWindow();
    fixture.Settle();
    Assert.Equal("reset-item", fixture.VisibleItem().Key);
    Assert.Equal(0, fixture.List.ScrollHost.Offset.Y);
    fixture.List.NotifyItemsInserted(0, 0);
    Assert.Equal(1, fixture.List.ItemCount);
  }

  [AvaloniaFact]
  public void InsertionAtBottomKeepsAnchorAfterPresenterExtentCorrection()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(double.MaxValue);
    fixture.Settle();
    var before = fixture.VisibleItem();
    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(31712, fixture.List.ScrollHost.Offset.Y, 5);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y, 5);
  }

  [AvaloniaFact]
  public async Task SupersededAndUnloadedProviderResultsCannotReplaceCurrentWindow()
  {
    using var fixture = new MountedList();
    var first = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    var detached = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    CancellationToken detachedToken = default;
    var calls = 0;
    fixture.List.SourceProvider = (window, token) =>
    {
      calls++;
      if (calls == 1) return new(first.Task);
      if (calls == 3)
      {
        detachedToken = token;
        return new(detached.Task);
      }
      return ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>([
        new(window.StartIndex, "current", "Current item"),
      ]);
    };
    var staleLoad = fixture.List.LoadWindowAsync();
    Assert.True(await fixture.List.LoadWindowAsync());
    first.SetResult([new(0, "stale", "Stale item")]);
    Assert.False(await staleLoad);
    Assert.Equal("current", Assert.Single(fixture.List.LoadedItems).Key);

    var detachedLoad = fixture.List.LoadWindowAsync();
    fixture.Window.Content = null;
    fixture.Settle();
    detached.SetResult([new(0, "detached", "Detached item")]);
    Assert.False(await detachedLoad);
    Assert.True(detachedToken.IsCancellationRequested);
    Assert.True(fixture.List.LastLoadCanceled);
    Assert.Equal("current", Assert.Single(fixture.List.LoadedItems).Key);
  }

  [AvaloniaFact]
  public async Task InsertionShiftsLoadedIdentitiesAndRejectsTheOldProviderWindow()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    fixture.List.SourceProvider = (window, _) => ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>(
      Enumerable.Range(window.StartIndex, window.Count)
        .Select(index => new FsusVirtualListItem(index, fixture.Keys[index], fixture.Keys[index])).ToArray());
    Assert.True(await fixture.List.LoadWindowAsync());
    fixture.Settle();
    var before = fixture.VisibleItem();
    var pending = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    CancellationToken pendingToken = default;
    fixture.List.SourceProvider = (_, token) =>
    {
      pendingToken = token;
      return new(pending.Task);
    };
    var pendingLoad = fixture.List.LoadWindowAsync();

    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.All(fixture.List.LoadedItems, item => Assert.Equal(fixture.Keys[item.Index], item.Key));
    pending.SetResult([new(100, "stale", "Stale item")]);
    Assert.False(await pendingLoad);
    Assert.True(pendingToken.IsCancellationRequested);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(FsusVirtualListState.Ready, fixture.List.State);
    Assert.Equal(string.Empty, fixture.List.DisplayText);
  }

  [AvaloniaFact]
  public async Task EmptyResetDropsOldLoadedRowsMeasurementsAndPendingResult()
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.SetMeasuredSize(0, 64);
    fixture.List.SourceProvider = (_, _) => ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>([
      new(0, "old-loaded", "Old loaded row"),
    ]);
    Assert.True(await fixture.List.LoadWindowAsync());
    var pending = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    fixture.List.SourceProvider = (_, _) => new(pending.Task);
    var pendingLoad = fixture.List.LoadWindowAsync();
    fixture.Keys.Clear();
    fixture.List.ItemCount = 0;
    fixture.List.RefreshWindow();
    fixture.Settle();
    pending.SetResult([new(0, "stale", "Stale row")]);

    Assert.False(await pendingLoad);
    Assert.Equal("No items", fixture.List.DisplayText);
    Assert.Empty(fixture.List.LoadedItems);
    Assert.Equal(0, fixture.List.RetainedMeasurementCount);
    fixture.Keys.Add("replacement");
    fixture.List.ItemCount = 1;
    fixture.List.RefreshWindow();
    fixture.Settle();
    Assert.Equal("replacement", fixture.VisibleItem().Key);
    Assert.Equal(32, fixture.List.GetResolvedSize(0));
  }

  [AvaloniaTheory]
  [InlineData(0)]
  [InlineData(2)]
  public void MixedMeasuredRowsCoverPartialScrollAndResizedViewport(int overscan)
  {
    using var fixture = new MountedList(variable: true);
    fixture.List.Overscan = overscan;
    for (var index = 0; index < 40; index++)
    {
      fixture.List.SetMeasuredSize(index, index % 3 == 0 ? 48 : 16);
    }
    fixture.List.ScrollToOffset(207);
    fixture.Window.Height = 480;
    fixture.Settle();

    Assert.Equal(480, fixture.List.ScrollHost.Viewport.Height);
    var last = fixture.List.RealizedContainers.MaxBy(item => item.Index)!;
    Assert.True(last.TranslatePoint(new Point(0, last.Bounds.Height), fixture.List.ScrollHost)!.Value.Y >= 480);
    Assert.True(fixture.VisibleItem().Top <= 0);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaFact]
  public void InsertionIntoAnEmptyListStartsAtTheFirstItem()
  {
    using var fixture = new MountedList();
    fixture.Keys.Clear();
    fixture.List.ItemCount = 0;
    fixture.List.RefreshWindow();
    fixture.Settle();
    fixture.Keys.AddRange(["first", "second", "third"]);
    fixture.List.NotifyItemsInserted(0, 3);
    fixture.Settle();

    Assert.Equal(0, fixture.List.FocusedIndex);
    Assert.Equal(0, fixture.List.ScrollHost.Offset.Y);
    Assert.Equal("first", fixture.VisibleItem().Key);
  }

  [AvaloniaTheory]
  [InlineData(false)]
  [InlineData(true)]
  public async Task LateProviderFailureCannotRestoreErrorAfterMutationOrUnload(bool unload)
  {
    using var fixture = new MountedList();
    var pending = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    fixture.List.SourceProvider = (_, _) => new(pending.Task);
    var load = fixture.List.LoadWindowAsync();
    if (unload)
    {
      fixture.Window.Content = null;
    }
    else
    {
      fixture.Keys.Insert(0, "inserted");
      fixture.List.NotifyItemsInserted(0, 1);
    }
    pending.SetException(new InvalidOperationException("Late provider failure"));

    Assert.False(await load);
    Assert.Equal(FsusVirtualListState.Ready, fixture.List.State);
    Assert.Null(fixture.List.ErrorMessage);
  }

  private sealed class KeyboardList : FsusVirtualList
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class MountedList : IDisposable
  {
    public List<string> Keys { get; } = Enumerable.Range(0, 1000).Select(index => $"item-{index}").ToList();
    public KeyboardList List { get; }
    public Window Window { get; }

    public MountedList(bool variable = false)
    {
      List = new KeyboardList
      {
        FontFamily = new FontFamily("DejaVu Sans"),
        ItemCount = Keys.Count,
        FixedItemSize = 32,
        ViewportSize = 320,
        Overscan = 2,
        SizeMode = variable ? FsusVirtualSizeMode.Variable : FsusVirtualSizeMode.Fixed,
        ItemKeyProvider = index => Keys[index],
        ItemProvider = index => Keys[index],
      };
      List.RefreshWindow();
      Window = new Window { Width = 360, Height = 320, Content = List };
      Window.Show();
      Settle();
      Assert.True(List.ScrollHost.Extent.Height > List.ScrollHost.Viewport.Height);
      Assert.Equal(320, List.ScrollHost.Viewport.Height);
    }

    public void Settle()
    {
      Window.UpdateLayout();
      Dispatcher.UIThread.RunJobs();
      Window.UpdateLayout();
      Dispatcher.UIThread.RunJobs();
    }

    public (string Key, double Top) VisibleItem()
    {
      var visible = List.RealizedContainers
        .Select(item => (item.Key, Top: item.TranslatePoint(default, List.ScrollHost)!.Value.Y, item.Bounds.Height))
        .Where(item => item.Top + item.Height > 0 && item.Top < List.ScrollHost.Viewport.Height)
        .OrderBy(item => item.Top)
        .First();
      return (visible.Key, visible.Top);
    }

    public void Dispose() => Window.Close();
  }
}
