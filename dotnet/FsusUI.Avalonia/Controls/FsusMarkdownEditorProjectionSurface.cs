using System.Globalization;
using System.Text;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;
using Avalonia.Utilities;

namespace FsusUI.Avalonia.Controls;

internal sealed class FsusMarkdownEditorProjectionState
{
  private FsusMarkdownProjectionSnapshot? snapshot;
  private IReadOnlyList<string> retainedNodeIds = [];
  private FsusMarkdownProjectionMap? map;
  private string displayText = string.Empty;

  public FsusMarkdownProjectionSnapshot? Snapshot => snapshot;

  public bool RequiresRefresh { get; private set; } = true;

  public IReadOnlyList<string> RetainedNodeIds => retainedNodeIds;

  public FsusMarkdownProjectionMap? Map => map;

  public string DisplayText => displayText;

  public FsusMarkdownProjectionCommitResult Commit(
    FsusMarkdownProjectionSnapshot candidate,
    FsusMarkdownDocumentIdentity identity,
    int revision,
    string source,
    long featureRevision)
  {
    ArgumentNullException.ThrowIfNull(candidate);
    if (candidate.DocumentIdentity != identity)
    {
      return Reject(revision, "document-mismatch");
    }
    if (candidate.Revision != revision)
    {
      return Reject(revision, "stale-revision");
    }
    if (candidate.FeatureRevision != featureRevision)
    {
      return Reject(revision, "stale-feature-revision");
    }
    if (!string.Equals(candidate.Source, source, StringComparison.Ordinal))
    {
      return Reject(revision, "source-mismatch");
    }
    var invalidReason = Validate(candidate);
    if (invalidReason is not null)
    {
      return Reject(revision, invalidReason);
    }

    var previous = snapshot?.Spans
      .GroupBy(span => span.NodeId, StringComparer.Ordinal)
      .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal)
      ?? new Dictionary<string, FsusMarkdownProjectionSpan[]>(StringComparer.Ordinal);
    var next = candidate.Spans
      .GroupBy(span => span.NodeId, StringComparer.Ordinal)
      .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal);
    var nextIds = candidate.Spans.Select(span => span.NodeId).ToHashSet(StringComparer.Ordinal);
    var retained = next
      .Where(entry =>
        previous.TryGetValue(entry.Key, out var existing) &&
        existing.SequenceEqual(entry.Value))
      .Select(entry => entry.Key)
      .ToArray();
    var rebuilt = next.Keys
      .Where(nodeId => !retained.Contains(nodeId, StringComparer.Ordinal))
      .ToArray();
    var removed = previous.Keys.Where(id => !nextIds.Contains(id)).ToArray();
    snapshot = candidate with { Spans = candidate.Spans.ToArray() };
    retainedNodeIds = retained;
    RequiresRefresh = false;
    RebuildPresentation();
    return new(true, revision, retained, rebuilt, removed);
  }

  public void Advance(
    string beforeSource,
    string source,
    int revision,
    FsusMarkdownEditorPositionMap? positionMap)
  {
    if (snapshot is null || positionMap is null)
    {
      Reset();
      return;
    }

    var retainedCandidates = new List<FsusMarkdownProjectionSpan>();
    foreach (var span in snapshot.Spans)
    {
      var mapped = positionMap.MapRange(span.SourceRange);
      if (mapped.Range is null || mapped.Deleted || mapped.PartiallyDeleted)
      {
        continue;
      }
      var oldLength = span.SourceRange.End - span.SourceRange.Start;
      var newLength = mapped.Range.End - mapped.Range.Start;
      if (oldLength != newLength ||
        span.SourceRange.End > beforeSource.Length ||
        mapped.Range.End > source.Length ||
        !beforeSource.AsSpan(span.SourceRange.Start, oldLength)
          .SequenceEqual(source.AsSpan(mapped.Range.Start, newLength)))
      {
        continue;
      }
      retainedCandidates.Add(span with { SourceRange = mapped.Range });
    }
    var originalCounts = snapshot.Spans
      .GroupBy(span => span.NodeId, StringComparer.Ordinal)
      .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
    var retainedNodeIds = retainedCandidates
      .GroupBy(span => span.NodeId, StringComparer.Ordinal)
      .Where(group => group.Count() == originalCounts[group.Key])
      .Select(group => group.Key)
      .ToHashSet(StringComparer.Ordinal);
    var retained = retainedCandidates
      .Where(span => retainedNodeIds.Contains(span.NodeId))
      .ToArray();

    snapshot = new(
      snapshot.DocumentIdentity,
      revision,
      source,
      retained,
      snapshot.FeatureRevision);
    this.retainedNodeIds = retainedNodeIds.ToArray();
    RequiresRefresh = true;
    RebuildPresentation();
  }

  public void Reset()
  {
    snapshot = null;
    retainedNodeIds = [];
    map = null;
    displayText = string.Empty;
    RequiresRefresh = true;
  }

  private void RebuildPresentation()
  {
    if (snapshot is null)
    {
      map = null;
      displayText = string.Empty;
      return;
    }
    map = new(snapshot.Source, snapshot.Spans);
    var output = new System.Text.StringBuilder(snapshot.Source.Length);
    var cursor = 0;
    foreach (var span in snapshot.Spans)
    {
      if (span.SourceRange.Start > cursor)
      {
        output.Append(snapshot.Source, cursor, span.SourceRange.Start - cursor);
      }
      if (span.Kind != FsusMarkdownProjectionSpanKind.HiddenMarker)
      {
        output.Append(span.DisplayText);
      }
      cursor = span.SourceRange.End;
    }
    if (cursor < snapshot.Source.Length)
    {
      output.Append(snapshot.Source, cursor, snapshot.Source.Length - cursor);
    }
    displayText = output.ToString();
  }

  private static string? Validate(FsusMarkdownProjectionSnapshot candidate)
  {
    if (candidate.Spans is null)
    {
      return "invalid-projection";
    }
    var cursor = 0;
    foreach (var span in candidate.Spans)
    {
      if (span is null ||
        span.SourceRange is null ||
        string.IsNullOrWhiteSpace(span.NodeId) ||
        span.SourceRange.Start < cursor ||
        span.SourceRange.End < span.SourceRange.Start ||
        span.SourceRange.End > candidate.Source.Length ||
        span.DisplayText is null)
      {
        return "invalid-projection";
      }
      if (span.Kind == FsusMarkdownProjectionSpanKind.HiddenMarker &&
        (span.DisplayText.Length != 0 ||
          span.SourceRange.Start == span.SourceRange.End))
      {
        return "invalid-hidden-marker";
      }
      if (span.Kind == FsusMarkdownProjectionSpanKind.Atomic &&
        (span.DisplayText.Length == 0 ||
          span.SourceRange.Start == span.SourceRange.End))
      {
        return "invalid-atomic-presentation";
      }
      if (span.Kind == FsusMarkdownProjectionSpanKind.SourceFallback &&
        string.IsNullOrWhiteSpace(span.FallbackReason))
      {
        return "invalid-source-fallback";
      }
      cursor = span.SourceRange.End;
    }
    return null;
  }

  private static FsusMarkdownProjectionCommitResult Reject(int revision, string reason) =>
    new(false, revision, [], [], [], reason);
}

