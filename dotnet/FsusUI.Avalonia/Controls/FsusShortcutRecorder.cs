using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public enum FsusShortcutPlatform
{
  Auto,
  Windows,
  macOS,
  Linux,
}

public enum FsusShortcutValidationStatus
{
  Valid,
  Duplicate,
  Reserved,
  Invalid,
}

public sealed class FsusShortcutGesture : IEquatable<FsusShortcutGesture>
{
  public FsusShortcutGesture(Key key, KeyModifiers modifiers = KeyModifiers.None)
  {
    Key = NormalizeKey(key);
    Modifiers = NormalizeModifiers(modifiers);
  }

  public Key Key { get; }

  public KeyModifiers Modifiers { get; }

  public string DisplayText => ToDisplayText(FsusShortcutPlatform.Auto);

  public string SerializedText => ToString();

  public KeyGesture ToKeyGesture() => new(Key, Modifiers);

  public static FsusShortcutGesture FromKeyGesture(KeyGesture gesture)
  {
    ArgumentNullException.ThrowIfNull(gesture);
    return new FsusShortcutGesture(gesture.Key, gesture.KeyModifiers);
  }

  public static implicit operator KeyGesture(FsusShortcutGesture gesture) => gesture.ToKeyGesture();

  public static FsusShortcutGesture FromKey(
    Key key,
    KeyModifiers modifiers,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    var resolvedPlatform = ResolvePlatform(platform);
    var normalizedModifiers = modifiers;

    if (resolvedPlatform == FsusShortcutPlatform.macOS)
    {
      if (modifiers.HasFlag(KeyModifiers.Meta))
      {
        normalizedModifiers = (normalizedModifiers & ~KeyModifiers.Meta) | KeyModifiers.Control;
      }
    }

    return new FsusShortcutGesture(key, normalizedModifiers);
  }

  public string ToDisplayText(FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    var resolvedPlatform = ResolvePlatform(platform);
    var parts = new List<string>();

    if (resolvedPlatform == FsusShortcutPlatform.macOS)
    {
      if (Modifiers.HasFlag(KeyModifiers.Control) || Modifiers.HasFlag(KeyModifiers.Meta))
      {
        parts.Add("Command");
      }
      if (Modifiers.HasFlag(KeyModifiers.Alt))
      {
        parts.Add("Option");
      }
      if (Modifiers.HasFlag(KeyModifiers.Shift))
      {
        parts.Add("Shift");
      }
    }
    else
    {
      if (Modifiers.HasFlag(KeyModifiers.Control))
      {
        parts.Add("Ctrl");
      }
      if (Modifiers.HasFlag(KeyModifiers.Alt))
      {
        parts.Add("Alt");
      }
      if (Modifiers.HasFlag(KeyModifiers.Shift))
      {
        parts.Add("Shift");
      }
      if (Modifiers.HasFlag(KeyModifiers.Meta))
      {
        parts.Add("Win");
      }
    }

    parts.Add(FormatDisplayKey(Key));
    return string.Join("+", parts);
  }

  public override string ToString()
  {
    var parts = new List<string>();
    if (Modifiers.HasFlag(KeyModifiers.Control))
    {
      parts.Add("Ctrl");
    }
    if (Modifiers.HasFlag(KeyModifiers.Alt))
    {
      parts.Add("Alt");
    }
    if (Modifiers.HasFlag(KeyModifiers.Shift))
    {
      parts.Add("Shift");
    }
    if (Modifiers.HasFlag(KeyModifiers.Meta))
    {
      parts.Add("Meta");
    }

    parts.Add(FormatSerializedKey(Key));
    return string.Join("+", parts);
  }

  public static FsusShortcutGesture Parse(string text)
  {
    if (TryParse(text, out var gesture) && gesture is not null)
    {
      return gesture;
    }

    throw new FormatException($"Cannot parse shortcut gesture from '{text}'.");
  }

