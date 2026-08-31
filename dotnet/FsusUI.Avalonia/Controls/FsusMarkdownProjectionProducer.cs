namespace FsusUI.Avalonia.Controls;

/// <summary>
/// Identifies the implementation behind a native Markdown projection producer.
/// Both paths consume the canonical FsusUI Markdown runtime; neither permits a
/// second Markdown parser in the .NET host.
/// </summary>
public enum FsusMarkdownProjectionProducerKind
{
  CanonicalNativeBinding,
  InterimHostBridge,
}

/// <summary>
/// Versioned identity for a native projection producer and its source runtime.
/// </summary>
public sealed record FsusMarkdownProjectionProducerDescriptor(
  string ContractVersion,
  FsusMarkdownProjectionProducerKind Kind,
  string ProducerId,
  string ProducerVersion,
  string SourceRuntimeIdentity,
  string SourceRuntimeVersion);

/// <summary>
/// One host-produced projection candidate, including identity tombstones from
/// the current document epoch.
/// </summary>
public sealed record FsusMarkdownProjectionProduction(
  FsusMarkdownProjectionProducerDescriptor Descriptor,
  FsusMarkdownProjectionSnapshot Snapshot,
  IReadOnlyList<string> RetiredNodeIds,
  FsusMarkdownProjectionSnapshot? PreviousSnapshot = null);

/// <summary>
/// Produces parser-neutral projection snapshots for one exact editor request.
/// Implementations bridge the canonical Markdown runtime and must not parse
/// Markdown independently.
/// </summary>
public interface IFsusMarkdownProjectionProducer
{
  ValueTask<FsusMarkdownProjectionProduction> ProduceAsync(
    FsusMarkdownProjectionRequestedEventArgs request,
    CancellationToken cancellationToken = default);
}

public sealed record FsusMarkdownProjectionProducerValidationResult(
  bool Accepted,
  string? Reason = null);

/// <summary>
/// Sanctioned native-host boundary for consuming canonical Markdown projection
/// output. The machine authority is
/// spec/avalonia/markdown-projection-producer-contract.json.
/// </summary>
public static class FsusMarkdownProjectionProducerContract
{
  public const string Version = "1";

  public const string CanonicalRuntimeIdentity =
    "@ozwasyd/element-plus/markdown-runtime";

  private static readonly string[] semanticKinds =
  [
    "anchor",
    "caption",
    "code",
    "embed",
    "explicit-paragraph",
    "footnote",
    "heading",
    "image",
    "latex",
    "link",
    "list",
    "malformed",
    "mermaid",
    "paragraph",
    "quote",
    "strong",
    "table",
    "task",
  ];

  public static IReadOnlyList<string> SemanticKinds { get; } =
    Array.AsReadOnly(semanticKinds);

  public static FsusMarkdownProjectionProducerValidationResult Validate(
    FsusMarkdownProjectionRequestedEventArgs request,
    FsusMarkdownProjectionProduction production)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(production);
    if (production.Descriptor is null || production.Snapshot is null ||
      production.RetiredNodeIds is null)
    {
      return Reject("invalid-production");
    }

    var descriptor = production.Descriptor;
    if (!string.Equals(descriptor.ContractVersion, Version, StringComparison.Ordinal))
    {
      return Reject("producer-contract-version");
    }
    if (!Enum.IsDefined(descriptor.Kind))
    {
      return Reject("producer-kind");
    }
    if (string.IsNullOrWhiteSpace(descriptor.ProducerId))
    {
      return Reject("producer-id");
    }
    if (string.IsNullOrWhiteSpace(descriptor.ProducerVersion))
    {
      return Reject("producer-version");
    }
    if (!string.Equals(
      descriptor.SourceRuntimeIdentity,
      CanonicalRuntimeIdentity,
      StringComparison.Ordinal))
    {
      return Reject("source-runtime-identity");
    }
    if (string.IsNullOrWhiteSpace(descriptor.SourceRuntimeVersion))
    {
      return Reject("source-runtime-version");
    }

    var snapshot = production.Snapshot;
    if (snapshot.DocumentIdentity != request.DocumentIdentity)
    {
      return Reject("document-mismatch");
    }
    if (snapshot.Revision != request.Revision)
    {
      return Reject("stale-revision");
    }
    if (!string.Equals(snapshot.Source, request.Source, StringComparison.Ordinal))
    {
      return Reject("source-mismatch");
    }
    if (snapshot.FeatureRevision != request.FeatureRevision)
    {
      return Reject("stale-feature-revision");
    }

