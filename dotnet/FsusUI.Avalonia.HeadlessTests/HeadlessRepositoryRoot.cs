namespace FsusUI.Avalonia.HeadlessTests;

internal static class HeadlessRepositoryRoot
{
  internal static string FindByWorkspace() =>
    Find("pnpm-workspace.yaml")
    ?? throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");

  internal static string FindBySolution() =>
    Find(Path.Combine("dotnet", "FsusUI.Avalonia.slnx"))
    ?? throw new InvalidOperationException("Unable to locate repository root.");

  private static string? Find(string marker)
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, marker)))
      {
        return directory.FullName;
      }
    }

    return null;
  }
}
