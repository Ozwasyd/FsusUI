using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusMarkdownEditorSelection(int Start, int End, string Direction = "none");

public sealed record FsusMarkdownEditorChange(int From, int To, string Insert);

public sealed record FsusMarkdownEditorTransaction(
  IReadOnlyList<FsusMarkdownEditorChange> Changes,
  string History = "separate",
  string Origin = "programmatic",
  int? ExpectedRevision = null,
  FsusMarkdownEditorSelection? Selection = null,
  FsusMarkdownDocumentIdentity? DocumentIdentity = null,
  string? ExternalUpdate = null,
  IReadOnlyDictionary<string, object?>? Metadata = null);

public sealed record FsusMarkdownEditorDispatchContext(
  string MergeDirection = "none",
  long? TimestampMilliseconds = null);

public sealed record FsusMarkdownEditorHistoryState(
  bool CanUndo,
  bool CanRedo,
  int UndoDepth,
  int RedoDepth,
  int RetainedUnits);

public sealed record FsusMarkdownEditorDispatchResult(
  bool Accepted,
  string Value,
  int BeforeRevision,
  int Revision,
  FsusMarkdownDocumentIdentity DocumentIdentity,
  FsusMarkdownEditorSelection Selection,
  FsusMarkdownEditorHistoryState History,
  FsusMarkdownEditorPositionMap? PositionMap = null,
  string? Reason = null)
{
  public bool CanUndo => History.CanUndo;

  public bool CanRedo => History.CanRedo;
}

public sealed class FsusMarkdownEditorTransactionEventArgs(
  FsusMarkdownEditorTransaction transaction,
  FsusMarkdownEditorDispatchResult result) : EventArgs
{
  public FsusMarkdownEditorTransaction Transaction { get; } = transaction;

  public FsusMarkdownEditorDispatchResult Result { get; } = result;
}

public sealed class FsusMarkdownEditorSelectionChangedEventArgs(
  int revision,
  FsusMarkdownEditorSelection selection) : EventArgs
{
  public int Revision { get; } = revision;

  public FsusMarkdownEditorSelection Selection { get; } = selection;
}

