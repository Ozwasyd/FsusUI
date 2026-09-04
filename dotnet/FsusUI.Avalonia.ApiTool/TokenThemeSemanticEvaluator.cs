using System.Text.Json;
using System.Xml.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace FsusUI.Avalonia.ApiTool;

internal static class TokenThemeSemanticEvaluator
{
  private const string CanonicalPath = "spec/tokens/tokens.json";
  private const string GeneratedMetadataPath =
    "vue/packages/theme-chalk/src/generated/tokens.json";
  private const string GeneratedXamlPath =
    "dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml";
  private const string GeneratedCsharpPath =
    "dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs";
  private static readonly XNamespace XamlNamespace =
    "http://schemas.microsoft.com/winfx/2006/xaml";

  public static IReadOnlyList<string> InputFiles(
    string repoRoot,
    string projectDirectory)
  {
    var projectName = Path.GetFileName(projectDirectory);
    if (projectName is not "FsusUI.Avalonia" and not "FsusUI.Avalonia.Themes")
    {
      return [];
    }
    var files = new List<string>
    {
      Path.Combine(
        repoRoot,
        "dotnet/FsusUI.Avalonia.ApiTool/TokenThemeSemanticEvaluator.cs"),
      Path.Combine(repoRoot, CanonicalPath),
      Path.Combine(repoRoot, GeneratedMetadataPath),
      Path.Combine(repoRoot, GeneratedXamlPath),
      Path.Combine(repoRoot, GeneratedCsharpPath),
    };
    if (projectName == "FsusUI.Avalonia.Themes")
    {
      files.AddRange(
        Directory.EnumerateFiles(
          projectDirectory,
          "*.axaml",
          SearchOption.AllDirectories));
    }
    return files
      .Where(File.Exists)
      .Distinct(StringComparer.Ordinal)
      .OrderBy(path => NormalizePath(Path.GetRelativePath(repoRoot, path)),
        StringComparer.Ordinal)
      .ToList();
  }

  public static SourceTokenThemeContract? Extract(
    string repoRoot,
    string projectDirectory,
    CSharpCompilation compilation,
    IReadOnlyList<SyntaxTree> syntaxTrees,
    IReadOnlyDictionary<string, string> sourceOverrides)
  {
    var projectName = Path.GetFileName(projectDirectory);
    if (projectName is not "FsusUI.Avalonia" and not "FsusUI.Avalonia.Themes")
    {
      return null;
    }

    var definitions = ReadDefinitions(
      repoRoot,
      compilation,
      sourceOverrides);
    var dependencies = new List<SourceTokenDependencySemantics>();
    IndexCsharpDependencies(
      repoRoot,
      compilation,
      syntaxTrees,
      definitions,
      dependencies);
    if (projectName == "FsusUI.Avalonia.Themes")
    {
      IndexXamlDependencies(
        repoRoot,
        projectDirectory,
        compilation,
        sourceOverrides,
        definitions,
        dependencies);
    }

    return new SourceTokenThemeContract
    {
      CanonicalAuthority = CanonicalPath,
      GeneratedMetadataAuthority = GeneratedMetadataPath,
      GeneratedXamlAuthority = GeneratedXamlPath,
      GeneratedCsharpAuthority = GeneratedCsharpPath,
      ContractDeclared = false,
      RenderedEvidenceVerified = false,
      Definitions = definitions
        .OrderBy(definition => definition.CanonicalName, StringComparer.Ordinal)
        .ToList(),
      Dependencies = dependencies
        .OrderBy(DependencySortKey, StringComparer.Ordinal)
        .ToList(),
    };
  }

