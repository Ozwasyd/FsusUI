using Avalonia;
using Avalonia.Animation.Easings;
using Avalonia.Controls;
using Avalonia.Media;

namespace FsusUI.Avalonia.Tests.Generated;

public class FsusTokenResourceTests
{
  [Fact]
  public void GeneratedHelpersExposeTypedAvaloniaValues()
  {
    Color color = FsusTokens.ColorActionPrimaryColor;
    SolidColorBrush colorBrush = FsusTokens.ColorActionPrimaryBrush;
    SolidColorBrush brush = FsusTokens.BrushSurfaceBaseBrush;
    Thickness thickness = FsusTokens.ThicknessBorderDefaultThickness;
    CornerRadius cornerRadius = FsusTokens.RadiusControlMdCornerRadius;
    FontFamily fontFamily = FsusTokens.TypographyFamilyBodyFontFamily;
    FontWeight fontWeight = FsusTokens.TypographyBodyMdWeightFontWeight;
    TimeSpan duration = FsusTokens.MotionDurationControlTimeSpan;
    IEasing easing = FsusTokens.MotionEasingStandardEasing;
    BoxShadows shadow = FsusTokens.ShadowOverlayMdBoxShadows;
    double opacity = FsusTokens.OpacityDisabledContentDouble;
    int zIndex = FsusTokens.ZOverlayDialogInt32;

    Assert.Equal(Color.Parse("#2A599C"), color);
    Assert.Equal(color, colorBrush.Color);
    Assert.Equal(Color.Parse("#FFFFFF"), brush.Color);
    Assert.Equal(new Thickness(1), thickness);
    Assert.Equal(new CornerRadius(6), cornerRadius);
    Assert.Equal("Google Sans", fontFamily.Name);
    Assert.Equal((FontWeight)400, fontWeight);
    Assert.Equal(TimeSpan.FromMilliseconds(220), duration);
    Assert.Equal(0, shadow.Count);
    Assert.Equal(0.46d, opacity);
    Assert.Equal(2000, zIndex);
    Assert.InRange(easing.Ease(0.5d), 0d, 1d);
  }

  [Fact]
  public void GeneratedResourceAccessorReadsTypedResourcesFromControls()
  {
    var control = new Button();
    control.Resources[FsusTokens.ComponentDialogPaddingResourceKey] =
      FsusTokens.ComponentDialogPaddingThickness;

    var padding = FsusTokens.GetResource<Thickness>(
      control,
      FsusTokens.ComponentDialogPaddingResourceKey
    );

    Assert.Equal(FsusTokens.ComponentDialogPaddingThickness, padding);
  }
}
