using System.Globalization;
using System.Windows.Input;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Metadata;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;

namespace FsusUI.Avalonia.Controls;

public class FsusFileDropEventArgs : RoutedEventArgs
{
  public FsusFileDropEventArgs(
    RoutedEvent? routedEvent,
    object? source,
    IReadOnlyList<IStorageItem> storageItems,
    IReadOnlyList<string> files,
    IReadOnlyList<IStorageItem> rejectedItems,
    IReadOnlyList<string> rejectedFiles,
    DragDropEffects dragEffects = DragDropEffects.Copy)
    : base(routedEvent, source)
  {
    StorageItems = storageItems ?? [];
    Files = files ?? [];
    RejectedItems = rejectedItems ?? [];
    RejectedFiles = rejectedFiles ?? [];
    DragEffects = dragEffects;
  }

  public FsusFileDropEventArgs(
    RoutedEvent? routedEvent,
    object? source,
    IEnumerable<IStorageItem> storageItems,
    IEnumerable<IStorageItem>? rejectedItems = null,
    DragDropEffects dragEffects = DragDropEffects.Copy)
    : this(
      routedEvent,
      source,
      (storageItems ?? []).ToList().AsReadOnly(),
      (storageItems ?? []).Select(FsusDropZone.GetStorageItemPath).ToList().AsReadOnly(),
      (rejectedItems ?? []).ToList().AsReadOnly(),
      (rejectedItems ?? []).Select(FsusDropZone.GetStorageItemPath).ToList().AsReadOnly(),
      dragEffects)
  {
  }

  public FsusFileDropEventArgs(
    RoutedEvent? routedEvent,
    object? source,
    IEnumerable<string> files,
    IEnumerable<string>? rejectedFiles = null,
    DragDropEffects dragEffects = DragDropEffects.Copy)
    : this(
      routedEvent,
      source,
      [],
      (files ?? []).ToList().AsReadOnly(),
      [],
      (rejectedFiles ?? []).ToList().AsReadOnly(),
      dragEffects)
  {
  }

  public IReadOnlyList<IStorageItem> StorageItems { get; }
  public IReadOnlyList<string> Files { get; }
  public IReadOnlyList<IStorageItem> RejectedItems { get; }
  public IReadOnlyList<string> RejectedFiles { get; }
  public DragDropEffects DragEffects { get; }
}

[PseudoClasses(":dragover", ":dropped", ":disabled", ":loading", ":error")]
public class FsusDropZone : ContentControl
{
  private bool hasDropFeedback;
  private int lastAcceptedCount;

  public static readonly RoutedEvent<FsusFileDropEventArgs> FilesDroppedEvent =
    RoutedEvent.Register<FsusDropZone, FsusFileDropEventArgs>(
      nameof(FilesDropped),
      RoutingStrategies.Bubble);

  public static readonly RoutedEvent<FsusFileDropEventArgs> FilesRejectedEvent =
    RoutedEvent.Register<FsusDropZone, FsusFileDropEventArgs>(
      nameof(FilesRejected),
      RoutingStrategies.Bubble);

  public static readonly RoutedEvent<RoutedEventArgs> BrowseRequestedEvent =
    RoutedEvent.Register<FsusDropZone, RoutedEventArgs>(
      nameof(BrowseRequested),
      RoutingStrategies.Bubble);

  public static readonly StyledProperty<ICommand?> BrowseCommandProperty =
    AvaloniaProperty.Register<FsusDropZone, ICommand?>(nameof(BrowseCommand));

  public static readonly StyledProperty<object?> BrowseCommandParameterProperty =
    AvaloniaProperty.Register<FsusDropZone, object?>(nameof(BrowseCommandParameter));

