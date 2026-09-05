namespace FsusUI.Avalonia.Controls;

/// <summary>
/// One projection node consumed by the pair-input predicates. Mirrors the Web
/// <c>MarkdownStableProjection</c> node fields the resolver actually reads:
/// <c>kind</c> and <c>rawRange</c>. Offsets are UTF-16 code-unit offsets, the
/// same unit JavaScript strings and C# strings both use, so Web-frozen vector
/// offsets index C# strings directly.
/// </summary>
public sealed record FsusMarkdownPairInputNode(string Kind, FsusMarkdownSourceRange RawRange);

/// <summary>
/// Input for <see cref="FsusMarkdownEditorPairInput.Resolve"/>. Mirrors the Web
/// <c>resolveMarkdownPairInput</c> input object from
/// <c>vue/packages/components/markdown-editor/src/markdown-editor-pair-input.ts</c>.
/// When <see cref="Nodes"/> is null the resolver derives them from
/// <see cref="Source"/> with an internal scanner mirroring the Web predicates.
/// </summary>
public sealed record FsusMarkdownPairInputContext(
  string Source,
  FsusMarkdownEditorSelection Selection,
  string? Inserted = null,
  string? Key = null,
  bool Composing = false,
  bool Readonly = false,
  string? Mode = null,
  IReadOnlyList<FsusMarkdownPairInputNode>? Nodes = null);

/// <summary>
/// Output of <see cref="FsusMarkdownEditorPairInput.Resolve"/>. Mirrors the Web
/// <c>MarkdownPairInputPlan</c>: <c>action</c>, <c>transaction</c> (null on
/// passthrough), and the optional <c>rejected</c> reason.
/// </summary>
public sealed record FsusMarkdownPairInputPlan(
  string Action,
  FsusMarkdownEditorTransaction? Transaction,
  string? Rejected = null);

/// <summary>
/// Native port of the Web smart-pair input resolver
/// (<c>resolveMarkdownPairInput</c> in
/// <c>vue/packages/components/markdown-editor/src/markdown-editor-pair-input.ts</c>).
/// Equivalence is pinned by the frozen <c>pairInput</c> vectors in
/// <c>spec/avalonia/markdown-editor-input-vectors.json</c>.
/// </summary>
public static class FsusMarkdownEditorPairInput
{
  /// <summary>
  /// Mirror of <c>MARKDOWN_PAIR_DEFAULTS</c>. The default pair set is closed;
  /// native must never drift it or invent an Avalonia-specific list.
  /// </summary>
  private static readonly (string Open, string Close)[] MarkdownPairDefaults =
  [
    ("(", ")"),
    ("[", "]"),
    ("{", "}"),
    ("\"", "\""),
    ("'", "'"),
    ("`", "`"),
    ("*", "*"),
    ("_", "_"),
  ];

  private static readonly Dictionary<string, string> OpenToClose =
    new(MarkdownPairDefaults.ToDictionary(pair => pair.Open, pair => pair.Close), StringComparer.Ordinal);

  private static readonly Dictionary<string, string> CloseToOpen =
    new(MarkdownPairDefaults.ToDictionary(pair => pair.Close, pair => pair.Open), StringComparer.Ordinal);

  /// <summary>
  /// Resolves one keystroke against the smart-pair contract, in the exact
  /// rejection order of the Web resolver: composing, readonly, preview mode,
  /// disabled context, then delete-pair / insert-fence / link-destination /
  /// apostrophe / skip-close / wrap / insert-pair / passthrough.
  /// </summary>
  public static FsusMarkdownPairInputPlan Resolve(FsusMarkdownPairInputContext context)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(context.Source);
    ArgumentNullException.ThrowIfNull(context.Selection);
    var source = context.Source;
    var start = context.Selection.Start;
    var end = context.Selection.End;
    var collapsed = start == end;

    if (context.Composing)
    {
      return new("passthrough", null, "composition-active");
    }
    if (context.Readonly)
    {
      return new("passthrough", null, "readonly");
    }
    if (context.Mode == "preview")
    {
      return new("passthrough", null, "preview");
    }

    var nodes = context.Nodes ?? DeriveNodes(source);

    if (ContextDisablesPairing(nodes, start) || IsEscaped(source, start))
    {
      return new("passthrough", null, "disabled-context");
    }

    if (context.Key == "backspace" && collapsed && start > 0 && start < source.Length)
    {
      var before = source.Substring(start - 1, 1);
      var after = source.Substring(start, 1);
      if (OpenToClose.TryGetValue(before, out var pairedClose) && pairedClose == after)
      {
        return new("delete-pair", TransactionOf(start - 1, start + 1, string.Empty, start - 1));
      }
    }

