using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusBundledInterFontRegistrationRegressionTests
{
  [AvaloniaFact]
  public void BundledInterResolvesGlyphsAndLaysOutTextInAFluentWindow()
  {
    var family = new FontFamily("fonts:Inter#Inter");
    var typeface = new Typeface(family);
    Assert.Equal("Inter", typeface.GlyphTypeface.FamilyName);

    using var layout = new TextLayout("Open commands", typeface, 14);
    Assert.True(layout.Width > 0);
    Assert.True(layout.Height > 0);

    var text = new TextBlock
    {
      Text = "Open commands",
      FontFamily = family,
    };
    var button = new Button { Content = "Open commands" };
    var window = new Window
    {
      Width = 400,
      Height = 200,
      ShowInTaskbar = false,
      Content = new StackPanel { Children = { text, button } },
    };

    try
    {
      window.Show();
      Assert.True(text.Bounds.Width > 0);
      Assert.True(text.Bounds.Height > 0);
      Assert.True(button.IsMeasureValid);
      Assert.True(button.IsArrangeValid);
    }
    finally
    {
      window.Close();
    }
  }
}
