using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusPerceptionChallengeKind
{
  TextTask,
  Localization,
  MicroInteraction,
}

public enum FsusPerceptionChallengeState
{
  Idle,
  Loading,
  Ready,
  Error,
  Verifying,
  Submitting,
  Failed,
  Verified,
  Expired,
}

public sealed class FsusPerceptionChallengeSubmitPayload : EventArgs
{
  public FsusPerceptionChallengeSubmitPayload(
    FsusPerceptionChallengeKind kind,
    string? challengeId = null,
    string value = "",
    double? x = null,
    double? y = null,
    IReadOnlyList<string>? steps = null)
  {
    Kind = kind;
    ChallengeId = challengeId;
    Value = value;
    X = x;
    Y = y;
    Steps = steps ?? [];
  }

  public FsusPerceptionChallengeKind Kind { get; }
  public string? ChallengeId { get; }
  public string Value { get; }
  public double? X { get; }
  public double? Y { get; }
  public IReadOnlyList<string> Steps { get; }
}

public class FsusPerceptionChallenge : ContentControl
{
  private string accessibleName = "Perception challenge";
  private string challengeId = string.Empty;
  private string prompt = string.Empty;
  private string description = string.Empty;
  private string errorMessage = string.Empty;
  private string retryLabel = "Retry";
  private bool isDisabled;
  private FsusPerceptionChallengeState state = FsusPerceptionChallengeState.Ready;

  public FsusPerceptionChallenge()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-perception-challenge");
    Focusable = true;
    SyncState();
  }

  public event EventHandler? RetryRequested;
  public event EventHandler? RefreshRequested;
  public event EventHandler? CancelRequested;
  public event EventHandler<FsusPerceptionChallengeSubmitPayload>? Submitted;

  public string AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public string ChallengeId
  {
    get => challengeId;
    set => challengeId = value;
  }

  public FsusPerceptionChallengeKind Kind { get; set; } =
    FsusPerceptionChallengeKind.TextTask;

  public string Prompt
  {
    get => prompt;
    set
    {
      prompt = value;
      SyncState();
    }
  }

  public string Description
  {
    get => description;
    set
    {
      description = value;
      SyncState();
    }
  }

  public FsusPerceptionChallengeState State
  {
    get => state;
    set
    {
      state = value;
      SyncState();
    }
  }

  public string ErrorMessage
  {
    get => errorMessage;
    set
    {
      errorMessage = value;
      SyncState();
    }
  }

  public string RetryLabel
  {
    get => retryLabel;
    set => retryLabel = value;
  }

  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      isDisabled = value;
      SyncState();
    }
  }

  public bool IsBusy =>
    State is FsusPerceptionChallengeState.Loading
      or FsusPerceptionChallengeState.Verifying
      or FsusPerceptionChallengeState.Submitting;

  public int RetryCount { get; private set; }

  public string StateName => State.ToString().ToLower(CultureInfo.InvariantCulture);

  public bool Retry()
  {
    if (isDisabled)
    {
      return false;
    }

    RetryCount++;
    RetryRequested?.Invoke(this, EventArgs.Empty);
    RefreshRequested?.Invoke(this, EventArgs.Empty);
    SyncState();
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key == Key.Escape && IsBusy)
    {
      CancelRequested?.Invoke(this, EventArgs.Empty);
      return ValueTask.FromResult(true);
    }

    if (isDisabled)
    {
      return ValueTask.FromResult(false);
    }

    if (key == Key.Enter || key == Key.Space)
    {
      Submitted?.Invoke(this, BuildSubmitPayload());
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  protected FsusPerceptionChallengeSubmitPayload BuildSubmitPayload(
    string value = "",
    double? x = null,
    double? y = null,
    IReadOnlyList<string>? steps = null) =>
    new(Kind, challengeId, value, x, y, steps);

  protected void EmitSubmitted(FsusPerceptionChallengeSubmitPayload payload)
  {
    Submitted?.Invoke(this, payload);
    SyncState();
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-loading", State == FsusPerceptionChallengeState.Loading);
    FsusComponentClasses.Ensure(this, "fsus-error", State is FsusPerceptionChallengeState.Error or FsusPerceptionChallengeState.Failed);
    FsusComponentClasses.Ensure(this, "fsus-verified", State == FsusPerceptionChallengeState.Verified);
    FsusComponentClasses.Ensure(this, "fsus-expired", State == FsusPerceptionChallengeState.Expired);
    FsusComponentClasses.Ensure(this, "fsus-disabled", isDisabled);
    FsusComponentClasses.Ensure(this, "fsus-busy", IsBusy);
    AutomationProperties.SetName(this, accessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{StateName}, {KindName(Kind)}, {(isDisabled ? "disabled" : "enabled")}, retries {RetryCount.ToString(CultureInfo.InvariantCulture)}");
  }

  protected static string KindName(FsusPerceptionChallengeKind kind) =>
    kind switch
    {
      FsusPerceptionChallengeKind.TextTask => "text-task",
      FsusPerceptionChallengeKind.MicroInteraction => "micro-interaction",
      _ => "localization",
    };
}

public class FsusTextTaskChallenge : FsusPerceptionChallenge
{
  private string value = string.Empty;

  public FsusTextTaskChallenge()
  {
    Kind = FsusPerceptionChallengeKind.TextTask;
    FsusComponentClasses.SetBaseClasses(this, "fsus-text-task-challenge");
  }

  public void SetValue(string nextValue)
  {
    value = nextValue;
  }

  public FsusPerceptionChallengeSubmitPayload Submit()
  {
    var payload = BuildSubmitPayload(value);
    LastSubmittedPayload = payload;
    EmitSubmitted(payload);
    return payload;
  }

  public FsusPerceptionChallengeSubmitPayload? LastSubmittedPayload { get; private set; }

  protected new ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key is not (Key.Enter or Key.Space))
    {
      return base.HandleKeyAsync(key);
    }

    if (IsDisabled)
    {
      return ValueTask.FromResult(false);
    }

    Submit();
    return ValueTask.FromResult(true);
  }
}

