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
  private const string EvaluatorVersion = "source-semantics-v2";

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
    IndexRequiredProperties(compilation.Assembly.GlobalNamespace, types);
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
    }

    var inputFiles = sourceFiles
      .Concat(RequiredInputFiles())
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
          ContentProperties = pair.Value.ContentProperties
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList(),
        },
        StringComparer.Ordinal),
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

  private static void IndexRequiredProperties(
    INamespaceSymbol @namespace,
    Dictionary<string, MutableSourceTypeSemantics> types)
  {
    foreach (var childNamespace in @namespace.GetNamespaceMembers())
    {
      IndexRequiredProperties(childNamespace, types);
    }

    foreach (var type in @namespace.GetTypeMembers())
    {
      IndexRequiredProperties(type, types);
    }
  }

  private static void IndexRequiredProperties(
    INamedTypeSymbol typeSymbol,
    Dictionary<string, MutableSourceTypeSemantics> types)
  {
    if (typeSymbol.Locations.Any(location => location.IsInSource))
    {
      var type = GetOrCreate(types, ReflectionTypeName(typeSymbol));
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
      }
    }

    foreach (var nestedType in typeSymbol.GetTypeMembers())
    {
      IndexRequiredProperties(nestedType, types);
    }
  }

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

    public HashSet<string> ContentProperties { get; } =
      new(StringComparer.Ordinal);
  }
}

internal sealed class SourceSemanticIndex
{
  public Dictionary<string, SourceTypeSemantics> Types { get; init; } =
    new(StringComparer.Ordinal);

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

  public List<string> ContentProperties { get; init; } = [];
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
