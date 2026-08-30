namespace FsusUI.Avalonia.HeadlessTests;

internal static class HeadlessVisualEvidence
{
  public const string OutputRootEnvironmentVariable =
    "FSUS_AVALONIA_VISUAL_EVIDENCE_ROOT";

  public static string CreateOutputDirectory(string suite)
  {
    var configuredRoot =
      Environment.GetEnvironmentVariable(OutputRootEnvironmentVariable);
    var outputRoot = string.IsNullOrWhiteSpace(configuredRoot)
      ? Path.Combine(
        AppContext.BaseDirectory,
        "TestResults",
        "visual-evidence")
      : Path.GetFullPath(configuredRoot);
    var suiteRoot = Path.Combine(outputRoot, suite);
    Directory.CreateDirectory(suiteRoot);
    return suiteRoot;
  }
}
