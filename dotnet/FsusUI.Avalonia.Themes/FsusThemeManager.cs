using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Styling;

namespace FsusUI.Avalonia.Themes;

public enum FsusThemeVariant
{
  Light,
  Dark,
}

public enum FsusDensity
{
  Compact,
  Default,
  Spacious,
}

public enum FsusMotionMode
{
  System,
  Enabled,
  Reduced,
  Disabled,
}

public sealed record FsusThemeOptions
{
  public static FsusThemeOptions Default { get; } = new();

  public FsusThemeVariant Variant { get; init; } = FsusThemeVariant.Light;
  public bool HighContrast { get; init; }
  public FsusDensity Density { get; init; } = FsusDensity.Default;
  public FsusMotionMode MotionMode { get; init; } = FsusMotionMode.System;
  public Color? AccentOverride { get; init; }
  public bool FollowSystemTheme { get; init; }
  public FsusTypographyOptions Typography { get; init; } =
    FsusTypographyOptions.Default;
}

public sealed record FsusTypographyOptions
{
  public static FsusTypographyOptions Default { get; } = new();

  public IReadOnlyList<string> ApplicationFontFamilies { get; init; } = [];
  public IReadOnlyList<string> ApplicationMonospaceFontFamilies { get; init; } = [];
  public bool UseSystemFallback { get; init; } = true;
}

public static class FsusThemeResourceKeys
{
  public const string BackgroundBrush = "FsusThemeBackgroundBrush";
  public const string SurfaceBrush = "FsusThemeSurfaceBrush";
  public const string SurfaceRaisedBrush = "FsusThemeSurfaceRaisedBrush";
  public const string TextBrush = "FsusThemeTextBrush";
  public const string MutedTextBrush = "FsusThemeMutedTextBrush";
  public const string BorderBrush = "FsusThemeBorderBrush";
  public const string FocusBrush = "FsusThemeFocusBrush";
  public const string DangerBrush = "FsusThemeDangerBrush";
  public const string DisabledSurfaceBrush = "FsusThemeDisabledSurfaceBrush";
  public const string LoadingBrush = "FsusThemeLoadingBrush";
  public const string DisabledOpacity = "FsusThemeDisabledOpacity";
  public const string FocusThickness = "FsusThemeFocusThickness";
  public const string DensityControlDefaultY = FsusTokens.DensityControlDefaultYResourceKey;
  public const string DensityControlCompactY = FsusTokens.DensityControlCompactYResourceKey;
  public const string MotionModeCurrent = "FsusMotionModeCurrent";
  public const string MotionDurationEffective = "FsusMotionDurationEffective";
  public const string MotionEasingEffective = "FsusMotionEasingEffective";
  public const string BodyFontStack = "FsusTypographyBodyFontStack";
  public const string MonospaceFontStack = "FsusTypographyMonospaceFontStack";
}

public sealed class FsusThemeManager
{
  private const string FocusBorderThicknessResourceKey = "FsusThemeFocusBorderThickness";
  private const string TreeSurfaceResourceKey = "FsusThemeTreeSurfaceBrush";

  private static readonly ThemePalette LightPalette =
    new(
      "#FFFFFF",
      "#FFFFFF",
      "#F8FAFC",
      "#FFFFFF",
      "#111827",
      "#6B7280",
      "#D9DEE8",
      "#2A599C",
      "#2A599C",
      "#D92D20",
      "#F1F5F9",
      "#E8EEF7",
      0.46d,
      2d);

  private static readonly ThemePalette DarkPalette =
    new(
      "#121214",
      "#171F2C",
      "#1F2937",
      "#1B2433",
      "#F0F0F4",
      "#B6C0CF",
      "#394657",
      "#7EA6DA",
      "#4B79CC",
      "#F97066",
      "#202A38",
      "#243043",
      0.5d,
      2d);