internal sealed record FsusMarkdownViewportDiagnostics(
  bool IsVirtualized,
  int TotalLogicalLines,
  int RealizedLogicalLines,
  int RealizedVisualLines,
  int RealizedCharacterCount,
  int RetainedLayoutCount,
  double EstimatedExtentHeight,
  int FullIndexBuildCount,
  int IncrementalIndexUpdateCount);

internal sealed class FsusMarkdownEditorProjectionView : global::Avalonia.Controls.Primitives.TemplatedControl
{
  private const int VirtualizationCharacterThreshold = 100_000;
  private const int VirtualizationLineThreshold = 3_000;
  private const int VirtualizationOverscanLines = 12;

  private TextLayout? layout;
  private string text = string.Empty;
  private string layoutText = string.Empty;
  private readonly List<int> lineStarts = [0];
  private readonly List<double> lineTops = [0, 0];
  private int layoutStart;
  private int layoutEnd;
  private int layoutStartLine;
  private int layoutEndLine;
  private double layoutOriginY;
  private double viewportOffsetY;
  private double viewportHeight = 640;
  private double lineMetricsWidth = double.NaN;
  private int fullIndexBuildCount;
  private int incrementalIndexUpdateCount;
  private FsusMarkdownProjectionMap? map;
  private IReadOnlyList<FsusMarkdownProjectionSpan>? spans;
  private IReadOnlyList<ValueSpan<TextRunProperties>>? styleOverrides;
  private IReadOnlyList<ProseDecoration>? decorations;
  private FsusMarkdownEditorSelection selection = new(0, 0);
  private IReadOnlyList<FsusMarkdownSearchMatch> searchMatches = [];
  private int currentSearchIndex = -1;
  private IReadOnlyList<FsusMarkdownSourceRange> focusActiveRanges = [];
  private IReadOnlyList<FsusMarkdownSourceRange> focusExemptRanges = [];
  private bool focusPresentationEnabled;

  internal FsusMarkdownViewportDiagnostics ViewportDiagnostics => new(
    IsVirtualized,
    lineStarts.Count,
    Math.Max(0, layoutEndLine - layoutStartLine),
    layout?.TextLines.Count ?? 0,
    Math.Max(0, layoutEnd - layoutStart),
    layout is null ? 0 : 1,
    lineTops.Count == 0 ? 0 : lineTops[^1],
    fullIndexBuildCount,
    incrementalIndexUpdateCount);

  internal FsusMarkdownSourceRange VisibleSourceRange
  {
    get
    {
      EnsureLayout(Math.Max(Bounds.Width, 1));
      if (map is null)
      {
        return new(0, 0);
      }
      return new(
        map.VisualToSource(Math.Clamp(layoutStart, 0, text.Length), -1),
        map.VisualToSource(Math.Clamp(layoutEnd, 0, text.Length), 1));
    }
  }

