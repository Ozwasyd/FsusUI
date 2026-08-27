using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusShortcutRecorderHeadlessTests
{
  [AvaloniaFact]
  public void UserStartsRecordingAndPressesCtrlShiftPToCaptureOneShortcut()
  {
    var recorder = new FsusShortcutRecorder
    {
      AccessibleName = "Shortcut input",
    };

    var window = MountWindow([("recorder", recorder)]);
    window.Show();

    recorder.Focus();
    Assert.True(recorder.IsFocused);

    // Enter recording mode
    recorder.StartRecording();
    Assert.True(recorder.IsRecording);

    // Press Ctrl+Shift+P
    window.KeyPress(Key.P, RawInputModifiers.Control | RawInputModifiers.Shift, PhysicalKey.None, "P");

    Assert.False(recorder.IsRecording);
    Assert.NotNull(recorder.Value);
    Assert.Equal(Key.P, recorder.Value.Key);
    Assert.Equal(KeyModifiers.Control | KeyModifiers.Shift, recorder.Value.Modifiers);
    Assert.Equal("Ctrl+Shift+P", recorder.DisplayText);
    Assert.Equal(FsusShortcutValidationStatus.Valid, recorder.Status);
    Assert.False(recorder.IsInvalid);

    window.Close();
  }

  [AvaloniaFact]
  public void EscapeCancelsRecordingAndDoesNotChangeOriginalValue()
  {
    var initial = new FsusShortcutGesture(Key.S, KeyModifiers.Control);
    var recorder = new FsusShortcutRecorder
    {
      Value = initial,
    };

    var window = MountWindow([("recorder", recorder)]);
    window.Show();

    recorder.Focus();
    recorder.StartRecording();
    Assert.True(recorder.IsRecording);

    // Press Escape
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, "");

    Assert.False(recorder.IsRecording);
    Assert.Equal(initial, recorder.Value);
    Assert.Equal("Ctrl+S", recorder.DisplayText);

    window.Close();
  }

  [AvaloniaFact]
  public void BackspaceOrDeleteClearsRecordedValue()
  {
    var initial = new FsusShortcutGesture(Key.O, KeyModifiers.Control);
    var recorder = new FsusShortcutRecorder
    {
      Value = initial,
    };

    var window = MountWindow([("recorder", recorder)]);
    window.Show();

    recorder.Focus();
    recorder.StartRecording();
    Assert.True(recorder.IsRecording);

    // Press Backspace to clear
    window.KeyPress(Key.Back, RawInputModifiers.None, PhysicalKey.Backspace, "");

    Assert.False(recorder.IsRecording);
    Assert.Null(recorder.Value);
    Assert.Equal(string.Empty, recorder.DisplayText);

    window.Close();
  }

  [AvaloniaFact]
  public void InjectedExistingShortcutsShowAccessibleConflictStatus()
  {
    var existing = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift);
    var recorder = new FsusShortcutRecorder
    {
      ExistingShortcuts = new[] { existing },
      AccessibleName = "Palette shortcut",
    };

    var window = MountWindow([("recorder", recorder)]);
    window.Show();

    recorder.Focus();
    recorder.StartRecording();

    // Type conflicting shortcut
    window.KeyPress(Key.P, RawInputModifiers.Control | RawInputModifiers.Shift, PhysicalKey.None, "P");

    Assert.Equal(FsusShortcutValidationStatus.Duplicate, recorder.Status);
    Assert.True(recorder.IsInvalid);
    Assert.Contains("fsus-duplicate", recorder.Classes);
    Assert.Contains("conflict", AutomationProperties.GetItemStatus(recorder));

    window.Close();
  }

  [AvaloniaFact]
  public void ControlTemplateAppliesAcrossLightAndDarkThemes()
  {
    foreach (var variant in new[] { FsusThemeVariant.Light, FsusThemeVariant.Dark })
    {
      var recorder = new FsusShortcutRecorder
      {
        Value = new FsusShortcutGesture(Key.F, KeyModifiers.Control),
      };

      var window = MountWindow([("recorder", recorder)], variant);
      window.Show();

      Assert.True(recorder.IsMeasureValid);
      Assert.True(recorder.IsArrangeValid);
      Assert.True(recorder.Bounds.Width > 0);
      Assert.True(recorder.Bounds.Height > 0);
      Assert.Equal("Ctrl+F", recorder.DisplayText);

      window.Close();
    }
  }

  private static Window MountWindow(
    (string name, Control content)[] children,
    FsusThemeVariant variant = FsusThemeVariant.Light)
  {
    var stack = new StackPanel { Margin = new Thickness(16), Spacing = 8 };
    foreach (var child in children)
    {
      child.content.Name = child.name;
      stack.Children.Add(child.content);
    }

    var window = new Window
    {
      Width = 480,
      Height = 360,
      Content = stack,
    };

    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions { Variant = variant });
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });

    return window;
  }
}