  private static readonly ThemePalette HighContrastPalette =
    new(
      "#000000",
      "#000000",
      "#111827",
      "#000000",
      "#FFFFFF",
      "#FDE68A",
      "#FFFFFF",
      "#FFFF00",
      "#FFFF00",
      "#FF6B6B",
      "#1F2937",
      "#1F2937",
      0.72d,
      3d);

  public FsusThemeOptions CurrentOptions { get; private set; } =
    FsusThemeOptions.Default;

  public FsusThemeOptions Apply(Application application, FsusThemeOptions options)
  {
    ArgumentNullException.ThrowIfNull(application);

    var resolved = Apply(application.Resources, options);
    application.RequestedThemeVariant = resolved.FollowSystemTheme
      ? ThemeVariant.Default
      : resolved.Variant == FsusThemeVariant.Dark
        ? ThemeVariant.Dark
        : ThemeVariant.Light;

    return resolved;
  }

  public FsusThemeOptions Apply(IResourceDictionary resources, FsusThemeOptions options)
  {
    ArgumentNullException.ThrowIfNull(resources);
    ArgumentNullException.ThrowIfNull(options);

    var resolved = Normalize(options);
    var palette = resolved.HighContrast
      ? HighContrastPalette
      : resolved.Variant == FsusThemeVariant.Dark
        ? DarkPalette
        : LightPalette;

    ApplyPalette(resources, palette);
    ApplyAccent(resources, resolved.AccentOverride);
    ApplyTypography(resources, resolved.Typography);
    ApplyDensity(resources, resolved.Density);
    ApplyMotion(resources, resolved.MotionMode);

    CurrentOptions = resolved;
    return resolved;
  }

  private static FsusThemeOptions Normalize(FsusThemeOptions options)
  {
    return options with
    {
      Variant = NormalizeEnum(options.Variant, FsusThemeVariant.Light),
      Density = NormalizeEnum(options.Density, FsusDensity.Default),
      MotionMode = NormalizeEnum(options.MotionMode, FsusMotionMode.System),
    };
  }

  private static TEnum NormalizeEnum<TEnum>(TEnum value, TEnum fallback)
    where TEnum : struct, Enum
  {
    return Enum.IsDefined(typeof(TEnum), value) ? value : fallback;
  }

  private static void ApplyPalette(IResourceDictionary resources, ThemePalette palette)
  {
    SetBrush(resources, FsusThemeResourceKeys.BackgroundBrush, palette.Background);
    SetBrush(resources, FsusThemeResourceKeys.SurfaceBrush, palette.Surface);
    SetBrush(resources, FsusThemeResourceKeys.SurfaceRaisedBrush, palette.SurfaceRaised);
    SetBrush(resources, TreeSurfaceResourceKey, palette.TreeSurface);
    SetBrush(resources, FsusThemeResourceKeys.TextBrush, palette.Text);
    SetBrush(resources, FsusThemeResourceKeys.MutedTextBrush, palette.MutedText);
    SetBrush(resources, FsusThemeResourceKeys.BorderBrush, palette.Border);
    SetBrush(resources, FsusThemeResourceKeys.FocusBrush, palette.Focus);
    SetBrush(
      resources,
      FsusTokens.ComponentStateButtonPrimaryBackgroundDefaultResourceKey,
      palette.Text);
    SetBrush(
      resources,
      FsusTokens.ComponentStateButtonPrimaryBackgroundHoverResourceKey,
      palette.PrimaryHover);
    SetBrush(resources, FsusThemeResourceKeys.DangerBrush, palette.Danger);
    SetBrush(
      resources,
      FsusThemeResourceKeys.DisabledSurfaceBrush,
      palette.DisabledSurface);
    SetBrush(resources, FsusThemeResourceKeys.LoadingBrush, palette.Loading);
    resources[FsusThemeResourceKeys.DisabledOpacity] = palette.DisabledOpacity;
    resources[FsusThemeResourceKeys.FocusThickness] = palette.FocusThickness;
    resources[FocusBorderThicknessResourceKey] = new Thickness(palette.FocusThickness);
  }

