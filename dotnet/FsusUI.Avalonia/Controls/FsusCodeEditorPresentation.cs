using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;
using Avalonia.Utilities;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

internal sealed class FsusCodeEditorPresentation : global::Avalonia.Controls.Primitives.TemplatedControl
{
  private const int OverscanLines = 8;
  private const int RealizedLineLimit = 200;

  private string text = string.Empty;
  private FsusCodeEditorDocumentMap map = FsusCodeEditorDocumentMap.Create(string.Empty);
  private FsusCodeEditorSelection selection = new(0, 0);
  private IReadOnlyList<FsusCodeEditorHighlightSpan> highlightSpans = [];
  private Vector scrollOffset;
  private bool wordWrap;
  private int tabWidth = 4;
  private bool showLineNumbers = true;
  private IBrush? accentBrush;
  private IBrush? mutedBrush;

  public event EventHandler<FsusCodeEditorRealizedLinesChangedEventArgs>? RealizedLinesChanged;

  public int FirstRealizedLine { get; private set; } = 1;

  public int LastRealizedLine { get; private set; } = 1;

  public int RealizedLineCount => LastRealizedLine - FirstRealizedLine + 1;

  public void Update(
    string source,
    FsusCodeEditorDocumentMap documentMap,
    FsusCodeEditorSelection sourceSelection,
    IReadOnlyList<FsusCodeEditorHighlightSpan> spans,
    Vector offset,
    bool wraps,
    int spacesPerTab,
    bool lineNumbers,
    IBrush? accent,
    IBrush? muted)
  {
    text = source;
    map = documentMap;
    selection = sourceSelection;
    highlightSpans = spans;
    scrollOffset = offset;
    wordWrap = wraps;
    tabWidth = Math.Clamp(spacesPerTab, 1, 16);
    showLineNumbers = lineNumbers;
    accentBrush = accent;
    mutedBrush = muted;
    UpdateRealizedRange();
    InvalidateVisual();
  }

  public override void Render(DrawingContext context)
  {
    base.Render(context);
    var foreground = Foreground ?? Brushes.Black;
    var typeface = new Typeface(FontFamily, FontStyle, FontWeight, FontStretch);
    var lineHeight = EffectiveLineHeight;
    var gutterWidth = showLineNumbers ? ResolveGutterWidth(typeface, foreground) : 0;
    var contentWidth = Math.Max(1, Bounds.Width - gutterWidth);
    var y = (FirstRealizedLine - 1) * lineHeight - scrollOffset.Y;

    using var clip = context.PushClip(new Rect(0, 0, Bounds.Width, Bounds.Height));
    for (var line = FirstRealizedLine; line <= LastRealizedLine; line += 1)
    {
      var start = map.GetLineStart(line);
      var end = map.GetLineContentEnd(line);
      var raw = text[start..end];
      var expanded = ExpandTabs(raw, tabWidth);
      var layout = CreateLineLayout(
        expanded.Text,
        typeface,
        foreground,
        BuildStyleOverrides(start, end, expanded, typeface, foreground),
        contentWidth);

      if (showLineNumbers)
      {
        DrawLineNumber(context, line, y, gutterWidth, typeface, mutedBrush ?? foreground);
      }
      DrawSelection(context, layout, expanded, start, end, y, gutterWidth);
      layout.Draw(context, new Point(gutterWidth - scrollOffset.X, y));
      DrawCaret(context, layout, expanded, start, end, y, gutterWidth, foreground);
      y += wordWrap ? Math.Max(lineHeight, layout.Height) : lineHeight;
    }
  }

