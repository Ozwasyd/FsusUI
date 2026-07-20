using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Avalonia.Media;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusPerceptionChallengePrimitiveTests
{
  [Fact]
  public async Task PerceptionChallengeHandlesRetryLoadingFailureDisabledAndKeyboardFlow()
  {
    var challenge = new KeyboardPerceptionChallenge
    {
      AccessibleName = "Challenge",
      Kind = FsusPerceptionChallengeKind.TextTask,
      Prompt = "请输入下面提示中的长文本以继续，这是一段很长的本地化说明。",
      State = FsusPerceptionChallengeState.Loading,
      RetryLabel = "重试",
    };
    var retries = 0;
    var refreshes = 0;
    var cancels = 0;
    challenge.RetryRequested += (_, _) => retries++;
    challenge.RefreshRequested += (_, _) => refreshes++;
    challenge.CancelRequested += (_, _) => cancels++;

    Assert.Equal("loading", challenge.StateName);
    Assert.True(challenge.IsBusy);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(challenge));
    Assert.Equal("Challenge", AutomationProperties.GetName(challenge));
    Assert.Equal("loading, text-task, enabled, retries 0", AutomationProperties.GetItemStatus(challenge));

    challenge.State = FsusPerceptionChallengeState.Failed;
    challenge.ErrorMessage = "try_again";
    challenge.Retry();

    Assert.Equal(1, retries);
    Assert.Equal(1, refreshes);
    Assert.Equal(1, challenge.RetryCount);
    Assert.Equal("failed", challenge.StateName);

    challenge.State = FsusPerceptionChallengeState.Submitting;
    Assert.True(await challenge.PressAsync(Key.Escape));
    Assert.Equal(1, cancels);

    challenge.IsDisabled = true;
    Assert.False(challenge.Retry());
    Assert.False(await challenge.PressAsync(Key.Enter));
    Assert.Equal("submitting, text-task, disabled, retries 1", AutomationProperties.GetItemStatus(challenge));
  }

  [Fact]
  public async Task SpecializedChallengesEmitDeterministicAdapterPayloads()
  {
    var text = new KeyboardTextTaskChallenge
    {
      ChallengeId = "text-1",
      Prompt = "Type the visible word",
    };
    var submitted = new List<FsusPerceptionChallengeSubmitPayload>();
    text.Submitted += (_, payload) => submitted.Add(payload);
    text.SetValue("release");

    Assert.True(await text.PressAsync(Key.Enter));
    Assert.Equal(FsusPerceptionChallengeKind.TextTask, submitted[0].Kind);
    Assert.Equal("release", submitted[0].Value);

    var localization = new FsusLocalizationChallenge
    {
      ChallengeId = "loc-1",
      Prompt = "Select the highlighted point",
    };
    localization.SelectPoint(12, 24);
    var pointPayload = localization.Submit();

    Assert.Equal(12, pointPayload.X);
    Assert.Equal(24, pointPayload.Y);

    var micro = new KeyboardMicroInteractionChallenge
    {
      ChallengeId = "micro-1",
      IsInteractionEnabled = true,
    };
    micro.RecordStep("focus");
    micro.RecordStep("press");

    Assert.True(await micro.PressAsync(Key.Enter));
    Assert.Equal(["focus", "press"], micro.LastSubmittedPayload?.Steps);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(micro));
  }

  [Fact]
  public async Task CharacterChallengeOwnsAllStatesKeyboardAndUserInitiatedAudio()
  {
    using var rasterLease = new ResourceLease();
    using var audioLease = new ResourceLease();
    using var media = new FsusPerceptionCharacterMedia(
      new FsusPerceptionCharacterRasterMedia(new DrawingImage(), 240, 80, "Characters to transcribe", rasterLease),
      new FsusPerceptionCharacterAudioMedia(new Uri("https://example.invalid/final-audio.mp3"), "Spoken characters to transcribe", audioLease));
    using var challenge = new KeyboardCharacterChallenge
    {
      ChallengeId = "character-1",
      Media = media,
      State = FsusPerceptionChallengeState.Ready,
    };
    var audioRequests = 0;
    var submissions = new List<FsusPerceptionChallengeSubmitPayload>();
    challenge.AudioRequested += (_, _) => audioRequests++;
    challenge.Submitted += (_, payload) => submissions.Add(payload);

    Assert.True(challenge.RequestAudioAlternative());
    Assert.Equal(1, audioRequests);
    Assert.Equal(FsusPerceptionCharacterMode.Audio, challenge.ActiveMode);
    challenge.SetResponse("  K7 D2  ");
    Assert.True(await challenge.PressAsync(Key.Enter));
    Assert.Equal(FsusPerceptionChallengeKind.Character, submissions[0].Kind);
    Assert.Equal("K7 D2", submissions[0].Value);

    foreach (var state in new[]
    {
      FsusPerceptionChallengeState.Loading,
      FsusPerceptionChallengeState.Ready,
      FsusPerceptionChallengeState.Verifying,
      FsusPerceptionChallengeState.Retryable,
      FsusPerceptionChallengeState.Reissue,
      FsusPerceptionChallengeState.Expired,
      FsusPerceptionChallengeState.Unavailable,
      FsusPerceptionChallengeState.Disabled,
    })
    {
      challenge.State = state;
      Assert.Equal(state.ToString().ToLowerInvariant(), challenge.StateName);
    }

    Assert.True(challenge.IsEnabled);
    Assert.False(challenge.IsEffectivelyEnabled);
    var peer = Assert.IsAssignableFrom<AutomationPeer>(ControlAutomationPeer.CreatePeerForElement(challenge));
    Assert.False(peer.IsEnabled());
    Assert.Contains("disabled", AutomationProperties.GetItemStatus(challenge));
    Assert.False(challenge.CanRespond);
    Assert.False(await challenge.PressAsync(Key.Enter));

    challenge.State = FsusPerceptionChallengeState.Ready;
    Assert.True(challenge.IsEnabled);
    Assert.True(challenge.IsEffectivelyEnabled);
    Assert.True(peer.IsEnabled());

    challenge.IsDisabled = true;
    Assert.True(challenge.IsEnabled);
    Assert.False(challenge.IsEffectivelyEnabled);
    Assert.False(peer.IsEnabled());

    challenge.IsDisabled = false;
    challenge.IsEnabled = false;
    Assert.False(challenge.IsEnabled);
    Assert.False(challenge.IsEffectivelyEnabled);
    Assert.False(peer.IsEnabled());
    challenge.State = FsusPerceptionChallengeState.Disabled;
    challenge.State = FsusPerceptionChallengeState.Ready;
    Assert.False(challenge.IsEnabled);
    Assert.False(peer.IsEnabled());
  }

  [Fact]
  public void CharacterChallengeReplacementReleasesStaleRasterAudioAndResponse()
  {
    var oldRaster = new ResourceLease();
    var oldAudio = new ResourceLease();
    var currentRaster = new ResourceLease();
    var currentAudio = new ResourceLease();
    var challenge = new FsusPerceptionCharacterChallenge
    {
      ChallengeId = "character-old",
      State = FsusPerceptionChallengeState.Ready,
      Media = new FsusPerceptionCharacterMedia(
        new FsusPerceptionCharacterRasterMedia(new DrawingImage(), 240, 80, "Raster purpose", oldRaster),
        new FsusPerceptionCharacterAudioMedia(new Uri("https://example.invalid/old.mp3"), "Audio purpose", oldAudio)),
    };
    challenge.SetResponse("STALE");
    challenge.ErrorMessage = "The response does not match";

    challenge.Media = new FsusPerceptionCharacterMedia(
      new FsusPerceptionCharacterRasterMedia(new DrawingImage(), 240, 80, "Replacement raster purpose", currentRaster),
      new FsusPerceptionCharacterAudioMedia(new Uri("https://example.invalid/new.mp3"), "Replacement audio purpose", currentAudio));

    Assert.True(oldRaster.IsDisposed);
    Assert.True(oldAudio.IsDisposed);
    Assert.Equal(string.Empty, challenge.Response);
    Assert.Equal(string.Empty, challenge.ErrorMessage);
    Assert.Equal("character-old", challenge.ChallengeId);
    challenge.Dispose();
    Assert.True(currentRaster.IsDisposed);
    Assert.True(currentAudio.IsDisposed);
  }

  [Fact]
  public void CharacterChallengeAssociatesResponseLabelErrorAndLiveRegionsInLogicalOrder()
  {
    using var challenge = new FsusPerceptionCharacterChallenge
    {
      Prompt = "Type the characters shown",
      Description = "Case does not matter",
      State = FsusPerceptionChallengeState.Retryable,
      Media = new FsusPerceptionCharacterMedia(
        new FsusPerceptionCharacterRasterMedia(new DrawingImage(), 240, 80, "Characters to transcribe"),
        new FsusPerceptionCharacterAudioMedia(new Uri("https://example.invalid/final.mp3"), "Hear the characters")),
    };
    challenge.ErrorMessage = "Try the new image";
    challenge.SetResponse("K7D2");

    var controls = challenge.GetLogicalDescendants().OfType<Control>().ToList();
    var label = FindAutomationControl(controls, "character-response-label");
    var response = FindAutomationControl(controls, "character-response");
    var status = FindAutomationControl(controls, "character-status");
    var error = FindAutomationControl(controls, "character-error");

    Assert.Same(label, AutomationProperties.GetLabeledBy(response));
    Assert.Equal("Try the new image", AutomationProperties.GetHelpText(response));
    Assert.Equal("retryable, invalid", AutomationProperties.GetItemStatus(response));
    Assert.Equal(AutomationLiveSetting.Polite, AutomationProperties.GetLiveSetting(status));
    Assert.Equal(AutomationLiveSetting.Assertive, AutomationProperties.GetLiveSetting(error));
    Assert.Equal("The response was not accepted", AutomationProperties.GetName(status));
    Assert.Equal("Try the new image", AutomationProperties.GetName(error));

    var focusOrder = controls
      .Where(control => control.Focusable && control.IsVisible)
      .Select(AutomationProperties.GetAutomationId)
      .OfType<string>()
      .Where(id => id.Length > 0)
      .ToArray();
    Assert.Equal(
      ["character-audio-alternative", "character-refresh", "character-response", "character-submit", "character-retry"],
      focusOrder);
  }

  [Fact]
  public void CharacterChallengeButtonLabelsWrapInsideZoom400Width()
  {
    using var challenge = new FsusPerceptionCharacterChallenge
    {
      State = FsusPerceptionChallengeState.Retryable,
      Media = new FsusPerceptionCharacterMedia(
        new FsusPerceptionCharacterRasterMedia(new DrawingImage(), 240, 80, "Characters to transcribe"),
        new FsusPerceptionCharacterAudioMedia(new Uri("https://example.invalid/final.mp3"), "Hear the characters")),
    };
    challenge.SetResponse("K7D2");
    const double zoom400Width = 158;
    var buttons = challenge.GetLogicalDescendants().OfType<Button>().ToList();

    Assert.Equal(6, buttons.Count);
    foreach (var button in buttons)
    {
      var label = Assert.IsType<TextBlock>(button.Content);
      Assert.Equal(TextWrapping.Wrap, label.TextWrapping);
      Assert.False(string.IsNullOrWhiteSpace(AutomationProperties.GetName(button)));

      button.Measure(new global::Avalonia.Size(zoom400Width, double.PositiveInfinity));
      button.Arrange(new global::Avalonia.Rect(0, 0, zoom400Width, Math.Max(1, button.DesiredSize.Height)));

      Assert.True(label.DesiredSize.Width <= button.Bounds.Width);
      Assert.True(label.Bounds.Right <= button.Bounds.Right);
    }
  }

  [Fact]
  public void PerceptionChallengeThemeVisualAndAccessibilityBaselinesCoverStable40()
  {
    var theme = ReadControlTheme("PerceptionChallenge.axaml");
    Assert.Contains("fsus|FsusPerceptionChallenge", theme);
    Assert.Contains("fsus|FsusPerceptionCharacterChallenge", theme);
    Assert.Contains("fsus|FsusLocalizationChallenge", theme);
    Assert.Contains("fsus|FsusMicroInteractionChallenge", theme);
    Assert.Contains("fsus|FsusTextTaskChallenge", theme);
    Assert.Contains("FsusThemePerceptionChallengeSurfaceBrush", theme);
    Assert.Contains("FsusMotionDurationEffective", theme);

    var rootTheme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/PerceptionChallenge.axaml", rootTheme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("perception-challenge-stable40-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("perception-challenge-stable40", accessibilityEvidence);
  }

  private sealed class KeyboardPerceptionChallenge : FsusPerceptionChallenge
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static Control FindAutomationControl(IEnumerable<Control> controls, string automationId) =>
    Assert.Single(controls, control => AutomationProperties.GetAutomationId(control) == automationId);

  private sealed class KeyboardTextTaskChallenge : FsusTextTaskChallenge
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardCharacterChallenge : FsusPerceptionCharacterChallenge
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class ResourceLease : IDisposable
  {
    public bool IsDisposed { get; private set; }

    public void Dispose()
    {
      IsDisposed = true;
    }
  }

  private sealed class KeyboardMicroInteractionChallenge : FsusMicroInteractionChallenge
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
