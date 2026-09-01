namespace FsusUI.Avalonia.Icons;

/// <summary>
/// Resolves file names or extensions to stable generated icon resource keys for
/// compact tree rows and content presenters. Unknown input resolves to
/// <see cref="FsusIconKeys.File"/> so consumers always receive a renderable key.
/// </summary>
public static class FsusFileTypeIcon
{
  /// <summary>Stable fallback key returned for unknown or empty input.</summary>
  public const string FallbackResourceKey = FsusIconKeys.File;

  private static readonly Dictionary<string, string> ExtensionMap = BuildExtensionMap();

  /// <summary>
  /// Resolves a file name or bare extension to its generated icon resource key.
  /// The last extension wins for compound names such as <c>archive.tar.gz</c>.
  /// </summary>
  public static string Resolve(string? fileNameOrExtension)
  {
    var extension = NormalizeExtension(fileNameOrExtension);
    return extension is not null && ExtensionMap.TryGetValue(extension, out var key)
      ? key
      : FallbackResourceKey;
  }

  /// <summary>
  /// Attempts to resolve a file name or bare extension. Returns
  /// <c>false</c> for unknown, empty, or whitespace input; use
  /// <see cref="Resolve"/> when a stable fallback is preferred.
  /// </summary>
  public static bool TryResolve(string? fileNameOrExtension, out string resourceKey)
  {
    var extension = NormalizeExtension(fileNameOrExtension);
    if (extension is not null && ExtensionMap.TryGetValue(extension, out resourceKey!))
    {
      return true;
    }

    resourceKey = FallbackResourceKey;
    return false;
  }

  private static string? NormalizeExtension(string? fileNameOrExtension)
  {
    if (string.IsNullOrWhiteSpace(fileNameOrExtension))
    {
      return null;
    }

    var trimmed = fileNameOrExtension.Trim();
    var dot = trimmed.LastIndexOf('.');
    if (dot < 0)
    {
      return trimmed.ToLowerInvariant();
    }

    return dot == trimmed.Length - 1
      ? null
      : trimmed[(dot + 1)..].ToLowerInvariant();
  }

  private static Dictionary<string, string> BuildExtensionMap()
  {
    var map = new Dictionary<string, string>(StringComparer.Ordinal);
    void Add(string resourceKey, params string[] extensions)
    {
      foreach (var extension in extensions)
      {
        map.Add(extension, resourceKey);
      }
    }

    Add(FsusIconKeys.FileMarkdown, "md", "markdown", "mdown", "mdx", "mkd");
    Add(FsusIconKeys.FileText, "txt", "text", "log");
    Add(
      FsusIconKeys.FileCode,
      "bash", "bat", "c", "cc", "clj", "cmd", "coffee", "cpp", "cs", "cshtml",
      "css", "dart", "fs", "fsx", "go", "gradle", "groovy", "h", "hpp", "htm",
      "html", "java", "js", "jsx", "kt", "kts", "less", "lua", "m", "mm", "php",
      "pl", "ps1", "py", "r", "rb", "rs", "scala", "scss", "sh", "sql", "swift",
      "ts", "tsx", "vb", "vue", "zig");
    Add(
      FsusIconKeys.FileData,
      "avro", "bson", "cbor", "cfg", "conf", "config", "csv", "db", "env",
      "graphql", "gql", "ini", "json", "json5", "jsonc", "ndjson", "parquet",
      "properties", "proto", "sqlite", "toml", "tsv", "xml", "yaml", "yml");
    Add(
      FsusIconKeys.FileImage,
      "ai", "avif", "bmp", "eps", "gif", "heic", "heif", "ico", "icns", "jfif",
      "jpeg", "jpg", "png", "psd", "svg", "tif", "tiff", "webp");
    Add(
      FsusIconKeys.FileArchive,
      "7z", "apk", "bz2", "cab", "deb", "dmg", "ear", "gz", "iso", "jar", "rar",
      "rpm", "tar", "tgz", "war", "xz", "zip", "zst");
    Add(
      FsusIconKeys.FileDocument,
      "doc", "docx", "dot", "dotx", "epub", "key", "mobi", "numbers", "odp",
      "ods", "odt", "pdf", "pages", "ppt", "pptx", "rtf", "xls", "xlsx", "xlsm");

    return map;
  }
}
