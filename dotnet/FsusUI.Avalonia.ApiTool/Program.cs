using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Avalonia;

namespace FsusUI.Avalonia.ApiTool;

internal static class Program
{
  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
  };

  private static int Main(string[] args)
  {
    var repoRoot = Directory.GetCurrentDirectory();
    if (args.Contains("--verify-source-semantics", StringComparer.Ordinal))
    {
      SourceSemanticVerifier.Verify(repoRoot);
    }

    var outputDir = Path.Combine(repoRoot, "spec/avalonia/semantic");
    for (var index = 0; index < args.Length; index += 1)
    {
      if (args[index] == "--output" && index + 1 < args.Length)
      {
        outputDir = args[index + 1];
      }
    }

    Directory.CreateDirectory(outputDir);

    var packages = new (string Id, Type Anchor, string ProjectDirectory)[]
    {
      (
        "FsusUI.Avalonia",
        typeof(FsusUI.Avalonia.Controls.FsusButton),
        "dotnet/FsusUI.Avalonia"),
      (
        "FsusUI.Avalonia.Themes",
        typeof(FsusUI.Avalonia.Themes.FsusThemeManager),
        "dotnet/FsusUI.Avalonia.Themes"),
      (
        "FsusUI.Avalonia.Icons",
        typeof(FsusUI.Avalonia.Icons.FsusIconKeys),
        "dotnet/FsusUI.Avalonia.Icons"),
    };

    foreach (var (id, anchor, projectDirectory) in packages)
    {
      var sourceSemantics = SourceSemanticEvaluator.Extract(
        repoRoot,
        Path.Combine(repoRoot, projectDirectory));
      var baseline = Extract(anchor.Assembly, id, sourceSemantics);
      baseline.Source.OutputHash = ComputeOutputHash(baseline);
      var json = JsonSerializer.Serialize(baseline, JsonOptions);
      var outputPath = Path.Combine(outputDir, $"{id}.semantic.json");
      File.WriteAllText(outputPath, $"{json}\n");
      Console.WriteLine($"{id}: {baseline.SemanticTypes.Count} public types");
    }

    return 0;
  }

  private static SemanticBaseline Extract(
    Assembly assembly,
    string packageId,
    SourceSemanticIndex sourceSemantics)
  {
    var types = assembly
      .GetExportedTypes()
      .Where(type =>
        type.FullName?.StartsWith(
          "FsusUI.Avalonia",
          StringComparison.Ordinal) == true)
      .OrderBy(type => type.FullName, StringComparer.Ordinal)
      .Select(type => ExtractType(type, sourceSemantics))
      .ToList();

    var version = assembly.GetName().Version?.ToString() ?? "1.0.0";

    return new SemanticBaseline
    {
      PackageId = packageId,
      BaselineVersion = "2.4.0",
      Source = new BaselineSource
      {
        ToolVersion = "FsusUI.Avalonia.ApiTool@1.8.0",
        AssemblyVersion = version,
        InputTreeHash = sourceSemantics.InputTreeHash,
        CompilerOptionsHash = sourceSemantics.CompilerOptionsHash,
        DependencyVersionHash = sourceSemantics.DependencyVersionsHash,
        ContractSchemaVersion = "2.0.0",
      },
      SemanticTypes = types,
      TokenThemeContract = ExtractTokenThemeContract(
        sourceSemantics.TokenThemeContract),
    };
  }

  private static string ComputeOutputHash(SemanticBaseline baseline)
  {
    baseline.Source.OutputHash = "";
    var payload = $"{JsonSerializer.Serialize(baseline, JsonOptions)}\n";
    return Convert.ToHexString(
      SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
  }

  private static SemanticTokenThemeContract? ExtractTokenThemeContract(
    SourceTokenThemeContract? source)
  {
    if (source is null) return null;
    return new SemanticTokenThemeContract
    {
      CanonicalAuthority = source.CanonicalAuthority,
      GeneratedMetadataAuthority = source.GeneratedMetadataAuthority,
      GeneratedXamlAuthority = source.GeneratedXamlAuthority,
      GeneratedCsharpAuthority = source.GeneratedCsharpAuthority,
      ContractDeclared = source.ContractDeclared,
      RenderedEvidenceVerified = source.RenderedEvidenceVerified,
      Definitions = source.Definitions
        .Select(definition => new SemanticTokenDefinition
        {
          CanonicalName = definition.CanonicalName,
          Owner = definition.Owner,
          GeneratedOutputs = definition.GeneratedOutputs,
          ResourceKeys = definition.ResourceKeys,
          CsharpMembers = definition.CsharpMembers,
          DeclarationAuthority = definition.DeclarationAuthority,
        })
        .ToList(),
      Dependencies = source.Dependencies
        .Select(dependency => new SemanticTokenDependency
        {
          Kind = dependency.Kind,
          Authority = dependency.Authority,
          SourceFile = dependency.SourceFile,
          SourceMember = dependency.SourceMember,
          Dependency = dependency.Dependency,
          CanonicalName = dependency.CanonicalName,
          Resolved = dependency.Resolved,
          OwnerType = dependency.OwnerType,
          Ownership = dependency.Ownership,
          OwnerExpression = dependency.OwnerExpression,
        })
        .ToList(),
    };
  }

  private static SemanticType ExtractType(
    Type type,
    SourceSemanticIndex sourceSemantics)
  {
    var kind = TypeKind(type);
    sourceSemantics.Types.TryGetValue(
      type.FullName ?? type.Name,
      out var sourceTypeSemantics);
    var properties = ExtractProperties(type, sourceTypeSemantics);
    var avaloniaProperties = ExtractAvaloniaProperties(type, sourceTypeSemantics);
    var contentRegions = ExtractContentRegions(
      type,
      properties,
      avaloniaProperties,
      sourceTypeSemantics);
    var routedEvents = ExtractRoutedEvents(type);
    var clrEvents = ExtractClrEvents(type);
    var events = routedEvents
      .Concat(clrEvents)
      .OrderBy(item => item.Name, StringComparer.Ordinal)
      .ToList();
    var commands = ExtractCommands(
      properties,
      avaloniaProperties,
      sourceTypeSemantics);
    var obsolete = type.GetCustomAttribute<ObsoleteAttribute>();

    return new SemanticType
    {
      Name = type.FullName ?? type.Name,
      Kind = kind,
      BaseType = type.BaseType is null ? null : TypeName(type.BaseType),
      IsAbstract = type.IsAbstract,
      IsSealed = type.IsSealed,
      Deprecated = obsolete is not null,
      DeprecationMessage = obsolete?.Message,
      GenericParameters =
        sourceTypeSemantics?.GenericParameters.Count > 0
          ? sourceTypeSemantics.GenericParameters
            .Select(parameter => new SemanticGenericParameter
            {
              Name = parameter.Name,
              Position = parameter.Position,
              Variance = parameter.Variance,
              ReferenceTypeConstraint = parameter.ReferenceTypeConstraint,
              ReferenceTypeConstraintNullable =
                parameter.ReferenceTypeConstraintNullable,
              ValueTypeConstraint = parameter.ValueTypeConstraint,
              UnmanagedTypeConstraint = parameter.UnmanagedTypeConstraint,
              NotNullConstraint = parameter.NotNullConstraint,
              ConstructorConstraint = parameter.ConstructorConstraint,
              TypeConstraints = parameter.TypeConstraints,
            })
            .ToList()
          : null,
      ContentProperty =
        contentRegions.Count == 1
          ? contentRegions[0].Name
          : FindInheritedContentProperty(type),
      ContentRegions = contentRegions,
      Properties = properties,
      AvaloniaProperties = avaloniaProperties,
      Commands = commands.Count > 0 ? commands : null,
      StateContract = ExtractStateContract(sourceTypeSemantics),
      AutomationContract = ExtractAutomationContract(sourceTypeSemantics),
      Events = events,
      Methods = ExtractMethods(type),
      EnumMembers = type.IsEnum ? ExtractEnumMembers(type) : null,
    };
  }

  private static SemanticStateContract? ExtractStateContract(
    SourceTypeSemantics? sourceSemantics)
  {
    if (sourceSemantics is null ||
        sourceSemantics.DeclaredPseudoClasses.Count == 0 &&
        sourceSemantics.PseudoClassBindings.Count == 0 &&
        sourceSemantics.ClassBindings.Count == 0)
    {
      return null;
    }

    var declaredPseudoClasses = sourceSemantics.DeclaredPseudoClasses
      .OrderBy(name => name, StringComparer.Ordinal)
      .ToList();
    var pseudoClassBindings = sourceSemantics.PseudoClassBindings
      .Select(StateBinding)
      .ToList();
    var classBindings = sourceSemantics.ClassBindings
      .Select(StateBinding)
      .ToList();
    var boundPseudoClasses = pseudoClassBindings
      .Where(binding => binding.NameKnown)
      .Select(binding => binding.Name!)
      .Distinct(StringComparer.Ordinal)
      .OrderBy(name => name, StringComparer.Ordinal)
      .ToList();
    return new SemanticStateContract
    {
      PseudoClassDeclarationAuthority =
        declaredPseudoClasses.Count > 0
          ? "avalonia-pseudo-classes-attribute"
          : null,
      DeclaredPseudoClasses = declaredPseudoClasses,
      PseudoClassBindings = pseudoClassBindings,
      PseudoClassContractKnown = declaredPseudoClasses.Count > 0,
      PseudoClassContractComplete =
        declaredPseudoClasses.Count > 0 &&
        pseudoClassBindings.All(binding => binding.NameKnown) &&
        declaredPseudoClasses.SequenceEqual(
          boundPseudoClasses,
          StringComparer.Ordinal),
      ClassBindingAuthority = "roslyn-control-instance-operation",
      ClassContractDeclared = false,
      ClassBindings = classBindings,
      ClassNamesResolved = classBindings.All(binding => binding.NameKnown),
    };
  }

  private static SemanticStateBinding StateBinding(
    SourceStateBindingSemantics binding) =>
    new()
    {
      Kind = binding.Kind,
      Action = binding.Action,
      NameKnown = binding.NameKnown,
      Name = binding.Name,
      NameExpression = binding.NameExpression,
      ConditionExpression = binding.ConditionExpression,
      PublicDependencies = binding.PublicDependencies,
      SourceMember = binding.SourceMember,
      Provider = binding.Provider,
    };

  private static SemanticAutomationContract? ExtractAutomationContract(
    SourceTypeSemantics? sourceSemantics)
  {
    if (sourceSemantics?.AutomationMappings.Count is not > 0)
    {
      return null;
    }

    var mappings = sourceSemantics.AutomationMappings
      .Select(mapping => new SemanticAutomationMapping
      {
        Semantic = mapping.Semantic,
        Provider = mapping.Provider,
        Authority = mapping.Authority,
        TargetKind = mapping.TargetKind,
        TargetExpression = mapping.TargetExpression,
        ValueKnown = mapping.ValueKnown,
        Value = mapping.Value,
        ValueExpression = mapping.ValueExpression,
        PublicDependencies = mapping.PublicDependencies,
        SourceMember = mapping.SourceMember,
      })
      .ToList();
    return new SemanticAutomationContract
    {
      ObservationAuthorities = mappings
        .Select(mapping => mapping.Authority)
        .Distinct(StringComparer.Ordinal)
        .OrderBy(authority => authority, StringComparer.Ordinal)
        .ToList(),
      ContractDeclared = false,
      RuntimeTreeVerified = false,
      MappingComplete = false,
      ObservedSemantics = mappings
        .Select(mapping => mapping.Semantic)
        .Distinct(StringComparer.Ordinal)
        .OrderBy(semantic => semantic, StringComparer.Ordinal)
        .ToList(),
      Mappings = mappings,
    };
  }

  private static string TypeKind(Type type)
  {
    if (type.IsEnum) return "enum";
    if (typeof(Delegate).IsAssignableFrom(type)) return "delegate";
    if (type.IsInterface) return "interface";
    if (type.IsValueType) return "struct";
    if (type.GetMethods(BindingFlags.Public | BindingFlags.Instance).Any(method => method.Name == "<Clone>$")) return "record";
    return "class";
  }

  private static List<SemanticCommand> ExtractCommands(
    IReadOnlyList<SemanticProperty> properties,
    IReadOnlyList<SemanticAvaloniaProperty> avaloniaProperties,
    SourceTypeSemantics? sourceSemantics)
  {
    if (sourceSemantics is null || sourceSemantics.Commands.Count == 0)
    {
      return [];
    }

    var propertiesByName = properties.ToDictionary(
      property => property.Name,
      StringComparer.Ordinal);
    var avaloniaPropertiesByName = avaloniaProperties.ToDictionary(
      property => property.Name,
      StringComparer.Ordinal);
    var commands = new List<SemanticCommand>();
    foreach (var (name, sourceCommand) in sourceSemantics.Commands)
    {
      if (!propertiesByName.TryGetValue(name, out var property))
      {
        continue;
      }

      avaloniaPropertiesByName.TryGetValue(name, out var avaloniaProperty);
      commands.Add(new SemanticCommand
      {
        Name = name,
        Type = property.Type,
        Nullable = sourceCommand.Nullable,
        CanRead = sourceCommand.CanRead,
        CanWrite = sourceCommand.CanWrite,
        IsStatic = sourceCommand.IsStatic,
        PropertyKind = avaloniaProperty?.Kind ?? "clr",
        DefaultKnown =
          avaloniaProperty?.DefaultKnown == true || property.DefaultKnown,
        DefaultValue =
          avaloniaProperty?.DefaultKnown == true
            ? avaloniaProperty.DefaultValue
            : property.DefaultValue,
        Deprecated = property.Deprecated,
        DeprecationMessage = property.DeprecationMessage,
      });
    }

    return commands
      .OrderBy(command => command.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static List<SemanticContentRegion> ExtractContentRegions(
    Type type,
    IReadOnlyList<SemanticProperty> properties,
    IReadOnlyList<SemanticAvaloniaProperty> avaloniaProperties,
    SourceTypeSemantics? sourceSemantics)
  {
    var contentProperties = sourceSemantics?.ContentProperties
      .ToHashSet(StringComparer.Ordinal) ?? [];
    var avaloniaByName = avaloniaProperties.ToDictionary(
      property => property.Name,
      StringComparer.Ordinal);
    var regions = properties
      .Where(property => contentProperties.Contains(property.Name))
      .Select(property =>
      {
        avaloniaByName.TryGetValue(property.Name, out var avaloniaProperty);
        return new SemanticContentRegion
        {
          Name = property.Name,
          Type = property.Type,
          Nullable = property.Nullable,
          CanRead = property.CanRead,
          CanWrite = property.CanWrite,
          Required = property.Required,
          PropertyKind = avaloniaProperty?.Kind ?? "clr",
        };
      })
      .ToList();

    // Content inherited from a base control (for example ContentControl)
    // is still a real public content surface of the derived control.
    var inheritedContent = FindInheritedContentProperty(type);
    if (
      inheritedContent is not null &&
      regions.All(region => region.Name != inheritedContent)
    )
    {
      var property = type
        .GetProperties(BindingFlags.Public | BindingFlags.Instance)
        .FirstOrDefault(candidate => candidate.Name == inheritedContent);
      if (property is not null)
      {
        regions.Add(new SemanticContentRegion
        {
          Name = property.Name,
          Type = TypeName(property.PropertyType),
          Nullable = IsNullable(property.PropertyType),
          CanRead = property.CanRead,
          CanWrite = property.CanWrite,
          Required = false,
          PropertyKind = "clr",
        });
      }
    }

    return regions
      .OrderBy(region => region.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static string? FindInheritedContentProperty(Type type)
  {
    foreach (var property in type.GetProperties(
      BindingFlags.Public | BindingFlags.Instance))
    {
      try
      {
        if (property
          .GetCustomAttributes(true)
          .Any(attribute =>
            attribute.GetType().FullName ==
            "Avalonia.Metadata.ContentAttribute"))
        {
          return property.Name;
        }
      }
      catch
      {
        // One attribute must not prevent extraction of the remaining public
        // properties. A missing result remains visible in Contract V2.
      }
    }

    return null;
  }

  private static List<SemanticProperty> ExtractProperties(
    Type type,
    SourceTypeSemantics? sourceSemantics)
  {
    return type
      .GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
      .Where(property => property.GetIndexParameters().Length == 0)
      .Select(property =>
      {
        SourcePropertySemantics? sourceProperty = null;
        if (sourceSemantics is not null)
        {
          sourceSemantics.Properties.TryGetValue(property.Name, out sourceProperty);
        }
        return new SemanticProperty
        {
          Name = property.Name,
          Type = TypeName(property.PropertyType),
          Nullable = IsNullable(property.PropertyType),
          CanRead = property.CanRead,
          CanWrite = property.CanWrite,
          IsStatic = property.GetMethod?.IsStatic ?? property.SetMethod?.IsStatic ?? false,
          Required = sourceProperty?.Required,
          DefaultKnown = sourceProperty?.DefaultKnown ?? false,
          DefaultValue = sourceProperty?.DefaultValue,
          Deprecated = property.GetCustomAttribute<ObsoleteAttribute>() is not null,
          DeprecationMessage = property.GetCustomAttribute<ObsoleteAttribute>()?.Message,
        };
      })
      .OrderBy(property => property.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static List<SemanticAvaloniaProperty> ExtractAvaloniaProperties(
    Type type,
    SourceTypeSemantics? sourceSemantics)
  {
    var result = new List<SemanticAvaloniaProperty>();
    foreach (var field in type.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly))
    {
      var fieldType = field.FieldType;
      if (!fieldType.IsGenericType)
      {
        continue;
      }

      var genericDefinition = fieldType.GetGenericTypeDefinition();
      var kind = genericDefinition.FullName switch
      {
        "Avalonia.StyledProperty`1" => "styled",
        "Avalonia.DirectProperty`2" => "direct",
        _ => null,
      };
      if (kind is null)
      {
        continue;
      }

      var propertyName = field.Name.EndsWith("Property", StringComparison.Ordinal)
        ? field.Name[..^"Property".Length]
        : field.Name;
      var valueType = fieldType.GetGenericArguments()[0];
      SourceAvaloniaPropertySemantics? sourceProperty = null;
      if (sourceSemantics is not null)
      {
        sourceSemantics.AvaloniaProperties.TryGetValue(propertyName, out sourceProperty);
      }

      result.Add(new SemanticAvaloniaProperty
      {
        Name = propertyName,
        Kind = kind,
        Type = TypeName(valueType),
        Nullable = IsNullable(valueType),
        DefaultKnown = sourceProperty?.DefaultKnown ?? false,
        DefaultValue = sourceProperty?.DefaultValue,
        Deprecated = field.GetCustomAttribute<ObsoleteAttribute>() is not null,
        DeprecationMessage = field.GetCustomAttribute<ObsoleteAttribute>()?.Message,
      });
    }

    return result
      .OrderBy(property => property.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static List<SemanticEvent> ExtractRoutedEvents(Type type)
  {
    var result = new List<SemanticEvent>();
    foreach (var field in type.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly))
    {
      var fieldType = field.FieldType;
      if (!fieldType.IsGenericType || fieldType.GetGenericTypeDefinition().FullName != "Avalonia.RoutedEvent`1")
      {
        continue;
      }

      var eventName = field.Name.EndsWith("Event", StringComparison.Ordinal)
        ? field.Name[..^"Event".Length]
        : field.Name;
      result.Add(new SemanticEvent
      {
        Name = eventName,
        Kind = "routed",
        ArgsType = TypeName(fieldType.GetGenericArguments()[0]),
        Deprecated = field.GetCustomAttribute<ObsoleteAttribute>() is not null,
        DeprecationMessage = field.GetCustomAttribute<ObsoleteAttribute>()?.Message,
      });
    }

    return result;
  }

  private static List<SemanticEvent> ExtractClrEvents(Type type)
  {
    return type
      .GetEvents(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
      .Select(@event => new SemanticEvent
      {
        Name = @event.Name,
        Kind = "clr",
        ArgsType = TypeName(@event.EventHandlerType ?? typeof(EventArgs)),
        IsStatic = @event.AddMethod?.IsStatic ?? false,
        Deprecated = @event.GetCustomAttribute<ObsoleteAttribute>() is not null,
        DeprecationMessage = @event.GetCustomAttribute<ObsoleteAttribute>()?.Message,
      })
      .OrderBy(@event => @event.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static List<SemanticMethod> ExtractMethods(Type type)
  {
    return type
      .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
      .Where(method =>
        !method.IsSpecialName &&
        method.Name is not "ToString" and not "Equals" and not "GetHashCode")
      .Select(method => new SemanticMethod
      {
        Name = method.Name,
        IsStatic = method.IsStatic,
        ReturnType = TypeName(method.ReturnType),
        Deprecated = method.GetCustomAttribute<ObsoleteAttribute>() is not null,
        DeprecationMessage = method.GetCustomAttribute<ObsoleteAttribute>()?.Message,
        Parameters = method
          .GetParameters()
          .Select(parameter => new SemanticParameter
          {
            Name = parameter.Name ?? string.Empty,
            Type = TypeName(parameter.ParameterType),
            Optional = parameter.IsOptional || parameter.GetCustomAttribute<ParamArrayAttribute>() is not null,
          })
          .ToList(),
      })
      .OrderBy(method => method.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static List<SemanticEnumMember> ExtractEnumMembers(Type type)
  {
    return type
      .GetEnumNames()
      .Zip(type.GetEnumValues().Cast<object>(), (name, value) => new SemanticEnumMember
      {
        Name = name,
        Value = Convert.ToInt64(value),
        Deprecated = type.GetField(name)?.GetCustomAttribute<ObsoleteAttribute>() is not null,
        DeprecationMessage = type.GetField(name)?.GetCustomAttribute<ObsoleteAttribute>()?.Message,
      })
      .OrderBy(member => member.Value)
      .ToList();
  }

  private static bool IsNullable(Type type)
  {
    if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Nullable<>))
    {
      return true;
    }

    return type.IsValueType == false;
  }

  private static string TypeName(Type type)
  {
    if (type.IsGenericParameter)
    {
      return type.Name;
    }

    if (type.IsArray)
    {
      var element = type.GetElementType()!;
      var rank = type.GetArrayRank();
      var suffix = rank == 1 ? "[]" : $"[{new string(',', rank - 1)}]";
      return $"{TypeName(element)}{suffix}";
    }

    if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Nullable<>))
    {
      return $"{TypeName(type.GetGenericArguments()[0])}?";
    }

    if (!type.IsGenericType)
    {
      return type.FullName ?? type.Name;
    }

    var definitionName = type.GetGenericTypeDefinition().FullName ?? type.Name;
    var baseName = definitionName[..definitionName.IndexOf('`')];
    return $"{baseName}<{string.Join(", ", type.GetGenericArguments().Select(TypeName))}>";
  }
}

internal sealed class SemanticBaseline
{
  public string PackageId { get; init; } = "";

  public string BaselineVersion { get; init; } = "";

  public BaselineSource Source { get; init; } = new();

  public List<SemanticType> SemanticTypes { get; init; } = [];

  public SemanticTokenThemeContract? TokenThemeContract { get; init; }
}

internal sealed class SemanticTokenThemeContract
{
  public string CanonicalAuthority { get; init; } = "";
  public string GeneratedMetadataAuthority { get; init; } = "";
  public string GeneratedXamlAuthority { get; init; } = "";
  public string GeneratedCsharpAuthority { get; init; } = "";
  public bool ContractDeclared { get; init; }
  public bool RenderedEvidenceVerified { get; init; }
  public List<SemanticTokenDefinition> Definitions { get; init; } = [];
  public List<SemanticTokenDependency> Dependencies { get; init; } = [];
}

internal sealed class SemanticTokenDefinition
{
  public string CanonicalName { get; init; } = "";
  public string Owner { get; init; } = "";
  public List<string> GeneratedOutputs { get; init; } = [];
  public List<string> ResourceKeys { get; init; } = [];
  public List<string> CsharpMembers { get; init; } = [];
  public string DeclarationAuthority { get; init; } = "";
}

internal sealed class SemanticTokenDependency
{
  public string Kind { get; init; } = "";
  public string Authority { get; init; } = "";
  public string SourceFile { get; init; } = "";
  public string SourceMember { get; init; } = "";
  public string Dependency { get; init; } = "";
  public string? CanonicalName { get; init; }
  public bool Resolved { get; init; }
  public string? OwnerType { get; init; }
  public string Ownership { get; init; } = "";
  public string? OwnerExpression { get; init; }
}

internal sealed class BaselineSource
{
  public string ToolVersion { get; init; } = "";

  public string AssemblyVersion { get; init; } = "";

  public string InputTreeHash { get; init; } = "";

  public string CompilerOptionsHash { get; init; } = "";

  public string DependencyVersionHash { get; init; } = "";

  public string ContractSchemaVersion { get; init; } = "";

  public string OutputHash { get; set; } = "";
}

internal sealed class SemanticType
{
  public string Name { get; init; } = "";

  public string Kind { get; init; } = "";

  public string? BaseType { get; init; }

  public bool IsAbstract { get; init; }

  public bool IsSealed { get; init; }

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }

  public List<SemanticGenericParameter>? GenericParameters { get; init; }

  public string? ContentProperty { get; init; }

  public List<SemanticContentRegion> ContentRegions { get; init; } = [];

  public List<SemanticProperty> Properties { get; init; } = [];

  public List<SemanticAvaloniaProperty> AvaloniaProperties { get; init; } = [];

  public List<SemanticCommand>? Commands { get; init; }

  public SemanticStateContract? StateContract { get; init; }

  public SemanticAutomationContract? AutomationContract { get; init; }

  public List<SemanticEvent> Events { get; init; } = [];

  public List<SemanticMethod> Methods { get; init; } = [];

  public List<SemanticEnumMember>? EnumMembers { get; init; }
}

internal sealed class SemanticGenericParameter
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

internal sealed class SemanticCommand
{
  public string Name { get; init; } = "";

  public string Type { get; init; } = "";

  public bool? Nullable { get; init; }

  public bool CanRead { get; init; }

  public bool CanWrite { get; init; }

  public bool IsStatic { get; init; }

  public string PropertyKind { get; init; } = "";

  public bool DefaultKnown { get; init; }

  public object? DefaultValue { get; init; }

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }
}

internal sealed class SemanticStateContract
{
  public string? PseudoClassDeclarationAuthority { get; init; }

  public List<string> DeclaredPseudoClasses { get; init; } = [];

  public List<SemanticStateBinding> PseudoClassBindings { get; init; } = [];

  public bool PseudoClassContractKnown { get; init; }

  public bool PseudoClassContractComplete { get; init; }

  public string ClassBindingAuthority { get; init; } = "";

  public bool ClassContractDeclared { get; init; }

  public List<SemanticStateBinding> ClassBindings { get; init; } = [];

  public bool ClassNamesResolved { get; init; }
}

internal sealed class SemanticStateBinding
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

internal sealed class SemanticAutomationContract
{
  public List<string> ObservationAuthorities { get; init; } = [];

  public bool ContractDeclared { get; init; }

  public bool RuntimeTreeVerified { get; init; }

  public bool MappingComplete { get; init; }

  public List<string> ObservedSemantics { get; init; } = [];

  public List<SemanticAutomationMapping> Mappings { get; init; } = [];
}

internal sealed class SemanticAutomationMapping
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

internal sealed class SemanticContentRegion
{
  public string Name { get; init; } = "";

  public string Type { get; init; } = "";

  public bool Nullable { get; init; }

  public bool CanRead { get; init; }

  public bool CanWrite { get; init; }

  public bool? Required { get; init; }

  public string PropertyKind { get; init; } = "";
}

internal sealed class SemanticProperty
{
  public string Name { get; init; } = "";

  public string Type { get; init; } = "";

  public bool Nullable { get; init; }

  public bool CanRead { get; init; }

  public bool CanWrite { get; init; }

  public bool IsStatic { get; init; }

  public bool? Required { get; init; }

  public bool DefaultKnown { get; init; }

  public object? DefaultValue { get; init; }

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }
}

internal sealed class SemanticAvaloniaProperty
{
  public string Name { get; init; } = "";

  public string Kind { get; init; } = "";

  public string Type { get; init; } = "";

  public bool Nullable { get; init; }

  public bool DefaultKnown { get; init; }

  public object? DefaultValue { get; init; }

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }
}

internal sealed class SemanticEvent
{
  public string Name { get; init; } = "";

  public string Kind { get; init; } = "";

  public string ArgsType { get; init; } = "";

  public bool IsStatic { get; init; }

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }
}

internal sealed class SemanticMethod
{
  public string Name { get; init; } = "";

  public bool IsStatic { get; init; }

  public string ReturnType { get; init; } = "";

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }

  public List<SemanticParameter> Parameters { get; init; } = [];
}

internal sealed class SemanticParameter
{
  public string Name { get; init; } = "";

  public string Type { get; init; } = "";

  public bool Optional { get; init; }
}

internal sealed class SemanticEnumMember
{
  public string Name { get; init; } = "";

  public long Value { get; init; }

  public bool Deprecated { get; init; }

  public string? DeprecationMessage { get; init; }
}
