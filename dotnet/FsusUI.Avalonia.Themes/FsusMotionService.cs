using Avalonia.Animation.Easings;

namespace FsusUI.Avalonia.Themes;

public enum FsusResolvedMotionMode
{
  Enabled,
  Reduced,
  Disabled,
}

public enum FsusMotionPreset
{
  ControlFeedback,
  PanelEnter,
  OverlayTransition,
  ListItemAppearance,
  ActionRowSafe,
}

public enum FsusMotionPhase
{
  Enter,
  Leave,
}

public readonly record struct FsusMotionTransform(double X, double Y, double Scale)
{
  public static FsusMotionTransform Terminal { get; } = new(0d, 0d, 1d);

  public static FsusMotionTransform TranslateY(double value) => new(0d, value, 1d);
}

public sealed record FsusMotionVisualState(
  double Opacity,
  FsusMotionTransform Transform)
{
  public static FsusMotionVisualState Terminal { get; } =
    new(1d, FsusMotionTransform.Terminal);
}

public sealed record FsusMotionRequest(FsusMotionPreset Preset)
{
  public FsusMotionPhase Phase { get; init; } = FsusMotionPhase.Enter;
  public int Index { get; init; }
}

public sealed record FsusMotionPlan(
  FsusMotionPreset Preset,
  FsusMotionPhase Phase,
  FsusResolvedMotionMode EffectiveMode,
  TimeSpan Duration,
  TimeSpan Delay,
  IEasing Easing,
  string DurationToken,
  string EasingToken,
  FsusMotionVisualState From,
  FsusMotionVisualState To,
  FsusMotionVisualState TerminalState,
  bool IsAnimated,
  bool PreservesFocus);

public sealed class FsusMotionModeChangedEventArgs : EventArgs
{
  public FsusMotionModeChangedEventArgs(
    FsusMotionMode previousMode,
    FsusMotionMode currentMode,
    FsusResolvedMotionMode previousEffectiveMode,
    FsusResolvedMotionMode currentEffectiveMode)
  {
    PreviousMode = previousMode;
    CurrentMode = currentMode;
    PreviousEffectiveMode = previousEffectiveMode;
    CurrentEffectiveMode = currentEffectiveMode;
  }

  public FsusMotionMode PreviousMode { get; }
  public FsusMotionMode CurrentMode { get; }
  public FsusResolvedMotionMode PreviousEffectiveMode { get; }
  public FsusResolvedMotionMode CurrentEffectiveMode { get; }
}

public sealed class FsusMotionService
{
  private const int MaxStaggerIndex = 19;

  public FsusMotionService(
    FsusMotionMode mode = FsusMotionMode.System,
    bool systemPrefersReducedMotion = false)
  {
    RequestedMode = NormalizeMode(mode);
    SystemPrefersReducedMotion = systemPrefersReducedMotion;
  }

  public event EventHandler<FsusMotionModeChangedEventArgs>? MotionModeChanged;

  public FsusMotionMode RequestedMode { get; private set; }
  public bool SystemPrefersReducedMotion { get; private set; }
  public FsusResolvedMotionMode EffectiveMode => ResolveEffectiveMode();

  public void SetMode(
    FsusMotionMode mode,
    bool? systemPrefersReducedMotion = null)
  {
    var previousMode = RequestedMode;
    var previousEffectiveMode = EffectiveMode;

    RequestedMode = NormalizeMode(mode);
    if (systemPrefersReducedMotion.HasValue)
    {
      SystemPrefersReducedMotion = systemPrefersReducedMotion.Value;
    }

    var currentEffectiveMode = EffectiveMode;
    if (previousMode == RequestedMode && previousEffectiveMode == currentEffectiveMode)
    {
      return;
    }

    MotionModeChanged?.Invoke(
      this,
      new FsusMotionModeChangedEventArgs(
        previousMode,
        RequestedMode,
        previousEffectiveMode,
        currentEffectiveMode));
  }

  public FsusMotionPlan Resolve(FsusMotionPreset preset) =>
    Resolve(new FsusMotionRequest(preset));

