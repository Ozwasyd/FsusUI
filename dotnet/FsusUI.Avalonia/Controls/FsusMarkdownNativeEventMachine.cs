using System.Globalization;
using System.Text;

namespace FsusUI.Avalonia.Controls;

/// <summary>
/// Phase of the shared native input event machine. Mirrors the Web
/// MarkdownNativePhase union so both platforms freeze identical traces.
/// </summary>
public enum FsusMarkdownNativePhase
{
  Idle,
  Composing,
  Committing,
  Aborted,
  Draining,
}

public enum FsusMarkdownNativeEventKind
{
  CompositionStart,
  CompositionUpdate,
  CompositionEnd,
  BeforeInput,
  Input,
  Paste,
  Drop,
  ExternalReset,
  DocumentSwitch,
}

public enum FsusMarkdownNativeAction
{
  Ignore,
  Snapshot,
  Dispatch,
  Commit,
  Undo,
  Redo,
  Prevent,
  Dedup,
  Abort,
}

public sealed record FsusMarkdownNativeEventInput
{
  public string? ClipboardIdentity { get; init; }

  public FsusMarkdownDocumentIdentity? CurrentIdentity { get; init; }

  public string? Data { get; init; }

  public bool Disabled { get; init; }

  public FsusMarkdownDocumentIdentity? DocumentIdentity { get; init; }

  public int? ExpectedRevision { get; init; }

  public string? InputType { get; init; }

  public bool? IsComposing { get; init; }

  public required FsusMarkdownNativeEventKind Kind { get; init; }

  public string? Origin { get; init; }

  public string? PreviousValue { get; init; }

  public int? Revision { get; init; }

  public FsusMarkdownEditorSelection? Selection { get; init; }

  public string? Value { get; init; }
}

public sealed record FsusMarkdownBeforeInputSnapshot(
  string? Data,
  string InputType,
  FsusMarkdownEditorSelection Selection,
  string Value);

public sealed record FsusMarkdownNativeEventPlan
{
  public required FsusMarkdownNativeAction Action { get; init; }

  public bool Composition { get; init; }

  public bool FreezeSmartInput { get; init; }

  public string History { get; init; } = "merge";

  public string? Identity { get; init; }

  public string MergeDirection { get; init; } = "none";

  public string Origin { get; init; } = "input";

  public required FsusMarkdownNativePhase Phase { get; init; }

  public bool PreventDefault { get; init; }

  public string? Rejected { get; init; }

  public bool RestoreDisplay { get; init; }

  public FsusMarkdownBeforeInputSnapshot? Snapshot { get; init; }
}

public sealed record FsusMarkdownNativeTraceEntry
{
  public required FsusMarkdownNativeAction Action { get; init; }

  public required string? Identity { get; init; }

  public string? InputType { get; init; }

  public required FsusMarkdownNativeEventKind Kind { get; init; }

  public required FsusMarkdownNativePhase Phase { get; init; }

  public string? Rejected { get; init; }

  public int? Revision { get; init; }
}

/// <summary>
/// C# port of the shared Markdown native input event machine
/// (vue/packages/components/markdown-editor/src/markdown-editor-native-event.ts).
/// Both platforms must produce identical plans and traces for identical event
/// sequences; the frozen vectors in spec/avalonia/markdown-editor-input-vectors.json
/// are the cross-platform oracle. No timeouts, no second pipeline: dedup is
/// identity-based, undo authority stays with the transaction store.
/// </summary>
public sealed class FsusMarkdownNativeEventMachine
{
  public const int TraceLimit = 128;

  private readonly List<FsusMarkdownNativeTraceEntry> trace = new();
  private FsusMarkdownDocumentIdentity? documentIdentity;
  private string? lastClipboardIdentity;
  private string? lastCommitValue;
  private string? lastIdentity;
  private FsusMarkdownNativePhase phase = FsusMarkdownNativePhase.Idle;
  private FsusMarkdownBeforeInputSnapshot? snapshot;

  public FsusMarkdownNativeEventMachine(
    FsusMarkdownDocumentIdentity? documentIdentity = null,
    int? revision = null)
  {
    this.documentIdentity = documentIdentity;
    Revision = revision;
  }

