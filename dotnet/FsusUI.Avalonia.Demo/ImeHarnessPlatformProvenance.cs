namespace FsusUI.Avalonia.Demo;

internal sealed record XServerProvenance(
  string Kind,
  int ProcessId,
  string Display);

internal static class ImeHarnessPlatformProvenance
{
  private static readonly HashSet<string> AcceptedXServers =
    new(StringComparer.Ordinal)
    {
      "Xorg",
      "Xvfb",
      "XWayland",
    };

  internal static XServerProvenance? DetectXServer(string display) =>
    DetectXServer(display, ReadProcesses());

  internal static XServerProvenance? DetectXServer(
    string display,
    IEnumerable<(int ProcessId, string[] Arguments)> processes)
  {
    var normalizedDisplay = NormalizeLocalDisplay(display);
    if (normalizedDisplay is null)
    {
      return null;
    }

    foreach (var process in processes)
    {
      if (process.ProcessId <= 0 || process.Arguments.Length < 2)
      {
        continue;
      }

      var executable = Path.GetFileName(process.Arguments[0]);
      var kind = executable switch
      {
        "Xorg" => "Xorg",
        "Xvfb" => "Xvfb",
        "Xwayland" => "XWayland",
        _ => null,
      };
      if (kind is null ||
          !process.Arguments.Skip(1).Any(argument =>
            NormalizeLocalDisplay(argument) == normalizedDisplay))
      {
        continue;
      }

      return new XServerProvenance(kind, process.ProcessId, normalizedDisplay);
    }

    return null;
  }

  internal static bool IsAcceptedXServer(string kind, int? processId) =>
    processId is > 0 && AcceptedXServers.Contains(kind);

  private static string? NormalizeLocalDisplay(string value)
  {
    if (string.IsNullOrWhiteSpace(value) || value[0] != ':')
    {
      return null;
    }

    var separator = value.IndexOf('.', 1);
    var displayNumber = separator < 0
      ? value.AsSpan(1)
      : value.AsSpan(1, separator - 1);
    if (displayNumber.IsEmpty ||
        !displayNumber.ToString().All(char.IsAsciiDigit) ||
        separator >= 0 &&
        (separator == value.Length - 1 ||
         !value.AsSpan(separator + 1).ToString().All(char.IsAsciiDigit)))
    {
      return null;
    }

    return $":{displayNumber.ToString()}";
  }

  private static IEnumerable<(int ProcessId, string[] Arguments)> ReadProcesses()
  {
    foreach (var directory in Directory.EnumerateDirectories("/proc"))
    {
      if (!int.TryParse(Path.GetFileName(directory), out var processId))
      {
        continue;
      }

      string[] arguments;
      try
      {
        arguments = File.ReadAllText(Path.Combine(directory, "cmdline"))
          .Split('\0', StringSplitOptions.RemoveEmptyEntries);
      }
      catch (IOException)
      {
        continue;
      }
      catch (UnauthorizedAccessException)
      {
        continue;
      }

      yield return (processId, arguments);
    }
  }
}
