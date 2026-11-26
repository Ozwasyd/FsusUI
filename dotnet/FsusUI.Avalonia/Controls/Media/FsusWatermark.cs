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

public sealed record FsusWatermarkTile(Point Origin, string Text, double Rotate);

public class FsusWatermark : ContentControl
{
  private readonly List<FsusWatermarkTile> tiles = [];

  public FsusWatermark()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-watermark");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public string ContentText { get; set; } = string.Empty;
  public Size Gap { get; set; } = new(120, 80);
  public Point Offset { get; set; }
  public Size Viewport { get; set; } = new(320, 240);
  public double Rotate { get; set; } = -22d;
  public IReadOnlyList<FsusWatermarkTile> Tiles => tiles.AsReadOnly();

  public void RefreshTiles()
  {
    tiles.Clear();
    var gapX = Math.Max(1d, Gap.Width);
    var gapY = Math.Max(1d, Gap.Height);
    for (var y = Offset.Y; y < Viewport.Height + Offset.Y + gapY; y += gapY)
    {
      for (var x = Offset.X; x < Viewport.Width + Offset.X; x += gapX)
      {
        tiles.Add(new FsusWatermarkTile(new Point(x, y), ContentText, Rotate));
      }
    }

    SyncState();
  }

  private void SyncState()
  {
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, ContentText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, $"{Tiles.Count.ToString(CultureInfo.InvariantCulture)} tiles");
  }
}
