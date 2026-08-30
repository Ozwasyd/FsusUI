namespace FsusUI.Avalonia.HeadlessTests;

internal static class HeadlessVisualEvidenceOutput
{
  internal const string EnvironmentVariable = "FSUS_AVALONIA_VISUAL_EVIDENCE_ROOT";

  internal static string ResolveOutputRoot(string repositoryRoot, string fixtureName)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(repositoryRoot);
    ArgumentException.ThrowIfNullOrWhiteSpace(fixtureName);

    if (fixtureName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
      fixtureName is "." or "..")
    {
      throw new ArgumentException("Fixture name must be a single valid path segment.", nameof(fixtureName));
    }

    var configuredRoot = Environment.GetEnvironmentVariable(EnvironmentVariable);
    var evidenceRoot = string.IsNullOrWhiteSpace(configuredRoot)
      ? Path.Combine(
        repositoryRoot,
        "dotnet",
        "FsusUI.Avalonia.HeadlessTests",
        "TestResults",
        "visual-evidence")
      : Path.GetFullPath(configuredRoot, repositoryRoot);
    var outputRoot = Path.GetFullPath(Path.Combine(evidenceRoot, fixtureName));
    Directory.CreateDirectory(outputRoot);
    return outputRoot;
  }

  internal static string RecordPath(string repositoryRoot, string path)
  {
    var fullRepositoryRoot = Path.GetFullPath(repositoryRoot);
    var fullPath = Path.GetFullPath(path);
    var relativePath = Path.GetRelativePath(fullRepositoryRoot, fullPath);
    var isOutsideRepository = relativePath == ".." ||
      relativePath.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal) ||
      relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}", StringComparison.Ordinal);
    return (isOutsideRepository ? fullPath : relativePath).Replace('\\', '/');
  }

  internal static string ResolveRecordedPath(string repositoryRoot, string recordedPath) =>
    Path.IsPathRooted(recordedPath)
      ? Path.GetFullPath(recordedPath)
      : Path.GetFullPath(Path.Combine(repositoryRoot, recordedPath));
}
