using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;
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
    var compilation = CSharpCompilation.Create(
      assemblyName: "GeneratorFixture",
      syntaxTrees: [CSharpSyntaxTree.ParseText(SourceText.From(source))],
      references:
      [
        MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
        MetadataReference.CreateFromFile(typeof(FsusFormAdapterIncrementalGenerator).Assembly.Location),
      ],
      options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

    GeneratorDriver driver = CSharpGeneratorDriver.Create(new FsusFormAdapterIncrementalGenerator());
    driver = driver.RunGeneratorsAndUpdateCompilation(compilation, out _, out _);
    return driver.GetRunResult();
  }

  private static string SingleRegistrySource(GeneratorDriverRunResult result)
  {
    var source = result.Results
      .SelectMany(generatorResult => generatorResult.GeneratedSources)
      .Single(generated => generated.HintName == "BuiltInFormFieldAdapterRegistry.g.cs");
    return source.SourceText.ToString();
  }
}
