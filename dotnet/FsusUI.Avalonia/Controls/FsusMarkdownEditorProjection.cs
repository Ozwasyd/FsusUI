using System.Text;

namespace FsusUI.Avalonia.Controls;

/// <summary>
/// Describes how a canonical Markdown projection span is presented by a native editor surface.
/// The values are parser-neutral and do not expose Avalonia layout objects.
/// </summary>
public enum FsusMarkdownProjectionSpanKind
{
  Text,
  HiddenMarker,
  Atomic,
  SourceFallback,
}

public sealed record FsusMarkdownProjectionSpan(
  string NodeId,
  FsusMarkdownSourceRange SourceRange,
  FsusMarkdownProjectionSpanKind Kind,
  string DisplayText,
  string? SemanticKind = null,
  string? FallbackReason = null);

/// <summary>
/// Immutable output from the canonical Markdown projection owner.
/// Source offsets are UTF-16 offsets in <see cref="Source"/>.
/// </summary>
public sealed record FsusMarkdownProjectionSnapshot(
  FsusMarkdownDocumentIdentity DocumentIdentity,
  int Revision,
  string Source,
  IReadOnlyList<FsusMarkdownProjectionSpan> Spans,
  long FeatureRevision = 0);

public sealed record FsusMarkdownProjectionCommitResult(
  bool Accepted,
  int Revision,
  IReadOnlyList<string> RetainedNodeIds,
  IReadOnlyList<string> RebuiltNodeIds,
  IReadOnlyList<string> RemovedNodeIds,
  string? Reason = null);

public sealed class FsusMarkdownProjectionRequestedEventArgs(
  FsusMarkdownDocumentIdentity documentIdentity,
  int revision,
  string source,
  long featureRevision,
  FsusMarkdownSourceCoordinateMap coordinates) : EventArgs
{
  public FsusMarkdownDocumentIdentity DocumentIdentity { get; } = documentIdentity;

  public int Revision { get; } = revision;

  public string Source { get; } = source;

  public long FeatureRevision { get; } = featureRevision;

  public FsusMarkdownSourceCoordinateMap Coordinates { get; } = coordinates;
}

/// <summary>
/// Raw/normalized source coordinates shared by Source and Live presentation.
/// Normalization removes one leading BOM and maps CRLF/CR to LF without parsing Markdown.
/// </summary>
public sealed class FsusMarkdownSourceCoordinateMap
{
  private readonly int[] rawToNormalized;
  private readonly int[] normalizedToRawBefore;
  private readonly int[] normalizedToRawAfter;

  private FsusMarkdownSourceCoordinateMap(
    string rawSource,
    string normalizedSource,
    int[] rawToNormalized,
    int[] normalizedToRawBefore,
    int[] normalizedToRawAfter)
  {
    RawSource = rawSource;
    NormalizedSource = normalizedSource;
    this.rawToNormalized = rawToNormalized;
    this.normalizedToRawBefore = normalizedToRawBefore;
    this.normalizedToRawAfter = normalizedToRawAfter;
  }

  public string RawSource { get; }

  public string NormalizedSource { get; }

  public static FsusMarkdownSourceCoordinateMap Create(string rawSource)
  {
    ArgumentNullException.ThrowIfNull(rawSource);
    var normalized = new StringBuilder(rawSource.Length);
    var rawToNormalized = new int[rawSource.Length + 1];
    var normalizedBefore = new List<int> { 0 };
    var normalizedAfter = new List<int> { 0 };
    var raw = 0;
    var normalizedOffset = 0;

    if (rawSource.Length > 0 && rawSource[0] == '\uFEFF')
    {
      rawToNormalized[0] = 0;
      rawToNormalized[1] = 0;
      normalizedAfter[0] = 1;
      raw = 1;
    }

    while (raw < rawSource.Length)
    {
      rawToNormalized[raw] = normalizedOffset;
      var rawLength = rawSource[raw] == '\r' &&
        raw + 1 < rawSource.Length &&
        rawSource[raw + 1] == '\n'
        ? 2
        : 1;
      var value = rawSource[raw] == '\r' ? '\n' : rawSource[raw];
      normalized.Append(value);
      for (var index = 1; index < rawLength; index += 1)
      {
        rawToNormalized[raw + index] = normalizedOffset;
      }
      normalizedOffset += 1;
      raw += rawLength;
      rawToNormalized[raw] = normalizedOffset;
      normalizedBefore.Add(raw);
      normalizedAfter.Add(raw);
    }

    for (var offset = 0; offset < rawToNormalized.Length; offset += 1)
    {
      var mapped = rawToNormalized[offset];
      normalizedBefore[mapped] = Math.Min(normalizedBefore[mapped], offset);
      normalizedAfter[mapped] = Math.Max(normalizedAfter[mapped], offset);
    }

    return new(
      rawSource,
      normalized.ToString(),
      rawToNormalized,
      normalizedBefore.ToArray(),
      normalizedAfter.ToArray());
  }

  public int RawToNormalized(int rawOffset)
  {
    if (rawOffset < 0 || rawOffset > RawSource.Length)
    {
      throw new ArgumentOutOfRangeException(nameof(rawOffset));
    }
    return rawToNormalized[rawOffset];
  }

  public int NormalizedToRaw(int normalizedOffset, int association)
  {
    if (normalizedOffset < 0 || normalizedOffset > NormalizedSource.Length)
    {
      throw new ArgumentOutOfRangeException(nameof(normalizedOffset));
    }
    if (association is not (-1 or 1))
    {
      throw new ArgumentOutOfRangeException(nameof(association));
    }
    return association < 0
      ? normalizedToRawBefore[normalizedOffset]
      : normalizedToRawAfter[normalizedOffset];
  }
}

