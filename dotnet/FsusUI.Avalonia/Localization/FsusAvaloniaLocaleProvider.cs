using Avalonia.Controls;
using Avalonia.Media;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Localization;

public sealed record FsusAvaloniaLocale(
  string Name,
  string CultureName,
  IReadOnlyDictionary<string, string> Messages);

public sealed class FsusAvaloniaLocaleChangedEventArgs(
  FsusAvaloniaLocale locale) : EventArgs
{
  public FsusAvaloniaLocale Locale { get; } = locale;
}

public sealed class FsusAvaloniaLocaleProvider
{
  private readonly Dictionary<string, FsusAvaloniaLocale> locales = new(StringComparer.OrdinalIgnoreCase);
  private readonly Dictionary<string, string> documentedMissingKeys = new(StringComparer.Ordinal);

  private FsusAvaloniaLocaleProvider(IEnumerable<FsusAvaloniaLocale> initialLocales)
  {
    foreach (var locale in initialLocales)
    {
      locales[Normalize(locale.Name)] = locale;
    }

    SetCulture("en");
  }

  public event EventHandler<FsusAvaloniaLocaleChangedEventArgs>? CultureChanged;

  public FsusAvaloniaLocale CurrentLocale { get; private set; } =
    new("en", "en-US", new ReadOnlyDictionary<string, string>(new Dictionary<string, string>()));

  public CultureInfo Culture { get; private set; } = CultureInfo.GetCultureInfo("en-US");

  public FlowDirection FlowDirection =>
    Culture.TextInfo.IsRightToLeft ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;

  public static FsusAvaloniaLocaleProvider CreateDefault() =>
    new(
    [
      new FsusAvaloniaLocale("en", "en-US", new Dictionary<string, string>
      {
        ["el.dialog.close"] = "Close this dialog",
        ["el.messagebox.confirm"] = "OK",
        ["el.messagebox.cancel"] = "Cancel",
        ["el.pagination.total"] = "Total {total}",
        ["el.select.noData"] = "No data",
        ["el.select.loading"] = "Loading",
      }),
      new FsusAvaloniaLocale("zh-cn", "zh-CN", new Dictionary<string, string>
      {
        ["el.messagebox.confirm"] = "确定",
        ["el.messagebox.cancel"] = "取消",
        ["el.pagination.total"] = "共 {total} 条",
        ["el.select.noData"] = "无数据",
        ["el.select.loading"] = "加载中",
      }),
      new FsusAvaloniaLocale("ar", "ar", new Dictionary<string, string>()),
    ]);

  public void RegisterLocale(FsusAvaloniaLocale locale)
  {
    locales[Normalize(locale.Name)] = locale;
  }

  public void SetCulture(string localeName)
  {
    var normalized = Normalize(localeName);
    if (!locales.TryGetValue(normalized, out var locale))
    {
      locale = new FsusAvaloniaLocale(
        normalized,
        CultureNameFromLocale(normalized),
        new Dictionary<string, string>());
      locales[normalized] = locale;
    }

    CurrentLocale = locale;
    Culture = CultureInfo.GetCultureInfo(locale.CultureName);
    CultureChanged?.Invoke(this, new FsusAvaloniaLocaleChangedEventArgs(locale));
  }

  public string T(
    string key,
    IReadOnlyDictionary<string, object?>? replacements = null)
  {
    var fallbackChain = FallbackChain(CurrentLocale.Name);
    foreach (var localeName in fallbackChain)
    {
      if (locales.TryGetValue(localeName, out var locale) &&
        locale.Messages.TryGetValue(key, out var message))
      {
        return Interpolate(message, replacements);
      }
    }

    if (documentedMissingKeys.TryGetValue(key, out var documentedFallback))
    {
      return Interpolate(documentedFallback, replacements);
    }

    throw new KeyNotFoundException(
      $"Missing stable locale key '{key}' for '{CurrentLocale.Name}'.");
  }

  public void DocumentMissingKey(string key, string fallback)
  {
    documentedMissingKeys[key] = fallback;
  }

  public string FormatDate(DateTime value, string format = "g") =>
    value.ToString(format, Culture);

  public string FormatNumber(decimal value, string format = "G") =>
    value.ToString(format, Culture);

  private static IReadOnlyList<string> FallbackChain(string localeName)
  {
    var normalized = Normalize(localeName);
    var chain = new List<string> { normalized };
    var dash = normalized.IndexOf('-', StringComparison.Ordinal);
    if (dash > 0)
    {
      chain.Add(normalized[..dash]);
    }

    if (!chain.Contains("en", StringComparer.OrdinalIgnoreCase))
    {
      chain.Add("en");
    }

    return chain;
  }

  private static string Interpolate(
    string message,
    IReadOnlyDictionary<string, object?>? replacements)
  {
    if (replacements is null)
    {
      return message;
    }

    var result = message;
    foreach (var (key, value) in replacements)
    {
      result = result.Replace(
        $"{{{key}}}",
        Convert.ToString(value, CultureInfo.InvariantCulture),
        StringComparison.Ordinal);
    }

    return result;
  }

  private static string Normalize(string localeName) =>
    string.IsNullOrWhiteSpace(localeName)
      ? "en"
      : localeName.Trim().Replace('_', '-').ToLowerInvariant();

  private static string CultureNameFromLocale(string localeName) =>
    localeName switch
    {
      "en" => "en-US",
      "zh-cn" => "zh-CN",
      _ => localeName,
    };
}

public class FsusLocalizedText : TextBlock
{
  private readonly FsusAvaloniaLocaleProvider provider;
  private string key = string.Empty;

  public FsusLocalizedText(FsusAvaloniaLocaleProvider provider)
  {
    this.provider = provider;
    provider.CultureChanged += (_, _) => RefreshText();
  }

  public string Key
  {
    get => key;
    set
    {
      key = value;
      RefreshText();
    }
  }

  private void RefreshText()
  {
    if (!string.IsNullOrWhiteSpace(key))
    {
      Text = provider.T(key);
      FlowDirection = provider.FlowDirection;
    }
  }
}