  private static List<SourceTokenDefinitionSemantics> ReadDefinitions(
    string repoRoot,
    CSharpCompilation compilation,
    IReadOnlyDictionary<string, string> sourceOverrides)
  {
    using var canonicalDocument = JsonDocument.Parse(
      Read(repoRoot, CanonicalPath, sourceOverrides));
    var canonicalNames = canonicalDocument.RootElement
      .GetProperty("tokens")
      .EnumerateArray()
      .Select(token => token.GetProperty("name").GetString()!)
      .ToHashSet(StringComparer.Ordinal);

    using var metadataDocument = JsonDocument.Parse(
      Read(repoRoot, GeneratedMetadataPath, sourceOverrides));
    var metadata = metadataDocument.RootElement.GetProperty("tokens");
    var metadataNames = metadata.EnumerateObject()
      .Select(property => property.Name)
      .ToHashSet(StringComparer.Ordinal);
    AssertSetEqual(
      canonicalNames,
      metadataNames,
      "canonical tokens and generated token metadata");

    var generatedTree = CSharpSyntaxTree.ParseText(
      Read(repoRoot, GeneratedCsharpPath, sourceOverrides),
      path: Path.Combine(repoRoot, GeneratedCsharpPath));
    var generatedCompilation = compilation
      .RemoveAllSyntaxTrees()
      .AddSyntaxTrees(generatedTree);
    var generatedModel = generatedCompilation.GetSemanticModel(generatedTree);
    var fields = generatedTree.GetRoot()
      .DescendantNodes()
      .OfType<VariableDeclaratorSyntax>()
      .Select(variable => generatedModel.GetDeclaredSymbol(variable))
      .OfType<IFieldSymbol>()
      .Where(field =>
        field.ContainingType.ToDisplayString(
          SymbolDisplayFormat.CSharpErrorMessageFormat) ==
        "FsusUI.Avalonia.FsusTokens" &&
        field.IsConst &&
        field.Type.SpecialType == SpecialType.System_String)
      .ToDictionary(field => field.Name, field => field.ConstantValue as string,
        StringComparer.Ordinal);
    var prefixes = fields
      .Where(pair =>
        pair.Key.EndsWith("Name", StringComparison.Ordinal) &&
        pair.Value is not null)
      .ToDictionary(
        pair => pair.Value!,
        pair => pair.Key[..^"Name".Length],
        StringComparer.Ordinal);
    AssertSetEqual(
      canonicalNames,
      prefixes.Keys.ToHashSet(StringComparer.Ordinal),
      "canonical tokens and generated C# Name constants");

    var resourceFields = fields
      .Where(pair =>
        pair.Key.EndsWith("ResourceKey", StringComparison.Ordinal) &&
        pair.Value is not null)
      .ToList();
    var generatedXaml = XDocument.Parse(
      Read(repoRoot, GeneratedXamlPath, sourceOverrides),
      LoadOptions.PreserveWhitespace);
    var xamlKeys = generatedXaml
      .Descendants()
      .Select(element => element.Attribute(XamlNamespace + "Key")?.Value)
      .Where(key => !string.IsNullOrWhiteSpace(key))
      .Cast<string>()
      .ToHashSet(StringComparer.Ordinal);
    var primaryKeys = prefixes.ToDictionary(
      pair => pair.Key,
      pair =>
      {
        var fieldName = $"{pair.Value}ResourceKey";
        Assert(fields.TryGetValue(fieldName, out var value) &&
          !string.IsNullOrWhiteSpace(value),
          $"generated C# is missing {fieldName}");
        return value!;
      },
      StringComparer.Ordinal);
    foreach (var (canonicalName, primaryKey) in primaryKeys)
    {
      Assert(
        xamlKeys.Contains(primaryKey),
        $"generated XAML is missing primary resource key {primaryKey} for {canonicalName}");
    }
    foreach (var key in xamlKeys)
    {
      Assert(
        primaryKeys.Values.Any(primary =>
          key.StartsWith(primary, StringComparison.Ordinal)),
        $"generated XAML key {key} has no canonical C# Name/ResourceKey owner");
    }

    return canonicalNames.Select(canonicalName =>
    {
      var tokenMetadata = metadata.GetProperty(canonicalName);
      var primaryKey = primaryKeys[canonicalName];
      Assert(
        tokenMetadata.GetProperty("avalonia").GetString() == primaryKey,
        $"{canonicalName} generated metadata disagrees with C# ResourceKey");
      var prefix = prefixes[canonicalName];
      var resourceKeys = resourceFields
        .Where(pair =>
          pair.Key.StartsWith(prefix, StringComparison.Ordinal) &&
          ResourceOwner(pair.Value!, primaryKeys) == canonicalName)
        .Select(pair => pair.Value!)
        .Concat(xamlKeys.Where(key =>
          ResourceOwner(key, primaryKeys) == canonicalName))
        .Distinct(StringComparer.Ordinal)
        .OrderBy(key => key, StringComparer.Ordinal)
        .ToList();
      var propertyNames = generatedTree.GetRoot()
        .DescendantNodes()
        .OfType<PropertyDeclarationSyntax>()
        .Select(property => generatedModel.GetDeclaredSymbol(property))
        .OfType<IPropertySymbol>()
        .Where(property =>
          property.ContainingType.ToDisplayString(
            SymbolDisplayFormat.CSharpErrorMessageFormat) ==
          "FsusUI.Avalonia.FsusTokens")
        .Select(property => property.Name);
      var members = fields.Keys
        .Concat(propertyNames)
        .Where(member => TokenOwner(member, prefixes) == canonicalName)
        .Distinct(StringComparer.Ordinal)
        .OrderBy(name => name, StringComparer.Ordinal)
        .ToList();
      var traceability = tokenMetadata.GetProperty("traceability");
      return new SourceTokenDefinitionSemantics
      {
        CanonicalName = canonicalName,
        Owner = traceability.GetProperty("owner").GetString()!,
        GeneratedOutputs = traceability.GetProperty("generatedOutputs")
          .EnumerateArray()
          .Select(output => output.GetString()!)
          .Where(output =>
            output == GeneratedXamlPath || output == GeneratedCsharpPath)
          .OrderBy(output => output, StringComparer.Ordinal)
          .ToList(),
        ResourceKeys = resourceKeys,
        CsharpMembers = members,
        DeclarationAuthority =
          "canonical-json+roslyn-generated-constants+xml-generated-resources",
      };
    }).ToList();
  }

