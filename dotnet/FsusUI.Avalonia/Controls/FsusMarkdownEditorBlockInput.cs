using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed record FsusMarkdownBlockInputNode(string Id, string Kind, int Start, int End);

public sealed record FsusMarkdownBlockInputContext(
  string Key,
  FsusMarkdownEditorSelection Selection,
  string Source,
  bool Composing,
  IReadOnlyList<FsusMarkdownBlockInputNode> Nodes);

public sealed record FsusMarkdownBlockInputIntent(
  string Key,
  string Context,
  string? NodeId,
  string Position,
  string Action);

public sealed record FsusMarkdownBlockInputPlan(
  FsusMarkdownBlockInputIntent Intent,
  FsusMarkdownEditorTransaction? Transaction,
  string? Rejected);

/// <summary>
/// Native port of the Web markdown editor's block-input-intent resolver
/// (vue/packages/components/markdown-editor/src/markdown-editor-input-intent.ts).
/// Offsets are UTF-16 code units on both platforms, so direct char indexing
/// matches the Web semantics. The projection nodes are supplied by the shared
/// projection runtime; no parsing happens here.
/// </summary>
public static class FsusMarkdownEditorBlockInput
{
  private static readonly char[] JsWhiteSpace =
  [
    '\u0009', '\u000A', '\u000B', '\u000C', '\u000D', '\u0020', '\u00A0',
    '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005',
    '\u2006', '\u2007', '\u2008', '\u2009', '\u200A', '\u2028', '\u2029',
    '\u202F', '\u205F', '\u3000', '\uFEFF',
  ];

  public static FsusMarkdownBlockInputPlan Resolve(FsusMarkdownBlockInputContext context)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(context.Selection);
    ArgumentNullException.ThrowIfNull(context.Source);
    ArgumentNullException.ThrowIfNull(context.Nodes);

    var source = context.Source;
    var selection = context.Selection;
    var caret = selection.Start;
    var collapsed = selection.Start == selection.End;
    var node = SmallestContainingNode(context.Nodes, caret);
    var kind = node is null ? "ordinary" : MapContextKind(node.Kind);
    var line = LineBoundsAt(source, caret);
    var lineText = Slice(source, line.Start, line.End);
    var empty = kind switch
    {
      "list" or "task" => ListMarkerOf(lineText, kind) is { } listMarker &&
        TrimJs(Slice(lineText, listMarker.ContentStart, lineText.Length)).Length == 0,
      "quote" => QuotePrefixOf(lineText) is { } quotePrefix &&
        TrimJs(Slice(lineText, quotePrefix.ContentStart, lineText.Length)).Length == 0,
      _ => node is not null &&
        TrimJs(Slice(source, node.Start, node.End)).Length == 0,
    };
    var position = PositionOf(source, caret, node, kind, empty);

    if (context.Composing)
    {
      return new(
        new FsusMarkdownBlockInputIntent(context.Key, kind, node?.Id, position, "noop"),
        null,
        "composition-active");
    }

    var finish = (string action, FsusMarkdownEditorTransaction? transaction) =>
      new FsusMarkdownBlockInputPlan(
        new FsusMarkdownBlockInputIntent(context.Key, kind, node?.Id, position, action),
        transaction,
        null);

    if (!collapsed && context.Key is "tab" or "shift-tab")
    {
      return finish(
        context.Key == "tab" ? "indent-selection" : "outdent-selection",
        IndentLines(source, selection, context.Key == "shift-tab"));
    }

    if (!collapsed && context.Key is "backspace" or "delete" or "enter" or "shift-enter")
    {
      if (context.Key is "enter" or "shift-enter")
      {
        return finish(
          "insert-break",
          TransactionOf(selection.Start, selection.End, "\n", selection.Start + 1));
      }
      return finish(
        context.Key == "backspace" ? "delete-backward" : "delete-forward",
        TransactionOf(selection.Start, selection.End, string.Empty, selection.Start));
    }