  public static bool TryParse(string? text, out FsusShortcutGesture? gesture)
  {
    gesture = null;
    if (string.IsNullOrWhiteSpace(text))
    {
      return false;
    }

    var tokens = text.Split(
      '+',
      StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    if (tokens.Length == 0)
    {
      return false;
    }

    var modifiers = KeyModifiers.None;
    Key? parsedKey = null;

    for (var i = 0; i < tokens.Length; i++)
    {
      var token = tokens[i];
      var isLast = i == tokens.Length - 1;

      if (token.Equals("Ctrl", StringComparison.OrdinalIgnoreCase) ||
          token.Equals("Control", StringComparison.OrdinalIgnoreCase) ||
          token.Equals("Mod", StringComparison.OrdinalIgnoreCase))
      {
        modifiers |= KeyModifiers.Control;
      }
      else if (token.Equals("Command", StringComparison.OrdinalIgnoreCase) ||
               token.Equals("Cmd", StringComparison.OrdinalIgnoreCase))
      {
        modifiers |= KeyModifiers.Control;
      }
      else if (token.Equals("Meta", StringComparison.OrdinalIgnoreCase) ||
               token.Equals("Win", StringComparison.OrdinalIgnoreCase))
      {
        modifiers |= KeyModifiers.Meta;
      }
      else if (token.Equals("Alt", StringComparison.OrdinalIgnoreCase) ||
               token.Equals("Option", StringComparison.OrdinalIgnoreCase) ||
               token.Equals("Opt", StringComparison.OrdinalIgnoreCase))
      {
        modifiers |= KeyModifiers.Alt;
      }
      else if (token.Equals("Shift", StringComparison.OrdinalIgnoreCase))
      {
        modifiers |= KeyModifiers.Shift;
      }
      else if (isLast)
      {
        parsedKey = ParseKeyName(token);
      }
      else
      {
        return false;
      }
    }

    if (parsedKey is null)
    {
      return false;
    }

    gesture = new FsusShortcutGesture(parsedKey.Value, modifiers);
    return true;
  }

  public bool Equals(FsusShortcutGesture? other)
  {
    if (other is null)
    {
      return false;
    }

    return Key == other.Key && Modifiers == other.Modifiers;
  }

  public override bool Equals(object? obj) =>
    obj is FsusShortcutGesture other && Equals(other);

  public override int GetHashCode() =>
    HashCode.Combine(Key, Modifiers);

  public static bool operator ==(FsusShortcutGesture? left, FsusShortcutGesture? right) =>
    Equals(left, right);

  public static bool operator !=(FsusShortcutGesture? left, FsusShortcutGesture? right) =>
    !Equals(left, right);

  public static bool IsModifierKey(Key key) => key switch
  {
    Key.LeftCtrl or Key.RightCtrl or
    Key.LeftAlt or Key.RightAlt or
    Key.LeftShift or Key.RightShift or
    Key.LWin or Key.RWin => true,
    _ => false,
  };

  public static bool IsFunctionKey(Key key) =>
    key is >= Key.F1 and <= Key.F24;

  public static Key NormalizeKey(Key key) => key switch
  {
    Key.LeftCtrl or Key.RightCtrl => Key.None,
    Key.LeftAlt or Key.RightAlt => Key.None,
    Key.LeftShift or Key.RightShift => Key.None,
    Key.LWin or Key.RWin => Key.None,
    _ => key,
  };

  public static KeyModifiers NormalizeModifiers(KeyModifiers modifiers)
  {
    var normalized = KeyModifiers.None;
    if (modifiers.HasFlag(KeyModifiers.Control))
    {
      normalized |= KeyModifiers.Control;
    }
    if (modifiers.HasFlag(KeyModifiers.Alt))
    {
      normalized |= KeyModifiers.Alt;
    }
    if (modifiers.HasFlag(KeyModifiers.Shift))
    {
      normalized |= KeyModifiers.Shift;
    }
    if (modifiers.HasFlag(KeyModifiers.Meta))
    {
      normalized |= KeyModifiers.Meta;
    }

    return normalized;
  }

  private static FsusShortcutPlatform ResolvePlatform(FsusShortcutPlatform platform)
  {
    if (platform != FsusShortcutPlatform.Auto)
    {
      return platform;
    }

    if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
    {
      return FsusShortcutPlatform.macOS;
    }

    if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
    {
      return FsusShortcutPlatform.Windows;
    }

    return FsusShortcutPlatform.Linux;
  }

  private static string FormatDisplayKey(Key key) => key switch
  {
    Key.D0 => "0",
    Key.D1 => "1",
    Key.D2 => "2",
    Key.D3 => "3",
    Key.D4 => "4",
    Key.D5 => "5",
    Key.D6 => "6",
    Key.D7 => "7",
    Key.D8 => "8",
    Key.D9 => "9",
    Key.NumPad0 => "0",
    Key.NumPad1 => "1",
    Key.NumPad2 => "2",
    Key.NumPad3 => "3",
    Key.NumPad4 => "4",
    Key.NumPad5 => "5",
    Key.NumPad6 => "6",
    Key.NumPad7 => "7",
    Key.NumPad8 => "8",
    Key.NumPad9 => "9",
    Key.OemPlus or Key.Add => "+",
    Key.OemMinus or Key.Subtract => "-",
    Key.OemComma => ",",
    Key.OemPeriod => ".",
    Key.Oem1 => ";",
    Key.Oem2 => "/",
    Key.Oem3 => "`",
    Key.Oem4 => "[",
    Key.Oem5 => "\\",
    Key.Oem6 => "]",
    Key.Oem7 => "'",
    Key.Return => "Enter",
    Key.Back => "Backspace",
    _ => key.ToString(),
  };

  private static string FormatSerializedKey(Key key) => key switch
  {
    Key.D0 => "0",
    Key.D1 => "1",
    Key.D2 => "2",
    Key.D3 => "3",
    Key.D4 => "4",
    Key.D5 => "5",
    Key.D6 => "6",
    Key.D7 => "7",
    Key.D8 => "8",
    Key.D9 => "9",
    Key.Return => "Enter",
    Key.Back => "Backspace",
    Key.Delete => "Delete",
    Key.Escape => "Escape",
    _ => key.ToString(),
  };

  private static Key? ParseKeyName(string name)
  {
    if (Enum.TryParse<Key>(name, true, out var key))
    {
      return key;
    }

    return name.Trim().ToUpperInvariant() switch
    {
      "0" => Key.D0,
      "1" => Key.D1,
      "2" => Key.D2,
      "3" => Key.D3,
      "4" => Key.D4,
      "5" => Key.D5,
      "6" => Key.D6,
      "7" => Key.D7,
      "8" => Key.D8,
      "9" => Key.D9,
      "+" => Key.OemPlus,
      "-" => Key.OemMinus,
      "," => Key.OemComma,
      "." => Key.OemPeriod,
      ";" => Key.Oem1,
      "/" => Key.Oem2,
      "`" => Key.Oem3,
      "[" => Key.Oem4,
      "\\" => Key.Oem5,
      "]" => Key.Oem6,
      "'" => Key.Oem7,
      "ENTER" => Key.Return,
      "BACKSPACE" => Key.Back,
      "DEL" => Key.Delete,
      "ESC" => Key.Escape,
      _ => null,
    };
  }
}

public sealed class FsusShortcutValueChangedEventArgs(
  FsusShortcutGesture? oldValue,
  FsusShortcutGesture? newValue) : EventArgs
{
  public FsusShortcutGesture? OldValue { get; } = oldValue;

  public FsusShortcutGesture? NewValue { get; } = newValue;
}

public sealed class FsusShortcutValidationChangedEventArgs(
  FsusShortcutValidationStatus status,
  string? message) : EventArgs
{
  public FsusShortcutValidationStatus Status { get; } = status;

  public string? Message { get; } = message;
}

public class FsusShortcutRecorder : TemplatedControl
{
  public static readonly StyledProperty<FsusShortcutGesture?> ValueProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, FsusShortcutGesture?>(
      nameof(Value));

