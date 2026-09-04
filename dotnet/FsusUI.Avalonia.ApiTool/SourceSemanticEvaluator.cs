using System.Collections.Immutable;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

namespace FsusUI.Avalonia.ApiTool;

internal sealed class SourceSemanticEvaluator
{
  private const string EvaluatorVersion = "source-semantics-v6";

  private static readonly CSharpParseOptions ParseOptions =
    new(languageVersion: LanguageVersion.Latest, documentationMode: DocumentationMode.Parse);

  private static readonly CSharpCompilationOptions CompilationOptions =
    new(OutputKind.DynamicallyLinkedLibrary, nullableContextOptions: NullableContextOptions.Enable);

  private readonly string repoRoot;
  private readonly string projectDirectory;
  private readonly IReadOnlyDictionary<string, string> sourceOverrides;

  private SourceSemanticEvaluator(
    string repoRoot,
    string projectDirectory,
    IReadOnlyDictionary<string, string>? sourceOverrides)
  {
    this.repoRoot = repoRoot;
    this.projectDirectory = projectDirectory;
    this.sourceOverrides = sourceOverrides ?? new Dictionary<string, string>(StringComparer.Ordinal);
  }

  public static SourceSemanticIndex Extract(
    string repoRoot,
    string projectDirectory,
    IReadOnlyDictionary<string, string>? sourceOverrides = null) =>
    new SourceSemanticEvaluator(repoRoot, projectDirectory, sourceOverrides).Extract();

  private SourceSemanticIndex Extract()
  {
    var sourceFiles = EnumerateSourceFiles(projectDirectory).ToList();
    var syntaxTrees = sourceFiles
      .Select(file =>
      {
        var relativePath = NormalizePath(Path.GetRelativePath(repoRoot, file));
        var source = sourceOverrides.TryGetValue(relativePath, out var overridden)
          ? overridden
          : File.ReadAllText(file);
        return CSharpSyntaxTree.ParseText(source, ParseOptions, file);
      })
      .ToList();
    var references = CreateMetadataReferences();
    var compilation = CSharpCompilation.Create(
      $"FsusUI.Avalonia.ApiTool.SourceSemantics.{Path.GetFileName(projectDirectory)}",
      syntaxTrees,
      references.Select(reference => reference.Reference),
      CompilationOptions);

    var types = new Dictionary<string, MutableSourceTypeSemantics>(StringComparer.Ordinal);
    IndexTypeSemantics(compilation.Assembly.GlobalNamespace, types);
    var automationPeerOwners = IndexAutomationPeerOwners(compilation, syntaxTrees);
    foreach (var tree in syntaxTrees)
    {
      var model = compilation.GetSemanticModel(tree);
      var root = tree.GetRoot();
      foreach (var property in root.DescendantNodes().OfType<PropertyDeclarationSyntax>())
      {
        if (model.GetDeclaredSymbol(property) is not IPropertySymbol symbol)
        {
          continue;
        }

        var type = GetOrCreate(types, ReflectionTypeName(symbol.ContainingType));
        var defaultValue = EvaluateConstant(model, property.Initializer?.Value, symbol.Type);
        type.Properties[symbol.Name] = new SourcePropertySemantics
        {
          Required = symbol.IsRequired,
          DefaultKnown = defaultValue.Known,
          DefaultValue = defaultValue.Value,
        };
        IndexAutomationProviderProperty(
          model,
          property,
          symbol,
          automationPeerOwners,
          types);
      }

      foreach (var field in root.DescendantNodes().OfType<FieldDeclarationSyntax>())
      {
        foreach (var variable in field.Declaration.Variables)
        {
          if (variable.Initializer?.Value is not InvocationExpressionSyntax invocation ||
              model.GetDeclaredSymbol(variable) is not IFieldSymbol symbol ||
              !TryAvaloniaPropertyKind(symbol.Type, out var kind))
          {
            continue;
          }

          var propertyName = PropertyNameFromField(symbol.Name);
          var defaultValue = KnownConstant.Unknown;
          if (model.GetOperation(invocation) is IInvocationOperation operation &&
              IsAvaloniaRegistration(operation.TargetMethod))
          {
            propertyName = RegistrationPropertyName(model, operation, symbol.Name);
            defaultValue = RegistrationDefault(operation);
          }
          var type = GetOrCreate(types, ReflectionTypeName(symbol.ContainingType));
          type.AvaloniaProperties[propertyName] = new SourceAvaloniaPropertySemantics
          {
            Kind = kind,
            DefaultKnown = defaultValue.Known,
            DefaultValue = defaultValue.Value,
          };
        }
      }

      foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
      {
        if (model.GetOperation(invocation) is not IInvocationOperation operation ||
            model.GetEnclosingSymbol(invocation.SpanStart)?.ContainingType is not { } containingType)
        {
          continue;
        }

        var type = GetOrCreate(types, ReflectionTypeName(containingType));
        IndexStateMutation(compilation, model, operation, type);
        IndexAutomationPropertyWrite(
          model,
          operation,
          containingType,
          automationPeerOwners,
          types);
      }
    }

    var inputFiles = sourceFiles
      .Concat(RequiredInputFiles())
      .Concat(TokenThemeSemanticEvaluator.InputFiles(repoRoot, projectDirectory))
      .Distinct(StringComparer.Ordinal)
      .OrderBy(file => NormalizePath(Path.GetRelativePath(repoRoot, file)), StringComparer.Ordinal)
      .ToList();
    return new SourceSemanticIndex
    {
      Types = types.ToDictionary(
        pair => pair.Key,
        pair => new SourceTypeSemantics
        {
          Properties = pair.Value.Properties,
          AvaloniaProperties = pair.Value.AvaloniaProperties,
          GenericParameters = pair.Value.GenericParameters,
          Commands = pair.Value.Commands,
          DeclaredPseudoClasses = pair.Value.DeclaredPseudoClasses
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList(),
          PseudoClassBindings = pair.Value.PseudoClassBindings
            .OrderBy(StateBindingSortKey, StringComparer.Ordinal)
            .ToList(),
          ClassBindings = pair.Value.ClassBindings
            .OrderBy(StateBindingSortKey, StringComparer.Ordinal)
            .ToList(),
          AutomationMappings = pair.Value.AutomationMappings
            .OrderBy(AutomationMappingSortKey, StringComparer.Ordinal)
            .ToList(),
          ContentProperties = pair.Value.ContentProperties
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList(),
        },
        StringComparer.Ordinal),
      TokenThemeContract = TokenThemeSemanticEvaluator.Extract(
        repoRoot,
        projectDirectory,
        compilation,
        syntaxTrees,
        sourceOverrides),
      InputTreeHash = HashFiles(inputFiles),
      CompilerOptionsHash = HashText(
        string.Join(
          "\n",
          EvaluatorVersion,
          $"roslyn={typeof(CSharpCompilation).Assembly.GetName().Version}",
          $"languageVersion={ParseOptions.LanguageVersion}",
          $"documentationMode={ParseOptions.DocumentationMode}",
          $"nullable={CompilationOptions.NullableContextOptions}",
          $"outputKind={CompilationOptions.OutputKind}")),
      DependencyVersionsHash = HashText(
        string.Join(
          "\n",
          references
            .Select(reference => reference.Identity)
            .OrderBy(identity => identity, StringComparer.Ordinal))),
    };
  }

