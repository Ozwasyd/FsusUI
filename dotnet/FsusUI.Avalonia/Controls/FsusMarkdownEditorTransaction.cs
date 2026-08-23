namespace FsusUI.Avalonia.Controls;

public sealed record FsusMarkdownEditorSelection(int Start, int End, string Direction = "none");

public sealed record FsusMarkdownEditorChange(int From, int To, string Insert);

public sealed record FsusMarkdownEditorTransaction(
  IReadOnlyList<FsusMarkdownEditorChange> Changes,
  string History = "separate",
  string Origin = "programmatic",
  int? ExpectedRevision = null,
  FsusMarkdownEditorSelection? Selection = null);

public sealed record FsusMarkdownEditorDispatchResult(
  bool Accepted,
  string Value,
  int Revision,
  FsusMarkdownEditorSelection Selection,
  string? Reason = null,
  bool CanUndo = false,
  bool CanRedo = false);

public sealed record FsusMarkdownEditorShellMutation(string Kind, bool Equivalent, bool Accepted);

public sealed class FsusMarkdownEditorHistory
{
  private readonly FsusMarkdownEditorTransactionStore store;

  public FsusMarkdownEditorHistory()
    : this(new FsusMarkdownEditorTransactionStore(new FsusMarkdownDocumentIdentity("anon", 0)))
  {
  }

  internal FsusMarkdownEditorHistory(FsusMarkdownEditorTransactionStore store)
  {
    this.store = store;
  }

  public int UndoDepth => store.UndoDepth;

  public int RedoDepth => store.RedoDepth;

  public string Apply(string current, IReadOnlyList<FsusMarkdownEditorChange> changes)
  {
    if (store.Value != current)
    {
      store.Reset(current);
    }
    var result = store.Dispatch(
      new FsusMarkdownEditorTransaction(changes, History: "separate", Origin: "programmatic"));
    return result.Value;
  }

  public bool TryUndo(string current, out string previous)
  {
    if (store.Value != current)
    {
      previous = current;
      return false;
    }
    var result = store.Undo();
    previous = result.Value;
    return result.Accepted && result.Value != current;
  }
}

public sealed class FsusMarkdownEditorTransactionStore
{
  private readonly Stack<(string Value, FsusMarkdownEditorSelection Selection)> undo = new();
  private readonly Stack<(string Value, FsusMarkdownEditorSelection Selection)> redo = new();

  public FsusMarkdownEditorTransactionStore(
    FsusMarkdownDocumentIdentity identity,
    string value = "",
    FsusMarkdownEditorSelection? selection = null)
  {
    Identity = identity;
    Value = value;
    Selection = Normalize(value, selection ?? new FsusMarkdownEditorSelection(value.Length, value.Length))
      ?? new FsusMarkdownEditorSelection(value.Length, value.Length);
  }

  public FsusMarkdownDocumentIdentity Identity { get; }

  public string Value { get; private set; }

  public int Revision { get; private set; }

  public FsusMarkdownEditorSelection Selection { get; private set; }

  public int UndoDepth => undo.Count;

  public int RedoDepth => redo.Count;

  public void Reset(string value)
  {
    Value = value;
    Selection = new FsusMarkdownEditorSelection(value.Length, value.Length);
    Revision = 0;
    undo.Clear();
    redo.Clear();
  }

  public FsusMarkdownEditorDispatchResult Dispatch(FsusMarkdownEditorTransaction transaction)
  {
    if (transaction.ExpectedRevision is int expected && expected != Revision)
    {
      return Reject("stale-revision");
    }
    if (transaction.Origin == "external" && transaction.History != "skip")
    {
      return Reject("invalid-change");
    }

    var applied = ApplyChanges(Value, transaction.Changes);
    if (applied is null)
    {
      return Reject("invalid-change");
    }

    var nextSelection = Normalize(applied, transaction.Selection ?? Selection);
    if (nextSelection is null)
    {
      return Reject("invalid-selection");
    }

    var valueChanged = applied != Value;
    if (valueChanged && transaction.History != "skip")
    {
      undo.Push((Value, Selection));
      redo.Clear();
    }
    if (transaction.Origin == "external" && transaction.History == "skip")
    {
      undo.Clear();
      redo.Clear();
    }

    Value = applied;
    Selection = nextSelection;
    if (valueChanged)
    {
      Revision += 1;
    }
    return Accept();
  }

  public FsusMarkdownEditorDispatchResult Undo()
  {
    if (undo.Count == 0)
    {
      return Reject("no-history");
    }
    redo.Push((Value, Selection));
    var previous = undo.Pop();
    Value = previous.Value;
    Selection = previous.Selection;
    Revision += 1;
    return Accept();
  }

  public FsusMarkdownEditorDispatchResult Redo()
  {
    if (redo.Count == 0)
    {
      return Reject("no-history");
    }
    undo.Push((Value, Selection));
    var next = redo.Pop();
    Value = next.Value;
    Selection = next.Selection;
    Revision += 1;
    return Accept();
  }

  public static IReadOnlyList<FsusMarkdownEditorShellMutation> EvaluateMutations(
    FsusMarkdownEditorTransactionStore first,
    FsusMarkdownEditorTransactionStore second)
  {
    var nativeDual = false;
    var bareOffset = ApplyChanges("ab", [new FsusMarkdownEditorChange(-1, 4, "x")]) is not null;
    var crossed = ReferenceEquals(first.undo, second.undo) || first.Identity.Equals(second.Identity);
    return
    [
      new("native-undo-dual-authority", nativeDual, nativeDual),
      new("bare-offset", bareOffset, bareOffset),
      new("cross-document", crossed, crossed),
    ];
  }

  private FsusMarkdownEditorDispatchResult Accept() =>
    new(true, Value, Revision, Selection, CanUndo: undo.Count > 0, CanRedo: redo.Count > 0);

  private FsusMarkdownEditorDispatchResult Reject(string reason) =>
    new(false, Value, Revision, Selection, reason, undo.Count > 0, redo.Count > 0);

  internal static string? ApplyChanges(string value, IReadOnlyList<FsusMarkdownEditorChange> changes)
  {
    var ordered = changes.OrderBy(change => change.From).ToArray();
    var cursor = 0;
    foreach (var change in ordered)
    {
      if (change.From < cursor || change.To < change.From || change.From > value.Length || change.To > value.Length)
      {
        return null;
      }
      cursor = change.To;
    }
    var next = value;
    var delta = 0;
    foreach (var change in ordered)
    {
      var from = change.From + delta;
      var to = change.To + delta;
      next = string.Concat(next.AsSpan(0, from), change.Insert, next.AsSpan(to));
      delta += change.Insert.Length - (change.To - change.From);
    }
    return next;
  }

  private static FsusMarkdownEditorSelection? Normalize(string value, FsusMarkdownEditorSelection selection)
  {
    if (selection.Start < 0 || selection.End < selection.Start || selection.End > value.Length)
    {
      return null;
    }
    var direction = selection.Direction is "backward" or "forward" or "none"
      ? selection.Direction
      : "none";
    return selection with { Direction = direction };
  }
}
