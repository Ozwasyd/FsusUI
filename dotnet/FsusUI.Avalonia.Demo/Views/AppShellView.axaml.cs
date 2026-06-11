using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Styling;

namespace FsusUI.Avalonia.Demo.Views;

public partial class AppShellView : UserControl
{
  private readonly Dictionary<string, (string Title, Func<Control> Factory)> pages;

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

    ShowPage("dashboard");
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
    var dark = ThemeSelector.SelectedIndex == 1;
    Application.Current!.RequestedThemeVariant = dark ? ThemeVariant.Dark : ThemeVariant.Light;
    SetBrush("FsusThemeBackgroundBrush", dark ? "#111827" : "#FFFFFF");
    SetBrush("FsusThemeSurfaceBrush", dark ? "#171F2C" : "#FFFFFF");
    SetBrush("FsusThemeSurfaceRaisedBrush", dark ? "#1F2937" : "#F8FAFC");
    SetBrush("FsusThemeTextBrush", dark ? "#F8FAFC" : "#111827");
    SetBrush("FsusThemeMutedTextBrush", dark ? "#B6C0CF" : "#6B7280");
    SetBrush("FsusThemeBorderBrush", dark ? "#394657" : "#D9DEE8");
    SetBrush("FsusThemeFocusBrush", dark ? "#7EA6DA" : "#2A599C");
    SetBrush("FsusThemeDangerBrush", dark ? "#F97066" : "#D92D20");
  }

  private static void SetBrush(string key, string color)
  {
    Application.Current!.Resources[key] = new SolidColorBrush(Color.Parse(color));
  }

  private void DensityChanged(object? sender, SelectionChangedEventArgs args)
  {
    var defaultHeight = DensitySelector.SelectedIndex switch
    {
      1 => 28d,
      2 => 38d,
      _ => 32d,
    };
    var compactHeight = DensitySelector.SelectedIndex switch
    {
      1 => 24d,
      2 => 34d,
      _ => 28d,
    };

    Application.Current!.Resources["FsusDensityControlDefaultY"] = defaultHeight;
    Application.Current.Resources["FsusDensityControlCompactY"] = compactHeight;
  }

  private void MotionChanged(object? sender, SelectionChangedEventArgs args)
  {
    var mode = MotionSelector.SelectedIndex switch
    {
      1 => "enabled",
      2 => "reduced",
      3 => "disabled",
      _ => "system",
    };

    Application.Current!.Resources["FsusMotionModeCurrent"] = mode;
    Application.Current.Resources["FsusMotionDurationEffective"] =
      mode is "disabled" or "reduced" ? "1ms" : "220ms";
  }
}
