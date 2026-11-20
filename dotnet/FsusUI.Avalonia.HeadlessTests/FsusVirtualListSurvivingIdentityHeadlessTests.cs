using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusVirtualListSurvivingIdentityHeadlessTests
{
  [AvaloniaFact]
  public void NotifiedInsertionPreservesActualFocusWhenNavigationIndexDiffers()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3200);
    fixture.Settle();
    Assert.Equal(0, fixture.List.FocusedIndex);
    var focused = fixture.List.RealizedContainers.Single(item => item.Key == "row-103");
    Assert.True(focused.Focus());
    Assert.True(focused.IsFocused);
    var before = fixture.VisibleItem();

    fixture.Keys.Insert(50, "inserted");
    fixture.List.NotifyItemsInserted(50, 1);
    fixture.Settle();

    Assert.Equal("row-103", fixture.ActuallyFocusedItem().Key);
    Assert.Equal(104, fixture.ActuallyFocusedItem().Index);
    Assert.Equal(0, fixture.List.FocusedIndex);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3232, fixture.List.ScrollHost.Offset.Y);
  }

  [AvaloniaTheory]
  [InlineData("delete")]
  [InlineData("reorder")]
  [InlineData("rebuild")]
  public void RefreshPreservesSurvivingActualFocusAcrossDataChanges(string mutation)
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToIndex(100);
    fixture.Settle();
    Assert.Equal("row-100", fixture.ActuallyFocusedItem().Key);
    var before = fixture.VisibleItem();
    fixture.ScrollChanges.Clear();
    var expectedIndex = 101;
    if (mutation == "delete")
    {
      fixture.Keys.RemoveAt(50);
      fixture.List.ItemCount = fixture.Keys.Count;
      expectedIndex = 99;
    }
    else if (mutation == "reorder")
    {
      (fixture.Keys[100], fixture.Keys[101]) = (fixture.Keys[101], fixture.Keys[100]);
    }
    else
    {
      var replacement = fixture.Keys.ToList();
      (replacement[100], replacement[101]) = (replacement[101], replacement[100]);
      fixture.Keys = replacement;
      fixture.List.ItemKeyProvider = index => replacement[index];
      fixture.List.ItemProvider = index => replacement[index];
    }
    fixture.List.RefreshWindow();
    fixture.ScrollChanges.Add($"Refresh returned: internal={fixture.List.ScrollOffset}, actual={fixture.List.ScrollHost.Offset.Y}");
    fixture.Settle();

    Assert.Equal("row-100", fixture.ActuallyFocusedItem().Key);
    Assert.Equal(expectedIndex, fixture.ActuallyFocusedItem().Index);
    Assert.Equal(expectedIndex, fixture.List.FocusedIndex);
    Assert.True(before == fixture.VisibleItem(), $"Expected {before}, actual {fixture.VisibleItem()}; {string.Join("; ", fixture.ScrollChanges)}");
    Assert.Equal(expectedIndex * 32, fixture.List.ScrollHost.Offset.Y);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaTheory]
  [InlineData(false)]
  [InlineData(true)]
  public void VariableDataChangesKeepMeasurementsWithSurvivingKeys(bool reorder)
  {
    using var fixture = new MountedList();
    fixture.List.SizeMode = FsusVirtualSizeMode.Variable;
    fixture.List.SetMeasuredSize(0, 64);
    fixture.List.SetMeasuredSize(50, 48);
    fixture.List.SetMeasuredSize(98, 16);
    fixture.List.SetMeasuredSize(100, 80);
    fixture.List.ScrollToIndex(100);
    fixture.List.ScrollToOffset(fixture.List.ScrollOffset + 7);
    fixture.Settle();
    var before = fixture.VisibleItem();
    Assert.Equal(("row-100", -7d), before);
    if (reorder)
    {
      (fixture.Keys[100], fixture.Keys[101]) = (fixture.Keys[101], fixture.Keys[100]);
    }
    else
    {
      fixture.Keys.RemoveAt(50);
      fixture.List.ItemCount = fixture.Keys.Count;
    }
    fixture.List.RefreshWindow();
    fixture.Settle();

    var index = reorder ? 101 : 99;
    Assert.Equal("row-100", fixture.ActuallyFocusedItem().Key);
    Assert.Equal(index, fixture.ActuallyFocusedItem().Index);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(80, fixture.List.GetResolvedSize(index));
    Assert.Equal(reorder ? 4 : 3, fixture.List.RetainedMeasurementCount);
    Assert.Equal(reorder ? 3271 : 3191, fixture.List.ScrollHost.Offset.Y);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaTheory]
  [InlineData(false)]
  [InlineData(true)]
  public async Task DataChangesRemapLoadedIdentitiesAndRejectOldPendingWindow(bool reorder)
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToIndex(100);
    fixture.Settle();
    fixture.List.SourceProvider = (window, _) => ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>(
      Enumerable.Range(window.StartIndex, window.Count)
        .Select(index => new FsusVirtualListItem(index, fixture.Keys[index], fixture.Keys[index])).ToArray());
    Assert.True(await fixture.List.LoadWindowAsync());
    var pending = new TaskCompletionSource<IReadOnlyList<FsusVirtualListItem>>();
    CancellationToken token = default;
    fixture.List.SourceProvider = (_, cancellation) =>
    {
      token = cancellation;
      return new(pending.Task);
    };
    var load = fixture.List.LoadWindowAsync();
    if (reorder)
    {
      (fixture.Keys[100], fixture.Keys[101]) = (fixture.Keys[101], fixture.Keys[100]);
    }
    else
    {
      fixture.Keys.RemoveAt(50);
      fixture.List.ItemCount = fixture.Keys.Count;
    }
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.Equal("row-100", fixture.ActuallyFocusedItem().Key);
    Assert.All(fixture.List.LoadedItems, item => Assert.Equal(fixture.Keys[item.Index], item.Key));
    pending.SetResult([new(100, "stale", "Stale row")]);
    Assert.False(await load);
    Assert.True(token.IsCancellationRequested);
    Assert.Equal(FsusVirtualListState.Ready, fixture.List.State);
    Assert.Equal("row-100", fixture.ActuallyFocusedItem().Key);
  }

  [AvaloniaFact]
  public void OrdinaryScrollingDoesNotScanTheEntireKeyedSource()
  {
    using var fixture = new MountedList(itemCount: 100_000);
    var calls = 0;
    fixture.List.ItemKeyProvider = index =>
    {
      calls++;
      return fixture.Keys[index];
    };
    fixture.List.ScrollToOffset(3200);
    fixture.Settle();

    Assert.InRange(calls, 1, 1000);
    Assert.Equal("row-100", fixture.VisibleItem().Key);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaTheory]
  [InlineData(false)]
  [InlineData(true)]
  public void ActualFocusRemainsIndependentOfNavigationThroughDeleteAndReorder(bool reorder)
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3200);
    fixture.Settle();
    Assert.Equal(0, fixture.List.FocusedIndex);
    Assert.True(fixture.List.RealizedContainers.Single(item => item.Key == "row-103").Focus());
    var before = fixture.VisibleItem();
    if (reorder)
    {
      (fixture.Keys[103], fixture.Keys[104]) = (fixture.Keys[104], fixture.Keys[103]);
    }
    else
    {
      fixture.Keys.RemoveAt(50);
      fixture.List.ItemCount = fixture.Keys.Count;
    }
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.Equal("row-103", fixture.ActuallyFocusedItem().Key);
    Assert.Equal(reorder ? 104 : 102, fixture.ActuallyFocusedItem().Index);
    Assert.Equal(0, fixture.List.FocusedIndex);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
  }

  [AvaloniaFact]
  public void SurvivingFocusMovedBeyondTheWindowIsRevealedInsteadOfRebound()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3200);
    fixture.Settle();
    Assert.True(fixture.List.RealizedContainers.Single(item => item.Key == "row-103").Focus());
    var key = fixture.Keys[103];
    fixture.Keys.RemoveAt(103);
    fixture.Keys.Insert(800, key);
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.Equal(key, fixture.ActuallyFocusedItem().Key);
    Assert.Equal(800, fixture.ActuallyFocusedItem().Index);
    Assert.Equal(0, fixture.List.FocusedIndex);
    var top = fixture.ActuallyFocusedItem().TranslatePoint(default, fixture.List.ScrollHost)!.Value.Y;
    Assert.InRange(top, 0, fixture.List.ScrollHost.Viewport.Height - 32);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaFact]
  public void FixedModeOffscreenMeasurementsKeepTheirKeysWhenReorderedInVariableMode()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3200);
    fixture.Settle();
    fixture.List.SetMeasuredSize(900, 96);
    (fixture.Keys[900], fixture.Keys[901]) = (fixture.Keys[901], fixture.Keys[900]);
    fixture.List.SizeMode = FsusVirtualSizeMode.Variable;
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.Equal(96, fixture.List.GetResolvedSize(901));
    Assert.Equal(32, fixture.List.GetResolvedSize(900));
    Assert.Equal("row-100", fixture.VisibleItem().Key);
  }

  [AvaloniaFact]
  public void RebuiltSourceWithMoreItemsPreservesSurvivingActualFocus()
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToIndex(100);
    fixture.Settle();
    var before = fixture.VisibleItem();
    var replacement = fixture.Keys.ToList();
    (replacement[100], replacement[101]) = (replacement[101], replacement[100]);
    replacement.Add("new-tail");
    fixture.Keys = replacement;
    fixture.List.ItemKeyProvider = index => replacement[index];
    fixture.List.ItemProvider = index => replacement[index];
    fixture.List.ItemCount = replacement.Count;
    fixture.List.RefreshWindow();
    fixture.Settle();

    Assert.Equal("row-100", fixture.ActuallyFocusedItem().Key);
    Assert.Equal(101, fixture.ActuallyFocusedItem().Index);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3232, fixture.List.ScrollHost.Offset.Y);
  }

  private sealed class MountedList : IDisposable
  {
    public List<string> ScrollChanges { get; } = [];
    public List<string> Keys { get; set; }
    public FsusVirtualList List { get; }
    public Window Window { get; }

    public MountedList(int itemCount = 1000)
    {
      Keys = Enumerable.Range(0, itemCount).Select(index => $"row-{index}").ToList();
      List = new FsusVirtualList
      {
        FontFamily = new FontFamily("DejaVu Sans"),
        ItemCount = Keys.Count,
        FixedItemSize = 32,
        ViewportSize = 320,
        Overscan = 2,
        ItemKeyProvider = index => Keys[index],
        ItemProvider = index => Keys[index],
      };
      List.RefreshWindow();
      List.ScrollHost.PropertyChanged += (_, change) =>
      {
        if (change.Property == ScrollViewer.OffsetProperty || change.Property == ScrollViewer.ExtentProperty)
        {
          ScrollChanges.Add($"{change.Property.Name}: internal={List.ScrollOffset}, actual={List.ScrollHost.Offset.Y}, extent={List.ScrollHost.Extent.Height}");
        }
      };
      Window = new Window { Width = 360, Height = 320, Content = List };
      Window.Show();
      Settle();
      Assert.Equal(320, List.ScrollHost.Viewport.Height);
    }

    public void Settle()
    {
      Window.UpdateLayout();
      Dispatcher.UIThread.RunJobs();
      Window.UpdateLayout();
      Dispatcher.UIThread.RunJobs();
    }

    public FsusVirtualListItemContainer ActuallyFocusedItem() =>
      Assert.Single(List.RealizedContainers, item => item.IsFocused);

    public (string Key, double Top) VisibleItem()
    {
      var first = List.RealizedContainers
        .Select(item => (item.Key, Top: item.TranslatePoint(default, List.ScrollHost)!.Value.Y, item.Bounds.Height))
        .Where(item => item.Top + item.Height > 0 && item.Top < List.ScrollHost.Viewport.Height)
        .OrderBy(item => item.Top).First();
      return (first.Key, first.Top);
    }

    public void Dispose() => Window.Close();
  }
}
