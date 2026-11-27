namespace FsusUI.Avalonia.Controls;

internal static class FsusMarkdownInputHelpers
{
  internal static FsusMarkdownEditorTransaction TransactionOf(
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

  internal static (int Start, int End) LineBoundsAt(string source, int offset)
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

  // FNV-1a over UTF-16 code units with the same unsigned wraparound as Web Math.imul.
  internal static string HashText(string value)
  {
    var hash = 2166136261u;
    foreach (var unit in value)
    {
      hash = unchecked((hash ^ unit) * 16777619u);
    }
    if (hash == 0)
    {
      return "0";
    }

    // An unsigned 32-bit value needs at most seven base36 digits.
    Span<char> digits = stackalloc char[7];
    var index = digits.Length;
    while (hash > 0)
    {
      digits[--index] = "0123456789abcdefghijklmnopqrstuvwxyz"[(int)(hash % 36)];
      hash /= 36;
    }
    return new string(digits[index..]);
  }
}