  public static readonly StyledProperty<string> DisplayTextProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, string>(
      nameof(DisplayText),
      string.Empty);

  public static readonly DirectProperty<FsusShortcutRecorder, ICommand> ClearCommandProperty =
    AvaloniaProperty.RegisterDirect<FsusShortcutRecorder, ICommand>(
      nameof(ClearCommand),
      o => o.ClearCommand);

  public static readonly DirectProperty<FsusShortcutRecorder, ICommand> StartRecordingCommandProperty =
    AvaloniaProperty.RegisterDirect<FsusShortcutRecorder, ICommand>(
      nameof(StartRecordingCommand),
      o => o.StartRecordingCommand);

  public static readonly DirectProperty<FsusShortcutRecorder, ICommand> CancelRecordingCommandProperty =
    AvaloniaProperty.RegisterDirect<FsusShortcutRecorder, ICommand>(
      nameof(CancelRecordingCommand),
      o => o.CancelRecordingCommand);

  public static readonly StyledProperty<bool> IsRecordingProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, bool>(
      nameof(IsRecording));

  public static readonly StyledProperty<FsusShortcutValidationStatus> StatusProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, FsusShortcutValidationStatus>(
      nameof(Status),
      FsusShortcutValidationStatus.Valid);

  public static readonly StyledProperty<string?> StatusMessageProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, string?>(
      nameof(StatusMessage));