/// <summary>
/// Bidirectional source/presentation map for hidden markers, visible text, and atomic spans.
/// </summary>
public sealed class FsusMarkdownProjectionMap
{
  private readonly IReadOnlyList<Entry> entries;
  private readonly int sourceLength;

  internal FsusMarkdownProjectionMap(string source, IReadOnlyList<FsusMarkdownProjectionSpan> spans)
  {
    sourceLength = source.Length;
    var built = new List<Entry>();
    var sourceCursor = 0;
    var visualCursor = 0;
    foreach (var span in spans)
    {
      if (span.SourceRange.Start > sourceCursor)
      {
        var fallback = source[sourceCursor..span.SourceRange.Start];
        built.Add(new(sourceCursor, span.SourceRange.Start, visualCursor, visualCursor + fallback.Length, false, false));
        visualCursor += fallback.Length;
      }
      var visualLength = span.Kind == FsusMarkdownProjectionSpanKind.HiddenMarker
        ? 0
        : span.DisplayText.Length;
      built.Add(new(
        span.SourceRange.Start,
        span.SourceRange.End,
        visualCursor,
        visualCursor + visualLength,
        span.Kind == FsusMarkdownProjectionSpanKind.HiddenMarker,
        span.Kind == FsusMarkdownProjectionSpanKind.Atomic));
      sourceCursor = span.SourceRange.End;
      visualCursor += visualLength;
    }
    if (sourceCursor < source.Length)
    {
      built.Add(new(sourceCursor, source.Length, visualCursor, visualCursor + source.Length - sourceCursor, false, false));
    }
    entries = built;
    VisualLength = entries.Count == 0 ? 0 : entries[^1].VisualEnd;
  }

  public int VisualLength { get; }

  public int SourceToVisual(int sourceOffset, int association)
  {
    if (sourceOffset < 0 || sourceOffset > sourceLength)
    {
      throw new ArgumentOutOfRangeException(nameof(sourceOffset));
    }
    if (association is not (-1 or 1))
    {
      throw new ArgumentOutOfRangeException(nameof(association));
    }
    foreach (var entry in entries)
    {
      if (sourceOffset < entry.SourceStart)
      {
        return entry.VisualStart;
      }
      if (sourceOffset <= entry.SourceEnd)
      {
        if (entry.Hidden)
        {
          return entry.VisualStart;
        }
        if (entry.Atomic)
        {
          return association < 0 ? entry.VisualStart : entry.VisualEnd;
        }
        var sourceLength = entry.SourceEnd - entry.SourceStart;
        var visualLength = entry.VisualEnd - entry.VisualStart;
        if (sourceLength == 0 || visualLength == 0)
        {
          return entry.VisualStart;
        }
        var relative = Math.Clamp(sourceOffset - entry.SourceStart, 0, sourceLength);
        return entry.VisualStart + (int)Math.Round(
          (double)relative * visualLength / sourceLength,
          association < 0 ? MidpointRounding.ToNegativeInfinity : MidpointRounding.ToPositiveInfinity);
      }
    }
    return VisualLength;
  }

  public int VisualToSource(int visualOffset, int association)
  {
    if (visualOffset < 0 || visualOffset > VisualLength)
    {
      throw new ArgumentOutOfRangeException(nameof(visualOffset));
    }
    if (association is not (-1 or 1))
    {
      throw new ArgumentOutOfRangeException(nameof(association));
    }
    var hiddenAtOffset = entries
      .Where(entry =>
        entry.Hidden &&
        entry.VisualStart == visualOffset &&
        entry.VisualEnd == visualOffset)
      .ToArray();
    if (hiddenAtOffset.Length > 0)
    {
      return association < 0
        ? hiddenAtOffset.Min(entry => entry.SourceStart)
        : hiddenAtOffset.Max(entry => entry.SourceEnd);
    }
    foreach (var entry in entries)
    {
      if (visualOffset < entry.VisualStart)
      {
        return entry.SourceStart;
      }
      if (visualOffset <= entry.VisualEnd)
      {
        if (entry.Hidden)
        {
          return association < 0 ? entry.SourceStart : entry.SourceEnd;
        }
        if (entry.Atomic)
        {
          var midpoint = entry.VisualStart + (entry.VisualEnd - entry.VisualStart) / 2d;
          return visualOffset < midpoint || (visualOffset == midpoint && association < 0)
            ? entry.SourceStart
            : entry.SourceEnd;
        }
        var visualLength = entry.VisualEnd - entry.VisualStart;
        var sourceLength = entry.SourceEnd - entry.SourceStart;
        if (visualLength == 0 || sourceLength == 0)
        {
          return entry.SourceStart;
        }
        var relative = Math.Clamp(visualOffset - entry.VisualStart, 0, visualLength);
        return entry.SourceStart + (int)Math.Round(
          (double)relative * sourceLength / visualLength,
          association < 0 ? MidpointRounding.ToNegativeInfinity : MidpointRounding.ToPositiveInfinity);
      }
    }
    return entries.Count == 0 ? 0 : entries[^1].SourceEnd;
  }

  private sealed record Entry(
    int SourceStart,
    int SourceEnd,
    int VisualStart,
    int VisualEnd,
    bool Hidden,
    bool Atomic);
}
