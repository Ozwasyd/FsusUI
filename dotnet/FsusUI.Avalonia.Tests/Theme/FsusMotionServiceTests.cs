using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.Tests.Theme;

public class FsusMotionServiceTests
{
  [Fact]
  public void ResolvesEnabledSystemReducedAndDisabledModes()
  {
    var enabled = new FsusMotionService(FsusMotionMode.Enabled);

    var enabledPlan = enabled.Resolve(FsusMotionPreset.ControlFeedback);
    Assert.Equal(FsusResolvedMotionMode.Enabled, enabledPlan.EffectiveMode);
    Assert.True(enabledPlan.IsAnimated);
    Assert.Equal(FsusTokens.MotionDurationControlFastTimeSpan, enabledPlan.Duration);
    Assert.Equal(FsusTokens.MotionEasingStandardName, enabledPlan.EasingToken);

    var system = new FsusMotionService(FsusMotionMode.System, systemPrefersReducedMotion: true);
    var systemPlan = system.Resolve(FsusMotionPreset.PanelEnter);
    Assert.Equal(FsusResolvedMotionMode.Reduced, systemPlan.EffectiveMode);
    Assert.Equal(TimeSpan.FromMilliseconds(1), systemPlan.Duration);
    Assert.Equal(FsusMotionTransform.Terminal, systemPlan.From.Transform);
    Assert.Equal(systemPlan.To, systemPlan.TerminalState);

    var disabled = new FsusMotionService(FsusMotionMode.Disabled);
    var disabledPlan = disabled.Resolve(FsusMotionPreset.OverlayTransition);
    Assert.Equal(FsusResolvedMotionMode.Disabled, disabledPlan.EffectiveMode);
    Assert.False(disabledPlan.IsAnimated);
    Assert.Equal(TimeSpan.Zero, disabledPlan.Duration);
    Assert.Equal(disabledPlan.TerminalState, disabledPlan.From);
  }

  [Fact]
  public void AppliesRuntimeModeChangesWithoutChangingTerminalState()
  {
    var service = new FsusMotionService(FsusMotionMode.Enabled);
    var changes = new List<FsusMotionModeChangedEventArgs>();
    service.MotionModeChanged += (_, args) => changes.Add(args);

    var enabled = service.Resolve(FsusMotionPreset.PanelEnter);

    service.SetMode(FsusMotionMode.Reduced);
    var reduced = service.Resolve(FsusMotionPreset.PanelEnter);

    service.SetMode(FsusMotionMode.Disabled);
    var disabled = service.Resolve(FsusMotionPreset.PanelEnter);

    Assert.Equal(2, changes.Count);
    Assert.Equal(FsusResolvedMotionMode.Enabled, changes[0].PreviousEffectiveMode);
    Assert.Equal(FsusResolvedMotionMode.Reduced, changes[0].CurrentEffectiveMode);
    Assert.Equal(FsusResolvedMotionMode.Disabled, changes[1].CurrentEffectiveMode);
    Assert.Equal(enabled.TerminalState, reduced.TerminalState);
    Assert.Equal(enabled.TerminalState, disabled.TerminalState);
  }

  [Fact]
  public void MapsStablePresetFamiliesToTokenBackedPlans()
  {
    var service = new FsusMotionService(FsusMotionMode.Enabled);

    var panel = service.Resolve(FsusMotionPreset.PanelEnter);
    Assert.Equal(FsusTokens.MotionDurationPanelName, panel.DurationToken);
    Assert.Equal(FsusTokens.MotionEasingEmphasizedName, panel.EasingToken);
    Assert.Equal(FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceMediumDouble), panel.From.Transform);

    var listItem = service.Resolve(
      new FsusMotionRequest(FsusMotionPreset.ListItemAppearance) { Index = 50 });
    Assert.Equal(FsusTokens.MotionStaggerDefaultTimeSpan * 19, listItem.Delay);
    Assert.Equal(FsusMotionTransform.TranslateY(FsusTokens.MotionDistanceSmallDouble), listItem.From.Transform);

    var actionRow = service.Resolve(FsusMotionPreset.ActionRowSafe);
    Assert.Equal(FsusMotionTransform.Terminal, actionRow.From.Transform);
    Assert.Equal(FsusMotionTransform.Terminal, actionRow.To.Transform);
    Assert.True(actionRow.PreservesFocus);
  }
}
