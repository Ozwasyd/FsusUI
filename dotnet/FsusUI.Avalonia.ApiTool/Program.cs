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
    var outputDir = Path.Combine(Directory.GetCurrentDirectory(), "spec/avalonia/semantic");
    for (var index = 0; index < args.Length; index += 1)
    {
      if (args[index] == "--output" && index + 1 < args.Length)
      {
        outputDir = args[index + 1];
      }
    }

    Directory.CreateDirectory(outputDir);

    var packages = new (string Id, Type Anchor)[]
    {
      ("FsusUI.Avalonia", typeof(FsusUI.Avalonia.Controls.FsusButton)),
      ("FsusUI.Avalonia.Themes", typeof(FsusUI.Avalonia.Themes.FsusThemeManager)),
      ("FsusUI.Avalonia.Icons", typeof(FsusUI.Avalonia.Icons.FsusIconKeys)),
    };

    foreach (var (id, anchor) in packages)
    {
      var baseline = Extract(anchor.Assembly, id);
      var json = JsonSerializer.Serialize(baseline, JsonOptions);
      var outputPath = Path.Combine(outputDir, $"{id}.semantic.json");
      File.WriteAllText(outputPath, $"{json}\n");
      Console.WriteLine($"{id}: {baseline.SemanticTypes.Count} public types");
    }

    return 0;
  }

  private static SemanticBaseline Extract(Assembly assembly, string packageId)
  {
    var types = assembly
      .GetExportedTypes()
      .Where(type =>
        type.FullName?.StartsWith(
          "FsusUI.Avalonia",
          StringComparison.Ordinal) == true)
      .OrderBy(type => type.FullName, StringComparer.Ordinal)
      .Select(ExtractType)
      .ToList();

    var version = assembly.GetName().Version?.ToString() ?? "1.0.0";

    return new SemanticBaseline
    {
      PackageId = packageId,
      BaselineVersion = "1.0.0",
      Source = new BaselineSource
      {
        Tool = "FsusUI.Avalonia.ApiTool@1.0.0",
        AssemblyVersion = version,
      },
      SemanticTypes = types,
    };
  }

  private static SemanticType ExtractType(Type type)
  {
    var kind = TypeKind(type);
    var contentProperty = FindContentProperty(type);
    var avaloniaProperties = ExtractAvaloniaProperties(type);
    var routedEvents = ExtractRoutedEvents(type);
    var clrEvents = ExtractClrEvents(type);
    var events = routedEvents
      .Concat(clrEvents)
      .OrderBy(item => item.Name, StringComparer.Ordinal)
      .ToList();

    return new SemanticType
    {
      Name = type.FullName ?? type.Name,
      Kind = kind,
      BaseType = type.BaseType is null ? null : TypeName(type.BaseType),
      IsAbstract = type.IsAbstract,
      IsSealed = type.IsSealed,
      ContentProperty = contentProperty,
      Properties = ExtractProperties(type),
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

  private static string? FindContentProperty(Type type)
  {
    try
    {
      foreach (var attribute in type.GetCustomAttributes(true))
      {
        var attributeType = attribute.GetType();
        if (attributeType.FullName != "Avalonia.Metadata.ContentAttribute")
        {
          continue;
        }

        var nameProperty = attributeType.GetProperty("Name");
        if (nameProperty is not null)
        {
          return nameProperty.GetValue(attribute) as string;
        }
      }
    }
    catch
    {
      // Attribute reflection must never fail baseline extraction.
    }

    return null;
  }

  private static List<SemanticProperty> ExtractProperties(Type type)
  {
    return type
      .GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
      .Where(property => property.GetIndexParameters().Length == 0)
      .Select(property => new SemanticProperty
      {
        Name = property.Name,
        Type = TypeName(property.PropertyType),
        Nullable = IsNullable(property.PropertyType),
        CanRead = property.CanRead,
        CanWrite = property.CanWrite,
        IsStatic = property.GetMethod?.IsStatic ?? property.SetMethod?.IsStatic ?? false,
      })
      .OrderBy(property => property.Name, StringComparer.Ordinal)
      .ToList();
  }

  private static List<SemanticAvaloniaProperty> ExtractAvaloniaProperties(Type type)
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
      object? defaultValue = null;
      try
      {
        var fieldValue = field.GetValue(null);
        if (fieldValue is not null)
        {
          var defaultValueProperty = fieldValue.GetType().GetProperty("DefaultValue");
          if (defaultValueProperty is not null)
          {
            defaultValue = EncodeDefault(defaultValueProperty.GetValue(fieldValue));
          }
        }
      }
      catch
      {
        defaultValue = null;
      }

      result.Add(new SemanticAvaloniaProperty
      {
        Name = propertyName,
        Kind = kind,
        Type = TypeName(valueType),
        Nullable = IsNullable(valueType),
        DefaultValue = defaultValue,
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
      })
      .OrderBy(member => member.Value)
      .ToList();
  }

  private static object? EncodeDefault(object? value)
  {
    if (value is null)
    {
      return null;
    }

    var valueType = value.GetType();
    if (valueType.IsEnum)
    {
      return value.ToString();
    }

    if (value is string or bool or byte or sbyte or short or ushort or int or uint or long or ulong or float or double or decimal)
    {
      return value;
    }

    return $"{valueType.FullName}:{value}";
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
}

internal sealed class SemanticType
{
  public string Name { get; init; } = "";

  public string Kind { get; init; } = "";

  public string? BaseType { get; init; }

  public bool IsAbstract { get; init; }

  public bool IsSealed { get; init; }

  public string? ContentProperty { get; init; }

  public List<SemanticProperty> Properties { get; init; } = [];

  public List<SemanticAvaloniaProperty> AvaloniaProperties { get; init; } = [];

  public List<SemanticEvent> Events { get; init; } = [];

  public List<SemanticMethod> Methods { get; init; } = [];

  public List<SemanticEnumMember>? EnumMembers { get; init; }
}

internal sealed class SemanticProperty
{
  public string Name { get; init; } = "";

  public string Type { get; init; } = "";

  public bool Nullable { get; init; }

  public bool CanRead { get; init; }

  public bool CanWrite { get; init; }

  public bool IsStatic { get; init; }
}

internal sealed class SemanticAvaloniaProperty
{
  public string Name { get; init; } = "";

  public string Kind { get; init; } = "";

  public string Type { get; init; } = "";

  public bool Nullable { get; init; }

  public object? DefaultValue { get; init; }
}

internal sealed class SemanticEvent
{
  public string Name { get; init; } = "";

  public string Kind { get; init; } = "";

  public string ArgsType { get; init; } = "";

  public bool IsStatic { get; init; }
}

internal sealed class SemanticMethod
{
  public string Name { get; init; } = "";

  public bool IsStatic { get; init; }

  public string ReturnType { get; init; } = "";

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
}
