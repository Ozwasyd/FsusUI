using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;
using System.Threading;
using Xunit;

namespace FsusUI.Avalonia.FormGenerator.Tests;

public sealed class FsusFormAdapterIncrementalGeneratorTests
{
  [Fact]
  public void Emits_a_reflection_free_registry_ordered_most_specific_first()
  {
    var result = Run("""
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class TextBoxBase { }
      public class FsusInputBase : TextBoxBase { }
      public class FsusInputNumber : FsusInputBase { }
      [FsusFormFieldAdapterFor(typeof(TextBoxBase))]
      public sealed class TextBoxBaseAdapter : IFsusFormFieldAdapter
      {
        public TextBoxBaseAdapter(TextBoxBase control) { }
      }
      [FsusFormFieldAdapterFor(typeof(FsusInputBase))]
      public sealed class FsusInputBaseAdapter : IFsusFormFieldAdapter
      {
        public FsusInputBaseAdapter(FsusInputBase control) { }
      }
      [FsusFormFieldAdapterFor(typeof(FsusInputNumber))]
      public sealed class FsusInputNumberAdapter : IFsusFormFieldAdapter
      {
        public FsusInputNumberAdapter(FsusInputNumber control) { }
      }
      """);

    Assert.DoesNotContain(
      result.Diagnostics,
      diagnostic => diagnostic.Severity == DiagnosticSeverity.Error);

    var source = SingleRegistrySource(result);
    Assert.DoesNotContain("GetProperty", source, StringComparison.Ordinal);
    Assert.DoesNotContain("PropertyInfo", source, StringComparison.Ordinal);
    Assert.DoesNotContain("ReadProperty", source, StringComparison.Ordinal);
    Assert.DoesNotContain("WriteProperty", source, StringComparison.Ordinal);

    var numberIndex = source.IndexOf("FsusInputNumber", StringComparison.Ordinal);
    var inputIndex = source.IndexOf("FsusInputBase", StringComparison.Ordinal);
    var baseIndex = source.IndexOf("TextBoxBase", StringComparison.Ordinal);
    Assert.True(numberIndex < inputIndex, "most-derived FsusInputNumber must resolve before FsusInputBase");
    Assert.True(inputIndex < baseIndex, "FsusInputBase must resolve before TextBoxBase");
    Assert.Contains("new global::FsusInputNumberAdapter", source, StringComparison.Ordinal);
  }

  [Fact]
  public void Removing_a_registration_removes_the_registry_without_stale_fallback()
  {
    const string header = """
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class ControlBase { }
      """;

    var withRegistration = Run(header + """
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class Adapter : IFsusFormFieldAdapter { public Adapter(ControlBase control) { } }
      """);
    var withoutRegistration = Run(header);

    Assert.DoesNotContain(
      withRegistration.Diagnostics,
      diagnostic => diagnostic.Severity == DiagnosticSeverity.Error);

    var withSource = SingleRegistrySource(withRegistration);
    Assert.Contains("new global::Adapter", withSource, StringComparison.Ordinal);

    var withoutRegistrySources = withoutRegistration.Results
      .SelectMany(result => result.GeneratedSources)
      .Where(generated => generated.HintName == "BuiltInFormFieldAdapterRegistry.g.cs")
      .ToArray();

    Assert.Empty(withoutRegistrySources);
  }

  [Fact]
  public void Deterministic_registry_for_identical_input()
  {
    const string source = """
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class ControlBase { }
      public class DerivedControl : ControlBase { }
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class ControlBaseAdapter : IFsusFormFieldAdapter { public ControlBaseAdapter(ControlBase control) { } }
      [FsusFormFieldAdapterFor(typeof(DerivedControl))]
      public sealed class DerivedControlAdapter : IFsusFormFieldAdapter { public DerivedControlAdapter(DerivedControl control) { } }
      """;

    var first = SingleRegistrySource(Run(source));
    var second = SingleRegistrySource(Run(source));

    Assert.Equal(first, second);
  }