  private static string? ResourceOwner(
    string resourceKey,
    IReadOnlyDictionary<string, string> primaryKeys) =>
    primaryKeys
      .Where(pair =>
        resourceKey.StartsWith(pair.Value, StringComparison.Ordinal))
      .OrderByDescending(pair => pair.Value.Length)
      .Select(pair => pair.Key)
      .FirstOrDefault();

  private static string? TokenOwner(
    string memberName,
    IReadOnlyDictionary<string, string> prefixes) =>
    prefixes
      .Where(pair =>
        memberName.StartsWith(pair.Value, StringComparison.Ordinal))
      .OrderByDescending(pair => pair.Value.Length)
      .Select(pair => pair.Key)
      .FirstOrDefault();

  private static void IndexCsharpDependencies(
    string repoRoot,
    CSharpCompilation compilation,
    IReadOnlyList<SyntaxTree> syntaxTrees,
    IReadOnlyList<SourceTokenDefinitionSemantics> definitions,
    List<SourceTokenDependencySemantics> dependencies)
  {
    var prefixes = definitions
      .SelectMany(definition => definition.CsharpMembers.Select(member =>
        (member, definition.CanonicalName)))
      .OrderByDescending(pair => pair.member.Length)
      .ToList();
    foreach (var tree in syntaxTrees.Where(tree =>
      NormalizePath(Path.GetRelativePath(repoRoot, tree.FilePath)) !=
      GeneratedCsharpPath))
    {
      var model = compilation.GetSemanticModel(tree);
      var relativePath = NormalizePath(
        Path.GetRelativePath(repoRoot, tree.FilePath));
      foreach (var expression in tree.GetRoot()
        .DescendantNodes()
        .OfType<MemberAccessExpressionSyntax>())
      {
        if (model.GetSymbolInfo(expression).Symbol is not { } symbol ||
            symbol.ContainingType?.ToDisplayString(
              SymbolDisplayFormat.CSharpErrorMessageFormat) !=
            "FsusUI.Avalonia.FsusTokens")
        {
          continue;
        }
        var enclosing = model.GetEnclosingSymbol(expression.SpanStart);
        var owner = PublicOwner(enclosing?.ContainingType);
        var canonicalName = prefixes
          .FirstOrDefault(pair => pair.member == symbol.Name)
          .CanonicalName;
        dependencies.Add(new SourceTokenDependencySemantics
        {
          Kind = "csharp-token-member-reference",
          Authority = "roslyn-symbol-reference",
          SourceFile = relativePath,
          SourceMember = SourceMember(enclosing),
          Dependency = symbol.Name,
          CanonicalName = canonicalName,
          Resolved = canonicalName is not null,
          OwnerType = owner is null ? null : ReflectionTypeName(owner),
          Ownership = owner is null ? "unbound" : "resolved",
          OwnerExpression = enclosing?.ContainingType?.ToDisplayString(
            SymbolDisplayFormat.CSharpErrorMessageFormat),
        });
      }
    }
  }

