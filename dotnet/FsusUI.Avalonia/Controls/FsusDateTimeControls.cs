using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusDateChangedEventArgs(
  DateOnly? oldValue,
  DateOnly? newValue) : EventArgs
{
  public DateOnly? OldValue { get; } = oldValue;
  public DateOnly? NewValue { get; } = newValue;
}

public sealed class FsusTimeChangedEventArgs(
  TimeOnly? oldValue,
  TimeOnly? newValue) : EventArgs
{
  public TimeOnly? OldValue { get; } = oldValue;
  public TimeOnly? NewValue { get; } = newValue;
}

public sealed record FsusDateShortcut(string Label, DateOnly Date);

public sealed record FsusCalendarDay(
  DateOnly Date,
  bool IsCurrentMonth,
  bool IsDisabled,
  bool IsSelected,
  bool IsInRange);

public sealed record FsusTimeSelectOption(
  TimeOnly Value,
  string Label,
  bool IsDisabled);

public class FsusCalendar : ContentControl
{
  private readonly List<FsusCalendarDay> visibleDays = [];

  public FsusCalendar()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-calendar");
    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusDateChangedEventArgs>? SelectedDateChanged;

  public string? AccessibleName { get; set; }
  public DateOnly DisplayDate { get; set; } = new(2026, 1, 1);
  public DateOnly FocusedDate { get; set; } = new(2026, 1, 1);
  public DateOnly? SelectedDate { get; private set; }
  public DateOnly? RangeStart { get; private set; }
  public DateOnly? RangeEnd { get; private set; }
  public DayOfWeek FirstDayOfWeek { get; set; } = DayOfWeek.Monday;
  public string Format { get; set; } = "yyyy-MM-dd";
  public string Locale { get; set; } = "en-US";
  public Func<DateOnly, bool>? DisabledDate { get; set; }
  public IReadOnlyList<FsusCalendarDay> VisibleDays => visibleDays.AsReadOnly();

  public string DisplayText =>
    RangeStart is not null && RangeEnd is not null
      ? $"{FormatDate(RangeStart.Value)} - {FormatDate(RangeEnd.Value)}"
      : SelectedDate is { } selected
        ? FormatDate(selected)
        : string.Empty;

  public void RefreshDays()
  {
    visibleDays.Clear();
    var monthStart = new DateOnly(DisplayDate.Year, DisplayDate.Month, 1);
    var startDelta = ((int)monthStart.DayOfWeek - (int)FirstDayOfWeek + 7) % 7;
    var gridStart = monthStart.AddDays(-startDelta);
    for (var index = 0; index < 42; index++)
    {
      var date = gridStart.AddDays(index);
      visibleDays.Add(new FsusCalendarDay(
        date,
        date.Month == DisplayDate.Month,
        IsDisabled(date),
        SelectedDate == date,
        IsInRange(date)));
    }

    SyncState();
  }

  public bool SelectDate(DateOnly date)
  {
    if (IsDisabled(date))
    {
      return false;
    }

    var oldValue = SelectedDate;
    SelectedDate = date;
    FocusedDate = date;
    DisplayDate = new DateOnly(date.Year, date.Month, 1);
    RangeStart = null;
    RangeEnd = null;
    RefreshDays();
    if (oldValue != SelectedDate)
    {
      SelectedDateChanged?.Invoke(this, new FsusDateChangedEventArgs(oldValue, SelectedDate));
    }

    return true;
  }

