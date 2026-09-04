using Avalonia;

namespace FsusUI.Avalonia.Demo;

public static class Program
{
  [STAThread]
  public static void Main(string[] args)
  {
    if (args.Contains("--conformance-v2", StringComparer.OrdinalIgnoreCase))
    {
      ConformanceV2Runner.Configure(args);
      BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
      return;
    }

    if (args.Contains("--ime-harness", StringComparer.OrdinalIgnoreCase))
    {
      ImeHarnessRunner.Configure(args);
      BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
      return;
    }

    if (args.Contains("--render-performance", StringComparer.OrdinalIgnoreCase))
    {
      RenderPerformanceRunner.Configure(args);
      BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
      return;
    }

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
    var builder = AppBuilder.Configure<App>().UsePlatformDetect();
    if (ImeHarnessRunner.IsConfigured && OperatingSystem.IsLinux())
    {
      // EnableIme defaults off unless LANG is CJK; the harness requires the
      // real OS input method regardless of locale.
      builder.With(new X11PlatformOptions
      {
        RenderingMode = [X11RenderingMode.Software],
        EnableIme = true,
      });
    }
    else if ((RenderPerformanceRunner.IsConfigured || ConformanceV2Runner.IsConfigured) &&
        RenderPerformanceRunner.UseSoftwareRendering &&
        OperatingSystem.IsLinux())
    {
      builder.With(new X11PlatformOptions
      {
        RenderingMode = [X11RenderingMode.Software],
      });
    }
    else if (RenderPerformanceRunner.IsConfigured &&
             RenderPerformanceRunner.UseGpuRendering &&
             OperatingSystem.IsLinux())
    {
      builder.With(new X11PlatformOptions
      {
        RenderingMode = [X11RenderingMode.Glx, X11RenderingMode.Egl, X11RenderingMode.Vulkan],
      });
    }
    return builder;
  }
}
