namespace FsusUI.Avalonia.Controls;

public sealed record FsusMarkdownSourceRange(int Start, int End);

public sealed record FsusMarkdownMappedRange(
  FsusMarkdownSourceRange? Range,
  bool Deleted,
  bool PartiallyDeleted);

public sealed class FsusMarkdownEditorPositionMap
{
  private readonly IReadOnlyList<Stage> stages;

  private FsusMarkdownEditorPositionMap(IReadOnlyList<Stage> stages)
  {
    this.stages = stages;
  }

  public static FsusMarkdownEditorPositionMap Create(
    IReadOnlyList<FsusMarkdownEditorChange> changes) =>
    new([new(changes.ToArray())]);

  internal static FsusMarkdownEditorPositionMap Compose(
    IReadOnlyList<IReadOnlyList<FsusMarkdownEditorChange>> stages) =>
    new(stages.Select(changes => new Stage(changes.ToArray())).ToArray());

  public int Map(int offset, int association)
  {
    if (offset < 0)
    {
      throw new ArgumentOutOfRangeException(nameof(offset));
    }
    if (association is not (-1 or 1))
    {
      throw new ArgumentOutOfRangeException(nameof(association));
    }
    return stages.Aggregate(offset, (mapped, stage) => stage.Map(mapped, association));
  }

  public FsusMarkdownMappedRange MapRange(FsusMarkdownSourceRange range)
  {
    ArgumentNullException.ThrowIfNull(range);
    if (range.Start < 0 || range.End < range.Start)
    {
      return new(null, true, false);
    }
    var mapped = new FsusMarkdownMappedRange(range, false, false);
    foreach (var stage in stages)
    {
      if (mapped.Range is null)
      {
        return mapped;
      }
      var next = stage.MapRange(mapped.Range);
      mapped = new(
        next.Range,
        mapped.Deleted || next.Deleted,
        mapped.PartiallyDeleted || next.PartiallyDeleted);
    }
    return mapped;
  }

  private sealed class Stage(IReadOnlyList<FsusMarkdownEditorChange> changes)
  {
    public int Map(int offset, int association)
    {
      var delta = 0;
      foreach (var change in changes)
      {
        if (offset < change.From)
        {
          break;
        }
        if (offset > change.To)
        {
          delta += change.Insert.Length - (change.To - change.From);
          continue;
        }
        if (change.From == change.To)
        {
          if (association < 0)
          {
            return change.From + delta;
          }
          delta += change.Insert.Length;
          continue;
        }
        return change.From + delta + (association > 0 ? change.Insert.Length : 0);
      }
      return offset + delta;
    }

    public FsusMarkdownMappedRange MapRange(FsusMarkdownSourceRange range)
    {
      var deletedUnits = 0;
      foreach (var change in changes)
      {
        var overlapStart = Math.Max(range.Start, change.From);
        var overlapEnd = Math.Min(range.End, change.To);
        if (overlapEnd > overlapStart)
        {
          deletedUnits += overlapEnd - overlapStart;
        }
      }
      var length = range.End - range.Start;
      var deleted = length > 0 && deletedUnits >= length;
      var partiallyDeleted = length > 0 && deletedUnits > 0 && deletedUnits < length;
      if (deleted)
      {
        return new(null, true, false);
      }
      var start = Map(range.Start, -1);
      var end = Map(range.End, 1);
      return new(new(start, Math.Max(start, end)), false, partiallyDeleted);
    }
  }
}
