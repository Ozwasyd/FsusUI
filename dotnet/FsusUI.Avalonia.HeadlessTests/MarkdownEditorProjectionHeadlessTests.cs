using System.Security.Cryptography;
using System.Runtime.CompilerServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class MarkdownEditorProjectionHeadlessTests
{
  [AvaloniaTheory]
  [InlineData(FsusThemeVariant.Light)]
  [InlineData(FsusThemeVariant.Dark)]
  public void NativeSourceAndLiveRenderThroughOneInputOwnerWithInspectableEvidence(
    FsusThemeVariant variant)
  {
    var source =
      "**Bold** and ![diagram](diagram.png)\n\n中文 😀 مرحبا\n" +
      string.Join(
        "\n",
        Enumerable.Range(1, 18).Select(index =>
          index == 8 ? "Line 8 **focus**" : $"Line {index}"));
    var focusMarkerStart = source.IndexOf("**focus**", StringComparison.Ordinal);
    var focusTextStart = focusMarkerStart + 2;
    var focusTextEnd = focusTextStart + "focus".Length;
    var focusMarkerEnd = focusTextEnd + 2;
    var identity = new FsusMarkdownDocumentIdentity("rendered", 1);
    var editor = new FsusMarkdownEditor
    {
      Width = 620,
      Height = 200,
      Document = source,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Source,
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

    var input = Assert.Single(editor.GetVisualDescendants().OfType<TextBox>());
    Assert.False(input.IsUndoEnabled);
    var projectionVisual = Assert.Single(
      editor.GetVisualDescendants(),
      candidate => candidate.GetType().Name == "FsusMarkdownEditorProjectionView");
    var scroll = Assert.Single(
      editor.GetVisualDescendants().OfType<ScrollViewer>(),
      candidate => candidate.Name == "PART_Scroll");
    var expectedSourceAnchor = source.IndexOf("Line 6", StringComparison.Ordinal);
    Assert.True(expectedSourceAnchor > 0);
    scroll.Offset = new Vector(
      0,
      GetVisualLineTopForSource(projectionVisual, expectedSourceAnchor));
    Dispatcher.UIThread.RunJobs();
    AssertViewportStartsAtSourceLine(
      projectionVisual,
      scroll,
      expectedSourceAnchor);
    var sourcePng = Render(surface, variant, "source");

    editor.Mode = FsusMarkdownEditorMode.Live;
    var committed = editor.CommitProjection(new(
      identity,
      0,
      source,
      [
        new("strong-open", new(0, 2), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("strong-text", new(2, 6), FsusMarkdownProjectionSpanKind.Text, "Bold", "strong"),
        new("strong-close", new(6, 8), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
        new("conjunction", new(8, 13), FsusMarkdownProjectionSpanKind.Text, " and "),
        new(
          "image",
          new(13, 36),
          FsusMarkdownProjectionSpanKind.Atomic,
          "Diagram image",
          "image"),
        new(
          "localized-before-focus",
          new(36, focusMarkerStart),
          FsusMarkdownProjectionSpanKind.SourceFallback,
          source[36..focusMarkerStart],
          FallbackReason: "feature-localized-source"),
        new(
          "focus-open",
          new(focusMarkerStart, focusTextStart),
          FsusMarkdownProjectionSpanKind.HiddenMarker,
          ""),
        new(
          "focus-text",
          new(focusTextStart, focusTextEnd),
          FsusMarkdownProjectionSpanKind.Text,
          "focus",
          "strong"),
        new(
          "focus-close",
          new(focusTextEnd, focusMarkerEnd),
          FsusMarkdownProjectionSpanKind.HiddenMarker,
          ""),
        new(
          "localized-after-focus",
          new(focusMarkerEnd, source.Length),
          FsusMarkdownProjectionSpanKind.SourceFallback,
          source[focusMarkerEnd..],
          FallbackReason: "feature-localized-source"),
      ]));
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);
    Dispatcher.UIThread.RunJobs();
    AssertViewportStartsAtSourceLine(
      projectionVisual,
      scroll,
      expectedSourceAnchor);
    var livePng = Render(surface, variant, "live");

    Assert.True(committed.Accepted);
    Assert.Equal("aligned", editor.CapabilityState);
    Assert.Same(input, Assert.Single(editor.GetVisualDescendants().OfType<TextBox>()));
    Assert.Same(
      projectionVisual,
      Assert.Single(
        editor.GetVisualDescendants(),
        candidate => candidate.GetType().Name == "FsusMarkdownEditorProjectionView"));
    Assert.Same(
      scroll,
      Assert.Single(
        editor.GetVisualDescendants().OfType<ScrollViewer>(),
        candidate => candidate.Name == "PART_Scroll"));
    Assert.NotEqual(
      Convert.ToHexString(SHA256.HashData(sourcePng)),
      Convert.ToHexString(SHA256.HashData(livePng)));

    editor.Mode = FsusMarkdownEditorMode.Source;
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);
    Dispatcher.UIThread.RunJobs();
    AssertViewportStartsAtSourceLine(
      projectionVisual,
      scroll,
      expectedSourceAnchor);
    input.SelectionStart = expectedSourceAnchor + "Line 6".Length;
    input.SelectionEnd = input.SelectionStart;
    Assert.True(input.Focus());
    window.KeyPress(Key.Left, RawInputModifiers.None, PhysicalKey.ArrowLeft, null);
    Assert.Equal(source, ReadProjectionText(projectionVisual));
    editor.Mode = FsusMarkdownEditorMode.Live;
    Dispatcher.UIThread.RunJobs();
    Arrange(window, surface);
    Dispatcher.UIThread.RunJobs();
    AssertViewportStartsAtSourceLine(
      projectionVisual,
      scroll,
      expectedSourceAnchor);

    input.SelectionStart = source.Length;
    input.SelectionEnd = source.Length;
    Assert.True(input.Focus());
    Assert.True(input.IsFocused);
    window.KeyTextInput("!");
    Assert.Equal(source + "!", editor.Document);
    Assert.Equal(identity, editor.TransactionStore.Identity);
    Assert.Contains("strong-text", editor.RetainedProjectionNodeIds);
    Assert.Equal("source-fallback", editor.CapabilityState);
    Assert.Same(
      projectionVisual,
      Assert.Single(
        editor.GetVisualDescendants(),
        candidate => candidate.GetType().Name == "FsusMarkdownEditorProjectionView"));

    window.KeyPress(Key.Z, RawInputModifiers.Control, PhysicalKey.Z, "z");
    Assert.Equal(source, editor.Document);
    window.KeyPress(
      Key.Z,
      RawInputModifiers.Control | RawInputModifiers.Shift,
      PhysicalKey.Z,
      "Z");
    Assert.Equal(source + "!", editor.Document);
    window.Close();
  }

  private static void AssertViewportStartsAtSourceLine(
    Visual projectionVisual,
    ScrollViewer scroll,
    int expectedSourceAnchor)
  {
    var actualSourceAnchor = InvokeProjectionMethod<int>(
      projectionVisual,
      "GetSourceLineAnchor",
      scroll.Offset.Y);
    var exactLineTop = GetVisualLineTopForSource(
      projectionVisual,
      actualSourceAnchor);
    Assert.Equal(expectedSourceAnchor, actualSourceAnchor);
    Assert.InRange(Math.Abs(scroll.Offset.Y - exactLineTop), 0, 0.01);
  }

  private static double GetVisualLineTopForSource(
    Visual projectionVisual,
    int sourceOffset) =>
    InvokeProjectionMethod<double>(
      projectionVisual,
      "GetVisualLineTopForSource",
      sourceOffset);

  private static TResult InvokeProjectionMethod<TResult>(
    Visual projectionVisual,
    string methodName,
    object argument)
  {
    var method = projectionVisual.GetType().GetMethod(
      methodName,
      System.Reflection.BindingFlags.Instance |
      System.Reflection.BindingFlags.NonPublic);
    Assert.NotNull(method);
    return Assert.IsType<TResult>(method.Invoke(projectionVisual, [argument]));
  }

  private static string ReadProjectionText(Visual projectionVisual)
  {
    var field = projectionVisual.GetType().GetField(
      "text",
      System.Reflection.BindingFlags.Instance |
      System.Reflection.BindingFlags.NonPublic);
    Assert.NotNull(field);
    return Assert.IsType<string>(field.GetValue(projectionVisual));
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
        Source = new Uri(
          $"avares://FsusUI.Avalonia.Themes/Themes/Fsus{variant}.axaml"),
      });
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    Assert.True(
      window.TryFindResource(FsusThemeResourceKeys.BackgroundBrush, out var background));
    surface.Background = Assert.IsAssignableFrom<IBrush>(background);
  }

  private static void Arrange(Window window, Control surface)
  {
    window.Measure(new Size(680, 360));
    window.Arrange(new Rect(0, 0, 680, 360));
    surface.Arrange(new Rect(0, 0, 680, 360));
  }

  private static byte[] Render(
    Control surface,
    FsusThemeVariant variant,
    string mode)
  {
    using var bitmap =
      new RenderTargetBitmap(new PixelSize(680, 360), new Vector(96, 96));
    bitmap.Render(surface);
    using var memory = new MemoryStream();
    bitmap.Save(memory);
    var bytes = memory.ToArray();
    Assert.True(bytes.Length > 1_000);

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-markdown-editor-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    File.WriteAllBytes(
      Path.Combine(
        outputRoot,
        $"markdown-editor-{mode}-{variant.ToString().ToLowerInvariant()}.png"),
      bytes);
    return bytes;
  }

  private static string FindRepositoryRoot(
    [CallerFilePath] string sourceFile = "")
  {
    foreach (var start in new[]
      {
        Path.GetDirectoryName(sourceFile) ?? string.Empty,
        Environment.CurrentDirectory,
        AppContext.BaseDirectory,
      }.Where(start => !string.IsNullOrWhiteSpace(start))
        .Distinct(StringComparer.Ordinal))
    {
      for (var directory = new DirectoryInfo(start);
        directory is not null;
        directory = directory.Parent)
      {
        if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
        {
          return directory.FullName;
        }
      }
    }
    throw new InvalidOperationException("Could not find repository root.");
  }
}