  public bool SelectRange(DateOnly start, DateOnly end)
  {
    var rangeStart = start <= end ? start : end;
    var rangeEnd = start <= end ? end : start;
    for (var date = rangeStart; date <= rangeEnd; date = date.AddDays(1))
    {
      if (IsDisabled(date))
      {
        return false;
      }
    }

    RangeStart = rangeStart;
    RangeEnd = rangeEnd;
    SelectedDate = rangeStart;
    FocusedDate = rangeStart;
    DisplayDate = new DateOnly(rangeStart.Year, rangeStart.Month, 1);
    RefreshDays();
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    FocusedDate = key switch
    {
      Key.Right => FocusedDate.AddDays(1),
      Key.Left => FocusedDate.AddDays(-1),
      Key.Down => FocusedDate.AddDays(7),
      Key.Up => FocusedDate.AddDays(-7),
      _ => FocusedDate,
    };

    if (key == Key.Enter)
    {
      return ValueTask.FromResult(SelectDate(FocusedDate));
    }

    if (key is Key.Right or Key.Left or Key.Down or Key.Up)
    {
      DisplayDate = new DateOnly(FocusedDate.Year, FocusedDate.Month, 1);
      RefreshDays();
      return ValueTask.FromResult(true);
    }

    return ValueTask.FromResult(false);
  }

  protected string FormatDate(DateOnly date) =>
    date.ToDateTime(TimeOnly.MinValue).ToString(Format, CultureInfo.GetCultureInfo(Locale));

  private bool IsDisabled(DateOnly date) => DisabledDate?.Invoke(date) == true;

  private bool IsInRange(DateOnly date) =>
    RangeStart is not null &&
    RangeEnd is not null &&
    date >= RangeStart.Value &&
    date <= RangeEnd.Value;

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-empty", SelectedDate is null && RangeStart is null);
    FsusComponentClasses.Ensure(this, "fsus-selected", SelectedDate is not null);
    FsusComponentClasses.Ensure(this, "fsus-range", RangeStart is not null && RangeEnd is not null);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Calendar);
    AutomationProperties.SetItemStatus(
      this,
      SelectedDate is { } selected
        ? $"selected {FormatDate(selected)}"
        : "empty");
  }
}

public class FsusDatePicker : ContentControl
{
  public FsusDatePicker()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-date-picker");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public DateOnly? Value { get; private set; }
  public DateOnly? SelectedValue => Value;
  public DateOnly? RangeStart { get; private set; }
  public DateOnly? RangeEnd { get; private set; }
  public DateOnly FocusedDate { get; set; } = new(2026, 1, 1);
  public string Format { get; set; } = "yyyy-MM-dd";
  public string Locale { get; set; } = "en-US";
  public bool IsClearable { get; set; }
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;
  public Func<DateOnly, bool>? DisabledDate { get; set; }
  public Collection<FsusDateShortcut> Shortcuts { get; } = [];

  public string DisplayText =>
    RangeStart is not null && RangeEnd is not null
      ? $"{FormatDate(RangeStart.Value)} - {FormatDate(RangeEnd.Value)}"
      : Value is { } value
        ? FormatDate(value)
        : string.Empty;

  public bool SelectDate(DateOnly date)
  {
    if (DisabledDate?.Invoke(date) == true)
    {
      return false;
    }

    Value = date;
    FocusedDate = date;
    RangeStart = null;
    RangeEnd = null;
    SyncState();
    return true;
  }

  public bool SelectRange(DateOnly start, DateOnly end)
  {
    var rangeStart = start <= end ? start : end;
    var rangeEnd = start <= end ? end : start;
    for (var date = rangeStart; date <= rangeEnd; date = date.AddDays(1))
    {
      if (DisabledDate?.Invoke(date) == true)
      {
        return false;
      }
    }

    RangeStart = rangeStart;
    RangeEnd = rangeEnd;
    Value = rangeStart;
    FocusedDate = rangeStart;
    SyncState();
    return true;
  }

  public bool ApplyShortcut(string label)
  {
    var shortcut = Shortcuts.FirstOrDefault((candidate) => candidate.Label == label);
    return shortcut is not null && SelectDate(shortcut.Date);
  }