  private static void IndexXamlDependencies(
    string repoRoot,
    string projectDirectory,
    CSharpCompilation compilation,
    IReadOnlyDictionary<string, string> sourceOverrides,
    IReadOnlyList<SourceTokenDefinitionSemantics> definitions,
    List<SourceTokenDependencySemantics> dependencies)
  {
    var resourceOwners = definitions
      .SelectMany(definition => definition.ResourceKeys.Select(resourceKey =>
        (resourceKey, definition.CanonicalName)))
      .ToDictionary(pair => pair.resourceKey, pair => pair.CanonicalName,
        StringComparer.Ordinal);
    foreach (var file in Directory.EnumerateFiles(
      projectDirectory,
      "*.axaml",
      SearchOption.AllDirectories)
      .Where(file =>
        NormalizePath(Path.GetRelativePath(repoRoot, file)) !=
        GeneratedXamlPath)
      .OrderBy(file => file, StringComparer.Ordinal))
    {
      var relativePath = NormalizePath(Path.GetRelativePath(repoRoot, file));
      var document = XDocument.Parse(
        Read(repoRoot, relativePath, sourceOverrides),
        LoadOptions.PreserveWhitespace);
      foreach (var attribute in document.Descendants().Attributes())
      {
        if (!TryResourceReference(attribute.Value, out var resourceKey))
        {
          continue;
        }
        var owners = ResolveXamlOwners(attribute.Parent!, compilation);
        resourceOwners.TryGetValue(resourceKey, out var canonicalName);
        if (owners.Resolved.Count == 1 && owners.Unbound.Count == 0)
        {
          dependencies.Add(XamlDependency(
            relativePath,
            attribute,
            resourceKey,
            canonicalName,
            owners.Resolved[0],
            "resolved",
            owners.Expression));
          continue;
        }
        dependencies.Add(XamlDependency(
          relativePath,
          attribute,
          resourceKey,
          canonicalName,
          null,
          owners.Resolved.Count > 0 ? "partial" : "unbound",
          owners.Expression));
      }
    }
  }

  private static SourceTokenDependencySemantics XamlDependency(
    string sourceFile,
    XAttribute attribute,
    string resourceKey,
    string? canonicalName,
    string? ownerType,
    string ownership,
    string? ownerExpression) =>
    new()
    {
      Kind = "xaml-resource-reference",
      Authority = "xml-xaml-resource-reference",
      SourceFile = sourceFile,
      SourceMember = XamlMember(attribute),
      Dependency = resourceKey,
      CanonicalName = canonicalName,
      Resolved = canonicalName is not null,
      OwnerType = ownerType,
      Ownership = ownership,
      OwnerExpression = ownerExpression,
    };

  private static (List<string> Resolved, List<string> Unbound, string? Expression)
    ResolveXamlOwners(XElement element, CSharpCompilation compilation)
  {
    var style = element.AncestorsAndSelf()
      .FirstOrDefault(candidate => candidate.Name.LocalName == "Style");
    var expression = style?.Attribute("Selector")?.Value;
    if (string.IsNullOrWhiteSpace(expression))
    {
      var target = element.AncestorsAndSelf()
        .Select(candidate => candidate.Attribute("TargetType")?.Value)
        .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
      expression = target;
    }
    if (string.IsNullOrWhiteSpace(expression))
    {
      return ([], ["<no-selector-or-target>"], null);
    }

    var resolved = new HashSet<string>(StringComparer.Ordinal);
    var unbound = new HashSet<string>(StringComparer.Ordinal);
    foreach (var part in expression.Split(',', StringSplitOptions.TrimEntries))
    {
      var token = SelectorTypeToken(part);
      var separator = token.IndexOf('|');
      if (separator <= 0)
      {
        unbound.Add(part);
        continue;
      }
      var prefix = token[..separator];
      var typeName = token[(separator + 1)..];
      var namespaceValue = style?.Document?.Root?
        .Attributes()
        .FirstOrDefault(attribute =>
          attribute.IsNamespaceDeclaration &&
          attribute.Name.LocalName == prefix)
        ?.Value;
      if (namespaceValue?.StartsWith("using:", StringComparison.Ordinal) != true)
      {
        unbound.Add(part);
        continue;
      }
      var fullName = $"{namespaceValue["using:".Length..]}.{typeName}";
      var symbol = compilation.GetTypeByMetadataName(fullName);
      if (symbol?.DeclaredAccessibility == Accessibility.Public)
      {
        resolved.Add(fullName);
      }
      else
      {
        unbound.Add(part);
      }
    }
    return (
      resolved.OrderBy(name => name, StringComparer.Ordinal).ToList(),
      unbound.OrderBy(value => value, StringComparer.Ordinal).ToList(),
      expression);
  }

  private static string SelectorTypeToken(string selector)
  {
    var end = selector.Length;
    foreach (var delimiter in new[] { '.', ':', '#', '[', ' ', '/', '>' })
    {
      var index = selector.IndexOf(delimiter);
      if (index >= 0 && index < end) end = index;
    }
    return selector[..end].Trim();
  }