    var inserted = context.Inserted;
    if (string.IsNullOrEmpty(inserted))
    {
      return new("passthrough", null);
    }

    var lineStart = LineStartAt(source, start);
    var beforeCaret = source[lineStart..start];
    var lineEnd = LineEndAt(source, start);
    if (inserted == "`" &&
      collapsed &&
      beforeCaret == "``" &&
      source[lineStart..lineEnd].Trim() == "``")
    {
      return new("insert-fence", TransactionOf(start, end, "`\n\n```", start + 2));
    }

    if (inserted == "(" && collapsed && start > 0 && source[start - 1] == ']')
    {
      if (InsideLinkDestination(nodes, source, start))
      {
        return new("passthrough", null, "disabled-context");
      }
      return new("insert-pair", TransactionOf(start, end, "()", start + 1));
    }

    if (InsideLinkDestination(nodes, source, start))
    {
      return new("passthrough", null, "disabled-context");
    }

    if (inserted == "'" && collapsed && start > 0 && IsWordChar(source[start - 1]))
    {
      return new("passthrough", null);
    }

    if (inserted.Length == 1 &&
      CloseToOpen.ContainsKey(inserted) &&
      collapsed &&
      start < source.Length &&
      source[start] == inserted[0])
    {
      return new("skip-close", TransactionOf(start, start, string.Empty, start + 1));
    }

    if (OpenToClose.TryGetValue(inserted, out var close))
    {
      if (!collapsed)
      {
        var selected = source[start..end];
        return new(
          "wrap",
          TransactionOf(
            start,
            end,
            $"{inserted}{selected}{close}",
            start + 1,
            end + 1,
            context.Selection.Direction));
      }
      return new("insert-pair", TransactionOf(start, end, $"{inserted}{close}", start + 1));
    }

