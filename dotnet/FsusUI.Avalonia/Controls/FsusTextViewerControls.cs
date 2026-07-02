using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusTextBlockKind
{
  Paragraph,
  Heading,
  ListItem,
  Quote,
  Code,
}

public sealed record FsusTextContentBlock(
  FsusTextBlockKind Kind,
  string Text,
  int Level = 0,
  string Language = "");

public sealed record FsusTextViewerRenderBudget(
  int RetainedBlocks,
  double RenderMs,
  double MemoryKb);

public sealed record FsusTextViewerBudgetResult(
  int RetainedBlocks,
  FsusTextViewerRenderBudget Budget)
{
  public bool WithinBudget => RetainedBlocks <= Budget.RetainedBlocks;
}

public class FsusTextViewer : ContentControl
{
  private readonly List<FsusTextContentBlock> renderedBlocks = [];
  private readonly List<FsusTextContentBlock> visibleBlocks = [];

  public FsusTextViewer()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-text-viewer");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public Collection<FsusTextContentBlock> Blocks { get; } = [];
  public int VirtualizationThreshold { get; set; } = 200;
  public int VisibleBlockLimit { get; set; } = 80;
  public FsusTextViewerRenderBudget RenderBudget { get; set; } = new(
    RetainedBlocks: 128,
    RenderMs: 10d,
    MemoryKb: 512d);
  public int FocusedBlockIndex { get; private set; }
  public int VisibleBlockStartIndex { get; private set; }
  public bool HasMixedLanguage { get; private set; }
  public bool LastRenderCanceled { get; private set; }
  public string StateName { get; private set; } = "ready";
  public IReadOnlyList<FsusTextContentBlock> RenderedBlocks => renderedBlocks.AsReadOnly();
  public IReadOnlyList<FsusTextContentBlock> VisibleBlocks => visibleBlocks.AsReadOnly();
  public bool IsVirtualized => renderedBlocks.Count > VirtualizationThreshold;
  public int EstimatedRetainedBlockCount => IsVirtualized ? visibleBlocks.Count + 8 : renderedBlocks.Count;

  public ValueTask<bool> RenderAsync(CancellationToken cancellationToken = default)
  {
    LastRenderCanceled = false;
    renderedBlocks.Clear();
    visibleBlocks.Clear();
    StateName = "rendering";
    SyncState();

    for (var index = 0; index < Blocks.Count; index++)
    {
      if (cancellationToken.IsCancellationRequested)
      {
        LastRenderCanceled = true;
        StateName = "canceled";
        SyncState();
        return ValueTask.FromResult(false);
      }

      renderedBlocks.Add(Blocks[index]);
    }

    HasMixedLanguage = renderedBlocks.Any(block => block.Text.Any(character => character > 127));
    StateName = "ready";
    VisibleBlockStartIndex = 0;
    RebuildVisibleBlocks();
    SyncState();
    return ValueTask.FromResult(true);
  }

  public void ScrollToBlock(int startIndex)
  {
    VisibleBlockStartIndex = Math.Clamp(
      startIndex,
      0,
      Math.Max(0, renderedBlocks.Count - 1));
    RebuildVisibleBlocks();
    SyncState();
  }

  public FsusTextViewerBudgetResult EvaluateBudget() =>
    new(EstimatedRetainedBlockCount, RenderBudget);

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (renderedBlocks.Count == 0)
    {
      return ValueTask.FromResult(false);
    }

    if (key == Key.Down)
    {
      FocusedBlockIndex = Math.Min(renderedBlocks.Count - 1, FocusedBlockIndex + 1);
      EnsureFocusedVisible();
      SyncState();
      return ValueTask.FromResult(true);
    }

    if (key == Key.Up)
    {
      FocusedBlockIndex = Math.Max(0, FocusedBlockIndex - 1);
      EnsureFocusedVisible();
      SyncState();
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  private void EnsureFocusedVisible()
  {
    if (FocusedBlockIndex < VisibleBlockStartIndex)
    {
      VisibleBlockStartIndex = FocusedBlockIndex;
    }
    else if (FocusedBlockIndex >= VisibleBlockStartIndex + Math.Max(1, VisibleBlockLimit))
    {
      VisibleBlockStartIndex = FocusedBlockIndex - Math.Max(1, VisibleBlockLimit) + 1;
    }

    RebuildVisibleBlocks();
  }

  private void RebuildVisibleBlocks()
  {
    visibleBlocks.Clear();
    visibleBlocks.AddRange(IsVirtualized
      ? renderedBlocks.Skip(VisibleBlockStartIndex).Take(Math.Max(1, VisibleBlockLimit))
      : renderedBlocks);
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
    FsusComponentClasses.Ensure(this, "fsus-mixed-language", HasMixedLanguage);
    FsusComponentClasses.Ensure(this, "fsus-rendering", StateName == "rendering");
    FsusComponentClasses.Ensure(this, "fsus-canceled", StateName == "canceled");
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, renderedBlocks.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Text);
    AutomationProperties.SetItemStatus(
      this,
      $"{StateName}, {renderedBlocks.Count.ToString(CultureInfo.InvariantCulture)} blocks, focus {(FocusedBlockIndex + 1).ToString(CultureInfo.InvariantCulture)} of {Math.Max(1, renderedBlocks.Count).ToString(CultureInfo.InvariantCulture)}");
  }
}
