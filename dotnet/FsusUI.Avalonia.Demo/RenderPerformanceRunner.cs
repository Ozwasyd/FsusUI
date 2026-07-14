using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
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

  public static bool IsConfigured { get; private set; }

  public static void Configure(string[] args)
  {
    IsConfigured = true;
    profile = ReadArgument(args, "--profile") ?? "quick";
    outputPath = ReadArgument(args, "--output") ?? outputPath;
    warmups = ReadInt(args, "--warmups", profile == "full" ? 3 : 1);
    samples = ReadInt(args, "--samples", profile == "full" ? 12 : 5);
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

    var results = new List<object>();
    var rawDirectory = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(outputPath))!, "raw");
    Directory.CreateDirectory(rawDirectory);
    foreach (var definition in definitions)
    {
      var control = definition.Create();
      var host = new Grid
      {
        Width = 1120,
        Height = 700,
        Children = { control },
      };
      window.Content = host;
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
      }

      var raw = new
      {
        definition.Id,
        FrameMs = frame,
        MeasureArrangeMs = measureArrange,
        DrawMs = draw,
        MountUnmountMs = mountUnmount,
        AllocatedBytes = allocated,
        RealizedVisuals = realizedVisuals,
        Gc = new
        {
          Gen0 = GC.CollectionCount(0) - gc0Before,
          Gen1 = GC.CollectionCount(1) - gc1Before,
          Gen2 = GC.CollectionCount(2) - gc2Before,
        },
      };
      await File.WriteAllTextAsync(
        Path.Combine(rawDirectory, $"{definition.Id}.raw.json"),
        JsonSerializer.Serialize(raw, JsonOptions));
      var retainedVisuals = host.GetVisualDescendants().Count();
      var disposalWatch = Stopwatch.StartNew();
      window.Content = null;
      (control as IDisposable)?.Dispose();
      disposalWatch.Stop();
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
        RealizedVisuals = new { Peak = realizedVisuals.Max(), Stable = realizedVisuals[^1] },
        RetainedVisuals = retainedVisuals,
      });
    }

    var summary = new
    {
      SchemaVersion = 1,
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
        WindowPlatform = window.TryGetPlatformHandle()?.HandleDescriptor ?? "unresolved",
        Dpi = window.RenderScaling * 96d,
        Window = new { Width = 1180, Height = 760 },
        Font = window.FontFamily?.Name,
        Theme = "light/dark",
      },
      Runner = new { Warmups = warmups, Samples = samples, ScenarioCount = results.Count },
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
        var list = new FsusVirtualList
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
      (control, iteration) => ((FsusVirtualList)control).ScrollToIndex((iteration * 7919) % count));

  private static (string, Func<Control>, Action<Control, int>) TableV2(string id, int rows, int columns) =>
    (id,
      () =>
      {
        var table = new FsusTableV2 { RowCount = rows, ColumnCount = columns, RowHeight = 32, ColumnWidth = 120 };
        table.AttachResizer(new FsusAutoResizer { Viewport = new Size(960, 640) });
        table.RefreshLayout();
        return table;
      },
      (control, iteration) => ((FsusTableV2)control).ScrollToCell((iteration * 7919) % rows, (iteration * 17) % columns));

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
      });

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
      });

  private static (string, Func<Control>, Action<Control, int>) Input(string id) =>
    (id, () => new FsusInput { Width = 600 }, (control, iteration) => ((FsusInput)control).Text = $"continuous input {iteration} 中文");

  private static (string, Func<Control>, Action<Control, int>) Theme(string id) =>
    (id, () => new FsusButton { Content = "Theme switch fixture" }, (control, iteration) =>
    {
      if (Application.Current is not null) Application.Current.RequestedThemeVariant = iteration % 2 == 0 ? ThemeVariant.Dark : ThemeVariant.Light;
    });

  private static object Statistics(IReadOnlyList<double> values)
  {
    var sorted = values.Order().ToArray();
    double Percentile(double value) => sorted[Math.Min(sorted.Length - 1, Math.Max(0, (int)Math.Ceiling(sorted.Length * value) - 1))];
    return new { P50 = Percentile(0.50), P95 = Percentile(0.95), P99 = Percentile(0.99), Min = sorted[0], Max = sorted[^1], Samples = sorted.Length };
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

  private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
}