  private bool IsVirtualized =>
    text.Length >= VirtualizationCharacterThreshold ||
    lineStarts.Count >= VirtualizationLineThreshold;

  public void Update(
    string displayText,
    FsusMarkdownProjectionMap? projectionMap,
    FsusMarkdownEditorSelection sourceSelection,
    IReadOnlyList<FsusMarkdownProjectionSpan>? projectionSpans)
  {
    var previousText = text;
    var presentationChanged =
      !string.Equals(text, displayText, StringComparison.Ordinal) ||
      !ReferenceEquals(map, projectionMap) ||
      !ReferenceEquals(spans, projectionSpans);
    text = displayText;
    map = projectionMap;
    spans = projectionSpans;
    selection = sourceSelection;
    if (presentationChanged)
    {
      if (!string.Equals(previousText, displayText, StringComparison.Ordinal))
      {
        UpdateLineIndex(previousText, displayText);
        lineMetricsWidth = double.NaN;
      }
      styleOverrides = null;
      decorations = null;
      layout = null;
      lineMetricsWidth = double.NaN;
      InvalidateMeasure();
    }
    InvalidateVisual();
  }

  public void UpdateViewport(double offsetY, double height)
  {
    var nextOffset = Math.Max(0, offsetY);
    var nextHeight = Math.Max(FontSize * 1.5, height);
    if (Math.Abs(viewportOffsetY - nextOffset) < 0.5 &&
      Math.Abs(viewportHeight - nextHeight) < 0.5)
    {
      return;
    }
    viewportOffsetY = nextOffset;
    viewportHeight = nextHeight;
    if (IsVirtualized)
    {
      layout = null;
      InvalidateVisual();
    }
  }

  public void ReleaseRetainedState()
  {
    layout = null;
    layoutText = string.Empty;
    styleOverrides = null;
    decorations = null;
    layoutStart = 0;
    layoutEnd = 0;
    layoutStartLine = 0;
    layoutEndLine = 0;
    lineMetricsWidth = double.NaN;
  }

  public void UpdateAdjacent(
    IReadOnlyList<FsusMarkdownSearchMatch> matches,
    int currentMatchIndex,
    IReadOnlyList<FsusMarkdownSourceRange> activeRanges,
    IReadOnlyList<FsusMarkdownSourceRange> exemptRanges,
    bool focusEnabled)
  {
    searchMatches = matches;
    currentSearchIndex = currentMatchIndex;
    focusActiveRanges = activeRanges;
    focusExemptRanges = exemptRanges;
    focusPresentationEnabled = focusEnabled;
    InvalidateVisual();
  }

