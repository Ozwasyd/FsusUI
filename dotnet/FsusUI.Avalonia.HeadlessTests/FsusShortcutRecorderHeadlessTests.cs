using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

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

  [AvaloniaFact]
  public void PlaceholderAndAccessibleClearActionRestoreRecorderFocus()
  {
    var recorder = new FsusShortcutRecorder
    {
      AccessibleName = "Editor shortcut",
      Placeholder = "Record editor shortcut",
    };
    var window = MountWindow([("recorder", recorder)]);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var placeholder = recorder.GetVisualDescendants()
      .OfType<TextBlock>()
      .Single(control => control.Name == "PART_PlaceholderText");
    var clear = recorder.GetVisualDescendants()
      .OfType<Button>()
      .Single(control => control.Name == "PART_ClearButton");
    Assert.True(placeholder.IsVisible);
    Assert.Equal("Record editor shortcut", placeholder.Text);
    Assert.False(clear.IsVisible);
    Assert.Equal("Clear shortcut", AutomationProperties.GetName(clear));

    recorder.Status = FsusShortcutValidationStatus.Invalid;
    recorder.StatusMessage = "Modifier key required.";
    recorder.IsInvalid = true;
    Dispatcher.UIThread.RunJobs();
    Assert.True(placeholder.IsVisible);
    Assert.False(clear.IsVisible);

    recorder.Value =
      new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift);
    Dispatcher.UIThread.RunJobs();
    Assert.DoesNotContain("fsus-empty", recorder.Classes);
    Assert.Contains("fsus-can-clear", recorder.Classes);
    Assert.False(placeholder.IsVisible);
    Assert.True(clear.IsVisible);
    Assert.True(clear.Focus());
    clear.Command!.Execute(null);
    Dispatcher.UIThread.RunJobs();

    Assert.Null(recorder.Value);
    Assert.True(recorder.IsFocused);
    window.Close();
  }

  [AvaloniaFact]
  public void ProductionFixtureRendersShortcutRecorderStateMatrix()
  {
    var evidenceVariant =
      Environment.GetEnvironmentVariable("FSUS_PR675_EVIDENCE_VARIANT")
      ?? "candidate";
    var outputRoot =
      Environment.GetEnvironmentVariable("FSUS_PR675_EVIDENCE_ROOT")
      ?? Path.Combine(
        FindRepositoryRoot(),
        "dotnet",
        "FsusUI.Avalonia.HeadlessTests",
        "TestResults",
        "fsus-pr675-rendered-evidence");
    Directory.CreateDirectory(outputRoot);

    var captures = new List<ShortcutRecorderRenderCapture>();
    foreach (var (theme, variant, highContrast) in new[]
      {
        (Theme: "light", Variant: FsusThemeVariant.Light, HighContrast: false),
        (Theme: "dark", Variant: FsusThemeVariant.Dark, HighContrast: false),
        (Theme: "high-contrast", Variant: FsusThemeVariant.Dark, HighContrast: true),
      })
    {
      captures.Add(RenderStateMatrix(
        outputRoot,
        evidenceVariant,
        theme,
        variant,
        highContrast));
    }

    Assert.Equal(3, captures.Count);
    Assert.All(captures, capture =>
    {
      Assert.True(File.Exists(capture.File));
      Assert.True(new FileInfo(capture.File).Length > 1_000);
      Assert.Equal(64, capture.Sha256.Length);
      Assert.Equal(900, capture.Width);
      Assert.Equal(640, capture.Height);
    });

    var manifestPath = Path.Combine(
      outputRoot,
      $"shortcut-recorder-{evidenceVariant}-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          generatedBy =
            "FsusShortcutRecorderHeadlessTests.ProductionFixtureRendersShortcutRecorderStateMatrix",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion =
              typeof(Application).Assembly.GetName().Version?.ToString(),
          },
          issue = 648,
          evidenceVariant,
          localSimulation = new
          {
            physicalMacOS = false,
            physicalWindows = false,
            note =
              "Theme and input states are rendered by Avalonia Headless Skia on the local Linux host.",
          },
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
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

  private static ShortcutRecorderRenderCapture RenderStateMatrix(
    string outputRoot,
    string evidenceVariant,
    string theme,
    FsusThemeVariant variant,
    bool highContrast)
  {
    var existing = new FsusShortcutGesture(Key.S, KeyModifiers.Control);
    var reserved = new FsusShortcutGesture(Key.Q, KeyModifiers.Control);
    var controls = new[]
    {
      (
        Label: "Unassigned command",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Unassigned editor command",
          Placeholder = "Record shortcut",
        }),
      (
        Label: "Assigned · Save document",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Save document shortcut",
          Value = existing,
        }),
      (
        Label: "Recording · Publish command",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Publish command shortcut",
        }),
      (
        Label: "Conflict · Save already uses Ctrl+S",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Conflicting shortcut",
          ExistingShortcuts = new[] { existing },
          Value = existing,
        }),
      (
        Label: "Reserved · Quit command",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Reserved shortcut",
          ReservedShortcuts = new[] { reserved },
          Value = reserved,
        }),
      (
        Label: "Invalid · modifier required",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Invalid shortcut",
          Status = FsusShortcutValidationStatus.Invalid,
          StatusMessage = "Modifier key required.",
          IsInvalid = true,
        }),
      (
        Label: "Disabled · managed by administrator",
        Control: new FsusShortcutRecorder
        {
          AccessibleName = "Managed shortcut",
          Value = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift),
          IsEnabled = false,
        }),
    };
    controls[2].Control.StartRecording();

    var content = new StackPanel
    {
      Spacing = 10,
    };
    content.Children.Add(new TextBlock
    {
      Text = $"Shortcut recorder · {theme}",
      FontSize = 18,
      FontWeight = FontWeight.SemiBold,
    });
    foreach (var (label, control) in controls)
    {
      content.Children.Add(new TextBlock
      {
        Text = label,
        FontSize = 12,
      });
      content.Children.Add(control);
    }

    var surface = new Border
    {
      Width = 900,
      Height = 640,
      Padding = new Thickness(28),
      Child = content,
    };
    var window = new Window
    {
      Width = 900,
      Height = 640,
      Content = surface,
      ShowInTaskbar = false,
    };
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(
      resources,
      new FsusThemeOptions
      {
        Variant = variant,
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    var textBrush = Assert.IsAssignableFrom<IBrush>(
      resources[FsusThemeResourceKeys.TextBrush]);
    foreach (var text in content.Children.OfType<TextBlock>())
    {
      text.Foreground = textBrush;
    }
    surface.Background = Assert.IsAssignableFrom<IBrush>(
      resources[FsusThemeResourceKeys.BackgroundBrush]);

    window.Show();
    Assert.True(controls[1].Control.Focus());
    Dispatcher.UIThread.RunJobs();
    window.Measure(new Size(900, 640));
    window.Arrange(new Rect(0, 0, 900, 640));
    surface.Measure(new Size(900, 640));
    surface.Arrange(new Rect(0, 0, 900, 640));

    var file = Path.Combine(
      outputRoot,
      $"shortcut-recorder-{evidenceVariant}-{theme}.png");
    using var bitmap =
      new RenderTargetBitmap(new PixelSize(900, 640), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(file))
    {
      bitmap.Save(stream);
    }
    window.Close();

    return new ShortcutRecorderRenderCapture(
      file,
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(file))),
      bitmap.PixelSize.Width,
      bitmap.PixelSize.Height,
      theme,
      highContrast,
      "keyboard-pointer-screen-reader-reduced-motion",
      controls.Select(item => new ShortcutRecorderStateEvidence(
        item.Label,
        item.Control.DisplayText,
        item.Control.Status.ToString(),
        AutomationProperties.GetName(item.Control) ?? string.Empty,
        AutomationProperties.GetItemStatus(item.Control) ?? string.Empty))
        .ToArray());
  }

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }

    throw new DirectoryNotFoundException(
      "Could not locate the FsusUI repository root.");
  }

  private sealed record ShortcutRecorderStateEvidence(
    string State,
    string DisplayText,
    string ValidationStatus,
    string AutomationName,
    string AutomationItemStatus);

  private sealed record ShortcutRecorderRenderCapture(
    string File,
    string Sha256,
    int Width,
    int Height,
    string Theme,
    bool HighContrast,
    string InputModes,
    IReadOnlyList<ShortcutRecorderStateEvidence> States);
}