  private List<MetadataReferenceIdentity> CreateMetadataReferences()
  {
    var paths = new HashSet<string>(StringComparer.Ordinal);
    var trustedPlatformAssemblies =
      AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string ?? string.Empty;
    foreach (var path in trustedPlatformAssemblies.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
    {
      paths.Add(path);
    }

    foreach (var path in Directory.EnumerateFiles(AppContext.BaseDirectory, "*.dll"))
    {
      paths.Add(path);
    }

    var references = new List<MetadataReferenceIdentity>();
    foreach (var path in paths.OrderBy(path => path, StringComparer.Ordinal))
    {
      try
      {
        var name = AssemblyName.GetAssemblyName(path);
        var token = name.GetPublicKeyToken();
        references.Add(new MetadataReferenceIdentity
        {
          Reference = MetadataReference.CreateFromFile(path),
          Identity = string.Join(
            "|",
            name.Name,
            name.Version,
            name.CultureName ?? string.Empty,
            token is { Length: > 0 } ? Convert.ToHexString(token).ToLowerInvariant() : string.Empty),
        });
      }
      catch (BadImageFormatException)
      {
        // Native/runtime support binaries are not compiler metadata references.
      }
    }

    return references;
  }

  private IEnumerable<string> RequiredInputFiles()
  {
    var relativePaths = new[]
    {
      "dotnet/Directory.Build.props",
      "dotnet/Directory.Packages.props",
      "dotnet/FsusUI.Avalonia.ApiTool/FsusUI.Avalonia.ApiTool.csproj",
      "dotnet/FsusUI.Avalonia.ApiTool/packages.lock.json",
      "dotnet/FsusUI.Avalonia.ApiTool/Program.cs",
      "dotnet/FsusUI.Avalonia.ApiTool/SourceSemanticEvaluator.cs",
      "dotnet/FsusUI.Avalonia.ApiTool/SourceSemanticVerifier.cs",
      NormalizePath(Path.GetRelativePath(repoRoot, Path.Combine(projectDirectory, $"{Path.GetFileName(projectDirectory)}.csproj"))),
      NormalizePath(Path.GetRelativePath(repoRoot, Path.Combine(projectDirectory, "packages.lock.json"))),
    };
    foreach (var relativePath in relativePaths.Distinct(StringComparer.Ordinal))
    {
      var path = Path.Combine(repoRoot, relativePath);
      if (File.Exists(path))
      {
        yield return path;
      }
    }
  }

  private static IEnumerable<string> EnumerateSourceFiles(string directory) =>
    Directory
      .EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories)
      .Where(path =>
        !path.Split(Path.DirectorySeparatorChar).Contains("bin", StringComparer.Ordinal) &&
        !path.Split(Path.DirectorySeparatorChar).Contains("obj", StringComparer.Ordinal))
      .OrderBy(path => path, StringComparer.Ordinal);

  private string HashFiles(IEnumerable<string> files)
  {
    using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    foreach (var file in files)
    {
      var relativePath = NormalizePath(Path.GetRelativePath(repoRoot, file));
      var source = sourceOverrides.TryGetValue(relativePath, out var overridden)
        ? overridden
        : File.ReadAllText(file);
      Append(hash, relativePath);
      Append(hash, "\0");
      Append(hash, source.Replace("\r\n", "\n", StringComparison.Ordinal));
      Append(hash, "\0");
    }

    return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
  }

  private static string HashText(string value) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

  private static void Append(IncrementalHash hash, string value) =>
    hash.AppendData(Encoding.UTF8.GetBytes(value));

