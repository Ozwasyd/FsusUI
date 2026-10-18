using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusVirtualListExternalFocusHeadlessTests
{
  [AvaloniaTheory]
  [InlineData(false)]
  [InlineData(true)]
  public void ReviewedRebuildPairPreservesVisibleAnchorWithActualFocusOutside(bool grow)
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    Assert.True(fixture.External.Focus());
    fixture.AssertExternalFocus();
    Assert.Equal(0, fixture.List.FocusedIndex);
    var before = fixture.VisibleItem();
    Assert.Equal(("row-100", -7d), before);

    fixture.Rebuild(grow);
    fixture.List.RefreshWindow();
    fixture.Settle();

    fixture.AssertExternalFocus();
    Assert.Equal(0, fixture.List.FocusedIndex);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3239, fixture.List.ScrollHost.Offset.Y);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
  }

  [AvaloniaTheory]
  [InlineData("key")]
  [InlineData("content")]
  [InlineData("source")]
  public void IndividualProviderReplacementWithGrowthKeepsExternalFocusAndAnchor(string provider)
  {
    using var fixture = new MountedList();
    fixture.List.ScrollToOffset(3207);
    fixture.Settle();
    Assert.True(fixture.External.Focus());
    var before = fixture.VisibleItem();
    fixture.Rebuild(grow: true, provider: provider);
    fixture.List.RefreshWindow();
    fixture.Settle();

    fixture.AssertExternalFocus();
    Assert.Equal(0, fixture.List.FocusedIndex);
    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(3239, fixture.List.ScrollHost.Offset.Y);
  }

  [AvaloniaTheory]
  [InlineData("rebuild")]
  [InlineData("growing-rebuild")]
  [InlineData("delete")]
  [InlineData("notified-insert")]
  [InlineData("unnotified-insert")]
  [InlineData("append")]
  public void MountedWheelAndSiblingClickKeepExternalFocusThroughMutations(string mutation)
  {
    using var fixture = new MountedList();
    fixture.Window.MouseWheel(new Point(160, 140), new Vector(0, -64));
    fixture.Settle();
    Assert.Equal(3200, fixture.List.ScrollHost.Offset.Y);
    fixture.List.ScrollToOffset(fixture.List.ScrollOffset + 7);
    fixture.Settle();
    Assert.True(fixture.External.Focus());
    fixture.AssertExternalFocus();
    var before = fixture.VisibleItem();
    var clicks = 0;
    fixture.External.Click += (_, _) =>
    {
      clicks++;
      fixture.AssertExternalFocus();
      switch (mutation)
      {
        case "rebuild":
        case "growing-rebuild":
          fixture.Rebuild(mutation == "growing-rebuild");
          break;
        case "delete":
          fixture.Keys.RemoveAt(50);
          fixture.List.ItemCount = fixture.Keys.Count;
          break;
        case "notified-insert":
          fixture.Keys.Insert(50, "inserted");
          fixture.List.NotifyItemsInserted(50, 1);
          return;
        case "unnotified-insert":
          fixture.Keys.Insert(50, "inserted");
          fixture.List.ItemCount = fixture.Keys.Count;
          break;
        case "append":
          fixture.Keys.Add("new-tail");
          fixture.List.ItemCount = fixture.Keys.Count;
          break;
      }
      fixture.List.RefreshWindow();
    };

    var click = fixture.External.TranslatePoint(
      new Point(fixture.External.Bounds.Width / 2, fixture.External.Bounds.Height / 2), fixture.Window)!.Value;
    fixture.Window.MouseMove(click);
    fixture.Window.MouseDown(click, MouseButton.Left);
    fixture.Window.MouseUp(click, MouseButton.Left);
    fixture.Settle();

    Assert.Equal(1, clicks);
    fixture.AssertExternalFocus();
    Assert.Equal(0, fixture.List.FocusedIndex);
    if (mutation == "unnotified-insert")
    {
      Assert.NotEqual(before.Key, fixture.VisibleItem().Key);
      Assert.Equal(before.Top, fixture.VisibleItem().Top);
    }
    else
    {
      Assert.Equal(before, fixture.VisibleItem());
    }
    var expectedOffset = mutation switch
    {
      "delete" => 3175,
      "append" or "unnotified-insert" => 3207,
      _ => 3239,
    };
    Assert.Equal(expectedOffset, fixture.List.ScrollHost.Offset.Y);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
    Assert.True(fixture.List.EvaluateBudget().WithinBudget);
  }

  [AvaloniaTheory]
  [InlineData("offset-insert")]
  [InlineData("measurement")]
  [InlineData("short-rows")]
  [InlineData("actual-insert")]
  [InlineData("delete")]
  [InlineData("reorder")]
  [InlineData("rebuild")]
  public void ReplaysSevenIndependentReviewScenarios(string scenario)
  {
    using var fixture = new MountedList();
    if (scenario == "short-rows")
    {
      fixture.List.SizeMode = FsusVirtualSizeMode.Variable;
      fixture.List.Overscan = 0;
      for (var index = 0; index < 20; index++) fixture.List.SetMeasuredSize(index, 16);
      fixture.List.RefreshWindow();
      fixture.Settle();
      Assert.Equal(20, fixture.List.RealizedContainerCount);
      var last = fixture.List.RealizedContainers.MaxBy(item => item.Index)!;
      Assert.Equal(320, last.TranslatePoint(new Point(0, last.Bounds.Height), fixture.List.ScrollHost)!.Value.Y);
      Assert.Equal(64, fixture.List.VirtualizationBudget.RealizedContainers);
      Assert.True(fixture.List.EvaluateBudget().WithinBudget);
      return;
    }
    if (scenario == "measurement") fixture.List.SizeMode = FsusVirtualSizeMode.Variable;
    if (scenario is "delete" or "reorder" or "rebuild") fixture.List.ScrollToIndex(100);
    else fixture.List.ScrollToOffset(3200);
    fixture.Settle();
    var before = fixture.VisibleItem();
    if (scenario == "actual-insert")
    {
      Assert.Equal(0, fixture.List.FocusedIndex);
      Assert.True(fixture.List.RealizedContainers.Single(item => item.Key == "row-103").Focus());
    }
    if (scenario is "offset-insert" or "actual-insert")
    {
      fixture.Keys.Insert(50, "inserted");
      fixture.List.NotifyItemsInserted(50, 1);
    }
    else if (scenario == "measurement") fixture.List.SetMeasuredSize(0, 64);
    else
    {
      if (scenario == "delete")
      {
        fixture.Keys.RemoveAt(50);
        fixture.List.ItemCount = fixture.Keys.Count;
      }
      else if (scenario == "reorder")
        (fixture.Keys[100], fixture.Keys[101]) = (fixture.Keys[101], fixture.Keys[100]);
      else fixture.Rebuild(grow: false);
      fixture.List.RefreshWindow();
    }
    fixture.Settle();

    Assert.Equal(before, fixture.VisibleItem());
    Assert.Equal(scenario == "delete" ? 3168 : 3232, fixture.List.ScrollHost.Offset.Y);
    Assert.Equal(fixture.List.ScrollOffset, fixture.List.ScrollHost.Offset.Y);
    if (scenario is "delete" or "reorder" or "rebuild" or "actual-insert")
    {
      var actual = Assert.Single(fixture.List.RealizedContainers, item => item.IsFocused);
      Assert.Equal(scenario == "actual-insert" ? "row-103" : "row-100", actual.Key);
    }
  }

  private sealed class MountedList : IDisposable
  {
    public List<string> Keys { get; private set; } = Enumerable.Range(0, 1000).Select(index => $"row-{index}").ToList();
    public FsusVirtualList List { get; }
    public Button External { get; } = new() { Content = "Apply data", Height = 40 };
    public Window Window { get; }

    public MountedList()
    {
      List = new FsusVirtualList
      {
        ItemCount = Keys.Count, FixedItemSize = 32, ViewportSize = 320, Overscan = 2,
        ItemKeyProvider = index => Keys[index], ItemProvider = index => Keys[index],
      };
      List.RefreshWindow();
      var content = new Grid { RowDefinitions = new RowDefinitions("40,*") };
      content.Children.Add(External);
      content.Children.Add(List);
      Grid.SetRow(List, 1);
      Window = new Window
      {
        Width = 400, Height = 360, Content = content, FontFamily = new FontFamily("DejaVu Sans"),
      };
      Window.Show();
      Settle();
      Assert.Equal(320, List.ScrollHost.Viewport.Height);
    }

    public void Rebuild(bool grow, string provider = "both")
    {
      var replacement = Keys.ToList();
      (replacement[100], replacement[101]) = (replacement[101], replacement[100]);
      if (grow) replacement.Add("new-tail");
      Keys = replacement;
      if (provider is "both" or "key") List.ItemKeyProvider = index => replacement[index];
      if (provider is "both" or "content") List.ItemProvider = index => replacement[index];
      if (provider == "source")
        List.SourceProvider = (window, _) => ValueTask.FromResult<IReadOnlyList<FsusVirtualListItem>>(
          Enumerable.Range(window.StartIndex, window.Count)
            .Select(index => new FsusVirtualListItem(index, replacement[index], replacement[index])).ToArray());
      List.ItemCount = replacement.Count;
    }

    public void AssertExternalFocus()
    {
      Assert.True(External.IsFocused);
      Assert.False(List.IsKeyboardFocusWithin);
      Assert.DoesNotContain(List.RealizedContainers, item => item.IsKeyboardFocusWithin);
    }

    public void Settle()
    {
      Window.UpdateLayout(); Dispatcher.UIThread.RunJobs();
      Window.UpdateLayout(); Dispatcher.UIThread.RunJobs();
    }

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