  public bool Composing => phase == FsusMarkdownNativePhase.Composing;

  public bool FreezeSmartInput =>
    phase is FsusMarkdownNativePhase.Composing or FsusMarkdownNativePhase.Committing;

  public FsusMarkdownNativePhase Phase => phase;

  public int? Revision { get; private set; }

  public FsusMarkdownBeforeInputSnapshot? Snapshot => snapshot;

  public IReadOnlyList<FsusMarkdownNativeTraceEntry> Trace => trace;

  public static string EventIdentity(FsusMarkdownNativeEventInput input)
  {
    var selection = input.Selection;
    var body = string.Join(
      ':',
      KindToken(input.Kind),
      input.InputType ?? string.Empty,
      input.Data ?? string.Empty,
      input.ClipboardIdentity ?? string.Empty,
      (input.Revision ?? 0).ToString(CultureInfo.InvariantCulture),
      selection is null ? string.Empty : selection.Start.ToString(CultureInfo.InvariantCulture),
      selection is null ? string.Empty : selection.End.ToString(CultureInfo.InvariantCulture),
      input.Value ?? string.Empty);
    return "native:" + HashText(body);
  }

  public FsusMarkdownNativeEventPlan Apply(FsusMarkdownNativeEventInput input)
  {
    var identity = EventIdentity(input);
    if (input.Revision is int revision)
    {
      Revision = revision;
    }
    bool Freeze() =>
      phase is FsusMarkdownNativePhase.Composing or FsusMarkdownNativePhase.Committing;

    if (input.Kind is not (FsusMarkdownNativeEventKind.DocumentSwitch or FsusMarkdownNativeEventKind.ExternalReset) &&
        (!SameDocument(input.DocumentIdentity, documentIdentity) ||
         !SameDocument(input.CurrentIdentity, documentIdentity) ||
         (input.ExpectedRevision is not null &&
          input.Revision is not null &&
          input.ExpectedRevision != input.Revision)))
    {
      return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
        freezeSmartInput: Freeze(), rejected: "stale-document", restoreDisplay: true));
    }

    if (input.Kind is FsusMarkdownNativeEventKind.DocumentSwitch or FsusMarkdownNativeEventKind.ExternalReset)
    {
      if (input.DocumentIdentity is not null)
      {
        documentIdentity = input.DocumentIdentity;
      }
      lastClipboardIdentity = null;
      lastCommitValue = null;
      lastIdentity = null;
      snapshot = null;
      var wasLive = Freeze();
      phase = wasLive ? FsusMarkdownNativePhase.Aborted : FsusMarkdownNativePhase.Idle;
      return Finish(input, Plan(wasLive ? FsusMarkdownNativeAction.Abort : FsusMarkdownNativeAction.Ignore,
        phase, identity, freezeSmartInput: false, restoreDisplay: wasLive));
    }

    if (input.Disabled)
    {
      return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
        freezeSmartInput: Freeze(), rejected: "disabled"));
    }

    if (input.Kind == FsusMarkdownNativeEventKind.CompositionStart)
    {
      phase = FsusMarkdownNativePhase.Composing;
      lastCommitValue = null;
      snapshot = null;
      return Finish(input, Plan(FsusMarkdownNativeAction.Ignore, phase, identity,
        freezeSmartInput: true));
    }

    if (input.Kind == FsusMarkdownNativeEventKind.CompositionUpdate)
    {
      if (phase != FsusMarkdownNativePhase.Composing)
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          rejected: "orphaned-composition", restoreDisplay: true));
      }
      return Finish(input, Plan(FsusMarkdownNativeAction.Ignore, phase, identity,
        freezeSmartInput: true));
    }

    if (input.Kind == FsusMarkdownNativeEventKind.CompositionEnd)
    {
      if (phase == FsusMarkdownNativePhase.Aborted)
      {
        phase = FsusMarkdownNativePhase.Draining;
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          freezeSmartInput: false, rejected: "orphaned-composition", restoreDisplay: true));
      }
      if (phase != FsusMarkdownNativePhase.Composing)
      {
        if (!string.IsNullOrEmpty(input.Data))
        {
          phase = FsusMarkdownNativePhase.Idle;
          lastCommitValue = (input.PreviousValue ?? string.Empty) + input.Data;
          lastIdentity = identity;
          return Finish(input, Plan(FsusMarkdownNativeAction.Commit, phase, identity,
            composition: true, freezeSmartInput: false, history: "separate", origin: "input"));
        }
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          rejected: "orphaned-composition", restoreDisplay: true));
      }
      var endValue = input.Value ?? string.Empty;
      var previous = input.PreviousValue ?? string.Empty;
      if (endValue == previous)
      {
        if (!string.IsNullOrEmpty(input.Data))
        {
          phase = FsusMarkdownNativePhase.Idle;
          lastCommitValue = previous + input.Data;
          lastIdentity = identity;
          return Finish(input, Plan(FsusMarkdownNativeAction.Commit, phase, identity,
            composition: true, freezeSmartInput: false, history: "separate", origin: "input"));
        }
        phase = FsusMarkdownNativePhase.Committing;
        return Finish(input, Plan(FsusMarkdownNativeAction.Ignore, phase, identity,
          freezeSmartInput: true));
      }
      phase = FsusMarkdownNativePhase.Idle;
      lastCommitValue = endValue;
      lastIdentity = identity;
      return Finish(input, Plan(FsusMarkdownNativeAction.Commit, phase, identity,
        composition: true, freezeSmartInput: false, history: "separate", origin: "input"));
    }

    if (input.Kind is FsusMarkdownNativeEventKind.Paste or FsusMarkdownNativeEventKind.Drop)
    {
      if (Freeze())
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          freezeSmartInput: true, rejected: "composition-active"));
      }
      lastClipboardIdentity = input.ClipboardIdentity ?? identity;
      lastIdentity = lastClipboardIdentity;
      return Finish(input, Plan(FsusMarkdownNativeAction.Ignore, phase, lastClipboardIdentity,
        origin: input.Kind == FsusMarkdownNativeEventKind.Paste ? "paste" : "drop"));
    }

    if (input.Kind == FsusMarkdownNativeEventKind.BeforeInput)
    {
      if (input.InputType == "historyUndo")
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Undo, phase, identity,
          freezeSmartInput: Freeze(), preventDefault: true, rejected: "native-undo"));
      }
      if (input.InputType == "historyRedo")
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Redo, phase, identity,
          freezeSmartInput: Freeze(), preventDefault: true));
      }
      if (phase == FsusMarkdownNativePhase.Draining)
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          restoreDisplay: true));
      }
      if (phase is FsusMarkdownNativePhase.Aborted or FsusMarkdownNativePhase.Idle &&
          IsCompositionInputType(input.InputType, input.IsComposing))
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          rejected: "orphaned-composition", restoreDisplay: true));
      }
      if (lastClipboardIdentity is not null &&
          input.InputType is "insertFromPaste" or "insertFromDrop")
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Dedup, phase, lastClipboardIdentity,
          origin: InferOrigin(input.InputType, null), preventDefault: true));
      }
      snapshot = new FsusMarkdownBeforeInputSnapshot(
        input.Data,
        input.InputType ?? "insertText",
        input.Selection ?? new FsusMarkdownEditorSelection(0, 0),
        input.PreviousValue ?? input.Value ?? string.Empty);
      return Finish(input, Plan(FsusMarkdownNativeAction.Snapshot, phase, identity,
        freezeSmartInput: Freeze(), preventDefault: false, snapshot: snapshot));
    }

    if (lastClipboardIdentity is not null &&
        (input.InputType is "insertFromPaste" or "insertFromDrop" ||
         input.Origin is "paste" or "drop"))
    {
      var owned = lastClipboardIdentity;
      lastClipboardIdentity = null;
      return Finish(input, Plan(FsusMarkdownNativeAction.Dedup, phase, owned,
        origin: InferOrigin(input.InputType, input.Origin), restoreDisplay: true));
    }

    if (phase == FsusMarkdownNativePhase.Draining)
    {
      phase = FsusMarkdownNativePhase.Idle;
      snapshot = null;
      return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
        restoreDisplay: true));
    }

    if (phase == FsusMarkdownNativePhase.Aborted)
    {
      if (IsCompositionInputType(input.InputType, input.IsComposing))
      {
        return Finish(input, Plan(FsusMarkdownNativeAction.Prevent, phase, identity,
          rejected: "orphaned-composition", restoreDisplay: true));
      }
      phase = FsusMarkdownNativePhase.Idle;
    }

    if (phase == FsusMarkdownNativePhase.Composing)
    {
      return Finish(input, Plan(FsusMarkdownNativeAction.Ignore, phase, identity,
        freezeSmartInput: true, preventDefault: false, restoreDisplay: false));
    }

    var value = input.Value ?? string.Empty;
    if (lastCommitValue is not null && value == lastCommitValue)
    {
      lastCommitValue = null;
      snapshot = null;
      return Finish(input, Plan(FsusMarkdownNativeAction.Dedup, phase, lastIdentity,
        composition: true, restoreDisplay: false));
    }

    if (phase == FsusMarkdownNativePhase.Committing)
    {
      phase = FsusMarkdownNativePhase.Idle;
      lastCommitValue = value;
      lastIdentity = identity;
      snapshot = null;
      return Finish(input, Plan(FsusMarkdownNativeAction.Commit, phase, identity,
        composition: true, freezeSmartInput: false, history: "separate", origin: "input"));
    }

    if (identity == lastIdentity && lastIdentity is not null)
    {
      return Finish(input, Plan(FsusMarkdownNativeAction.Dedup, phase, identity,
        restoreDisplay: true));
    }

    var dispatchOrigin = InferOrigin(input.InputType, input.Origin);
    var inputType = input.InputType ?? snapshot?.InputType;
    lastIdentity = identity;
    lastCommitValue = null;
    snapshot = null;
    return Finish(input, Plan(FsusMarkdownNativeAction.Dispatch, phase, identity,
      composition: false,
      history: dispatchOrigin == "input" ? "merge" : "separate",
      mergeDirection: MergeDirectionFor(inputType, input.Selection),
      origin: dispatchOrigin,
      preventDefault: false,
      restoreDisplay: false));
  }

  private FsusMarkdownNativeEventPlan Finish(
    FsusMarkdownNativeEventInput input,
    FsusMarkdownNativeEventPlan plan)
  {
    trace.Add(new FsusMarkdownNativeTraceEntry
    {
      Action = plan.Action,
      Identity = plan.Identity,
      InputType = input.InputType,
      Kind = input.Kind,
      Phase = plan.Phase,
      Rejected = plan.Rejected,
      Revision = input.Revision,
    });
    if (trace.Count > TraceLimit)
    {
      trace.RemoveRange(0, trace.Count - TraceLimit);
    }
    return plan;
  }

  private static FsusMarkdownNativeEventPlan Plan(
    FsusMarkdownNativeAction action,
    FsusMarkdownNativePhase planPhase,
    string? identity,
    bool composition = false,
    bool? freezeSmartInput = null,
    string history = "merge",
    string mergeDirection = "none",
    string origin = "input",
    bool? preventDefault = null,
    string? rejected = null,
    bool? restoreDisplay = null,
    FsusMarkdownBeforeInputSnapshot? snapshot = null) =>
    new()
    {
      Action = action,
      Composition = composition,
      FreezeSmartInput = freezeSmartInput ??
        (planPhase is FsusMarkdownNativePhase.Composing or FsusMarkdownNativePhase.Committing),
      History = history,
      Identity = identity,
      MergeDirection = mergeDirection,
      Origin = origin,
      Phase = planPhase,
      PreventDefault = preventDefault ??
        (action is FsusMarkdownNativeAction.Prevent or FsusMarkdownNativeAction.Undo
          or FsusMarkdownNativeAction.Redo or FsusMarkdownNativeAction.Dedup),
      Rejected = rejected,
      RestoreDisplay = restoreDisplay ?? action == FsusMarkdownNativeAction.Prevent,
      Snapshot = snapshot,
    };

  private static bool SameDocument(
    FsusMarkdownDocumentIdentity? left,
    FsusMarkdownDocumentIdentity? right)
  {
    if (left is null || right is null)
    {
      return true;
    }
    return left.Id == right.Id && left.Epoch == right.Epoch;
  }

  private static bool IsCompositionInputType(string? inputType, bool? isComposing) =>
    isComposing == true || inputType == "insertCompositionText";

  private static string InferOrigin(string? inputType, string? origin)
  {
    if (!string.IsNullOrEmpty(origin))
    {
      return origin;
    }
    if (inputType == "insertFromPaste")
    {
      return "paste";
    }
    if (inputType == "insertFromDrop")
    {
      return "drop";
    }
    return "input";
  }

  private static string MergeDirectionFor(
    string? inputType,
    FsusMarkdownEditorSelection? selection)
  {
    if (selection is null || selection.Start != selection.End)
    {
      return "none";
    }
    if (inputType is "deleteContentBackward" or "deleteWordBackward" or "deleteSoftLineBackward")
    {
      return "backward";
    }
    if (inputType is "deleteContentForward" or "deleteWordForward" or "deleteSoftLineForward"
      or "insertText" or "insertLineBreak" or "insertReplacementText")
    {
      return "forward";
    }
    return "none";
  }

  private static string HashText(string value)
  {
    unchecked
    {
      var hash = (uint)2166136261;
      foreach (var ch in value)
      {
        hash ^= ch;
        hash *= 16777619;
      }
      return ToBase36(hash);
    }
  }

  private static string ToBase36(uint value)
  {
    if (value == 0)
    {
      return "0";
    }
    var builder = new StringBuilder();
    var remaining = value;
    while (remaining > 0)
    {
      var digit = (int)(remaining % 36);
      builder.Append((char)(digit < 10 ? '0' + digit : 'a' + digit - 10));
      remaining /= 36;
    }
    var chars = builder.ToString().ToCharArray();
    Array.Reverse(chars);
    return new string(chars);
  }

  public static string KindToken(FsusMarkdownNativeEventKind kind) => kind switch
  {
    FsusMarkdownNativeEventKind.CompositionStart => "compositionstart",
    FsusMarkdownNativeEventKind.CompositionUpdate => "compositionupdate",
    FsusMarkdownNativeEventKind.CompositionEnd => "compositionend",
    FsusMarkdownNativeEventKind.BeforeInput => "beforeinput",
    FsusMarkdownNativeEventKind.Input => "input",
    FsusMarkdownNativeEventKind.Paste => "paste",
    FsusMarkdownNativeEventKind.Drop => "drop",
    FsusMarkdownNativeEventKind.ExternalReset => "external-reset",
    FsusMarkdownNativeEventKind.DocumentSwitch => "document-switch",
    _ => throw new ArgumentOutOfRangeException(nameof(kind)),
  };

  public static string PhaseToken(FsusMarkdownNativePhase value) => value switch
  {
    FsusMarkdownNativePhase.Idle => "idle",
    FsusMarkdownNativePhase.Composing => "composing",
    FsusMarkdownNativePhase.Committing => "committing",
    FsusMarkdownNativePhase.Aborted => "aborted",
    FsusMarkdownNativePhase.Draining => "draining",
    _ => throw new ArgumentOutOfRangeException(nameof(value)),
  };

  public static string ActionToken(FsusMarkdownNativeAction value) => value switch
  {
    FsusMarkdownNativeAction.Ignore => "ignore",
    FsusMarkdownNativeAction.Snapshot => "snapshot",
    FsusMarkdownNativeAction.Dispatch => "dispatch",
    FsusMarkdownNativeAction.Commit => "commit",
    FsusMarkdownNativeAction.Undo => "undo",
    FsusMarkdownNativeAction.Redo => "redo",
    FsusMarkdownNativeAction.Prevent => "prevent",
    FsusMarkdownNativeAction.Dedup => "dedup",
    FsusMarkdownNativeAction.Abort => "abort",
    _ => throw new ArgumentOutOfRangeException(nameof(value)),
  };
}
