using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusMarkdownClipboardItem(string Type, string? Text = null);

public sealed record FsusMarkdownClipboardFileRef(string Name, long Size, string Type);

public sealed record FsusMarkdownClipboardPasteContext(
  string Source,
  FsusMarkdownEditorSelection Selection,
  IReadOnlyList<FsusMarkdownClipboardItem>? Items = null,
  IReadOnlyList<FsusMarkdownClipboardFileRef>? Files = null,
  string Origin = "paste",
  bool Composing = false,
  bool Readonly = false,
  bool Disabled = false,
  FsusMarkdownEditorMode? Mode = null,
  int? Revision = null,
  int? ExpectedRevision = null,
  int? MaxPasteUnits = null,
  FsusMarkdownDocumentIdentity? CurrentIdentity = null,
  FsusMarkdownDocumentIdentity? DocumentIdentity = null);

public sealed record FsusMarkdownClipboardAttachmentIntent(
  IReadOnlyList<FsusMarkdownClipboardFileRef> Files,
  string Kind,
  string Origin,
  FsusMarkdownEditorSelection Selection,
  FsusMarkdownDocumentIdentity? DocumentIdentity = null,
  int? Revision = null);

public sealed record FsusMarkdownClipboardPastePlan(
  string Action,
  object? AttachmentIntent,
  string Identity,
  string Insert,
  string? Mime,
  string? Rejected,
  FsusMarkdownEditorTransaction? Transaction);

/// <summary>
/// Pure port of the Web clipboard authority
/// (vue/packages/components/markdown-editor/src/markdown-editor-clipboard.ts,
/// resolveMarkdownClipboardPaste). Payload in, plan out; no clipboard I/O.
/// </summary>
public static class FsusMarkdownEditorClipboardInput
{
  public const int MarkdownClipboardMaxPasteUnits = 262_144;

  private static readonly string[] MarkdownMime = ["text/markdown", "text/x-markdown"];

  private static readonly Regex InternalToken = new("syn:[A-Za-z0-9:_-]+", RegexOptions.Compiled);