  public FsusMotionPlan Resolve(FsusMotionRequest request)
  {
    ArgumentNullException.ThrowIfNull(request);

    var contract = GetPresetContract(request.Preset);
    var terminal = FsusMotionVisualState.Terminal;
    var mode = EffectiveMode;
    var delay = request.Preset == FsusMotionPreset.ListItemAppearance
      ? FsusTokens.MotionStaggerDefaultTimeSpan * Math.Clamp(request.Index, 0, MaxStaggerIndex)
      : TimeSpan.Zero;

    if (mode == FsusResolvedMotionMode.Disabled)
    {
      return new FsusMotionPlan(
        request.Preset,
        request.Phase,
        mode,
        TimeSpan.Zero,
        TimeSpan.Zero,
        contract.Easing,
        contract.DurationToken,
        contract.EasingToken,
        terminal,
        terminal,
        terminal,
        false,
        contract.PreservesFocus);
    }

    if (mode == FsusResolvedMotionMode.Reduced)
    {
      return new FsusMotionPlan(
        request.Preset,
        request.Phase,
        mode,
        TimeSpan.FromMilliseconds(1),
        TimeSpan.Zero,
        contract.Easing,
        contract.DurationToken,
        contract.EasingToken,
        terminal,
        terminal,
        terminal,
        true,
        contract.PreservesFocus);
    }

    var from = request.Phase == FsusMotionPhase.Leave ? terminal : contract.From;
    var to = request.Phase == FsusMotionPhase.Leave ? contract.LeaveTo : terminal;
    return new FsusMotionPlan(
      request.Preset,
      request.Phase,
      mode,
      contract.Duration,
      delay,
      contract.Easing,
      contract.DurationToken,
      contract.EasingToken,
      from,
      to,
      terminal,
      true,
      contract.PreservesFocus);
  }

  private FsusResolvedMotionMode ResolveEffectiveMode() =>
    RequestedMode switch
    {
      FsusMotionMode.Disabled => FsusResolvedMotionMode.Disabled,
      FsusMotionMode.Reduced => FsusResolvedMotionMode.Reduced,
      FsusMotionMode.System when SystemPrefersReducedMotion => FsusResolvedMotionMode.Reduced,
      _ => FsusResolvedMotionMode.Enabled,
    };

  private static FsusMotionMode NormalizeMode(FsusMotionMode mode) =>
    Enum.IsDefined(typeof(FsusMotionMode), mode) ? mode : FsusMotionMode.System;

  private static PresetContract GetPresetContract(FsusMotionPreset preset) =>
    preset switch
    {
      FsusMotionPreset.ControlFeedback => new PresetContract(
        FsusTokens.MotionDurationControlFastTimeSpan,
        FsusTokens.MotionDurationControlFastName,
        FsusTokens.MotionEasingStandardEasing,
        FsusTokens.MotionEasingStandardName,
        new FsusMotionVisualState(0.96d, FsusMotionTransform.Terminal),
        FsusMotionVisualState.Terminal,
        true),
      FsusMotionPreset.PanelEnter => new PresetContract(
        FsusTokens.MotionDurationPanelTimeSpan,
        FsusTokens.MotionDurationPanelName,
        FsusTokens.MotionEasingEmphasizedEasing,
        FsusTokens.MotionEasingEmphasizedName,
        new FsusMotionVisualState(
          0d,
          FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceMediumDouble)),
        new FsusMotionVisualState(
          0d,
          FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceMediumDouble)),
        true),
      FsusMotionPreset.OverlayTransition => new PresetContract(
        FsusTokens.MotionDurationPanelTimeSpan,
        FsusTokens.MotionDurationPanelName,
        FsusTokens.MotionEasingEmphasizedEasing,
        FsusTokens.MotionEasingEmphasizedName,
        new FsusMotionVisualState(
          0d,
          FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceSmallDouble)),
        new FsusMotionVisualState(0d, FsusMotionTransform.Terminal),
        true),
      FsusMotionPreset.ListItemAppearance => new PresetContract(
        FsusTokens.MotionDurationControlTimeSpan,
        FsusTokens.MotionDurationControlName,
        FsusTokens.MotionEasingStandardEasing,
        FsusTokens.MotionEasingStandardName,
        new FsusMotionVisualState(
          0d,
          FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceSmallDouble)),
        new FsusMotionVisualState(
          0d,
          FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceSmallDouble)),
        true),
      FsusMotionPreset.ActionRowSafe => new PresetContract(
        FsusTokens.MotionDurationControlFastTimeSpan,
        FsusTokens.MotionDurationControlFastName,
        FsusTokens.MotionEasingStandardEasing,
        FsusTokens.MotionEasingStandardName,
        new FsusMotionVisualState(0.98d, FsusMotionTransform.Terminal),
        new FsusMotionVisualState(0.98d, FsusMotionTransform.Terminal),
        true),
      _ => GetPresetContract(FsusMotionPreset.ControlFeedback),
    };

  private sealed record PresetContract(
    TimeSpan Duration,
    string DurationToken,
    IEasing Easing,
    string EasingToken,
    FsusMotionVisualState From,
    FsusMotionVisualState LeaveTo,
    bool PreservesFocus);
}
