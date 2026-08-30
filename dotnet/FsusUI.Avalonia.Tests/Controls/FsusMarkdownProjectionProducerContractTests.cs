using System.Runtime.CompilerServices;
using System.Text.Json;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownProjectionProducerContractTests
{
  [Fact]
  public void MachineContractMatchesPublicVersionRuntimeAndVocabulary()
  {
    var contract = JsonSerializer.Deserialize<ContractDocument>(
      File.ReadAllText(Path.Combine(
        RepositoryRoot(),
        "spec",
        "avalonia",
        "markdown-projection-producer-contract.json")),
      JsonOptions()) ?? throw new InvalidOperationException(
        "Projection producer contract did not deserialize.");

    Assert.Equal(
      "fsusui.avalonia.markdown-projection-producer-contract.v1",
      contract.Schema);
    Assert.Equal(FsusMarkdownProjectionProducerContract.Version, contract.ContractVersion);
    Assert.Equal(
      FsusMarkdownProjectionProducerContract.CanonicalRuntimeIdentity,
      contract.CanonicalRuntime.Identity);
    Assert.Equal(
      FsusMarkdownProjectionProducerContract.SemanticKinds,
      contract.SemanticKinds);
    Assert.Equal(
      [
        "second-csharp-markdown-parser",
        "regex-range-parser",
        "webview-or-html-round-trip",
        "per-block-textbox",
        "visual-tree-as-content-or-history-authority",
      ],
      contract.Forbidden);
  }

  [Fact]
  public void FrozenPositiveAndNegativeVectorsFailClosedWithExactReasons()
  {
    var vectors = JsonSerializer.Deserialize<VectorDocument>(
      File.ReadAllText(Path.Combine(
        RepositoryRoot(),
        "spec",
        "avalonia",
        "markdown-projection-producer-vectors.json")),
      JsonOptions()) ?? throw new InvalidOperationException(
        "Projection producer vectors did not deserialize.");

    Assert.Equal(FsusMarkdownProjectionProducerContract.Version, vectors.ContractVersion);
    Assert.Equal(15, vectors.Vectors.Count);
    Assert.Equal(
      vectors.Vectors.Count,
      vectors.Vectors.Select(vector => vector.Id).Distinct().Count());
    foreach (var vector in vectors.Vectors)
    {
      var (request, production) = BuildVector(vector.Mutation);
      var result = FsusMarkdownProjectionProducerContract.Validate(
        request,
        production);

      Assert.Equal(vector.Accepted, result.Accepted);
      Assert.Equal(vector.Reason, result.Reason);
    }
  }

  [Fact]
  public async Task ProducerHelperCommitsOnlyTheExactCurrentRequest()
  {
    var identity = new FsusMarkdownDocumentIdentity("producer", 3);
    var editor = new FsusMarkdownEditor
    {
      Document = "**bold**",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var request = Request(identity, 0, "**bold**", 0);
    var producer = new RecordingProducer(BaselineProduction(identity));

    var result = await FsusMarkdownProjectionProducerContract
      .ProduceAndCommitAsync(editor, producer, request);

    Assert.True(result.Accepted);
    Assert.Equal(1, producer.CallCount);
    Assert.Same(request, producer.Request);
    Assert.Equal("aligned", editor.CapabilityState);
    Assert.NotNull(editor.ProjectionMap);
  }

  [Fact]
  public async Task ProducerHelperRejectsNonCanonicalRuntimeWithoutCommit()
  {
    var identity = new FsusMarkdownDocumentIdentity("producer", 4);
    var editor = new FsusMarkdownEditor
    {
      Document = "**bold**",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var request = Request(identity, 0, "**bold**", 0);
    var invalid = BaselineProduction(identity) with
    {
      Descriptor = Descriptor() with
      {
        SourceRuntimeIdentity = "consumer-csharp-parser",
      },
    };

    var result = await FsusMarkdownProjectionProducerContract
      .ProduceAndCommitAsync(editor, new RecordingProducer(invalid), request);

    Assert.False(result.Accepted);
    Assert.Equal("source-runtime-identity", result.Reason);
    Assert.Null(editor.ProjectionMap);
    Assert.Equal("source-fallback", editor.CapabilityState);
  }

  [Fact]
  public async Task CancellationAfterProductionCannotCommitAResult()
  {
    var identity = new FsusMarkdownDocumentIdentity("producer", 5);
    var editor = new FsusMarkdownEditor
    {
      Document = "**bold**",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    using var cancellation = new CancellationTokenSource();
    var producer = new RecordingProducer(
      BaselineProduction(identity),
      () => cancellation.Cancel());

    await Assert.ThrowsAsync<OperationCanceledException>(async () =>
      await FsusMarkdownProjectionProducerContract.ProduceAndCommitAsync(
        editor,
        producer,
        Request(identity, 0, "**bold**", 0),
        cancellation.Token));
    Assert.Null(editor.ProjectionMap);
  }

  private static (
    FsusMarkdownProjectionRequestedEventArgs Request,
    FsusMarkdownProjectionProduction Production) BuildVector(string mutation)
  {
    var identity = new FsusMarkdownDocumentIdentity("vector", 1);
    var request = Request(identity, 1, "**bold**", 2);
    var production = BaselineProduction(identity, 1, 2);
    switch (mutation)
    {
      case "none":
        break;
      case "interim-kind":
        production = production with
        {
          Descriptor = Descriptor(FsusMarkdownProjectionProducerKind.InterimHostBridge),
          Snapshot = production.Snapshot with
          {
            Spans =
            [
              new(
                "strong",
                new(2, 6),
                FsusMarkdownProjectionSpanKind.Text,
                "bold",
                "strong"),
            ],
          },
        };
        break;
      case "contract-version":
        production = production with
        {
          Descriptor = production.Descriptor with { ContractVersion = "2" },
        };
        break;
      case "source-runtime":
        production = production with
        {
          Descriptor = production.Descriptor with
          {
            SourceRuntimeIdentity = "consumer-csharp-parser",
          },
        };
        break;
      case "overlapping-spans":
        production = production with
        {
          Snapshot = production.Snapshot with
          {
            Spans =
            [
              new("first", new(0, 5), FsusMarkdownProjectionSpanKind.Text, "first"),
              new("second", new(4, 8), FsusMarkdownProjectionSpanKind.Text, "second"),
            ],
          },
        };
        break;
      case "span-kind":
        production = production with
        {
          Snapshot = production.Snapshot with
          {
            Spans =
            [
              new(
                "unknown",
                new(0, 8),
                (FsusMarkdownProjectionSpanKind)99,
                "bold"),
            ],
          },
        };
        break;
      case "semantic-kind":
        production = production with
        {
          Snapshot = production.Snapshot with
          {
            Spans =
            [
              new(
                "strong",
                new(0, 8),
                FsusMarkdownProjectionSpanKind.Text,
                "bold",
                "consumer-private-kind"),
            ],
          },
        };
        break;
      case "revision":
        production = production with
        {
          Snapshot = production.Snapshot with { Revision = 0 },
        };
        break;
      case "document-identity":
        production = production with
        {
          Snapshot = production.Snapshot with
          {
            DocumentIdentity = new("other-vector", 1),
          },
        };
        break;
      case "source":
        production = production with
        {
          Snapshot = production.Snapshot with { Source = "**other**" },
        };
        break;
      case "feature-revision":
        production = production with
        {
          Snapshot = production.Snapshot with { FeatureRevision = 1 },
        };
        break;
      case "retired-node-reuse":
        production = production with { RetiredNodeIds = ["strong"] };
        break;
      case "missing-retired-node":
        production = production with
        {
          PreviousSnapshot = Previous(identity, "retired"),
        };
        break;
      case "cross-document-node-reuse":
        production = production with
        {
          PreviousSnapshot = Previous(
            new FsusMarkdownDocumentIdentity("other", 1),
            "strong"),
        };
        break;
      case "source-fallback-text":
        production = production with
        {
          Snapshot = production.Snapshot with
          {
            Spans =
            [
              new(
                "fallback",
                new(0, 8),
                FsusMarkdownProjectionSpanKind.SourceFallback,
                "not source",
                FallbackReason: "localized-source"),
            ],
          },
        };
        break;
      default:
        throw new InvalidOperationException($"Unknown vector mutation: {mutation}");
    }
    return (request, production);
  }

  private static FsusMarkdownProjectionProduction BaselineProduction(
    FsusMarkdownDocumentIdentity identity,
    int revision = 0,
    long featureRevision = 0) =>
    new(
      Descriptor(),
      new(
        identity,
        revision,
        "**bold**",
        [
          new(
            "strong",
            new(0, 2),
            FsusMarkdownProjectionSpanKind.HiddenMarker,
            ""),
          new(
            "strong",
            new(2, 6),
            FsusMarkdownProjectionSpanKind.Text,
            "bold",
            "strong"),
          new(
            "strong",
            new(6, 8),
            FsusMarkdownProjectionSpanKind.HiddenMarker,
            ""),
        ],
        featureRevision),
      []);

  private static FsusMarkdownProjectionProducerDescriptor Descriptor(
    FsusMarkdownProjectionProducerKind kind =
      FsusMarkdownProjectionProducerKind.CanonicalNativeBinding) =>
    new(
      FsusMarkdownProjectionProducerContract.Version,
      kind,
      "fsusui-test-producer",
      "1.0.0",
      FsusMarkdownProjectionProducerContract.CanonicalRuntimeIdentity,
      "test-runtime-1");

  private static FsusMarkdownProjectionRequestedEventArgs Request(
    FsusMarkdownDocumentIdentity identity,
    int revision,
    string source,
    long featureRevision) =>
    new(
      identity,
      revision,
      source,
      featureRevision,
      FsusMarkdownSourceCoordinateMap.Create(source));

  private static FsusMarkdownProjectionSnapshot Previous(
    FsusMarkdownDocumentIdentity identity,
    string nodeId) =>
    new(
      identity,
      0,
      "**old**",
      [
        new(
          nodeId,
          new(0, 7),
          FsusMarkdownProjectionSpanKind.Text,
          "**old**",
          "paragraph"),
      ],
      1);

  private static JsonSerializerOptions JsonOptions() =>
    new() { PropertyNameCaseInsensitive = true };

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var directory = new DirectoryInfo(
      Path.GetDirectoryName(sourceFile) ?? string.Empty);
    while (directory is not null)
    {
      if (File.Exists(Path.Combine(
        directory.FullName,
        "dotnet",
        "FsusUI.Avalonia.slnx")))
      {
        return directory.FullName;
      }
      directory = directory.Parent;
    }
    throw new DirectoryNotFoundException("FsusUI repository root was not found.");
  }

  private sealed class RecordingProducer(
    FsusMarkdownProjectionProduction production,
    Action? afterProduction = null) : IFsusMarkdownProjectionProducer
  {
    public int CallCount { get; private set; }

    public FsusMarkdownProjectionRequestedEventArgs? Request { get; private set; }

    public ValueTask<FsusMarkdownProjectionProduction> ProduceAsync(
      FsusMarkdownProjectionRequestedEventArgs request,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      CallCount += 1;
      Request = request;
      afterProduction?.Invoke();
      return ValueTask.FromResult(production);
    }
  }

  private sealed class ContractDocument
  {
    public string Schema { get; set; } = string.Empty;

    public string ContractVersion { get; set; } = string.Empty;

    public CanonicalRuntimeDocument CanonicalRuntime { get; set; } = new();

    public List<string> SemanticKinds { get; set; } = [];

    public List<string> Forbidden { get; set; } = [];
  }

  private sealed class CanonicalRuntimeDocument
  {
    public string Identity { get; set; } = string.Empty;
  }

  private sealed class VectorDocument
  {
    public string ContractVersion { get; set; } = string.Empty;

    public List<VectorCase> Vectors { get; set; } = [];
  }

  private sealed class VectorCase
  {
    public string Id { get; set; } = string.Empty;

    public string Mutation { get; set; } = string.Empty;

    public bool Accepted { get; set; }

    public string? Reason { get; set; }
  }
}
