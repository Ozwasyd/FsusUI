using System.Globalization;
using System.Reflection;
using Avalonia.Headless.XUnit;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;
using Avalonia.Platform;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusVueParityTypographyTests
{
  private const string Chinese =
    "标题不能为空文章首页内容工作区文章管理待复核草稿响应式导航契约与暂无文章" +
    "稳定排版基线使用率";

  [AvaloniaTheory]
  [InlineData(400)]
  [InlineData(500)]
  [InlineData(700)]
  public void PinnedFacesHaveRealWeightsAndGlyphCoverage(int value)
  {
    var weight = (FontWeight)value;
    var latin = FsusVueParityTypography.RequireFace(
      FsusVueParityTypography.ResourceRoot + "GoogleSans/Latin/",
      FsusVueParityTypography.GoogleSansFamily, weight);
    var symbols = FsusVueParityTypography.RequireFace(
      FsusVueParityTypography.ResourceRoot + "GoogleSans/Symbols/",
      FsusVueParityTypography.GoogleSansFamily, weight);
    var chinese = FsusVueParityTypography.RequireFace(
      FsusVueParityTypography.ResourceRoot + "NotoSansSC/",
      FsusVueParityTypography.NotoSansFamily, weight);

    AssertGlyphs(latin, "Long Latin title verification Close Open 50% CPU A/B: 12,345.67 (ok)");
    AssertGlyphs(symbols, "✕↗");
    AssertGlyphs(chinese, Chinese + "，。！？（）");
    Assert.Equal(value == 500 ? "Noto Sans SC Thin Medium" : "Noto Sans SC Thin", chinese.FamilyName);
    Assert.False(latin.CharacterToGlyphMap.TryGetGlyph('文', out _));
    Assert.False(symbols.CharacterToGlyphMap.TryGetGlyph('文', out _));
    Assert.True(chinese.GlyphCount > 7000);
    foreach (var package in new[] { "google-sans", "noto-sans-sc" })
    {
      using var stream = AssetLoader.Open(new Uri(FsusVueParityTypography.ResourceRoot + $"Source/{package}/LICENSE"));
      using var reader = new StreamReader(stream);
      Assert.Contains("SIL OPEN FONT LICENSE Version 1.1", reader.ReadToEnd());
      Assert.True(AssetLoader.Exists(new Uri(FsusVueParityTypography.ResourceRoot + $"Source/{package}/COPYRIGHT.txt")));
    }
  }

  [AvaloniaTheory]
  [InlineData(400)]
  [InlineData(500)]
  [InlineData(700)]
  public void MixedLayoutsUsePinnedLatinCjkAndSymbolFaces(int value)
  {
    var defaultFamily = FontManager.Current.DefaultFontFamily;
    var weight = (FontWeight)value;
    var body = FsusVueParityTypography.CreateBodyFont(useBundledFonts: true);
    var typeface = new Typeface(body, weight: weight);
    using var layout = new TextLayout(
      "Long Latin title verification CPU 50% " + Chinese + " ✕↗",
      typeface, 14, Brushes.Black, lineHeight: 22);

    Assert.True(double.IsFinite(layout.Width) && layout.Width > 0);
    Assert.Equal(22, layout.Height);
    var runs = Assert.Single(layout.TextLines).TextRuns.OfType<ShapedTextRun>().ToArray();
    Assert.NotEmpty(runs);
    Assert.Contains(runs, run => Family(run.GlyphRun.GlyphTypeface) == FsusVueParityTypography.GoogleSansFamily);
    Assert.Contains(runs, run => Family(run.GlyphRun.GlyphTypeface) == FsusVueParityTypography.NotoSansFamily);
    foreach (var run in runs)
    {
      var face = run.GlyphRun.GlyphTypeface;
      Assert.Equal(weight, face.Weight);
      Assert.Equal(FontSimulations.None, face.FontSimulations);
      Assert.All(run.GlyphRun.GlyphInfos, glyph => Assert.NotEqual((ushort)0, glyph.GlyphIndex));
      foreach (var character in run.Text.Span)
      {
        if (char.IsWhiteSpace(character))
        {
          continue;
        }
        Assert.Equal(character >= 0x3400 && character <= 0x9fff
          ? FsusVueParityTypography.NotoSansFamily
          : FsusVueParityTypography.GoogleSansFamily, Family(face));
      }
    }

    // Verify fallback chooses this resource family, even on machines with CJK
    // system fonts. Successful shaping alone could otherwise conceal tofu.
    foreach (var character in Chinese)
    {
      Assert.True(FontManager.Current.TryMatchCharacter(character, FontStyle.Normal,
        weight, FontStretch.Normal, body, CultureInfo.GetCultureInfo("zh-CN"), out var matched));
      Assert.Equal(FsusVueParityTypography.NotoCollectionKey, matched.FontFamily.Key!.Source);
      Assert.True(FontManager.Current.TryGetGlyphTypeface(matched, out var face));
      Assert.Equal(FsusVueParityTypography.NotoSansFamily, Family(face));
      AssertGlyphs(face, character.ToString());
    }

    Assert.Equal(defaultFamily, FontManager.Current.DefaultFontFamily);
  }

  [AvaloniaFact]
  public void StandaloneModeKeepsCjkBeforeGenericFallbacks()
  {
    var body = FsusVueParityTypography.CreateBodyFont(useBundledFonts: false);
    Assert.Equal(FsusVueParityTypography.StandaloneStack, body.FamilyNames.ToString());
    Assert.DoesNotContain(FsusVueParityTypography.ResourceRoot, body.ToString());
    var families = body.FamilyNames.ToArray();
    Assert.True(Array.IndexOf(families, "Noto Sans SC") < Array.IndexOf(families, "Arial"));
    Assert.True(Array.IndexOf(families, "Noto Sans CJK SC") < Array.IndexOf(families, "system-ui"));
  }

  [AvaloniaFact]
  public void FixtureUsesExplicitGsansMode()
  {
    var property = typeof(FsusVueParityBatch3EvidenceTests).GetProperty(
      "BodyFont", BindingFlags.Static | BindingFlags.NonPublic);
    Assert.NotNull(property);
    var expected = FsusVueParityTypography.CreateBodyFont(
      Environment.GetEnvironmentVariable("FSUS_HEADLESS_GSANS") == "1");
    Assert.Equal(expected, Assert.IsType<FontFamily>(property.GetValue(null)));
    var attachTheme = typeof(FsusVueParityBatch3EvidenceTests).GetMethod(
      "AttachTheme", BindingFlags.Static | BindingFlags.NonPublic);
    Assert.NotNull(attachTheme);
    var window = new Window();
    try
    {
      attachTheme.Invoke(null, [window, FsusThemeVariant.Light]);
      Assert.Equal(expected, Assert.IsType<FontFamily>(window.Resources["FsusTypographyFamilyBody"]));
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void MissingResourceIsRejected()
  {
    var exception = Assert.Throws<InvalidOperationException>(() => FsusVueParityTypography.RequireFace(
      FsusVueParityTypography.ResourceRoot + "Absent/", FsusVueParityTypography.NotoSansFamily, FontWeight.Normal));
    Assert.Contains("font resource is missing", exception.Message);
  }

  [AvaloniaFact]
  public void UnavailableResourceFamilyIsRejected()
  {
    var source = FsusVueParityTypography.ResourceRoot + "GoogleSans/Latin/";
    var unavailable = FontFamily.Parse(source + "#Absent Vue Parity Family");
    Assert.False(FontManager.Current.TryGetGlyphTypeface(new Typeface(unavailable), out _));
    var exception = Assert.Throws<InvalidOperationException>(() => FsusVueParityTypography.RequireFace(
      source, "Absent Vue Parity Family", FontWeight.Normal));
    Assert.Contains("requires the real", exception.Message);
    Assert.Throws<InvalidOperationException>(() => FsusVueParityTypography.RequireFace(
      source, FsusVueParityTypography.NotoSansFamily, FontWeight.Normal));
  }

  [AvaloniaFact]
  public void MissingWeightCannotUseANearestOrSynthesizedFace()
  {
    var exception = Assert.Throws<InvalidOperationException>(() => FsusVueParityTypography.RequireFace(
      FsusVueParityTypography.ResourceRoot + "GoogleSans/Latin/",
      FsusVueParityTypography.GoogleSansFamily, FontWeight.SemiBold));
    Assert.Contains("600.ttf", exception.Message);
    FsusVueParityTypography.RequireFace(FsusVueParityTypography.ResourceRoot + "NotoSansSC/",
      FsusVueParityTypography.NotoSansFamily, FontWeight.Normal);
    var noto = FontFamily.Parse($"{FsusVueParityTypography.NotoCollectionKey}#{FsusVueParityTypography.NotoSansFamily}");
    Assert.False(FontManager.Current.TryGetGlyphTypeface(new Typeface(noto, weight: FontWeight.SemiBold), out _));
    var unavailable = FontFamily.Parse($"{FsusVueParityTypography.NotoCollectionKey}#Absent Vue Parity Family");
    Assert.False(FontManager.Current.TryGetGlyphTypeface(new Typeface(unavailable), out _));
  }

  private static string Family(GlyphTypeface face) => string.IsNullOrEmpty(face.TypographicFamilyName)
    ? face.FamilyName : face.TypographicFamilyName;

  private static void AssertGlyphs(GlyphTypeface face, string text)
  {
    foreach (var character in text)
    {
      Assert.True(face.CharacterToGlyphMap.TryGetGlyph(character, out var glyph),
        $"{Family(face)} {(int)face.Weight} is missing U+{(int)character:X4}");
      Assert.NotEqual((ushort)0, glyph);
    }
  }
}