  private static MutableSourceTypeSemantics GetOrCreate(
    Dictionary<string, MutableSourceTypeSemantics> types,
    string name)
  {
    if (!types.TryGetValue(name, out var type))
    {
      type = new MutableSourceTypeSemantics();
      types.Add(name, type);
    }

    return type;
  }

  private static void IndexTypeSemantics(
    INamespaceSymbol @namespace,
    Dictionary<string, MutableSourceTypeSemantics> types)
  {
    foreach (var childNamespace in @namespace.GetNamespaceMembers())
    {
      IndexTypeSemantics(childNamespace, types);
    }

    foreach (var type in @namespace.GetTypeMembers())
    {
      IndexTypeSemantics(type, types);
    }
  }

  private static void IndexTypeSemantics(
    INamedTypeSymbol typeSymbol,
    Dictionary<string, MutableSourceTypeSemantics> types)
  {
    if (typeSymbol.Locations.Any(location => location.IsInSource))
    {
      var type = GetOrCreate(types, ReflectionTypeName(typeSymbol));
      foreach (var attribute in typeSymbol.GetAttributes().Where(attribute =>
        attribute.AttributeClass?.ToDisplayString(
          SymbolDisplayFormat.CSharpErrorMessageFormat) ==
        "Avalonia.Controls.Metadata.PseudoClassesAttribute"))
      {
        foreach (var argument in attribute.ConstructorArguments)
        {
          foreach (var value in argument.Values)
          {
            if (value.Value is string pseudoClass)
            {
              type.DeclaredPseudoClasses.Add(pseudoClass);
            }
          }
        }
      }
      type.GenericParameters.AddRange(
        typeSymbol.TypeParameters
          .OrderBy(parameter => parameter.Ordinal)
          .Select(GenericParameterSemantics));
      foreach (var property in typeSymbol.GetMembers().OfType<IPropertySymbol>())
      {
        if (!property.Locations.Any(location => location.IsInSource))
        {
          continue;
        }

        type.Properties[property.Name] = new SourcePropertySemantics
        {
          Required = property.IsRequired,
          DefaultKnown = false,
        };
        if (HasContentAttribute(property))
        {
          type.ContentProperties.Add(property.Name);
        }
        if (property.DeclaredAccessibility == Accessibility.Public &&
            IsCommandType(property.Type))
        {
          type.Commands[property.Name] = new SourceCommandSemantics
          {
            Nullable = property.NullableAnnotation switch
            {
              NullableAnnotation.Annotated => true,
              NullableAnnotation.NotAnnotated => false,
              _ => null,
            },
            CanRead = property.GetMethod?.DeclaredAccessibility == Accessibility.Public,
            CanWrite = property.SetMethod?.DeclaredAccessibility == Accessibility.Public,
            IsStatic = property.IsStatic,
          };
        }
      }
    }

    foreach (var nestedType in typeSymbol.GetTypeMembers())
    {
      IndexTypeSemantics(nestedType, types);
    }
  }

  private static SourceGenericParameterSemantics GenericParameterSemantics(
    ITypeParameterSymbol parameter) =>
    new()
    {
      Name = parameter.Name,
      Position = parameter.Ordinal,
      Variance = parameter.Variance switch
      {
        VarianceKind.In => "in",
        VarianceKind.Out => "out",
        _ => "none",
      },
      ReferenceTypeConstraint = parameter.HasReferenceTypeConstraint,
      ReferenceTypeConstraintNullable =
        parameter.HasReferenceTypeConstraint
          ? parameter.ReferenceTypeConstraintNullableAnnotation ==
            NullableAnnotation.Annotated
          : null,
      ValueTypeConstraint = parameter.HasValueTypeConstraint,
      UnmanagedTypeConstraint = parameter.HasUnmanagedTypeConstraint,
      NotNullConstraint = parameter.HasNotNullConstraint,
      ConstructorConstraint = parameter.HasConstructorConstraint,
      TypeConstraints = parameter.ConstraintTypes
        .Select(TypeName)
        .OrderBy(name => name, StringComparer.Ordinal)
        .ToList(),
    };

  private static Dictionary<INamedTypeSymbol, INamedTypeSymbol>
    IndexAutomationPeerOwners(
      Compilation compilation,
      IEnumerable<SyntaxTree> syntaxTrees)
  {
    var owners = new Dictionary<INamedTypeSymbol, INamedTypeSymbol>(
      SymbolEqualityComparer.Default);
    var ambiguous = new HashSet<INamedTypeSymbol>(SymbolEqualityComparer.Default);
    foreach (var tree in syntaxTrees)
    {
      var model = compilation.GetSemanticModel(tree);
      foreach (var method in tree.GetRoot()
        .DescendantNodes()
        .OfType<MethodDeclarationSyntax>())
      {
        if (model.GetDeclaredSymbol(method) is not IMethodSymbol
          {
            Name: "OnCreateAutomationPeer",
          } methodSymbol ||
            methodSymbol.ContainingType.DeclaredAccessibility != Accessibility.Public)
        {
          continue;
        }

        foreach (var creation in method.DescendantNodesAndSelf()
          .OfType<ObjectCreationExpressionSyntax>())
        {
          if (model.GetOperation(creation) is not IObjectCreationOperation
            {
              Type: INamedTypeSymbol peerType,
            } ||
              !DerivesFrom(peerType, "Avalonia.Automation.Peers.AutomationPeer"))
          {
            continue;
          }

          if (owners.TryGetValue(peerType, out var existingOwner) &&
              !SymbolEqualityComparer.Default.Equals(
                existingOwner,
                methodSymbol.ContainingType))
          {
            ambiguous.Add(peerType);
            owners.Remove(peerType);
            continue;
          }
          if (!ambiguous.Contains(peerType))
          {
            owners[peerType] = methodSymbol.ContainingType;
          }
        }
      }
    }
    return owners;
  }