  public int HitTestSource(Point point)
  {
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null || map is null || layoutText.Length == 0)
    {
      return 0;
    }
    var bestOffset = 0;
    var bestDistance = double.PositiveInfinity;
    var localPoint = point.WithY(point.Y - layoutOriginY);
    for (var offset = 0; offset <= layoutText.Length; offset += 1)
    {
      var rectangle = layout.HitTestTextPosition(offset);
      var dx = localPoint.X < rectangle.Left
        ? rectangle.Left - localPoint.X
        : localPoint.X > rectangle.Right ? localPoint.X - rectangle.Right : 0;
      var dy = localPoint.Y < rectangle.Top
        ? rectangle.Top - localPoint.Y
        : localPoint.Y > rectangle.Bottom ? localPoint.Y - rectangle.Bottom : 0;
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance)
      {
        bestDistance = distance;
        bestOffset = offset;
      }
    }
    return map.VisualToSource(layoutStart + bestOffset, 1);
  }

  internal int GetSourceLineAnchor(double visualY)
  {
    if (IsVirtualized)
    {
      EnsureLineMetrics(Math.Max(Bounds.Width, 1));
      var line = FindLineForY(visualY);
      return map?.VisualToSource(lineStarts[line], 1) ?? 0;
    }
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null || map is null || layout.TextLines.Count == 0)
    {
      return 0;
    }

    var target = Math.Max(0, visualY);
    var lineTop = 0d;
    foreach (var line in layout.TextLines)
    {
      if (target < lineTop + line.Height)
      {
        return map.VisualToSource(
          Math.Clamp(line.FirstTextSourceIndex, 0, text.Length),
          1);
      }
      lineTop += line.Height;
    }

    return map.VisualToSource(text.Length, 1);
  }

  internal double GetVisualLineTopForSource(int sourceOffset)
  {
    if (map is null)
    {
      return 0;
    }
    var visualOffset = map.SourceToVisual(sourceOffset, -1);
    if (IsVirtualized)
    {
      EnsureLineMetrics(Math.Max(Bounds.Width, 1));
      return lineTops[FindLineIndex(visualOffset)];
    }
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null)
    {
      return 0;
    }
    return Math.Max(
      0,
      layout.HitTestTextPosition(Math.Clamp(visualOffset, 0, text.Length)).Top);
  }

  protected override Size MeasureOverride(Size availableSize)
  {
    EnsureLayout(double.IsInfinity(availableSize.Width) ? 640 : Math.Max(availableSize.Width, 1));
    if (layout is null)
    {
      return new Size(0, EstimatedLineHeight);
    }
    var height = IsVirtualized
      ? Math.Max(EstimatedLineHeight, lineTops[^1])
      : Math.Max(layout.Height, EstimatedLineHeight);
    return new Size(layout.WidthIncludingTrailingWhitespace, height);
  }

  public override void Render(DrawingContext context)
  {
    base.Render(context);
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null)
    {
      return;
    }

    var globalVisualStart = map?.SourceToVisual(selection.Start, -1) ?? 0;
    var globalVisualEnd = map?.SourceToVisual(selection.End, 1) ?? globalVisualStart;
    using var translated = context.PushTransform(
      Matrix.CreateTranslation(0, layoutOriginY));
    var visualStart = Math.Clamp(
      globalVisualStart - layoutStart,
      0,
      layoutText.Length);
    var visualEnd = Math.Clamp(
      globalVisualEnd - layoutStart,
      0,
      layoutText.Length);
    DrawSearchHighlights(context, layout);
    if (visualEnd > visualStart &&
      globalVisualEnd > layoutStart &&
      globalVisualStart < layoutEnd)
    {
      var selectionBrush = new SolidColorBrush(Color.FromArgb(72, 66, 133, 244));
      for (var offset = visualStart;
        offset < visualEnd;
        offset += 1)
      {
        var start = layout.HitTestTextPosition(offset);
        var end = layout.HitTestTextPosition(offset + 1);
        var width = Math.Abs(start.Top - end.Top) < 0.5
          ? Math.Max(1, end.Left - start.Left)
          : Math.Max(1, start.Width);
        context.FillRectangle(
          selectionBrush,
          new Rect(start.Left, start.Top, width, Math.Max(start.Height, FontSize * 1.2)));
      }
    }
    DrawProjectionText(context, layout);
    if (globalVisualStart == globalVisualEnd &&
      globalVisualStart >= layoutStart &&
      globalVisualStart <= layoutEnd)
    {
      var caret = layout.HitTestTextPosition(visualStart);
      context.DrawLine(
        new Pen(Foreground ?? Brushes.Black, 1),
        new Point(caret.Left, caret.Top),
        new Point(caret.Left, caret.Bottom));
    }
  }

  private void DrawSearchHighlights(DrawingContext context, TextLayout textLayout)
  {
    if (map is null || searchMatches.Count == 0)
    {
      return;
    }
    var accent = ResolveBrush("FsusColorActionPrimaryBrush") ?? Brushes.DodgerBlue;
    var quiet = ResolveBrush("FsusComponentStateSurfaceEmphasisBackgroundBrush") ?? accent;
    for (var index = 0; index < searchMatches.Count; index += 1)
    {
      var range = searchMatches[index].SourceRange;
      var start = Math.Clamp(
        map.SourceToVisual(range.Start, -1) - layoutStart,
        0,
        layoutText.Length);
      var end = Math.Clamp(
        map.SourceToVisual(range.End, 1) - layoutStart,
        0,
        layoutText.Length);
      if (end <= start)
      {
        continue;
      }
      using var opacity = context.PushOpacity(index == currentSearchIndex ? 0.32 : 0.18);
      foreach (var rectangle in textLayout.HitTestTextRange(start, end - start))
      {
        context.FillRectangle(
          index == currentSearchIndex ? accent : quiet,
          new Rect(
            rectangle.Left,
            rectangle.Top,
            Math.Max(1, rectangle.Width),
            Math.Max(rectangle.Height, FontSize * 1.2)));
      }
    }
  }

  private void DrawProjectionText(DrawingContext context, TextLayout textLayout)
  {
    if (!focusPresentationEnabled ||
      map is null ||
      focusActiveRanges.Count + focusExemptRanges.Count == 0)
    {
      DrawDecorations(context, textLayout);
      textLayout.Draw(context, default);
      return;
    }

    // Match the public Web Focus presentation contract without introducing an
    // Avalonia-only opacity or changing layout metrics.
    using (context.PushOpacity(0.72))
    {
      DrawDecorations(context, textLayout);
      textLayout.Draw(context, default);
    }
    foreach (var range in focusActiveRanges.Concat(focusExemptRanges))
    {
      var start = Math.Clamp(
        map.SourceToVisual(range.Start, -1) - layoutStart,
        0,
        layoutText.Length);
      var end = Math.Clamp(
        map.SourceToVisual(range.End, 1) - layoutStart,
        0,
        layoutText.Length);
      if (end <= start)
      {
        continue;
      }
      foreach (var rectangle in textLayout.HitTestTextRange(start, end - start))
      {
        using var clip = context.PushClip(new Rect(
          rectangle.Left,
          rectangle.Top,
          Math.Max(1, rectangle.Width),
          Math.Max(rectangle.Height, FontSize * 1.2)));
        DrawDecorations(context, textLayout);
        textLayout.Draw(context, default);
      }
    }
  }

  private void DrawDecorations(DrawingContext context, TextLayout textLayout)
  {
    if (decorations is null)
    {
      return;
    }
    foreach (var decoration in decorations)
    {
      decoration.Draw(context, textLayout);
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == FontFamilyProperty ||
      change.Property == FontSizeProperty ||
      change.Property == FontStyleProperty ||
      change.Property == FontWeightProperty ||
      change.Property == FontStretchProperty ||
      change.Property == FontFeaturesProperty ||
      change.Property == ForegroundProperty)
    {
      styleOverrides = null;
      decorations = null;
      layout = null;
      lineMetricsWidth = double.NaN;
      InvalidateMeasure();
      InvalidateVisual();
    }
  }

  private void EnsureLayout(double width)
  {
    if (layout is not null && Math.Abs(layout.MaxWidth - width) < 0.5)
    {
      return;
    }
    EnsureLineMetrics(width);
    ResolveLayoutWindow();
    BuildProsePresentation(layoutStart, layoutEnd);
    layout = new TextLayout(
      layoutText,
      new Typeface(FontFamily, FontStyle, FontWeight, FontStretch),
      FontSize,
      Foreground ?? Brushes.Black,
      TextAlignment.Left,
      TextWrapping.Wrap,
      TextTrimming.None,
      null,
      FlowDirection,
      width,
      double.PositiveInfinity,
      double.NaN,
      0,
      0,
      FontFeatures,
      styleOverrides,
      null);
  }

  private double EstimatedLineHeight => Math.Max(1, FontSize * 1.5);

  private void ResolveLayoutWindow()
  {
    if (!IsVirtualized)
    {
      layoutStart = 0;
      layoutEnd = text.Length;
      layoutStartLine = 0;
      layoutEndLine = lineStarts.Count;
      layoutOriginY = 0;
      layoutText = text;
      return;
    }

    var firstVisibleLine = Math.Clamp(
      FindLineForY(viewportOffsetY),
      0,
      Math.Max(0, lineStarts.Count - 1));
    var lastVisibleLine = Math.Clamp(
      FindLineForY(viewportOffsetY + viewportHeight) + 1,
      firstVisibleLine,
      lineStarts.Count);
    layoutStartLine = Math.Max(0, firstVisibleLine - VirtualizationOverscanLines);
    layoutEndLine = Math.Min(
      lineStarts.Count,
      lastVisibleLine + VirtualizationOverscanLines);
    layoutStart = lineStarts[layoutStartLine];
    layoutEnd = layoutEndLine < lineStarts.Count
      ? lineStarts[layoutEndLine]
      : text.Length;
    layoutOriginY = lineTops[layoutStartLine];
    layoutText = text[layoutStart..layoutEnd];
  }

  /// <summary>
  /// Resolves the fsus-prose-equivalent presentation for the committed
  /// projection spans: typography runs per SemanticKind plus the quote and
  /// list decorations. Presentation is theme-driven; every value resolves
  /// through a theme resource with a light/dark-safe fallback.
  /// </summary>
  private void BuildProsePresentation(int windowStart, int windowEnd)
  {
    styleOverrides = null;
    decorations = null;
    if (map is null || spans is null || spans.Count == 0 || text.Length == 0)
    {
      return;
    }

    var runs = new List<ValueSpan<TextRunProperties>>();
    var decorationsToDraw = new List<ProseDecoration>();
    var headingLevels = BuildHeadingLevels(spans);
    IBrush? linkBrush = ResolveBrush("FsusColorActionPrimaryBrush");
    IBrush? quietBrush = ResolveBrush("FsusThemeMutedTextBrush");
    IBrush? codeBackgroundBrush = ResolveBrush("FsusThemeSurfaceRaisedBrush");
    var monospace = new Typeface("monospace");

    foreach (var span in spans)
    {
      if (span.Kind == FsusMarkdownProjectionSpanKind.HiddenMarker ||
        span.Kind == FsusMarkdownProjectionSpanKind.SourceFallback ||
        span.SemanticKind is null)
      {
        continue;
      }
      var visualStart = map.SourceToVisual(span.SourceRange.Start, -1);
      var visualEnd = map.SourceToVisual(span.SourceRange.End, 1);
      if (visualEnd <= visualStart)
      {
        continue;
      }
      visualStart = Math.Clamp(visualStart, windowStart, windowEnd) - windowStart;
      visualEnd = Math.Clamp(visualEnd, windowStart, windowEnd) - windowStart;
      if (visualEnd <= visualStart)
      {
        continue;
      }

      var kind = span.SemanticKind;
      if (kind == "strong")
      {
        runs.Add(new(visualStart, visualEnd - visualStart, new ProseTextRunProperties(
          new Typeface(FontFamily, FontStyle, FontWeight.Bold, FontStretch),
          FontSize,
          Foreground ?? Brushes.Black,
          null)));
      }
      else if (kind == "code")
      {
        runs.Add(new(visualStart, visualEnd - visualStart, new ProseTextRunProperties(
          monospace,
          Math.Max(8, FontSize * 0.9),
          Foreground ?? Brushes.Black,
          codeBackgroundBrush)));
      }
      else if (kind == "link")
      {
        runs.Add(new(visualStart, visualEnd - visualStart, new ProseTextRunProperties(
          new Typeface(FontFamily, FontStyle, FontWeight, FontStretch),
          FontSize,
          linkBrush ?? Foreground ?? Brushes.Black,
          null)));
      }
      else if (kind == "heading" &&
        headingLevels.TryGetValue(span.NodeId, out var level))
      {
        // prose.scss ladder: h1 base+16, h2 base+8, h3 base+4, h4-h6 inherit;
        // all heading levels share weight 700 and line-height 1.2.
        var sizeDelta = level switch
        {
          1 => 16,
          2 => 8,
          3 => 4,
          _ => 0,
        };
        runs.Add(new(visualStart, visualEnd - visualStart, new ProseTextRunProperties(
          new Typeface(FontFamily, FontStyle, FontWeight.Bold, FontStretch),
          FontSize + sizeDelta,
          Foreground ?? Brushes.Black,
          null)));
      }
      else if (kind == "quote")
      {
        runs.Add(new(visualStart, visualEnd - visualStart, new ProseTextRunProperties(
          new Typeface(FontFamily, FontStyle, FontWeight, FontStretch),
          FontSize,
          quietBrush ?? Foreground ?? Brushes.Black,
          null)));
        decorationsToDraw.Add(new QuoteBorderDecoration(visualStart, visualEnd, quietBrush));
      }
      else if (kind is "list" or "task")
      {
        decorationsToDraw.Add(new ListMarkerDecoration(visualStart, quietBrush));
      }
    }

    if (runs.Count > 0)
    {
      styleOverrides = runs
        .OrderBy(run => run.Start)
        .ToList();
    }
    if (decorationsToDraw.Count > 0)
    {
      decorations = decorationsToDraw;
    }
  }

  /// <summary>
  /// Derives heading levels (1-6) by pairing each heading text span with the
  /// hidden marker span immediately before it. The level is the marker range
  /// length; no Markdown syntax is re-parsed beyond consuming the canonical
  /// runtime's marker geometry.
  /// </summary>
  private static Dictionary<string, int> BuildHeadingLevels(
    IReadOnlyList<FsusMarkdownProjectionSpan> spans)
  {
    var levels = new Dictionary<string, int>(StringComparer.Ordinal);
    FsusMarkdownProjectionSpan? previous = null;
    foreach (var span in spans)
    {
      if (previous is not null &&
        previous.Kind == FsusMarkdownProjectionSpanKind.HiddenMarker &&
        previous.SourceRange.End == span.SourceRange.Start &&
        span.SemanticKind == "heading")
      {
        var level = previous.SourceRange.End - previous.SourceRange.Start;
        if (level >= 1 && level <= 6)
        {
          levels[span.NodeId] = level;
        }
      }
      previous = span;
    }
    return levels;
  }

  private void UpdateLineIndex(string previous, string current)
  {
    if (previous.Length == 0 || lineStarts.Count == 0)
    {
      RebuildLineIndex(current);
      return;
    }
    if (string.Equals(previous, current, StringComparison.Ordinal))
    {
      return;
    }

    var prefix = 0;
    while (prefix < previous.Length &&
      prefix < current.Length &&
      previous[prefix] == current[prefix])
    {
      prefix += 1;
    }
    var previousSuffix = previous.Length;
    var currentSuffix = current.Length;
    while (previousSuffix > prefix &&
      currentSuffix > prefix &&
      previous[previousSuffix - 1] == current[currentSuffix - 1])
    {
      previousSuffix -= 1;
      currentSuffix -= 1;
    }

    var prefixLine = FindLineIndex(prefix);
    var rebuildStart = lineStarts[prefixLine];
    var suffixLine = LowerBound(lineStarts, previousSuffix);
    var previousAnchor = suffixLine < lineStarts.Count
      ? lineStarts[suffixLine]
      : previous.Length;
    var delta = current.Length - previous.Length;
    var currentAnchor = previousAnchor + delta;
    if (currentAnchor < rebuildStart ||
      currentAnchor < 0 ||
      currentAnchor > current.Length ||
      !previous.AsSpan(previousAnchor).SequenceEqual(current.AsSpan(currentAnchor)))
    {
      RebuildLineIndex(current);
      return;
    }

    var next = new List<int>(lineStarts.Count + 4);
    for (var index = 0; index <= prefixLine && index < lineStarts.Count; index += 1)
    {
      next.Add(lineStarts[index]);
    }
    for (var index = rebuildStart; index < currentAnchor; index += 1)
    {
      if (current[index] == '\n' &&
        index + 1 < currentAnchor &&
        (next.Count == 0 || next[^1] != index + 1))
      {
        next.Add(index + 1);
      }
    }
    for (var index = suffixLine; index < lineStarts.Count; index += 1)
    {
      var shifted = lineStarts[index] + delta;
      if (shifted >= 0 &&
        shifted <= current.Length &&
        (next.Count == 0 || next[^1] != shifted))
      {
        next.Add(shifted);
      }
    }
    if (next.Count == 0 || next[0] != 0)
    {
      RebuildLineIndex(current);
      return;
    }
    lineStarts.Clear();
    lineStarts.AddRange(next);
    lineMetricsWidth = double.NaN;
    incrementalIndexUpdateCount += 1;
  }

  private void RebuildLineIndex(string source)
  {
    lineStarts.Clear();
    lineStarts.Add(0);
    for (var index = 0; index < source.Length; index += 1)
    {
      if (source[index] == '\n' && index + 1 < source.Length)
      {
        lineStarts.Add(index + 1);
      }
    }
    lineMetricsWidth = double.NaN;
    fullIndexBuildCount += 1;
  }

  private void EnsureLineMetrics(double width)
  {
    if (!double.IsNaN(lineMetricsWidth) &&
      Math.Abs(lineMetricsWidth - width) < 0.5 &&
      lineTops.Count == lineStarts.Count + 1)
    {
      return;
    }
    lineMetricsWidth = width;
    lineTops.Clear();
    lineTops.Add(0);
    var latinColumnWidth = Math.Max(1, FontSize * 0.56);
    var cjkColumnWidth = Math.Max(latinColumnWidth, FontSize);
    for (var line = 0; line < lineStarts.Count; line += 1)
    {
      var start = lineStarts[line];
      var end = line + 1 < lineStarts.Count
        ? Math.Max(start, lineStarts[line + 1] - 1)
        : text.Length;
      var columns = 0d;
      foreach (var rune in text.AsSpan(start, Math.Max(0, end - start)).EnumerateRunes())
      {
        columns += rune.Value >= 0x2E80 ? cjkColumnWidth : latinColumnWidth;
      }
      var wraps = Math.Max(1, (int)Math.Ceiling(columns / Math.Max(1, width)));
      lineTops.Add(lineTops[^1] + (wraps * EstimatedLineHeight));
    }
  }

  private int FindLineForY(double visualY)
  {
    var target = Math.Max(0, visualY);
    var low = 0;
    var high = Math.Max(0, lineTops.Count - 1);
    while (low < high)
    {
      var middle = low + ((high - low) / 2);
      if (lineTops[middle + 1] <= target)
      {
        low = middle + 1;
      }
      else
      {
        high = middle;
      }
    }
    return Math.Clamp(low, 0, Math.Max(0, lineStarts.Count - 1));
  }

  private int FindLineIndex(int visualOffset)
  {
    var insertion = LowerBound(lineStarts, Math.Clamp(visualOffset, 0, text.Length));
    if (insertion < lineStarts.Count && lineStarts[insertion] == visualOffset)
    {
      return insertion;
    }
    return Math.Max(0, insertion - 1);
  }

  private static int LowerBound(IReadOnlyList<int> values, int target)
  {
    var low = 0;
    var high = values.Count;
    while (low < high)
    {
      var middle = low + ((high - low) / 2);
      if (values[middle] < target)
      {
        low = middle + 1;
      }
      else
      {
        high = middle;
      }
    }
    return low;
  }

  private IBrush? ResolveBrush(string key) =>
    this.TryFindResource(key, out var resource) && resource is IBrush brush ? brush : null;

  private sealed class ProseTextRunProperties(
    Typeface typeface,
    double fontRenderingEmSize,
    IBrush? foregroundBrush,
    IBrush? backgroundBrush) : TextRunProperties
  {
    public override Typeface Typeface { get; } = typeface;

    public override double FontRenderingEmSize { get; } = fontRenderingEmSize;

    public override TextDecorationCollection? TextDecorations => null;

    public override IBrush? ForegroundBrush { get; } = foregroundBrush;

    public override IBrush? BackgroundBrush { get; } = backgroundBrush;

    public override CultureInfo? CultureInfo => null;

    public override FontFeatureCollection? FontFeatures => null;

    public override BaselineAlignment BaselineAlignment => BaselineAlignment.Baseline;
  }

  private abstract class ProseDecoration(int visualStart, int visualEnd)
  {
    protected readonly int VisualStart = visualStart;
    protected readonly int VisualEnd = visualEnd;

    public abstract void Draw(DrawingContext context, TextLayout layout);
  }

  private sealed class QuoteBorderDecoration(
    int visualStart,
    int visualEnd,
    IBrush? brush) : ProseDecoration(visualStart, visualEnd)
  {
    public override void Draw(DrawingContext context, TextLayout layout)
    {
      if (brush is null || layout.TextLines.Count == 0)
      {
        return;
      }
      var first = LineBounds(layout, VisualStart);
      var last = LineBounds(layout, Math.Max(VisualStart, VisualEnd - 1));
      if (first is null)
      {
        return;
      }
      var top = first.Value.Top;
      var bottom = last?.Bottom ?? first.Value.Bottom;
      context.FillRectangle(
        brush,
        new Rect(Math.Max(0, first.Value.Left - 8), top, 2, Math.Max(2, bottom - top)));
    }
  }

  private sealed class ListMarkerDecoration(
    int visualStart,
    IBrush? brush) : ProseDecoration(visualStart, visualStart)
  {
    public override void Draw(DrawingContext context, TextLayout layout)
    {
      if (brush is null)
      {
        return;
      }
      var line = LineBounds(layout, VisualStart);
      if (line is null)
      {
        return;
      }
      var size = 4d;
      var top = line.Value.Top + (line.Value.Height * 0.6) - (size / 2);
      context.DrawRectangle(
        brush,
        null,
        new RoundedRect(
          new Rect(Math.Max(2, line.Value.Left - 14), top, size, size),
          size / 2));
    }
  }

  private static Rect? LineBounds(TextLayout layout, int visualOffset)
  {
    if (layout.TextLines.Count == 0)
    {
      return null;
    }
    var clamped = Math.Max(0, visualOffset);
    var lineTop = 0d;
    foreach (var line in layout.TextLines)
    {
      var lineEnd = line.FirstTextSourceIndex + line.Length;
      if (clamped < lineEnd || ReferenceEquals(line, layout.TextLines[^1]))
      {
        var position = layout.HitTestTextPosition(clamped);
        return new Rect(position.Left, lineTop, Math.Max(position.Width, 1), line.Height);
      }
      lineTop += line.Height;
    }
    return null;
  }
}

