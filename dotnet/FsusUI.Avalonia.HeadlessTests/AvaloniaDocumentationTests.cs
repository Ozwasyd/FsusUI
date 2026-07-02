using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.HeadlessTests;

public class AvaloniaDocumentationTests
{
  [Fact]
  public void AvaloniaDocsGatePasses()
  {
    var repoRoot = FindRepoRoot();
    var startInfo = new ProcessStartInfo("node", "scripts/check-avalonia-docs.mjs")
    {
      WorkingDirectory = repoRoot,
      RedirectStandardError = true,
      RedirectStandardOutput = true,
      UseShellExecute = false,
    };

    using var process = Process.Start(startInfo)
      ?? throw new InvalidOperationException("Unable to start node docs check.");
    var output = process.StandardOutput.ReadToEnd();
    var error = process.StandardError.ReadToEnd();
    process.WaitForExit();

    Assert.True(
      process.ExitCode == 0,
      $"Avalonia docs check failed with exit code {process.ExitCode}.{Environment.NewLine}{output}{error}");
  }

  private static string FindRepoRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var start in candidates)
    {
      var directory = new DirectoryInfo(start);
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

    throw new DirectoryNotFoundException("Could not locate the FsusUI repo root.");
  }
}