  private static bool DerivesFrom(INamedTypeSymbol type, string baseTypeName)
  {
    for (var current = type; current is not null; current = current.BaseType)
    {
      if (current.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat) ==
          baseTypeName)
      {
        return true;
      }
    }
    return false;
  }

  private static void IndexAutomationProviderProperty(
    SemanticModel model,
    PropertyDeclarationSyntax declaration,
    IPropertySymbol property,
    IReadOnlyDictionary<INamedTypeSymbol, INamedTypeSymbol> peerOwners,
    Dictionary<string, MutableSourceTypeSemantics> types)
  {
    if (!peerOwners.TryGetValue(property.ContainingType, out var ownerType) ||
        AutomationProviderSemantic(property) is not
        { } providerSemantic)
    {
      return;
    }

    var operation = PropertyValueOperation(model, declaration);
    var value = EvaluateOperationValue(operation, property.Type);
    GetOrCreate(types, ReflectionTypeName(ownerType)).AutomationMappings.Add(
      new SourceAutomationMappingSemantics
      {
        Semantic = providerSemantic.Semantic,
        Provider = providerSemantic.Provider,
        Authority = "roslyn-automation-provider-interface",
        TargetKind = "automation-peer-owner",
        TargetExpression = "OnCreateAutomationPeer:this",
        ValueKnown = value.Known,
        Value = value.Value,
        ValueExpression =
          value.Known
            ? null
            : NormalizedExpression(operation) ??
              declaration.NormalizeWhitespace().ToFullString(),
        PublicDependencies = AutomationPublicDependencies(operation),
        SourceMember =
          $"{ReflectionTypeName(property.ContainingType)}.{property.Name}",
      });
  }

  private static (string Semantic, string Provider)?
    AutomationProviderSemantic(IPropertySymbol property)
  {
    foreach (var contract in property.ContainingType.AllInterfaces
      .OrderBy(
        item => item.ToDisplayString(
          SymbolDisplayFormat.CSharpErrorMessageFormat),
        StringComparer.Ordinal))
    {
      var contractName = contract.ToDisplayString(
        SymbolDisplayFormat.CSharpErrorMessageFormat);
      foreach (var contractProperty in contract.GetMembers()
        .OfType<IPropertySymbol>()
        .Where(member => member.Name == property.Name))
      {
        if (!SymbolEqualityComparer.Default.Equals(
          property.ContainingType.FindImplementationForInterfaceMember(
            contractProperty),
          property))
        {
          continue;
        }

        var semantic = (contractName, contractProperty.Name) switch
        {
          ("Avalonia.Automation.Provider.IValueProvider", "Value") => "value",
          ("Avalonia.Automation.Provider.IRangeValueProvider", "Value") => "value",
          ("Avalonia.Automation.Provider.IValueProvider", "IsReadOnly") => "state",
          ("Avalonia.Automation.Provider.IRangeValueProvider", "IsReadOnly") => "state",
          ("Avalonia.Automation.Provider.ISelectionItemProvider", "IsSelected") => "state",
          ("Avalonia.Automation.Provider.IExpandCollapseProvider", "ExpandCollapseState") => "state",
          ("Avalonia.Automation.Provider.IToggleProvider", "ToggleState") => "state",
          ("Avalonia.Automation.Provider.ISelectionProvider", "CanSelectMultiple") => "state",
          ("Avalonia.Automation.Provider.ISelectionProvider", "IsSelectionRequired") => "state",
          _ => null,
        };
        if (semantic is not null)
        {
          return (semantic, $"{contractName}.{contractProperty.Name}");
        }
      }
    }
    return null;
  }

  private static IOperation? PropertyValueOperation(
    SemanticModel model,
    PropertyDeclarationSyntax declaration)
  {
    if (declaration.ExpressionBody?.Expression is { } expression)
    {
      return model.GetOperation(expression);
    }
    var getter = declaration.AccessorList?.Accessors.FirstOrDefault(
      accessor => accessor.IsKind(SyntaxKind.GetAccessorDeclaration));
    if (getter?.ExpressionBody?.Expression is { } getterExpression)
    {
      return model.GetOperation(getterExpression);
    }
    var returnExpression = getter?.Body?.DescendantNodes()
      .OfType<ReturnStatementSyntax>()
      .Select(statement => statement.Expression)
      .FirstOrDefault(expression => expression is not null);
    return returnExpression is null ? null : model.GetOperation(returnExpression);
  }

  private static bool IsCommandType(ITypeSymbol type) =>
    TypeName(type) == "System.Windows.Input.ICommand" ||
    type is INamedTypeSymbol named &&
    named.AllInterfaces.Any(
      contract => TypeName(contract) == "System.Windows.Input.ICommand");

  private static string TypeName(ITypeSymbol type) =>
    type
      .WithNullableAnnotation(NullableAnnotation.NotAnnotated)
      .ToDisplayString(
        new SymbolDisplayFormat(
          globalNamespaceStyle: SymbolDisplayGlobalNamespaceStyle.Omitted,
          typeQualificationStyle:
            SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces,
          genericsOptions: SymbolDisplayGenericsOptions.IncludeTypeParameters));

  private static void IndexStateMutation(
    Compilation compilation,
    SemanticModel model,
    IInvocationOperation operation,
    MutableSourceTypeSemantics type)
  {
    var targetType = operation.TargetMethod.ContainingType.ToDisplayString(
      SymbolDisplayFormat.CSharpErrorMessageFormat);
    if (targetType == "FsusUI.Avalonia.Controls.FsusComponentClasses")
    {
      var control = Argument(operation, "control");
      if (!IsContainingInstance(control?.Value))
      {
        return;
      }

      var sourceMember = SourceMember(model, operation);
      switch (operation.TargetMethod.Name)
      {
        case "SetBaseClasses":
          AddStateBinding(
            type.ClassBindings,
            "class",
            "add",
            Argument(operation, "baseClass")?.Value,
            condition: null,
            sourceMember,
            provider: operation.TargetMethod.Name);
          foreach (var className in HelperClassNames(compilation, operation.TargetMethod))
          {
            AddKnownStateBinding(
              type.ClassBindings,
              "class",
              "add",
              className,
              condition: null,
              sourceMember,
              operation.TargetMethod.Name);
          }
          return;
        case "Ensure":
          AddStateBinding(
            type.ClassBindings,
            "class",
            "set",
            Argument(operation, "className")?.Value,
            Argument(operation, "enabled")?.Value,
            sourceMember,
            provider: operation.TargetMethod.Name);
          return;
        case "SyncVariant":
        case "SyncSize":
        case "SyncIconPlacement":
          var controller = operation.Arguments
            .FirstOrDefault(argument => argument.Parameter?.Name != "control")
            ?.Value;
          foreach (var className in HelperClassNames(compilation, operation.TargetMethod))
          {
            AddKnownStateBinding(
              type.ClassBindings,
              "class-family",
              "select",
              className,
              controller,
              sourceMember,
              operation.TargetMethod.Name);
          }
          return;
      }
    }

    var pseudoClasses = operation.Instance ??
      operation.Arguments.FirstOrDefault(
        argument => argument.Parameter?.Name is "classes" or "pseudoClasses")
        ?.Value;
    if (operation.TargetMethod.Name == "Set" &&
        IsContainingInstanceCollection(pseudoClasses, "PseudoClasses"))
    {
      AddStateBinding(
        type.PseudoClassBindings,
        "pseudo-class",
        "set",
        Argument(operation, "name")?.Value ??
          operation.Arguments.ElementAtOrDefault(1)?.Value,
        Argument(operation, "value")?.Value ??
          operation.Arguments.ElementAtOrDefault(2)?.Value,
        SourceMember(model, operation),
        provider: "PseudoClasses.Set");
      return;
    }

    if (operation.TargetMethod.Name is "Add" or "Remove" &&
        IsContainingInstanceCollection(operation.Instance, "Classes"))
    {
      AddStateBinding(
        type.ClassBindings,
        "class",
        operation.TargetMethod.Name.ToLowerInvariant(),
        operation.Arguments.ElementAtOrDefault(0)?.Value,
        condition: null,
        SourceMember(model, operation),
        provider: $"Classes.{operation.TargetMethod.Name}");
    }
  }

  private static void IndexAutomationPropertyWrite(
    SemanticModel model,
    IInvocationOperation operation,
    INamedTypeSymbol containingType,
    IReadOnlyDictionary<INamedTypeSymbol, INamedTypeSymbol> peerOwners,
    Dictionary<string, MutableSourceTypeSemantics> types)
  {
    if (operation.TargetMethod.ContainingType.ToDisplayString(
          SymbolDisplayFormat.CSharpErrorMessageFormat) !=
        "Avalonia.Automation.AutomationProperties")
    {
      return;
    }

    var semantic = operation.TargetMethod.Name switch
    {
      "SetControlTypeOverride" => "role",
      "SetName" => "name",
      "SetItemStatus" => "state",
      "SetHelpText" => "help-text",
      "SetAccessibilityView" => "accessibility-view",
      "SetLiveSetting" => "live-setting",
      _ => null,
    };
    if (semantic is null ||
        AutomationOwner(containingType, peerOwners) is not { } ownerType)
    {
      return;
    }

    var target = operation.Arguments
      .OrderBy(argument => argument.Parameter?.Ordinal ?? int.MaxValue)
      .FirstOrDefault()?.Value;
    var valueArgument = operation.Arguments
      .OrderBy(argument => argument.Parameter?.Ordinal ?? int.MaxValue)
      .Skip(1)
      .FirstOrDefault();
    if (target is null || valueArgument is null)
    {
      return;
    }

    var value = EvaluateOperationValue(
      valueArgument.Value,
      valueArgument.Parameter?.Type);
    GetOrCreate(types, ReflectionTypeName(ownerType)).AutomationMappings.Add(
      new SourceAutomationMappingSemantics
      {
        Semantic = semantic,
        Provider = $"AutomationProperties.{operation.TargetMethod.Name}",
        Authority = "roslyn-automation-attached-property-write",
        TargetKind =
          IsContainingInstance(target)
            ? "public-control-this"
            : peerOwners.ContainsKey(containingType)
              ? "automation-peer-owned-element"
              : "owned-element-expression",
        TargetExpression = NormalizedExpression(target),
        ValueKnown = value.Known,
        Value = value.Value,
        ValueExpression =
          value.Known
            ? null
            : NormalizedExpression(valueArgument.Value),
        PublicDependencies = AutomationPublicDependencies(valueArgument.Value),
        SourceMember =
          $"{ReflectionTypeName(containingType)}." +
          $"{model.GetEnclosingSymbol(operation.Syntax.SpanStart)?.Name ?? "<unknown>"}",
      });
  }

  private static INamedTypeSymbol? AutomationOwner(
    INamedTypeSymbol containingType,
    IReadOnlyDictionary<INamedTypeSymbol, INamedTypeSymbol> peerOwners)
  {
    if (peerOwners.TryGetValue(containingType, out var peerOwner))
    {
      return peerOwner;
    }

    for (var current = containingType; current is not null; current = current.ContainingType)
    {
      if (current.DeclaredAccessibility == Accessibility.Public)
      {
        return current;
      }
    }
    return null;
  }

  private static IArgumentOperation? Argument(
    IInvocationOperation operation,
    string name) =>
    operation.Arguments.FirstOrDefault(argument => argument.Parameter?.Name == name);

  private static bool IsContainingInstance(IOperation? operation)
  {
    while (operation is IConversionOperation conversion)
    {
      operation = conversion.Operand;
    }
    return operation is IInstanceReferenceOperation
    {
      ReferenceKind:
        InstanceReferenceKind.ContainingTypeInstance or
        InstanceReferenceKind.ImplicitReceiver,
    };
  }

  private static bool IsContainingInstanceCollection(
    IOperation? operation,
    string propertyName)
  {
    while (operation is IConversionOperation conversion)
    {
      operation = conversion.Operand;
    }
    return operation is IPropertyReferenceOperation property &&
      property.Property.Name == propertyName &&
      IsContainingInstance(property.Instance);
  }

  private static void AddStateBinding(
    List<SourceStateBindingSemantics> bindings,
    string kind,
    string action,
    IOperation? name,
    IOperation? condition,
    string sourceMember,
    string provider)
  {
    var constant = name?.ConstantValue;
    bindings.Add(new SourceStateBindingSemantics
    {
      Kind = kind,
      Action = action,
      NameKnown = constant is { HasValue: true, Value: string },
      Name = constant is { HasValue: true, Value: string value } ? value : null,
      NameExpression =
        constant is { HasValue: true, Value: string }
          ? null
          : NormalizedExpression(name),
      ConditionExpression = NormalizedExpression(condition),
      PublicDependencies = PublicDependencies(condition),
      SourceMember = sourceMember,
      Provider = provider,
    });
  }

  private static void AddKnownStateBinding(
    List<SourceStateBindingSemantics> bindings,
    string kind,
    string action,
    string name,
    IOperation? condition,
    string sourceMember,
    string provider) =>
    bindings.Add(new SourceStateBindingSemantics
    {
      Kind = kind,
      Action = action,
      NameKnown = true,
      Name = name,
      ConditionExpression = NormalizedExpression(condition),
      PublicDependencies = PublicDependencies(condition),
      SourceMember = sourceMember,
      Provider = provider,
    });

  private static string? NormalizedExpression(IOperation? operation) =>
    operation?.Syntax.NormalizeWhitespace().ToFullString();

  private static List<string> PublicDependencies(IOperation? operation) =>
    operation is null
      ? []
      : Walk(operation)
        .Select(node => node switch
        {
          IPropertyReferenceOperation property
            when property.Property.DeclaredAccessibility == Accessibility.Public =>
            $"{ReflectionTypeName(property.Property.ContainingType)}.{property.Property.Name}",
          IFieldReferenceOperation field
            when field.Field.DeclaredAccessibility == Accessibility.Public =>
            $"{ReflectionTypeName(field.Field.ContainingType)}.{field.Field.Name}",
          _ => null,
        })
        .Where(name => name is not null)
        .Cast<string>()
        .Distinct(StringComparer.Ordinal)
        .OrderBy(name => name, StringComparer.Ordinal)
        .ToList();

  private static List<string> AutomationPublicDependencies(IOperation? operation) =>
    PublicDependencies(operation)
      .Where(name => name.StartsWith("FsusUI.", StringComparison.Ordinal))
      .ToList();

  private static IEnumerable<IOperation> Walk(IOperation operation)
  {
    yield return operation;
    foreach (var child in operation.ChildOperations)
    {
      foreach (var descendant in Walk(child))
      {
        yield return descendant;
      }
    }
  }

  private static string SourceMember(
    SemanticModel model,
    IInvocationOperation operation) =>
    model.GetEnclosingSymbol(operation.Syntax.SpanStart)?.Name ?? "<unknown>";

  private static List<string> HelperClassNames(
    Compilation compilation,
    IMethodSymbol helper)
  {
    var names = new HashSet<string>(StringComparer.Ordinal);
    foreach (var syntaxReference in helper.DeclaringSyntaxReferences)
    {
      var syntax = syntaxReference.GetSyntax();
      var model = compilation.GetSemanticModel(syntax.SyntaxTree);
      foreach (var expression in syntax.DescendantNodesAndSelf().OfType<ExpressionSyntax>())
      {
        if (model.GetConstantValue(expression) is { HasValue: true, Value: string value })
        {
          names.Add(value);
        }
      }
      if (model.GetOperation(syntax) is not { } operation)
      {
        continue;
      }
      foreach (var field in Walk(operation)
        .OfType<IFieldReferenceOperation>()
        .Select(reference => reference.Field)
        .Distinct<IFieldSymbol>(SymbolEqualityComparer.Default))
      {
        foreach (var fieldReference in field.DeclaringSyntaxReferences)
        {
          var fieldSyntax = fieldReference.GetSyntax();
          var fieldModel = compilation.GetSemanticModel(fieldSyntax.SyntaxTree);
          foreach (var expression in fieldSyntax.DescendantNodesAndSelf().OfType<ExpressionSyntax>())
          {
            if (fieldModel.GetConstantValue(expression) is
              { HasValue: true, Value: string value })
            {
              names.Add(value);
            }
          }
        }
      }
    }
    return names.OrderBy(name => name, StringComparer.Ordinal).ToList();
  }

  private static string StateBindingSortKey(SourceStateBindingSemantics binding) =>
    string.Join(
      "\0",
      binding.Kind,
      binding.NameKnown ? binding.Name : binding.NameExpression,
      binding.Action,
      binding.ConditionExpression,
      binding.SourceMember,
      binding.Provider);

  private static string AutomationMappingSortKey(
    SourceAutomationMappingSemantics mapping) =>
    string.Join(
      "\0",
      mapping.Semantic,
      mapping.Provider,
      mapping.TargetKind,
      mapping.TargetExpression,
      mapping.ValueKnown ? mapping.Value : mapping.ValueExpression,
      mapping.SourceMember);

  private static string ReflectionTypeName(INamedTypeSymbol type)
  {
    var containingTypes = new Stack<string>();
    for (var current = type; current is not null; current = current.ContainingType)
    {
      containingTypes.Push(current.MetadataName);
    }

    var namespaceName = type.ContainingNamespace.IsGlobalNamespace
      ? string.Empty
      : type.ContainingNamespace.ToDisplayString();
    return namespaceName.Length == 0
      ? string.Join("+", containingTypes)
      : $"{namespaceName}.{string.Join("+", containingTypes)}";
  }

  private static bool HasContentAttribute(IPropertySymbol property) =>
    property.GetAttributes().Any(attribute =>
      attribute.AttributeClass?.ToDisplayString(
        SymbolDisplayFormat.CSharpErrorMessageFormat) ==
      "Avalonia.Metadata.ContentAttribute");

  private static bool TryAvaloniaPropertyKind(ITypeSymbol type, out string kind)
  {
    var originalDefinition = type is INamedTypeSymbol named
      ? named.OriginalDefinition.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat)
      : string.Empty;
    kind = originalDefinition switch
    {
      "Avalonia.StyledProperty<TValue>" => "styled",
      "Avalonia.DirectProperty<TOwner, TValue>" => "direct",
      _ => string.Empty,
    };
    return kind.Length > 0;
  }

  private static bool IsAvaloniaRegistration(IMethodSymbol method) =>
    method.Name is "Register" or "RegisterAttached" or "RegisterDirect" &&
    method.ContainingType.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat) ==
      "Avalonia.AvaloniaProperty";

  private static string RegistrationPropertyName(
    SemanticModel model,
    IInvocationOperation operation,
    string fieldName)
  {
    var nameArgument = operation.Arguments.FirstOrDefault(
      argument => argument.Parameter?.Name == "name");
    if (nameArgument?.Syntax is ArgumentSyntax argument &&
        model.GetConstantValue(argument.Expression) is { HasValue: true, Value: string name })
    {
      return name;
    }

    return fieldName.EndsWith("Property", StringComparison.Ordinal)
      ? PropertyNameFromField(fieldName)
      : fieldName;
  }

  private static string PropertyNameFromField(string fieldName) =>
    fieldName.EndsWith("Property", StringComparison.Ordinal)
      ? fieldName[..^"Property".Length]
      : fieldName;

  private static KnownConstant RegistrationDefault(IInvocationOperation operation)
  {
    var argument = operation.Arguments.FirstOrDefault(
      candidate => candidate.Parameter?.Name == "defaultValue");
    if (argument is null)
    {
      return KnownConstant.Unknown;
    }

    var constant = argument.Value.ConstantValue;
    if (!constant.HasValue)
    {
      return KnownConstant.Unknown;
    }

    return EncodeConstant(constant.Value, argument.Parameter?.Type);
  }

  private static KnownConstant EvaluateConstant(
    SemanticModel model,
    ExpressionSyntax? expression,
    ITypeSymbol targetType)
  {
    if (expression is null)
    {
      return KnownConstant.Unknown;
    }

    var constant = model.GetConstantValue(expression);
    return constant.HasValue
      ? EncodeConstant(constant.Value, targetType)
      : KnownConstant.Unknown;
  }

  private static KnownConstant EvaluateOperationValue(
    IOperation? operation,
    ITypeSymbol? targetType)
  {
    while (operation is IConversionOperation conversion)
    {
      operation = conversion.Operand;
    }
    if (operation is null)
    {
      return KnownConstant.Unknown;
    }

    if (operation is IFieldReferenceOperation
      {
        Field.ContainingType.TypeKind: Microsoft.CodeAnalysis.TypeKind.Enum,
      } field)
    {
      return new KnownConstant(true, field.Field.Name);
    }
    if (operation.ConstantValue is { HasValue: true } constant)
    {
      return EncodeConstant(constant.Value, targetType ?? operation.Type);
    }
    return KnownConstant.Unknown;
  }

  private static KnownConstant EncodeConstant(object? value, ITypeSymbol? type)
  {
    if (value is null)
    {
      return new KnownConstant(true, null);
    }

    if (type is INamedTypeSymbol { TypeKind: Microsoft.CodeAnalysis.TypeKind.Enum } enumType)
    {
      var matchingMember = enumType
        .GetMembers()
        .OfType<IFieldSymbol>()
        .FirstOrDefault(member =>
          member.HasConstantValue &&
          Equals(Convert.ToInt64(member.ConstantValue), Convert.ToInt64(value)));
      return new KnownConstant(true, matchingMember?.Name ?? value);
    }

    if (value is double doubleValue && !double.IsFinite(doubleValue) ||
        value is float floatValue && !float.IsFinite(floatValue))
    {
      return KnownConstant.Unknown;
    }

    return new KnownConstant(
      true,
      value is char character ? character.ToString() : value);
  }

  private static string NormalizePath(string path) =>
    path.Replace(Path.DirectorySeparatorChar, '/');

  private readonly record struct KnownConstant(bool Known, object? Value)
  {
    public static KnownConstant Unknown => new(false, null);
  }

  private sealed class MetadataReferenceIdentity
  {
    public MetadataReference Reference { get; init; } = null!;

    public string Identity { get; init; } = "";
  }

  private sealed class MutableSourceTypeSemantics
  {
    public Dictionary<string, SourcePropertySemantics> Properties { get; } =
      new(StringComparer.Ordinal);

    public Dictionary<string, SourceAvaloniaPropertySemantics> AvaloniaProperties { get; } =
      new(StringComparer.Ordinal);

    public List<SourceGenericParameterSemantics> GenericParameters { get; } = [];

    public Dictionary<string, SourceCommandSemantics> Commands { get; } =
      new(StringComparer.Ordinal);

    public HashSet<string> DeclaredPseudoClasses { get; } =
      new(StringComparer.Ordinal);

    public List<SourceStateBindingSemantics> PseudoClassBindings { get; } = [];

    public List<SourceStateBindingSemantics> ClassBindings { get; } = [];

    public List<SourceAutomationMappingSemantics> AutomationMappings { get; } = [];

    public HashSet<string> ContentProperties { get; } =
      new(StringComparer.Ordinal);
  }
}

