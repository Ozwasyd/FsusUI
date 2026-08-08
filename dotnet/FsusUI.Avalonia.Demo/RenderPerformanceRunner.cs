using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Demo;

internal static class RenderPerformanceRunner
{
  private static string outputPath = Path.Combine(".tmp", "performance", "avalonia", "summary.json");
  private static string profile = "quick";
  private static int warmups = 1;
  private static int samples = 5;
  private static int longScrollIterations = 256;
  private static string requestedBackend = "auto";
  private static string? scenarioFilter;

  public static bool IsConfigured { get; private set; }
  public static bool UseSoftwareRendering =>
    string.Equals(requestedBackend, "software", StringComparison.OrdinalIgnoreCase);
  public static bool UseGpuRendering =>
    string.Equals(requestedBackend, "gpu", StringComparison.OrdinalIgnoreCase);

  public static void Configure(string[] args)
  {
    IsConfigured = true;
    profile = ReadArgument(args, "--profile") ?? "quick";
    outputPath = ReadArgument(args, "--output") ?? outputPath;
    warmups = ReadInt(args, "--warmups", profile == "full" ? 3 : 1);
    samples = ReadInt(args, "--samples", profile == "full" ? 12 : 21);
    longScrollIterations = ReadInt(args, "--long-scroll-iterations", 256);
    requestedBackend = ReadArgument(args, "--backend") ?? "auto";
    scenarioFilter = ReadArgument(args, "--scenario");
  }

  public static Window CreateWindow(IClassicDesktopStyleApplicationLifetime desktop)
  {
    var window = new Window
    {
      Width = 1180,
      Height = 760,
      MinWidth = 1180,
      MaxWidth = 1180,
      MinHeight = 760,
      MaxHeight = 760,
      Title = "FsusUI real-render performance runner",
      FontFamily = new FontFamily("Noto Sans CJK SC, Noto Sans, Arial"),
      RequestedThemeVariant = ThemeVariant.Light,
      Content = new TextBlock { Text = "Preparing real-render benchmark…" },
    };
    window.Opened += async (_, _) =>
    {
      var exitCode = 0;
      try
      {
        await RunAsync(window);
      }
      catch (Exception exception)
      {
        exitCode = 1;
        Console.Error.WriteLine(exception);
      }
      finally
      {
        desktop.Shutdown(exitCode);
      }
    };
    return window;
  }