  [Fact]
  public void Incremental_generator_recomputes_registry_when_registration_changes()
  {
    const string header = """
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class ControlBase { }
      """;

    var initialTree = CSharpSyntaxTree.ParseText(SourceText.From(header + """
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class Adapter : IFsusFormFieldAdapter { public Adapter(ControlBase control) { } }
      """));
    var initialCompilation = CreateCompilation(initialTree);

    GeneratorDriver driver = CSharpGeneratorDriver.Create(new FsusFormAdapterIncrementalGenerator());
    driver = driver.RunGenerators(initialCompilation, CancellationToken.None);
    var before = RegistrySources(driver.GetRunResult());

    Assert.Single(before);
    Assert.Contains("new global::Adapter", before[0], StringComparison.Ordinal);

    var modifiedTree = initialTree.WithChangedText(SourceText.From(header + """
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class ReplacementAdapter : IFsusFormFieldAdapter { public ReplacementAdapter(ControlBase control) { } }
      """));
    var modifiedCompilation = initialCompilation.ReplaceSyntaxTree(initialTree, modifiedTree);
    driver = driver.RunGenerators(modifiedCompilation, CancellationToken.None);
    var after = RegistrySources(driver.GetRunResult());

    Assert.Single(after);
    Assert.DoesNotContain("new global::Adapter", after[0], StringComparison.Ordinal);
    Assert.Contains("new global::ReplacementAdapter", after[0], StringComparison.Ordinal);
  }

  [Theory]
  [InlineData("[FsusFormFieldAdapterFor(typeof(ControlBase))] public sealed class Adapter : IFsusFormFieldAdapter { public Adapter() { } }")]
  [InlineData("[FsusFormFieldAdapterFor(typeof(ControlBase))] public sealed class Adapter : IFsusFormFieldAdapter { public Adapter(ControlBase a, ControlBase b) { } }")]
  [InlineData("[FsusFormFieldAdapterFor(typeof(ControlBase))] public sealed class Adapter { public Adapter(ControlBase control) { } }")]
  public void Reports_invalid_registrations_as_stable_diagnostics(string adapter)
  {
    var result = Run($$"""
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class ControlBase { }
      {{adapter}}
      """);

    Assert.Contains(
      result.Diagnostics,
      diagnostic => diagnostic.Id == "FSUSFORM001");
  }

  [Fact]
  public void Reports_duplicate_control_registration()
  {
    var result = Run("""
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class ControlBase { }
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class FirstAdapter : IFsusFormFieldAdapter { public FirstAdapter(ControlBase control) { } }
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class SecondAdapter : IFsusFormFieldAdapter { public SecondAdapter(ControlBase control) { } }
      """);

    Assert.Contains(
      result.Diagnostics,
      diagnostic => diagnostic.Id == "FSUSFORM001" && diagnostic.GetMessage().Contains("Duplicate", StringComparison.Ordinal));
  }

  [Fact]
  public void Converts_unexpected_failures_to_a_stable_diagnostic()
  {
    var result = Run("""
      using System;
      public sealed class FsusFormFieldAdapterForAttribute : Attribute
      {
        public FsusFormFieldAdapterForAttribute(Type controlType) => ControlType = controlType;
        public Type ControlType { get; }
      }
      public interface IFsusFormFieldAdapter { }
      public class ControlBase { }
      [FsusFormFieldAdapterFor(typeof(ControlBase))]
      public sealed class Adapter : IFsusFormFieldAdapter { public Adapter(ControlBase control) { } }
      """);

    Assert.DoesNotContain(
      result.Diagnostics,
      diagnostic => diagnostic.Severity == DiagnosticSeverity.Error && diagnostic.Id == "AD0001");
  }

  private static GeneratorDriverRunResult Run(string source)
  {
    var compilation = CreateCompilation(CSharpSyntaxTree.ParseText(SourceText.From(source)));
    GeneratorDriver driver = CSharpGeneratorDriver.Create(new FsusFormAdapterIncrementalGenerator());
    driver = driver.RunGeneratorsAndUpdateCompilation(compilation, out _, out _);
    return driver.GetRunResult();
  }

  private static CSharpCompilation CreateCompilation(params SyntaxTree[] syntaxTrees) =>
    CSharpCompilation.Create(
      assemblyName: "GeneratorFixture",
      syntaxTrees: syntaxTrees,
      references:
      [
        MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
        MetadataReference.CreateFromFile(typeof(FsusFormAdapterIncrementalGenerator).Assembly.Location),
      ],
      options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

  private static string[] RegistrySources(GeneratorDriverRunResult result) =>
    result.Results
      .SelectMany(generatorResult => generatorResult.GeneratedSources)
      .Where(generated => generated.HintName == "BuiltInFormFieldAdapterRegistry.g.cs")
      .Select(generated => generated.SourceText.ToString())
      .ToArray();

  private static string SingleRegistrySource(GeneratorDriverRunResult result)
  {
    var source = result.Results
      .SelectMany(generatorResult => generatorResult.GeneratedSources)
      .Single(generated => generated.HintName == "BuiltInFormFieldAdapterRegistry.g.cs");
    return source.SourceText.ToString();
  }
}