  private static readonly Regex DataUrl = new("data:[^\\s\"'<>]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);

  private static readonly HashSet<string> BlockBreak = new(StringComparer.Ordinal)
  {
    "p", "div", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "section", "article", "br", "hr", "table", "ul", "ol",
  };

  private static readonly HashSet<string> SkipTags = new(StringComparer.Ordinal)
  {
    "script", "style", "noscript", "template",
  };

  public static FsusMarkdownClipboardPastePlan Resolve(FsusMarkdownClipboardPasteContext context)
  {
    ArgumentNullException.ThrowIfNull(context);
    var origin = context.Origin ?? "paste";
    var selection = context.Selection;
    var rejected = GateClipboard(context);
    if (rejected is not null)
    {
      return RejectedPaste(rejected, origin, selection, context.Revision);
    }

    var files = context.Files ?? [];
    if (files.Count > 0)
    {
      var body = string.Join(
        "|",
        files.Select(file => $"{file.Name}:{file.Size.ToString(CultureInfo.InvariantCulture)}:{file.Type}"));
      var identity = ClipboardIdentity(origin, "attachment-intent", "files", selection, context.Revision, body);
      return new FsusMarkdownClipboardPastePlan(
        "attachment-intent",
        new FsusMarkdownClipboardAttachmentIntent(
          files.ToArray(),
          "attachment",
          origin,
          selection,
          context.DocumentIdentity,
          context.Revision),
        identity,
        string.Empty,
        "files",
        null,
        null);
    }

    var items = context.Items ?? [];
    var markdown = FirstMarkdownText(items);
    var plain = ItemText(items, "text/plain");
    var html = ItemText(items, "text/html");

    var action = "noop";
    string? mime = null;
    var insert = string.Empty;

    if (markdown is not null)
    {
      action = "markdown-source";
      mime = markdown.Value.Mime;
      insert = markdown.Value.Text;
    }
    else if (plain is not null)
    {
      action = "plain-text";
      mime = "text/plain";
      insert = plain;
    }
    else if (html is not null)
    {
      action = "html-plain";
      mime = "text/html";
      insert = HtmlToSafePlainText(html);
    }

    insert = SanitizeInsert(insert);
    var budget = context.MaxPasteUnits ?? MarkdownClipboardMaxPasteUnits;
    if (insert.Length > budget)
    {
      return RejectedPaste("budget-exceeded", origin, selection, context.Revision);
    }
    if (action == "noop" || insert.Length == 0)
    {
      return new FsusMarkdownClipboardPastePlan(
        "noop",
        null,
        ClipboardIdentity(origin, "noop", mime, selection, context.Revision, string.Empty),
        string.Empty,
        mime,
        "empty",
        null);
    }

    var pasteIdentity = ClipboardIdentity(origin, action, mime, selection, context.Revision, insert);
    return new FsusMarkdownClipboardPastePlan(
      action,
      null,
      pasteIdentity,
      insert,
      mime,
      null,
      TransactionOf(selection, insert, origin, context.Revision, pasteIdentity, mime));
  }

  public static string HtmlToSafePlainText(string html)
  {
    var output = new StringBuilder();
    var index = 0;
    var skipDepth = 0;
    while (index < html.Length)
    {
      var current = html[index];
      if (current == '<')
      {
        var close = html.IndexOf('>', index + 1);
        if (close == -1)
        {
          break;
        }
        var raw = html[(index + 1)..close].Trim();
        var isClose = raw.StartsWith('/');
        var name = raw.TrimStart('/').Split([' ', '\t', '\n', '\r', '\f', '\v', '/'], 2)[0]
          .ToLowerInvariant();
        if (SkipTags.Contains(name))
        {
          skipDepth = isClose ? Math.Max(0, skipDepth - 1) : skipDepth + 1;
        }
        else if (skipDepth == 0 && BlockBreak.Contains(name))
        {
          if (output.Length == 0 || output[^1] != '\n')
          {
            _ = output.Append('\n');
          }
        }
        index = close + 1;
        continue;
      }
      if (skipDepth > 0)
      {
        index += 1;
        continue;
      }
      if (current == '&')
      {
        var semi = html.IndexOf(';', index + 1);
        if (semi != -1 && semi - index < 12)
        {
          _ = output.Append(DecodeEntity(html[(index + 1)..semi]));
          index = semi + 1;
          continue;
        }
      }
      _ = output.Append(current);
      index += 1;
    }
    return output.ToString().Replace('\u00a0', ' ');
  }

  private static string? GateClipboard(FsusMarkdownClipboardPasteContext context)
  {
    if (context.Composing)
    {
      return "composition-active";
    }
    if (context.Readonly)
    {
      return "readonly";
    }
    if (context.Disabled)
    {
      return "disabled";
    }
    if (context.Mode == FsusMarkdownEditorMode.Preview)
    {
      return "preview";
    }
    if (context.ExpectedRevision is int expected &&
      context.Revision is int revision &&
      expected != revision)
    {
      return "stale-document";
    }
    if (!SameDocument(context.DocumentIdentity, context.CurrentIdentity))
    {
      return "stale-document";
    }
    return null;
  }

  private static bool SameDocument(
    FsusMarkdownDocumentIdentity? left,
    FsusMarkdownDocumentIdentity? right)
  {
    if (left is null || right is null)
    {
      return true;
    }
    return string.Equals(left.Id, right.Id, StringComparison.Ordinal) && left.Epoch == right.Epoch;
  }

  private static FsusMarkdownClipboardPastePlan RejectedPaste(
    string rejected,
    string origin,
    FsusMarkdownEditorSelection selection,
    int? revision) =>
    new(
      "noop",
      null,
      ClipboardIdentity(origin, "reject", null, selection, revision, rejected),
      string.Empty,
      null,
      rejected,
      null);

  private static FsusMarkdownEditorTransaction TransactionOf(
    FsusMarkdownEditorSelection selection,
    string insert,
    string origin,
    int? revision,
    string identity,
    string? mime)
  {
    var caret = selection.Start + insert.Length;
    return new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(selection.Start, selection.End, insert)],
      History: "separate",
      Origin: origin,
      ExpectedRevision: revision,
      Selection: new FsusMarkdownEditorSelection(caret, caret, selection.Direction ?? "none"),
      Metadata: new Dictionary<string, object?>(StringComparer.Ordinal)
      {
        ["clipboard"] = origin,
        ["identity"] = identity,
        ["mime"] = mime,
      });
  }

  private static string? ItemText(IReadOnlyList<FsusMarkdownClipboardItem> items, string type) =>
    items.FirstOrDefault(item => string.Equals(item.Type, type, StringComparison.Ordinal))?.Text;

  private static (string Mime, string Text)? FirstMarkdownText(
    IReadOnlyList<FsusMarkdownClipboardItem> items)
  {
    foreach (var type in MarkdownMime)
    {
      var text = ItemText(items, type);
      if (text is not null)
      {
        return (type, text);
      }
    }
    return null;
  }

  private static string SanitizeInsert(string value)
  {
    if (DataUrl.IsMatch(value) && value.Trim().StartsWith("data:", StringComparison.OrdinalIgnoreCase))
    {
      return string.Empty;
    }
    return InternalToken.Replace(value, string.Empty);
  }

  private static string ClipboardIdentity(
    string origin,
    string action,
    string? mime,
    FsusMarkdownEditorSelection selection,
    int? revision,
    string body) =>
    string.Create(CultureInfo.InvariantCulture,
      $"clipboard:{origin}:{action}:{mime ?? "none"}:{selection.Start}:{selection.End}:{revision ?? 0}:{HashText(body)}");

  /// <summary>
  /// FNV-1a 32-bit over UTF-16 code units, rendered as unsigned base36. Mirrors
  /// the Web hashText exactly, including Math.imul wrap-around semantics.
  /// </summary>
  private static string HashText(string value)
  {
    var hash = 2166136261u;
    foreach (var unit in value)
    {
      hash ^= unit;
      hash = unchecked(hash * 16777619u);
    }
    return ToBase36(hash);
  }

  private static string ToBase36(uint value)
  {
    if (value == 0)
    {
      return "0";
    }
    var digits = new char[7];
    var index = digits.Length;
    while (value > 0)
    {
      index -= 1;
      var digit = (int)(value % 36);
      digits[index] = (char)(digit < 10 ? '0' + digit : 'a' + digit - 10);
      value /= 36;
    }
    return new string(digits, index, digits.Length - index);
  }

  private static string DecodeEntity(string body)
  {
    if (body == "amp")
    {
      return "&";
    }
    if (body == "lt")
    {
      return "<";
    }
    if (body == "gt")
    {
      return ">";
    }
    if (body == "quot")
    {
      return "\"";
    }
    if (body == "apos" || body == "#39")
    {
      return "'";
    }
    if (body == "nbsp")
    {
      return " ";
    }
    if (body.StartsWith("#x", StringComparison.Ordinal) || body.StartsWith("#X", StringComparison.Ordinal))
    {
      return int.TryParse(body[2..], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var code)
        ? FromCodePoint(code)
        : string.Empty;
    }
    if (body.StartsWith('#'))
    {
      return int.TryParse(body[1..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var code)
        ? FromCodePoint(code)
        : string.Empty;
    }
    return string.Empty;
  }

  private static string FromCodePoint(int code)
  {
    if (code >= 0xD800 && code <= 0xDFFF)
    {
      return ((char)code).ToString();
    }
    try
    {
      return char.ConvertFromUtf32(code);
    }
    catch (ArgumentOutOfRangeException)
    {
      return string.Empty;
    }
  }
}
