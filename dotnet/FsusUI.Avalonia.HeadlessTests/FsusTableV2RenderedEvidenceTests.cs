using System.Runtime.InteropServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using Avalonia.Headless.XUnit;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTableV2RenderedEvidenceTests
{
  [AvaloniaFact]
  public void RendersPopulatedAndEmptyContentRegionsToPng()
  {
    var headerTemplate = new FuncDataTemplate<FsusTableV2HeaderCellContext>((context, _) =>
      new Border
      {
        Padding = new Thickness(8, 6),
        Background = new SolidColorBrush(Color.Parse(
          context?.HeaderIndex == 0 ? "#EEF2F6" : "#F8F9FB")),
        BorderBrush = new SolidColorBrush(Color.Parse("#D5DCE5")),
        BorderThickness = new Thickness(0, 0, 1, 1),
        Child = new TextBlock
        {
          Text = context is null
            ? string.Empty
            : context.HeaderIndex == 0
              ? context.Column.Key switch
                {
                  "name" => "Contract fields",
                  "status" => "Review state",
                  _ => "Assignment",
                }
              : context.Column.Header,
          FontWeight = FontWeight.SemiBold,
        },
      });
    var rowTemplate = new FuncDataTemplate<FsusTableV2RowContext>((context, _) =>
      CreateRowVisual(context));
    var footerTemplate = new FuncDataTemplate<object>((_, _) =>
      new Border
      {
        Padding = new Thickness(8, 5),
        Background = new SolidColorBrush(Color.Parse("#F8F9FB")),
        Child = new TextBlock { Text = "20 rows" },
      });
    var emptyTemplate = new FuncDataTemplate<object>((_, _) =>
      new Border
      {
        Padding = new Thickness(12),
        Child = new TextBlock
        {
          Text = "No rows",
          HorizontalAlignment = HorizontalAlignment.Center,
        },
      });

    var table = CreateTable();
    table.HeaderCellContent = headerTemplate;
    table.RowContent = rowTemplate;
    table.FooterContent = footerTemplate;
    table.FooterHeight = 32;
    table.RefreshLayout();

    var empty = new FsusTableV2
    {
      AccessibleName = "Empty review table",
      ViewportWidth = 440,
      ViewportHeight = 96,
      EmptyContent = emptyTemplate,
    };
    empty.HeaderHeight = 0;
    empty.RefreshLayout();

    var stack = new StackPanel
    {
      Margin = new Thickness(24),
      Spacing = 20,
      Children =
      {
        new TextBlock
        {
          Text = "Table V2 content regions",
          FontSize = 18,
          FontWeight = FontWeight.SemiBold,
        },
        table,
        empty,
      },
    };
    var surface = new Border
    {
      Width = 488,
      Height = 540,
      Background = Brushes.White,
      Child = stack,
    };
    var window = new Window
    {
      Width = 488,
      Height = 540,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachTheme(window);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.Measure(new Size(488, 540));
    window.Arrange(new Rect(0, 0, 488, 540));
    surface.Measure(new Size(488, 540));
    surface.Arrange(new Rect(0, 0, 488, 540));
    Dispatcher.UIThread.RunJobs();

    var repositoryRoot = FindRepositoryRoot();
    var outputDirectory = Path.Combine(
      repositoryRoot,
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "issue-285-table-v2");
    Directory.CreateDirectory(outputDirectory);
    var outputPath = Path.Combine(outputDirectory, "table-v2-content-regions-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(488, 540), new Vector(96, 96));
    bitmap.Render(surface);
    var artifactBytes = SaveOrVerifyArtifact(bitmap, outputPath);

    Assert.Equal(6, table.HeaderContentPresenterCount);
    Assert.InRange(table.RowContentPresenterCount, 1, 8);
    Assert.True(table.IsFooterContentVisible);
    Assert.True(empty.IsEmptyContentVisible);
    Assert.True(artifactBytes.Length > 4_000);
    window.Close();
  }

  [AvaloniaFact]
  public void RendersWholeHeaderAndOverlayContentRegionsToPng()
  {
    var table = CreateTable();
    table.ViewportHeight = 180;
    table.HeaderHeights.Clear();
    table.HeaderHeights.Add(36);
    table.HeaderContent = new FuncDataTemplate<FsusTableV2HeaderContext>((_, _) =>
      new Border
      {
        Padding = new Thickness(10, 7),
        Background = new SolidColorBrush(Color.Parse("#F4F6F8")),
        BorderBrush = new SolidColorBrush(Color.Parse("#D5DCE5")),
        BorderThickness = new Thickness(0, 0, 0, 1),
        Child = new TextBlock
        {
          Text = "Contract review queue",
          FontWeight = FontWeight.SemiBold,
        },
      });
    table.OverlayContent = new FuncDataTemplate<object>((_, _) =>
      new Border
      {
        Background = new SolidColorBrush(Color.Parse("#E6FFFFFF")),
        Child = new Border
        {
          Padding = new Thickness(12, 8),
          Background = new SolidColorBrush(Color.Parse("#F4F6F8")),
          BorderBrush = new SolidColorBrush(Color.Parse("#D5DCE5")),
          BorderThickness = new Thickness(1),
          CornerRadius = new CornerRadius(6),
          HorizontalAlignment = HorizontalAlignment.Center,
          VerticalAlignment = VerticalAlignment.Center,
          Child = new TextBlock { Text = "Refreshing rows" },
        },
      });
    table.RefreshLayout();

    var surface = new Border
    {
      Width = 488,
      Height = 320,
      Padding = new Thickness(24),
      Background = Brushes.White,
      Child = new StackPanel
      {
        Spacing = 20,
        Children =
        {
          new TextBlock
          {
            Text = "Table V2 overlay state",
            FontSize = 18,
            FontWeight = FontWeight.SemiBold,
          },
          table,
        },
      },
    };
    var window = new Window
    {
      Width = 488,
      Height = 320,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachTheme(window);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.Measure(new Size(488, 320));
    window.Arrange(new Rect(0, 0, 488, 320));
    surface.Measure(new Size(488, 320));
    surface.Arrange(new Rect(0, 0, 488, 320));
    Dispatcher.UIThread.RunJobs();

    var outputDirectory = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "issue-285-table-v2");
    Directory.CreateDirectory(outputDirectory);
    var outputPath = Path.Combine(outputDirectory, "table-v2-whole-header-overlay-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(488, 320), new Vector(96, 96));
    bitmap.Render(surface);
    var artifactBytes = SaveOrVerifyArtifact(bitmap, outputPath);

    Assert.Equal(1, table.HeaderContentPresenterCount);
    Assert.True(table.IsOverlayContentVisible);
    Assert.True(artifactBytes.Length > 4_000);
    window.Close();
  }

  private static FsusTableV2 CreateTable()
  {
    var table = new FsusTableV2
    {
      AccessibleName = "Review table",
      RowHeight = 28,
      ColumnWidth = 146,
      ViewportWidth = 440,
      ViewportHeight = 224,
      Overscan = 0,
      CellTemplate = new FuncDataTemplate<object>((value, _) =>
        new Border
        {
          Padding = new Thickness(8, 4),
          Child = new TextBlock
          {
            Text = Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture),
            VerticalAlignment = VerticalAlignment.Center,
          },
        }),
    };
    table.HeaderHeights.Clear();
    table.HeaderHeights.Add(28);
    table.HeaderHeights.Add(32);
    table.Columns.Add(new FsusDataTableColumn("name", "Name"));
    table.Columns.Add(new FsusDataTableColumn("status", "Status"));
    table.Columns.Add(new FsusDataTableColumn("owner", "Owner"));
    for (var row = 1; row <= 20; row++)
    {
      table.Data.Add(FsusDataTableRow.From($"row-{row}", new Dictionary<string, object?>
      {
        ["name"] = $"Contract {row}",
        ["status"] = row % 2 == 0 ? "Aligned" : "Review",
        ["owner"] = "FsusUI",
      }));
    }
    return table;
  }

  private static void AttachTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions
    {
      Variant = FsusThemeVariant.Light,
      MotionMode = FsusMotionMode.Reduced,
    });
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new global::Avalonia.Markup.Xaml.Styling.StyleInclude(
        new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }

  private static Control CreateRowVisual(FsusTableV2RowContext? context)
  {
    var grid = new Grid();
    for (var column = 0; column < 3; column++)
    {
      grid.ColumnDefinitions.Add(new ColumnDefinition(new GridLength(1, GridUnitType.Star)));
      var text = new TextBlock
      {
        Margin = new Thickness(8, 4),
        Text = context is not null && column < context.Cells.Count
          ? Convert.ToString(
              context.Cells[column],
              System.Globalization.CultureInfo.InvariantCulture)
          : string.Empty,
        VerticalAlignment = VerticalAlignment.Center,
      };
      Grid.SetColumn(text, column);
      grid.Children.Add(text);
    }
    return new Border
    {
      Background = Brushes.White,
      BorderBrush = new SolidColorBrush(Color.Parse("#E5E9EF")),
      BorderThickness = new Thickness(0, 0, 0, 1),
      IsHitTestVisible = false,
      Child = grid,
    };
  }

  private static byte[] SaveOrVerifyArtifact(RenderTargetBitmap bitmap, string outputPath)
  {
    using var stream = new MemoryStream();
    bitmap.Save(stream);
    var bytes = stream.ToArray();
    if (Environment.GetEnvironmentVariable("FSUSUI_UPDATE_VISUAL_ARTIFACTS") == "1")
    {
      File.WriteAllBytes(outputPath, bytes);
      return bytes;
    }

    Assert.True(File.Exists(outputPath), $"sealed artifact missing: {outputPath}");
    using var actualBitmap = new Bitmap(new MemoryStream(bytes, writable: false));
    using var expectedBitmap = new Bitmap(outputPath);
    Assert.Equal(expectedBitmap.PixelSize, actualBitmap.PixelSize);
    AssertRenderedPixelsMatch(expectedBitmap, actualBitmap);
    return bytes;
  }

  private static void AssertRenderedPixelsMatch(Bitmap expected, Bitmap actual)
  {
    var expectedPixels = CopyBgraPixels(expected, out var expectedStride);
    var actualPixels = CopyBgraPixels(actual, out var actualStride);
    Assert.Equal(expected.PixelSize, actual.PixelSize);
    var populated = expected.PixelSize.Height == 540;
    var height = populated ? 334 : 234;

    // The sealed outline is the geometry anchor, not a whole-image similarity score.
    // The title uses platform fonts, so its line height may translate the table vertically.
    var expectedTop = FindOutline(expectedPixels, expectedStride, expected.PixelSize);
    var actualTop = FindOutline(actualPixels, actualStride, actual.PixelSize);
    Assert.Equal(69, expectedTop);
    foreach (var x in populated
      ? new[] { 24, 25, 26, 169, 170, 315, 316, 461, 462, 463 }
      : new[] { 24, 25, 26, 315, 316, 461, 462, 463 })
    {
      for (var y = 0; y < height; y += 1)
      {
        for (var channel = 0; channel < 4; channel += 1)
        {
          Assert.True(
            expectedPixels[(expectedTop + y) * expectedStride + x * 4 + channel] ==
            actualPixels[(actualTop + y) * actualStride + x * 4 + channel],
            $"Table chrome/background/separator differs at ({x}, table + {y}), channel {channel}.");
        }
      }
    }

    if (populated)
    {
      for (var column = 0; column < 3; column += 1)
      {
        Ink($"group header {column}", 32 + column * 146, 8, 130, 28);
        Ink($"column header {column}", 32 + column * 146, 36, 130, 32);
        for (var row = 0; row < 8; row += 1)
          Ink($"row {row}, column {column}", 32 + column * 146, 68 + row * 28, 130, 27);
      }
      Ink("footer", 40, 292, 100, 32);
      Ink("empty message", 200, 374, 100, 28);
    }
    else
    {
      Ink("whole header", 34, 8, 270, 36);
      Ink("centered overlay message", 180, 112, 128, 46);
      // The capsule width follows font metrics. Its light fill must still be painted
      // in the central body region, independently of the header's identical fill.
      Assert.True(HasCapsuleFill(expectedPixels, expectedStride, expectedTop));
      Assert.True(HasCapsuleFill(actualPixels, actualStride, actualTop));
    }

    void Ink(string name, int x, int y, int width, int regionHeight)
    {
      Assert.True(HasInk(expectedPixels, expectedStride, expectedTop + y, x, width, regionHeight),
        $"Sealed artifact has no ink in {name}.");
      Assert.True(HasInk(actualPixels, actualStride, actualTop + y, x, width, regionHeight),
        $"Current rendering has no ink in {name}.");
    }

    int FindOutline(byte[] pixels, int stride, PixelSize size)
    {
      var points = new List<(int X, int Y)>();
      for (var y = 0; y < size.Height; y += 1)
        for (var x = 0; x < size.Width; x += 1)
        {
          var p = y * stride + x * 4;
          // Exact sealed outline palette, distinct from neutral text and header fills.
          if (pixels[p] == 156 && pixels[p + 1] == 89 && pixels[p + 2] == 42 && pixels[p + 3] == 255)
            points.Add((x, y));
        }
      Assert.NotEmpty(points);
      Assert.Equal(24, points.Min(p => p.X));
      Assert.Equal(463, points.Max(p => p.X));
      var top = points.Min(p => p.Y);
      Assert.Equal(height, points.Max(p => p.Y) - top + 1);
      return top;
    }

    static bool HasInk(byte[] pixels, int stride, int y, int x, int width, int height)
    {
      for (var row = y; row < y + height; row += 1)
        for (var column = x; column < x + width; column += 1)
        {
          var p = row * stride + column * 4;
          if (pixels[p] < 180 && pixels[p + 1] < 180 && pixels[p + 2] < 180)
            return true;
        }
      return false;
    }

    static bool HasCapsuleFill(byte[] pixels, int stride, int top)
    {
      for (var y = top + 112; y < top + 158; y += 1)
      {
        var p = y * stride + 244 * 4;
        if (pixels[p] == 248 && pixels[p + 1] == 246 && pixels[p + 2] == 244)
          return true;
      }
      return false;
    }
  }

  private static byte[] CopyBgraPixels(Bitmap bitmap, out int rowBytes)
  {
    using var buffer = new WriteableBitmap(
      bitmap.PixelSize,
      new Vector(96, 96),
      global::Avalonia.Platform.PixelFormat.Bgra8888,
      global::Avalonia.Platform.AlphaFormat.Premul);
    using var framebuffer = buffer.Lock();
    bitmap.CopyPixels(framebuffer);
    rowBytes = framebuffer.RowBytes;
    var pixels = new byte[rowBytes * bitmap.PixelSize.Height];
    Marshal.Copy(framebuffer.Address, pixels, 0, pixels.Length);
    return pixels;
  }

  private static string FindRepositoryRoot()
  {
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null && !File.Exists(Path.Combine(current.FullName, "pnpm-workspace.yaml")))
    {
      current = current.Parent;
    }
    return current?.FullName
      ?? throw new InvalidOperationException("Unable to locate repository root.");
  }
}
