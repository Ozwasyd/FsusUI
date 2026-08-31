using Avalonia.Controls;
using Avalonia.Automation;
using Avalonia.LogicalTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Demo.Gallery;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class AvaloniaGalleryRegistryTests
{
  private static readonly string[] RequiredStates =
  [
    "default",
    "disabled",
    "loading",
    "invalid",
    "selected",
    "empty",
    "error",
    "long-text",
    "cjk-text",
    "dense",
    "mobile-width",
    "keyboard-focused",
    "high-contrast",
  ];

  [Fact]
  public void StableGalleryRegistryUsesExactGeneratedContractRouteBindings()
  {
    var route = Assert.Single(FsusAvaloniaGalleryRegistry.StableRoutes);
    Assert.Equal("selection", route.ComponentId);
    Assert.Equal(
      ["component-v2.el-check-tag"],
      route.StableContractIds.Order(StringComparer.Ordinal));

    var page = route.CreatePage();
    var checkTag = Assert.Single(
      page.GetLogicalDescendants().OfType<FsusCheckTag>());
    Assert.Equal("Check tag", checkTag.Content);
    Assert.Equal("Check tag", AutomationProperties.GetName(checkTag));
    Assert.Empty(page.GetLogicalDescendants().OfType<FsusButton>());
    Assert.Empty(page.GetLogicalDescendants().OfType<FsusInput>());
  }

  [Fact]
  public void EveryStableGalleryPageInstantiatesAndUsesPublicControls()
  {
    foreach (var route in FsusAvaloniaGalleryRegistry.StableRoutes)
    {
      var page = route.CreatePage();

      Assert.IsAssignableFrom<Control>(page);
      Assert.StartsWith("/stable/", route.Route);
      Assert.All(RequiredStates, (state) => Assert.Contains(state, route.StateCoverage));
    }
  }

  [Fact]
  public void ScreenshotScenariosCoverThemeAndDensityMatrixForEveryRoute()
  {
    var expected = (
      from variant in new[] { FsusThemeVariant.Light, FsusThemeVariant.Dark }
      from highContrast in new[] { false, true }
      where !(variant == FsusThemeVariant.Dark && highContrast)
      from density in new[] { FsusDensity.Compact, FsusDensity.Default, FsusDensity.Spacious }
      select (variant, highContrast, density)
    ).ToHashSet();

    foreach (var route in FsusAvaloniaGalleryRegistry.StableRoutes)
    {
      var actual = route.ScreenshotScenarios
        .Select((scenario) => (scenario.Variant, scenario.HighContrast, scenario.Density))
        .ToHashSet();

      Assert.Empty(expected.Except(actual));
      Assert.Empty(actual.Except(expected));
    }
  }

  [Fact]
  public void MarkdownEditorGalleryInstantiatesPublicFsusMarkdownEditor()
  {
    var route = Assert.Single(
      FsusAvaloniaGalleryRegistry.AllRoutes,
      candidate => candidate.ComponentId == "markdown-editor");
    var page = route.CreatePage();
    var editors = page.GetLogicalDescendants()
      .OfType<FsusMarkdownEditor>()
      .ToArray();
    Assert.Single(editors);
    Assert.Equal(FsusMarkdownEditorMode.Live, editors[0].Mode);
    Assert.Equal("aligned", editors[0].CapabilityState);
    Assert.NotNull(editors[0].ProjectionMap);
    Assert.Equal(typeof(FsusMarkdownEditor), editors[0].GetType());
  }

  [Fact]
  public void CodeEditorGalleryInstantiatesConfiguredPublicFsusCodeEditor()
  {
    var route = Assert.Single(
      FsusAvaloniaGalleryRegistry.AllRoutes,
      candidate => candidate.ComponentId == "code-editor");
    var page = route.CreatePage();
    var editor = Assert.Single(page.GetLogicalDescendants().OfType<FsusCodeEditor>());

    Assert.Equal(typeof(FsusCodeEditor), editor.GetType());
    Assert.Equal("gallery-code", editor.DocumentIdentity?.Id);
    Assert.True(editor.WordWrap);
    Assert.True(editor.ShowLineNumbers);
    Assert.NotEmpty(editor.HighlightSpans);
  }

  [Fact]
  public void PerceptionGalleryInstantiatesAllEightCharacterStates()
  {
    var route = Assert.Single(
      FsusAvaloniaGalleryRegistry.AllRoutes,
      candidate => candidate.ComponentId == "perception-challenge");
    var page = route.CreatePage();
    var challenges = page.GetLogicalDescendants()
      .OfType<FsusPerceptionCharacterChallenge>()
      .ToArray();

    Assert.Equal(
      [
        FsusPerceptionChallengeState.Loading,
        FsusPerceptionChallengeState.Ready,
        FsusPerceptionChallengeState.Verifying,
        FsusPerceptionChallengeState.Retryable,
        FsusPerceptionChallengeState.Reissue,
        FsusPerceptionChallengeState.Expired,
        FsusPerceptionChallengeState.Unavailable,
        FsusPerceptionChallengeState.Disabled,
      ],
      challenges.Select(challenge => challenge.State));
    Assert.All(challenges, challenge => Assert.Equal(FsusPerceptionChallengeKind.Character, challenge.Kind));
    Assert.Null(challenges.Single(challenge => challenge.State == FsusPerceptionChallengeState.Unavailable).Media);
    Assert.All(
      challenges.Where(challenge => challenge.State != FsusPerceptionChallengeState.Unavailable),
      challenge =>
      {
        Assert.True(challenge.HasRaster);
        Assert.True(challenge.HasAudioAlternative);
      });
  }
}
