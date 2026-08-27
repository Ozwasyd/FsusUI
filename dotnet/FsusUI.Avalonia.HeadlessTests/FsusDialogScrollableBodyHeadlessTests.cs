using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusDialogScrollableBodyHeadlessTests
{
  [AvaloniaFact]
  public void TwentyFormFieldsIn480HeightWindowAreReachableAndFooterRemainsFixed()
  {
    var (dialog, window, fields, footer) = BuildDialogWindow(isScrollable: true, windowHeight: 480);
    window.Show();

    // 1. Total dialog height is strictly bounded by the 480px window
    Assert.True(dialog.Bounds.Height <= 480, $"Dialog height {dialog.Bounds.Height} should be <= 480");
    Assert.True(dialog.Bounds.Height >= 200, "Dialog should have sensible rendered height");

    var scrollViewer = dialog.BodyScrollViewer;
    Assert.NotNull(scrollViewer);
    Assert.True(scrollViewer.Extent.Height > scrollViewer.Viewport.Height,
      $"Extent {scrollViewer.Extent.Height} must exceed Viewport {scrollViewer.Viewport.Height}");

    // 2. Footer is visible and within the window bounds at the bottom
    var initialFooterPos = footer.TranslatePoint(new Point(0, 0), window);
    Assert.NotNull(initialFooterPos);
    Assert.True(initialFooterPos.Value.Y > 0 && initialFooterPos.Value.Y < 480,
      $"Footer Y {initialFooterPos.Value.Y} must be inside 480px window");

    // Scroll down multiple times
    dialog.ScrollPage(1);
    var midFooterPos = footer.TranslatePoint(new Point(0, 0), window);
    Assert.NotNull(midFooterPos);
    Assert.Equal(initialFooterPos.Value.Y, midFooterPos.Value.Y);

    dialog.ScrollBodyBy(1000);
    var endFooterPos = footer.TranslatePoint(new Point(0, 0), window);
    Assert.NotNull(endFooterPos);
    Assert.Equal(initialFooterPos.Value.Y, endFooterPos.Value.Y);

    // Last field (field 20) can be reached and scrolled into view
    var lastField = fields[^1];
    dialog.ScrollBodyIntoView(lastField);
    window.UpdateLayout();

    var lastTransform = lastField.TransformToVisual(scrollViewer);
    Assert.True(lastTransform.HasValue);
    var lastRelative = new Rect(0, 0, lastField.Bounds.Width, lastField.Bounds.Height)
      .TransformToAABB(lastTransform.Value);

    Assert.True(lastRelative.Top >= -1, $"Last field Top {lastRelative.Top} should be within viewport");
    Assert.True(lastRelative.Bottom <= scrollViewer.Viewport.Height + 1,
      $"Last field Bottom {lastRelative.Bottom} should be within viewport height {scrollViewer.Viewport.Height}");

    window.Close();
  }

  [AvaloniaFact]
  public void TabbingToInvisibleFieldAutomaticallyScrollsAndPreservesFocus()
  {
    var (dialog, window, fields, _) = BuildDialogWindow(isScrollable: true, windowHeight: 480);
    window.Show();

    var scrollViewer = dialog.BodyScrollViewer;
    Assert.NotNull(scrollViewer);

    // Focus first field
    var firstField = fields[0];
    firstField.Focus();
    Assert.True(firstField.IsFocused);
    Assert.Equal(0, scrollViewer.Offset.Y);

    // Focus field 16 which is off-screen
    var offscreenField = fields[15];
    offscreenField.Focus();
    window.UpdateLayout();

    // Focus is not lost and is on offscreenField
    Assert.True(offscreenField.IsFocused, "Off-screen field should retain focus");

    // Body content automatically scrolled into view
    Assert.True(scrollViewer.Offset.Y > 0, $"ScrollViewer offset {scrollViewer.Offset.Y} should have scrolled down");

    var transform = offscreenField.TransformToVisual(scrollViewer);
    Assert.True(transform.HasValue);
    var relative = new Rect(0, 0, offscreenField.Bounds.Width, offscreenField.Bounds.Height)
      .TransformToAABB(transform.Value);

    Assert.True(relative.Top >= -1, $"Field 16 Top {relative.Top} should be >= 0");
    Assert.True(relative.Bottom <= scrollViewer.Viewport.Height + 1,
      $"Field 16 Bottom {relative.Bottom} should be <= {scrollViewer.Viewport.Height}");

    window.Close();
  }

  [AvaloniaFact]
  public void DefaultDialogBehaviorAndLayoutWhenNotEnabledIsUnchanged()
  {
    var (dialog, window, _, _) = BuildDialogWindow(isScrollable: false, windowHeight: 480);
    window.Show();

    // When not enabled, body scrollbar is disabled
    var scrollViewer = dialog.BodyScrollViewer;
    Assert.NotNull(scrollViewer);
    Assert.Equal(ScrollBarVisibility.Disabled, scrollViewer.VerticalScrollBarVisibility);
    Assert.False(dialog.IsBodyScrollable);
    Assert.DoesNotContain("scrollable", AutomationProperties.GetItemStatus(dialog));

    // When unconstrained, dialog expands naturally to fit all fields without clamping to 480
    dialog.Measure(new Size(600, double.PositiveInfinity));
    Assert.True(dialog.DesiredSize.Height > 480,
      $"Unconstrained dialog desired height {dialog.DesiredSize.Height} should exceed 480 without scrollable mode");

    window.Close();
  }

  private static (FsusDialog Dialog, Window Window, List<Button> Fields, StackPanel Footer)
    BuildDialogWindow(bool isScrollable, double windowHeight)
  {
    var fields = new List<Button>();
    var formStack = new StackPanel
    {
      Spacing = 10,
    };

    for (var i = 1; i <= 20; i++)
    {
      var button = new Button
      {
        Content = $"Field {i} Input Action",
        Height = 36,
        HorizontalAlignment = HorizontalAlignment.Stretch,
      };
      fields.Add(button);
      formStack.Children.Add(button);
    }

    var saveButton = new Button { Content = "Save" };
    var cancelButton = new Button { Content = "Cancel" };
    var footer = new StackPanel
    {
      Orientation = Orientation.Horizontal,
      Spacing = 8,
      HorizontalAlignment = HorizontalAlignment.Right,
      Children = { cancelButton, saveButton },
    };

    var dialog = new FsusDialog
    {
      Title = "Preferences Form",
      IsBodyScrollable = isScrollable,
      BodyContent = formStack,
      FooterContent = footer,
      HorizontalAlignment = HorizontalAlignment.Center,
      VerticalAlignment = VerticalAlignment.Center,
    };

    var window = new Window
    {
      Width = 600,
      Height = windowHeight,
      Content = dialog,
      ShowInTaskbar = false,
    };

    AttachFsusTheme(window);
    return (dialog, window, fields, footer);
  }

  private static void AttachFsusTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions());
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }
}
