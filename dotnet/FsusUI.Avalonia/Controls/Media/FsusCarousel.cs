using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Metadata;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Media;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public class FsusCarouselItem : ContentControl
{
  public FsusCarouselItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-carousel-item");
    SyncState(false);
  }

  public FsusCarouselItem(object? content) : this()
  {
    Content = content;
  }

  internal void SyncState(bool active)
  {
    FsusComponentClasses.Ensure(this, "fsus-active", active);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Content));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
  }
}

public class FsusCarousel : ContentControl
{
  public FsusCarousel()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-carousel");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusCarouselItem> Items { get; } = [];
  public int ActiveIndex { get; private set; }
  public bool Autoplay { get; set; }
  public bool ReducedMotion { get; set; }

  public void RefreshItems()
  {
    ActiveIndex = Math.Clamp(ActiveIndex, 0, Math.Max(0, Items.Count - 1));
    for (var index = 0; index < Items.Count; index++)
    {
      Items[index].SyncState(index == ActiveIndex);
    }

    SyncState();
  }

  public bool Next()
  {
    if (Items.Count == 0)
    {
      return false;
    }

    ActiveIndex = (ActiveIndex + 1) % Items.Count;
    RefreshItems();
    return true;
  }

  public bool Previous()
  {
    if (Items.Count == 0)
    {
      return false;
    }

    ActiveIndex = (ActiveIndex - 1 + Items.Count) % Items.Count;
    RefreshItems();
    return true;
  }

  public bool AdvanceAutoplayTick()
  {
    if (!Autoplay || ReducedMotion)
    {
      SyncState();
      return false;
    }

    return Next();
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-autoplay", Autoplay);
    FsusComponentClasses.Ensure(this, "fsus-motion-reduced", ReducedMotion);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Items.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      Items.Count == 0
        ? "empty"
        : $"slide {(ActiveIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Items.Count.ToString(CultureInfo.InvariantCulture)}");
  }
}
