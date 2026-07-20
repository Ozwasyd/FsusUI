using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusPerceptionChallengeKind
{
  Character,
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
  Retryable,
  Reissue,
  Unavailable,
  Disabled,
}

public enum FsusPerceptionCharacterMode
{
  Raster,
  Audio,
}

public sealed class FsusPerceptionCharacterRasterMedia : IDisposable
{
  private IDisposable? ownedResource;

  public FsusPerceptionCharacterRasterMedia(
    IImage finalRaster,
    int width,
    int height,
    string purposeText,
    IDisposable? ownedResource = null)
  {
    FinalRaster = finalRaster ?? throw new ArgumentNullException(nameof(finalRaster));
    Width = width > 0 ? width : throw new ArgumentOutOfRangeException(nameof(width));
    Height = height > 0 ? height : throw new ArgumentOutOfRangeException(nameof(height));
    PurposeText = purposeText ?? throw new ArgumentNullException(nameof(purposeText));
    this.ownedResource = ownedResource ?? finalRaster as IDisposable;
  }

  public IImage FinalRaster { get; }
  public int Width { get; }
  public int Height { get; }
  public string PurposeText { get; }
  public bool IsReleased => ownedResource is null;

  public void Dispose()
  {
    ownedResource?.Dispose();
    ownedResource = null;
  }
}

public sealed class FsusPerceptionCharacterAudioMedia : IDisposable
{
  private IDisposable? ownedResource;

  public FsusPerceptionCharacterAudioMedia(
    Uri source,
    string purposeText,
    IDisposable? ownedResource = null)
  {
    Source = source ?? throw new ArgumentNullException(nameof(source));
    PurposeText = purposeText ?? throw new ArgumentNullException(nameof(purposeText));
    this.ownedResource = ownedResource;
  }

  public Uri Source { get; }
  public string PurposeText { get; }
  public bool IsReleased => ownedResource is null;

  public void Dispose()
  {
    ownedResource?.Dispose();
    ownedResource = null;
  }
}

public sealed class FsusPerceptionCharacterMedia : IDisposable
{
  private bool isReleased;

  public FsusPerceptionCharacterMedia(
    FsusPerceptionCharacterRasterMedia? raster = null,
    FsusPerceptionCharacterAudioMedia? audio = null)
  {
    if (raster is null && audio is null)
    {
      throw new ArgumentException("Character media requires a raster or audio alternative.");
    }

    Raster = raster;
    Audio = audio;
  }

  public FsusPerceptionCharacterRasterMedia? Raster { get; }
  public FsusPerceptionCharacterAudioMedia? Audio { get; }
  public bool IsReleased => isReleased;

  public void Dispose()
  {
    if (isReleased)
    {
      return;
    }

    Raster?.Dispose();
    Audio?.Dispose();
    isReleased = true;
  }
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
    set
    {
      if (string.Equals(challengeId, value, StringComparison.Ordinal))
      {
        return;
      }

      var previous = challengeId;
      challengeId = value;
      OnChallengeIdentityChanged(previous, value);
    }
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

  private bool IsChallengeDisabled =>
    isDisabled || State == FsusPerceptionChallengeState.Disabled;

  protected override bool IsEnabledCore =>
    base.IsEnabledCore && !IsChallengeDisabled;

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new PerceptionChallengeAutomationPeer(this);

  public int RetryCount { get; private set; }

  public string StateName => State.ToString().ToLower(CultureInfo.InvariantCulture);