  public static readonly StyledProperty<bool> IsInvalidProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, bool>(
      nameof(IsInvalid));

  public static readonly StyledProperty<bool> IsClearableProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, bool>(
      nameof(IsClearable),
      true);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, string?>(
      nameof(AccessibleName));

  public static readonly StyledProperty<FsusComponentSize> SizeProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, FsusComponentSize>(
      nameof(Size),
      FsusComponentSize.Md);

  public static readonly StyledProperty<FsusShortcutPlatform> PlatformProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, FsusShortcutPlatform>(
      nameof(Platform),
      FsusShortcutPlatform.Auto);

  public static readonly StyledProperty<string> PlaceholderProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, string>(
      nameof(Placeholder),
      "Record shortcut");

  public static readonly StyledProperty<IEnumerable<FsusShortcutGesture>?> ExistingShortcutsProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, IEnumerable<FsusShortcutGesture>?>(
      nameof(ExistingShortcuts));

  public static readonly StyledProperty<IEnumerable<FsusShortcutGesture>?> ReservedShortcutsProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, IEnumerable<FsusShortcutGesture>?>(
      nameof(ReservedShortcuts));

  public static readonly StyledProperty<bool> AllowBareKeysProperty =
    AvaloniaProperty.Register<FsusShortcutRecorder, bool>(
      nameof(AllowBareKeys),
      false);

  private readonly RelayCommand cancelRecordingCommand;
  private readonly RelayCommand clearCommand;
  private readonly RelayCommand startRecordingCommand;

  public FsusShortcutRecorder()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-shortcut-recorder");
    Focusable = true;

    startRecordingCommand =
      new RelayCommand(_ => StartRecording(), _ => IsEnabled && !IsRecording);
    cancelRecordingCommand =
      new RelayCommand(_ => CancelRecording(), _ => IsRecording);
    clearCommand = new RelayCommand(_ => Clear(), _ => CanClear());
    StartRecordingCommand = startRecordingCommand;
    CancelRecordingCommand = cancelRecordingCommand;
    ClearCommand = clearCommand;
    LostFocus += (_, _) =>
    {
      if (IsRecording)
      {
        CancelRecording();
      }
    };

    SyncClasses();
    SyncDisplayText();
    SyncAutomation();
  }

  public event EventHandler<FsusShortcutValueChangedEventArgs>? ValueChanged;

  public event EventHandler<bool>? RecordingStateChanged;

  public event EventHandler<FsusShortcutValidationChangedEventArgs>? ValidationStatusChanged;

  public ICommand StartRecordingCommand { get; }

  public ICommand CancelRecordingCommand { get; }

  public ICommand ClearCommand { get; }

  public FsusShortcutGesture? Value
  {
    get => GetValue(ValueProperty);
    set => SetValue(ValueProperty, value);
  }

  public KeyGesture? KeyGesture
  {
    get => Value?.ToKeyGesture();
    set => Value = value is null ? null : FsusShortcutGesture.FromKeyGesture(value);
  }

