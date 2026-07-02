using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
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
  public void PerceptionChallengeThemeVisualAndAccessibilityBaselinesCoverStable40()
  {
    var theme = ReadControlTheme("PerceptionChallenge.axaml");
    Assert.Contains("fsus|FsusPerceptionChallenge", theme);
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

  private sealed class KeyboardTextTaskChallenge : FsusTextTaskChallenge
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
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