  public bool Retry()
  {
    if (IsChallengeDisabled)
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

    if (IsChallengeDisabled)
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

  protected void EmitRefreshRequested()
  {
    RefreshRequested?.Invoke(this, EventArgs.Empty);
  }

  protected virtual void SyncState()
  {
    var isEffectivelyDisabled = IsChallengeDisabled;
    UpdateIsEffectivelyEnabled();
    FsusComponentClasses.Ensure(this, "fsus-loading", State == FsusPerceptionChallengeState.Loading);
    FsusComponentClasses.Ensure(this, "fsus-error", State is FsusPerceptionChallengeState.Error or FsusPerceptionChallengeState.Failed);
    FsusComponentClasses.Ensure(this, "fsus-verified", State == FsusPerceptionChallengeState.Verified);
    FsusComponentClasses.Ensure(this, "fsus-expired", State == FsusPerceptionChallengeState.Expired);
    FsusComponentClasses.Ensure(this, "fsus-disabled", isEffectivelyDisabled);
    FsusComponentClasses.Ensure(this, "fsus-busy", IsBusy);
    AutomationProperties.SetName(this, accessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{StateName}, {KindName(Kind)}, {(isEffectivelyDisabled ? "disabled" : "enabled")}, retries {RetryCount.ToString(CultureInfo.InvariantCulture)}");
  }

  protected virtual void OnChallengeIdentityChanged(string previous, string current)
  {
  }

  protected static string KindName(FsusPerceptionChallengeKind kind) =>
    kind switch
    {
      FsusPerceptionChallengeKind.TextTask => "text-task",
      FsusPerceptionChallengeKind.Character => "character",
      FsusPerceptionChallengeKind.MicroInteraction => "micro-interaction",
      _ => "localization",
    };

  private sealed class PerceptionChallengeAutomationPeer(FsusPerceptionChallenge owner)
    : ControlAutomationPeer(owner)
  {
    protected override bool IsEnabledCore() =>
      owner.IsEnabled && !owner.IsChallengeDisabled;
  }
}

public class FsusPerceptionCharacterChallenge : FsusPerceptionChallenge, IDisposable
{
  private readonly Button alternativeButton;
  private readonly Button rasterButton;
  private readonly Button refreshButton;
  private readonly Button retryButton;
  private readonly Button reissueButton;
  private readonly Button submitButton;
  private readonly Image rasterImage;
  private readonly TextBlock descriptionText;
  private readonly TextBlock errorText;
  private readonly TextBlock promptText;
  private readonly TextBlock responseLabel;
  private readonly TextBlock statusText;
  private readonly TextBox responseInput;
  private FsusPerceptionCharacterMedia? media;
  private string response = string.Empty;

  public FsusPerceptionCharacterChallenge()
  {
    Kind = FsusPerceptionChallengeKind.Character;
    AccessibleName = "Character recognition challenge";
    FsusComponentClasses.SetBaseClasses(this, "fsus-perception-character-challenge");
    Focusable = false;
    promptText = new TextBlock { TextWrapping = TextWrapping.Wrap };
    descriptionText = new TextBlock { TextWrapping = TextWrapping.Wrap };
    statusText = new TextBlock { TextWrapping = TextWrapping.Wrap };
    errorText = new TextBlock { TextWrapping = TextWrapping.Wrap };
    rasterImage = new Image { Stretch = Stretch.Uniform, MaxHeight = 160 };
    alternativeButton = CreateWrappingButton("Use audio instead");
    alternativeButton.Click += (_, _) => RequestAudioAlternative();
    rasterButton = CreateWrappingButton("Use image instead");
    rasterButton.Click += (_, _) => RequestRasterAlternative();
    refreshButton = CreateWrappingButton("Refresh challenge");
    refreshButton.Click += (_, _) => EmitRefreshRequested();
    responseLabel = new TextBlock { Text = "Character response" };
    responseInput = new TextBox { PlaceholderText = "Character response" };
    responseInput.TextChanged += (_, _) => SetResponse(responseInput.Text ?? string.Empty);
    submitButton = CreateWrappingButton("Submit response");
    submitButton.Click += (_, _) => SubmitResponse();
    retryButton = CreateWrappingButton("Retry response");
    retryButton.Click += (_, _) => Retry();
    reissueButton = CreateWrappingButton("Get another challenge");
    reissueButton.Click += (_, _) => RequestReissue();

    var mediaActions = new WrapPanel
    {
      Orientation = Orientation.Horizontal,
      ItemSpacing = 8,
      LineSpacing = 8,
      Children = { alternativeButton, rasterButton, refreshButton },
    };
    var responseRow = new WrapPanel
    {
      Orientation = Orientation.Horizontal,
      ItemSpacing = 8,
      LineSpacing = 8,
      Children = { responseInput, submitButton },
    };
    Content = new StackPanel
    {
      Spacing = 12,
      Children =
      {
        promptText,
        descriptionText,
        statusText,
        errorText,
        rasterImage,
        mediaActions,
        responseLabel,
        responseRow,
        retryButton,
        reissueButton,
      },
    };
    AutomationProperties.SetAutomationId(promptText, "character-prompt");
    AutomationProperties.SetAutomationId(statusText, "character-status");
    AutomationProperties.SetAutomationId(errorText, "character-error");
    AutomationProperties.SetAutomationId(alternativeButton, "character-audio-alternative");
    AutomationProperties.SetAutomationId(rasterButton, "character-raster-alternative");
    AutomationProperties.SetAutomationId(refreshButton, "character-refresh");
    AutomationProperties.SetAutomationId(responseLabel, "character-response-label");
    AutomationProperties.SetAutomationId(responseInput, "character-response");
    AutomationProperties.SetAutomationId(submitButton, "character-submit");
    AutomationProperties.SetAutomationId(retryButton, "character-retry");
    AutomationProperties.SetAutomationId(reissueButton, "character-reissue");
    AutomationProperties.SetLabeledBy(responseInput, responseLabel);
    AutomationProperties.SetLiveSetting(statusText, AutomationLiveSetting.Polite);
    AutomationProperties.SetLiveSetting(errorText, AutomationLiveSetting.Assertive);
    SyncState();
  }

  private static Button CreateWrappingButton(string label)
  {
    var button = new Button
    {
      Content = new TextBlock
      {
        Text = label,
        TextAlignment = TextAlignment.Center,
        TextWrapping = TextWrapping.Wrap,
      },
      HorizontalContentAlignment = HorizontalAlignment.Stretch,
    };
    AutomationProperties.SetName(button, label);
    return button;
  }

  public event EventHandler? AlternativeRequested;
  public event EventHandler? AudioRequested;
  public event EventHandler? ReissueRequested;

  public FsusPerceptionCharacterMedia? Media
  {
    get => media;
    set
    {
      if (ReferenceEquals(media, value))
      {
        return;
      }

      var previous = media;
      media = value;
      previous?.Dispose();
      ResetResponse();
      if (ActiveMode == FsusPerceptionCharacterMode.Raster && media?.Raster is null)
      {
        ActiveMode = FsusPerceptionCharacterMode.Audio;
      }
      else if (ActiveMode == FsusPerceptionCharacterMode.Audio && media?.Audio is null)
      {
        ActiveMode = FsusPerceptionCharacterMode.Raster;
      }

      SyncState();
    }
  }

  public FsusPerceptionCharacterMode ActiveMode { get; private set; } =
    FsusPerceptionCharacterMode.Raster;

  public string Response => response;
  public bool HasRaster => media?.Raster is not null;
  public bool HasAudioAlternative => media?.Audio is not null;
  public bool CanRespond =>
    IsEffectivelyEnabled &&
    State is FsusPerceptionChallengeState.Ready or FsusPerceptionChallengeState.Retryable;

  public void SetResponse(string value)
  {
    response = CanRespond ? value ?? string.Empty : response;
    if (!string.Equals(responseInput.Text, response, StringComparison.Ordinal))
    {
      responseInput.Text = response;
    }
    SyncState();
  }

  public bool RequestAudioAlternative()
  {
    if (!CanRespond || media?.Audio is null)
    {
      return false;
    }

    ActiveMode = FsusPerceptionCharacterMode.Audio;
    AlternativeRequested?.Invoke(this, EventArgs.Empty);
    AudioRequested?.Invoke(this, EventArgs.Empty);
    SyncState();
    return true;
  }

  public bool RequestRasterAlternative()
  {
    if (!CanRespond || media?.Raster is null)
    {
      return false;
    }

    ActiveMode = FsusPerceptionCharacterMode.Raster;
    AlternativeRequested?.Invoke(this, EventArgs.Empty);
    SyncState();
    return true;
  }

  public bool RequestReissue()
  {
    if (!IsEffectivelyEnabled || State is not (FsusPerceptionChallengeState.Reissue or FsusPerceptionChallengeState.Expired))
    {
      return false;
    }

    ReissueRequested?.Invoke(this, EventArgs.Empty);
    return true;
  }

  public FsusPerceptionChallengeSubmitPayload? SubmitResponse()
  {
    var normalized = response.Trim();
    if (!CanRespond || normalized.Length == 0)
    {
      return null;
    }

    var payload = BuildSubmitPayload(normalized);
    EmitSubmitted(payload);
    return payload;
  }

  protected new ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key != Key.Enter)
    {
      return base.HandleKeyAsync(key);
    }

    return ValueTask.FromResult(SubmitResponse() is not null);
  }

