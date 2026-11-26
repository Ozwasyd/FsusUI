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