internal static class FsusMarkdownProjectionArchitecture
{
  public static void EnsureSupported(
    IEnumerable<Control> nativeControls,
    FsusMarkdownEditorProjectionState projectionState)
  {
    ArgumentNullException.ThrowIfNull(nativeControls);
    ArgumentNullException.ThrowIfNull(projectionState);
    var actual = Capture(nativeControls, projectionState);
    if (!IsSupported(actual))
    {
      throw new InvalidOperationException(
        "The native Markdown projection surface violated its single-owner architecture.");
    }
  }

  public static IReadOnlyList<FsusMarkdownEditorShellMutation> EvaluateMutations()
  {
    var baseline = Capture(
      [new TextBox(), new FsusMarkdownEditorProjectionView()],
      new FsusMarkdownEditorProjectionState());
    var secondParser = baseline with
    {
      NativeControlTypes =
      [
        .. baseline.NativeControlTypes,
        "FsusUI.Avalonia.Controls.MutatedMarkdownParserControl",
      ],
    };
    var webView = baseline with
    {
      NativeControlTypes =
      [
        .. baseline.NativeControlTypes,
        "Avalonia.Controls.MutatedWebView",
      ],
    };
    var perBlockTextBox = baseline with
    {
      NativeControlTypes =
      [
        .. baseline.NativeControlTypes,
        typeof(TextBox).FullName!,
      ],
    };
    var fullRebuild = baseline with { HasIncrementalAdvance = false };

    return
    [
      Evaluate("second-parser", baseline, secondParser),
      Evaluate("webview", baseline, webView),
      Evaluate("per-block-textbox", baseline, perBlockTextBox),
      Evaluate("full-rebuild", baseline, fullRebuild),
    ];
  }

