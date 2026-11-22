using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Demo.Gallery;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTransferRenderedInteractionTests
{
  [AvaloniaFact]
  public void ProductionGalleryMountsTransferWithReadableRows()
  {
    var route = Assert.Single(FsusAvaloniaGalleryRegistry.AllRoutes, item => item.ComponentId == "upload-transfer");
    var window = new Window { Content = route.CreatePage(), Width = 900, Height = 700 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var transfer = Assert.Single(window.GetVisualDescendants().OfType<FsusTransfer>());
      Assert.Contains(transfer.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Draft review"));
      Assert.Contains(transfer.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Release review") && !item.IsEnabled);
    }
    finally { window.Close(); }
  }

  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void DefaultTransferRendersRowsAndMovesSelectedItemWithPointer(FsusThemeVariant variant)
  {
    var transfer = new FsusTransfer { AccessibleName = "Transfer", IsFilterable = true };
    transfer.Items.Add(new FsusTransferItem("alpha", "Alpha"));
    transfer.Items.Add(new FsusTransferItem("beta", "Beta") { IsDisabled = true });
    transfer.RefreshLists();
    var window = new Window { Content = transfer, Width = 640, Height = 320, ShowInTaskbar = false };
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions { Variant = variant });
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(new global::Avalonia.Markup.Xaml.Styling.StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests")) { Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml") });
    window.Show();
    try
    {
      window.UpdateLayout();
      var rows = transfer.GetVisualDescendants().OfType<CheckBox>().ToArray();
      Assert.Contains(rows, row => Equals(row.Content, "Alpha") && row.IsEnabled);
      Assert.Contains(rows, row => Equals(row.Content, "Beta") && !row.IsEnabled);
      var alpha = Assert.Single(rows, row => Equals(row.Content, "Alpha"));
      var peer = Assert.IsAssignableFrom<AutomationPeer>(ControlAutomationPeer.CreatePeerForElement(alpha));
      var toggle = Assert.IsAssignableFrom<IToggleProvider>(peer);
      Assert.Equal(ToggleState.Off, toggle.ToggleState);
      Assert.True(window.TryFindResource("FsusThemeMutedTextBrush", out var mutedResource));
      var muted = Assert.IsAssignableFrom<ISolidColorBrush>(mutedResource);
      var indicator = Assert.Single(alpha.GetVisualDescendants().OfType<Border>(), border => border.Name == "PART_TransferIndicator");
      Assert.Equal(muted.Color, Assert.IsAssignableFrom<ISolidColorBrush>(indicator.BorderBrush).Color);
      var input = Assert.Single(transfer.GetVisualDescendants().OfType<TextBox>());
      Assert.Equal(muted.Color, Assert.IsAssignableFrom<ISolidColorBrush>(input.PlaceholderForeground).Color);
      Click(window, alpha);
      Assert.Equal(new object?[] { "alpha" }, transfer.SelectedLeftValues);
      Assert.Equal(ToggleState.On, toggle.ToggleState);
      Assert.True(Assert.Single(alpha.GetVisualDescendants().OfType<TextBlock>(), text => text.Name == "PART_TransferCheck").IsVisible);
      var move = Assert.Single(transfer.GetVisualDescendants().OfType<Button>(), button => AutomationProperties.GetName(button) == "Move selected right");
      Click(window, move);
      Assert.Equal(new object?[] { "alpha" }, transfer.TargetValues);
      Assert.Empty(transfer.SelectedLeftValues);
      window.UpdateLayout();
      var target = Assert.Single(transfer.GetVisualDescendants().OfType<ListBox>(), list => AutomationProperties.GetName(list) == "Target items");
      var selectedTarget = Assert.Single(target.GetVisualDescendants().OfType<CheckBox>(), row => Equals(row.Content, "Alpha"));
      Click(window, selectedTarget);
      Assert.Equal(new object?[] { "alpha" }, transfer.SelectedRightValues);
      var moveBack = Assert.Single(transfer.GetVisualDescendants().OfType<Button>(), button => AutomationProperties.GetName(button) == "Move selected left");
      Click(window, moveBack);
      Assert.Empty(transfer.TargetValues);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void ProgrammaticFilterUpdatesVisibleRowsAndPreservesCustomContent()
  {
    var transfer = new FsusTransfer { IsFilterable = true };
    transfer.Items.Add(new FsusTransferItem("alpha", "Alpha"));
    transfer.Items.Add(new FsusTransferItem("beta", "Beta"));
    transfer.RefreshLists();
    var window = new Window { Content = transfer, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      transfer.ApplyFilter("Beta");
      window.UpdateLayout();
      var input = Assert.Single(transfer.GetVisualDescendants().OfType<TextBox>());
      Assert.Equal("Beta", input.Text);
      Assert.Contains(transfer.GetVisualDescendants().OfType<CheckBox>(), row => Equals(row.Content, "Beta"));
      Assert.DoesNotContain(transfer.GetVisualDescendants().OfType<CheckBox>(), row => Equals(row.Content, "Alpha") && row.IsVisible);
      Assert.True(input.Focus());
      input.SelectAll();
      window.KeyTextInput("Alpha");
      Dispatcher.UIThread.RunJobs();
      window.UpdateLayout();
      Assert.Equal("Alpha", transfer.FilterText);
      Assert.Contains(transfer.GetVisualDescendants().OfType<CheckBox>(), row => Equals(row.Content, "Alpha") && row.IsVisible);
      var custom = new Border();
      transfer.Content = custom;
      transfer.ApplyFilter("Alpha");
      Assert.Same(custom, transfer.Content);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void FilterabilityChangesAfterMountUpdateTheInput()
  {
    var transfer = new FsusTransfer();
    var window = new Window { Content = transfer, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var input = Assert.Single(transfer.GetVisualDescendants().OfType<TextBox>());
      Assert.False(input.IsVisible);
      transfer.IsFilterable = true;
      Assert.True(input.IsVisible);
      transfer.IsFilterable = false;
      Assert.False(input.IsVisible);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void ItemDisabledAfterMountUpdatesTheVisibleRow()
  {
    var item = new FsusTransferItem("alpha", "Alpha");
    var transfer = new FsusTransfer();
    transfer.Items.Add(item);
    transfer.RefreshLists();
    var window = new Window { Content = transfer, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var row = Assert.Single(transfer.GetVisualDescendants().OfType<CheckBox>(), element => Equals(element.Content, "Alpha"));
      Assert.True(row.IsEnabled);
      item.IsDisabled = true;
      Assert.False(row.IsEnabled);
      Assert.False(row.IsChecked == true);
      Assert.Empty(transfer.SelectedLeftValues);
      item.IsDisabled = false;
      Assert.True(row.IsEnabled);
      Click(window, row);
      Assert.Equal(new object?[] { "alpha" }, transfer.SelectedLeftValues);
      item.IsDisabled = true;
      Assert.False(row.IsEnabled);
      var move = Assert.Single(transfer.GetVisualDescendants().OfType<Button>(), button => AutomationProperties.GetName(button) == "Move selected right");
      Assert.False(move.IsEnabled);
      Assert.False(transfer.MoveSelectedRight());
      Assert.Empty(transfer.TargetValues);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void KeyboardOnRenderedRowAndMoveButtonUpdatesTheModel()
  {
    var transfer = new FsusTransfer();
    transfer.Items.Add(new FsusTransferItem("alpha", "Alpha"));
    transfer.RefreshLists();
    var window = new Window { Content = transfer, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var row = Assert.Single(transfer.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Alpha"));
      Assert.True(row.Focus());
      window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, null);
      window.KeyRelease(Key.Space, RawInputModifiers.None, PhysicalKey.Space, null);
      Assert.Equal(new object?[] { "alpha" }, transfer.SelectedLeftValues);
      var move = Assert.Single(transfer.GetVisualDescendants().OfType<Button>(), button => AutomationProperties.GetName(button) == "Move selected right");
      Assert.True(move.Focus());
      window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
      window.KeyRelease(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
      Assert.Equal(new object?[] { "alpha" }, transfer.TargetValues);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void LargeSourceRealizesBoundedRowsAndSelectsScrolledItem()
  {
    var transfer = new FsusTransfer();
    for (var index = 0; index < 1000; index++)
    {
      transfer.Items.Add(new FsusTransferItem(index, $"Item {index}"));
    }
    transfer.RefreshLists();
    var window = new Window { Content = transfer, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var source = Assert.Single(transfer.GetVisualDescendants().OfType<ListBox>(), list => AutomationProperties.GetName(list) == "Source items");
      Assert.InRange(source.GetVisualDescendants().OfType<CheckBox>().Count(), 1, 80);
      transfer.ScrollLeftTo(300);
      Assert.Equal(300, transfer.VirtualizedLeftItems[0].Value);
      Dispatcher.UIThread.RunJobs();
      window.UpdateLayout();
      var row = Assert.Single(source.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Item 300"));
      var inside = row.TranslatePoint(new Point(row.Bounds.Width / 2, row.Bounds.Height / 2), source);
      Assert.NotNull(inside);
      Assert.True(inside.Value.X >= 0 && inside.Value.X < source.Bounds.Width && inside.Value.Y >= 0 && inside.Value.Y < source.Bounds.Height,
        $"Row center {inside.Value} lies outside source bounds {source.Bounds}");
      Click(window, row);
      Assert.Equal(new object?[] { 300 }, transfer.SelectedLeftValues);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void LargeSourceInScrollableStackPanelKeepsRealizedRowsBounded()
  {
    var transfer = new FsusTransfer();
    for (var index = 0; index < 1000; index++)
      transfer.Items.Add(new FsusTransferItem(index, $"Item {index}"));
    transfer.RefreshLists();
    var stack = new StackPanel();
    stack.Children.Add(transfer);
    var window = new Window { Content = new ScrollViewer { Content = stack }, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var source = Assert.Single(transfer.GetVisualDescendants().OfType<ListBox>(), list => AutomationProperties.GetName(list) == "Source items");
      Assert.InRange(source.GetVisualDescendants().OfType<CheckBox>().Count(), 1, 80);
      transfer.ScrollLeftTo(300);
      Dispatcher.UIThread.RunJobs();
      window.UpdateLayout();
      var row = Assert.Single(source.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Item 300"));
      Click(window, row);
      Assert.Equal(new object?[] { 300 }, transfer.SelectedLeftValues);
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void DisabledSelectedItemUpdatesMoveActionWhileItsRowIsOffscreen()
  {
    var transfer = new FsusTransfer();
    var first = new FsusTransferItem(0, "Item 0");
    transfer.Items.Add(first);
    for (var index = 1; index < 1000; index++)
      transfer.Items.Add(new FsusTransferItem(index, $"Item {index}"));
    transfer.RefreshLists();
    var window = new Window { Content = transfer, Width = 640, Height = 320 };
    AttachTheme(window);
    window.Show();
    try
    {
      window.UpdateLayout();
      var source = Assert.Single(transfer.GetVisualDescendants().OfType<ListBox>(), list => AutomationProperties.GetName(list) == "Source items");
      var row = Assert.Single(source.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Item 0"));
      Click(window, row);
      var move = Assert.Single(transfer.GetVisualDescendants().OfType<Button>(), button => AutomationProperties.GetName(button) == "Move selected right");
      Assert.True(move.IsEnabled);
      transfer.ScrollLeftTo(300);
      Dispatcher.UIThread.RunJobs();
      window.UpdateLayout();
      Assert.DoesNotContain(source.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Item 0"));
      first.IsDisabled = true;
      Assert.False(move.IsEnabled);
      Assert.False(transfer.MoveSelectedRight());
      Assert.Empty(transfer.TargetValues);
      transfer.ScrollLeftTo(0);
      Dispatcher.UIThread.RunJobs();
      window.UpdateLayout();
      var returned = Assert.Single(source.GetVisualDescendants().OfType<CheckBox>(), item => Equals(item.Content, "Item 0"));
      Assert.False(returned.IsEnabled);
    }
    finally { window.Close(); }
  }

  private static void Click(Window window, Control control)
  {
    window.UpdateLayout();
    var point = control.TranslatePoint(new Point(control.Bounds.Width / 2, control.Bounds.Height / 2), window);
    Assert.NotNull(point);
    Assert.True(point.Value.X >= 0 && point.Value.X < window.Width && point.Value.Y >= 0 && point.Value.Y < window.Height,
      $"Control center {point.Value} is outside the window");
    window.MouseMove(point.Value);
    var hit = window.InputHitTest(point.Value) as Visual;
    Assert.True(hit == control || hit?.GetVisualAncestors().Contains(control) == true,
      $"Pointer hit {hit?.GetType().Name ?? "nothing"} instead of {control.GetType().Name}; ancestry {string.Join(",", hit?.GetVisualAncestors().Select(item => item.GetType().Name) ?? [])}");
    window.MouseDown(point.Value, MouseButton.Left);
    window.MouseUp(point.Value, MouseButton.Left);
  }

  private static void AttachTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions { Variant = FsusThemeVariant.Light });
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(new global::Avalonia.Markup.Xaml.Styling.StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests")) { Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml") });
  }
}
