using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusValuePickerPrimitiveTests
{
  [Fact]
  public async Task SliderClampsSnapsCommitsKeyboardAndExposesRangeAutomation()
  {
    var changes = new List<double>();
    var commits = new List<(double OldValue, double NewValue)>();
    var slider = new KeyboardSlider
    {
      AccessibleName = "Volume",
      Min = 0,
      Max = 100,
      Step = 5,
      Value = 50,
    };
    slider.Marks.Add(new FsusSliderMark(0, "Mute"));
    slider.Marks.Add(new FsusSliderMark(50, "Half"));
    slider.Marks.Add(new FsusSliderMark(100, "Full"));
    slider.ValueChanged += (_, args) => changes.Add(args.NewValue);
    slider.ValueCommitted += (_, args) => commits.Add((args.OldValue, args.NewValue));

    slider.SetValue(103);

    Assert.Equal(100, slider.Value);
    Assert.Equal(100, slider.SelectedValue);
    Assert.Equal(new[] { 100d }, changes);
    Assert.Contains("fsus-has-marks", slider.Classes);

    Assert.True(await slider.PressAsync(Key.Left));

    Assert.Equal(95, slider.Value);
    Assert.Equal((100d, 95d), commits[^1]);

    Assert.True(await slider.PressAsync(Key.Home));
    Assert.Equal(0, slider.Value);
    Assert.True(await slider.PressAsync(Key.End));
    Assert.Equal(100, slider.Value);
    Assert.True(await slider.PressAsync(Key.PageDown));
    Assert.Equal(50, slider.Value);
    Assert.True(await slider.PressAsync(Key.PageUp));
    Assert.Equal(100, slider.Value);
    Assert.True(await slider.PressAsync(Key.Down));
    Assert.Equal(95, slider.Value);
    Assert.True(await slider.PressAsync(Key.Up));
    Assert.Equal(100, slider.Value);

    Assert.True(slider.DragToRatio(0.25));

    Assert.Equal(25, slider.Value);
    Assert.Equal(AutomationControlType.Slider, AutomationProperties.GetControlTypeOverride(slider));
    Assert.Equal("Volume", AutomationProperties.GetName(slider));
    Assert.Equal("25", AutomationProperties.GetItemStatus(slider));

    var peer = ControlAutomationPeer.CreatePeerForElement(slider);
    var range = Assert.IsAssignableFrom<IRangeValueProvider>(peer);
    Assert.Equal(0, range.Minimum);
    Assert.Equal(100, range.Maximum);
    Assert.Equal(25, range.Value);
    Assert.Equal(5, range.SmallChange);
    Assert.Equal(50, range.LargeChange);
    Assert.False(range.IsReadOnly);

    slider.AccessibleValueText = "25 percent";
    Assert.Equal("25 percent", AutomationProperties.GetItemStatus(slider));

    slider.IsDisabled = true;

    Assert.False(await slider.PressAsync(Key.Right));
    Assert.False(slider.DragToRatio(0.75));
    Assert.Equal(25, slider.Value);
    Assert.Contains("fsus-disabled", slider.Classes);
    Assert.True(range.IsReadOnly);
    range.SetValue(75);
    Assert.Equal(25, slider.Value);
  }

  [Fact]
  public async Task SliderSupportsReversedBoundsForSnappingRatioAndKeyboardDirection()
  {
    var slider = new KeyboardSlider
    {
      Min = 100,
      Max = 0,
      Step = 10,
      Value = 76,
    };

    Assert.Equal(80, slider.Value);
    Assert.True(slider.DragToRatio(0.25));
    Assert.Equal(70, slider.Value);

    Assert.True(await slider.PressAsync(Key.Right));
    Assert.Equal(60, slider.Value);
    Assert.True(await slider.PressAsync(Key.Left));
    Assert.Equal(70, slider.Value);
    Assert.True(await slider.PressAsync(Key.Home));
    Assert.Equal(100, slider.Value);
    Assert.True(await slider.PressAsync(Key.End));
    Assert.Equal(0, slider.Value);

    var range = Assert.IsAssignableFrom<IRangeValueProvider>(
      ControlAutomationPeer.CreatePeerForElement(slider));
    Assert.Equal(0, range.Minimum);
    Assert.Equal(100, range.Maximum);
  }

  [Fact]
  public async Task RateSupportsHalfValuesKeyboardPointerAndDisabledState()
  {
    var rate = new KeyboardRate
    {
      AccessibleName = "Satisfaction",
      Max = 5,
      AllowHalf = true,
      Value = 3,
    };

    rate.SetValue(3.7);

    Assert.Equal(3.5, rate.Value);
    Assert.Contains("fsus-half", rate.Classes);

    Assert.True(await rate.PressAsync(Key.Right));

    Assert.Equal(4, rate.Value);

    Assert.True(rate.DragToRatio(0.9));

    Assert.Equal(4.5, rate.Value);
    Assert.Equal(AutomationControlType.Slider, AutomationProperties.GetControlTypeOverride(rate));
    Assert.Equal("4.5 / 5", AutomationProperties.GetItemStatus(rate));

    rate.IsDisabled = true;

    Assert.False(await rate.PressAsync(Key.Right));
    Assert.False(rate.DragToRatio(0.2));
    Assert.Equal(4.5, rate.Value);
    Assert.Contains("fsus-disabled", rate.Classes);
  }

  [Fact]
  public async Task ColorPickerFormatsAlphaPresetsClearAndInvalidFormState()
  {
    var picker = new KeyboardColorPicker
    {
      AccessibleName = "Accent color",
      IsClearable = true,
      ShowAlpha = true,
    };
    picker.PresetColors.Add("#2A599C");
    picker.PresetColors.Add("#D92D20");

    Assert.True(picker.SelectPreset("#2A599C"));
    Assert.True(picker.SetAlpha(0.5));

    Assert.Equal("rgba(42,89,156,0.50)", picker.Value);
    Assert.Equal("rgba(42,89,156,0.50)", picker.SelectedValue);
    Assert.Contains("fsus-alpha", picker.Classes);
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(picker));
    Assert.Equal("Accent color", AutomationProperties.GetName(picker));
    Assert.Equal("selected rgba(42,89,156,0.50)", AutomationProperties.GetItemStatus(picker));

    Assert.True(await picker.PressAsync(Key.Delete));

    Assert.Null(picker.Value);
    Assert.Contains("fsus-empty", picker.Classes);

    var item = new FsusFormItem
    {
      FieldName = "accent",
      Label = "Accent",
      IsRequired = true,
      Content = picker,
    };
    var form = new FsusForm();
    form.Children.Add(item);

    var invalid = await form.ValidateAsync();

    Assert.False(invalid.IsValid);
    Assert.Equal(FsusFormValidationState.Error, item.ValidationState);
  }

  [Fact]
  public void ValuePickerThemeAndVisualBaselinesCoverStable29()
  {
    var valuePickers = ReadControlTheme("ValuePickers.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusSlider",
      "fsus|FsusRate",
      "fsus|FsusColorPicker",
    })
    {
      Assert.Contains(selector, valuePickers);
    }

    Assert.Contains("FsusThemeValuePickerTrackBrush", valuePickers);
    Assert.Contains("FsusMotionDurationEffective", valuePickers);
    Assert.Contains("FsusDensityControlDefaultY", valuePickers);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/ValuePickers.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("value-picker-stable29-light-default-web-avalonia", visualFixture);
    Assert.Contains("value-picker-stable29-dark-spacious-web-avalonia", visualFixture);
    Assert.Contains("value-picker-stable29-high-contrast-compact-web-avalonia", visualFixture);
  }

  private sealed class KeyboardSlider : FsusSlider
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardRate : FsusRate
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardColorPicker : FsusColorPicker
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
