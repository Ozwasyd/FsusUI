using Avalonia.Controls;
using Avalonia.Media;
using FsusUI.Avalonia.Demo;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusThemeManagerHeadlessTests
{
  [Fact]
  public void LiveResourceConsumerFollowsVariantPaletteSwitch()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var consumer = new Border();
    consumer.Bind(
      Border.BorderBrushProperty,
      application.Resources.GetResourceObservable(
        FsusTokens.ColorActionPrimaryBrushResourceKey
      )
    );

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Light }
    );
    Assert.Equal(
      Color.Parse("#2A599C"),
      Assert.IsType<SolidColorBrush>(consumer.BorderBrush).Color
    );

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Dark }
    );
    Assert.Equal(
      Color.Parse("#4B79CC"),
      Assert.IsType<SolidColorBrush>(consumer.BorderBrush).Color
    );
  }
}
