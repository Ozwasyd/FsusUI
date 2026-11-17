using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

// Only the tree's plain default labels use this cache. TextBlock retains ownership
// of shaping, rendering, inherited styling, clipping and automation.
internal sealed class FsusTreeLabel : TextBlock
{
  private LayoutKey? measuredKey;
  private LayoutKey? arrangedKey;
  private Size measuredSize;
  private Size arrangedSize;

  protected override Type StyleKeyOverride => typeof(TextBlock);

  protected override Size MeasureOverride(Size availableSize)
  {
    var key = Capture(availableSize);
    if (key is not null && key == measuredKey) return measuredSize;
    measuredKey = null;
    arrangedKey = null;
    var size = base.MeasureOverride(availableSize);
    measuredKey = key;
    measuredSize = size;
    return size;
  }

  protected override Size ArrangeOverride(Size finalSize)
  {
    var key = Capture(finalSize);
    if (key is not null && key == arrangedKey) return arrangedSize;
    arrangedKey = null;
    var size = base.ArrangeOverride(finalSize);
    arrangedKey = key;
    arrangedSize = size;
    return size;
  }

  private LayoutKey? Capture(Size constraint) =>
    Inlines is { Count: > 0 } || FontFeatures is { Count: > 0 } || TextDecorations is { Count: > 0 }
      ? null
      : new LayoutKey(
        constraint, Text, FontFamily, FontSize, FontStyle, FontWeight, FontStretch,
        FlowDirection, LineHeight, LineSpacing, LetterSpacing, MaxLines,
        TextWrapping, TextTrimming, TextAlignment, Padding, UseLayoutRounding,
        TopLevel.GetTopLevel(this)?.RenderScaling ?? 1,
        ActualThemeVariant, CultureInfo.CurrentCulture.Name, CultureInfo.CurrentUICulture.Name, Foreground);

  private sealed record LayoutKey(
    Size Constraint, string? Text, FontFamily FontFamily, double FontSize,
    FontStyle FontStyle, FontWeight FontWeight, FontStretch FontStretch,
    FlowDirection FlowDirection, double LineHeight, double LineSpacing,
    double LetterSpacing, int MaxLines, TextWrapping TextWrapping,
    TextTrimming TextTrimming, TextAlignment TextAlignment, Thickness Padding,
    bool UseLayoutRounding, double Scale, object Theme, string Culture, string UICulture,
    IBrush? Foreground);
}
