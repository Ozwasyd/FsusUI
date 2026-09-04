namespace FsusUI.Avalonia.ApiTool;

internal static class SourceSemanticVerifier
{
  private const string AvaloniaProject = "dotnet/FsusUI.Avalonia";
  private const string ThemesProject = "dotnet/FsusUI.Avalonia.Themes";
  private const string SliderSource =
    "dotnet/FsusUI.Avalonia/Controls/FsusValuePickerControls.cs";
  private const string ActivityRailSource =
    "dotnet/FsusUI.Avalonia/Controls/FsusActivityRailShell.cs";
  private const string MarkdownEventSource =
    "dotnet/FsusUI.Avalonia/Controls/FsusMarkdownNativeEventMachine.cs";
  private const string ThemeSource =
    "dotnet/FsusUI.Avalonia.Themes/FsusThemeManager.cs";

  public static void Verify(string repoRoot)
  {
    var current = Extract(repoRoot, AvaloniaProject);
    AssertDefault(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "Max",
      known: true,
      expected: 100d);
    AssertDefault(
      current,
      "FsusUI.Avalonia.Controls.FsusShortcutRecorder",
      "ClearCommand",
      known: false,
      expected: null);
    AssertRequired(
      current,
      "FsusUI.Avalonia.Controls.FsusMarkdownNativeEventInput",
      "Kind",
      expected: true);
    AssertContentProperty(
      current,
      "FsusUI.Avalonia.Controls.FsusActivityRailShell",
      "MainContent",
      expected: true);

    var sliderSource = File.ReadAllText(Path.Combine(repoRoot, SliderSource));
    var changedLiteral = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "AvaloniaProperty.Register<FsusSlider, double>(nameof(Max), 100d);",
        "AvaloniaProperty.Register<FsusSlider, double>(nameof(Max), 101d);"));
    AssertDefault(
      changedLiteral,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "Max",
      known: true,
      expected: 101d);
    Assert(
      changedLiteral.InputTreeHash != current.InputTreeHash,
      "literal source mutation must change inputTreeHash");

    var complexDefault = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "AvaloniaProperty.Register<FsusSlider, double>(nameof(Max), 100d);",
        "AvaloniaProperty.Register<FsusSlider, double>(nameof(Max), Math.Max(99d, 100d));"));
    AssertDefault(
      complexDefault,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "Max",
      known: false,
      expected: null);

    var activityRailSource = File.ReadAllText(Path.Combine(repoRoot, ActivityRailSource));
    var removedContentAttribute = WithOverride(
      repoRoot,
      AvaloniaProject,
      ActivityRailSource,
      ReplaceFirst(
        activityRailSource,
        "  [Content]\n  public object? MainContent",
        "  public object? MainContent"));
    AssertContentProperty(
      removedContentAttribute,
      "FsusUI.Avalonia.Controls.FsusActivityRailShell",
      "MainContent",
      expected: false);
    Assert(
      removedContentAttribute.InputTreeHash != current.InputTreeHash,
      "content attribute source mutation must change inputTreeHash");

    var markdownSource = File.ReadAllText(Path.Combine(repoRoot, MarkdownEventSource));
    var removedRequired = WithOverride(
      repoRoot,
      AvaloniaProject,
      MarkdownEventSource,
      ReplaceFirst(
        markdownSource,
        "public required FsusMarkdownNativeEventKind Kind { get; init; }",
        "public FsusMarkdownNativeEventKind Kind { get; init; }"));
    AssertRequired(
      removedRequired,
      "FsusUI.Avalonia.Controls.FsusMarkdownNativeEventInput",
      "Kind",
      expected: false);

    var currentThemes = Extract(repoRoot, ThemesProject);
    AssertClrDefault(
      currentThemes,
      "FsusUI.Avalonia.Themes.FsusTypographyOptions",
      "UseSystemFallback",
      known: true,
      expected: true);
    var themeSource = File.ReadAllText(Path.Combine(repoRoot, ThemeSource));
    var changedClrInitializer = WithOverride(
      repoRoot,
      ThemesProject,
      ThemeSource,
      ReplaceFirst(
        themeSource,
        "public bool UseSystemFallback { get; init; } = true;",
        "public bool UseSystemFallback { get; init; } = false;"));
    AssertClrDefault(
      changedClrInitializer,
      "FsusUI.Avalonia.Themes.FsusTypographyOptions",
      "UseSystemFallback",
      known: true,
      expected: false);

    var complexClrInitializer = WithOverride(
      repoRoot,
      ThemesProject,
      ThemeSource,
      ReplaceFirst(
        themeSource,
        "public bool UseSystemFallback { get; init; } = true;",
        "public bool UseSystemFallback { get; init; } = !string.IsNullOrEmpty(\"FsusUI\");"));
    AssertClrDefault(
      complexClrInitializer,
      "FsusUI.Avalonia.Themes.FsusTypographyOptions",
      "UseSystemFallback",
      known: false,
      expected: null);

    Console.WriteLine(
      "source-semantics verification passed: current literal/default/required/content metadata and 6 real-source mutations");
  }

  private static SourceSemanticIndex Extract(string repoRoot, string project) =>
    SourceSemanticEvaluator.Extract(repoRoot, Path.Combine(repoRoot, project));

  private static SourceSemanticIndex WithOverride(
    string repoRoot,
    string project,
    string relativePath,
    string source) =>
    SourceSemanticEvaluator.Extract(
      repoRoot,
      Path.Combine(repoRoot, project),
      new Dictionary<string, string>(StringComparer.Ordinal)
      {
        [relativePath] = source,
      });

  private static void AssertDefault(
    SourceSemanticIndex index,
    string typeName,
    string propertyName,
    bool known,
    object? expected)
  {
    var property = Type(index, typeName).AvaloniaProperties[propertyName];
    Assert(property.DefaultKnown == known, $"{typeName}.{propertyName} defaultKnown");
    Assert(Equals(property.DefaultValue, expected), $"{typeName}.{propertyName} defaultValue");
  }

  private static void AssertClrDefault(
    SourceSemanticIndex index,
    string typeName,
    string propertyName,
    bool known,
    object? expected)
  {
    var property = Type(index, typeName).Properties[propertyName];
    Assert(property.DefaultKnown == known, $"{typeName}.{propertyName} defaultKnown");
    Assert(Equals(property.DefaultValue, expected), $"{typeName}.{propertyName} defaultValue");
  }

  private static void AssertRequired(
    SourceSemanticIndex index,
    string typeName,
    string propertyName,
    bool expected) =>
    Assert(
      Type(index, typeName).Properties[propertyName].Required == expected,
      $"{typeName}.{propertyName} required");

  private static void AssertContentProperty(
    SourceSemanticIndex index,
    string typeName,
    string propertyName,
    bool expected) =>
    Assert(
      Type(index, typeName).ContentProperties.Contains(
        propertyName,
        StringComparer.Ordinal) == expected,
      $"{typeName}.{propertyName} content property");

  private static SourceTypeSemantics Type(SourceSemanticIndex index, string typeName)
  {
    Assert(index.Types.TryGetValue(typeName, out var type), $"missing source type {typeName}");
    return type!;
  }

  private static string ReplaceFirst(string source, string before, string after)
  {
    var index = source.IndexOf(before, StringComparison.Ordinal);
    Assert(index >= 0, $"real source mutation target not found: {before}");
    return string.Concat(source.AsSpan(0, index), after, source.AsSpan(index + before.Length));
  }

  private static void Assert(bool condition, string message)
  {
    if (!condition)
    {
      throw new InvalidOperationException(message);
    }
  }
}
