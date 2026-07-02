using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusDateTimePrimitiveTests
{
  [Fact]
  public async Task CalendarSelectsDatesRangesDisabledDatesAndKeyboard()
  {
    var changes = new List<DateOnly?>();
    var calendar = new KeyboardCalendar
    {
      AccessibleName = "Release calendar",
      DisplayDate = new DateOnly(2026, 7, 1),
      FocusedDate = new DateOnly(2026, 7, 2),
      Format = "yyyy-MM-dd",
      Locale = "zh-CN",
      DisabledDate = (date) => date.DayOfWeek == DayOfWeek.Sunday,
    };
    calendar.SelectedDateChanged += (_, args) => changes.Add(args.NewValue);
    calendar.RefreshDays();

    Assert.Equal(42, calendar.VisibleDays.Count);
    Assert.Contains(calendar.VisibleDays, (day) => day.Date == new DateOnly(2026, 7, 1) && day.IsCurrentMonth);
    Assert.True(calendar.VisibleDays.Single((day) => day.Date == new DateOnly(2026, 7, 5)).IsDisabled);

    Assert.False(calendar.SelectDate(new DateOnly(2026, 7, 5)));
    Assert.True(calendar.SelectDate(new DateOnly(2026, 7, 2)));
    Assert.Equal(new DateOnly(2026, 7, 2), calendar.SelectedDate);
    Assert.Equal("2026-07-02", calendar.DisplayText);

    Assert.True(await calendar.PressAsync(Key.Right));
    Assert.True(await calendar.PressAsync(Key.Enter));

    Assert.Equal(new DateOnly(2026, 7, 3), calendar.SelectedDate);
    Assert.Equal(new DateOnly(2026, 7, 3), changes.Last());
    Assert.Contains("fsus-selected", calendar.Classes);
    Assert.Equal("Release calendar", AutomationProperties.GetName(calendar));
    Assert.Equal(AutomationControlType.Calendar, AutomationProperties.GetControlTypeOverride(calendar));
    Assert.Equal("selected 2026-07-03", AutomationProperties.GetItemStatus(calendar));

    Assert.True(calendar.SelectRange(new DateOnly(2026, 7, 7), new DateOnly(2026, 7, 10)));
    Assert.Equal(new DateOnly(2026, 7, 7), calendar.RangeStart);
    Assert.Equal(new DateOnly(2026, 7, 10), calendar.RangeEnd);
    Assert.Equal("2026-07-07 - 2026-07-10", calendar.DisplayText);
    Assert.Contains("fsus-range", calendar.Classes);
  }

  [Fact]
  public async Task DatePickerAndTimePickerBindValuesClearShortcutsAndValidateInForm()
  {
    var datePicker = new KeyboardDatePicker
    {
      AccessibleName = "Due date",
      Format = "yyyy/MM/dd",
      Locale = "en-US",
      IsClearable = true,
      DisabledDate = (date) => date.DayOfWeek == DayOfWeek.Saturday,
    };
    datePicker.Shortcuts.Add(new FsusDateShortcut("Release day", new DateOnly(2026, 7, 2)));

    Assert.False(datePicker.SelectDate(new DateOnly(2026, 7, 4)));
    Assert.True(datePicker.ApplyShortcut("Release day"));

    Assert.Equal(new DateOnly(2026, 7, 2), datePicker.Value);
    Assert.Equal(new DateOnly(2026, 7, 2), datePicker.SelectedValue);
    Assert.Equal("2026/07/02", datePicker.DisplayText);
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(datePicker));

    var item = new FsusFormItem
    {
      FieldName = "due",
      Label = "Due date",
      IsRequired = true,
      Content = datePicker,
    };
    var form = new FsusForm();
    form.Children.Add(item);

    Assert.True((await form.ValidateAsync()).IsValid);

    datePicker.ClearSelection();

    var invalid = await form.ValidateAsync();
    Assert.False(invalid.IsValid);
    Assert.Equal(FsusFormValidationState.Error, item.ValidationState);
    Assert.Contains("fsus-empty", datePicker.Classes);

    var timePicker = new KeyboardTimePicker
    {
      AccessibleName = "Deploy window",
      Format = "HH:mm",
      IsClearable = true,
      DisabledTime = (time) => time.Hour < 9,
    };

    Assert.False(timePicker.SelectTime(new TimeOnly(8, 30)));
    Assert.True(timePicker.SelectTime(new TimeOnly(9, 30)));
    Assert.Equal(new TimeOnly(9, 30), timePicker.Value);
    Assert.Equal("09:30", timePicker.DisplayText);

    Assert.True(timePicker.SelectRange(new TimeOnly(10, 0), new TimeOnly(12, 30)));
    Assert.Equal("10:00 - 12:30", timePicker.DisplayText);
    Assert.Contains("fsus-range", timePicker.Classes);

    Assert.True(await timePicker.PressAsync(Key.Down));
    Assert.True(await timePicker.PressAsync(Key.Enter));

    Assert.Equal(new TimeOnly(10, 30), timePicker.Value);
    Assert.Equal("10:30", timePicker.DisplayText);
  }

  [Fact]
  public async Task TimeSelectGeneratesOptionsSkipsDisabledTimesAndClears()
  {
    var timeSelect = new KeyboardTimeSelect
    {
      AccessibleName = "Reminder time",
      Start = new TimeOnly(9, 0),
      End = new TimeOnly(11, 0),
      Step = TimeSpan.FromMinutes(30),
      Format = "HH:mm",
      IsClearable = true,
      DisabledTime = (time) => time == new TimeOnly(9, 30),
    };

    timeSelect.RefreshOptions();

    Assert.Equal(5, timeSelect.Options.Count);
    Assert.True(timeSelect.Options.Single((option) => option.Value == new TimeOnly(9, 30)).IsDisabled);
    Assert.Equal(0, timeSelect.HighlightedIndex);

    Assert.True(await timeSelect.PressAsync(Key.Enter));
    Assert.Equal(new TimeOnly(9, 0), timeSelect.Value);
    Assert.Equal("09:00", timeSelect.DisplayText);

    Assert.True(await timeSelect.PressAsync(Key.Down));
    Assert.True(await timeSelect.PressAsync(Key.Enter));

    Assert.Equal(new TimeOnly(10, 0), timeSelect.Value);
    Assert.Equal("10:00", AutomationProperties.GetName(timeSelect));
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(timeSelect));
    Assert.Equal("selected 10:00", AutomationProperties.GetItemStatus(timeSelect));

    timeSelect.ClearSelection();

    Assert.Null(timeSelect.Value);
    Assert.Equal(string.Empty, timeSelect.DisplayText);
    Assert.Contains("fsus-empty", timeSelect.Classes);
  }

  [Fact]
  public void DateTimeThemeVisualAndOverrideMetadataCoverStable28()
  {
    var dateTime = ReadControlTheme("DateTime.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusDatePicker",
      "fsus|FsusTimePicker",
      "fsus|FsusTimeSelect",
      "fsus|FsusCalendar",
    })
    {
      Assert.Contains(selector, dateTime);
    }

    Assert.Contains("FsusThemeDateTimeSurfaceBrush", dateTime);
    Assert.Contains("FsusMotionDurationEffective", dateTime);
    Assert.Contains("FsusDensityControlDefaultY", dateTime);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/DateTime.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("date-time-calendar-stable28-grid-web-avalonia", visualFixture);
    Assert.Contains("date-time-picker-stable28-panel-web-avalonia", visualFixture);
    Assert.Contains("date-time-picker-stable28-compact-web-avalonia", visualFixture);

    var overrides = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "platform-overrides",
      "avalonia.yaml"));
    Assert.Contains("avalonia-date-time-native-picker-001", overrides);
    Assert.Contains("component.el-date-picker", overrides);
    Assert.Contains("component.el-time-picker", overrides);
    Assert.Contains("component.el-time-select", overrides);
    Assert.Contains("component.el-calendar", overrides);

    var releaseEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "docs",
      "releases",
      "platform-overrides.md"));
    Assert.Contains("avalonia-date-time-native-picker-001", releaseEvidence);
  }

  private sealed class KeyboardCalendar : FsusCalendar
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardDatePicker : FsusDatePicker
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardTimePicker : FsusTimePicker
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardTimeSelect : FsusTimeSelect
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