  private static async Task RunAsync(Window window)
  {
    var definitions = profile == "full"
      ? new (string Id, Func<Control> Create, Action<Control, int> Act)[]
      {
        VirtualList("virtual-list-fixed-1k", 1_000, false),
        VirtualList("virtual-list-fixed-10k", 10_000, false),
        VirtualList("virtual-list-fixed-100k", 100_000, false),
        VirtualList("virtual-list-variable-1k", 1_000, true),
        VirtualList("virtual-list-variable-10k", 10_000, true),
        VirtualList("virtual-list-variable-100k", 100_000, true),
        TableV2("table-v2-two-axis-10k", 10_000, 24),
        TableV2("table-v2-two-axis-100k", 100_000, 80),
        DataTable("data-table-sort-select-replace", 10_000),
        Tree("tree-expand-scroll", 10_000),
        Input("input-continuous"),
        Theme("theme-switch"),
      }
      :
      [
        VirtualList("virtual-list-fixed-100k", 100_000, false),
        VirtualList("virtual-list-variable-100k", 100_000, true),
        TableV2("table-v2-two-axis-100k", 100_000, 80),
        DataTable("data-table-sort-select-replace", 10_000),
        Tree("tree-expand-scroll", 10_000),
        Input("input-continuous"),
        Theme("theme-switch"),
      ];

    if (!string.IsNullOrWhiteSpace(scenarioFilter))
    {
      definitions = definitions
        .Where(definition => definition.Id.Contains(scenarioFilter, StringComparison.OrdinalIgnoreCase))
        .ToArray();
    }
    var results = new List<object>();
    var rawDirectory = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(outputPath))!, "raw");
    Directory.CreateDirectory(rawDirectory);
    foreach (var definition in definitions)
    {
      window.Content = null;
      await WaitForRenderAsync();
      var visualBaseline = window.GetVisualDescendants().Count();
      var control = definition.Create();
      var host = new Grid
      {
        Width = 1120,
        Height = 700,
        Children = { control },
      };
      window.Content = host;
      await WaitForRenderAsync();
      var exercisedOperations = ExerciseEdgeOperations(control);
      await WaitForRenderAsync();
      for (var index = 0; index < warmups; index++)
      {
        definition.Act(control, index);
        Render(host);
        await WaitForRenderAsync();
      }

      var frame = new List<double>();
      var measureArrange = new List<double>();
      var draw = new List<double>();
      var mountUnmount = new List<double>();
      var allocated = new List<long>();
      var realizedVisuals = new List<int>();
      var realizedContainers = new List<int>();
      var pooledContainers = new List<int>();
      var retainedMeasurements = new List<int>();
      var loadedWindows = new List<int>();
      var gc0Before = GC.CollectionCount(0);
      var gc1Before = GC.CollectionCount(1);
      var gc2Before = GC.CollectionCount(2);
      for (var index = 0; index < samples; index++)
      {
        var allocationBefore = GC.GetAllocatedBytesForCurrentThread();
        var totalWatch = Stopwatch.StartNew();
        definition.Act(control, index + warmups);
        var layoutWatch = Stopwatch.StartNew();
        host.Measure(new Size(1120, 700));
        host.Arrange(new Rect(0, 0, 1120, 700));
        layoutWatch.Stop();
        var drawWatch = Stopwatch.StartNew();
        Render(host);
        drawWatch.Stop();
        await WaitForRenderAsync();
        totalWatch.Stop();
        frame.Add(totalWatch.Elapsed.TotalMilliseconds);
        measureArrange.Add(layoutWatch.Elapsed.TotalMilliseconds);
        draw.Add(drawWatch.Elapsed.TotalMilliseconds);
        var mountWatch = Stopwatch.StartNew();
        host.Children.Remove(control);
        host.Children.Add(control);
        mountWatch.Stop();
        mountUnmount.Add(mountWatch.Elapsed.TotalMilliseconds);
        allocated.Add(Math.Max(0, GC.GetAllocatedBytesForCurrentThread() - allocationBefore));
        realizedVisuals.Add(1 + host.GetVisualDescendants().Count());
        var virtualization = ReadVirtualizationMetrics(control);
        realizedContainers.Add(virtualization.Realized);
        pooledContainers.Add(virtualization.Pooled);
        retainedMeasurements.Add(virtualization.RetainedMeasurements);
        loadedWindows.Add(virtualization.LoadedWindow);
      }

      var measuredGc = new
      {
        Gen0 = GC.CollectionCount(0) - gc0Before,
        Gen1 = GC.CollectionCount(1) - gc1Before,
        Gen2 = GC.CollectionCount(2) - gc2Before,
      };
      // Dispose-backed bitmap samples allocate on the LOH. Clear that completed
      // phase before observing scrolling so its deferred reclamation is not
      // incorrectly attributed to the virtualization loop below.
      GC.Collect(2, GCCollectionMode.Forced, blocking: true, compacting: false);
      GC.WaitForPendingFinalizers();
      var longScrollGc2Before = GC.CollectionCount(2);
      for (var index = 0; index < longScrollIterations; index++)
      {
        definition.Act(control, index + warmups + samples);
      }
      var longScrollGen2 = GC.CollectionCount(2) - longScrollGc2Before;

      var raw = new
      {
        definition.Id,
        FrameMs = frame,
        MeasureArrangeMs = measureArrange,
        DrawMs = draw,
        MountUnmountMs = mountUnmount,
        AllocatedBytes = allocated,
        RealizedVisuals = realizedVisuals,
        RealizedContainers = realizedContainers,
        PooledContainers = pooledContainers,
        RetainedMeasurements = retainedMeasurements,
        LoadedWindows = loadedWindows,
        ExercisedOperations = exercisedOperations,
        LongScroll = new { Iterations = longScrollIterations, Gen2 = longScrollGen2 },
        Gc = measuredGc,
      };
      await File.WriteAllTextAsync(
        Path.Combine(rawDirectory, $"{definition.Id}.raw.json"),
        JsonSerializer.Serialize(raw, JsonOptions));
      var disposalWatch = Stopwatch.StartNew();
      window.Content = null;
      (control as IDisposable)?.Dispose();
      disposalWatch.Stop();
      await WaitForRenderAsync();
      var retainedVisuals = window.GetVisualDescendants().Count();
      await File.AppendAllTextAsync(
        Path.Combine(rawDirectory, $"{definition.Id}.disposal.txt"),
        disposalWatch.Elapsed.TotalMilliseconds.ToString("F4", CultureInfo.InvariantCulture));
      results.Add(new
      {
        definition.Id,
        FrameMs = Statistics(frame),
        MeasureArrangeMs = Statistics(measureArrange),
        DrawMs = Statistics(draw),
        MountUnmountMs = Statistics(mountUnmount),
        DisposalMs = disposalWatch.Elapsed.TotalMilliseconds,
        AllocatedBytes = Statistics(allocated.Select(value => (double)value).ToList()),
        raw.Gc,
        raw.LongScroll,
        raw.ExercisedOperations,
        RealizedVisuals = new { Peak = realizedVisuals.Max(), Stable = realizedVisuals[^1] },
        RealizedContainers = new { Peak = realizedContainers.Max(), Stable = realizedContainers[^1] },
        PooledContainers = new { Peak = pooledContainers.Max(), Stable = pooledContainers[^1] },
        RetainedMeasurements = new { Peak = retainedMeasurements.Max(), Stable = retainedMeasurements[^1] },
        LoadedWindows = new { Peak = loadedWindows.Max(), Stable = loadedWindows[^1] },
        RetainedVisuals = new { Baseline = visualBaseline, AfterUnload = retainedVisuals, ReturnedToBaseline = retainedVisuals <= visualBaseline },
      });
    }

    var summary = new
    {
      SchemaVersion = 2,
      Kind = "real-avalonia-render-measurement",
      GeneratedAt = DateTimeOffset.UtcNow,
      GitSha = Environment.GetEnvironmentVariable("GITHUB_SHA") ?? "local-worktree",
      Profile = profile,
      Environment = new
      {
        OS = RuntimeInformation.OSDescription,
        Architecture = RuntimeInformation.ProcessArchitecture.ToString(),
        CPU = ResolveCpuName(),
        LogicalCores = Environment.ProcessorCount,
        DotNet = RuntimeInformation.FrameworkDescription,
        Avalonia = typeof(Application).Assembly.GetName().Version?.ToString(),
        RenderingBackend = ResolveRenderingBackend(window),
        PlatformGraphicsBackend = ResolvePlatformGraphicsBackend(window),
        RequestedBackend = requestedBackend,
        WindowPlatform = window.TryGetPlatformHandle()?.HandleDescriptor ?? "unresolved",
        Dpi = window.RenderScaling * 96d,
        Window = new { Width = 1180, Height = 760 },
        Font = window.FontFamily?.Name,
        Theme = "light/dark",
      },
      Runner = new { Warmups = warmups, Samples = samples, LongScrollIterations = longScrollIterations, ScenarioCount = results.Count },
      Results = results,
    };
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
    await File.WriteAllTextAsync(outputPath, JsonSerializer.Serialize(summary, JsonOptions));
    Console.WriteLine($"Avalonia real-render performance: {results.Count} scenarios -> {outputPath}");
  }

  private static void Render(Control control)
  {
    using var bitmap = new RenderTargetBitmap(new PixelSize(1120, 700), new Vector(96, 96));
    bitmap.Render(control);
  }

  private static Task WaitForRenderAsync()
  {
    var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    global::Avalonia.Threading.Dispatcher.UIThread.Post(
      () => completion.SetResult(),
      global::Avalonia.Threading.DispatcherPriority.Render);
    return completion.Task;
  }

  private static (string, Func<Control>, Action<Control, int>) VirtualList(string id, int count, bool variable) =>
    (id,
      () =>
      {
        var list = new BenchmarkVirtualList
        {
          ItemCount = count,
          FixedItemSize = 32,
          ViewportSize = 640,
          Overscan = 2,
          SizeMode = variable ? FsusVirtualSizeMode.Variable : FsusVirtualSizeMode.Fixed,
        };
        if (variable)
        {
          for (var index = 0; index < Math.Min(count, 2048); index++) list.SetMeasuredSize(index, 28 + index % 7 * 7);
        }
        list.RefreshWindow();
        return list;
      },
      (control, iteration) =>
      {
        var list = (FsusVirtualList)control;
        list.ScrollHost.Offset = new Vector(0, (iteration * 3L % count) * list.FixedItemSize);
      }
  );

  private static (string, Func<Control>, Action<Control, int>) TableV2(string id, int rows, int columns) =>
    (id,
      () =>
      {
        var table = new BenchmarkTableV2 { RowCount = rows, ColumnCount = columns, RowHeight = 32, ColumnWidth = 120 };
        table.AttachResizer(new FsusAutoResizer { Viewport = new Size(960, 640) });
        table.RefreshLayout();
        return table;
      },
      (control, iteration) =>
      {
        var table = (FsusTableV2)control;
        table.ScrollHost.Offset = new Vector(
          (iteration % columns) * table.ColumnWidth,
          (iteration * 3L % rows) * table.RowHeight);
      }
  );

  private static (string, Func<Control>, Action<Control, int>) DataTable(string id, int rows) =>
    (id,
      () =>
      {
        var table = new FsusDataTable { VirtualizationThreshold = 250, VisibleRowLimit = 48, VisibleColumnLimit = 12 };
        table.Columns.Add(new FsusDataTableColumn("id", "ID") { Sortable = true });
        table.Columns.Add(new FsusDataTableColumn("score", "Score") { Sortable = true });
        for (var index = 0; index < rows; index++)
        {
          table.Rows.Add(FsusDataTableRow.From($"row-{index}", new Dictionary<string, object?>
          {
            ["id"] = index,
            ["score"] = index * 48271 % 104729,
          }));
        }
        table.RefreshView();
        return table;
      },
      (control, iteration) =>
      {
        var table = (FsusDataTable)control;
        if (iteration % 3 == 0) table.SortBy("score", FsusSortDirection.Ascending);
        else if (iteration % 3 == 1) table.ToggleRowSelection($"row-{iteration % rows}");
        else table.ScrollTo((iteration * 7919) % rows, iteration % 2);
      }
  );

  private static (string, Func<Control>, Action<Control, int>) Tree(string id, int nodes) =>
    (id,
      () =>
      {
        var tree = new FsusTree();
        for (var index = 0; index < nodes / 10; index++)
        {
          var parent = new FsusTreeNode($"p-{index}", $"Parent {index}");
          for (var child = 0; child < 10; child++) parent.Children.Add(new FsusTreeNode($"p-{index}-{child}", $"Child {child}"));
          tree.Nodes.Add(parent);
        }
        tree.RefreshView();
        return tree;
      },
      (control, iteration) =>
      {
        var tree = (FsusTree)control;
        var key = $"p-{iteration % (nodes / 10)}";
        if (!tree.Expand(key)) tree.Collapse(key);
        tree.FocusNode(key);
      }
  );

  private static (string, Func<Control>, Action<Control, int>) Input(string id) =>
    (id, () => new FsusInput { Width = 600 }, (control, iteration) => ((FsusInput)control).Text = $"continuous input {iteration} 中文");

  private static (string, Func<Control>, Action<Control, int>) Theme(string id) =>
    (id, () => new FsusButton { Content = "Theme switch fixture" }, (control, iteration) =>
    {
      if (Application.Current is not null) Application.Current.RequestedThemeVariant = iteration % 2 == 0 ? ThemeVariant.Dark : ThemeVariant.Light;
    }
  );

  private static object Statistics(IReadOnlyList<double> values)
  {
    var sorted = values.Order().ToArray();
    double Percentile(double value) => sorted[Math.Min(sorted.Length - 1, Math.Max(0, (int)Math.Ceiling(sorted.Length * value) - 1))];
    return new { P50 = Percentile(0.50), P95 = Percentile(0.95), P99 = Percentile(0.99), Min = sorted[0], Max = sorted[^1], Samples = sorted.Length };
  }

  private static VirtualizationMetrics ReadVirtualizationMetrics(Control control) =>
    control switch
    {
      FsusVirtualList list => new(
        list.RealizedContainerCount,
        list.ContainerPoolCount,
        list.RetainedMeasurementCount,
        list.LoadedItems.Count),
      FsusTableV2 table => new(
        table.RealizedCellCount,
        table.CellPoolCount,
        0,
        table.LoadedRowIndex.Count),
      _ => new(1, 0, 0, 0),
    };

  private static string[] ExerciseEdgeOperations(Control control)
  {
    if (control is BenchmarkVirtualList list)
    {
      var lastIndex = Math.Max(0, list.ItemCount - 1);
      list.ScrollToIndex(lastIndex);
      list.ScrollToIndex(0);
      list.ViewportSize = 576;
      list.RefreshWindow();
      list.ViewportSize = 640;
      if (list.SizeMode == FsusVirtualSizeMode.Variable)
      {
        list.SetMeasuredSize(0, 48);
      }
      list.NotifyItemsInserted(0, 1);
      list.Navigate(Key.Down);
      return ["long-distance-scroll", "resize", "measurement", "data-insert", "keyboard"];
    }
    if (control is BenchmarkTableV2 table)
    {
      table.ScrollToCell(Math.Max(0, table.RowCount - 1), Math.Max(0, table.ColumnCount - 1));
      table.ScrollToCell(0, 0);
      table.AttachResizer(new FsusAutoResizer { Viewport = new Size(840, 560) });
      table.RefreshLayout();
      table.AttachResizer(new FsusAutoResizer { Viewport = new Size(960, 640) });
      table.Navigate(Key.Right);
      return ["long-distance-scroll", "resize", "keyboard"];
    }
    return [];
  }

  private static string? ReadArgument(string[] args, string name)
  {
    var index = Array.IndexOf(args, name);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
  }

  private static int ReadInt(string[] args, string name, int fallback) =>
    int.TryParse(ReadArgument(args, name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : fallback;

  private static string ResolveCpuName()
  {
    var environmentName = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER");
    if (!string.IsNullOrWhiteSpace(environmentName)) return environmentName;
    if (File.Exists("/proc/cpuinfo"))
    {
      return File.ReadLines("/proc/cpuinfo")
        .FirstOrDefault(line => line.StartsWith("model name", StringComparison.Ordinal))
        ?.Split(':').Last().Trim()
        ?? "unknown";
    }
    return "unknown";
  }

  private static string ResolveRenderingBackend(Window window)
  {
    var renderer = typeof(TopLevel)
      .GetProperty("Renderer", BindingFlags.Instance | BindingFlags.NonPublic)
      ?.GetValue(window);
    return renderer?.GetType().FullName ?? "unresolved";
  }

  private static string ResolvePlatformGraphicsBackend(Window window)
  {
    var renderer = typeof(TopLevel)
      .GetProperty("Renderer", BindingFlags.Instance | BindingFlags.NonPublic)
      ?.GetValue(window);
    var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);
    return FindPlatformGraphics(renderer, visited, 0) ?? "software-no-platform-graphics";
  }

  private static string? FindPlatformGraphics(object? candidate, HashSet<object> visited, int depth)
  {
    if (candidate is null || depth > 5 || !visited.Add(candidate)) return null;
    var type = candidate.GetType();
    if (typeof(IPlatformGraphics).IsAssignableFrom(type)) return type.FullName;
    foreach (var field in type.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
    {
      if (!field.Name.Contains("platform", StringComparison.OrdinalIgnoreCase) &&
          !field.Name.Contains("graphics", StringComparison.OrdinalIgnoreCase) &&
          !field.Name.Contains("render", StringComparison.OrdinalIgnoreCase) &&
          !field.Name.Contains("compositor", StringComparison.OrdinalIgnoreCase) &&
          !field.Name.Contains("server", StringComparison.OrdinalIgnoreCase))
      {
        continue;
      }
      var match = FindPlatformGraphics(field.GetValue(candidate), visited, depth + 1);
      if (match is not null) return match;
    }
    return null;
  }

  private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
  private sealed record VirtualizationMetrics(int Realized, int Pooled, int RetainedMeasurements, int LoadedWindow);

  private sealed class BenchmarkVirtualList : FsusVirtualList
  {
    public void Navigate(global::Avalonia.Input.Key key) => HandleKeyAsync(key).GetAwaiter().GetResult();
  }

  private sealed class BenchmarkTableV2 : FsusTableV2
  {
    public void Navigate(global::Avalonia.Input.Key key) => HandleKeyAsync(key).GetAwaiter().GetResult();
  }
}
