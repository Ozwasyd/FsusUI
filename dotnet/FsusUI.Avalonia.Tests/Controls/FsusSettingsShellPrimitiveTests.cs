using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusSettingsShellPrimitiveTests
{
  [Fact]
  public void SevenCategoriesFitIn950x650WindowWithoutHorizontalTabs()
  {
    var shell = new FsusSettingsShell
    {
      Width = 950,
      Height = 650,
      AccessibleName = "App Settings",
      SearchSlot = new TextBox { PlaceholderText = "Search settings..." },
      ActionsSlot = new Button { Content = "Save changes" },
    };

    var categoryNames = new[]
    {
      "General",
      "Appearance",
      "Notifications",
      "Privacy & Security",
      "Network",
      "Accessibility",
      "Advanced",
    };

    foreach (var name in categoryNames)
    {
      var key = name.ToLowerInvariant().Replace(" ", "-").Replace("&", "and");
      shell.Categories.Add(new FsusSettingsCategory
      {
        Key = key,
        Header = name,
        Content = new TextBlock { Text = $"{name} content panel" },
      });
    }

    shell.Measure(new Size(950, 650));
    shell.Arrange(new Rect(0, 0, 950, 650));

    Assert.Equal(7, shell.Categories.Count);
    Assert.Contains("fsus-settings-shell", shell.Classes);
    Assert.DoesNotContain("fsus-tabs", shell.Classes);

    // Rail dimensions and layout
    Assert.Equal(220d, shell.RailWidth);
    Assert.True(shell.HasSearchSlot);
    Assert.True(shell.HasActionsSlot);
    Assert.Contains("fsus-has-search", shell.Classes);
    Assert.Contains("fsus-has-actions", shell.Classes);

    // Each category item has reasonable height and all 7 fit in 650 DIP rail height
    var totalCategoryHeight = shell.Categories.Sum((c) => c.DesiredSize.Height);
    Assert.True(totalCategoryHeight < 500, $"Total category height {totalCategoryHeight} should fit well within 650px height");
    Assert.Equal("general", shell.SelectedKey);
    Assert.NotNull(shell.SelectedCategory);
    Assert.Equal("General", shell.SelectedCategory!.Header);
  }

  [Fact]
  public void SelectingCategoryUpdatesContentAndVisiblyMarksExactlyOneActive()
  {
    var selectionEvents = new List<string>();
    var shell = new FsusSettingsShell();

    var cat1 = new FsusSettingsCategory
    {
      Key = "general",
      Header = "General",
      Content = new TextBlock { Text = "General View" },
    };
    var cat2 = new FsusSettingsCategory
    {
      Key = "network",
      Header = "Network",
      Content = new TextBlock { Text = "Network View" },
    };
    var cat3 = new FsusSettingsCategory
    {
      Key = "privacy",
      Header = "Privacy",
      Content = new TextBlock { Text = "Privacy View" },
    };

    shell.Categories.Add(cat1);
    shell.Categories.Add(cat2);
    shell.Categories.Add(cat3);

    // Initial state: cat1 selected
    Assert.Equal("general", shell.SelectedKey);
    Assert.True(cat1.IsSelected);
    Assert.Contains("fsus-selected", cat1.Classes);
    Assert.False(cat2.IsSelected);
    Assert.DoesNotContain("fsus-selected", cat2.Classes);
    Assert.False(cat3.IsSelected);
    Assert.DoesNotContain("fsus-selected", cat3.Classes);

    shell.SelectionChanged += (_, args) => selectionEvents.Add(args.SelectedKey);

    // Select category 2
    shell.SelectKey("network");

    Assert.Equal("network", shell.SelectedKey);
    Assert.Same(cat2, shell.SelectedCategory);
    Assert.False(cat1.IsSelected);
    Assert.DoesNotContain("fsus-selected", cat1.Classes);
    Assert.True(cat2.IsSelected);
    Assert.Contains("fsus-selected", cat2.Classes);
    Assert.False(cat3.IsSelected);
    Assert.DoesNotContain("fsus-selected", cat3.Classes);

    // Select category 3 via SelectCategory
    shell.SelectCategory(cat3);

    Assert.Equal("privacy", shell.SelectedKey);
    Assert.Same(cat3, shell.SelectedCategory);
    Assert.False(cat1.IsSelected);
    Assert.False(cat2.IsSelected);
    Assert.True(cat3.IsSelected);
    Assert.Contains("fsus-selected", cat3.Classes);

    // Exactly one active category at all times
    Assert.Single(shell.Categories, (c) => c.IsSelected);
    Assert.Single(shell.Categories, (c) => c.Classes.Contains("fsus-selected"));
    Assert.Equal(["network", "privacy"], selectionEvents);
  }

  [Fact]
  public void KeyboardNavigationAndScreenReaderSelectionStateWork()
  {
    var shell = new KeyboardSettingsShell();
    var cat1 = new FsusSettingsCategory { Key = "general", Header = "General" };
    var cat2 = new FsusSettingsCategory { Key = "security", Header = "Security", IsEnabled = false };
    var cat3 = new FsusSettingsCategory { Key = "storage", Header = "Storage" };
    var cat4 = new FsusSettingsCategory { Key = "about", Header = "About" };

    shell.Categories.Add(cat1);
    shell.Categories.Add(cat2);
    shell.Categories.Add(cat3);
    shell.Categories.Add(cat4);

    shell.SelectKey("general");

    // Screen reader accessible state
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat1));
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(cat2));
    Assert.Equal("available", AutomationProperties.GetItemStatus(cat3));
    Assert.Equal("available", AutomationProperties.GetItemStatus(cat4));
    Assert.Equal("General", AutomationProperties.GetName(cat1));
    Assert.Equal("Security", AutomationProperties.GetName(cat2));
    Assert.Equal(AutomationControlType.TabItem, AutomationProperties.GetControlTypeOverride(cat1));

    // Down skips disabled cat2 and lands on cat3
    Assert.True(shell.Press(Key.Down));
    Assert.Equal("storage", shell.SelectedKey);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat3));
    Assert.Equal("available", AutomationProperties.GetItemStatus(cat1));

    // End navigates to last enabled (cat4)
    Assert.True(shell.Press(Key.End));
    Assert.Equal("about", shell.SelectedKey);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat4));

    // Home navigates to first enabled (cat1)
    Assert.True(shell.Press(Key.Home));
    Assert.Equal("general", shell.SelectedKey);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(cat1));

    // Up at top stays on cat1
    Assert.True(shell.Press(Key.Up));
    Assert.Equal("general", shell.SelectedKey);

    // Automation status on shell
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(shell));
    Assert.Contains("active general", AutomationProperties.GetItemStatus(shell));
    Assert.Contains("4 categories", AutomationProperties.GetItemStatus(shell));
  }

  [Fact]
  public void LongContentScrollsIndependentlyWhileRailAndActionAreaRemainFixed()
  {
    var shell = new FsusSettingsShell
    {
      Width = 950,
      Height = 650,
      ScrollResetBehavior = FsusSettingsScrollResetBehavior.Reset,
      ActionsSlot = new Button { Content = "Apply" },
    };

    var longContent = new StackPanel { Height = 2000 };
    for (var i = 0; i < 20; i++)
    {
      longContent.Children.Add(new TextBlock { Text = $"Item {i}", Height = 100 });
    }

    var shortContent = new TextBlock { Text = "Short view", Height = 100 };

    var catLong = new FsusSettingsCategory
    {
      Key = "logs",
      Header = "Logs",
      Content = longContent,
    };
    var catShort = new FsusSettingsCategory
    {
      Key = "profile",
      Header = "Profile",
      Content = shortContent,
    };

    shell.Categories.Add(catLong);
    shell.Categories.Add(catShort);

    shell.Measure(new Size(950, 650));
    shell.Arrange(new Rect(0, 0, 950, 650));

    // Simulate scrolling long content
    shell.SetContentScrollOffset(new Vector(0, 350));
    Assert.Equal(350d, shell.ContentScrollOffset.Y);

    // Rail scroll offset is unaffected (remains at 0)
    Assert.Equal(0d, shell.RailScrollViewer.Offset.Y);

    // Switching categories with Reset behavior resets offset to (0, 0)
    shell.SelectKey("profile");
    Assert.Equal(0d, shell.ContentScrollOffset.Y);

    // Switch back to logs, verify Reset behavior starts at top
    shell.SelectKey("logs");
    Assert.Equal(0d, shell.ContentScrollOffset.Y);

    // Now test Restore behavior
    shell.ScrollResetBehavior = FsusSettingsScrollResetBehavior.Restore;
    shell.SetContentScrollOffset(new Vector(0, 450));
    Assert.Equal(450d, shell.ContentScrollOffset.Y);

    // Switch to profile, scroll profile to 50
    shell.SelectKey("profile");
    shell.SetContentScrollOffset(new Vector(0, 50));
    Assert.Equal(50d, shell.ContentScrollOffset.Y);

    // Switch back to logs -> restored to 450
    shell.SelectKey("logs");
    Assert.Equal(450d, shell.ContentScrollOffset.Y);

    // Switch back to profile -> restored to 50
    shell.SelectKey("profile");
    Assert.Equal(50d, shell.ContentScrollOffset.Y);

    // ResetScroll resets offset to 0
    shell.ResetScroll();
    Assert.Equal(0d, shell.ContentScrollOffset.Y);
  }

  [Fact]
  public void HostCanEnforceSingletonWindowBehaviorWithoutFsusUIOwningGlobalState()
  {
    // Demonstrate host application singleton window manager pattern
    var hostManager = new MockHostSettingsShellManager();

    var host1 = hostManager.GetOrCreateSettingsHost();
    Assert.NotNull(host1);
    Assert.IsType<FsusSettingsShell>(host1.Content);

    // Second request returns the exact same instance without creating duplicate
    var host2 = hostManager.GetOrCreateSettingsHost();
    Assert.Same(host1, host2);
    Assert.Equal(1, hostManager.CreateCount);

    // Closing/clearing the host allows a new instance to be opened subsequently
    hostManager.CloseActiveHost();
    var host3 = hostManager.GetOrCreateSettingsHost();
    Assert.NotNull(host3);
    Assert.NotSame(host1, host3);
    Assert.Equal(2, hostManager.CreateCount);

    // Verify FsusSettingsShell instances do not share state (no global singleton)
    var shellA = new FsusSettingsShell();
    shellA.Categories.Add(new FsusSettingsCategory { Key = "a1", Header = "A1" });
    shellA.SelectKey("a1");

    var shellB = new FsusSettingsShell();
    shellB.Categories.Add(new FsusSettingsCategory { Key = "b1", Header = "B1" });
    shellB.SelectKey("b1");

    Assert.Equal("a1", shellA.SelectedKey);
    Assert.Equal("b1", shellB.SelectedKey);
    Assert.NotEqual(shellA.SelectedKey, shellB.SelectedKey);
  }

  [Fact]
  public void NarrowViewportUpdatesIsNarrowAndClasses()
  {
    var shell = new FsusSettingsShell { RailWidth = 240d };
    shell.Categories.Add(new FsusSettingsCategory { Key = "gen", Header = "General" });

    shell.ApplyViewport(1024);
    Assert.False(shell.IsNarrow);
    Assert.DoesNotContain("fsus-narrow", shell.Classes);
    Assert.Equal(240d, shell.RailWidth);

    shell.ApplyViewport(500);
    Assert.True(shell.IsNarrow);
    Assert.Contains("fsus-narrow", shell.Classes);
  }

  private sealed class KeyboardSettingsShell : FsusSettingsShell
  {
    public bool Press(Key key) => HandleKey(key);
  }

  private sealed class MockHostSettingsShellManager
  {
    private ContentControl? activeHost;

    public int CreateCount { get; private set; }

    public ContentControl GetOrCreateSettingsHost()
    {
      if (activeHost is not null)
      {
        return activeHost;
      }

      CreateCount++;
      activeHost = new ContentControl
      {
        Width = 950,
        Height = 650,
        Content = new FsusSettingsShell(),
      };
      return activeHost;
    }

    public void CloseActiveHost()
    {
      activeHost = null;
    }
  }
}