  public static readonly StyledProperty<bool> IsBrowseEnabledProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(IsBrowseEnabled), true);

  public static readonly StyledProperty<bool> AllowMultipleProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(AllowMultiple), true);

  public static readonly StyledProperty<string?> AcceptsProperty =
    AvaloniaProperty.Register<FsusDropZone, string?>(nameof(Accepts));

  public static readonly StyledProperty<Func<IStorageItem, bool>?> ValidationPredicateProperty =
    AvaloniaProperty.Register<FsusDropZone, Func<IStorageItem, bool>?>(nameof(ValidationPredicate));

  public static readonly StyledProperty<Func<string, bool>?> PathValidationPredicateProperty =
    AvaloniaProperty.Register<FsusDropZone, Func<string, bool>?>(nameof(PathValidationPredicate));

  public static readonly StyledProperty<bool> IsDisabledProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(IsDisabled));

  public static readonly StyledProperty<bool> IsLoadingProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(IsLoading));

  public static readonly StyledProperty<bool> IsErrorProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(IsError));

  public static readonly StyledProperty<string?> ErrorMessageProperty =
    AvaloniaProperty.Register<FsusDropZone, string?>(nameof(ErrorMessage));

  public static readonly StyledProperty<bool> HasFilterErrorProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(HasFilterError));

  public static readonly StyledProperty<string?> FilterErrorMessageProperty =
    AvaloniaProperty.Register<FsusDropZone, string?>(nameof(FilterErrorMessage));

  public static readonly StyledProperty<bool> IsDragOverProperty =
    AvaloniaProperty.Register<FsusDropZone, bool>(nameof(IsDragOver));

  public static readonly StyledProperty<string?> InstructionProperty =
    AvaloniaProperty.Register<FsusDropZone, string?>(nameof(Instruction));

  public static readonly StyledProperty<object?> InstructionContentProperty =
    AvaloniaProperty.Register<FsusDropZone, object?>(nameof(InstructionContent));

  public static readonly StyledProperty<string?> HelpTextProperty =
    AvaloniaProperty.Register<FsusDropZone, string?>(nameof(HelpText));

  public static readonly StyledProperty<object?> HelpContentProperty =
    AvaloniaProperty.Register<FsusDropZone, object?>(nameof(HelpContent));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusDropZone, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusDropZone, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public event EventHandler<FsusFileDropEventArgs> FilesDropped
  {
    add => AddHandler(FilesDroppedEvent, value);
    remove => RemoveHandler(FilesDroppedEvent, value);
  }

  public event EventHandler<FsusFileDropEventArgs> FilesRejected
  {
    add => AddHandler(FilesRejectedEvent, value);
    remove => RemoveHandler(FilesRejectedEvent, value);
  }

  public event EventHandler<RoutedEventArgs> BrowseRequested
  {
    add => AddHandler(BrowseRequestedEvent, value);
    remove => RemoveHandler(BrowseRequestedEvent, value);
  }

  public FsusDropZone()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-drop-zone");
    Focusable = true;
    DragDrop.SetAllowDrop(this, true);

    AddHandler(DragDrop.DragEnterEvent, OnDragEnter);
    AddHandler(DragDrop.DragOverEvent, OnDragOver);
    AddHandler(DragDrop.DragLeaveEvent, OnDragLeave);
    AddHandler(DragDrop.DropEvent, OnDrop);

    SyncClasses();
    SyncAutomation();
  }

  public ICommand? BrowseCommand
  {
    get => GetValue(BrowseCommandProperty);
    set => SetValue(BrowseCommandProperty, value);
  }

  public object? BrowseCommandParameter
  {
    get => GetValue(BrowseCommandParameterProperty);
    set => SetValue(BrowseCommandParameterProperty, value);
  }

  public bool IsBrowseEnabled
  {
    get => GetValue(IsBrowseEnabledProperty);
    set => SetValue(IsBrowseEnabledProperty, value);
  }

  public bool AllowMultiple
  {
    get => GetValue(AllowMultipleProperty);
    set => SetValue(AllowMultipleProperty, value);
  }

  public string? Accepts
  {
    get => GetValue(AcceptsProperty);
    set => SetValue(AcceptsProperty, value);
  }

  public Func<IStorageItem, bool>? ValidationPredicate
  {
    get => GetValue(ValidationPredicateProperty);
    set => SetValue(ValidationPredicateProperty, value);
  }

  public Func<string, bool>? PathValidationPredicate
  {
    get => GetValue(PathValidationPredicateProperty);
    set => SetValue(PathValidationPredicateProperty, value);
  }

  public bool IsDisabled
  {
    get => GetValue(IsDisabledProperty);
    set => SetValue(IsDisabledProperty, value);
  }

  public bool IsLoading
  {
    get => GetValue(IsLoadingProperty);
    set => SetValue(IsLoadingProperty, value);
  }

  public bool IsError
  {
    get => GetValue(IsErrorProperty);
    set => SetValue(IsErrorProperty, value);
  }

  public string? ErrorMessage
  {
    get => GetValue(ErrorMessageProperty);
    set => SetValue(ErrorMessageProperty, value);
  }

  public bool HasFilterError
  {
    get => GetValue(HasFilterErrorProperty);
    set => SetValue(HasFilterErrorProperty, value);
  }

  public string? FilterErrorMessage
  {
    get => GetValue(FilterErrorMessageProperty);
    set => SetValue(FilterErrorMessageProperty, value);
  }

  public bool IsDragOver
  {
    get => GetValue(IsDragOverProperty);
    private set => SetValue(IsDragOverProperty, value);
  }

  public string? Instruction
  {
    get => GetValue(InstructionProperty);
    set => SetValue(InstructionProperty, value);
  }

  public object? InstructionContent
  {
    get => GetValue(InstructionContentProperty);
    set => SetValue(InstructionContentProperty, value);
  }

  public string? HelpText
  {
    get => GetValue(HelpTextProperty);
    set => SetValue(HelpTextProperty, value);
  }

  public object? HelpContent
  {
    get => GetValue(HelpContentProperty);
    set => SetValue(HelpContentProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public FsusComponentSize Size
  {
    get => GetValue(SizeProperty);
    set => SetValue(SizeProperty, value);
  }

  public bool RequestBrowse()
  {
    if (IsDisabled || !IsEnabled || IsLoading || !IsBrowseEnabled)
    {
      return false;
    }

    if (BrowseCommand?.CanExecute(BrowseCommandParameter) == true)
    {
      BrowseCommand.Execute(BrowseCommandParameter);
    }

    var args = new RoutedEventArgs(BrowseRequestedEvent, this);
    RaiseEvent(args);
    return true;
  }

  public void HandleDrop(IEnumerable<IStorageItem> items)
  {
    if (IsDisabled || !IsEnabled || IsLoading)
    {
      return;
    }

    var itemList = items?.ToList() ?? [];
    if (itemList.Count == 0)
    {
      return;
    }

    ResetDropResult();

    var accepted = new List<IStorageItem>();
    var rejected = new List<IStorageItem>();

    foreach (var item in itemList)
    {
      if (IsItemAccepted(item))
      {
        accepted.Add(item);
      }
      else
      {
        rejected.Add(item);
      }
    }

    if (!AllowMultiple && accepted.Count > 1)
    {
      for (var index = 1; index < accepted.Count; index++)
      {
        rejected.Add(accepted[index]);
      }

      accepted.RemoveRange(1, accepted.Count - 1);
      HasFilterError = true;
      FilterErrorMessage = "Only a single file is accepted.";
    }

    if (rejected.Count > 0)
    {
      HasFilterError = true;
      if (string.IsNullOrEmpty(FilterErrorMessage))
      {
        var rejectedNames = string.Join(", ", rejected.Select(r => r.Name));
        FilterErrorMessage = $"Files [{rejectedNames}] were rejected. Accepted formats: {Accepts ?? "All"}.";
      }

      var rejectedFiles = rejected.Select(GetStorageItemPath).ToList().AsReadOnly();
      var acceptedFiles = accepted.Select(GetStorageItemPath).ToList().AsReadOnly();
      var rejectedArgs = new FsusFileDropEventArgs(
        FilesRejectedEvent,
        this,
        accepted.AsReadOnly(),
        acceptedFiles,
        rejected.AsReadOnly(),
        rejectedFiles);
      RaiseEvent(rejectedArgs);
    }

    if (accepted.Count > 0)
    {
      var acceptedFiles = accepted.Select(GetStorageItemPath).ToList().AsReadOnly();
      var rejectedFiles = rejected.Select(GetStorageItemPath).ToList().AsReadOnly();
      var dropArgs = new FsusFileDropEventArgs(
        FilesDroppedEvent,
        this,
        accepted.AsReadOnly(),
        acceptedFiles,
        rejected.AsReadOnly(),
        rejectedFiles);
      RaiseEvent(dropArgs);
    }

    SetDropResult(accepted.Count, rejected.Count);
    SyncClasses();
    SyncAutomation();
  }

  public void HandleDrop(IEnumerable<string> filePaths)
  {
    if (IsDisabled || !IsEnabled || IsLoading)
    {
      return;
    }

    var pathList = (filePaths ?? [])
      .Where(path => !string.IsNullOrWhiteSpace(path))
      .ToList();
    if (pathList.Count == 0)
    {
      return;
    }

    ResetDropResult();

    var accepted = new List<string>();
    var rejected = new List<string>();

    foreach (var path in pathList)
    {
      if (IsPathAccepted(path))
      {
        accepted.Add(path);
      }
      else
      {
        rejected.Add(path);
      }
    }

    if (!AllowMultiple && accepted.Count > 1)
    {
      for (var index = 1; index < accepted.Count; index++)
      {
        rejected.Add(accepted[index]);
      }

      accepted.RemoveRange(1, accepted.Count - 1);
      HasFilterError = true;
      FilterErrorMessage = "Only a single file is accepted.";
    }

    if (rejected.Count > 0)
    {
      HasFilterError = true;
      if (string.IsNullOrEmpty(FilterErrorMessage))
      {
        var rejectedNames = string.Join(", ", rejected.Select(System.IO.Path.GetFileName));
        FilterErrorMessage = $"Files [{rejectedNames}] were rejected. Accepted formats: {Accepts ?? "All"}.";
      }

      var rejectedArgs = new FsusFileDropEventArgs(
        FilesRejectedEvent,
        this,
        accepted.AsReadOnly(),
        rejected.AsReadOnly());
      RaiseEvent(rejectedArgs);
    }

    if (accepted.Count > 0)
    {
      var dropArgs = new FsusFileDropEventArgs(
        FilesDroppedEvent,
        this,
        accepted.AsReadOnly(),
        rejected.AsReadOnly());
      RaiseEvent(dropArgs);
    }

    SetDropResult(accepted.Count, rejected.Count);
    SyncClasses();
    SyncAutomation();
  }

  public static string GetStorageItemPath(IStorageItem item)
  {
    try
    {
      var localPath = StorageProviderExtensions.TryGetLocalPath(item);
      if (!string.IsNullOrEmpty(localPath))
      {
        return localPath;
      }
    }
    catch
    {
      // Ignored for non-filesystem items
    }

    if (item.Path is not null)
    {
      return item.Path.IsAbsoluteUri && item.Path.IsFile
        ? item.Path.LocalPath
        : item.Path.ToString();
    }

    return item.Name;
  }

  public static bool MatchesAccept(string fileName, string filePath, string acceptRule)
  {
    if (string.IsNullOrWhiteSpace(acceptRule))
    {
      return true;
    }

    var extension = System.IO.Path.GetExtension(fileName);
    if (string.IsNullOrEmpty(extension))
      extension = System.IO.Path.GetExtension(filePath);

    var patterns = acceptRule
      .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    foreach (var rawPattern in patterns)
    {
      var pattern = rawPattern.Trim();
      if (pattern.StartsWith('.'))
      {
        if (string.Equals(extension, pattern, StringComparison.OrdinalIgnoreCase))
        {
          return true;
        }
      }
      else if (pattern.EndsWith("/*", StringComparison.OrdinalIgnoreCase))
      {
        var category = pattern[..^2];
        if (MatchesMimeCategory(extension, category))
        {
          return true;
        }
      }
      else if (pattern.Contains('/'))
      {
        if (MatchesExactMime(extension, pattern))
        {
          return true;
        }
      }
      else
      {
        var normalized = "." + pattern;
        if (string.Equals(extension, normalized, StringComparison.OrdinalIgnoreCase))
        {
          return true;
        }
      }
    }

    return false;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == IsDisabledProperty ||
        change.Property == IsEnabledProperty ||
        change.Property == IsLoadingProperty ||
        change.Property == IsErrorProperty ||
        change.Property == ErrorMessageProperty ||
        change.Property == HasFilterErrorProperty ||
        change.Property == FilterErrorMessageProperty ||
        change.Property == IsDragOverProperty ||
        change.Property == AllowMultipleProperty ||
        change.Property == SizeProperty ||
        change.Property == InstructionProperty ||
        change.Property == InstructionContentProperty ||
        change.Property == HelpTextProperty ||
        change.Property == HelpContentProperty ||
        change.Property == AccessibleNameProperty ||
        change.Property == AcceptsProperty)
    {
      if (change.Property == IsDisabledProperty)
      {
        Focusable = !IsDisabled && IsEnabled;
      }

      SyncClasses();
      SyncAutomation();
    }
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new DropZoneAutomationPeer(this);

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);

    if (!e.Handled && IsBrowseEnabled && !IsDisabled && IsEnabled && !IsLoading)
    {
      if (e.Key is Key.Enter or Key.Space)
      {
        if (RequestBrowse())
        {
          e.Handled = true;
        }
      }
    }
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);

    if (!e.Handled && IsBrowseEnabled && !IsDisabled && IsEnabled && !IsLoading)
    {
      var point = e.GetCurrentPoint(this);
      if (point.Properties.IsLeftButtonPressed)
      {
        RequestBrowse();
        e.Handled = true;
      }
    }
  }

  protected override void OnPointerEntered(PointerEventArgs e)
  {
    base.OnPointerEntered(e);
    FsusComponentClasses.Ensure(this, "fsus-pointerover", true);
  }

  protected override void OnPointerExited(PointerEventArgs e)
  {
    base.OnPointerExited(e);
    FsusComponentClasses.Ensure(this, "fsus-pointerover", false);
  }

  private void OnDragEnter(object? sender, DragEventArgs e)
  {
    if (IsDisabled || !IsEnabled || IsLoading)
    {
      e.DragEffects = DragDropEffects.None;
      e.Handled = true;
      return;
    }

    var files = e.DataTransfer.TryGetFiles();
    if (files is not null && files.Length > 0)
    {
      ResetDropResult();
      e.DragEffects = DragDropEffects.Copy;
      IsDragOver = true;
      SyncClasses();
      SyncAutomation();
      e.Handled = true;
    }
    else
    {
      e.DragEffects = DragDropEffects.None;
    }
  }

  private void OnDragOver(object? sender, DragEventArgs e)
  {
    if (IsDisabled || !IsEnabled || IsLoading)
    {
      e.DragEffects = DragDropEffects.None;
      e.Handled = true;
      return;
    }

    var files = e.DataTransfer.TryGetFiles();
    if (files is not null && files.Length > 0)
    {
      e.DragEffects = DragDropEffects.Copy;
      if (!IsDragOver)
      {
        IsDragOver = true;
        SyncClasses();
        SyncAutomation();
      }
      e.Handled = true;
    }
    else
    {
      e.DragEffects = DragDropEffects.None;
    }
  }

  private void OnDragLeave(object? sender, DragEventArgs e)
  {
    if (IsDragOver)
    {
      IsDragOver = false;
      SyncClasses();
      SyncAutomation();
    }
  }

  private void OnDrop(object? sender, DragEventArgs e)
  {
    if (IsDragOver)
    {
      IsDragOver = false;
      SyncClasses();
      SyncAutomation();
    }

    if (IsDisabled || !IsEnabled || IsLoading)
    {
      e.DragEffects = DragDropEffects.None;
      e.Handled = true;
      return;
    }

    var files = e.DataTransfer.TryGetFiles();
    if (files is not null && files.Length > 0)
    {
      e.DragEffects = DragDropEffects.Copy;
      HandleDrop(files);
      e.Handled = true;
    }
  }

  private bool IsItemAccepted(IStorageItem item)
  {
    if (item is not IStorageFile)
    {
      return false;
    }

    var localPath = GetStorageItemPath(item);
    try
    {
      if (ValidationPredicate is not null && !ValidationPredicate(item))
      {
        return false;
      }

      if (PathValidationPredicate is not null && !PathValidationPredicate(localPath))
      {
        return false;
      }
    }
    catch
    {
      FilterErrorMessage = "File validation failed.";
      return false;
    }

    if (string.IsNullOrWhiteSpace(Accepts))
    {
      return true;
    }

    return MatchesAccept(item.Name, localPath, Accepts);
  }

  private bool IsPathAccepted(string path)
  {
    try
    {
      if (PathValidationPredicate is not null && !PathValidationPredicate(path))
      {
        return false;
      }
    }
    catch
    {
      FilterErrorMessage = "File validation failed.";
      return false;
    }

    if (string.IsNullOrWhiteSpace(Accepts))
    {
      return true;
    }

    return MatchesAccept(System.IO.Path.GetFileName(path), path, Accepts);
  }

  private static bool MatchesMimeCategory(string extension, string category)
  {
    var ext = extension.ToLowerInvariant();
    return category.ToLowerInvariant() switch
    {
      "image" => ext is ".png" or ".jpg" or ".jpeg" or ".gif" or ".webp" or ".svg" or ".bmp" or ".ico" or ".tiff" or ".tif" or ".heic" or ".avif",
      "video" => ext is ".mp4" or ".webm" or ".mov" or ".avi" or ".mkv" or ".flv" or ".wmv" or ".m4v",
      "audio" => ext is ".mp3" or ".wav" or ".ogg" or ".m4a" or ".flac" or ".aac" or ".wma",
      "text" => ext is ".txt" or ".csv" or ".tsv" or ".md" or ".json" or ".xml" or ".html" or ".css" or ".js" or ".ts" or ".yaml" or ".yml" or ".log",
      _ => false,
    };
  }

  private static bool MatchesExactMime(string extension, string mimeType)
  {
    var ext = extension.ToLowerInvariant();
    return mimeType.ToLowerInvariant() switch
    {
      "application/pdf" => ext == ".pdf",
      "application/json" => ext == ".json",
      "application/zip" => ext is ".zip" or ".tar" or ".gz" or ".7z",
      "application/xml" or "text/xml" => ext == ".xml",
      "text/plain" => ext is ".txt" or ".log",
      "text/csv" => ext == ".csv",
      "text/html" => ext is ".html" or ".htm",
      "image/png" => ext == ".png",
      "image/jpeg" => ext is ".jpg" or ".jpeg",
      "image/gif" => ext == ".gif",
      "image/webp" => ext == ".webp",
      "image/svg+xml" => ext == ".svg",
      _ => false,
    };
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-dragover", IsDragOver);
    FsusComponentClasses.Ensure(this, "fsus-drag-over", IsDragOver);
    FsusComponentClasses.Ensure(this, "fsus-dropped", hasDropFeedback);
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled || !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-loading", IsLoading);
    FsusComponentClasses.Ensure(this, "fsus-has-error", IsError || !string.IsNullOrWhiteSpace(ErrorMessage));
    FsusComponentClasses.Ensure(this, "fsus-filter-error", HasFilterError);
    FsusComponentClasses.Ensure(this, "fsus-single", !AllowMultiple);
    FsusComponentClasses.Ensure(this, "fsus-multiple", AllowMultiple);
    FsusComponentClasses.Ensure(this, "fsus-has-instruction-content", InstructionContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-help-content", HelpContent is not null);

    PseudoClasses.Set(":dragover", IsDragOver);
    PseudoClasses.Set(":dropped", hasDropFeedback);
    PseudoClasses.Set(":loading", IsLoading);
    PseudoClasses.Set(":error", IsError || HasFilterError);
    PseudoClasses.Set(":disabled", IsDisabled || !IsEnabled);
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Polite);

    var name = !string.IsNullOrWhiteSpace(AccessibleName)
      ? AccessibleName
      : !string.IsNullOrWhiteSpace(Instruction)
        ? Instruction
        : "File drop zone";
    AutomationProperties.SetName(this, name);

    var help = !string.IsNullOrWhiteSpace(HelpText)
      ? HelpText
      : !string.IsNullOrWhiteSpace(ErrorMessage)
        ? ErrorMessage
        : !string.IsNullOrWhiteSpace(FilterErrorMessage)
          ? FilterErrorMessage
          : !string.IsNullOrWhiteSpace(Accepts)
            ? $"Accepts: {Accepts}"
            : string.Empty;
    AutomationProperties.SetHelpText(this, help);

    var status = IsDisabled || !IsEnabled
      ? "disabled"
      : IsLoading
        ? "loading"
        : HasFilterError
          ? $"rejected: {FilterErrorMessage ?? "filter error"}"
          : IsError || !string.IsNullOrWhiteSpace(ErrorMessage)
            ? $"error: {ErrorMessage ?? "error"}"
            : IsDragOver
              ? "dragover"
              : hasDropFeedback
                ? $"dropped: {lastAcceptedCount.ToString(CultureInfo.InvariantCulture)} accepted"
                : "ready";
    AutomationProperties.SetItemStatus(this, status);
  }

  private void ResetDropResult()
  {
    hasDropFeedback = false;
    lastAcceptedCount = 0;
    HasFilterError = false;
    FilterErrorMessage = null;
  }

  private void SetDropResult(int acceptedCount, int rejectedCount)
  {
    lastAcceptedCount = acceptedCount;
    hasDropFeedback = acceptedCount > 0 && rejectedCount == 0;
  }

  private sealed class DropZoneAutomationPeer(FsusDropZone owner)
    : ControlAutomationPeer(owner), IInvokeProvider
  {
    protected override bool IsEnabledCore() =>
      owner.IsEnabled && !owner.IsDisabled && !owner.IsLoading;

    public void Invoke() => owner.RequestBrowse();
  }
}
