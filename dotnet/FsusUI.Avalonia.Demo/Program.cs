using Avalonia;

namespace FsusUI.Avalonia.Demo;

internal static class Program
{
  [STAThread]
  public static void Main(string[] args)
  {
    if (args.Contains("--smoke", StringComparer.OrdinalIgnoreCase))
    {
      _ = BuildAvaloniaApp();
      Console.WriteLine("FsusUI Avalonia demo startup smoke passed.");
      return;
    }

    BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
  }

  public static AppBuilder BuildAvaloniaApp()
  {
    return AppBuilder.Configure<App>().UsePlatformDetect();
  }
}