  public string DisplayText
  {
    get => GetValue(DisplayTextProperty);
    private set => SetValue(DisplayTextProperty, value);
  }

  public bool IsRecording
  {
    get => GetValue(IsRecordingProperty);
    set => SetValue(IsRecordingProperty, value);
  }

  public FsusShortcutValidationStatus Status
  {
    get => GetValue(StatusProperty);
    set => SetValue(StatusProperty, value);
  }

  public string? StatusMessage
  {
    get => GetValue(StatusMessageProperty);
    set => SetValue(StatusMessageProperty, value);
  }

  public bool IsInvalid
  {
    get => GetValue(IsInvalidProperty);
    set => SetValue(IsInvalidProperty, value);
  }

  public bool IsClearable
  {
    get => GetValue(IsClearableProperty);
    set => SetValue(IsClearableProperty, value);
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

  public FsusShortcutPlatform Platform
  {
    get => GetValue(PlatformProperty);
    set => SetValue(PlatformProperty, value);
  }

  public string Placeholder
  {
    get => GetValue(PlaceholderProperty);
    set => SetValue(PlaceholderProperty, value);
  }

  public IEnumerable<FsusShortcutGesture>? ExistingShortcuts
  {
    get => GetValue(ExistingShortcutsProperty);
    set => SetValue(ExistingShortcutsProperty, value);
  }

  public IEnumerable<FsusShortcutGesture>? ReservedShortcuts
  {
    get => GetValue(ReservedShortcutsProperty);
    set => SetValue(ReservedShortcutsProperty, value);
  }

  public bool AllowBareKeys
  {
    get => GetValue(AllowBareKeysProperty);
    set => SetValue(AllowBareKeysProperty, value);
  }

  public void StartRecording()
  {
    if (!IsEnabled || IsRecording)
    {
      return;
    }

    IsRecording = true;
  }

  public void CancelRecording()
  {
    if (!IsRecording)
    {
      return;
    }

    IsRecording = false;
    SyncDisplayText();
    Focus();
  }

  public void Clear()
  {
    if (!CanClear())
    {
      return;
    }

    IsRecording = false;
    Value = null;
    Status = FsusShortcutValidationStatus.Valid;
    StatusMessage = null;
    IsInvalid = false;
    Focus();
  }

  public void Validate()
  {
    if (Value is null)
    {
      SetValidationState(FsusShortcutValidationStatus.Valid, null);
      return;
    }

    if (Value.Key == Key.None || FsusShortcutGesture.IsModifierKey(Value.Key))
    {
      SetValidationState(
        FsusShortcutValidationStatus.Invalid,
        "Shortcut must include a non-modifier key.");
      return;
    }

    var hasModifiers =
      (Value.Modifiers &
       (KeyModifiers.Control |
        KeyModifiers.Alt |
        KeyModifiers.Shift |
        KeyModifiers.Meta)) != 0;
    if (!AllowBareKeys &&
        !hasModifiers &&
        !FsusShortcutGesture.IsFunctionKey(Value.Key))
    {
      SetValidationState(
        FsusShortcutValidationStatus.Invalid,
        "Modifier key required (Ctrl, Alt, or Shift).");
      return;
    }

    if (ReservedShortcuts is not null)
    {
      var isReserved = ReservedShortcuts.Any(candidate => candidate.Equals(Value));
      if (isReserved)
      {
        SetValidationState(
          FsusShortcutValidationStatus.Reserved,
          "Shortcut is reserved by system.");
        return;
      }
    }

    if (ExistingShortcuts is not null)
    {
      var isDuplicate = ExistingShortcuts.Any(candidate => candidate.Equals(Value));
      if (isDuplicate)
      {
        SetValidationState(
          FsusShortcutValidationStatus.Duplicate,
          "Shortcut conflicts with an existing assignment.");
        return;
      }
    }

    SetValidationState(FsusShortcutValidationStatus.Valid, null);
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);

    if (IsEnabled && !e.Handled)
    {
      Focus();
      StartRecording();
      e.Handled = true;
    }
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);

