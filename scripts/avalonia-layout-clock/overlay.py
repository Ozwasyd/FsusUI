"""Build-only source overlay, fail closed when exact upstream source shifts."""
import hashlib
SNIPPET = r"""
  [DllImport("libc", EntryPoint = "clock_gettime", SetLastError = true)]
  private static extern int DiagnosticClockGetTime(int clockId, out DiagnosticTimespec time);

  [DllImport("libc", EntryPoint = "gettid")]
  private static extern int DiagnosticThreadId();

  [StructLayout(LayoutKind.Sequential)]
  private struct DiagnosticTimespec
  {
    public long Seconds;
    public long Nanoseconds;
  }

  private readonly record struct DiagnosticStamp(long WallTicks, long CpuNanoseconds, int Tid, int Gen2)
  {
    public static DiagnosticStamp Read()
    {
      long wall = Stopwatch.GetTimestamp();
      const int threadCpuClock = 3; // Linux CLOCK_THREAD_CPUTIME_ID
      if (DiagnosticClockGetTime(threadCpuClock, out var time) != 0)
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      return new(wall, checked(time.Seconds * 1_000_000_000L + time.Nanoseconds),
        DiagnosticThreadId(), GC.CollectionCount(2));
    }
  }

"""
def apply_overlay(source, expected_hash):
    if hashlib.sha256(source).hexdigest() != expected_hash:
        raise ValueError("unapproved driver source")
    text=source.decode()
    def replace(before, after):
        nonlocal text
        if text.count(before)!=1:
            raise ValueError("nonunique measured layout anchor: "+before)
        text=text.replace(before,after,1)
    replace('  private static void Render(Control control)',SNIPPET+'  private static void Render(Control control)')
    replace('      LogPhase("warmup-native-render");','''      var diagnostic = definition.Id is "virtual-list-fixed-100k" or "virtual-list-variable-100k"
        ? new DiagnosticStamp[samples * 4] : null;
      if (diagnostic is not null)
      {
        if (!OperatingSystem.IsLinux() || RuntimeInformation.ProcessArchitecture != System.Runtime.InteropServices.Architecture.X64)
          throw new PlatformNotSupportedException("layout clock diagnostic requires Linux x64");
        _ = DiagnosticStamp.Read();
      }
      LogPhase("warmup-native-render");''')
    replace('        var layoutWatch = Stopwatch.StartNew();\n        host.Measure(new Size(1120, 700));\n        host.Arrange(new Rect(0, 0, 1120, 700));','''        var layoutWatch = Stopwatch.StartNew();
        int diagnosticIndex = index * 4;
        if (diagnostic is not null) diagnostic[diagnosticIndex] = DiagnosticStamp.Read();
        host.Measure(new Size(1120, 700));
        if (diagnostic is not null) diagnostic[diagnosticIndex + 1] = DiagnosticStamp.Read();
        host.Arrange(new Rect(0, 0, 1120, 700));
        if (diagnostic is not null) diagnostic[diagnosticIndex + 2] = DiagnosticStamp.Read();''')
    replace('        layoutWatch.Stop();','''        if (diagnostic is not null) diagnostic[diagnosticIndex + 3] =
          layoutReady ? DiagnosticStamp.Read() : diagnostic[diagnosticIndex + 2];
        layoutWatch.Stop();''')
    replace('      LogPhase("write-raw-and-unload");','''      LogPhase("write-raw-and-unload");
      if (diagnostic is not null)
        await File.WriteAllTextAsync(Path.Combine(rawDirectory, $"{definition.Id}.layout-clock.json"),
          JsonSerializer.Serialize(new { Scenario = definition.Id, WallFrequency = Stopwatch.Frequency,
            PhaseOrder = new[] { "start", "measure-end", "arrange-end", "layout-ready-end" },
            Stamps = diagnostic }, JsonOptions));''')
    return text.encode()