internal sealed class SourceSemanticIndex
{
  public Dictionary<string, SourceTypeSemantics> Types { get; init; } =
    new(StringComparer.Ordinal);

  public SourceTokenThemeContract? TokenThemeContract { get; init; }

  public string InputTreeHash { get; init; } = "";

  public string CompilerOptionsHash { get; init; } = "";

  public string DependencyVersionsHash { get; init; } = "";
}

internal sealed class SourceTypeSemantics
{
  public Dictionary<string, SourcePropertySemantics> Properties { get; init; } =
    new(StringComparer.Ordinal);

  public Dictionary<string, SourceAvaloniaPropertySemantics> AvaloniaProperties { get; init; } =
    new(StringComparer.Ordinal);

  public List<SourceGenericParameterSemantics> GenericParameters { get; init; } = [];

  public Dictionary<string, SourceCommandSemantics> Commands { get; init; } =
    new(StringComparer.Ordinal);

  public List<string> DeclaredPseudoClasses { get; init; } = [];

  public List<SourceStateBindingSemantics> PseudoClassBindings { get; init; } = [];

  public List<SourceStateBindingSemantics> ClassBindings { get; init; } = [];

  public List<SourceAutomationMappingSemantics> AutomationMappings { get; init; } = [];

  public List<string> ContentProperties { get; init; } = [];
}