  public void ResetResponse()
  {
    response = string.Empty;
    responseInput.Text = string.Empty;
    ErrorMessage = string.Empty;
    SyncState();
  }

  public void Dispose()
  {
    media?.Dispose();
    media = null;
  }

  public bool FocusResponse() => responseInput.Focus();

  protected override void OnChallengeIdentityChanged(string previous, string current)
  {
    ResetResponse();
  }

  protected override void SyncState()
  {
    base.SyncState();
    FsusComponentClasses.Ensure(this, "fsus-raster", ActiveMode == FsusPerceptionCharacterMode.Raster);
    FsusComponentClasses.Ensure(this, "fsus-audio", ActiveMode == FsusPerceptionCharacterMode.Audio);
    FsusComponentClasses.Ensure(this, "fsus-unavailable", State == FsusPerceptionChallengeState.Unavailable);
    FsusComponentClasses.Ensure(this, "fsus-reissue", State == FsusPerceptionChallengeState.Reissue);
    FsusComponentClasses.Ensure(this, "fsus-retryable", State == FsusPerceptionChallengeState.Retryable);
    AutomationProperties.SetHelpText(this, ErrorMessage);
    if (promptText is null)
    {
      return;
    }

    promptText.Text = Prompt;
    descriptionText.Text = Description;
    errorText.Text = ErrorMessage;
    statusText.Text = State switch
    {
      FsusPerceptionChallengeState.Loading => "Preparing challenge",
      FsusPerceptionChallengeState.Verifying => "Checking response",
      FsusPerceptionChallengeState.Retryable => "The response was not accepted",
      FsusPerceptionChallengeState.Reissue => "A new challenge is required",
      FsusPerceptionChallengeState.Expired => "Character challenge expired",
      FsusPerceptionChallengeState.Unavailable => "Character challenge is unavailable",
      FsusPerceptionChallengeState.Disabled => "Character challenge is disabled",
      _ => string.Empty,
    };
    var showsChallenge = State is
      FsusPerceptionChallengeState.Ready or
      FsusPerceptionChallengeState.Verifying or
      FsusPerceptionChallengeState.Retryable or
      FsusPerceptionChallengeState.Disabled;
    rasterImage.Source = showsChallenge && ActiveMode == FsusPerceptionCharacterMode.Raster
      ? media?.Raster?.FinalRaster
      : null;
    rasterImage.IsVisible = rasterImage.Source is not null;
    alternativeButton.IsVisible = showsChallenge && media?.Audio is not null && ActiveMode == FsusPerceptionCharacterMode.Raster;
    rasterButton.IsVisible = showsChallenge && media?.Raster is not null && ActiveMode == FsusPerceptionCharacterMode.Audio;
    refreshButton.IsVisible = State is FsusPerceptionChallengeState.Ready or FsusPerceptionChallengeState.Retryable;
    responseInput.IsVisible = State is FsusPerceptionChallengeState.Ready or FsusPerceptionChallengeState.Verifying or FsusPerceptionChallengeState.Retryable or FsusPerceptionChallengeState.Disabled;
    responseLabel.IsVisible = responseInput.IsVisible;
    submitButton.IsVisible = responseInput.IsVisible;
    retryButton.IsVisible = State == FsusPerceptionChallengeState.Retryable;
    reissueButton.IsVisible = State is FsusPerceptionChallengeState.Reissue or FsusPerceptionChallengeState.Expired;
    responseInput.IsEnabled = CanRespond;
    submitButton.IsEnabled = CanRespond && response.Trim().Length > 0;
    alternativeButton.IsEnabled = CanRespond;
    rasterButton.IsEnabled = CanRespond;
    refreshButton.IsEnabled = CanRespond;
    AutomationProperties.SetName(rasterImage, media?.Raster?.PurposeText ?? string.Empty);
    AutomationProperties.SetName(alternativeButton, media?.Audio?.PurposeText ?? "Use audio instead");
    AutomationProperties.SetName(statusText, statusText.Text ?? string.Empty);
    AutomationProperties.SetName(errorText, errorText.Text ?? string.Empty);
    AutomationProperties.SetHelpText(responseInput, ErrorMessage);
    AutomationProperties.SetItemStatus(responseInput, ErrorMessage.Length == 0 ? StateName : $"{StateName}, invalid");
  }
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
