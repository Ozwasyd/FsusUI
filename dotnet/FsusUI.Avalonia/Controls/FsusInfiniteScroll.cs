using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.LogicalTree;
using Avalonia.VisualTree;

namespace FsusUI.Avalonia.Controls;

/// <summary>
/// Avalonia counterpart of the Vue <c>ElInfiniteScroll</c> directive. It is a
/// <em>behavior</em>, not a render control: it watches a scroll container (an
/// owned <see cref="ScrollViewer"/> or one found on the logical tree) and
/// raises <see cref="Loaded"/> when the scroll position reaches the bottom
/// (within <see cref="Distance"/> of the extent). The Vue directive has no
/// visual surface, so there is nothing to screenshot; behavior is verified by
/// tests that scroll to the bottom and assert the callback fires.
/// </summary>
public class FsusInfiniteScroll
{
  private readonly Control target;
  private readonly Action loaded;
  private readonly double distance;
  private readonly bool disabled;

  private bool armed = true;

  public FsusInfiniteScroll(
    Control target,
    Action loaded,
    double distance = 0,
    bool disabled = false)
  {
    this.target = target;
    this.loaded = loaded;
    this.distance = distance;
    this.disabled = disabled;
  }

  public event EventHandler? Loaded;

  public int FiredCount { get; private set; }

  public void Attach()
  {
    target.PropertyChanged += OnPropertyChanged;
    CheckBottom();
  }

  public void Detach()
  {
    target.PropertyChanged -= OnPropertyChanged;
  }

  private void OnPropertyChanged(object? sender, AvaloniaPropertyChangedEventArgs e)
  {
    CheckBottom();
  }

  private void CheckBottom()
  {
    if (!armed || disabled)
    {
      return;
    }

    var sv = FindScrollViewer();
    if (sv is null)
    {
      return;
    }

    var atBottom =
      sv.Offset.Y + sv.Viewport.Height >= sv.Extent.Height - distance;
    if (atBottom)
    {
      FireOnce();
    }
  }

  private ScrollViewer? FindScrollViewer()
  {
    if (target is ScrollViewer sv)
    {
      return sv;
    }

    return target.FindAncestorOfType<ScrollViewer>();
  }

  private void FireOnce()
  {
    if (!armed)
    {
      return;
    }

    armed = false;
    FiredCount++;
    loaded();
    Loaded?.Invoke(this, EventArgs.Empty);
  }
}
