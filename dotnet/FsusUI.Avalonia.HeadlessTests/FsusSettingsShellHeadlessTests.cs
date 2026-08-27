using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusSettingsShellHeadlessTests
{
  [AvaloniaFact]
  public void SettingsShellMountsIn950x650NativeWindowWithSevenCategories()
  {
    var window = CreateStyledWindow(950, 650);

    var shell = new FsusSettingsShell
    {
      AccessibleName = "System Settings",
      SearchSlot = new TextBox { PlaceholderText = "Search..." },
      ActionsSlot = new Button { Content = "Save changes" },
    };

    var categories = new[]
    {
      "General",
      "Appearance",
      "Sound",
      "Notifications",
      "Privacy",
      "Network",
      "Updates",
    };

    foreach (var cat in categories)
    {
      shell.Categories.Add(new FsusSettingsCategory
      {
        Key = cat.ToLowerInvariant(),
        Header = cat,
        Content = new TextBlock { Text = $"{cat} View", Height = 400 },
      });
    }

    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(7, shell.Categories.Count);
    Assert.Equal(220d, shell.RailWidth);
    Assert.DoesNotContain("fsus-tabs", shell.Classes);
    Assert.Contains("fsus-settings-shell", shell.Classes);
    Assert.Contains("fsus-has-search", shell.Classes);
    Assert.Contains("fsus-has-actions", shell.Classes);

    // Selected category is first enabled category
    Assert.Equal("general", shell.SelectedKey);
    Assert.True(shell.Categories[0].IsSelected);
    Assert.Contains("fsus-selected", shell.Categories[0].Classes);

    // All categories fit vertically within rail
    var totalHeight = shell.Categories.Sum((c) => c.Bounds.Height);
    Assert.True(totalHeight < 650, $"Categories total height {totalHeight} fits within window height 650");

    window.Close();
  }

  [AvaloniaFact]
  public void SelectingCategoryInMountedWindowUpdatesContentAndVisiblyMarksExactlyOneActive()
  {
    var window = CreateStyledWindow(950, 650);
    var shell = new FsusSettingsShell();

    var cat1 = new FsusSettingsCategory
    {
      Key = "profile",
      Header = "Profile",
      Content = new TextBlock { Text = "Profile Panel" },
    };
    var cat2 = new FsusSettingsCategory
    {
      Key = "security",
      Header = "Security",
      Content = new TextBlock { Text = "Security Panel" },
    };
    var cat3 = new FsusSettingsCategory
    {
      Key = "devices",
      Header = "Devices",
      Content = new TextBlock { Text = "Devices Panel" },
    };

    shell.Categories.Add(cat1);
    shell.Categories.Add(cat2);
    shell.Categories.Add(cat3);

    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    // Select category 2
    shell.SelectKey("security");
    Dispatcher.UIThread.RunJobs();

    Assert.Equal("security", shell.SelectedKey);
    Assert.False(cat1.IsSelected);
    Assert.DoesNotContain("fsus-selected", cat1.Classes);
    Assert.True(cat2.IsSelected);
    Assert.Contains("fsus-selected", cat2.Classes);
    Assert.False(cat3.IsSelected);
    Assert.DoesNotContain("fsus-selected", cat3.Classes);

    // Exactly one active category
    Assert.Single(shell.Categories, (c) => c.IsSelected);
    Assert.Single(shell.Categories, (c) => c.Classes.Contains("fsus-selected"));

    window.Close();
  }

  [AvaloniaFact]
  public void KeyboardArrowHomeEndNavigationAndAccessibleStateInHeadlessWindow()
  {
    var window = CreateStyledWindow(950, 650);
    var shell = new FsusSettingsShell();

    var cat1 = new FsusSettingsCategory { Key = "one", Header = "Category One" };
    var cat2 = new FsusSettingsCategory { Key = "two", Header = "Category Two", IsEnabled = false };
    var cat3 = new FsusSettingsCategory { Key = "three", Header = "Category Three" };
    var cat4 = new FsusSettingsCategory { Key = "four", Header = "Category Four" };

    shell.Categories.Add(cat1);
    shell.Categories.Add(cat2);
    shell.Categories.Add(cat3);
    shell.Categories.Add(cat4);

    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    shell.SelectKey("one");

    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat1));
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(cat2));
    Assert.Equal("available", AutomationProperties.GetItemStatus(cat3));

    // Down skips disabled cat2
    Assert.True(shell.HandleKey(Key.Down));
    Assert.Equal("three", shell.SelectedKey);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat3));

    // End navigates to cat4
    Assert.True(shell.HandleKey(Key.End));
    Assert.Equal("four", shell.SelectedKey);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat4));

    // Home navigates to cat1
    Assert.True(shell.HandleKey(Key.Home));
    Assert.Equal("one", shell.SelectedKey);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat1));

    window.Close();
  }

  [AvaloniaFact]
  public void LongContentScrollsIndependentlyWhileRailAndActionAreaRemainFixedInWindow()
  {
    var window = CreateStyledWindow(950, 650);
    var shell = new FsusSettingsShell
    {
      ActionsSlot = new Button { Content = "Save settings" },
      ScrollResetBehavior = FsusSettingsScrollResetBehavior.Reset,
    };

    var longPanel = new StackPanel { Height = 2500 };
    for (var i = 0; i < 25; i++)
    {
      longPanel.Children.Add(new TextBlock { Text = $"Entry {i}", Height = 100 });
    }

    var shortPanel = new TextBlock { Text = "Short view", Height = 150 };

    shell.Categories.Add(new FsusSettingsCategory { Key = "long", Header = "Long List", Content = longPanel });
    shell.Categories.Add(new FsusSettingsCategory { Key = "short", Header = "Short List", Content = shortPanel });

    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    // Scroll content
    shell.SetContentScrollOffset(new Vector(0, 400));
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(400d, shell.ContentScrollOffset.Y);
    // Rail offset remains fixed
    Assert.Equal(0d, shell.RailScrollViewer.Offset.Y);

    // Switch categories with Reset behavior
    shell.SelectKey("short");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(0d, shell.ContentScrollOffset.Y);

    // Switch back to long, verify reset
    shell.SelectKey("long");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(0d, shell.ContentScrollOffset.Y);

    // Test Restore behavior
    shell.ScrollResetBehavior = FsusSettingsScrollResetBehavior.Restore;
    shell.SetContentScrollOffset(new Vector(0, 500));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(500d, shell.ContentScrollOffset.Y);

    shell.SelectKey("short");
    shell.SetContentScrollOffset(new Vector(0, 60));
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(60d, shell.ContentScrollOffset.Y);

    shell.SelectKey("long");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(500d, shell.ContentScrollOffset.Y);

    shell.SelectKey("short");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(60d, shell.ContentScrollOffset.Y);

    window.Close();
  }

  [AvaloniaFact]
  public void HostEnforcesApplicationLevelSingletonWindowBehavior()
  {
    var hostManager = new HostSettingsWindowManager();

    // Open first window
    var window1 = hostManager.GetOrCreateWindow();
    Assert.NotNull(window1);
    Assert.IsType<FsusSettingsShell>(window1.Content);
    Assert.Equal(1, hostManager.OpenCount);

    // Requesting window again returns existing singleton instance
    var window2 = hostManager.GetOrCreateWindow();
    Assert.Same(window1, window2);
    Assert.Equal(1, hostManager.OpenCount);

    // Closing the window allows opening a new singleton instance
    window1.Close();
    Dispatcher.UIThread.RunJobs();

    var window3 = hostManager.GetOrCreateWindow();
    Assert.NotNull(window3);
    Assert.NotSame(window1, window3);
    Assert.Equal(2, hostManager.OpenCount);

    window3.Close();
  }

  [AvaloniaFact]
  public void ThemeSwitchesAcrossLightDarkAndHighContrastOnSettingsShell()
  {
    var window = CreateStyledWindow(950, 650);
    var manager = new FsusThemeManager();

    var shell = new FsusSettingsShell
    {
      SearchSlot = new TextBox { PlaceholderText = "Filter..." },
      ActionsSlot = new Button { Content = "Done" },
    };
    shell.Categories.Add(new FsusSettingsCategory
    {
      Key = "cat1",
      Header = "Category 1",
      Content = new TextBlock { Text = "Content 1" },
    });
    shell.Categories.Add(new FsusSettingsCategory
    {
      Key = "cat2",
      Header = "Category 2",
      Content = new TextBlock { Text = "Content 2" },
    });

    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    foreach (var variant in new[] { FsusThemeVariant.Light, FsusThemeVariant.Dark })
    {
      foreach (var highContrast in new[] { false, true })
      {
        manager.Apply(
          window.Resources,
          new FsusThemeOptions
          {
            Variant = variant,
            HighContrast = highContrast,
            Density = FsusDensity.Default,
            MotionMode = FsusMotionMode.Reduced,
          });

        Dispatcher.UIThread.RunJobs();

        Assert.Contains("fsus-settings-shell", shell.Classes);
        Assert.Contains("fsus-selected", shell.Categories[0].Classes);
        Assert.NotNull(window.Resources[FsusThemeResourceKeys.BackgroundBrush]);
      }
    }

    window.Close();
  }

  [AvaloniaFact]
  public void SearchAndActionSlotsKeepTheirOwnArrowAndSpaceKeyboardInput()
  {
    var window = CreateStyledWindow(950, 650);
    var search = new TextBox { Text = "network" };
    AutomationProperties.SetName(search, "Search settings");
    var action = new Button
    {
      Content = "Save settings",
    };
    var shell = new FsusSettingsShell
    {
      SearchSlot = search,
      ActionsSlot = action,
    };
    shell.Categories.Add(new FsusSettingsCategory { Key = "general", Header = "General" });
    shell.Categories.Add(new FsusSettingsCategory { Key = "network", Header = "Network" });
    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(search.Focus());
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, null);
    Assert.Equal("general", shell.SelectedKey);

    Assert.True(action.Focus());
    window.KeyPress(Key.Space, RawInputModifiers.None, PhysicalKey.Space, " ");
    Assert.Equal("general", shell.SelectedKey);

    Assert.True(shell.Categories[0].Focus(NavigationMethod.Tab));
    window.KeyPress(Key.Down, RawInputModifiers.None, PhysicalKey.ArrowDown, null);
    Assert.Equal("network", shell.SelectedKey);
    Assert.True(shell.Categories[1].IsFocused);

    window.Close();
  }

  [AvaloniaFact]
  public void AutomationSelectionProviderTracksMountedCategorySelection()
  {
    var window = CreateStyledWindow(950, 650);
    var shell = new FsusSettingsShell { AccessibleName = "Application settings" };
    var general = new FsusSettingsCategory { Key = "general", Header = "General" };
    var disabled = new FsusSettingsCategory
    {
      Key = "security",
      Header = "Security",
      IsEnabled = false,
    };
    var about = new FsusSettingsCategory { Key = "about", Header = "About" };
    shell.Categories.Add(general);
    shell.Categories.Add(disabled);
    shell.Categories.Add(about);
    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var shellProvider = Assert.IsAssignableFrom<ISelectionProvider>(
      ControlAutomationPeer.CreatePeerForElement(shell));
    var generalProvider = Assert.IsAssignableFrom<ISelectionItemProvider>(
      ControlAutomationPeer.CreatePeerForElement(general));
    var disabledProvider = Assert.IsAssignableFrom<ISelectionItemProvider>(
      ControlAutomationPeer.CreatePeerForElement(disabled));
    var aboutProvider = Assert.IsAssignableFrom<ISelectionItemProvider>(
      ControlAutomationPeer.CreatePeerForElement(about));

    Assert.True(shellProvider.IsSelectionRequired);
    Assert.False(shellProvider.CanSelectMultiple);
    Assert.True(generalProvider.IsSelected);
    Assert.False(disabledProvider.IsSelected);
    Assert.Single(shellProvider.GetSelection());

    disabledProvider.Select();
    Assert.Equal("general", shell.SelectedKey);
    aboutProvider.Select();
    Assert.Equal("about", shell.SelectedKey);
    Assert.True(aboutProvider.IsSelected);
    Assert.False(generalProvider.IsSelected);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(about));

    window.Close();
  }

  [AvaloniaFact]
  public void NarrowAndRightToLeftLayoutsRemainUsableWithoutContentOverflow()
  {
    var window = CreateStyledWindow(620, 650);
    var shell = new FsusSettingsShell
    {
      NarrowRailWidth = 160,
      FlowDirection = global::Avalonia.Media.FlowDirection.RightToLeft,
      ActionsSlot = new Button { Content = "Save settings" },
    };
    for (var index = 0; index < 7; index++)
    {
      shell.Categories.Add(new FsusSettingsCategory
      {
        Key = $"category-{index}",
        Header = $"Long category label {index + 1}",
        Content = new TextBlock
        {
          Text = string.Join(" ", Enumerable.Repeat($"Preference {index + 1}", 80)),
          TextWrapping = global::Avalonia.Media.TextWrapping.Wrap,
        },
      });
    }
    window.Content = shell;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(shell.IsNarrow);
    Assert.Equal(global::Avalonia.Media.FlowDirection.RightToLeft, shell.FlowDirection);
    Assert.False(shell.HasMirrorTransform);
    Assert.Equal(620d, shell.Bounds.Width);
    var rail = Assert.Single(
      shell.GetVisualDescendants().OfType<Border>(),
      (border) => border.Classes.Contains("fsus-settings-rail"));
    var actions = Assert.Single(
      shell.GetVisualDescendants().OfType<Border>(),
      (border) => border.Classes.Contains("fsus-settings-actions"));
    Assert.Equal(160d, rail.Bounds.Width);
    var layoutRoot = Assert.IsType<Grid>(rail.Parent);
    var railOrigin = Assert.NotNull(rail.TranslatePoint(default, layoutRoot));
    var actionsOrigin = Assert.NotNull(actions.TranslatePoint(default, layoutRoot));
    Assert.True(
      railOrigin.X > actionsOrigin.X,
      $"RTL rail origin {railOrigin.X} must be right of actions origin {actionsOrigin.X}.");
    Assert.True(actions.Bounds.Width > 0);
    Assert.True(shell.ContentScrollViewer.Bounds.Width > 0);
    Assert.Equal(ScrollBarVisibility.Disabled, shell.ContentScrollViewer.HorizontalScrollBarVisibility);
    Assert.All(shell.Categories, category => Assert.True(category.Bounds.Width > 0));

    window.Close();
  }

  private static Window CreateStyledWindow(double width, double height)
  {
    var window = new Window
    {
      Width = width,
      Height = height,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private sealed class HostSettingsWindowManager
  {
    private Window? currentWindow;

    public int OpenCount { get; private set; }

    public Window GetOrCreateWindow()
    {
      if (currentWindow is not null)
      {
        currentWindow.Activate();
        return currentWindow;
      }

      OpenCount++;
      var window = CreateStyledWindow(950, 650);
      window.Content = new FsusSettingsShell();
      window.Closed += (_, _) => currentWindow = null;
      window.Show();
      currentWindow = window;
      return window;
    }
  }
}
