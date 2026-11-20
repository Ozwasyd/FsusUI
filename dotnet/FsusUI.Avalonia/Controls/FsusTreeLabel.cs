using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

// Only the tree's plain default labels use these caches. TextBlock retains ownership
// of each layout, rendering, inherited styling, clipping and automation.
internal sealed class FsusTreeLabel : TextBlock
{
  private static readonly Queue<FsusTreeLabel> PendingCleanup = new();
  private LayoutKey? measuredKey;
  private LayoutKey? arrangedKey;
  private Size measuredSize;
  private Size arrangedSize;
  // TextRunCache is an Unstable Avalonia 12.0.4 API: reverify ownership and
  // stock paragraph parity before upgrading the pinned Avalonia dependency.
  private TextRunCache? shapingCache;
  private LayoutKey? shapingKey;
  private bool cleanupPosted;

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

  protected override TextLayout CreateTextLayout(string? text)
  {
    // Paragraph line spacing is internal to Avalonia; nonzero spacing stays stock.
    var key = this.IsAttachedToVisualTree() && LineSpacing == 0 ? Capture(default) : null;
    if (key is null)
    {
      ReleaseShapingCache();
      return base.CreateTextLayout(text);
    }
    if (key != shapingKey)
    {
      shapingCache?.Invalidate();
      shapingKey = key;
    }
    shapingCache ??= new TextRunCache();

    // Match TextBlock's plain-string paragraph construction. Only shaped runs
    // survive a same-context remount; every TextLayout remains owned by TextBlock.
    var properties = new GenericTextRunProperties(
      new Typeface(FontFamily, FontStyle, FontWeight, FontStretch), FontSize,
      TextDecorations, Foreground, fontFeatures: FontFeatures);
    var paragraph = new GenericTextParagraphProperties(
      FlowDirection, IsMeasureValid ? TextAlignment : TextAlignment.Left, true, false,
      properties, TextWrapping, LineHeight, 0, LetterSpacing);
    var maximum = GetMaxSizeFromConstraint();
    return new TextLayout(
      new SimpleTextSource(text ?? string.Empty, properties), paragraph, TextTrimming,
      maximum.Width, maximum.Height, MaxLines, shapingCache);
  }

  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnDetachedFromVisualTree(e);
    if (cleanupPosted || shapingCache is null) return;
    cleanupPosted = true;
    // Whole-tree moves can detach thousands of labels in one dispatcher turn.
    PendingCleanup.Enqueue(this);
    if (PendingCleanup.Count == 1)
      Dispatcher.UIThread.Post(ReleaseDetachedCaches, DispatcherPriority.Background);
  }

  private static void ReleaseDetachedCaches()
  {
    while (PendingCleanup.TryDequeue(out var label))
    {
      label.cleanupPosted = false;
      if (!label.IsAttachedToVisualTree()) label.ReleaseShapingCache();
    }
  }

  private void ReleaseShapingCache()
  {
    shapingCache?.Dispose();
    shapingCache = null;
    shapingKey = null;
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

  private readonly record struct LayoutKey(
    Size Constraint, string? Text, FontFamily FontFamily, double FontSize,
    FontStyle FontStyle, FontWeight FontWeight, FontStretch FontStretch,
    FlowDirection FlowDirection, double LineHeight, double LineSpacing,
    double LetterSpacing, int MaxLines, TextWrapping TextWrapping,
    TextTrimming TextTrimming, TextAlignment TextAlignment, Thickness Padding,
    bool UseLayoutRounding, double Scale, object Theme, string Culture, string UICulture,
    IBrush? Foreground);
}
