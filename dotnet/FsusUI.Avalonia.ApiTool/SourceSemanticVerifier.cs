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
  private const string ServiceHelperSource =
    "dotnet/FsusUI.Avalonia/Controls/FsusServiceHelperControls.cs";
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
    AssertGenericConstraint(
      current,
      "FsusUI.Avalonia.Controls.FsusServiceHandle`1",
      "TControl",
      "Avalonia.Controls.Control");
    AssertCommand(
      current,
      "FsusUI.Avalonia.Controls.FsusNotificationOptions",
      "ActionCommand",
      nullable: true,
      canWrite: true);
    AssertPseudoClass(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      ":dragging",
      declared: true,
      bound: true);
    AssertClassBinding(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "fsus-size-md",
      "Size");
    AssertClassBinding(
      current,
      "FsusUI.Avalonia.Controls.FsusDropZone",
      "fsus-loading",
      "IsLoading");
    AssertAutomationMapping(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "role",
      "AutomationProperties.SetControlTypeOverride",
      valueKnown: true,
      expectedValue: "Slider",
      expectedExpression: null);
    AssertAutomationMapping(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "name",
      "AutomationProperties.SetName",
      valueKnown: false,
      expectedValue: null,
      expectedExpression: "AccessibleName");
    AssertAutomationMapping(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "value",
      "Avalonia.Automation.Provider.IRangeValueProvider.Value",
      valueKnown: false,
      expectedValue: null,
      expectedExpression: "owner.Value");
    AssertAutomationMapping(
      current,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "state",
      "Avalonia.Automation.Provider.IRangeValueProvider.IsReadOnly",
      valueKnown: false,
      expectedValue: null,
      expectedExpression: "!owner.CanInteract");

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

    var changedPseudoDeclaration = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "[PseudoClasses(\":dragging\", \":disabled\")]",
        "[PseudoClasses(\":pressed\", \":disabled\")]"));
    AssertPseudoClass(
      changedPseudoDeclaration,
      "FsusUI.Avalonia.Controls.FsusSlider",
      ":pressed",
      declared: true,
      bound: false);
    Assert(
      changedPseudoDeclaration.InputTreeHash != current.InputTreeHash,
      "pseudo-class declaration mutation must change inputTreeHash");

    var changedPseudoBinding = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "PseudoClasses.Set(\":dragging\", isDragging);",
        "PseudoClasses.Set(\":pressed\", isDragging);"));
    AssertPseudoClass(
      changedPseudoBinding,
      "FsusUI.Avalonia.Controls.FsusSlider",
      ":pressed",
      declared: false,
      bound: true);
    Assert(
      changedPseudoBinding.InputTreeHash != current.InputTreeHash,
      "pseudo-class binding mutation must change inputTreeHash");

    var changedAutomationRole = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Slider);",
        "AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ProgressBar);"));
    AssertAutomationMapping(
      changedAutomationRole,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "role",
      "AutomationProperties.SetControlTypeOverride",
      valueKnown: true,
      expectedValue: "ProgressBar",
      expectedExpression: null);
    Assert(
      changedAutomationRole.InputTreeHash != current.InputTreeHash,
      "automation role source mutation must change inputTreeHash");

    var removedAutomationName = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "AutomationProperties.SetName(\n      this,\n      string.IsNullOrWhiteSpace(AccessibleName) ? \"Slider\" : AccessibleName);",
        "AutomationProperties.SetHelpText(\n      this,\n      string.IsNullOrWhiteSpace(AccessibleName) ? \"Slider\" : AccessibleName);"));
    AssertNoAutomationMapping(
      removedAutomationName,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "name",
      "AutomationProperties.SetName");
    Assert(
      removedAutomationName.InputTreeHash != current.InputTreeHash,
      "automation name deletion must change inputTreeHash");

    var changedAutomationValue = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "public double Value => owner.Value;",
        "public double Value => owner.Max;"));
    AssertAutomationMapping(
      changedAutomationValue,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "value",
      "Avalonia.Automation.Provider.IRangeValueProvider.Value",
      valueKnown: false,
      expectedValue: null,
      expectedExpression: "owner.Max");
    Assert(
      changedAutomationValue.InputTreeHash != current.InputTreeHash,
      "automation value source mutation must change inputTreeHash");

    var changedAutomationState = WithOverride(
      repoRoot,
      AvaloniaProject,
      SliderSource,
      ReplaceFirst(
        sliderSource,
        "public bool IsReadOnly => !owner.CanInteract;",
        "public bool IsReadOnly => owner.CanInteract;"));
    AssertAutomationMapping(
      changedAutomationState,
      "FsusUI.Avalonia.Controls.FsusSlider",
      "state",
      "Avalonia.Automation.Provider.IRangeValueProvider.IsReadOnly",
      valueKnown: false,
      expectedValue: null,
      expectedExpression: "owner.CanInteract");
    Assert(
      changedAutomationState.InputTreeHash != current.InputTreeHash,
      "automation state source mutation must change inputTreeHash");

    var dropZoneSource = File.ReadAllText(
      Path.Combine(repoRoot, "dotnet/FsusUI.Avalonia/Controls/FsusDropZone.cs"));
    var changedClassCondition = WithOverride(
      repoRoot,
      AvaloniaProject,
      "dotnet/FsusUI.Avalonia/Controls/FsusDropZone.cs",
      ReplaceFirst(
        dropZoneSource,
        "FsusComponentClasses.Ensure(this, \"fsus-loading\", IsLoading);",
        "FsusComponentClasses.Ensure(this, \"fsus-loading\", IsError);"));
    AssertClassBinding(
      changedClassCondition,
      "FsusUI.Avalonia.Controls.FsusDropZone",
      "fsus-loading",
      "IsError");
    Assert(
      changedClassCondition.InputTreeHash != current.InputTreeHash,
      "class-state condition mutation must change inputTreeHash");

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

    var serviceHelperSource = File.ReadAllText(
      Path.Combine(repoRoot, ServiceHelperSource));
    var changedGenericConstraint = WithOverride(
      repoRoot,
      AvaloniaProject,
      ServiceHelperSource,
      ReplaceFirst(
        serviceHelperSource,
        "where TControl : Control",
        "where TControl : ContentControl"));
    AssertGenericConstraint(
      changedGenericConstraint,
      "FsusUI.Avalonia.Controls.FsusServiceHandle`1",
      "TControl",
      "Avalonia.Controls.ContentControl");
    Assert(
      changedGenericConstraint.InputTreeHash != current.InputTreeHash,
      "generic constraint source mutation must change inputTreeHash");

    var changedCommandNullability = WithOverride(
      repoRoot,
      AvaloniaProject,
      ServiceHelperSource,
      ReplaceFirst(
        serviceHelperSource,
        "public ICommand? ActionCommand { get; init; }",
        "public ICommand ActionCommand { get; init; }"));
    AssertCommand(
      changedCommandNullability,
      "FsusUI.Avalonia.Controls.FsusNotificationOptions",
      "ActionCommand",
      nullable: false,
      canWrite: true);
    Assert(
      changedCommandNullability.InputTreeHash != current.InputTreeHash,
      "command source mutation must change inputTreeHash");

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
      "source-semantics verification passed: current literal/default/required/content/generic/command/state/automation metadata and 15 real-source mutations");
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

  private static void AssertGenericConstraint(
    SourceSemanticIndex index,
    string typeName,
    string parameterName,
    string expectedConstraint)
  {
    var parameter = Type(index, typeName).GenericParameters.Single(
      candidate => candidate.Name == parameterName);
    Assert(
      parameter.TypeConstraints.SequenceEqual(
        [expectedConstraint],
        StringComparer.Ordinal),
      $"{typeName}.{parameterName} generic constraint");
  }

  private static void AssertCommand(
    SourceSemanticIndex index,
    string typeName,
    string commandName,
    bool nullable,
    bool canWrite)
  {
    var command = Type(index, typeName).Commands[commandName];
    Assert(command.Nullable == nullable, $"{typeName}.{commandName} nullable");
    Assert(command.CanRead, $"{typeName}.{commandName} canRead");
    Assert(command.CanWrite == canWrite, $"{typeName}.{commandName} canWrite");
    Assert(!command.IsStatic, $"{typeName}.{commandName} isStatic");
  }

  private static void AssertPseudoClass(
    SourceSemanticIndex index,
    string typeName,
    string pseudoClass,
    bool declared,
    bool bound)
  {
    var type = Type(index, typeName);
    Assert(
      type.DeclaredPseudoClasses.Contains(pseudoClass, StringComparer.Ordinal) == declared,
      $"{typeName}.{pseudoClass} pseudo-class declaration");
    Assert(
      type.PseudoClassBindings.Any(binding =>
        binding.NameKnown &&
        binding.Name == pseudoClass) == bound,
      $"{typeName}.{pseudoClass} pseudo-class binding");
  }

  private static void AssertClassBinding(
    SourceSemanticIndex index,
    string typeName,
    string className,
    string condition)
  {
    var binding = Type(index, typeName).ClassBindings.Single(candidate =>
      candidate.NameKnown &&
      candidate.Name == className &&
      candidate.ConditionExpression == condition);
    Assert(binding.Kind.Length > 0, $"{typeName}.{className} class kind");
  }

  private static void AssertAutomationMapping(
    SourceSemanticIndex index,
    string typeName,
    string semantic,
    string provider,
    bool valueKnown,
    object? expectedValue,
    string? expectedExpression)
  {
    var mapping = Type(index, typeName).AutomationMappings.Single(candidate =>
      candidate.Semantic == semantic &&
      candidate.Provider == provider);
    Assert(mapping.ValueKnown == valueKnown, $"{typeName}.{semantic} valueKnown");
    Assert(
      Equals(mapping.Value, expectedValue),
      $"{typeName}.{semantic} automation value");
    Assert(
      expectedExpression is null
        ? mapping.ValueExpression is null
        : mapping.ValueExpression?.Contains(
          expectedExpression,
          StringComparison.Ordinal) == true,
      $"{typeName}.{semantic} automation expression");
    Assert(
      mapping.Authority.StartsWith("roslyn-automation-", StringComparison.Ordinal),
      $"{typeName}.{semantic} automation authority");
  }

  private static void AssertNoAutomationMapping(
    SourceSemanticIndex index,
    string typeName,
    string semantic,
    string provider) =>
    Assert(
      !Type(index, typeName).AutomationMappings.Any(candidate =>
        candidate.Semantic == semantic &&
        candidate.Provider == provider),
      $"{typeName}.{semantic} automation mapping must be absent");

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
