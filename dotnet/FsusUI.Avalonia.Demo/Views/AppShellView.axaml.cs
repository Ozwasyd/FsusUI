using Avalonia;
using Avalonia.Controls;
using FsusUI.Avalonia.Demo.Gallery;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.Demo.Views;

public partial class AppShellView : UserControl
{
  private readonly Dictionary<string, (string Title, Func<Control> Factory)> pages;
  private readonly FsusThemeManager themeManager = new();
  private FsusThemeOptions themeOptions = FsusThemeOptions.Default;

  public AppShellView()
  {
    InitializeComponent();

    pages = new Dictionary<string, (string, Func<Control>)>
    {
      ["dashboard"] = ("App shell", () => new DashboardPage()),
      ["components"] = ("Component subset", () => new ComponentSubsetPage()),
      ["settings"] = ("Settings page", () => new SettingsPage()),
      ["list"] = ("List page", () => new ListPage()),
      ["detail"] = ("Detail page", () => new DetailPage()),
      ["form"] = ("Form page", () => new FormPage()),
      ["empty"] = ("Empty state", () => new EmptyStatePage()),
      ["error"] = ("Error state", () => new ErrorStatePage()),
      ["dialogs"] = ("Dialog gallery", () => new DialogGalleryPage()),
    };

    foreach (var route in FsusAvaloniaGalleryRegistry.StableRoutes)
    {
      pages[route.Route.TrimStart('/')] = (route.Title, route.CreatePage);
    }

    ShowPage("dashboard");
    ApplyThemeOptions();
  }

  private void Navigate(object? sender, global::Avalonia.Interactivity.RoutedEventArgs args)
  {
    if (sender is Button { Tag: string pageId })
    {
      ShowPage(pageId);
    }
  }

  private void ShowPage(string pageId)
  {
    if (!pages.TryGetValue(pageId, out var page))
    {
      return;
    }

    BreadcrumbText.Text = $"Demo / {page.Title}";
    PageTitleText.Text = page.Title;
    PageHost.Content = page.Factory();
  }

  private void ThemeChanged(object? sender, SelectionChangedEventArgs args)
  {
    themeOptions = ThemeSelector.SelectedIndex switch
    {
      0 => themeOptions with
      {
        FollowSystemTheme = true,
        HighContrast = false,
        Variant = FsusThemeVariant.Light,
      },
      2 => themeOptions with
      {
        FollowSystemTheme = false,
        HighContrast = false,
        Variant = FsusThemeVariant.Dark,
      },
      3 => themeOptions with
      {
        FollowSystemTheme = false,
        HighContrast = true,
        Variant = FsusThemeVariant.Light,
      },
      _ => themeOptions with
      {
        FollowSystemTheme = false,
        HighContrast = false,
        Variant = FsusThemeVariant.Light,
      },
    };
    ApplyThemeOptions();
  }

  private void DensityChanged(object? sender, SelectionChangedEventArgs args)
  {
    themeOptions = themeOptions with
    {
      Density = DensitySelector.SelectedIndex switch
      {
        1 => FsusDensity.Compact,
        2 => FsusDensity.Spacious,
        _ => FsusDensity.Default,
      },
    };
    ApplyThemeOptions();
  }

  private void MotionChanged(object? sender, SelectionChangedEventArgs args)
  {
    themeOptions = themeOptions with
    {
      MotionMode = MotionSelector.SelectedIndex switch
      {
        1 => FsusMotionMode.Enabled,
        2 => FsusMotionMode.Reduced,
        3 => FsusMotionMode.Disabled,
        _ => FsusMotionMode.System,
      },
    };
    ApplyThemeOptions();
  }

  private void ApplyThemeOptions()
  {
    if (Application.Current is not null)
    {
      themeManager.Apply(Application.Current, themeOptions);
    }
  }
}
