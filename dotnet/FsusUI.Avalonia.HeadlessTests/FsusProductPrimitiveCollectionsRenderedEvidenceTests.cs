using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusProductPrimitiveCollectionsRenderedEvidenceTests
{
  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void RendersMetricAndDescriptionCollectionsInResponsiveLayouts(FsusThemeVariant variant)
  {
    ApplyTheme(variant);

    var kpis = new FsusKpiGroup { AccessibleName = "Document metrics" };
    kpis.Items.Add(new FsusMetricItem("words", "Words", "12"));
    kpis.Items.Add(new FsusMetricItem("characters", "Characters", "8,420"));
    kpis.Items.Add(new FsusMetricItem("reading-time", "Reading time", "7 min"));
    kpis.Items.Add(new FsusMetricItem("paragraphs", "Paragraphs", "18"));

    var descriptions = new FsusDescriptions
    {
      AccessibleName = "Document metadata",
      Column = 2,
      Border = true,
    };
    descriptions.Items.Add(new FsusDescriptionsItem("Document", "release-notes.md"));
    descriptions.Items.Add(new FsusDescriptionsItem("Status", "Draft"));
    descriptions.Items.Add(new FsusDescriptionsItem("Owner", "Documentation"));
    descriptions.Items.Add(new FsusDescriptionsItem("Updated", "2026-09-06"));

    var body = new StackPanel { Spacing = 16 };
    body.Children.Add(kpis);
    body.Children.Add(descriptions);
    var window = new Window
    {
      Width = 640,
      Height = 320,
      Content = body,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    window.Show();
    descriptions.RefreshLayout(window.Bounds.Width);
    kpis.ApplyViewport(window.Bounds.Width);

    window.UpdateLayout();
    Assert.True(kpis.Bounds.Height > 0);
    Assert.True(descriptions.Bounds.Height > 0);
    Assert.Equal(4, Assert.IsType<UniformGrid>(kpis.Content).Children.Count);
    Assert.Equal(2, Assert.IsType<UniformGrid>(descriptions.Content).Columns);
    Assert.All(kpis.GetVisualDescendants().OfType<FsusText>(), text => Assert.True(text.Bounds.Height > 0));
    Assert.All(descriptions.GetVisualDescendants().OfType<FsusText>(), text => Assert.True(text.Bounds.Height > 0));

    kpis.ApplyViewport(360);
    descriptions.RefreshLayout(360);
    window.UpdateLayout();
    Assert.Equal(1, Assert.IsType<UniformGrid>(kpis.Content).Columns);
    Assert.Equal(1, Assert.IsType<UniformGrid>(descriptions.Content).Columns);
    Assert.All(kpis.GetVisualDescendants().OfType<FsusText>(), text => Assert.True(text.Bounds.Height > 0));
    Assert.All(descriptions.GetVisualDescendants().OfType<FsusText>(), text => Assert.True(text.Bounds.Height > 0));

    CaptureWindow(window, $"product-collections-{variant.ToString().ToLowerInvariant()}.png");
    window.Close();
  }

  private static void CaptureWindow(Window window, string fileName)
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "issue-816-product-collections");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, fileName);
    using var bitmap = new RenderTargetBitmap(
      new PixelSize((int)window.Width, (int)window.Height),
      new Vector(96, 96));
    bitmap.Render(window);
    using var stream = File.Create(outputPath);
    bitmap.Save(stream);
    Assert.True(new FileInfo(outputPath).Length > 1_000);
  }

  private static FsusThemeOptions themeOptions = new();

  private static void ApplyTheme(FsusThemeVariant variant)
  {
    themeOptions = new FsusThemeOptions
    {
      Variant = variant,
      MotionMode = FsusMotionMode.Enabled,
    };
  }

  private static void AttachFsusTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, themeOptions);
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new global::Avalonia.Markup.Xaml.Styling.StyleInclude(
        new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }

  private static string FindRepositoryRoot()
  {
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null &&
           !File.Exists(Path.Combine(dir.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
    {
      dir = dir.Parent;
    }

    return dir?.FullName
      ?? throw new InvalidOperationException("Unable to locate repository root.");
  }
}
