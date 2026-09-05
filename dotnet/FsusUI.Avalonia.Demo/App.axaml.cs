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
      desktop.MainWindow = ConformanceV2Runner.IsConfigured
        ? ConformanceV2Runner.CreateWindow(desktop)
        : ImeHarnessRunner.IsConfigured
          ? ImeHarnessRunner.CreateWindow(desktop)
          : MarkdownAccessibilityHarnessRunner.IsConfigured
            ? MarkdownAccessibilityHarnessRunner.CreateWindow(desktop)
            : RenderPerformanceRunner.IsConfigured
              ? RenderPerformanceRunner.CreateWindow(desktop)
              : new MainWindow();
    }

    base.OnFrameworkInitializationCompleted();
  }
}
