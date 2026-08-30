using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusNavigationPrimitiveTests
{
  [Fact]
  public void MenuSupportsNestedCollapsedSelectionAndKeyboardActivation()
  {
    var selectedKeys = new List<string>();
    var menu = new KeyboardMenu
    {
      AccessibleName = "Main navigation",
      IsCollapsed = true,
    };
    menu.SelectionChanged += (_, args) => selectedKeys.Add(args.SelectedKey);
    var dashboard = new FsusMenuItem { Key = "dashboard", Header = "Dashboard" };
    var disabled = new FsusMenuItem { Key = "billing", Header = "Billing", IsEnabled = false };
    var settings = new FsusSubMenu { Key = "settings", Header = "Settings" };
    settings.Items.Add(new FsusMenuItem { Key = "profile", Header = "Profile" });
    settings.Items.Add(new FsusMenuItem { Key = "security", Header = "Security" });
    menu.Items.Add(dashboard);
    menu.Items.Add(disabled);
    menu.Items.Add(settings);

    menu.SelectKey("dashboard");
    menu.Press(Key.Down);
    menu.Press(Key.Enter);
    menu.Press(Key.Down);
    menu.Press(Key.Enter);
    menu.Press(Key.Escape);

    Assert.Contains("fsus-menu", menu.Classes);
    Assert.Contains("fsus-collapsed", menu.Classes);
    Assert.Contains("fsus-selected", dashboard.Classes);
    Assert.Contains("fsus-disabled", disabled.Classes);
    Assert.True(settings.IsOpen);
    Assert.False(menu.HasOpenPopupSurface);
    Assert.Equal("security", menu.SelectedKey);
    Assert.Equal(new[] { "dashboard", "settings", "security" }, selectedKeys);
    Assert.Equal("Main navigation", AutomationProperties.GetName(menu));
    Assert.Equal(AutomationControlType.Menu, AutomationProperties.GetControlTypeOverride(menu));
    Assert.Equal("selected", AutomationProperties.GetItemStatus(menu));
  }

  [Fact]
  public void BreadcrumbPageHeaderAndStepsExposeEventsAndStatus()
  {
    var activated = new List<string>();
    var breadcrumb = new FsusBreadcrumb { AccessibleName = "Current path" };
    breadcrumb.Items.Add(new FsusBreadcrumbItem { Key = "home", Header = "Home" });
    breadcrumb.Items.Add(new FsusBreadcrumbItem { Key = "articles", Header = "Articles" });
    breadcrumb.Items.Add(new FsusBreadcrumbItem { Key = "draft", Header = "Draft", IsCurrent = true });
    breadcrumb.Activated += (_, args) => activated.Add(args.Key);

    breadcrumb.Activate("articles");
    breadcrumb.Activate("draft");

    Assert.Equal(new[] { "articles" }, activated);
    Assert.Contains("fsus-current", breadcrumb.Items[2].Classes);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(breadcrumb));
    Assert.Equal("current", AutomationProperties.GetItemStatus(breadcrumb.Items[2]));

    var backCount = 0;
    var pageHeader = new FsusPageHeader
    {
      Title = "Edit article",
      Description = "Review metadata before publishing.",
      IconContent = "back",
      Breadcrumb = breadcrumb,
      ActionContent = "Publish",
    };
    pageHeader.BackRequested += (_, _) => backCount++;

    pageHeader.RequestBack();
    pageHeader.RequestBack();

    Assert.Equal(2, backCount);
    Assert.Contains("fsus-page-header", pageHeader.Classes);
    Assert.Equal("Edit article", AutomationProperties.GetName(pageHeader));

    var steps = new FsusSteps { ActiveIndex = 1 };
    steps.Items.Add(new FsusStep { Title = "Draft", Description = "Write content" });
    steps.Items.Add(new FsusStep { Title = "Review", Description = "Check metadata" });
    steps.Items.Add(new FsusStep { Title = "Publish", Status = FsusStepStatus.Error });
    steps.RefreshStepStatus();

    Assert.Equal(FsusStepStatus.Finish, steps.Items[0].EffectiveStatus);
    Assert.Equal(FsusStepStatus.Process, steps.Items[1].EffectiveStatus);
    Assert.Equal(FsusStepStatus.Error, steps.Items[2].EffectiveStatus);
    Assert.Contains("fsus-step-error", steps.Items[2].Classes);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(steps));
    Assert.Equal("error", AutomationProperties.GetItemStatus(steps.Items[2]));
  }

  [Fact]
  public void NavigationThemeVisualAndAutomationBaselinesCoverStable23()
  {
    var tabs = ReadControlTheme("Tabs.axaml");
    Assert.Contains("FsusColorActionPrimaryBrush", tabs);
    Assert.Contains("FsusMotionDurationEffective", tabs);
    Assert.Contains("FsusDensityControlDefaultY", tabs);
    Assert.DoesNotContain("Value=\"12,6\"", tabs);

    var menu = ReadControlTheme("Menu.axaml");
    Assert.Contains("FsusColorActionPrimaryBrush", menu);
    Assert.Contains("FsusMotionDurationEffective", menu);
    Assert.Contains("FsusDensityControlDefaultY", menu);
    Assert.DoesNotContain("Value=\"12,6\"", menu);

    var navigation = ReadControlTheme("Navigation.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusBreadcrumb",
      "fsus|FsusBreadcrumbItem",
      "fsus|FsusPageHeader",
      "fsus|FsusSteps",
      "fsus|FsusStep",
    })
    {
      Assert.Contains(selector, navigation);
    }

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Navigation.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("navigation-primitives-stable23-web-avalonia", visualFixture);

    var automation = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("tabs-stable23", automation);
    Assert.Contains("menu-stable23", automation);
  }

  private sealed class KeyboardMenu : FsusMenu
  {
    public void Press(Key key) => HandleKey(key);
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
