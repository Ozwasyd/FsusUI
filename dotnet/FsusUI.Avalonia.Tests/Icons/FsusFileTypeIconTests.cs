using FsusUI.Avalonia.Icons;

namespace FsusUI.Avalonia.Tests.Icons;

public class FsusFileTypeIconTests
{
  [Theory]
  [InlineData("README.md", FsusIconKeys.FileMarkdown)]
  [InlineData("notes.txt", FsusIconKeys.FileText)]
  [InlineData("Program.cs", FsusIconKeys.FileCode)]
  [InlineData("data.csv", FsusIconKeys.FileData)]
  [InlineData("photo.jpeg", FsusIconKeys.FileImage)]
  [InlineData("archive.tar.gz", FsusIconKeys.FileArchive)]
  [InlineData("report.pdf", FsusIconKeys.FileDocument)]
  [InlineData("logo.svg", FsusIconKeys.FileImage)]
  [InlineData("site.html", FsusIconKeys.FileCode)]
  [InlineData("config.yaml", FsusIconKeys.FileData)]
  public void ResolveMapsFileNamesToSemanticKeys(string fileName, string expected)
  {
    Assert.Equal(expected, FsusFileTypeIcon.Resolve(fileName));
    Assert.True(FsusFileTypeIcon.TryResolve(fileName, out var resourceKey));
    Assert.Equal(expected, resourceKey);
  }

  [Theory]
  [InlineData("md", FsusIconKeys.FileMarkdown)]
  [InlineData(".MD", FsusIconKeys.FileMarkdown)]
  [InlineData("JPG", FsusIconKeys.FileImage)]
  [InlineData(".zip", FsusIconKeys.FileArchive)]
  [InlineData("yml", FsusIconKeys.FileData)]
  public void ResolveAcceptsBareExtensionsCaseInsensitively(
    string extension,
    string expected)
  {
    Assert.Equal(expected, FsusFileTypeIcon.Resolve(extension));
  }

  [Theory]
  [InlineData(null)]
  [InlineData("")]
  [InlineData("   ")]
  [InlineData(".")]
  [InlineData("Makefile")]
  [InlineData("unknown.zzz")]
  [InlineData("archive.tar.")]
  public void ResolveFallsBackToStableFileKeyForUnknownInput(string? input)
  {
    Assert.Equal(FsusFileTypeIcon.FallbackResourceKey, FsusFileTypeIcon.Resolve(input));
    Assert.Equal(FsusIconKeys.File, FsusFileTypeIcon.Resolve(input));
    Assert.False(FsusFileTypeIcon.TryResolve(input, out _));
  }

  [Fact]
  public void FallbackResourceKeyIsTheGeneratedFileKey()
  {
    Assert.Equal("FsusIconFile", FsusFileTypeIcon.FallbackResourceKey);
  }

  [Fact]
  public void EveryMappedKeyIsAGeneratedCatalogConstant()
  {
    var catalogKeys = new[]
    {
      FsusIconKeys.File,
      FsusIconKeys.FileArchive,
      FsusIconKeys.FileCode,
      FsusIconKeys.FileData,
      FsusIconKeys.FileDocument,
      FsusIconKeys.FileImage,
      FsusIconKeys.FileMarkdown,
      FsusIconKeys.FileText,
    };

    Assert.All(
      catalogKeys,
      key => Assert.StartsWith("FsusIconFile", key, StringComparison.Ordinal));
    Assert.Equal(
      catalogKeys.Length,
      catalogKeys.Distinct().Count());
  }
}
