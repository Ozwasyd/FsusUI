using Avalonia.Media;
using FsusUI.Avalonia.Localization;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Localization;

public class FsusAvaloniaLocaleProviderTests
{
  [Fact]
  public void LocaleProviderTranslatesEnglishChineseAndFallbackKeys()
  {
    var provider = FsusAvaloniaLocaleProvider.CreateDefault();

    provider.SetCulture("en");
    Assert.Equal("OK", provider.T("el.messagebox.confirm"));
    Assert.Equal("Total 42", provider.T("el.pagination.total", new Dictionary<string, object?>
    {
      ["total"] = 42,
    }));

    provider.SetCulture("zh-cn");
    Assert.Equal("确定", provider.T("el.messagebox.confirm"));
    Assert.Equal("Close this dialog", provider.T("el.dialog.close"));
    Assert.Equal("zh-cn", provider.CurrentLocale.Name);
    Assert.Equal(FlowDirection.LeftToRight, provider.FlowDirection);
  }

  [Fact]
  public void LocaleProviderFormatsDatesNumbersAndLayoutDirection()
  {
    var provider = FsusAvaloniaLocaleProvider.CreateDefault();
    var instant = new DateTime(2026, 7, 2, 13, 45, 0, DateTimeKind.Utc);

    provider.SetCulture("en-US");
    Assert.Contains("2026", provider.FormatDate(instant, "D"));
    Assert.Equal("1,234.50", provider.FormatNumber(1234.5m, "N2"));

    provider.SetCulture("zh-CN");
    Assert.Contains("2026", provider.FormatDate(instant, "D"));
    Assert.Equal("1,234.50", provider.FormatNumber(1234.5m, "N2"));

    provider.SetCulture("ar");
    Assert.Equal(FlowDirection.RightToLeft, provider.FlowDirection);
  }

  [Fact]
  public void MissingLocaleKeysFailUnlessDocumentedAndMountedTextUpdatesOnCultureChange()
  {
    var provider = FsusAvaloniaLocaleProvider.CreateDefault();
    var text = new FsusLocalizedText(provider)
    {
      Key = "el.select.noData",
    };

    provider.SetCulture("en");
    Assert.Equal("No data", text.Text);

    provider.SetCulture("zh-cn");
    Assert.Equal("无数据", text.Text);

    Assert.Throws<KeyNotFoundException>(() => provider.T("el.unknown.missing"));

    provider.DocumentMissingKey("el.unknown.missing", "Documented fallback");

    Assert.Equal("Documented fallback", provider.T("el.unknown.missing"));
  }

  [Fact]
  public void LocaleVisualBaselineCoversStable41LongCompactLabels()
  {
    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("locale-formatting-stable41-web-avalonia", visualFixture);
    Assert.Contains("long-localized-labels-compact-density", visualFixture);
  }

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
