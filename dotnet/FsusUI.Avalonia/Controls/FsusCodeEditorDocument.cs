namespace FsusUI.Avalonia.Controls;

public enum FsusCodeEditorChangeOrigin
{
  User,
  External,
}

public enum FsusCodeEditorHighlightKind
{
  Marker,
  Heading,
  Emphasis,
  InlineCode,
  Link,
}

public sealed record FsusCodeEditorPosition(int Offset, int Line, int Column);

public sealed record FsusCodeEditorSelection(int Start, int End)
{
  public int Length => Math.Max(0, End - Start);

  public bool IsCollapsed => Start == End;
}

public sealed record FsusCodeEditorHighlightSpan(
  int Start,
  int Length,
  FsusCodeEditorHighlightKind Kind);

public sealed record FsusCodeEditorMatch(int Start, int Length, int Index);

public sealed record FsusCodeEditorScrollPosition(
  double HorizontalOffset,
  double VerticalOffset,
  int AnchorLine);

public sealed class FsusCodeEditorDocumentChangedEventArgs(
  FsusMarkdownDocumentIdentity documentIdentity,
  string text,
  FsusCodeEditorChangeOrigin origin,
  int revision) : EventArgs
{
  public FsusMarkdownDocumentIdentity DocumentIdentity { get; } = documentIdentity;

  public string Text { get; } = text;

  public FsusCodeEditorChangeOrigin Origin { get; } = origin;

  public int Revision { get; } = revision;
}

public sealed class FsusCodeEditorSelectionChangedEventArgs(
  FsusCodeEditorSelection selection,
  FsusCodeEditorPosition caret) : EventArgs
{
  public FsusCodeEditorSelection Selection { get; } = selection;

  public FsusCodeEditorPosition Caret { get; } = caret;
}

internal sealed class FsusCodeEditorDocumentMap
{
  private readonly int[] lineStarts;

  private FsusCodeEditorDocumentMap(string text, int[] lineStarts)
  {
    Text = text;
    this.lineStarts = lineStarts;
  }

  public string Text { get; }

  public int LineCount => lineStarts.Length;

  public static FsusCodeEditorDocumentMap Create(string text)
  {
    ArgumentNullException.ThrowIfNull(text);
    var starts = new List<int> { 0 };
    for (var offset = 0; offset < text.Length; offset += 1)
    {
      if (text[offset] == '\r')
      {
        if (offset + 1 < text.Length && text[offset + 1] == '\n')
        {
          offset += 1;
        }
        starts.Add(offset + 1);
      }
      else if (text[offset] == '\n')
      {
        starts.Add(offset + 1);
      }
    }
    return new(text, starts.ToArray());
  }

  public FsusCodeEditorPosition GetPosition(int offset)
  {
    if (offset < 0 || offset > Text.Length)
    {
      throw new ArgumentOutOfRangeException(nameof(offset));
    }
    var index = Array.BinarySearch(lineStarts, offset);
    if (index < 0)
    {
      index = ~index - 1;
    }
    return new(offset, index + 1, offset - lineStarts[index] + 1);
  }

  public int GetOffset(int line, int column)
  {
    if (line < 1 || line > LineCount)
    {
      throw new ArgumentOutOfRangeException(nameof(line));
    }
    if (column < 1)
    {
      throw new ArgumentOutOfRangeException(nameof(column));
    }
    var lineStart = lineStarts[line - 1];
    var contentEnd = GetLineContentEnd(line);
    var offset = lineStart + column - 1;
    if (offset > contentEnd)
    {
      throw new ArgumentOutOfRangeException(nameof(column));
    }
    return offset;
  }

  public int GetLineStart(int line)
  {
    if (line < 1 || line > LineCount)
    {
      throw new ArgumentOutOfRangeException(nameof(line));
    }
    return lineStarts[line - 1];
  }

  public int GetLineEnd(int line)
  {
    if (line < 1 || line > LineCount)
    {
      throw new ArgumentOutOfRangeException(nameof(line));
    }
    return line == LineCount ? Text.Length : lineStarts[line];
  }

  public int GetLineContentEnd(int line)
  {
    var end = GetLineEnd(line);
    while (end > GetLineStart(line) && Text[end - 1] is '\r' or '\n')
    {
      end -= 1;
    }
    return end;
  }
}