  protected override Size MeasureOverride(Size availableSize) =>
    new(
      double.IsInfinity(availableSize.Width) ? 640 : Math.Max(1, availableSize.Width),
      double.IsInfinity(availableSize.Height) ? 320 : Math.Max(1, availableSize.Height));

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == FontFamilyProperty ||
      change.Property == FontSizeProperty ||
      change.Property == FontStyleProperty ||
      change.Property == FontWeightProperty ||
      change.Property == FontStretchProperty ||
      change.Property == ForegroundProperty)
    {
      UpdateRealizedRange();
      InvalidateVisual();
    }
  }

  private double EffectiveLineHeight => Math.Max(FontSize * 1.5, 1);

  private void UpdateRealizedRange()
  {
    var lineHeight = EffectiveLineHeight;
    var first = Math.Max(1, (int)Math.Floor(scrollOffset.Y / lineHeight) + 1 - OverscanLines);
    var visible = Math.Max(1, (int)Math.Ceiling(Math.Max(Bounds.Height, 320) / lineHeight));
    var last = Math.Min(map.LineCount, first + Math.Min(RealizedLineLimit, visible + OverscanLines * 2) - 1);
    if (first > map.LineCount)
    {
      first = Math.Max(1, map.LineCount - Math.Min(RealizedLineLimit, visible) + 1);
      last = map.LineCount;
    }
    if (first == FirstRealizedLine && last == LastRealizedLine)
    {
      return;
    }
    FirstRealizedLine = first;
    LastRealizedLine = Math.Max(first, last);
    RealizedLinesChanged?.Invoke(
      this,
      new(FirstRealizedLine, LastRealizedLine, RealizedLineLimit));
  }

  private IReadOnlyList<ValueSpan<TextRunProperties>> BuildStyleOverrides(
    int lineStart,
    int lineEnd,
    ExpandedLine expanded,
    Typeface baseTypeface,
    IBrush foreground)
  {
    var overrides = new List<ValueSpan<TextRunProperties>>();
    foreach (var span in highlightSpans)
    {
      var spanEnd = span.Start + span.Length;
      var intersectionStart = Math.Max(lineStart, span.Start);
      var intersectionEnd = Math.Min(lineEnd, spanEnd);
      if (intersectionEnd <= intersectionStart)
      {
        continue;
      }
      var visualStart = expanded.RawToVisual(intersectionStart - lineStart);
      var visualEnd = expanded.RawToVisual(intersectionEnd - lineStart);
      var brush = span.Kind switch
      {
        FsusCodeEditorHighlightKind.Marker => mutedBrush ?? foreground,
        FsusCodeEditorHighlightKind.Link => accentBrush ?? foreground,
        _ => foreground,
      };
      var typeface = span.Kind switch
      {
        FsusCodeEditorHighlightKind.Heading or FsusCodeEditorHighlightKind.Emphasis =>
          new Typeface(FontFamily, FontStyle, FontWeight.SemiBold, FontStretch),
        FsusCodeEditorHighlightKind.InlineCode =>
          new Typeface(FontFamily, FontStyle, FontWeight.Medium, FontStretch),
        _ => baseTypeface,
      };
      overrides.Add(new(
        visualStart,
        visualEnd - visualStart,
        new GenericTextRunProperties(
          typeface,
          FontSize,
          foregroundBrush: brush,
          fontFeatures: FontFeatures)));
    }
    return overrides;
  }

  private TextLayout CreateLineLayout(
    string line,
    Typeface typeface,
    IBrush foreground,
    IReadOnlyList<ValueSpan<TextRunProperties>> overrides,
    double contentWidth) =>
    new(
      line.Length == 0 ? " " : line,
      typeface,
      FontSize,
      foreground,
      TextAlignment.Left,
      wordWrap ? TextWrapping.Wrap : TextWrapping.NoWrap,
      TextTrimming.None,
      null,
      FlowDirection,
      wordWrap ? contentWidth : double.PositiveInfinity,
      double.PositiveInfinity,
      EffectiveLineHeight,
      0,
      0,
      FontFeatures,
      overrides);

  private double ResolveGutterWidth(Typeface typeface, IBrush foreground)
  {
    var digits = Math.Max(2, map.LineCount.ToString(CultureInfo.InvariantCulture).Length);
    using var layout = new TextLayout(
      new string('0', digits),
      typeface,
      FontSize,
      foreground);
    return Math.Ceiling(layout.WidthIncludingTrailingWhitespace + FontSize * 1.5);
  }

  private void DrawLineNumber(
    DrawingContext context,
    int line,
    double y,
    double gutterWidth,
    Typeface typeface,
    IBrush brush)
  {
    using var layout = new TextLayout(
      line.ToString(CultureInfo.InvariantCulture),
      typeface,
      FontSize,
      brush);
    layout.Draw(
      context,
      new Point(
        Math.Max(0, gutterWidth - layout.WidthIncludingTrailingWhitespace - FontSize * 0.75),
        y));
  }

  private void DrawSelection(
    DrawingContext context,
    TextLayout layout,
    ExpandedLine expanded,
    int lineStart,
    int lineEnd,
    double y,
    double gutterWidth)
  {
    var start = Math.Max(lineStart, selection.Start);
    var end = Math.Min(lineEnd, selection.End);
    if (end <= start)
    {
      return;
    }
    var localStart = expanded.RawToVisual(start - lineStart);
    var localEnd = expanded.RawToVisual(end - lineStart);
    var brush = accentBrush ?? Brushes.DodgerBlue;
    using var opacity = context.PushOpacity(0.22);
    foreach (var rectangle in layout.HitTestTextRange(localStart, localEnd - localStart))
    {
      context.FillRectangle(
        brush,
        new Rect(
          gutterWidth - scrollOffset.X + rectangle.Left,
          y + rectangle.Top,
          Math.Max(1, rectangle.Width),
          Math.Max(EffectiveLineHeight, rectangle.Height)));
    }
  }

  private void DrawCaret(
    DrawingContext context,
    TextLayout layout,
    ExpandedLine expanded,
    int lineStart,
    int lineEnd,
    double y,
    double gutterWidth,
    IBrush foreground)
  {
    if (!selection.IsCollapsed || selection.End < lineStart || selection.End > lineEnd)
    {
      return;
    }
    var local = expanded.RawToVisual(selection.End - lineStart);
    var rectangle = layout.HitTestTextPosition(local);
    context.DrawLine(
      new Pen(foreground, 1),
      new Point(gutterWidth - scrollOffset.X + rectangle.Left, y + rectangle.Top),
      new Point(gutterWidth - scrollOffset.X + rectangle.Left, y + rectangle.Bottom));
  }

  private static ExpandedLine ExpandTabs(string raw, int spacesPerTab)
  {
    var output = new System.Text.StringBuilder(raw.Length);
    var positions = new int[raw.Length + 1];
    var column = 0;
    for (var index = 0; index < raw.Length; index += 1)
    {
      positions[index] = output.Length;
      if (raw[index] == '\t')
      {
        var count = spacesPerTab - column % spacesPerTab;
        output.Append(' ', count);
        column += count;
      }
      else
      {
        output.Append(raw[index]);
        column += 1;
      }
    }
    positions[raw.Length] = output.Length;
    return new(output.ToString(), positions);
  }

  private sealed record ExpandedLine(string Text, int[] Positions)
  {
    public int RawToVisual(int rawOffset) => Positions[Math.Clamp(rawOffset, 0, Positions.Length - 1)];
  }
}

internal sealed class FsusCodeEditorRealizedLinesChangedEventArgs(
  int firstLine,
  int lastLine,
  int limit) : EventArgs
{
  public int FirstLine { get; } = firstLine;

  public int LastLine { get; } = lastLine;

  public int Limit { get; } = limit;
}
