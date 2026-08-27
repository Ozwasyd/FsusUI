using Avalonia.Automation;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusShortcutRecorderTests
{
  [Fact]
  public void ShortcutGestureNormalizesKeysAndMaintainsStableSerialization()
  {
    var gesture = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift);

    Assert.Equal(Key.P, gesture.Key);
    Assert.True(gesture.Modifiers.HasFlag(KeyModifiers.Control));
    Assert.True(gesture.Modifiers.HasFlag(KeyModifiers.Shift));

    // Stable serialized string
    Assert.Equal("Ctrl+Shift+P", gesture.ToString());

    // Round-trip parse
    var parsed = FsusShortcutGesture.Parse("Ctrl+Shift+P");
    Assert.Equal(gesture, parsed);
    Assert.Equal(gesture.GetHashCode(), parsed.GetHashCode());

    // KeyGesture interop
    KeyGesture avaloniaGesture = gesture;
    Assert.Equal(Key.P, avaloniaGesture.Key);
    var fromAvalonia = FsusShortcutGesture.FromKeyGesture(avaloniaGesture);
    Assert.Equal(gesture, fromAvalonia);
  }

  [Fact]
  public void ShortcutGestureDisplaysCommandOptionOnMacAndCtrlAltOnWindowsLinux()
  {
    var gesture = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Alt | KeyModifiers.Shift);

    // Stable serialized format
    Assert.Equal("Ctrl+Alt+Shift+P", gesture.ToString());

    // Windows formatting
    var windowsDisplay = gesture.ToDisplayText(FsusShortcutPlatform.Windows);
    Assert.Equal("Ctrl+Alt+Shift+P", windowsDisplay);

    // Linux formatting
    var linuxDisplay = gesture.ToDisplayText(FsusShortcutPlatform.Linux);
    Assert.Equal("Ctrl+Alt+Shift+P", linuxDisplay);

    // macOS formatting
    var macDisplay = gesture.ToDisplayText(FsusShortcutPlatform.macOS);
    Assert.Equal("Command+Option+Shift+P", macDisplay);
  }

  [Fact]
  public void ShortcutGestureNormalizesOemKeys()
  {
    var plusGesture = new FsusShortcutGesture(Key.OemPlus, KeyModifiers.Control);
    Assert.Equal("Ctrl++", plusGesture.ToString());
    Assert.Equal("Command++", plusGesture.ToDisplayText(FsusShortcutPlatform.macOS));

    var minusGesture = new FsusShortcutGesture(Key.OemMinus, KeyModifiers.Control);
    Assert.Equal("Ctrl+-", minusGesture.ToString());

    var commaGesture = new FsusShortcutGesture(Key.OemComma, KeyModifiers.Control);
    Assert.Equal("Ctrl+,", commaGesture.ToString());
    Assert.Equal("Command+,", commaGesture.ToDisplayText(FsusShortcutPlatform.macOS));
  }

  [Fact]
  public void RecorderCapturesSingleShortcutOnKeyCombination()
  {
    var recorder = new TestShortcutRecorder
    {
      AccessibleName = "Editor shortcut",
    };

    var valuesEmitted = new List<FsusShortcutGesture?>();
    recorder.ValueChanged += (_, args) => valuesEmitted.Add(args.NewValue);

    Assert.False(recorder.IsRecording);
    Assert.Null(recorder.Value);

    // User starts recording
    recorder.StartRecording();
    Assert.True(recorder.IsRecording);
    Assert.Contains("fsus-recording", recorder.Classes);

    // Simulates pressing Ctrl+Shift+P
    recorder.SimulateKeyDown(Key.P, KeyModifiers.Control | KeyModifiers.Shift);

    Assert.False(recorder.IsRecording);
    Assert.DoesNotContain("fsus-recording", recorder.Classes);
    Assert.NotNull(recorder.Value);
    Assert.Equal(Key.P, recorder.Value.Key);
    Assert.Equal(KeyModifiers.Control | KeyModifiers.Shift, recorder.Value.Modifiers);
    Assert.Single(valuesEmitted);
    Assert.Equal("Ctrl+Shift+P", recorder.DisplayText);
    Assert.Equal(FsusShortcutValidationStatus.Valid, recorder.Status);
    Assert.False(recorder.IsInvalid);
  }

  [Fact]
  public void EscapeCancelsRecordingAndPreservesOriginalValue()
  {
    var initialGesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control);
    var recorder = new TestShortcutRecorder
    {
      Value = initialGesture,
    };

    Assert.Equal("Ctrl+S", recorder.DisplayText);

    recorder.StartRecording();
    Assert.True(recorder.IsRecording);

    // Pressing Escape
    recorder.SimulateKeyDown(Key.Escape, KeyModifiers.None);

    Assert.False(recorder.IsRecording);
    Assert.Equal(initialGesture, recorder.Value);
    Assert.Equal("Ctrl+S", recorder.DisplayText);
    Assert.Equal(FsusShortcutValidationStatus.Valid, recorder.Status);
  }

  [Fact]
  public void BackspaceOrDeleteClearsRecordedValue()
  {
    var initialGesture = new FsusShortcutGesture(Key.D, KeyModifiers.Control);
    var recorder = new TestShortcutRecorder
    {
      Value = initialGesture,
    };

    // When recording, Backspace clears
    recorder.StartRecording();
    recorder.SimulateKeyDown(Key.Back, KeyModifiers.None);

    Assert.False(recorder.IsRecording);
    Assert.Null(recorder.Value);
    Assert.Equal(string.Empty, recorder.DisplayText);

    // Reset and test Delete when not recording
    recorder.Value = initialGesture;
    recorder.SimulateKeyDown(Key.Delete, KeyModifiers.None);
    Assert.Null(recorder.Value);
  }

  [Fact]
  public void InjectedExistingShortcutsShowAccessibleConflictStatus()
  {
    var existingSave = new FsusShortcutGesture(Key.S, KeyModifiers.Control);
    var existingOpen = new FsusShortcutGesture(Key.O, KeyModifiers.Control);

    var recorder = new TestShortcutRecorder
    {
      AccessibleName = "Custom Action",
      ExistingShortcuts = new[] { existingSave, existingOpen },
    };

    // Record duplicate Ctrl+S
    recorder.StartRecording();
    recorder.SimulateKeyDown(Key.S, KeyModifiers.Control);

    Assert.Equal(FsusShortcutValidationStatus.Duplicate, recorder.Status);
    Assert.True(recorder.IsInvalid);
    Assert.Contains("fsus-duplicate", recorder.Classes);
    Assert.Contains("fsus-invalid", recorder.Classes);
    Assert.NotNull(recorder.StatusMessage);
    Assert.Contains("conflict", AutomationProperties.GetItemStatus(recorder));

    // Record unique Ctrl+K
    recorder.StartRecording();
    recorder.SimulateKeyDown(Key.K, KeyModifiers.Control);

    Assert.Equal(FsusShortcutValidationStatus.Valid, recorder.Status);
    Assert.False(recorder.IsInvalid);
    Assert.DoesNotContain("fsus-duplicate", recorder.Classes);
    Assert.DoesNotContain("fsus-invalid", recorder.Classes);
  }

  [Fact]
  public void ReservedShortcutsShowReservedStatus()
  {
    var reservedQuit = new FsusShortcutGesture(Key.Q, KeyModifiers.Control);

    var recorder = new TestShortcutRecorder
    {
      ReservedShortcuts = new[] { reservedQuit },
    };

    recorder.StartRecording();
    recorder.SimulateKeyDown(Key.Q, KeyModifiers.Control);

    Assert.Equal(FsusShortcutValidationStatus.Reserved, recorder.Status);
    Assert.True(recorder.IsInvalid);
    Assert.Contains("fsus-reserved", recorder.Classes);
    Assert.Contains("reserved", AutomationProperties.GetItemStatus(recorder));
  }

  private sealed class TestShortcutRecorder : FsusShortcutRecorder
  {
    public void SimulateKeyDown(Key key, KeyModifiers modifiers)
    {
      var rawModifiers = RawInputModifiers.None;
      if (modifiers.HasFlag(KeyModifiers.Control)) rawModifiers |= RawInputModifiers.Control;
      if (modifiers.HasFlag(KeyModifiers.Alt)) rawModifiers |= RawInputModifiers.Alt;
      if (modifiers.HasFlag(KeyModifiers.Shift)) rawModifiers |= RawInputModifiers.Shift;
      if (modifiers.HasFlag(KeyModifiers.Meta)) rawModifiers |= RawInputModifiers.Meta;

      var args = new KeyEventArgs
      {
        RoutedEvent = KeyDownEvent,
        Key = key,
        KeyModifiers = modifiers,
      };

      OnKeyDown(args);
    }
  }
}