    if (!IsEnabled)
    {
      return;
    }

    if (!IsRecording)
    {
      if (e.Key is Key.Enter or Key.Space)
      {
        StartRecording();
        e.Handled = true;
      }
      else if ((e.Key is Key.Back or Key.Delete) && CanClear())
      {
        Clear();
        e.Handled = true;
      }
      return;
    }

    e.Handled = true;

    if (e.Key == Key.Escape)
    {
      CancelRecording();
      return;
    }

    if (e.Key is Key.Back or Key.Delete)
    {
      if (CanClear())
      {
        Clear();
      }
      else
      {
        IsRecording = false;
        Focus();
      }
      return;
    }

    if (FsusShortcutGesture.IsModifierKey(e.Key))
    {
      UpdatePreviewModifiers(e.KeyModifiers);
      return;
    }

    var isFunctionKey = FsusShortcutGesture.IsFunctionKey(e.Key);
    var hasModifiers = (e.KeyModifiers & (KeyModifiers.Control | KeyModifiers.Alt | KeyModifiers.Shift | KeyModifiers.Meta)) != 0;

    if (!hasModifiers && !isFunctionKey && !AllowBareKeys)
    {
      SetValidationState(
        FsusShortcutValidationStatus.Invalid,
        "Modifier key required (Ctrl, Alt, or Shift).");
      IsRecording = false;
      Focus();
      return;
    }

