using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public delegate ValueTask<IReadOnlyList<FsusPlatformCommand>> FsusCommandPaletteProvider(
  string query,
  CancellationToken cancellationToken);

public enum FsusCommandPaletteState
{
  Closed,
  Ready,
  Searching,
  Executing,
  Failed,
}

public enum FsusCommandPaletteFailureStage
{
  Search,
  Execution,
}

public enum FsusCommandPaletteInitialSelection
{
  FirstEnabled,
  None,
}

public sealed record FsusCommandPaletteResult(
  string CommandId,
  string Label,
  string? Description,
  string? Category,
  string? IconKey,
  string DisplayShortcut,
  bool IsEnabled,
  bool HasChildren);

public sealed class FsusCommandPaletteExecutedEventArgs(
  FsusCommandPaletteResult result) : EventArgs
{
  public FsusCommandPaletteResult Result { get; } = result;
}

public sealed class FsusCommandPaletteFailedEventArgs(
  FsusCommandPaletteFailureStage stage,
  string? commandId,
  Exception exception) : EventArgs
{
  public FsusCommandPaletteFailureStage Stage { get; } = stage;

  public string? CommandId { get; } = commandId;

  public Exception Exception { get; } = exception;
}
