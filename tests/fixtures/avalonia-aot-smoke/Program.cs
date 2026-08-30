using System.Text.Json;
using System.Text.Json.Serialization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Platform;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

internal static class Program
{
  private static SmokeOptions options = new();
  private static SmokeReport report = new();

  [STAThread]
  public static int Main(string[] args)
  {
    try
    {
      options = SmokeOptions.Parse(args);
      report = new SmokeReport
      {
        SmokeRequested = options.Smoke,
        ProcessArchitecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString(),
      };
      if (!options.Smoke || options.ReportPath is null)
      {
        throw new ArgumentException("Usage: --smoke --report <path>");
      }

      BuildAvaloniaApp().StartWithClassicDesktopLifetime(
        args,
        ShutdownMode.OnExplicitShutdown
      );
      return report.ExitCode;
    }
    catch (Exception error)
    {
      if (report.FailureKind is not null)
      {
        return report.ExitCode;
      }
      return Fail("loader", error);
    }
  }

  private static AppBuilder BuildAvaloniaApp() =>
    AppBuilder.Configure<SmokeApplication>().UsePlatformDetect().LogToTrace();

  internal static void RunSmoke(IClassicDesktopStyleApplicationLifetime desktop)
  {
    try
    {
      if (options.Failure == "resource")
      {
        using var _ = AssetLoader.Open(
          new Uri("avares://FsusUI.Avalonia.Themes/Themes/Controls/DefinitelyMissing.axaml")
        );
      }

      var button = new FsusButton
      {
        Content = "Native AOT smoke",
        AccessibleName = "Native AOT smoke",
      };
      var icon = new FsusIcon
      {
        IconKey = FsusIconKeys.Settings,
        IsDecorative = true,
      };
      var codeEditor = new FsusCodeEditor
      {
        AccessibleName = "Native AOT Markdown source",
        WordWrap = true,
        ShowLineNumbers = true,
      };
      codeEditor.LoadDocument(
        new FsusMarkdownDocumentIdentity("native-aot", 1),
        "# AOT\n\n- Native editor");
      _ = codeEditor.FindNext("Native");
      var documents = new FsusDocumentTabs();
      documents.AddDocument(new FsusDocumentTab
      {
        Key = "aot-document",
        Header = "Native AOT document",
        Content = "Native AOT document content",
      });
      var activityShell = new FsusActivityRailShell
      {
        MainContent = documents,
      };
      activityShell.Sections.Add(new FsusActivityRailSection
      {
        Key = "explorer",
        Header = "Explorer",
        Content = "Native AOT contextual pane",
      });
      var titleBar = new FsusNativeTitleBar
      {
        DocumentTitle = "Native AOT shell",
        Status = "Ready",
      };
      var panel = new StackPanel();
      panel.Children.Add(button);
      panel.Children.Add(icon);
      panel.Children.Add(titleBar);
      panel.Children.Add(activityShell);
      panel.Children.Add(codeEditor);

      var window = new Window
      {
        Width = 320,
        Height = 160,
        ShowInTaskbar = false,
        Content = panel,
      };
      desktop.MainWindow = window;
      window.Opened += (_, _) =>
        Dispatcher.UIThread.Post(
          () =>
          {
            try
            {
              report.TopLevelCreated = window is TopLevel;
              report.DispatcherReached = Dispatcher.UIThread.CheckAccess();
              report.PlatformHandleCreated = window.TryGetPlatformHandle() is not null;
              report.PackageControlCount = panel.Children.Count;
              report.CodeEditorReady =
                codeEditor.Selection == new FsusCodeEditorSelection(9, 15) &&
                codeEditor.HighlightSpans.Count > 0;
              report.ActivitySectionCount = activityShell.Sections.Count;
              report.DocumentCount = documents.Documents.Count;
              report.TitleBarPlatform = titleBar.EffectivePlatform.ToString();
              report.ThemeDensity = FsusThemeOptions.Default.Density.ToString();
              report.ExitCode =
                report.TopLevelCreated &&
                report.DispatcherReached &&
                report.PlatformHandleCreated &&
                report.PackageControlCount == 5 &&
                report.ActivitySectionCount == 1 &&
                report.DocumentCount == 1 &&
                report.CodeEditorReady
                  ? 0
                  : 1;
              if (report.ExitCode != 0)
              {
                report.FailureKind = "top-level";
                report.Error = "Avalonia top-level or dispatcher initialization was incomplete.";
              }
              WriteReport();
            }
            catch (Exception error)
            {
              report.ExitCode = 1;
              report.FailureKind = "report";
              report.Error = error.ToString();
              WriteReport();
            }
            finally
            {
              window.Close();
              desktop.Shutdown(report.ExitCode);
            }
          },
          DispatcherPriority.Loaded
        );
      window.Show();
    }
    catch (Exception error)
    {
      Fail("resource", error);
      desktop.Shutdown(report.ExitCode);
    }
  }

  private static int Fail(string kind, Exception error)
  {
    report.ExitCode = 1;
    report.FailureKind = kind;
    report.Error = error.ToString();
    Console.Error.WriteLine($"FsusUI Native AOT smoke {kind} failure: {error}");
    WriteReport();
    return report.ExitCode;
  }

  private static void WriteReport()
  {
    if (options.ReportPath is null)
    {
      return;
    }
    var parent = Path.GetDirectoryName(Path.GetFullPath(options.ReportPath));
    if (parent is not null)
    {
      Directory.CreateDirectory(parent);
    }
    File.WriteAllText(
      options.ReportPath,
      JsonSerializer.Serialize(report, SmokeJsonContext.Default.SmokeReport)
    );
  }
}

internal sealed class SmokeApplication : Application
{
  public override void OnFrameworkInitializationCompleted()
  {
    if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
    {
      Program.RunSmoke(desktop);
    }
    base.OnFrameworkInitializationCompleted();
  }
}

internal sealed record SmokeOptions
{
  public bool Smoke { get; init; }
  public string? ReportPath { get; init; }
  public string? Failure { get; init; }

  public static SmokeOptions Parse(string[] arguments)
  {
    string? ValueAfter(string name)
    {
      var index = Array.IndexOf(arguments, name);
      return index >= 0 && index + 1 < arguments.Length
        ? arguments[index + 1]
        : null;
    }

    return new SmokeOptions
    {
      Smoke = arguments.Contains("--smoke", StringComparer.Ordinal),
      ReportPath = ValueAfter("--report"),
      Failure = ValueAfter("--fail"),
    };
  }
}

internal sealed record SmokeReport
{
  public bool SmokeRequested { get; init; }
  public bool TopLevelCreated { get; set; }
  public bool DispatcherReached { get; set; }
  public bool PlatformHandleCreated { get; set; }
  public int PackageControlCount { get; set; }
  public bool CodeEditorReady { get; set; }
  public int ActivitySectionCount { get; set; }
  public int DocumentCount { get; set; }
  public string? TitleBarPlatform { get; set; }
  public string? ThemeDensity { get; set; }
  public string? ProcessArchitecture { get; init; }
  public int ExitCode { get; set; } = 1;
  public string? FailureKind { get; set; }
  public string? Error { get; set; }
}

[JsonSerializable(typeof(SmokeReport))]
internal sealed partial class SmokeJsonContext : JsonSerializerContext;