  private static void ApplyAccent(IResourceDictionary resources, Color? accent)
  {
    if (accent is null)
    {
      return;
    }

    var brush = new SolidColorBrush(accent.Value);
    resources[FsusThemeResourceKeys.FocusBrush] = brush;
    resources[FsusTokens.ColorActionPrimaryBrushResourceKey] = brush;
    resources[FsusTokens.ColorFocusRingBrushResourceKey] = brush;
    resources[FsusTokens.ComponentStateButtonPrimaryBackgroundHoverResourceKey] = brush;
  }

  private static void ApplyDensity(IResourceDictionary resources, FsusDensity density)
  {
    var values = density switch
    {
      FsusDensity.Compact => (DefaultY: 40d, CompactY: 36d),
      FsusDensity.Spacious => (DefaultY: 48d, CompactY: 44d),
      _ => (DefaultY: 44d, CompactY: 40d),
    };

    resources[FsusThemeResourceKeys.DensityControlDefaultY] = values.DefaultY;
    resources[FsusThemeResourceKeys.DensityControlCompactY] = values.CompactY;
  }

  private static void ApplyTypography(
    IResourceDictionary resources,
    FsusTypographyOptions options
  )
  {
    var bodyStack = BuildFontStack(
      options.ApplicationFontFamilies,
      FsusTokens.TypographyFamilyBodyValue,
      options.UseSystemFallback
    );
    var monospaceStack = BuildFontStack(
      options.ApplicationMonospaceFontFamilies,
      FsusTokens.TypographyFamilyMonospaceValue,
      options.UseSystemFallback
    );

    resources[FsusThemeResourceKeys.BodyFontStack] = bodyStack;
    resources[FsusThemeResourceKeys.MonospaceFontStack] = monospaceStack;
    resources[FsusTokens.TypographyFamilyBodyResourceKey] =
      FontFamily.Parse(bodyStack);
    resources[FsusTokens.TypographyFamilyMonospaceResourceKey] =
      FontFamily.Parse(monospaceStack);
  }

  private static string BuildFontStack(
    IReadOnlyList<string> applicationFonts,
    string stableStack,
    bool useSystemFallback
  )
  {
    var families = applicationFonts
      .Where((family) => !string.IsNullOrWhiteSpace(family))
      .Select((family) => family.Trim())
      .ToList();
    if (useSystemFallback)
    {
      families.Add(stableStack);
    }

    return families.Count == 0 ? stableStack : string.Join(", ", families);
  }

  private static void ApplyMotion(IResourceDictionary resources, FsusMotionMode motionMode)
  {
    resources[FsusThemeResourceKeys.MotionModeCurrent] = motionMode switch
    {
      FsusMotionMode.Enabled => "enabled",
      FsusMotionMode.Reduced => "reduced",
      FsusMotionMode.Disabled => "disabled",
      _ => "system",
    };
    resources[FsusThemeResourceKeys.MotionDurationEffective] = motionMode is
      FsusMotionMode.Reduced or FsusMotionMode.Disabled
      ? TimeSpan.FromMilliseconds(1)
      : FsusTokens.MotionDurationControlTimeSpan;
    resources[FsusThemeResourceKeys.MotionEasingEffective] =
      FsusTokens.MotionEasingStandardEasing;
  }

  private static void SetBrush(IResourceDictionary resources, string key, string color)
  {
    resources[key] = new SolidColorBrush(Color.Parse(color));
  }

  private sealed record ThemePalette(
    string Background,
    string Surface,
    string SurfaceRaised,
    string TreeSurface,
    string Text,
    string MutedText,
    string Border,
    string Focus,
    string PrimaryHover,
    string Danger,
    string DisabledSurface,
    string Loading,
    double DisabledOpacity,
    double FocusThickness);
}
