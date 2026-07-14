using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusVirtualListItemContainer : ContentControl
{
  internal FsusVirtualListItemContainer(int containerId)
  {
    ContainerId = containerId;
    FsusComponentClasses.SetBaseClasses(this, "fsus-virtual-list-item");
    Focusable = true;
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ListItem);
  }

  public int ContainerId { get; }
  public int Index { get; private set; } = -1;
  public string Key { get; private set; } = string.Empty;

  internal void Bind(FsusVirtualListItem item, IDataTemplate? template, double size)
  {
    Index = item.Index;
    Key = item.Key;
    if (Height != size) Height = size;
    if (!ReferenceEquals(ContentTemplate, template)) ContentTemplate = template;
    if (!Equals(Content, item.Content)) Content = item.Content;
    AutomationProperties.SetName(this, item.Content?.ToString() ?? item.Key);
    AutomationProperties.SetItemStatus(
      this,
      $"item {(item.Index + 1).ToString(CultureInfo.InvariantCulture)}");
  }

  internal void Recycle()
  {
    Index = -1;
    Key = string.Empty;
    Content = null;
    ContentTemplate = null;
    DataContext = null;
    AutomationProperties.SetName(this, null);
    AutomationProperties.SetItemStatus(this, null);
  }
}

public sealed class FsusTableV2CellContainer : ContentControl
{
  internal FsusTableV2CellContainer(int containerId)
  {
    ContainerId = containerId;
    FsusComponentClasses.SetBaseClasses(this, "fsus-table-v2-cell");
    Focusable = true;
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.DataItem);
  }

  public int ContainerId { get; }
  public int RowIndex { get; private set; } = -1;
  public int ColumnIndex { get; private set; } = -1;

  internal void Bind(
    int rowIndex,
    int columnIndex,
    object? content,
    IDataTemplate? template,
    double width,
    double height)
  {
    RowIndex = rowIndex;
    ColumnIndex = columnIndex;
    if (Width != width) Width = width;
    if (Height != height) Height = height;
    if (!ReferenceEquals(ContentTemplate, template)) ContentTemplate = template;
    if (!Equals(Content, content)) Content = content;
    AutomationProperties.SetName(
      this,
      content?.ToString() ?? $"Row {rowIndex + 1}, column {columnIndex + 1}");
    AutomationProperties.SetItemStatus(
      this,
      $"row {(rowIndex + 1).ToString(CultureInfo.InvariantCulture)}, column {(columnIndex + 1).ToString(CultureInfo.InvariantCulture)}");
  }

  internal void Recycle()
  {
    RowIndex = -1;
    ColumnIndex = -1;
    Content = null;
    ContentTemplate = null;
    DataContext = null;
    AutomationProperties.SetName(this, null);
    AutomationProperties.SetItemStatus(this, null);
  }
}