    var spanReason = ValidateSpans(snapshot);
    if (spanReason is not null)
    {
      return Reject(spanReason);
    }

    var retired = new HashSet<string>(StringComparer.Ordinal);
    foreach (var nodeId in production.RetiredNodeIds)
    {
      if (string.IsNullOrWhiteSpace(nodeId) || !retired.Add(nodeId))
      {
        return Reject("invalid-retired-node-id");
      }
    }
    var currentIds = snapshot.Spans
      .Select(span => span.NodeId)
      .ToHashSet(StringComparer.Ordinal);
    if (currentIds.Overlaps(retired))
    {
      return Reject("retired-node-id-reuse");
    }

    if (production.PreviousSnapshot is { } previous)
    {
      var previousReason = ValidatePreviousSnapshot(
        previous,
        snapshot,
        currentIds,
        retired);
      if (previousReason is not null)
      {
        return Reject(previousReason);
      }
    }

    return new(true);
  }

  public static async ValueTask<FsusMarkdownProjectionCommitResult>
    ProduceAndCommitAsync(
      FsusMarkdownEditor editor,
      IFsusMarkdownProjectionProducer producer,
      FsusMarkdownProjectionRequestedEventArgs request,
      CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(editor);
    ArgumentNullException.ThrowIfNull(producer);
    ArgumentNullException.ThrowIfNull(request);
    var production = await producer.ProduceAsync(request, cancellationToken);
    cancellationToken.ThrowIfCancellationRequested();
    var validation = Validate(request, production);
    if (!validation.Accepted)
    {
      return new(
        false,
        request.Revision,
        [],
        [],
        [],
        validation.Reason);
    }
    return editor.CommitProjection(production.Snapshot);
  }

  private static string? ValidateSpans(FsusMarkdownProjectionSnapshot snapshot)
  {
    if (snapshot.Spans is null)
    {
      return "invalid-projection";
    }
    var cursor = 0;
    foreach (var span in snapshot.Spans)
    {
      if (span is null || span.SourceRange is null ||
        string.IsNullOrWhiteSpace(span.NodeId) ||
        !Enum.IsDefined(span.Kind) ||
        span.SourceRange.Start < cursor ||
        span.SourceRange.End <= span.SourceRange.Start ||
        span.SourceRange.End > snapshot.Source.Length ||
        span.DisplayText is null)
      {
        return "invalid-projection";
      }
      if (span.SemanticKind is not null &&
        Array.BinarySearch(
          semanticKinds,
          span.SemanticKind,
          StringComparer.Ordinal) < 0)
      {
        return "unsupported-semantic-kind";
      }
      if (span.Kind == FsusMarkdownProjectionSpanKind.HiddenMarker &&
        span.DisplayText.Length != 0)
      {
        return "invalid-hidden-marker";
      }
      if (span.Kind == FsusMarkdownProjectionSpanKind.Atomic &&
        span.DisplayText.Length == 0)
      {
        return "invalid-atomic-presentation";
      }
      if (span.Kind == FsusMarkdownProjectionSpanKind.SourceFallback &&
        (string.IsNullOrWhiteSpace(span.FallbackReason) ||
          !string.Equals(
            span.DisplayText,
            snapshot.Source[span.SourceRange.Start..span.SourceRange.End],
            StringComparison.Ordinal)))
      {
        return "invalid-source-fallback";
      }
      cursor = span.SourceRange.End;
    }
    return null;
  }

  private static string? ValidatePreviousSnapshot(
    FsusMarkdownProjectionSnapshot previous,
    FsusMarkdownProjectionSnapshot current,
    HashSet<string> currentIds,
    HashSet<string> retired)
  {
    if (ValidateSpans(previous) is not null)
    {
      return "invalid-previous-projection";
    }
    var previousIds = previous.Spans
      .Select(span => span.NodeId)
      .ToHashSet(StringComparer.Ordinal);
    if (previous.DocumentIdentity != current.DocumentIdentity)
    {
      return previousIds.Overlaps(currentIds)
        ? "cross-document-node-id-reuse"
        : null;
    }
    if (previous.Revision > current.Revision ||
      (previous.Revision == current.Revision &&
        previous.FeatureRevision >= current.FeatureRevision))
    {
      return "invalid-previous-revision";
    }
    var removed = previousIds.Where(nodeId => !currentIds.Contains(nodeId));
    return removed.All(retired.Contains)
      ? null
      : "missing-retired-node-id";
  }

  private static FsusMarkdownProjectionProducerValidationResult Reject(
    string reason) =>
    new(false, reason);
}