public sealed class FsusMarkdownEditorHistoryChangedEventArgs(
  FsusMarkdownEditorHistoryState history) : EventArgs
{
  public FsusMarkdownEditorHistoryState History { get; } = history;
}

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

  public int UndoDepth => store.History.UndoDepth;

  public int RedoDepth => store.History.RedoDepth;

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
  private const int HistoryEntryLimit = 100;
  private const int HistoryRetainedUnitLimit = 1_000_000;
  private const long InputMergeWindowMilliseconds = 1_000;

  private readonly List<HistoryEntry> undo = [];
  private readonly List<HistoryEntry> redo = [];
  private bool mergeBlocked;

  public FsusMarkdownEditorTransactionStore(
    FsusMarkdownDocumentIdentity identity,
    string value = "",
    FsusMarkdownEditorSelection? selection = null)
  {
    ArgumentNullException.ThrowIfNull(identity);
    ArgumentNullException.ThrowIfNull(value);
    Identity = identity;
    Value = value;
    Selection = Normalize(value, selection ?? new FsusMarkdownEditorSelection(value.Length, value.Length))
      ?? new FsusMarkdownEditorSelection(value.Length, value.Length);
  }

  public FsusMarkdownDocumentIdentity Identity { get; private set; }

  public string Value { get; private set; }

  public int Revision { get; private set; }

  public FsusMarkdownEditorSelection Selection { get; private set; }

  public FsusMarkdownEditorHistoryState History
  {
    get
    {
      var retainedUnits = undo.Sum(entry => entry.RetainedUnits) + redo.Sum(entry => entry.RetainedUnits);
      return new(undo.Count > 0, redo.Count > 0, undo.Count, redo.Count, retainedUnits);
    }
  }

  public int UndoDepth => History.UndoDepth;

  public int RedoDepth => History.RedoDepth;

  public void BreakMergeGroup()
  {
    mergeBlocked = true;
  }

  public bool SetSelection(FsusMarkdownEditorSelection selection, bool breakMerge = true)
  {
    var normalized = Normalize(Value, selection);
    if (normalized is null)
    {
      return false;
    }
    var changed = normalized != Selection;
    Selection = normalized;
    if (changed && breakMerge)
    {
      BreakMergeGroup();
    }
    return changed;
  }

  public void SwitchDocument(
    FsusMarkdownDocumentIdentity identity,
    string value,
    FsusMarkdownEditorSelection? selection = null)
  {
    ArgumentNullException.ThrowIfNull(identity);
    ArgumentNullException.ThrowIfNull(value);
    Identity = identity;
    Value = value;
    Selection = Normalize(value, selection ?? new FsusMarkdownEditorSelection(value.Length, value.Length))
      ?? new FsusMarkdownEditorSelection(value.Length, value.Length);
    Revision = 0;
    undo.Clear();
    redo.Clear();
    BreakMergeGroup();
  }

  public void Reset(string value)
  {
    _ = ApplyExternalValue(value, "reset");
  }

  public FsusMarkdownEditorDispatchResult ApplyExternalValue(
    string value,
    string policy = "reset",
    int? expectedRevision = null)
  {
    ArgumentNullException.ThrowIfNull(value);
    var changes = value == Value
      ? Array.Empty<FsusMarkdownEditorChange>()
      : [new FsusMarkdownEditorChange(0, Value.Length, value)];
    return Dispatch(
      new FsusMarkdownEditorTransaction(
        changes,
        History: "skip",
        Origin: "external",
        ExpectedRevision: expectedRevision,
        DocumentIdentity: Identity,
        ExternalUpdate: policy));
  }

  public FsusMarkdownEditorDispatchResult Dispatch(
    FsusMarkdownEditorTransaction transaction,
    FsusMarkdownEditorDispatchContext? context = null)
  {
    ArgumentNullException.ThrowIfNull(transaction);
    var beforeRevision = Revision;
    if (transaction.DocumentIdentity is not null && transaction.DocumentIdentity != Identity)
    {
      return Reject("document-mismatch", beforeRevision);
    }
    if (transaction.ExpectedRevision is int expected && expected != Revision)
    {
      return Reject("stale-revision", beforeRevision);
    }
    if (!IsOneOf(transaction.History, "merge", "separate", "skip") ||
      !IsOneOf(transaction.Origin, "input", "command", "paste", "drop", "programmatic", "external"))
    {
      return Reject("invalid-change", beforeRevision);
    }
    if (transaction.Origin == "external" && transaction.History != "skip")
    {
      return Reject("invalid-external-update", beforeRevision);
    }
    if (transaction.ExternalUpdate is not null &&
      (transaction.Origin != "external" || !IsOneOf(transaction.ExternalUpdate, "reset", "rebase")))
    {
      return Reject("invalid-external-update", beforeRevision);
    }

    var applied = ApplyChanges(Value, transaction.Changes);
    if (applied is null)
    {
      return Reject("invalid-change", beforeRevision);
    }
    var positionMap = FsusMarkdownEditorPositionMap.Create(transaction.Changes);
    var externalUpdate = transaction.Origin == "external"
      ? transaction.ExternalUpdate ?? "reset"
      : null;
    var nextSelection = ResolveSelection(transaction.Selection, applied.Value, positionMap, externalUpdate);
    if (nextSelection is null)
    {
      return Reject("invalid-selection", beforeRevision);
    }

    var beforeValue = Value;
    var beforeSelection = Selection;
    var valueChanged = applied.Value != Value;
    var selectionChanged = nextSelection != Selection;
    if (!valueChanged && !selectionChanged && transaction.Origin != "external")
    {
      return Accept(beforeRevision, positionMap);
    }

    Value = applied.Value;
    Selection = nextSelection;
    if (valueChanged)
    {
      Revision += 1;
    }

    if (transaction.Origin == "external")
    {
      undo.Clear();
      redo.Clear();
      BreakMergeGroup();
    }
    else if (valueChanged && transaction.History != "skip")
    {
      RecordHistory(
        transaction,
        applied.Inverse,
        beforeSelection,
        nextSelection,
        context ?? new FsusMarkdownEditorDispatchContext(),
        beforeValue);
    }
    else if (valueChanged)
    {
      redo.Clear();
      BreakMergeGroup();
    }

    return Accept(beforeRevision, positionMap);
  }

  public FsusMarkdownEditorDispatchResult Undo()
  {
    var beforeRevision = Revision;
    if (undo.Count == 0)
    {
      return Reject("no-history", beforeRevision);
    }
    var entry = undo[^1];
    undo.RemoveAt(undo.Count - 1);
    var nextValue = Value;
    var stages = new List<IReadOnlyList<FsusMarkdownEditorChange>>();
    foreach (var step in entry.Steps.Reverse())
    {
      var applied = ApplyChanges(nextValue, step.Inverse);
      if (applied is null)
      {
        undo.Add(entry);
        return Reject("invalid-change", beforeRevision);
      }
      stages.Add(step.Inverse);
      nextValue = applied.Value;
    }

    Value = nextValue;
    Selection = entry.BeforeSelection;
    Revision += 1;
    redo.Add(entry);
    BreakMergeGroup();
    return Accept(beforeRevision, FsusMarkdownEditorPositionMap.Compose(stages));
  }

  public FsusMarkdownEditorDispatchResult Redo()
  {
    var beforeRevision = Revision;
    if (redo.Count == 0)
    {
      return Reject("no-history", beforeRevision);
    }
    var entry = redo[^1];
    redo.RemoveAt(redo.Count - 1);
    var nextValue = Value;
    var stages = new List<IReadOnlyList<FsusMarkdownEditorChange>>();
    foreach (var step in entry.Steps)
    {
      var applied = ApplyChanges(nextValue, step.Changes);
      if (applied is null)
      {
        redo.Add(entry);
        return Reject("invalid-change", beforeRevision);
      }
      stages.Add(step.Changes);
      nextValue = applied.Value;
    }

    Value = nextValue;
    Selection = entry.AfterSelection;
    Revision += 1;
    undo.Add(entry);
    BreakMergeGroup();
    return Accept(beforeRevision, FsusMarkdownEditorPositionMap.Compose(stages));
  }

  public static IReadOnlyList<FsusMarkdownEditorShellMutation> EvaluateMutations()
  {
    var identity = new FsusMarkdownDocumentIdentity("doc-a", 1);

    var nativeDualStore = new FsusMarkdownEditorTransactionStore(identity, "ab");
    _ = nativeDualStore.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(2, 2, "!")],
        DocumentIdentity: identity));
    _ = nativeDualStore.ApplyExternalValue("server", "reset");
    var nativeDual = nativeDualStore.Undo().Accepted;

    var bareOffsetStore = new FsusMarkdownEditorTransactionStore(identity, "ab");
    var bareOffset = bareOffsetStore.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(-1, 4, "x")],
        ExpectedRevision: 0,
        DocumentIdentity: identity)).Accepted;

    var crossDocumentStore = new FsusMarkdownEditorTransactionStore(identity, "ab");
    crossDocumentStore.SwitchDocument(new FsusMarkdownDocumentIdentity("doc-b", 1), "ab");
    var crossed = crossDocumentStore.Dispatch(
      new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(2, 2, "!")],
        ExpectedRevision: 0,
        DocumentIdentity: identity)).Accepted;

    return
    [
      new("native-undo-dual-authority", nativeDual, nativeDual),
      new("bare-offset", bareOffset, bareOffset),
      new("cross-document", crossed, crossed),
    ];
  }

  internal static AppliedChanges? ApplyChanges(
    string value,
    IReadOnlyList<FsusMarkdownEditorChange> changes)
  {
    ArgumentNullException.ThrowIfNull(value);
    ArgumentNullException.ThrowIfNull(changes);
    var cursor = 0;
    var output = new System.Text.StringBuilder(value.Length);
    var inverse = new List<FsusMarkdownEditorChange>(changes.Count);
    var delta = 0;
    foreach (var change in changes)
    {
      if (change is null ||
        change.Insert is null ||
        change.From < cursor ||
        change.To < change.From ||
        change.From > value.Length ||
        change.To > value.Length ||
        SplitsSurrogate(value, change.From) ||
        SplitsSurrogate(value, change.To))
      {
        return null;
      }
      output.Append(value, cursor, change.From - cursor);
      output.Append(change.Insert);
      var deleted = value.Substring(change.From, change.To - change.From);
      var inverseFrom = change.From + delta;
      inverse.Add(new FsusMarkdownEditorChange(
        inverseFrom,
        inverseFrom + change.Insert.Length,
        deleted));
      delta += change.Insert.Length - (change.To - change.From);
      cursor = change.To;
    }
    output.Append(value, cursor, value.Length - cursor);
    return new(output.ToString(), inverse);
  }

  private FsusMarkdownEditorSelection? ResolveSelection(
    FsusMarkdownEditorSelection? explicitSelection,
    string nextValue,
    FsusMarkdownEditorPositionMap positionMap,
    string? externalUpdate)
  {
    if (explicitSelection is not null)
    {
      return Normalize(nextValue, explicitSelection);
    }
    if (externalUpdate == "reset")
    {
      return new(nextValue.Length, nextValue.Length);
    }
    if (externalUpdate == "rebase")
    {
      var mapped = positionMap.MapRange(new FsusMarkdownSourceRange(Selection.Start, Selection.End));
      return mapped.Range is null
        ? new(nextValue.Length, nextValue.Length, Selection.Direction)
        : Normalize(nextValue, new(mapped.Range.Start, mapped.Range.End, Selection.Direction));
    }
    return Normalize(nextValue, Selection);
  }

  private void RecordHistory(
    FsusMarkdownEditorTransaction transaction,
    IReadOnlyList<FsusMarkdownEditorChange> inverse,
    FsusMarkdownEditorSelection beforeSelection,
    FsusMarkdownEditorSelection afterSelection,
    FsusMarkdownEditorDispatchContext context,
    string beforeValue)
  {
    var timestamp = context.TimestampMilliseconds ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    var mergeDirection = IsOneOf(context.MergeDirection, "backward", "forward", "none")
      ? context.MergeDirection
      : "none";
    var step = new HistoryStep(transaction.Changes.ToArray(), inverse.ToArray());
    var retainedUnits = RetainedUnits(step);
    var previous = undo.Count > 0 ? undo[^1] : null;
    var canMerge =
      transaction.History == "merge" &&
      !mergeBlocked &&
      previous?.History == "merge" &&
      previous.Origin == "input" &&
      transaction.Origin == "input" &&
      timestamp - previous.TimestampMilliseconds <= InputMergeWindowMilliseconds &&
      IsMergeAdjacent(previous, transaction.Changes, beforeSelection, afterSelection, mergeDirection);

    if (canMerge && previous is not null)
    {
      undo[^1] = previous with
      {
        AfterSelection = afterSelection,
        RetainedUnits = previous.RetainedUnits + retainedUnits,
        Steps = [.. previous.Steps, step],
        TimestampMilliseconds = timestamp,
      };
    }
    else
    {
      undo.Add(new(
        beforeValue,
        beforeSelection,
        afterSelection,
        transaction.History == "merge" ? "merge" : "separate",
        mergeDirection,
        transaction.Origin,
        retainedUnits,
        [step],
        timestamp));
    }

    redo.Clear();
    mergeBlocked = false;
    EvictHistory();
  }

  private static bool IsMergeAdjacent(
    HistoryEntry previous,
    IReadOnlyList<FsusMarkdownEditorChange> changes,
    FsusMarkdownEditorSelection beforeSelection,
    FsusMarkdownEditorSelection afterSelection,
    string direction)
  {
    if (direction == "none" ||
      previous.MergeDirection != direction ||
      changes.Count != 1 ||
      previous.AfterSelection.Start != previous.AfterSelection.End ||
      beforeSelection.Start != beforeSelection.End ||
      afterSelection.Start != afterSelection.End ||
      previous.AfterSelection != beforeSelection)
    {
      return false;
    }

    var change = changes[0];
    return direction == "backward"
      ? change.Insert.Length == 0 && change.To == beforeSelection.Start
      : change.From == beforeSelection.Start;
  }

  private void EvictHistory()
  {
    while (undo.Count > HistoryEntryLimit || History.RetainedUnits > HistoryRetainedUnitLimit)
    {
      undo.RemoveAt(0);
    }
  }

  private FsusMarkdownEditorDispatchResult Accept(
    int beforeRevision,
    FsusMarkdownEditorPositionMap positionMap) =>
    new(true, Value, beforeRevision, Revision, Identity, Selection, History, positionMap);

  private FsusMarkdownEditorDispatchResult Reject(string reason, int beforeRevision) =>
    new(false, Value, beforeRevision, Revision, Identity, Selection, History, Reason: reason);

  private static FsusMarkdownEditorSelection? Normalize(
    string value,
    FsusMarkdownEditorSelection selection)
  {
    if (selection.Start < 0 ||
      selection.End < selection.Start ||
      !IsOneOf(selection.Direction, "backward", "forward", "none"))
    {
      return null;
    }
    if (selection.Start == selection.End)
    {
      var caret = SnapOffset(value, selection.Start, "nearest");
      return new(caret, caret, selection.Direction);
    }
    return new(
      SnapOffset(value, selection.Start, "start"),
      SnapOffset(value, selection.End, "end"),
      selection.Direction);
  }

  private static int SnapOffset(string value, int offset, string affinity)
  {
    var clamped = Math.Clamp(offset, 0, value.Length);
    var boundaries = StringInfo.ParseCombiningCharacters(value);
    var previous = 0;
    foreach (var boundary in boundaries.Append(value.Length))
    {
      if (boundary == clamped)
      {
        return boundary;
      }
      if (boundary > clamped)
      {
        return affinity switch
        {
          "start" => previous,
          "end" => boundary,
          _ => clamped - previous <= boundary - clamped ? previous : boundary,
        };
      }
      previous = boundary;
    }
    return value.Length;
  }

  private static bool SplitsSurrogate(string value, int offset) =>
    offset > 0 &&
    offset < value.Length &&
    char.IsHighSurrogate(value[offset - 1]) &&
    char.IsLowSurrogate(value[offset]);

  private static int RetainedUnits(HistoryStep step) =>
    step.Changes.Sum(change => change.Insert.Length) +
    step.Inverse.Sum(change => change.Insert.Length);

  private static bool IsOneOf(string value, params string[] choices) =>
    choices.Contains(value, StringComparer.Ordinal);

  internal sealed record AppliedChanges(
    string Value,
    IReadOnlyList<FsusMarkdownEditorChange> Inverse);

  private sealed record HistoryStep(
    IReadOnlyList<FsusMarkdownEditorChange> Changes,
    IReadOnlyList<FsusMarkdownEditorChange> Inverse);

  private sealed record HistoryEntry(
    string BeforeValue,
    FsusMarkdownEditorSelection BeforeSelection,
    FsusMarkdownEditorSelection AfterSelection,
    string History,
    string MergeDirection,
    string Origin,
    int RetainedUnits,
    IReadOnlyList<HistoryStep> Steps,
    long TimestampMilliseconds);
}