    var action = ActionFor(kind, context.Key, position);
    return action switch
    {
      "table-hook" => finish(action, null),
      "indent-list" or "indent-selection" => finish(action, IndentLines(source, selection, false)),
      "outdent-list" or "outdent-selection" => finish(action, IndentLines(source, selection, true)),
      "insert-spaces" => finish(action, TransactionOf(caret, caret, "  ", caret + 2)),
      "passthrough-tab" or "noop" => finish(action, null),
      "continue-list" or "exit-list" => finish(
        action,
        PlanListEnter(source, caret, kind == "task" ? "task" : "list")),
      "continue-quote" or "exit-quote" => finish(action, PlanQuoteEnter(source, caret)),
      "insert-break" => finish(action, TransactionOf(caret, caret, "\n", caret + 1)),
      "strip-marker" => finish(
        action,
        PlanStripMarker(
          source,
          caret,
          kind == "quote" ? "quote" : kind == "task" ? "task" : "list")),
      "merge-previous" => finish(action, MergeAcross(source, caret, "previous")),
      "merge-next" => finish(action, MergeAcross(source, caret, "next")),
      "delete-backward" => finish(action, DeleteGrapheme(source, caret, "backward")),
      "delete-forward" => finish(action, DeleteGrapheme(source, caret, "forward")),
      _ => finish(action, null),
    };
  }

  private static string ActionFor(string context, string key, string position)
  {
    if (context == "table")
    {
      return "table-hook";
    }
    if (key == "tab")
    {
      if (context is "list" or "task")
      {
        return "indent-list";
      }
      return context == "code" ? "insert-spaces" : "passthrough-tab";
    }
    if (key == "shift-tab")
    {
      return context is "list" or "task" ? "outdent-list" : "passthrough-tab";
    }
    if (key == "shift-enter")
    {
      return "insert-break";
    }
    if (key == "enter")
    {
      if (context is "list" or "task")
      {
        return position == "empty" ? "exit-list" : "continue-list";
      }
      if (context == "quote")
      {
        return position == "empty" ? "exit-quote" : "continue-quote";
      }
      return "insert-break";
    }
    if (key == "backspace")
    {
      if (context is "list" or "task" or "quote" && position is "start" or "empty")
      {
        return "strip-marker";
      }
      if (position is "start" or "document-start")
      {
        return "merge-previous";
      }
      return "delete-backward";
    }
    if (key == "delete")
    {
      return position is "end" or "document-end" ? "merge-next" : "delete-forward";
    }
    return "noop";
  }

  private static string MapContextKind(string kind) => kind switch
  {
    "paragraph" or "explicit-paragraph" => "paragraph",
    "heading" => "heading",
    "list" => "list",
    "task" => "task",
    "quote" => "quote",
    "code" => "code",
    "table" => "table",
    "image" or "latex" or "mermaid" => "atomic",
    _ => "ordinary",
  };

  private static FsusMarkdownBlockInputNode? SmallestContainingNode(
    IReadOnlyList<FsusMarkdownBlockInputNode> nodes,
    int offset)
  {
    var containing = nodes
      .Where(node => node.Start <= offset && offset <= node.End)
      .ToArray();
    if (containing.Length == 0)
    {
      return null;
    }
    return containing
      .OrderBy(node => node.End - node.Start)
      .ThenBy(node => node.Id, StringComparer.Ordinal)
      .First();
  }

  private static (int Start, int End) LineBoundsAt(string source, int offset)
  {
    var start = 0;
    if (source.Length > 0)
    {
      var probe = Math.Clamp(offset - 1, 0, source.Length - 1);
      start = source.LastIndexOf('\n', probe) + 1;
    }
    var newline = source.IndexOf('\n', Math.Clamp(offset, 0, source.Length));
    var end = newline == -1 ? source.Length : newline;
    return (start, end);
  }

  private static int LineBoundsContentStart(int indentLength, int parsedEnd, string line) =>
    Math.Min(Math.Max(indentLength, parsedEnd), line.Length);

  private sealed record ListMarker(
    string Indent,
    string Prefix,
    int ContentStart,
    bool Ordered,
    int Number,
    char Closer);

  private static ListMarker? ListMarkerOf(string line, string kind)
  {
    var index = 0;
    while (CharAt(line, index) is ' ' or '\t')
    {
      index += 1;
    }
    var indent = line[..index];
    if (kind == "task" || CharAt(line, index) is '-' or '*' or '+')
    {
      var marker = CharAt(line, index);
      if (marker is not ('-' or '*' or '+'))
      {
        return null;
      }
      var cursor = index + 1;
      if (CharAt(line, cursor) == ' ')
      {
        cursor += 1;
      }
      var task = string.Empty;
      if (CharAt(line, cursor) == '[' && CharAt(line, cursor + 2) == ']')
      {
        task = line.Substring(cursor, 3);
        cursor += 3;
        if (CharAt(line, cursor) == ' ')
        {
          cursor += 1;
        }
      }
      return new(
        indent,
        $"{indent}{marker}{(task.Length > 0 ? $" {task}" : string.Empty)} ",
        LineBoundsContentStart(indent.Length, cursor, line),
        false,
        0,
        '\0');
    }
    var digits = string.Empty;
    while (CharAt(line, index) is >= '0' and <= '9')
    {
      digits += CharAt(line, index);
      index += 1;
    }
    var closer = CharAt(line, index);
    if (digits.Length == 0 || (closer != '.' && closer != ')'))
    {
      return null;
    }
    index += 1;
    if (CharAt(line, index) == ' ')
    {
      index += 1;
    }
    return new(
      indent,
      $"{indent}{digits}{closer} ",
      LineBoundsContentStart(indent.Length, index, line),
      true,
      int.Parse(digits, CultureInfo.InvariantCulture),
      closer);
  }

  private static (string Prefix, int ContentStart)? QuotePrefixOf(string line)
  {
    var index = 0;
    while (CharAt(line, index) is ' ' or '\t')
    {
      index += 1;
    }
    if (CharAt(line, index) != '>')
    {
      return null;
    }
    var prefix = line[..(index + 1)];
    if (CharAt(line, index + 1) == ' ')
    {
      prefix += " ";
    }
    return (prefix, prefix.Length);
  }

  private static int ContentStartOf(string source, int offset, string kind)
  {
    var line = LineBoundsAt(source, offset);
    var text = Slice(source, line.Start, line.End);
    if (kind is "list" or "task")
    {
      var marker = ListMarkerOf(text, kind);
      return marker is null ? line.Start : line.Start + marker.ContentStart;
    }
    if (kind == "quote")
    {
      var quote = QuotePrefixOf(text);
      return quote is null ? line.Start : line.Start + quote.Value.ContentStart;
    }
    if (kind == "heading")
    {
      var index = 0;
      while (CharAt(text, index) == '#')
      {
        index += 1;
      }
      if (CharAt(text, index) == ' ')
      {
        index += 1;
      }
      return line.Start + index;
    }
    return line.Start;
  }

  private static string PositionOf(
    string source,
    int offset,
    FsusMarkdownBlockInputNode? node,
    string kind,
    bool empty)
  {
    if (empty)
    {
      return "empty";
    }
    var contentStart = ContentStartOf(source, offset, kind);
    if (offset == contentStart && offset != 0)
    {
      return "start";
    }
    if (offset == 0)
    {
      return "document-start";
    }
    if (offset == source.Length)
    {
      return "document-end";
    }
    if (node is null)
    {
      return "middle";
    }
    if (offset <= node.Start)
    {
      return "start";
    }
    var trailing = CharAt(source, node.End - 1) == '\n' ? node.End - 1 : node.End;
    if (offset >= trailing)
    {
      return "end";
    }
    return "middle";
  }

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
      Selection: new FsusMarkdownEditorSelection(
        selectionStart,
        selectionEnd ?? selectionStart,
        direction));

  private static FsusMarkdownEditorTransaction? DeleteGrapheme(
    string source,
    int offset,
    string direction)
  {
    if (direction == "backward")
    {
      if (offset <= 0)
      {
        return null;
      }
      var boundary = GraphemeBoundaryAt(source, offset - 1);
      return TransactionOf(boundary.Start, offset, string.Empty, boundary.Start);
    }
    if (offset >= source.Length)
    {
      return null;
    }
    var forward = GraphemeBoundaryAt(source, offset);
    return TransactionOf(offset, forward.End, string.Empty, offset);
  }

  private static (int Start, int End) GraphemeBoundaryAt(string source, int offset)
  {
    var enumerator = StringInfo.GetTextElementEnumerator(source);
    while (enumerator.MoveNext())
    {
      var start = enumerator.ElementIndex;
      var end = start + ((string)enumerator.GetTextElement()).Length;
      if (offset >= start && offset < end)
      {
        return (start, end);
      }
      if (offset == source.Length && end == source.Length)
      {
        return (start, end);
      }
    }
    return (offset, offset);
  }

  private static FsusMarkdownEditorTransaction? MergeAcross(
    string source,
    int offset,
    string direction)
  {
    if (direction == "previous")
    {
      if (offset <= 0)
      {
        return null;
      }
      var previous = CharAt(source, offset - 1) == '\n' ? offset - 1 : offset;
      var from = CharAt(source, previous - 1) == '\r' ? previous - 1 : previous;
      if (CharAt(source, from) != '\n' && CharAt(source, from) != '\r')
      {
        return null;
      }
      return TransactionOf(from, offset, string.Empty, from);
    }
    if (offset >= source.Length)
    {
      return null;
    }
    var to = offset;
    if (CharAt(source, to) == '\r')
    {
      to += 1;
    }
    if (CharAt(source, to) == '\n')
    {
      to += 1;
    }
    if (to == offset)
    {
      return null;
    }
    return TransactionOf(offset, to, string.Empty, offset);
  }

  private static FsusMarkdownEditorTransaction IndentLines(
    string source,
    FsusMarkdownEditorSelection selection,
    bool outdent)
  {
    var (blockStart, _) = LineBoundsAt(source, selection.Start);
    var last = LineBoundsAt(source, Math.Max(selection.Start, selection.End));
    var blockEnd = last.End;
    var block = Slice(source, blockStart, blockEnd);
    var lines = block.Split('\n');
    var deltaStart = 0;
    var deltaEnd = 0;
    var walked = 0;
    var next = new string[lines.Length];
    for (var index = 0; index < lines.Length; index += 1)
    {
      var line = lines[index];
      if (!outdent)
      {
        if (blockStart + walked < selection.Start)
        {
          deltaStart += 2;
        }
        if (blockStart + walked < selection.End)
        {
          deltaEnd += 2;
        }
        walked += line.Length + 1;
        next[index] = $"  {line}";
        continue;
      }
      var removable = line.StartsWith("  ", StringComparison.Ordinal)
        ? 2
        : line.StartsWith(' ') || line.StartsWith('\t')
          ? 1
          : 0;
      if (blockStart + walked < selection.Start)
      {
        deltaStart -= removable;
      }
      if (blockStart + walked < selection.End)
      {
        deltaEnd -= removable;
      }
      walked += line.Length + 1;
      next[index] = removable > 0 ? line[removable..] : line;
    }
    return TransactionOf(
      blockStart,
      blockEnd,
      string.Join('\n', next),
      Math.Max(blockStart, selection.Start + deltaStart),
      Math.Max(blockStart, selection.End + deltaEnd),
      selection.Direction);
  }

  private static FsusMarkdownEditorTransaction PlanListEnter(
    string source,
    int caret,
    string kind)
  {
    var line = LineBoundsAt(source, caret);
    var text = Slice(source, line.Start, line.End);
    var marker = ListMarkerOf(text, kind);
    if (marker is null)
    {
      return TransactionOf(caret, caret, "\n", caret + 1);
    }
    var content = Slice(text, marker.ContentStart, text.Length);
    if (TrimJs(content).Length == 0)
    {
      return TransactionOf(
        line.Start,
        caret,
        marker.Indent,
        line.Start + marker.Indent.Length);
    }
    var nextPrefix = marker.Ordered
      ? $"{marker.Indent}{marker.Number + 1}{marker.Closer} "
      : kind == "task"
        ? $"{marker.Indent}{CharAt(text, marker.Indent.Length)} [ ] "
        : marker.Prefix;
    return TransactionOf(
      caret,
      caret,
      $"\n{nextPrefix}",
      caret + 1 + nextPrefix.Length);
  }

  private static FsusMarkdownEditorTransaction PlanQuoteEnter(string source, int caret)
  {
    var line = LineBoundsAt(source, caret);
    var text = Slice(source, line.Start, line.End);
    var quote = QuotePrefixOf(text);
    if (quote is null)
    {
      return TransactionOf(caret, caret, "\n", caret + 1);
    }
    var content = Slice(text, quote.Value.ContentStart, text.Length);
    if (TrimJs(content).Length == 0)
    {
      return TransactionOf(line.Start, caret, string.Empty, line.Start);
    }
    return TransactionOf(
      caret,
      caret,
      $"\n{quote.Value.Prefix}",
      caret + 1 + quote.Value.Prefix.Length);
  }

  private static FsusMarkdownEditorTransaction? PlanStripMarker(
    string source,
    int caret,
    string kind)
  {
    var line = LineBoundsAt(source, caret);
    var text = Slice(source, line.Start, line.End);
    if (kind == "quote")
    {
      var quote = QuotePrefixOf(text);
      if (quote is null || caret != line.Start + quote.Value.ContentStart)
      {
        return null;
      }
      return TransactionOf(
        line.Start,
        line.Start + quote.Value.ContentStart,
        string.Empty,
        line.Start);
    }
    var marker = ListMarkerOf(text, kind);
    if (marker is null || caret != line.Start + marker.ContentStart)
    {
      return null;
    }
    return TransactionOf(
      line.Start,
      line.Start + marker.ContentStart,
      marker.Indent,
      line.Start + marker.Indent.Length);
  }

  private static char CharAt(string value, int index) =>
    index >= 0 && index < value.Length ? value[index] : '\0';

  private static string Slice(string value, int start, int end)
  {
    var from = Math.Clamp(start, 0, value.Length);
    var to = Math.Clamp(end, from, value.Length);
    return value[from..to];
  }

  private static string TrimJs(string value) => value.Trim(JsWhiteSpace);
}
