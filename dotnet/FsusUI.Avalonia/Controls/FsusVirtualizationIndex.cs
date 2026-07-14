namespace FsusUI.Avalonia.Controls;

internal sealed class FsusVariableSizeIndex
{
  private double[] tree = [0d];
  private int count;
  private double estimatedSize = 1d;

  public int Count => count;
  public int LastLookupSteps { get; private set; }

  public void Ensure(int itemCount, double estimate, IReadOnlyDictionary<int, double> measurements)
  {
    itemCount = Math.Max(0, itemCount);
    estimate = Math.Max(1d, estimate);
    if (itemCount == count && Math.Abs(estimate - estimatedSize) < 0.001d)
    {
      return;
    }

    count = itemCount;
    estimatedSize = estimate;
    tree = new double[count + 1];
    foreach (var (index, size) in measurements)
    {
      if (index >= 0 && index < count)
      {
        Add(index, Math.Max(1d, size) - estimatedSize);
      }
    }
  }

  public void Update(int index, double previousSize, double nextSize)
  {
    if (index < 0 || index >= count)
    {
      return;
    }

    Add(index, Math.Max(1d, nextSize) - Math.Max(1d, previousSize));
  }

  public double PrefixSize(int exclusiveIndex)
  {
    var bounded = Math.Clamp(exclusiveIndex, 0, count);
    var deviation = 0d;
    var steps = 0;
    for (var cursor = bounded; cursor > 0; cursor -= cursor & -cursor)
    {
      deviation += tree[cursor];
      steps++;
    }

    LastLookupSteps = steps;
    return bounded * estimatedSize + deviation;
  }

  public int FindIndex(double offset)
  {
    if (count == 0)
    {
      LastLookupSteps = 0;
      return 0;
    }

    var target = Math.Max(0d, offset);
    var index = 0;
    var deviation = 0d;
    var bit = HighestPowerOfTwoAtMost(count);
    var steps = 0;
    while (bit != 0)
    {
      var candidate = index + bit;
      if (candidate <= count)
      {
        var candidateDeviation = deviation + tree[candidate];
        var candidateSize = candidate * estimatedSize + candidateDeviation;
        if (candidateSize <= target)
        {
          index = candidate;
          deviation = candidateDeviation;
        }
      }

      bit >>= 1;
      steps++;
    }

    LastLookupSteps = steps;
    return Math.Clamp(index, 0, count - 1);
  }

  public double TotalSize => PrefixSize(count);

  private void Add(int index, double delta)
  {
    for (var cursor = index + 1; cursor <= count; cursor += cursor & -cursor)
    {
      tree[cursor] += delta;
    }
  }

  private static int HighestPowerOfTwoAtMost(int value)
  {
    var result = 1;
    while (result <= value / 2)
    {
      result <<= 1;
    }

    return result;
  }
}