  public void ClearSelection()
  {
    if (!IsClearable || (Value is null && RangeStart is null))
    {
      return;
    }

    Value = null;
    RangeStart = null;
    RangeEnd = null;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    FocusedDate = key switch
    {
      Key.Right => FocusedDate.AddDays(1),
      Key.Left => FocusedDate.AddDays(-1),
      Key.Down => FocusedDate.AddDays(7),
      Key.Up => FocusedDate.AddDays(-7),
      _ => FocusedDate,
    };

    return key == Key.Enter
      ? ValueTask.FromResult(SelectDate(FocusedDate))
      : ValueTask.FromResult(key is Key.Right or Key.Left or Key.Down or Key.Up);
  }

  private string FormatDate(DateOnly date) =>
    date.ToDateTime(TimeOnly.MinValue).ToString(Format, CultureInfo.GetCultureInfo(Locale));

  private void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-empty", Value is null && RangeStart is null);
    FsusComponentClasses.Ensure(this, "fsus-selected", Value is not null);
    FsusComponentClasses.Ensure(this, "fsus-range", RangeStart is not null && RangeEnd is not null);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrEmpty(DisplayText) ? "empty" : $"selected {DisplayText}");
  }
}

public class FsusTimePicker : ContentControl
{
  public FsusTimePicker()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-time-picker");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public TimeOnly? Value { get; private set; }
  public TimeOnly? SelectedValue => Value;
  public TimeOnly? RangeStart { get; private set; }
  public TimeOnly? RangeEnd { get; private set; }
  public TimeOnly FocusedTime { get; set; } = new(9, 0);
  public TimeSpan Step { get; set; } = TimeSpan.FromMinutes(30);
  public string Format { get; set; } = "HH:mm";
  public string Locale { get; set; } = "en-US";
  public bool IsClearable { get; set; }
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;
  public Func<TimeOnly, bool>? DisabledTime { get; set; }

  public string DisplayText =>
    RangeStart is not null && RangeEnd is not null
      ? $"{FormatTime(RangeStart.Value)} - {FormatTime(RangeEnd.Value)}"
      : Value is { } value
        ? FormatTime(value)
        : string.Empty;

  public bool SelectTime(TimeOnly time)
  {
    if (DisabledTime?.Invoke(time) == true)
    {
      return false;
    }

    Value = time;
    FocusedTime = time;
    RangeStart = null;
    RangeEnd = null;
    SyncState();
    return true;
  }

  public bool SelectRange(TimeOnly start, TimeOnly end)
  {
    var rangeStart = start <= end ? start : end;
    var rangeEnd = start <= end ? end : start;
    if (DisabledTime?.Invoke(rangeStart) == true || DisabledTime?.Invoke(rangeEnd) == true)
    {
      return false;
    }

    RangeStart = rangeStart;
    RangeEnd = rangeEnd;
    Value = rangeStart;
    FocusedTime = rangeStart;
    SyncState();
    return true;
  }

  public void ClearSelection()
  {
    if (!IsClearable || (Value is null && RangeStart is null))
    {
      return;
    }

    Value = null;
    RangeStart = null;
    RangeEnd = null;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (key == Key.Down)
    {
      FocusedTime = FocusedTime.Add(Step);
      return ValueTask.FromResult(true);
    }

    if (key == Key.Up)
    {
      FocusedTime = FocusedTime.Add(-Step);
      return ValueTask.FromResult(true);
    }

    return key == Key.Enter
      ? ValueTask.FromResult(SelectTime(FocusedTime))
      : ValueTask.FromResult(false);
  }

  private string FormatTime(TimeOnly time) =>
    DateTime.Today.Add(time.ToTimeSpan()).ToString(Format, CultureInfo.GetCultureInfo(Locale));

  private void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-empty", Value is null && RangeStart is null);
    FsusComponentClasses.Ensure(this, "fsus-selected", Value is not null);
    FsusComponentClasses.Ensure(this, "fsus-range", RangeStart is not null && RangeEnd is not null);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrEmpty(DisplayText) ? "empty" : $"selected {DisplayText}");
  }
}