  private static bool TryResourceReference(
    string value,
    out string resourceKey)
  {
    resourceKey = "";
    var trimmed = value.Trim();
    if (trimmed.Length < 3 || trimmed[0] != '{' || trimmed[^1] != '}')
    {
      return false;
    }
    var content = trimmed[1..^1].Trim();
    var separator = content.IndexOf(' ');
    if (separator <= 0) return false;
    var extension = content[..separator];
    if (extension is not "DynamicResource" and not "StaticResource")
    {
      return false;
    }
    var argument = content[(separator + 1)..].Trim();
    const string resourceKeyPrefix = "ResourceKey=";
    if (argument.StartsWith(resourceKeyPrefix, StringComparison.Ordinal))
    {
      argument = argument[resourceKeyPrefix.Length..].Trim();
    }
    if (argument.Length == 0 || argument.Contains(','))
    {
      return false;
    }
    resourceKey = argument;
    return true;
  }

  private static string XamlMember(XAttribute attribute)
  {
    var element = attribute.Parent!;
    var style = element.AncestorsAndSelf()
      .FirstOrDefault(candidate => candidate.Name.LocalName == "Style");
    var context = style?.Attribute("Selector")?.Value ??
      element.AncestorsAndSelf()
        .Select(candidate => candidate.Attribute("TargetType")?.Value)
        .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ??
      "<unbound>";
    var property = element.Attribute("Property")?.Value ??
      attribute.Name.LocalName;
    return $"{context}::{element.Name.LocalName}.{property}";
  }

  private static INamedTypeSymbol? PublicOwner(INamedTypeSymbol? type)
  {
    for (var current = type; current is not null; current = current.ContainingType)
    {
      if (current.DeclaredAccessibility == Accessibility.Public &&
          current.ToDisplayString(
            SymbolDisplayFormat.CSharpErrorMessageFormat)
            .StartsWith("FsusUI.Avalonia", StringComparison.Ordinal))
      {
        return current;
      }
    }
    return null;
  }

  private static string SourceMember(ISymbol? symbol) =>
    symbol is null
      ? "<unknown>"
      : $"{ReflectionTypeName(symbol.ContainingType)}.{symbol.Name}";

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

  private static string DependencySortKey(SourceTokenDependencySemantics item) =>
    string.Join(
      "\0",
      item.Kind,
      item.SourceFile,
      item.SourceMember,
      item.Dependency,
      item.OwnerType,
      item.OwnerExpression);

  private static string Read(
    string repoRoot,
    string relativePath,
    IReadOnlyDictionary<string, string> sourceOverrides) =>
    sourceOverrides.TryGetValue(relativePath, out var source)
      ? source
      : File.ReadAllText(Path.Combine(repoRoot, relativePath));

  private static void AssertSetEqual(
    HashSet<string> expected,
    HashSet<string> actual,
    string context)
  {
    var missing = expected.Except(actual, StringComparer.Ordinal).Order().ToList();
    var extra = actual.Except(expected, StringComparer.Ordinal).Order().ToList();
    Assert(
      missing.Count == 0 && extra.Count == 0,
      $"{context} drifted; missing=[{string.Join(",", missing)}] " +
      $"extra=[{string.Join(",", extra)}]");
  }

  private static void Assert(bool condition, string message)
  {
    if (!condition) throw new InvalidOperationException(message);
  }

  private static string NormalizePath(string path) =>
    path.Replace(Path.DirectorySeparatorChar, '/');
}

internal sealed class SourceTokenThemeContract
{
  public string CanonicalAuthority { get; init; } = "";
  public string GeneratedMetadataAuthority { get; init; } = "";
  public string GeneratedXamlAuthority { get; init; } = "";
  public string GeneratedCsharpAuthority { get; init; } = "";
  public bool ContractDeclared { get; init; }
  public bool RenderedEvidenceVerified { get; init; }
  public List<SourceTokenDefinitionSemantics> Definitions { get; init; } = [];
  public List<SourceTokenDependencySemantics> Dependencies { get; init; } = [];
}

internal sealed class SourceTokenDefinitionSemantics
{
  public string CanonicalName { get; init; } = "";
  public string Owner { get; init; } = "";
  public List<string> GeneratedOutputs { get; init; } = [];
  public List<string> ResourceKeys { get; init; } = [];
  public List<string> CsharpMembers { get; init; } = [];
  public string DeclarationAuthority { get; init; } = "";
}

internal sealed class SourceTokenDependencySemantics
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