    var recorded = FsusShortcutGesture.FromKey(e.Key, e.KeyModifiers, Platform);
    Value = recorded;
    IsRecording = false;
    Focus();
  }

  protected override void OnKeyUp(KeyEventArgs e)
  {
    base.OnKeyUp(e);

    if (IsRecording && FsusShortcutGesture.IsModifierKey(e.Key))
    {
      UpdatePreviewModifiers(e.KeyModifiers);
    }
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ValueProperty)
    {
      var oldValue = change.GetOldValue<FsusShortcutGesture?>();
      var newValue = change.GetNewValue<FsusShortcutGesture?>();
      Validate();
      SyncDisplayText();
      SyncAutomation();
      SyncValueState(newValue, IsRecording);
      ValueChanged?.Invoke(this, new FsusShortcutValueChangedEventArgs(oldValue, newValue));
      RaiseCommandStateChanged();
    }
    else if (change.Property == IsRecordingProperty)
    {
      var recording = change.GetNewValue<bool>();
      SyncClasses();
      SyncDisplayText();
      SyncAutomation();
      SyncValueState(Value, recording);
      RecordingStateChanged?.Invoke(this, recording);
      RaiseCommandStateChanged();
    }
    else if (change.Property == StatusProperty || change.Property == StatusMessageProperty)
    {
      SyncClasses();
      SyncAutomation();
      ValidationStatusChanged?.Invoke(this, new FsusShortcutValidationChangedEventArgs(Status, StatusMessage));
      RaiseCommandStateChanged();
    }
    else if (change.Property == IsInvalidProperty)
    {
      SyncClasses();
      SyncAutomation();
      RaiseCommandStateChanged();
    }
    else if (change.Property == SizeProperty)
    {
      SyncClasses();
    }
    else if (change.Property == PlatformProperty)
    {
      SyncDisplayText();
    }
    else if (change.Property == ExistingShortcutsProperty || change.Property == ReservedShortcutsProperty)
    {
      Validate();
    }
    else if (change.Property == IsClearableProperty ||
             change.Property == AllowBareKeysProperty)
    {
      Validate();
      SyncClasses();
      RaiseCommandStateChanged();
    }
    else if (change.Property == IsEnabledProperty)
    {
      SyncClasses();
      SyncAutomation();
      RaiseCommandStateChanged();
    }
    else if (change.Property == PlaceholderProperty)
    {
      SyncClasses();
    }
    else if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }
  }

  private void SetValidationState(FsusShortcutValidationStatus status, string? message)
  {
    Status = status;
    StatusMessage = message;
    IsInvalid = status != FsusShortcutValidationStatus.Valid;
  }

  private bool CanClear() =>
    IsEnabled && IsClearable && Value is not null;

  private void SyncDisplayText()
  {
    if (IsRecording)
    {
      DisplayText = "Press keys...";
      return;
    }

    DisplayText = Value?.ToDisplayText(Platform) ?? string.Empty;
  }

  private void UpdatePreviewModifiers(KeyModifiers modifiers)
  {
    var parts = new List<string>();
    var resolvedPlatform = Platform == FsusShortcutPlatform.Auto
      ? (RuntimeInformation.IsOSPlatform(OSPlatform.OSX) ? FsusShortcutPlatform.macOS : FsusShortcutPlatform.Windows)
      : Platform;

    if (resolvedPlatform == FsusShortcutPlatform.macOS)
    {
      if (modifiers.HasFlag(KeyModifiers.Control) || modifiers.HasFlag(KeyModifiers.Meta))
      {
        parts.Add("Command");
      }
      if (modifiers.HasFlag(KeyModifiers.Alt))
      {
        parts.Add("Option");
      }
      if (modifiers.HasFlag(KeyModifiers.Shift))
      {
        parts.Add("Shift");
      }
    }
    else
    {
      if (modifiers.HasFlag(KeyModifiers.Control))
      {
        parts.Add("Ctrl");
      }
      if (modifiers.HasFlag(KeyModifiers.Alt))
      {
        parts.Add("Alt");
      }
      if (modifiers.HasFlag(KeyModifiers.Shift))
      {
        parts.Add("Shift");
      }
      if (modifiers.HasFlag(KeyModifiers.Meta))
      {
        parts.Add("Win");
      }
    }

    if (parts.Count > 0)
    {
      parts.Add("...");
      DisplayText = string.Join("+", parts);
    }
    else
    {
      DisplayText = "Press keys...";
    }
  }

  private void SyncClasses()
  {
    FsusComponentClasses.SyncSize(this, Size);
    FsusComponentClasses.Ensure(this, "fsus-recording", IsRecording);
    FsusComponentClasses.Ensure(this, "fsus-invalid", IsInvalid);
    FsusComponentClasses.Ensure(this, "fsus-duplicate", Status == FsusShortcutValidationStatus.Duplicate);
    FsusComponentClasses.Ensure(this, "fsus-reserved", Status == FsusShortcutValidationStatus.Reserved);
    SyncValueState(Value, IsRecording);
  }

  private void SyncValueState(
    FsusShortcutGesture? value,
    bool recording)
  {
    var isEmpty = value is null && !recording;
    var canClear =
      IsEnabled &&
      IsClearable &&
      value is not null;
    FsusComponentClasses.Ensure(this, "fsus-empty", isEmpty);
    FsusComponentClasses.Ensure(this, "fsus-can-clear", canClear);
  }

  private void SyncAutomation()
  {
    var name = !string.IsNullOrWhiteSpace(AccessibleName)
      ? AccessibleName
      : "Shortcut recorder";
    AutomationProperties.SetName(this, name);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Edit);

    var statusText = Status switch
    {
      FsusShortcutValidationStatus.Duplicate => $"conflict: {StatusMessage ?? "Duplicate shortcut"}",
      FsusShortcutValidationStatus.Reserved => $"reserved: {StatusMessage ?? "Reserved shortcut"}",
      FsusShortcutValidationStatus.Invalid => $"invalid: {StatusMessage ?? "Invalid shortcut"}",
      _ => IsRecording ? "recording" : (Value is null ? "empty" : "valid"),
    };
    AutomationProperties.SetItemStatus(this, statusText);

    AutomationProperties.SetHelpText(this, StatusMessage);
  }

  private void RaiseCommandStateChanged()
  {
    startRecordingCommand.RaiseCanExecuteChanged();
    cancelRecordingCommand.RaiseCanExecuteChanged();
    clearCommand.RaiseCanExecuteChanged();
  }

  private sealed class RelayCommand(Action<object?> execute, Func<object?, bool>? canExecute = null) : ICommand
  {
    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => canExecute?.Invoke(parameter) ?? true;

    public void Execute(object? parameter) => execute(parameter);

    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
  }
}