public class FsusTimeSelect : ContentControl
{
  private readonly List<FsusTimeSelectOption> options = [];

  public FsusTimeSelect()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-time-select");
    Focusable = true;
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public TimeOnly Start { get; set; } = new(9, 0);
  public TimeOnly End { get; set; } = new(18, 0);
  public TimeSpan Step { get; set; } = TimeSpan.FromMinutes(30);
  public TimeOnly? Value { get; private set; }
  public TimeOnly? SelectedValue => Value;
  public int HighlightedIndex { get; private set; } = -1;
  public string Format { get; set; } = "HH:mm";
  public string Locale { get; set; } = "en-US";
  public bool IsClearable { get; set; }
  public FsusComponentSize Size { get; set; } = FsusComponentSize.Md;
  public Func<TimeOnly, bool>? DisabledTime { get; set; }
  public IReadOnlyList<FsusTimeSelectOption> Options => options.AsReadOnly();

  public string DisplayText =>
    Value is { } value
      ? FormatTime(value)
      : string.Empty;

  public void RefreshOptions()
  {
    options.Clear();
    var step = Step <= TimeSpan.Zero ? TimeSpan.FromMinutes(30) : Step;
    for (var time = Start; time <= End; time = time.Add(step))
    {
      options.Add(new FsusTimeSelectOption(time, FormatTime(time), DisabledTime?.Invoke(time) == true));
    }

    HighlightedIndex = FindFirstEnabledIndex();
    SyncState();
  }

  public bool SelectTime(TimeOnly time)
  {
    RefreshOptionsIfNeeded();
    var option = options.FirstOrDefault((candidate) => candidate.Value == time);
    if (option is null || option.IsDisabled)
    {
      return false;
    }

    Value = time;
    SyncState();
    return true;
  }

  public void ClearSelection()
  {
    if (!IsClearable || Value is null)
    {
      return;
    }

    Value = null;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    RefreshOptionsIfNeeded();
    if (key == Key.Down)
    {
      return ValueTask.FromResult(MoveHighlight(1));
    }

    if (key == Key.Up)
    {
      return ValueTask.FromResult(MoveHighlight(-1));
    }

    if (key == Key.Enter && HighlightedIndex >= 0 && HighlightedIndex < options.Count)
    {
      return ValueTask.FromResult(SelectTime(options[HighlightedIndex].Value));
    }

    return ValueTask.FromResult(false);
  }

  private void RefreshOptionsIfNeeded()
  {
    if (options.Count == 0)
    {
      RefreshOptions();
    }
  }

  private bool MoveHighlight(int delta)
  {
    if (options.Count == 0)
    {
      return false;
    }

    var current = HighlightedIndex < 0 ? -1 : HighlightedIndex;
    for (var step = 0; step < options.Count; step++)
    {
      current = (current + delta + options.Count) % options.Count;
      if (!options[current].IsDisabled)
      {
        HighlightedIndex = current;
        SyncState();
        return true;
      }
    }

    return false;
  }

  private int FindFirstEnabledIndex()
  {
    for (var index = 0; index < options.Count; index++)
    {
      if (!options[index].IsDisabled)
      {
        return index;
      }
    }

    return -1;
  }

  private string FormatTime(TimeOnly time) =>
    DateTime.Today.Add(time.ToTimeSpan()).ToString(Format, CultureInfo.GetCultureInfo(Locale));

  private void SyncState()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-empty", Value is null);
    FsusComponentClasses.Ensure(this, "fsus-selected", Value is not null);
    FsusComponentClasses.Ensure(this, "fsus-clearable", IsClearable);
    AutomationProperties.SetName(this, !string.IsNullOrEmpty(DisplayText)
      ? DisplayText
      : FsusComponentClasses.ResolveName(AccessibleName, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ComboBox);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrEmpty(DisplayText) ? "empty" : $"selected {DisplayText}");
  }
}
