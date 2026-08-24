using System.Text.Json;
using Avalonia.Controls;
using Avalonia.Threading;

var options = SmokeOptions.Parse(args);
var report = new SmokeReport();

try
{
  var window = new Window
  {
    Content = new TextBlock { Text = "FsusUI Avalonia Native AOT smoke" },
  };

  Dispatcher.UIThread.Invoke(() =>
  {
    report.TopLevelCreated = window is TopLevel;
    report.DispatcherReached = true;
  });

  if (!options.Smoke || !report.TopLevelCreated || !report.DispatcherReached)
    throw new InvalidOperationException("Native AOT smoke did not create a top-level on the dispatcher.");

  if (options.ReportPath is not null)
    File.WriteAllText(options.ReportPath, JsonSerializer.Serialize(report));

  return 0;
}
catch (Exception error)
{
  report.Error = error.Message;
  if (options.ReportPath is not null)
    File.WriteAllText(options.ReportPath, JsonSerializer.Serialize(report));
  Console.Error.WriteLine(error.Message);
  return 1;
}

sealed class SmokeOptions
{
  public bool Smoke { get; private init; }
  public string? ReportPath { get; private init; }

  public static SmokeOptions Parse(string[] arguments)
  {
    var reportIndex = Array.IndexOf(arguments, "--report");
    return new SmokeOptions
    {
      Smoke = arguments.Contains("--smoke", StringComparer.Ordinal),
      ReportPath = reportIndex >= 0 && reportIndex + 1 < arguments.Length
        ? arguments[reportIndex + 1]
        : null,
    };
  }
}

sealed class SmokeReport
{
  public bool TopLevelCreated { get; set; }
  public bool DispatcherReached { get; set; }
  public string? Error { get; set; }
}