public class FsusLocalizationChallenge : FsusPerceptionChallenge
{
  private double selectedX;
  private double selectedY;

  public FsusLocalizationChallenge()
  {
    Kind = FsusPerceptionChallengeKind.Localization;
    FsusComponentClasses.SetBaseClasses(this, "fsus-localization-challenge");
  }

  public void SelectPoint(double x, double y)
  {
    selectedX = x;
    selectedY = y;
    SyncState();
  }

  public FsusPerceptionChallengeSubmitPayload Submit()
  {
    var payload = BuildSubmitPayload(x: selectedX, y: selectedY);
    LastSubmittedPayload = payload;
    EmitSubmitted(payload);
    return payload;
  }

  public FsusPerceptionChallengeSubmitPayload? LastSubmittedPayload { get; private set; }
}

public class FsusMicroInteractionChallenge : FsusPerceptionChallenge
{
  public FsusMicroInteractionChallenge()
  {
    Kind = FsusPerceptionChallengeKind.MicroInteraction;
    FsusComponentClasses.SetBaseClasses(this, "fsus-micro-interaction-challenge");
  }

  public bool IsInteractionEnabled { get; set; }
  public Collection<string> Steps { get; } = [];
  public FsusPerceptionChallengeSubmitPayload? LastSubmittedPayload { get; private set; }

  public void RecordStep(string step)
  {
    if (IsInteractionEnabled && !IsDisabled)
    {
      Steps.Add(step);
    }
  }

  public FsusPerceptionChallengeSubmitPayload Submit()
  {
    var payload = BuildSubmitPayload(steps: Steps.ToArray());
    LastSubmittedPayload = payload;
    EmitSubmitted(payload);
    return payload;
  }

  protected new ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key is not (Key.Enter or Key.Space))
    {
      return base.HandleKeyAsync(key);
    }

    if (!IsInteractionEnabled || IsDisabled)
    {
      return ValueTask.FromResult(false);
    }

    Submit();
    return ValueTask.FromResult(true);
  }
}
