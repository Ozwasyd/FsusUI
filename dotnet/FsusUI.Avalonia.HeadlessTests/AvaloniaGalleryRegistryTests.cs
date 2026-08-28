using Avalonia.Controls;
using Avalonia.LogicalTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Demo.Gallery;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class AvaloniaGalleryRegistryTests
{
  private static readonly string[] RequiredStableFamilies =
  [
    "button",
    "icon-text",
    "input",
    "selection",
    "form",
    "display",
    "layout",
    "navigation",
    "modal-panel",
    "anchored-overlay",
    "service-helper",
    "picker",
    "date-time",
    "value-picker",
    "upload-transfer",
    "data-display",
    "media-decorative",
    "data-table",
    "virtualization",
    "tree",
    "text-viewer",
    "text-editor",
    "markdown-editor",
    "public-shell",
    "product-primitives",
    "perception-challenge",
    "locale-formatting",
  ];

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
  public void StableGalleryRegistryCoversEveryStableFamily()
  {
    var routes = FsusAvaloniaGalleryRegistry.StableRoutes;
    var ids = routes.Select((route) => route.ComponentId).ToHashSet(StringComparer.Ordinal);

    foreach (var family in RequiredStableFamilies)
    {
      Assert.Contains(family, ids);
    }

    Assert.Empty(ids.Except(RequiredStableFamilies));
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
      FsusAvaloniaGalleryRegistry.StableRoutes,
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
  public void PerceptionGalleryInstantiatesAllEightCharacterStates()
  {
    var route = Assert.Single(
      FsusAvaloniaGalleryRegistry.StableRoutes,
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
