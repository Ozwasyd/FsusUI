using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusPublicShellPrimitiveTests
{
  [Fact]
  public async Task PublicShellComposesDesktopMobileHeaderAndActiveNavigation()
  {
    var shell = new KeyboardPublicShell
    {
      AccessibleName = "Fsus public shell",
      Brand = "Fsus",
      BrandHref = "/",
      ActiveNav = "archive",
      ActiveNavMotion = FsusPublicShellActiveNavMotion.Indicator,
      AuthLabel = "Sign in",
      AuthHref = "/login",
    };
    shell.NavigationItems.Add(new FsusPublicShellNavigationItem("home", "Home", "/"));
    shell.NavigationItems.Add(new FsusPublicShellNavigationItem("archive", "Archive", "/archive"));
    shell.NavigationItems.Add(new FsusPublicShellNavigationItem("about", "关于 Fsus 平台与设计系统", "/about"));

    shell.ApplyViewport(1280);

    Assert.Equal(FsusLayoutBreakpoint.Lg, shell.Breakpoint);
    Assert.False(shell.IsMobile);
    Assert.True(shell.Header.IsSticky);
    Assert.Equal("Fsus", shell.Header.BrandContent);
    Assert.True(shell.Header.HasDesktopNavigation);
    Assert.True(shell.Header.HasDesktopActions);
    Assert.True(shell.HasActiveNavIndicator);
    Assert.Equal("archive", shell.FocusedNavigationKey);
    Assert.Equal(["brand", "home", "archive", "about", "auth"], shell.KeyboardOrder);
    Assert.True(shell.DesktopNavigationItems.Single((item) => item.Key == "archive").IsActive);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(shell));
    Assert.Equal("Fsus public shell", AutomationProperties.GetName(shell));
    Assert.Equal("desktop, active archive, 3 nav items", AutomationProperties.GetItemStatus(shell));

    Assert.True(await shell.PressAsync(Key.Right));
    Assert.Equal("about", shell.FocusedNavigationKey);

    shell.ApplyViewport(390);

    Assert.Equal(FsusLayoutBreakpoint.Sm, shell.Breakpoint);
    Assert.True(shell.IsMobile);
    Assert.True(shell.Header.HasMobilePrimaryActions);
    Assert.True(shell.Header.HasMobileSecondaryActions);
    Assert.True(shell.MobileNavigationItems.Single((item) => item.Key == "archive").IsActive);
    Assert.Equal("mobile, active archive, 3 nav items", AutomationProperties.GetItemStatus(shell));
  }

  [Fact]
  public async Task ThemeModeToggleUsesThemeManagerAndKeyboardState()
  {
    var resources = new ResourceDictionary();
    var manager = new FsusThemeManager();
    var toggle = new KeyboardThemeModeToggle(manager, resources)
    {
      AccessibleName = "Theme mode",
      Compact = true,
      Visibility = FsusThemeModeToggleVisibility.Mobile,
      Labels = new FsusThemeModeToggleLabels
      {
        LightShort = "浅",
        DarkShort = "深",
        SystemShort = "系统",
      },
    };
    var changes = new List<FsusThemeMode>();
    toggle.ModeChanged += (_, args) => changes.Add(args.Mode);

    toggle.SetMode(FsusThemeMode.Dark);

    Assert.Equal(FsusThemeMode.Dark, toggle.CurrentMode);
    Assert.Equal(FsusThemeVariant.Dark, manager.CurrentOptions.Variant);
    Assert.False(manager.CurrentOptions.FollowSystemTheme);
    AssertBrush(resources, FsusThemeResourceKeys.BackgroundBrush, "#121214");
    AssertBrush(
      resources,
      FsusTokens.ComponentStateButtonPrimaryBackgroundDefaultResourceKey,
      "#F0F0F4"
    );
    AssertBrush(
      resources,
      FsusTokens.ComponentStateButtonPrimaryBackgroundHoverResourceKey,
      "#4B79CC"
    );
    Assert.Equal(["浅", "深", "系统"], toggle.VisibleLabels);
    Assert.Equal([FsusThemeMode.Dark], changes);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(toggle));
    Assert.Equal("Theme mode", AutomationProperties.GetName(toggle));

    Assert.True(await toggle.PressAsync(Key.Right));
    Assert.Equal(FsusThemeMode.System, toggle.CurrentMode);
    Assert.True(manager.CurrentOptions.FollowSystemTheme);

    Assert.True(await toggle.PressAsync(Key.Left));
    Assert.Equal(FsusThemeMode.Dark, toggle.CurrentMode);
  }

  [Fact]
  public async Task ResponsiveCollectionUsesDeterministicBreakpointsAndKeyboardOrder()
  {
    var collection = new KeyboardResponsiveCollection
    {
      AccessibleName = "Article list",
      RenderStrategy = FsusResponsiveCollectionRenderStrategy.LazyBranch,
    };
    collection.Items.Add(new FsusResponsiveCollectionItem("first", "第一篇文章标题很长但不应破坏键盘顺序"));
    collection.Items.Add(new FsusResponsiveCollectionItem("second", "Second"));

    collection.ApplyViewport(1024);

    Assert.Equal(FsusLayoutBreakpoint.Lg, collection.Breakpoint);
    Assert.False(collection.IsCompact);
    Assert.True(collection.IsDesktopBranchMounted);
    Assert.False(collection.IsCompactBranchMounted);
    Assert.Equal(["first", "second"], collection.VisibleItemKeys);
    Assert.Equal("first", collection.FocusedKey);

    collection.ApplyViewport(390);

    Assert.Equal(FsusLayoutBreakpoint.Sm, collection.Breakpoint);
    Assert.True(collection.IsCompact);
    Assert.True(collection.IsDesktopBranchMounted);
    Assert.True(collection.IsCompactBranchMounted);
    Assert.Equal(["first", "second"], collection.VisibleItemKeys);
    Assert.Equal("第一篇文章标题很长但不应破坏键盘顺序", collection.Items[0].Label);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(collection));
    Assert.Equal("Article list", AutomationProperties.GetName(collection));
    Assert.Equal("compact, 2 items, focus first", AutomationProperties.GetItemStatus(collection));

    Assert.True(await collection.PressAsync(Key.Down));
    Assert.Equal("second", collection.FocusedKey);
    Assert.Equal("compact, 2 items, focus second", AutomationProperties.GetItemStatus(collection));
  }

  [Fact]
  public void PublicShellThemeVisualAndAccessibilityBaselinesCoverStable38()
  {
    var publicShell = ReadControlTheme("PublicShell.axaml");
    Assert.Contains("fsus|FsusPublicShell", publicShell);
    Assert.Contains("fsus|FsusSiteHeader", publicShell);
    Assert.Contains("fsus|FsusResponsiveCollection", publicShell);
    Assert.Contains("fsus|FsusThemeModeToggle", publicShell);
    Assert.Contains("FsusThemePublicShellSurfaceBrush", publicShell);
    Assert.Contains("FsusMotionDurationEffective", publicShell);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/PublicShell.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("public-shell-stable38-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("public-shell-stable38", accessibilityEvidence);
    Assert.Contains("site-header-stable38", accessibilityEvidence);
    Assert.Contains("theme-mode-toggle-stable38", accessibilityEvidence);
    Assert.Contains("responsive-collection-stable38", accessibilityEvidence);
  }

  private sealed class KeyboardPublicShell : FsusPublicShell
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardThemeModeToggle(
    FsusThemeManager manager,
    IResourceDictionary resources) : FsusThemeModeToggle(manager, resources)
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardResponsiveCollection : FsusResponsiveCollection
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static void AssertBrush(
    ResourceDictionary resources,
    string key,
    string color)
  {
    var brush = Assert.IsType<SolidColorBrush>(resources[key]);
    Assert.Equal(Color.Parse(color), brush.Color);
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
