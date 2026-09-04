using System.Reflection;
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
      BaselineVersion = "1.0.0",
      Source = new BaselineSource
      {
        Tool = "FsusUI.Avalonia.ApiTool@1.3.0",
        AssemblyVersion = version,
        InputTreeHash = sourceSemantics.InputTreeHash,
        CompilerOptionsHash = sourceSemantics.CompilerOptionsHash,
        DependencyVersionsHash = sourceSemantics.DependencyVersionsHash,
      },
      SemanticTypes = types,
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
      properties,
      avaloniaProperties,
      sourceTypeSemantics);
    var routedEvents = ExtractRoutedEvents(type);
    var clrEvents = ExtractClrEvents(type);
    var events = routedEvents
      .Concat(clrEvents)
      .OrderBy(item => item.Name, StringComparer.Ordinal)
      .ToList();
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
      ContentProperty =
        contentRegions.Count == 1 ? contentRegions[0].Name : null,
      ContentRegions = contentRegions,
      Properties = properties,
      AvaloniaProperties = avaloniaProperties,
      Events = events,
      Methods = ExtractMethods(type),
      EnumMembers = type.IsEnum ? ExtractEnumMembers(type) : null,
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

  private static List<SemanticContentRegion> ExtractContentRegions(
    IReadOnlyList<SemanticProperty> properties,
    IReadOnlyList<SemanticAvaloniaProperty> avaloniaProperties,
    SourceTypeSemantics? sourceSemantics)
  {
    var contentProperties = sourceSemantics?.ContentProperties
      .ToHashSet(StringComparer.Ordinal) ?? [];
    var avaloniaByName = avaloniaProperties.ToDictionary(
      property => property.Name,
      StringComparer.Ordinal);
    return properties
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
      .OrderBy(region => region.Name, StringComparer.Ordinal)
      .ToList();
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
}

internal sealed class BaselineSource
{
  public string Tool { get; init; } = "";

  public string AssemblyVersion { get; init; } = "";

  public string InputTreeHash { get; init; } = "";

  public string CompilerOptionsHash { get; init; } = "";

  public string DependencyVersionsHash { get; init; } = "";
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

  public string? ContentProperty { get; init; }

  public List<SemanticContentRegion> ContentRegions { get; init; } = [];

  public List<SemanticProperty> Properties { get; init; } = [];

  public List<SemanticAvaloniaProperty> AvaloniaProperties { get; init; } = [];

  public List<SemanticEvent> Events { get; init; } = [];

  public List<SemanticMethod> Methods { get; init; } = [];

  public List<SemanticEnumMember>? EnumMembers { get; init; }
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
