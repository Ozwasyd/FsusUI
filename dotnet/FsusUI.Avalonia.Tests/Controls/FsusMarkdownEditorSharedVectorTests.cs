using System.Runtime.CompilerServices;
using System.Text.Json;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorSharedVectorTests
{
  [Fact]
  public void AvaloniaProducesTheFrozenWebSharedTraces()
  {
    var vectors = LoadVectors();
    foreach (var scenario in vectors.Scenarios)
    {
      var store = new FsusMarkdownEditorTransactionStore(
        Identity(scenario.Identity),
        scenario.InitialValue,
        Selection(scenario.InitialSelection));
      Assert.Equal(scenario.Operations.Count, scenario.ExpectedTrace.Count);

      for (var index = 0; index < scenario.Operations.Count; index += 1)
      {
        var operation = scenario.Operations[index];
        var expected = scenario.ExpectedTrace[index];
        if (operation.Kind == "switchDocument")
        {
          store.SwitchDocument(
            Identity(operation.Identity ?? scenario.Identity),
            operation.Value ?? string.Empty,
            operation.Selection is null ? null : Selection(operation.Selection));
          Assert.Equal("document-switch", expected.Reason);
          AssertStoreTrace(store, expected, true);
          continue;
        }

        var result = operation.Kind switch
        {
          "undo" => store.Undo(),
          "redo" => store.Redo(),
          _ => store.Dispatch(
            new FsusMarkdownEditorTransaction(
              operation.Changes.Select(Change).ToArray(),
              History: operation.History ?? "separate",
              Origin: operation.Origin ?? "programmatic",
              ExpectedRevision: operation.ExpectedRevision,
              Selection: operation.Selection is null ? null : Selection(operation.Selection),
              DocumentIdentity: operation.Identity is null
                ? store.Identity
                : Identity(operation.Identity),
              ExternalUpdate: operation.ExternalUpdate),
            new FsusMarkdownEditorDispatchContext(
              operation.MergeDirection ?? "none",
              operation.TimestampMilliseconds)),
        };
        AssertResultTrace(result, expected);
      }
    }
  }

  [Fact]
  public void AvaloniaProducesTheFrozenWebSharedPositionMaps()
  {
    foreach (var vector in LoadVectors().PositionMaps)
    {
      var positionMap = FsusMarkdownEditorPositionMap.Create(vector.Changes.Select(Change).ToArray());
      foreach (var point in vector.Points)
      {
        Assert.Equal(point.Expected, positionMap.Map(point.Offset, point.Association));
      }
      foreach (var range in vector.Ranges)
      {
        var mapped = positionMap.MapRange(new(range.Start, range.End));
        Assert.Equal(range.Expected.Deleted, mapped.Deleted);
        Assert.Equal(range.Expected.PartiallyDeleted, mapped.PartiallyDeleted);
        if (range.Expected.Range is null)
        {
          Assert.Null(mapped.Range);
        }
        else
        {
          Assert.Equal(range.Expected.Range.Start, mapped.Range?.Start);
          Assert.Equal(range.Expected.Range.End, mapped.Range?.End);
        }
      }
    }
  }

  [Fact]
  public void PropertyVectorsRoundTripUnicodeChangesAndMaps()
  {
    var random = new Random(339);
    var alphabet = new[] { "a", "中", "한", "😀", "e\u0301", "אב", "\n" };
    var identity = new FsusMarkdownDocumentIdentity("property", 1);

    for (var iteration = 0; iteration < 300; iteration += 1)
    {
      var value = string.Concat(Enumerable.Range(0, random.Next(0, 30))
        .Select(_ => alphabet[random.Next(alphabet.Length)]));
      var boundaries = CodePointBoundaries(value);
      var changes = new List<FsusMarkdownEditorChange>();
      var minimumBoundary = 0;
      for (var index = 0; index < random.Next(0, 6); index += 1)
      {
        var remaining = boundaries.Where(boundary => boundary >= minimumBoundary).ToArray();
        if (remaining.Length == 0)
        {
          break;
        }
        var from = remaining[random.Next(Math.Max(1, remaining.Length - 1))];
        var validEnds = boundaries.Where(boundary => boundary >= from).ToArray();
        var to = validEnds[random.Next(validEnds.Length)];
        var insert = string.Concat(Enumerable.Range(0, random.Next(0, 4))
          .Select(_ => alphabet[random.Next(alphabet.Length)]));
        changes.Add(new(from, to, insert));
        minimumBoundary = to;
      }
      var ordered = changes
        .OrderBy(change => change.From)
        .ThenBy(change => change.To)
        .ToArray();
      var nonOverlapping = ordered
        .Where((change, index) => index == 0 || change.From >= ordered[index - 1].To)
        .ToArray();
      var store = new FsusMarkdownEditorTransactionStore(identity, value, new(0, 0));
      var applied = store.Dispatch(
        new FsusMarkdownEditorTransaction(
          nonOverlapping,
          Selection: new FsusMarkdownEditorSelection(0, 0),
          DocumentIdentity: identity));

      Assert.True(applied.Accepted);
      if (applied.Value != value)
      {
        var undone = store.Undo();
        Assert.True(undone.Accepted);
        Assert.Equal(value, undone.Value);
      }
      var previousLeft = -1;
      foreach (var offset in boundaries)
      {
        var left = applied.PositionMap!.Map(offset, -1);
        var right = applied.PositionMap.Map(offset, 1);
        Assert.True(left >= previousLeft, $"iteration {iteration}, offset {offset}");
        Assert.True(right >= left, $"iteration {iteration}, offset {offset}");
        previousLeft = left;
      }
    }
  }

  [Fact]
  public void PropertyVectorsIsolateSameSourceDocumentSwitches()
  {
    var random = new Random(340);
    for (var iteration = 0; iteration < 200; iteration += 1)
    {
      var source = new string('x', random.Next(0, 64));
      var first = new FsusMarkdownDocumentIdentity($"doc-{iteration}", 1);
      var second = new FsusMarkdownDocumentIdentity($"doc-{iteration}", 2);
      var store = new FsusMarkdownEditorTransactionStore(first, source);
      _ = store.Dispatch(
        new FsusMarkdownEditorTransaction(
          [new(source.Length, source.Length, "!")],
          DocumentIdentity: first));
      store.SwitchDocument(second, source, new(0, source.Length, "forward"));

      Assert.False(store.History.CanUndo);
      Assert.False(store.History.CanRedo);
      Assert.Equal(new FsusMarkdownEditorSelection(0, source.Length, "forward"), store.Selection);
      var stale = store.Dispatch(
        new FsusMarkdownEditorTransaction(
          [new(source.Length, source.Length, "?")],
          ExpectedRevision: 0,
          DocumentIdentity: first));
      Assert.False(stale.Accepted);
      Assert.Equal("document-mismatch", stale.Reason);
      Assert.Equal(source, stale.Value);
    }
  }

  [Fact]
  public void GraphemeSelectionMatchesTheWebContract()
  {
    var value = $"A{"e\u0301"}👩‍👩‍👧‍👦אב";
    var identity = new FsusMarkdownDocumentIdentity("unicode", 1);
    var store = new FsusMarkdownEditorTransactionStore(identity, value);

    var combining = store.Dispatch(
      new FsusMarkdownEditorTransaction(
        [],
        History: "skip",
        Selection: new FsusMarkdownEditorSelection(2, 2, "backward"),
        DocumentIdentity: identity));
    Assert.Equal(new FsusMarkdownEditorSelection(1, 1, "backward"), combining.Selection);

    var familyStart = "Ae\u0301".Length;
    var family = store.Dispatch(
      new FsusMarkdownEditorTransaction(
        [],
        History: "skip",
        Selection: new(familyStart + 3, familyStart + 6, "backward"),
        DocumentIdentity: identity));
    Assert.Equal(
      new FsusMarkdownEditorSelection(
        familyStart,
        familyStart + "👩‍👩‍👧‍👦".Length,
        "backward"),
      family.Selection);
  }

  private static void AssertResultTrace(
    FsusMarkdownEditorDispatchResult actual,
    ExpectedTrace expected)
  {
    Assert.Equal(expected.Accepted, actual.Accepted);
    Assert.Equal(expected.Value, actual.Value);
    Assert.Equal(expected.BeforeRevision, actual.BeforeRevision);
    Assert.Equal(expected.Revision, actual.Revision);
    Assert.Equal(Selection(expected.Selection), actual.Selection);
    Assert.Equal(expected.UndoDepth, actual.History.UndoDepth);
    Assert.Equal(expected.RedoDepth, actual.History.RedoDepth);
    Assert.Equal(expected.Reason, actual.Reason);
    if (expected.Identity is not null)
    {
      Assert.Equal(Identity(expected.Identity), actual.DocumentIdentity);
    }
  }

  private static void AssertStoreTrace(
    FsusMarkdownEditorTransactionStore store,
    ExpectedTrace expected,
    bool documentSwitch)
  {
    Assert.True(expected.Accepted);
    Assert.True(documentSwitch);
    Assert.Equal(expected.Value, store.Value);
    Assert.Equal(expected.Revision, store.Revision);
    Assert.Equal(Selection(expected.Selection), store.Selection);
    Assert.Equal(expected.UndoDepth, store.History.UndoDepth);
    Assert.Equal(expected.RedoDepth, store.History.RedoDepth);
    if (expected.Identity is not null)
    {
      Assert.Equal(Identity(expected.Identity), store.Identity);
    }
  }

  private static FsusMarkdownEditorChange Change(ChangeVector change) =>
    new(change.From, change.To, change.Insert);

  private static FsusMarkdownDocumentIdentity Identity(IdentityVector identity) =>
    new(identity.Id, identity.Epoch);

  private static FsusMarkdownEditorSelection Selection(SelectionVector selection) =>
    new(selection.Start, selection.End, selection.Direction);

  private static int[] CodePointBoundaries(string value)
  {
    var boundaries = new List<int> { 0 };
    for (var offset = 0; offset < value.Length;)
    {
      offset += char.IsHighSurrogate(value[offset]) && offset + 1 < value.Length
        ? 2
        : 1;
      boundaries.Add(offset);
    }
    return boundaries.ToArray();
  }

  private static TransactionVectors LoadVectors()
  {
    var path = Path.Combine(
      RepositoryRoot(),
      "spec",
      "avalonia",
      "markdown-editor-transaction-vectors.json");
    return JsonSerializer.Deserialize<TransactionVectors>(
      File.ReadAllText(path),
      new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
      ?? throw new InvalidOperationException("Shared transaction vectors did not deserialize.");
  }

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var directory = new DirectoryInfo(Path.GetDirectoryName(sourceFile) ?? string.Empty);
    while (directory is not null)
    {
      if (File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
      {
        return directory.FullName;
      }
      directory = directory.Parent;
    }
    throw new DirectoryNotFoundException("FsusUI repository root was not found.");
  }

  private sealed class TransactionVectors
  {
    public List<ScenarioVector> Scenarios { get; set; } = [];

    public List<PositionMapVector> PositionMaps { get; set; } = [];
  }

  private sealed class ScenarioVector
  {
    public string Id { get; set; } = string.Empty;

    public IdentityVector Identity { get; set; } = new();

    public string InitialValue { get; set; } = string.Empty;

    public SelectionVector InitialSelection { get; set; } = new();

    public List<OperationVector> Operations { get; set; } = [];

    public List<ExpectedTrace> ExpectedTrace { get; set; } = [];
  }

  private sealed class OperationVector
  {
    public string Kind { get; set; } = string.Empty;

    public List<ChangeVector> Changes { get; set; } = [];

    public string? History { get; set; }

    public string? Origin { get; set; }

    public int? ExpectedRevision { get; set; }

    public string? ExternalUpdate { get; set; }

    public IdentityVector? Identity { get; set; }

    public SelectionVector? Selection { get; set; }

    public string? MergeDirection { get; set; }

    public long? TimestampMilliseconds { get; set; }

    public string? Value { get; set; }
  }

  private sealed class ExpectedTrace
  {
    public bool Accepted { get; set; }

    public string Value { get; set; } = string.Empty;

    public int BeforeRevision { get; set; }

    public int Revision { get; set; }

    public SelectionVector Selection { get; set; } = new();

    public int UndoDepth { get; set; }

    public int RedoDepth { get; set; }

    public string? Reason { get; set; }

    public IdentityVector? Identity { get; set; }
  }

  private sealed class PositionMapVector
  {
    public string Id { get; set; } = string.Empty;

    public List<ChangeVector> Changes { get; set; } = [];

    public List<PointVector> Points { get; set; } = [];

    public List<RangeVector> Ranges { get; set; } = [];
  }

  private sealed class PointVector
  {
    public int Offset { get; set; }

    public int Association { get; set; }

    public int Expected { get; set; }
  }

  private sealed class RangeVector
  {
    public int Start { get; set; }

    public int End { get; set; }

    public MappedRangeVector Expected { get; set; } = new();
  }

  private sealed class MappedRangeVector
  {
    public SourceRangeVector? Range { get; set; }

    public bool Deleted { get; set; }

    public bool PartiallyDeleted { get; set; }
  }

  private sealed class SourceRangeVector
  {
    public int Start { get; set; }

    public int End { get; set; }
  }

  private sealed class IdentityVector
  {
    public string Id { get; set; } = string.Empty;

    public int Epoch { get; set; }
  }

  private sealed class SelectionVector
  {
    public int Start { get; set; }

    public int End { get; set; }

    public string Direction { get; set; } = "none";
  }

  private sealed class ChangeVector
  {
    public int From { get; set; }

    public int To { get; set; }

    public string Insert { get; set; } = string.Empty;
  }
}
