using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Data;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusAutocompleteEditableHeadlessTests
{
  private static readonly string[] FontFamilies =
  [
    "Arial",
    "Cascadia Code",
    "Courier New",
    "Inter",
    "Roboto",
    "Segoe UI",
    "Tahoma",
  ];

  [AvaloniaFact]
  public void PointerClickOpensPopup()
  {
    var autocomplete = new FsusAutocomplete
    {
      Name = "FontPicker",
      ItemsSource = FontFamilies,
    };

    var window = MountWindow([("FontPicker", autocomplete)]);
    window.Show();

    Assert.False(autocomplete.IsOpen);
    Assert.NotNull(autocomplete.Popup);
    Assert.False(autocomplete.Popup!.IsOpen);

    // Click the autocomplete surface
    ClickControl(window, autocomplete);

    Assert.True(autocomplete.IsOpen);
    Assert.True(autocomplete.Popup.IsOpen);
    Assert.True(autocomplete.Suggestions.Count > 0);

    window.Close();
  }

  [AvaloniaFact]
  public void TypingFiltersOptionsAndUpdatesPopup()
  {
    var autocomplete = new FsusAutocomplete
    {
      Name = "FontPicker",
      ItemsSource = FontFamilies,
    };

    var window = MountWindow([("FontPicker", autocomplete)]);
    window.Show();

    Assert.NotNull(autocomplete.TextBox);

    // Type "casc"
    autocomplete.TextBox!.Text = "casc";

    Assert.Equal("casc", autocomplete.Text);
    Assert.Single(autocomplete.Suggestions);
    Assert.Equal("Cascadia Code", autocomplete.Suggestions[0].Label);

    // Type "segoe"
    autocomplete.TextBox.Text = "segoe";
    Assert.Equal("segoe", autocomplete.Text);
    Assert.Single(autocomplete.Suggestions);
    Assert.Equal("Segoe UI", autocomplete.Suggestions[0].Label);

    window.Close();
  }

  [AvaloniaFact]
  public void KeyboardNavigationSelectsOptionAndClosesPopup()
  {
    var autocomplete = new FsusAutocomplete
    {
      Name = "FontPicker",
      ItemsSource = FontFamilies,
    };

    var window = MountWindow([("FontPicker", autocomplete)]);
    window.Show();

    // Open popup and focus
    autocomplete.Focus();
    autocomplete.OpenPopup();
    Assert.True(autocomplete.IsOpen);

    // Down arrow to index 1 ("Cascadia Code")
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, null);
    Assert.Equal(1, autocomplete.HighlightedIndex);

    // Enter to select
    window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
    Assert.False(autocomplete.IsOpen);
    Assert.Equal("Cascadia Code", autocomplete.SelectedValue);
    Assert.Equal("Cascadia Code", autocomplete.Text);
    Assert.Equal("Cascadia Code", autocomplete.TextBox!.Text);

    // Reopen and press Escape
    autocomplete.OpenPopup();
    Assert.True(autocomplete.IsOpen);
    window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Assert.False(autocomplete.IsOpen);
    Assert.Equal("Cascadia Code", autocomplete.SelectedValue);

    window.Close();
  }

  [AvaloniaFact]
  public void BoundSelectedValueAndTextSynchronizeTwoWayWithViewModel()
  {
    var vm = new SettingsViewModel { SelectedFont = "Inter", FontText = "Inter" };
    var autocomplete = new FsusAutocomplete
    {
      Name = "FontPicker",
      ItemsSource = FontFamilies,
      DataContext = vm,
    };

    autocomplete.Bind(
      FsusAutocomplete.SelectedValueProperty,
      new Binding(nameof(SettingsViewModel.SelectedFont)) { Mode = BindingMode.TwoWay });
    autocomplete.Bind(
      FsusAutocomplete.TextProperty,
      new Binding(nameof(SettingsViewModel.FontText)) { Mode = BindingMode.TwoWay });

    var window = MountWindow([("FontPicker", autocomplete)]);
    window.Show();

    // Initial binding sync: ViewModel -> Autocomplete
    Assert.Equal("Inter", autocomplete.SelectedValue);
    Assert.Equal("Inter", autocomplete.Text);
    Assert.Equal("Inter", autocomplete.TextBox!.Text);

    // Autocomplete selection change -> ViewModel
    autocomplete.SelectValue("Cascadia Code");
    Assert.Equal("Cascadia Code", vm.SelectedFont);
    Assert.Equal("Cascadia Code", vm.FontText);

    // ViewModel change -> Autocomplete
    vm.SelectedFont = "Segoe UI";
    Assert.Equal("Segoe UI", autocomplete.SelectedValue);
    Assert.Equal("Segoe UI", autocomplete.Text);
    Assert.Equal("Segoe UI", autocomplete.TextBox.Text);

    window.Close();
  }

  private sealed class SettingsViewModel : INotifyPropertyChanged
  {
    private string? selectedFont;
    private string? fontText;

    public string? SelectedFont
    {
      get => selectedFont;
      set
      {
        if (selectedFont != value)
        {
          selectedFont = value;
          OnPropertyChanged();
        }
      }
    }

    public string? FontText
    {
      get => fontText;
      set
      {
        if (fontText != value)
        {
          fontText = value;
          OnPropertyChanged();
        }
      }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
      PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
  }

  private static Window MountWindow(
    (string name, Control content)[] children,
    double width = 480)
  {
    var stack = new StackPanel { Margin = new Thickness(16), Spacing = 8 };
    foreach (var child in children)
    {
      child.content.Name = child.name;
      stack.Children.Add(child.content);
    }

    var window = new Window
    {
      Width = width,
      Height = 360,
      Content = stack,
    };
    AttachFsusTheme(window);

    return window;
  }

  private static void AttachFsusTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions { Variant = FsusThemeVariant.Light });
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }

  private static void ClickControl(Window window, Control control)
  {
    var centerInControl = new Point(
      Math.Max(1, control.Bounds.Width / 2),
      Math.Max(1, control.Bounds.Height / 2));
    var centerInWindow =
      control.TranslatePoint(centerInControl, window)
      ?? new Point(20, 20);

    window.MouseDown(centerInWindow, MouseButton.Left);
    window.MouseUp(centerInWindow, MouseButton.Left);
  }
}