internal sealed class SourceGenericParameterSemantics
{
  public string Name { get; init; } = "";

  public int Position { get; init; }

  public string Variance { get; init; } = "";

  public bool ReferenceTypeConstraint { get; init; }

  public bool? ReferenceTypeConstraintNullable { get; init; }

  public bool ValueTypeConstraint { get; init; }

  public bool UnmanagedTypeConstraint { get; init; }

  public bool NotNullConstraint { get; init; }

  public bool ConstructorConstraint { get; init; }

  public List<string> TypeConstraints { get; init; } = [];
}

internal sealed class SourceCommandSemantics
{
  public bool? Nullable { get; init; }

  public bool CanRead { get; init; }

  public bool CanWrite { get; init; }

  public bool IsStatic { get; init; }
}

internal sealed class SourceStateBindingSemantics
{
  public string Kind { get; init; } = "";

  public string Action { get; init; } = "";

  public bool NameKnown { get; init; }

  public string? Name { get; init; }

  public string? NameExpression { get; init; }

  public string? ConditionExpression { get; init; }

  public List<string> PublicDependencies { get; init; } = [];

  public string SourceMember { get; init; } = "";

  public string Provider { get; init; } = "";
}

internal sealed class SourceAutomationMappingSemantics
{
  public string Semantic { get; init; } = "";

  public string Provider { get; init; } = "";

  public string Authority { get; init; } = "";

  public string TargetKind { get; init; } = "";

  public string? TargetExpression { get; init; }

  public bool ValueKnown { get; init; }

  public object? Value { get; init; }

  public string? ValueExpression { get; init; }

  public List<string> PublicDependencies { get; init; } = [];

  public string SourceMember { get; init; } = "";
}

internal sealed class SourcePropertySemantics
{
  public bool Required { get; init; }

  public bool DefaultKnown { get; init; }

  public object? DefaultValue { get; init; }
}

internal sealed class SourceAvaloniaPropertySemantics
{
  public string Kind { get; init; } = "";

  public bool DefaultKnown { get; init; }

  public object? DefaultValue { get; init; }
}
