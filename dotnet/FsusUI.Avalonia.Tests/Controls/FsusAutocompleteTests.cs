using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Collections.ObjectModel;
using System.ComponentModel;
using Xunit;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusAutocompleteTests
{
  [Fact]
  public void EditableTextAndSelectionSynchronizeBothWays()
  {
    var autocomplete = new TestableAutocomplete
    {
      ItemsSource = new[] { "Arial", "Cascadia Code", "Courier New", "Inter", "Segoe UI" },
    };

    // 1. Setting SelectedValue updates Text and selection
    autocomplete.SelectedValue = "Courier New";
    Assert.Equal("Courier New", autocomplete.Text);
    Assert.Equal("Courier New", autocomplete.SelectedValue);
    Assert.Equal("Courier New", autocomplete.SelectedLabel);

    // 2. Setting Text to matching item synchronizes SelectedValue
    autocomplete.Text = "Inter";
    Assert.Equal("Inter", autocomplete.SelectedValue);
    Assert.Equal("Inter", autocomplete.SelectedLabel);

    // 3. Setting Text to non-matching text clears SelectedValue
    autocomplete.Text = "Custom Unknown Font";
    Assert.Null(autocomplete.SelectedValue);
    Assert.Equal("Custom Unknown Font", autocomplete.Text);

    // 4. Selecting an option via SelectOption updates Text and SelectedValue
    autocomplete.Text = string.Empty;
    var cascadia = autocomplete.FilteredOptions.FirstOrDefault(o => o.Label == "Cascadia Code");
    Assert.NotNull(cascadia);
    Assert.True(autocomplete.SelectOption(cascadia!));
    Assert.Equal("Cascadia Code", autocomplete.SelectedValue);
    Assert.Equal("Cascadia Code", autocomplete.Text);
  }

  [Fact]
  public void FilteredOptionsUpdateAsUserTypes()
  {
    var autocomplete = new TestableAutocomplete
    {
      ItemsSource = new[] { "Arial", "Cascadia Code", "Courier New", "Inter", "Segoe UI", "Tahoma" },
    };

    Assert.Equal(6, autocomplete.TotalOptionCount);

    // Filter by "casc" (case-insensitive substring)
    autocomplete.Text = "casc";
    Assert.Single(autocomplete.Suggestions);
    Assert.Equal("Cascadia Code", autocomplete.Suggestions[0].Label);

    // Filter by "a" -> "Arial", "Cascadia Code", "Tahoma"
    autocomplete.Text = "a";
    Assert.Equal(3, autocomplete.Suggestions.Count);
    Assert.Equal(new[] { "Arial", "Cascadia Code", "Tahoma" }, autocomplete.Suggestions.Select(o => o.Label));

    // Non-matching query
    autocomplete.Text = "xyz123";
    Assert.Empty(autocomplete.Suggestions);

    // Empty query resets to all options
    autocomplete.Text = string.Empty;
    Assert.Equal(6, autocomplete.Suggestions.Count);
  }

  [Fact]
  public async Task UpDownNavigatesSuggestionsEnterSelectsEscapeCloses()
  {
    var autocomplete = new TestableAutocomplete
    {
      ItemsSource = new[] { "Arial", "Cascadia Code", "Courier New" },
    };

    autocomplete.OpenPopup();
    Assert.True(autocomplete.IsOpen);
    Assert.Equal(0, autocomplete.HighlightedIndex);

    // Press Down -> moves to index 1 ("Cascadia Code")
    Assert.True(await autocomplete.PressAsync(Key.Down));
    Assert.Equal(1, autocomplete.HighlightedIndex);

    // Press Down -> moves to index 2 ("Courier New")
    Assert.True(await autocomplete.PressAsync(Key.Down));
    Assert.Equal(2, autocomplete.HighlightedIndex);

    // Press Up -> moves back to index 1 ("Cascadia Code")
    Assert.True(await autocomplete.PressAsync(Key.Up));
    Assert.Equal(1, autocomplete.HighlightedIndex);

    // Press Enter -> selects highlighted option, closes popup, sets Text and SelectedValue
    Assert.True(await autocomplete.PressAsync(Key.Enter));
    Assert.False(autocomplete.IsOpen);
    Assert.Equal("Cascadia Code", autocomplete.SelectedValue);
    Assert.Equal("Cascadia Code", autocomplete.Text);

    // Reopen popup and press Escape -> closes popup without changing selection
    autocomplete.OpenPopup();
    Assert.True(autocomplete.IsOpen);
    Assert.True(await autocomplete.PressAsync(Key.Escape));
    Assert.False(autocomplete.IsOpen);
    Assert.Equal("Cascadia Code", autocomplete.SelectedValue);
    Assert.Equal("Cascadia Code", autocomplete.Text);
  }

  [Fact]
  public void ItemsSourceSupportsObjectsStringsAndObservableCollections()
  {
    // 1. Strings
    var stringSource = new TestableAutocomplete
    {
      ItemsSource = new[] { "Option A", "Option B" },
    };
    Assert.Equal(2, stringSource.TotalOptionCount);

    // 2. Custom objects
    var fontItems = new[]
    {
      new FontDescriptor("Fira Code", true),
      new FontDescriptor("JetBrains Mono", true),
      new FontDescriptor("Times New Roman", false),
    };
    var objectSource = new TestableAutocomplete
    {
      ItemsSource = fontItems,
    };
    Assert.Equal(3, objectSource.TotalOptionCount);
    objectSource.SelectedValue = fontItems[1];
    Assert.Equal(fontItems[1], objectSource.SelectedValue);
    Assert.Equal("JetBrains Mono", objectSource.Text);

    // 3. Dynamic ObservableCollection
    var dynamicCollection = new ObservableCollection<string> { "Alpha", "Beta" };
    var dynamicSource = new TestableAutocomplete
    {
      ItemsSource = dynamicCollection,
    };
    Assert.Equal(2, dynamicSource.TotalOptionCount);

    dynamicCollection.Add("Gamma");
    Assert.Equal(3, dynamicSource.TotalOptionCount);
    Assert.Contains(dynamicSource.FilteredOptions, o => o.Label == "Gamma");

    dynamicCollection.Remove("Alpha");
    Assert.Equal(2, dynamicSource.TotalOptionCount);
    Assert.DoesNotContain(dynamicSource.FilteredOptions, o => o.Label == "Alpha");
  }

  [Fact]
  public async Task VirtualizationAppliesWhenOptionsExceedThreshold()
  {
    var autocomplete = new TestableAutocomplete
    {
      VirtualizationThreshold = 50,
      VisibleOptionLimit = 16,
    };

    var items = new List<string>();
    for (var i = 0; i < 200; i++)
    {
      items.Add($"Font {i:D3}");
    }
    autocomplete.ItemsSource = items;

    Assert.Equal(200, autocomplete.TotalOptionCount);
    Assert.True(autocomplete.IsVirtualized);
    Assert.Equal(16, autocomplete.VirtualizedOptionCount);
    Assert.Contains("fsus-virtualized", autocomplete.Classes);

    // Scroll to index 50
    autocomplete.ScrollToOption(50);
    Assert.Equal(50, autocomplete.VirtualizedStartIndex);
    Assert.Equal("Font 050", autocomplete.VirtualizedOptions[0].Label);

    // Arrow navigation auto-scrolls virtualized window
    autocomplete.OpenPopup();
    for (var step = 0; step < 18; step++)
    {
      await autocomplete.PressAsync(Key.Down);
    }
    Assert.True(autocomplete.VirtualizedStartIndex > 0);
  }

  [Fact]
  public void AutocompleteCanReplaceNativeEditableComboBoxInSettingsForm()
  {
    var fonts = new[] { "Arial", "Cascadia Code", "Courier New", "Inter", "Segoe UI", "Tahoma" };
    var form = new FsusForm();
    var fontPicker = new FsusAutocomplete
    {
      AccessibleName = "System font",
      ItemsSource = fonts,
      SelectedValue = "Inter",
      IsClearable = true,
    };
    var formItem = new FsusFormItem
    {
      FieldName = "systemFont",
      Label = "System Font",
      Content = fontPicker,
    };
    form.Children.Add(formItem);
    form.RefreshFormState();

    Assert.Null(formItem.FieldAdapterError);
    Assert.Equal("Inter", fontPicker.Text);
    Assert.Equal("Inter", fontPicker.SelectedValue);

    // User types "Casc"
    fontPicker.Text = "Casc";
    Assert.Single(fontPicker.Suggestions);
    Assert.Equal("Cascadia Code", fontPicker.Suggestions[0].Label);

    // User selects "Cascadia Code"
    fontPicker.SelectOption(fontPicker.Suggestions[0]);
    Assert.Equal("Cascadia Code", fontPicker.SelectedValue);
    Assert.Equal("Cascadia Code", fontPicker.Text);

    // Change to Segoe UI
    fontPicker.SelectedValue = "Segoe UI";
    Assert.Equal("Segoe UI", fontPicker.SelectedValue);

    // Form item resets field back to initial value ("Inter")
    formItem.ResetField();
    Assert.Equal("Inter", fontPicker.SelectedValue);
    Assert.Equal("Inter", fontPicker.Text);
  }

  [Fact]
  public void ClearSelectionClearsTextAndSelectedValue()
  {
    var autocomplete = new FsusAutocomplete
    {
      ItemsSource = new[] { "Item 1", "Item 2" },
      IsClearable = true,
      SelectedValue = "Item 1",
    };

    Assert.Equal("Item 1", autocomplete.SelectedValue);
    Assert.Equal("Item 1", autocomplete.Text);

    autocomplete.ClearSelection();

    Assert.Null(autocomplete.SelectedValue);
    Assert.Equal(string.Empty, autocomplete.Text);
    Assert.Contains("fsus-empty", autocomplete.Classes);
  }

  [Fact]
  public void AutomationSemanticsMatchComboBox()
  {
    var autocomplete = new FsusAutocomplete
    {
      AccessibleName = "Font Family",
      ItemsSource = new[] { "Arial", "Roboto" },
      SelectedValue = "Roboto",
    };

    Assert.Equal("Roboto", AutomationProperties.GetName(autocomplete));
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(autocomplete));
    Assert.Contains("closed 1 selected", AutomationProperties.GetItemStatus(autocomplete));
  }

  private sealed record FontDescriptor(string Family, bool IsMonospace)
  {
    public override string ToString() => Family;
  }

  private sealed class TestableAutocomplete : FsusAutocomplete
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }
}
