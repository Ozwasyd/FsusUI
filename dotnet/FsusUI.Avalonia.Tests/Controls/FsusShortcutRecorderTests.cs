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
  public void RawKeyGestureInteropPreservesLiteralPhysicalControl()
  {
    var physicalControl = new KeyGesture(Key.S, KeyModifiers.Control);
    var neutral = FsusShortcutGesture.FromKeyGesture(physicalControl);
    var raw = neutral.ToKeyGesture();

    Assert.Equal(physicalControl, raw);
    Assert.True(raw.Matches(new KeyEventArgs
    {
      Key = Key.S,
      KeyModifiers = KeyModifiers.Control,
    }));
    Assert.False(raw.Matches(new KeyEventArgs
    {
      Key = Key.S,
      KeyModifiers = KeyModifiers.Meta,
    }));
    Assert.Equal("Ctrl+S", neutral.SerializedText);
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
    Assert.Equal("Ctrl+OemPlus", plusGesture.SerializedText);
    Assert.Equal("Command++", plusGesture.ToDisplayText(FsusShortcutPlatform.macOS));
    Assert.Equal(
      plusGesture,
      FsusShortcutGesture.Parse(plusGesture.SerializedText));

    var minusGesture = new FsusShortcutGesture(Key.OemMinus, KeyModifiers.Control);
    Assert.Equal("Ctrl+OemMinus", minusGesture.SerializedText);
    Assert.Equal("Ctrl+-", minusGesture.ToDisplayText(FsusShortcutPlatform.Windows));
    Assert.Equal(
      minusGesture,
      FsusShortcutGesture.Parse(minusGesture.SerializedText));

    var commaGesture = new FsusShortcutGesture(Key.OemComma, KeyModifiers.Control);
    Assert.Equal("Ctrl+OemComma", commaGesture.SerializedText);
    Assert.Equal("Command+,", commaGesture.ToDisplayText(FsusShortcutPlatform.macOS));
    Assert.Equal(
      commaGesture,
      FsusShortcutGesture.Parse(commaGesture.SerializedText));
  }

  [Theory]
  [InlineData(Key.OemPeriod)]
  [InlineData(Key.Oem1)]
  [InlineData(Key.Oem2)]
  [InlineData(Key.Oem3)]
  [InlineData(Key.Oem4)]
  [InlineData(Key.Oem5)]
  [InlineData(Key.Oem6)]
  [InlineData(Key.Oem7)]
  public void CommonOemSerializationRoundTripsWithoutDelimiterAmbiguity(
    Key key)
  {
    var gesture =
      new FsusShortcutGesture(key, KeyModifiers.Control | KeyModifiers.Alt);

    Assert.Equal(gesture, FsusShortcutGesture.Parse(gesture.SerializedText));
    Assert.StartsWith("Ctrl+Alt+Oem", gesture.SerializedText);
    Assert.DoesNotContain("Oem", gesture.ToDisplayText(FsusShortcutPlatform.Windows));
  }

  [Fact]
  public void MacMetaAndWindowsControlNormalizeToTheSameStableGesture()
  {
    var mac =
      FsusShortcutGesture.FromKey(
        Key.P,
        KeyModifiers.Meta | KeyModifiers.Shift,
        FsusShortcutPlatform.macOS);
    var windows =
      FsusShortcutGesture.FromKey(
        Key.P,
        KeyModifiers.Control | KeyModifiers.Shift,
        FsusShortcutPlatform.Windows);

    Assert.Equal(windows, mac);
    Assert.Equal("Ctrl+Shift+P", mac.SerializedText);
    Assert.Equal(
      "Command+Shift+P",
      mac.ToDisplayText(FsusShortcutPlatform.macOS));
  }

  [Fact]
  public void WindowsMetaRemainsDistinctAndRoundTrips()
  {
    var windows =
      FsusShortcutGesture.FromKey(
        Key.P,
        KeyModifiers.Meta | KeyModifiers.Shift,
        FsusShortcutPlatform.Windows);

    Assert.Equal("Shift+Meta+P", windows.SerializedText);
    Assert.Equal(
      "Shift+Win+P",
      windows.ToDisplayText(FsusShortcutPlatform.Windows));
    Assert.Equal(
      windows,
      FsusShortcutGesture.Parse(windows.SerializedText));
    Assert.Equal(
      windows,
      FsusShortcutGesture.Parse("Win+Shift+P"));
  }

  [Theory]
  [InlineData(FsusShortcutPlatform.Windows, KeyModifiers.Control, "Ctrl+Shift+P")]
  [InlineData(FsusShortcutPlatform.Linux, KeyModifiers.Control, "Ctrl+Shift+P")]
  [InlineData(FsusShortcutPlatform.macOS, KeyModifiers.Meta, "Command+Shift+P")]
  public void RecorderCapturesSingleShortcutOnKeyCombination(
    FsusShortcutPlatform platform,
    KeyModifiers primaryModifier,
    string displayShortcut)
  {
    var recorder = new TestShortcutRecorder
    {
      AccessibleName = "Editor shortcut",
      Platform = platform,
    };

    var valuesEmitted = new List<FsusShortcutGesture?>();
    recorder.ValueChanged += (_, args) => valuesEmitted.Add(args.NewValue);

    Assert.False(recorder.IsRecording);
    Assert.Null(recorder.Value);

    // User starts recording
    recorder.StartRecording();
    Assert.True(recorder.IsRecording);
    Assert.Contains("fsus-recording", recorder.Classes);

    // Capture the platform's primary modifier without changing serialization.
    recorder.SimulateKeyDown(Key.P, primaryModifier | KeyModifiers.Shift);

    Assert.False(recorder.IsRecording);
    Assert.DoesNotContain("fsus-recording", recorder.Classes);
    Assert.NotNull(recorder.Value);
    Assert.Equal(Key.P, recorder.Value.Key);
    Assert.Equal(KeyModifiers.Control | KeyModifiers.Shift, recorder.Value.Modifiers);
    Assert.Single(valuesEmitted);
    Assert.Equal(displayShortcut, recorder.DisplayText);
    Assert.Equal("Ctrl+Shift+P", recorder.Value.SerializedText);
    Assert.Equal(FsusShortcutValidationStatus.Valid, recorder.Status);
    Assert.False(recorder.IsInvalid);
  }

  [Fact]
  public void EscapeCancelsRecordingAndPreservesOriginalValue()
  {
    var initialGesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control);
    var recorder = new TestShortcutRecorder
    {
      Platform = FsusShortcutPlatform.Windows,
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

  [Fact]
  public void InvalidBareKeyPreservesOriginalValueAndClearsStaleHelpAfterRecovery()
  {
    var initial = new FsusShortcutGesture(Key.S, KeyModifiers.Control);
    var recorder = new TestShortcutRecorder
    {
      Value = initial,
    };

    recorder.StartRecording();
    recorder.SimulateKeyDown(Key.P, KeyModifiers.None);

    Assert.False(recorder.IsRecording);
    Assert.Equal(initial, recorder.Value);
    Assert.Equal(FsusShortcutValidationStatus.Invalid, recorder.Status);
    Assert.Equal(
      "Modifier key required (Ctrl, Alt, or Shift).",
      AutomationProperties.GetHelpText(recorder));

    recorder.StartRecording();
    recorder.SimulateKeyDown(Key.K, KeyModifiers.Control);

    Assert.Equal(FsusShortcutValidationStatus.Valid, recorder.Status);
    Assert.Null(AutomationProperties.GetHelpText(recorder));
    Assert.Equal("Ctrl+K", recorder.SerializedValue());
  }

  [Fact]
  public void ClearabilityAndCommandAvailabilityTrackControlState()
  {
    var recorder = new TestShortcutRecorder
    {
      Value = new FsusShortcutGesture(Key.D, KeyModifiers.Control),
      IsClearable = false,
    };

    Assert.False(recorder.ClearCommand.CanExecute(null));
    recorder.SimulateKeyDown(Key.Delete, KeyModifiers.None);
    Assert.NotNull(recorder.Value);

    recorder.IsClearable = true;
    Assert.True(recorder.ClearCommand.CanExecute(null));
    recorder.SimulateKeyDown(Key.Delete, KeyModifiers.None);
    Assert.Null(recorder.Value);
    Assert.False(recorder.ClearCommand.CanExecute(null));

    recorder.Status = FsusShortcutValidationStatus.Invalid;
    recorder.StatusMessage = "Modifier key required.";
    recorder.IsInvalid = true;
    Assert.False(recorder.ClearCommand.CanExecute(null));
  }

  [Fact]
  public void AutoRecorderUsesHostPlatformAndExplicitDisplayChangesPreserveValue()
  {
    var recorder = new TestShortcutRecorder();
    Assert.Equal(FsusShortcutPlatform.Auto, recorder.Platform);
    recorder.StartRecording();
    recorder.SimulateKeyDown(
      Key.S,
      OperatingSystem.IsMacOS() ? KeyModifiers.Meta : KeyModifiers.Control);

    var value = Assert.IsType<FsusShortcutGesture>(recorder.Value);
    Assert.Equal("Ctrl+S", value.SerializedText);
    Assert.Equal(KeyModifiers.Control, value.Modifiers);
    Assert.Equal(OperatingSystem.IsMacOS() ? "Command+S" : "Ctrl+S", recorder.DisplayText);

    foreach (var platform in new[] { FsusShortcutPlatform.Windows, FsusShortcutPlatform.Linux, FsusShortcutPlatform.macOS })
    {
      recorder.Platform = platform;
      Assert.Equal(platform == FsusShortcutPlatform.macOS ? "Command+S" : "Ctrl+S", recorder.DisplayText);
      recorder.StartRecording();
      recorder.SimulateKeyDown(Key.Escape, KeyModifiers.None);
      Assert.False(recorder.IsRecording);
      Assert.Same(value, recorder.Value);
      Assert.Equal(platform == FsusShortcutPlatform.macOS ? "Command+S" : "Ctrl+S", recorder.DisplayText);
    }
  }

  private sealed class TestShortcutRecorder : FsusShortcutRecorder
  {
    public string? SerializedValue() => Value?.SerializedText;

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
