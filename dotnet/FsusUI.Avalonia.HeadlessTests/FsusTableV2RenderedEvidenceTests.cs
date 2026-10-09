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
    // The sealed TableV2 images use Noto Sans 2.004, including its layout metrics.
    window.FontFamily = new FontFamily(
      "avares://FsusUI.Avalonia.HeadlessTests/Assets/Fonts/TableV2#Noto Sans");
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
    var evidenceDirectory = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      FindRepositoryRoot(), "issue-285-table-v2");
    File.WriteAllBytes(
      Path.Combine(evidenceDirectory, Path.GetFileName(outputPath)), bytes);
    Assert.Equal(File.ReadAllBytes(outputPath), bytes);
    return bytes;
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