internal static class FsusMarkdownSourceHighlighter
{
  public static IReadOnlyList<FsusCodeEditorHighlightSpan> Highlight(
    string source,
    int from,
    int to)
  {
    ArgumentNullException.ThrowIfNull(source);
    if (from < 0 || to < from || to > source.Length)
    {
      throw new ArgumentOutOfRangeException(nameof(from));
    }

    var spans = new List<FsusCodeEditorHighlightSpan>();
    var lineStart = from;
    while (lineStart < to)
    {
      var lineEnd = source.IndexOf('\n', lineStart, to - lineStart);
      if (lineEnd < 0)
      {
        lineEnd = to;
      }
      HighlightLine(source, lineStart, lineEnd, spans);
      lineStart = Math.Min(to, lineEnd + 1);
    }
    if (from == to && source.Length == 0)
    {
      return [];
    }
    return spans;
  }

  private static void HighlightLine(
    string source,
    int start,
    int end,
    List<FsusCodeEditorHighlightSpan> spans)
  {
    var cursor = start;
    var markerEnd = cursor;
    while (markerEnd < end && source[markerEnd] == '#')
    {
      markerEnd += 1;
    }
    if (markerEnd > cursor && markerEnd < end && char.IsWhiteSpace(source[markerEnd]))
    {
      spans.Add(new(cursor, markerEnd - cursor, FsusCodeEditorHighlightKind.Marker));
      var headingStart = markerEnd + 1;
      if (headingStart < end)
      {
        spans.Add(new(headingStart, end - headingStart, FsusCodeEditorHighlightKind.Heading));
      }
    }
    else if (end - start >= 2 &&
      (source.AsSpan(start, 2).SequenceEqual("- ") ||
       source.AsSpan(start, 2).SequenceEqual("* ") ||
       source.AsSpan(start, 2).SequenceEqual("> ")))
    {
      spans.Add(new(start, 1, FsusCodeEditorHighlightKind.Marker));
    }

    HighlightDelimited(source, start, end, "**", FsusCodeEditorHighlightKind.Emphasis, spans);
    HighlightDelimited(source, start, end, "`", FsusCodeEditorHighlightKind.InlineCode, spans);
    HighlightLinks(source, start, end, spans);
  }

  private static void HighlightDelimited(
    string source,
    int start,
    int end,
    string delimiter,
    FsusCodeEditorHighlightKind kind,
    List<FsusCodeEditorHighlightSpan> spans)
  {
    var cursor = start;
    while (cursor < end)
    {
      var opening = source.IndexOf(delimiter, cursor, end - cursor, StringComparison.Ordinal);
      if (opening < 0)
      {
        return;
      }
      var contentStart = opening + delimiter.Length;
      var closing = source.IndexOf(delimiter, contentStart, end - contentStart, StringComparison.Ordinal);
      if (closing < 0)
      {
        return;
      }
      spans.Add(new(opening, delimiter.Length, FsusCodeEditorHighlightKind.Marker));
      if (closing > contentStart)
      {
        spans.Add(new(contentStart, closing - contentStart, kind));
      }
      spans.Add(new(closing, delimiter.Length, FsusCodeEditorHighlightKind.Marker));
      cursor = closing + delimiter.Length;
    }
  }

  private static void HighlightLinks(
    string source,
    int start,
    int end,
    List<FsusCodeEditorHighlightSpan> spans)
  {
    var cursor = start;
    while (cursor < end)
    {
      var labelOpen = source.IndexOf('[', cursor, end - cursor);
      if (labelOpen < 0)
      {
        return;
      }
      var labelClose = source.IndexOf(']', labelOpen + 1, end - labelOpen - 1);
      if (labelClose < 0 || labelClose + 1 >= end || source[labelClose + 1] != '(')
      {
        cursor = labelOpen + 1;
        continue;
      }
      var targetClose = source.IndexOf(')', labelClose + 2, end - labelClose - 2);
      if (targetClose < 0)
      {
        return;
      }
      spans.Add(new(labelOpen, 1, FsusCodeEditorHighlightKind.Marker));
      if (labelClose > labelOpen + 1)
      {
        spans.Add(new(labelOpen + 1, labelClose - labelOpen - 1, FsusCodeEditorHighlightKind.Link));
      }
      spans.Add(new(labelClose, 2, FsusCodeEditorHighlightKind.Marker));
      if (targetClose > labelClose + 2)
      {
        spans.Add(new(labelClose + 2, targetClose - labelClose - 2, FsusCodeEditorHighlightKind.Link));
      }
      spans.Add(new(targetClose, 1, FsusCodeEditorHighlightKind.Marker));
      cursor = targetClose + 1;
    }
  }
}
