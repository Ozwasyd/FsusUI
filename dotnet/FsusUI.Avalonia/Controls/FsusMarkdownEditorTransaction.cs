namespace FsusUI.Avalonia.Controls;

public sealed record FsusMarkdownEditorSelection(int Start, int End, string Direction = "none");

public sealed record FsusMarkdownEditorChange(int From, int To, string Insert);

public sealed class FsusMarkdownEditorHistory
{
  private readonly Stack<string> undo = new();
  private readonly Stack<string> redo = new();

  public int UndoDepth => undo.Count;

  public int RedoDepth => redo.Count;

  public string Apply(string current, IReadOnlyList<FsusMarkdownEditorChange> changes)
  {
    undo.Push(current);
    redo.Clear();
    var next = current;
    foreach (var change in changes.OrderBy(item => item.From))
    {
      next = string.Concat(next.AsSpan(0, change.From), change.Insert, next.AsSpan(Math.Min(change.To, next.Length)));
    }
    return next;
  }

  public bool TryUndo(string current, out string previous)
  {
    if (undo.Count == 0)
    {
      previous = current;
      return false;
    }
    redo.Push(current);
    previous = undo.Pop();
    return true;
  }
}