  private static ArchitectureShape Capture(
    IEnumerable<Control> nativeControls,
    FsusMarkdownEditorProjectionState projectionState)
  {
    var controlTypes = nativeControls
      .Select(control => control.GetType().FullName ?? control.GetType().Name)
      .Order(StringComparer.Ordinal)
      .ToArray();
    var hasIncrementalAdvance = projectionState
      .GetType()
      .GetMethod(nameof(FsusMarkdownEditorProjectionState.Advance)) is not null;
    return new(controlTypes, hasIncrementalAdvance);
  }

  private static bool IsSupported(ArchitectureShape shape) =>
    !shape.NativeControlTypes.Any(type =>
      type.Contains("Markdown", StringComparison.Ordinal) &&
      type.Contains("Parser", StringComparison.Ordinal)) &&
    shape.NativeControlTypes.Count(type =>
      string.Equals(type, typeof(TextBox).FullName, StringComparison.Ordinal)) == 1 &&
    !shape.NativeControlTypes.Any(type =>
      type.Contains("WebView", StringComparison.OrdinalIgnoreCase)) &&
    shape.HasIncrementalAdvance;

  private static FsusMarkdownEditorShellMutation Evaluate(
    string kind,
    ArchitectureShape baseline,
    ArchitectureShape mutated) =>
    new(
      kind,
      string.Equals(
        baseline.Signature,
        mutated.Signature,
        StringComparison.Ordinal),
      IsSupported(mutated));

  private sealed record ArchitectureShape(
    IReadOnlyList<string> NativeControlTypes,
    bool HasIncrementalAdvance)
  {
    public string Signature =>
      $"{string.Join('\u001F', NativeControlTypes)}\u001E" +
      HasIncrementalAdvance;
  }
}
