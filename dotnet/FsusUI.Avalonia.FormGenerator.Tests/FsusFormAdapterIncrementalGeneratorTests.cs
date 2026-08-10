using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;
using Xunit;

namespace FsusUI.Avalonia.FormGenerator.Tests;

public sealed class FsusFormAdapterIncrementalGeneratorTests
{
  [Fact]
  public void Generates_direct_member_access_and_a_stable_registry_for_equivalent_input_order()
  {
    var first = Run("""
      using FsusUI.Avalonia.FormGenerator;
      [assembly: FsusFormAdapter(typeof(InvoiceForm))]
      public sealed class InvoiceForm { public string Number { get; set; } = ""; }
      """);
    var second = Run("""
      using FsusUI.Avalonia.FormGenerator;
      public sealed class InvoiceForm { public string Number { get; set; } = ""; }
      [assembly: FsusFormAdapter(typeof(InvoiceForm))]
      """);

    Assert.Empty(first.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error));
    Assert.Empty(second.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error));
    var firstSources = GeneratedSources(first).OrderBy(source => source.HintName).ToArray();
    var secondSources = GeneratedSources(second).OrderBy(source => source.HintName).ToArray();
    Assert.Equal(firstSources.Select(source => source.SourceText.ToString()), secondSources.Select(source => source.SourceText.ToString()));
    Assert.All(firstSources, source => Assert.DoesNotContain("GetProperty", source.SourceText.ToString(), StringComparison.Ordinal));
    Assert.Contains(firstSources, source => source.SourceText.ToString().Contains(".Number", StringComparison.Ordinal));
  }

  [Theory]
  [InlineData("public string Number { get; }")]
  [InlineData("public static string Number { get; set; }")]
  [InlineData("public int Number { get; set; }")]
  [InlineData("public string this[int index] { get => \"\"; set { } }")]
  [InlineData("public string? Number { get; set; }")]
  public void Reports_stable_compile_time_diagnostics_for_unsupported_members(string member)
  {
    var result = Run($"using FsusUI.Avalonia.FormGenerator;\n[assembly: FsusFormAdapter(typeof(InvoiceForm))]\npublic sealed class InvoiceForm {{ {member} }}");

    Assert.Contains(result.Diagnostics, diagnostic => diagnostic.Id.StartsWith("FSUSFORM", StringComparison.Ordinal));
  }

  [Fact]
  public void Reports_duplicate_and_inherited_ambiguity_at_compile_time()
  {
    var result = Run("""
      using FsusUI.Avalonia.FormGenerator;
      [assembly: FsusFormAdapter(typeof(DerivedForm))]
      [assembly: FsusFormAdapter(typeof(DerivedForm))]
      public class BaseForm { public string Number { get; set; } = ""; }
      public sealed class DerivedForm : BaseForm { public new string Number { get; set; } = ""; }
      """);

    Assert.Contains(result.Diagnostics, diagnostic => diagnostic.Id.StartsWith("FSUSFORM", StringComparison.Ordinal));
  }

  [Fact]
  public void Converts_unexpected_generator_failures_to_a_stable_diagnostic()
  {
    var result = Run("""
      using FsusUI.Avalonia.FormGenerator;
      [assembly: FsusFormAdapter(typeof(BrokenForm))]
      public sealed class BrokenForm { public string Number { get; set; } = ""; }
      """);

    Assert.DoesNotContain(result.Diagnostics, diagnostic => diagnostic.Severity == DiagnosticSeverity.Error && diagnostic.Id == "AD0001");
  }

  private static GeneratorDriverRunResult Run(string source)
  {
    var compilation = CSharpCompilation.Create(
      assemblyName: "GeneratorFixture",
      syntaxTrees: [CSharpSyntaxTree.ParseText(SourceText.From(source))],
      references: [
        MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
        MetadataReference.CreateFromFile(typeof(FsusFormAdapterIncrementalGenerator).Assembly.Location),
      ],
      options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
    GeneratorDriver driver = CSharpGeneratorDriver.Create(new FsusFormAdapterIncrementalGenerator());
    driver = driver.RunGeneratorsAndUpdateCompilation(compilation, out _, out _);
    return driver.GetRunResult();
  }

  private static IEnumerable<GeneratedSourceResult> GeneratedSources(GeneratorDriverRunResult result) =>
    result.Results.SelectMany(generatorResult => generatorResult.GeneratedSources);
}