    return new("passthrough", null);
  }

  /// <summary>
  /// Mirror of the Web <c>transactionOf</c>: every pair transaction uses
  /// history "separate" and origin "input".
  /// </summary>
  private static FsusMarkdownEditorTransaction TransactionOf(
    int from,
    int to,
    string insert,
    int selectionStart,
    int? selectionEnd = null,
    string direction = "none") =>
    new(
      [new FsusMarkdownEditorChange(from, to, insert)],
      History: "separate",
      Origin: "input",
      Selection: new FsusMarkdownEditorSelection(selectionStart, selectionEnd ?? selectionStart, direction));

  /// <summary>Mirror of the Web <c>lineStartAt</c>.</summary>
  private static int LineStartAt(string source, int offset)
  {
    if (source.Length == 0)
    {
      return 0;
    }
    var probe = Math.Clamp(offset - 1, 0, source.Length - 1);
    return source.LastIndexOf('\n', probe) + 1;
  }

  private static int LineEndAt(string source, int offset)
  {
    var index = source.IndexOf('\n', Math.Clamp(offset, 0, source.Length));
    return index == -1 ? source.Length : index;
  }

  /// <summary>Mirror of the Web <c>isEscaped</c>.</summary>
  private static bool IsEscaped(string source, int offset)
  {
    var slashes = 0;
    var index = offset - 1;
    while (index >= 0 && source[index] == '\\')
    {
      slashes += 1;
      index -= 1;
    }
    return slashes % 2 == 1;
  }

  /// <summary>
  /// Mirror of the Web <c>isWordChar</c> regex <c>/[0-9A-Za-z\u00c0-\u024f]/</c>.
  /// The Web applies it to a single UTF-16 code unit; C# <see cref="char"/> is a
  /// UTF-16 code unit too, so surrogate halves fall outside every range exactly
  /// as they do in JavaScript.
  /// </summary>
  private static bool IsWordChar(char value) =>
    value is >= '0' and <= '9'
      or >= 'A' and <= 'Z'
      or >= 'a' and <= 'z'
      or >= '\u00c0' and <= '\u024f';

  /// <summary>Mirror of the Web <c>contextDisablesPairing</c>.</summary>
  private static bool ContextDisablesPairing(
    IReadOnlyList<FsusMarkdownPairInputNode> nodes,
    int offset) =>
    nodes.Any(node =>
      node.RawRange.Start <= offset &&
      offset <= node.RawRange.End &&
      (node.Kind == "code" || node.Kind == "malformed"));

  /// <summary>Mirror of the Web <c>insideLinkDestination</c>.</summary>
  private static bool InsideLinkDestination(
    IReadOnlyList<FsusMarkdownPairInputNode> nodes,
    string source,
    int offset) =>
    nodes.Any(node =>
    {
      if (node.Kind != "link" && node.Kind != "image")
      {
        return false;
      }
      if (offset < node.RawRange.Start || offset > node.RawRange.End)
      {
        return false;
      }
      var sliceStart = Math.Clamp(node.RawRange.Start, 0, source.Length);
      var sliceEnd = Math.Clamp(offset, sliceStart, source.Length);
      return source[sliceStart..sliceEnd].Contains("](", StringComparison.Ordinal);
    });

  /// <summary>
  /// Derives the projection nodes the Web resolver reads (kind + rawRange) when
  /// no native projection is supplied. The native side has no parser-backed
  /// projection consumable as a pure function, so this minimal scanner mirrors
  /// the Web predicates for the frozen vector sources and the Web test suite:
  /// fenced code blocks (``` or ~~~) become "code" nodes — inline code spans
  /// deliberately do NOT disable pairing, matching the Web parser behavior
  /// frozen in the pair-inside-code-span vector; "[text](dest)" becomes "link",
  /// "![alt](src)" becomes "image", and an unclosed "[text](dest" fragment on
  /// one line becomes "malformed". Bracket matching is naive (first "]" / first
  /// ")" on the same line, no nesting); hosts needing parser fidelity pass
  /// <see cref="FsusMarkdownPairInputContext.Nodes"/> explicitly.
  /// </summary>
  private static IReadOnlyList<FsusMarkdownPairInputNode> DeriveNodes(string source)
  {
    var fences = CollectFenceNodes(source);
    var nodes = new List<FsusMarkdownPairInputNode>(fences);
    var index = 0;
    while (index < source.Length)
    {
      if (fences.Any(fence => index >= fence.RawRange.Start && index < fence.RawRange.End) ||
        source[index] != '[' ||
        IsEscaped(source, index))
      {
        index += 1;
        continue;
      }
      var start = index > 0 && source[index - 1] == '!' && !IsEscaped(source, index - 1)
        ? index - 1
        : index;
      var labelEnd = source.IndexOf(']', index + 1);
      if (labelEnd == -1)
      {
        index += 1;
        continue;
      }
      if (labelEnd + 1 >= source.Length || source[labelEnd + 1] != '(')
      {
        index = labelEnd + 1;
        continue;
      }
      var destinationEnd = source.IndexOf(')', labelEnd + 2);
      var lineEnd = LineEndAt(source, labelEnd + 2);
      if (destinationEnd != -1 && destinationEnd < lineEnd)
      {
        nodes.Add(new FsusMarkdownPairInputNode(
          start == index ? "link" : "image",
          new FsusMarkdownSourceRange(start, destinationEnd + 1)));
        index = destinationEnd + 1;
      }
      else
      {
        nodes.Add(new FsusMarkdownPairInputNode(
          "malformed",
          new FsusMarkdownSourceRange(start, lineEnd)));
        index = lineEnd + 1;
      }
    }
    return nodes;
  }

  private static IReadOnlyList<FsusMarkdownPairInputNode> CollectFenceNodes(string source)
  {
    var fences = new List<FsusMarkdownPairInputNode>();
    var lineStart = 0;
    string? openMarker = null;
    var openStart = 0;
    while (lineStart <= source.Length)
    {
      var newline = lineStart < source.Length ? source.IndexOf('\n', lineStart) : -1;
      var lineEnd = newline == -1 ? source.Length : newline;
      var trimmed = source[lineStart..lineEnd].Trim();
      if (openMarker is null)
      {
        openMarker = ReadFenceMarker(trimmed);
        openStart = lineStart;
      }
      else if (IsFenceClose(trimmed, openMarker))
      {
        fences.Add(new FsusMarkdownPairInputNode(
          "code",
          new FsusMarkdownSourceRange(openStart, newline == -1 ? source.Length : newline + 1)));
        openMarker = null;
      }
      if (newline == -1)
      {
        break;
      }
      lineStart = newline + 1;
    }
    if (openMarker is not null)
    {
      fences.Add(new FsusMarkdownPairInputNode(
        "code",
        new FsusMarkdownSourceRange(openStart, source.Length)));
    }
    return fences;
  }

  private static string? ReadFenceMarker(string trimmedLine)
  {
    if (trimmedLine.Length < 3 || trimmedLine[0] is not ('`' or '~'))
    {
      return null;
    }
    var count = 0;
    while (count < trimmedLine.Length && trimmedLine[count] == trimmedLine[0])
    {
      count += 1;
    }
    return count >= 3 ? new string(trimmedLine[0], count) : null;
  }

  private static bool IsFenceClose(string trimmedLine, string openMarker) =>
    trimmedLine.Length >= openMarker.Length &&
    trimmedLine.All(character => character == openMarker[0]);
}
