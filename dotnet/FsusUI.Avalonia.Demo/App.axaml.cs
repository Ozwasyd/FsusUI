using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace FsusUI.Avalonia.Demo;

public partial class App : Application
{
  public override void Initialize()
  {
    AvaloniaXamlLoader.Load(this);
  }

  public override void OnFrameworkInitializationCompleted()
  {
    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
    {
      desktop.MainWindow = RenderPerformanceRunner.IsConfigured
        ? RenderPerformanceRunner.CreateWindow(desktop)
        : new MainWindow();
    }

    base.OnFrameworkInitializationCompleted();
  }
}
