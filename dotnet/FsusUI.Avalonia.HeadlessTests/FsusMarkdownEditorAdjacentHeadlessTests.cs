using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusMarkdownEditorAdjacentHeadlessTests
{
  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void SearchOutlineAndFocusRenderThroughTheProductionProjectionSurface(
    FsusThemeVariant variant)
  {
    const string source =
      "# Research notes\n\n" +
      "Current paragraph keeps the active writing range readable.\n\n" +
      "## Findings\n\n" +
      "The projection highlight marks findings without changing line wrap.\n\n" +
      "A second findings match verifies current and non-current emphasis.";
    var identity = new FsusMarkdownDocumentIdentity("adjacent-evidence", 1);
    var editor = new FsusMarkdownEditor
    {
      Width = 620,
      Height = 240,
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
      Profile = "prose",
      FocusWritingAidEnabled = true,
      TypewriterWritingAidEnabled = true,
      ScrollContentFloor = 220,
    };
    var surface = new Border
    {
      Width = 680,
      Height = 360,
      Padding = new Thickness(30),
      Child = editor,
    };
    var window = new Window
    {
      Width = 680,
      Height = 360,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachTheme(window, surface, variant);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);

    Assert.True(editor.CommitProjection(new(
      identity,
      0,
      source,
      [new("document", new(0, source.Length), FsusMarkdownProjectionSpanKind.SourceFallback, source, FallbackReason: "canonical-fixture")]
    )).Accepted);
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);
    var inputOwner = Assert.Single(editor.GetVisualDescendants().OfType<TextBox>());
    var scrollOwner = Assert.Single(
      editor.GetVisualDescendants().OfType<ScrollViewer>(),
      candidate => candidate.Name == "PART_Scroll");
    var extentBefore = scrollOwner.Extent;
    var inputBoundsBefore = inputOwner.Bounds;
    var findingsHeading = source.IndexOf("## Findings", StringComparison.Ordinal);
    var firstMatch = source.IndexOf("findings", StringComparison.OrdinalIgnoreCase);
    var secondMatch = source.LastIndexOf("findings", StringComparison.OrdinalIgnoreCase);
    var query = new FsusMarkdownSearchQuery("findings", 1, FsusMarkdownSearchMode.PlainCase);
    editor.RequestSearch(query);
    Assert.True(editor.CommitSearch(new(
      identity,
      0,
      query,
      [
        new(new(firstMatch, firstMatch + 8), 1, "heading-findings"),
        new(new(secondMatch, secondMatch + 8), 1, "paragraph-findings"),
      ])).Accepted);
    Assert.True(editor.CommitOutline(new(
      identity,
      0,
      [
        new("heading-research", 1, "Research notes", new(0, 16), new(2, 16)),
        new("heading-findings", 2, "Findings", new(findingsHeading, findingsHeading + 11), new(findingsHeading + 3, findingsHeading + 11), "heading-research"),
      ])).Accepted);
    var activeStart = source.IndexOf("Current paragraph", StringComparison.Ordinal);
    var activeEnd = source.IndexOf("\n\n## Findings", StringComparison.Ordinal);
    Assert.True(editor.CommitWritingAids(new(
      identity,
      0,
      [new(activeStart, activeEnd)],
      [new(firstMatch, firstMatch + 8), new(secondMatch, secondMatch + 8)])).Accepted);
    Assert.Equal(
      FsusMarkdownRevealStatus.Success,
      editor.RevealHeading("heading-findings", identity, 0));
    Assert.Equal(
      FsusMarkdownRevealStatus.Success,
      editor.NavigateSearch(FsusMarkdownSearchDirection.Next).Status);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.UserScroll);
    var suspendedOffset = editor.ScrollPosition;
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.SelectionDragEnd);
    Assert.Equal(suspendedOffset, editor.ScrollPosition);
    editor.NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.Input);
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);

    Assert.Same(inputOwner, Assert.Single(editor.GetVisualDescendants().OfType<TextBox>()));
    Assert.Same(
      scrollOwner,
      Assert.Single(
        editor.GetVisualDescendants().OfType<ScrollViewer>(),
        candidate => candidate.Name == "PART_Scroll"));
    Assert.Equal(extentBefore, scrollOwner.Extent);
    Assert.Equal(inputBoundsBefore, inputOwner.Bounds);
    Assert.Equal(FsusMarkdownTypewriterAnchor.UpperThird, editor.TypewriterAnchor);
    Assert.Equal(FsusMarkdownWritingAidsState.Restoring, editor.WritingAidsState);
    Assert.Equal(secondMatch, editor.TransactionStore.Selection.Start);
    Assert.True(editor.ScrollPosition.Y >= 0);

    var outputRoot = HeadlessVisualEvidenceOutput.ResolveOutputRoot(
      FindRepositoryRoot(),
      "issue-717-markdown-editor-adjacent");
    var path = Path.Combine(
      outputRoot,
      $"markdown-editor-adjacent-{variant.ToString().ToLowerInvariant()}.png");
    using (var bitmap = new RenderTargetBitmap(new PixelSize(680, 360), new Vector(96, 96)))
    {
      bitmap.Render(surface);
      using var stream = File.Create(path);
      bitmap.Save(stream);
    }
    Assert.True(new FileInfo(path).Length > 2_000);
    Assert.Equal(64, Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).Length);
    window.Close();
  }

  private static void AttachTheme(
    Window window,
    Border surface,
    FsusThemeVariant variant)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions
    {
      Variant = variant,
      MotionMode = FsusMotionMode.Reduced,
    });
    window.Resources.MergedDictionaries.Add(resources);
    window.Resources.MergedDictionaries.Add(
      new ResourceInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
      {
        Source = new Uri($"avares://FsusUI.Avalonia.Themes/Themes/Fsus{variant}.axaml"),
      });
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    Assert.True(window.TryFindResource(FsusThemeResourceKeys.BackgroundBrush, out var background));
    surface.Background = Assert.IsAssignableFrom<IBrush>(background);
  }

  private static void Arrange(Window window, Control surface)
  {
    window.Measure(new Size(680, 360));
    window.Arrange(new Rect(0, 0, 680, 360));
    surface.Arrange(new Rect(0, 0, 680, 360));
    Dispatcher.UIThread.RunJobs();
  }

  private static string FindRepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    for (var directory = new DirectoryInfo(Path.GetDirectoryName(sourceFile)!);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }
    throw new InvalidOperationException("Could not find repository root.");
  }
}
