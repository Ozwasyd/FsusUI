using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;

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

internal sealed class FsusMarkdownEditorProjectionView : global::Avalonia.Controls.Primitives.TemplatedControl
{
  private TextLayout? layout;
  private string text = string.Empty;
  private FsusMarkdownProjectionMap? map;
  private FsusMarkdownEditorSelection selection = new(0, 0);

  public void Update(
    string displayText,
    FsusMarkdownProjectionMap? projectionMap,
    FsusMarkdownEditorSelection sourceSelection)
  {
    var presentationChanged =
      !string.Equals(text, displayText, StringComparison.Ordinal) ||
      !ReferenceEquals(map, projectionMap);
    text = displayText;
    map = projectionMap;
    selection = sourceSelection;
    if (presentationChanged)
    {
      layout = null;
      InvalidateMeasure();
    }
    InvalidateVisual();
  }

  public int HitTestSource(Point point)
  {
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null || map is null || text.Length == 0)
    {
      return 0;
    }
    var bestOffset = 0;
    var bestDistance = double.PositiveInfinity;
    for (var offset = 0; offset <= text.Length; offset += 1)
    {
      var rectangle = layout.HitTestTextPosition(offset);
      var dx = point.X < rectangle.Left
        ? rectangle.Left - point.X
        : point.X > rectangle.Right ? point.X - rectangle.Right : 0;
      var dy = point.Y < rectangle.Top
        ? rectangle.Top - point.Y
        : point.Y > rectangle.Bottom ? point.Y - rectangle.Bottom : 0;
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance)
      {
        bestDistance = distance;
        bestOffset = offset;
      }
    }
    return map.VisualToSource(bestOffset, 1);
  }

  internal int GetSourceLineAnchor(double visualY)
  {
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
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null || map is null)
    {
      return 0;
    }
    var visualOffset = map.SourceToVisual(sourceOffset, -1);
    return Math.Max(
      0,
      layout.HitTestTextPosition(Math.Clamp(visualOffset, 0, text.Length)).Top);
  }

  protected override Size MeasureOverride(Size availableSize)
  {
    EnsureLayout(double.IsInfinity(availableSize.Width) ? 640 : Math.Max(availableSize.Width, 1));
    return layout is null
      ? new Size(0, FontSize * 1.5)
      : new Size(layout.WidthIncludingTrailingWhitespace, Math.Max(layout.Height, FontSize * 1.5));
  }

  public override void Render(DrawingContext context)
  {
    base.Render(context);
    EnsureLayout(Math.Max(Bounds.Width, 1));
    if (layout is null)
    {
      return;
    }

    var visualStart = map?.SourceToVisual(selection.Start, -1) ?? 0;
    var visualEnd = map?.SourceToVisual(selection.End, 1) ?? visualStart;
    if (visualEnd > visualStart)
    {
      var selectionBrush = new SolidColorBrush(Color.FromArgb(72, 66, 133, 244));
      for (var offset = Math.Clamp(visualStart, 0, text.Length);
        offset < Math.Clamp(visualEnd, 0, text.Length);
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
    layout.Draw(context, default);
    if (visualStart == visualEnd)
    {
      var caret = layout.HitTestTextPosition(Math.Clamp(visualStart, 0, text.Length));
      context.DrawLine(
        new Pen(Foreground ?? Brushes.Black, 1),
        new Point(caret.Left, caret.Top),
        new Point(caret.Left, caret.Bottom));
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
      layout = null;
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
    layout = new TextLayout(
      text,
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
      null);
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
