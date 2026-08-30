using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.Themes.Fluent;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeInlineEditingHeadlessTests
{
  private const string CandidateEnvironmentVariable = "FSUS_ISSUE_697_CANDIDATE_SHA";

  [AvaloniaFact]
  public void RealInputCommitValidationCancelAndStatePreservationAreComposable()
  {
    EnsureFullTheme();
    var fixture = CreateFixture(FsusThemeVariant.Light, FsusDensity.Default);
    fixture.Window.Show();
    Arrange(fixture.Root);

    var commits = new List<FsusTreeInlineEditCommitEventArgs>();
    fixture.Tree.InlineEditCommitRequested += (_, args) =>
    {
      commits.Add(args);
      if (args.Text == "duplicate.cs")
      {
        args.ValidationError = "A sibling with this name already exists.";
      }
    };
    var canceled = new List<FsusTreeInlineEditCanceledEventArgs>();
    fixture.Tree.InlineEditCanceled += (_, args) => canceled.Add(args);
    var activations = new List<string>();
    fixture.Tree.NodeActivated += (_, args) => activations.Add(args.Key);

    Assert.True(fixture.Tree.StartCreate("draft", "src"));
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();
    Assert.Contains("src", fixture.Tree.ExpandedKeys);
    Assert.Equal("draft", fixture.Tree.FocusedKey);
    var editor = FindEditor(fixture.Tree, "draft");
    Assert.True(editor.IsFocused);
    Assert.Equal(string.Empty, editor.Text);
    Assert.DoesNotContain(fixture.Source.Children, node => node.Key == "draft");

    editor.Text = "duplicate.cs";
    fixture.Window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();
    Assert.Single(commits);
    Assert.NotNull(fixture.Tree.ActiveInlineEdit);
    editor = FindEditor(fixture.Tree, "draft");
    Assert.True(editor.IsFocused);
    Assert.Contains("fsus-invalid", editor.Classes);
    Assert.Equal(
      "A sibling with this name already exists.",
      AutomationProperties.GetHelpText(editor));
    Assert.Contains("invalid", AutomationProperties.GetItemStatus(editor));
    Assert.NotNull(ControlAutomationPeer.CreatePeerForElement(editor));
    Assert.DoesNotContain(fixture.Source.Children, node => node.Key == "draft");

    editor.Text = "WorkspaceView.axaml";
    fixture.Window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
    Arrange(fixture.Root);
    Assert.Equal(2, commits.Count);
    Assert.Null(fixture.Tree.ActiveInlineEdit);
    Assert.DoesNotContain(fixture.Source.Children, node => node.Key == "draft");

    fixture.Tree.ToggleSelection("editor");
    Assert.True(fixture.Tree.StartRename("editor", fixture.Editor.Label));
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();
    editor = FindEditor(fixture.Tree, "editor");
    Assert.True(editor.IsFocused);
    Assert.Equal(0, editor.SelectionStart);
    Assert.Equal(fixture.Editor.Label.Length, editor.SelectionEnd);
    Assert.Contains("editor", fixture.Tree.SelectedKeys);
    Assert.Contains("src", fixture.Tree.ExpandedKeys);

    fixture.Tree.RefreshView();
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();
    editor = FindEditor(fixture.Tree, "editor");
    Assert.True(editor.IsFocused);
    Assert.Equal("editor", fixture.Tree.FocusedKey);
    Assert.Contains("editor", fixture.Tree.SelectedKeys);
    Assert.Contains("src", fixture.Tree.ExpandedKeys);

    editor.Text = "Changed.axaml";
    fixture.Window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
    Arrange(fixture.Root);
    var escape = Assert.Single(canceled);
    Assert.Equal(FsusTreeInlineEditCancelReason.Escape, escape.Reason);
    Assert.Equal("editor", escape.Key);
    Assert.Equal("Changed.axaml", escape.Text);
    Assert.Equal("EditorView.axaml", fixture.Editor.Label);
    Assert.Empty(activations);

    Assert.True(fixture.Tree.StartRename("service", fixture.Service.Label));
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();
    var readmeRow = FindByAutomationId(fixture.Tree, "fsus-tree-node-readme");
    Click(fixture.Window, Center(readmeRow, fixture.Window));
    Arrange(fixture.Root);
    Assert.Equal(2, canceled.Count);
    Assert.Equal(FsusTreeInlineEditCancelReason.PointerOutside, canceled[^1].Reason);
    Assert.Equal("service", canceled[^1].Key);
    Assert.Equal("WorkspaceService.cs", fixture.Service.Label);
    Assert.DoesNotContain("readme", fixture.Tree.SelectedKeys);
    Assert.Empty(activations);
    fixture.Window.Close();
  }

  [AvaloniaFact]
  public async Task ActiveRenameSurvivesAnUnrelatedLazyLoadAndRetainsFocus()
  {
    EnsureFullTheme();
    var fixture = CreateFixture(FsusThemeVariant.Light, FsusDensity.Default);
    fixture.Window.Show();
    Arrange(fixture.Root);
    fixture.Tree.ChildrenLoader = (node, _) => ValueTask.FromResult<IReadOnlyList<FsusTreeNode>>(
      [new FsusTreeNode($"{node.Key}-child", "Loaded.cs")]);
    fixture.Lazy.HasLazyChildren = true;

    Assert.True(fixture.Tree.StartRename("readme", fixture.Readme.Label));
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();
    var editor = FindEditor(fixture.Tree, "readme");
    editor.Text = "README-local.md";
    Assert.True(await fixture.Tree.LoadChildrenAsync("lazy"));
    Arrange(fixture.Root);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal("readme", fixture.Tree.ActiveInlineEdit?.Key);
    Assert.Equal("README-local.md", fixture.Tree.ActiveInlineEdit?.Text);
    Assert.Equal("readme", fixture.Tree.FocusedKey);
    Assert.True(FindEditor(fixture.Tree, "readme").IsFocused);
    Assert.Equal("README.md", fixture.Readme.Label);
    fixture.Window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersRenameCreateValidationAndAutomationEvidence()
  {
    EnsureFullTheme();
    var outputRoot = Environment.GetEnvironmentVariable("FSUS_ISSUE_697_EVIDENCE_ROOT")
      ?? Path.Combine(AppContext.BaseDirectory, "TestResults", "issue-697-inline-edit");
    Directory.CreateDirectory(outputRoot);
    var captures = new List<object>();

    foreach (var (theme, density, zoom) in new[]
    {
      (FsusThemeVariant.Light, FsusDensity.Default, 100),
      (FsusThemeVariant.Dark, FsusDensity.Spacious, 200),
    })
    {
      var fixture = CreateEvidenceFixture(theme, density);
      fixture.Window.Show();
      Arrange(fixture.Root);
      fixture.Trees[0].Expand("src");
      fixture.Trees[0].ToggleSelection("editor");
      Assert.True(fixture.Trees[0].StartRename("editor", "EditorView.axaml"));
      Assert.True(fixture.Trees[1].StartCreate("draft", "src"));
      Assert.True(fixture.Trees[2].StartCreate("duplicate", "src"));
      fixture.Trees[2].InlineEditCommitRequested += (_, args) =>
        args.ValidationError = "A sibling with this name already exists.";
      FindEditor(fixture.Trees[2], "duplicate").Text = "EditorView.axaml";
      Assert.False(fixture.Trees[2].CommitInlineEdit());
      Dispatcher.UIThread.RunJobs();
      Arrange(fixture.Root);

      var editors = fixture.Root.GetLogicalDescendants().OfType<TextBox>().ToArray();
      Assert.Equal(3, editors.Length);
      Assert.Contains(editors, editor => editor.Classes.Contains("fsus-invalid"));
      Assert.Contains(editors, editor => editor.Text == "EditorView.axaml");
      Assert.All(editors, editor =>
      {
        Assert.False(string.IsNullOrWhiteSpace(AutomationProperties.GetName(editor)));
        Assert.NotNull(ControlAutomationPeer.CreatePeerForElement(editor));
      });

      var name = $"tree-inline-edit-{theme.ToString().ToLowerInvariant()}-{density.ToString().ToLowerInvariant()}-zoom-{zoom}.png";
      var path = Path.Combine(outputRoot, name);
      var scale = zoom / 100d;
      using (var bitmap = new RenderTargetBitmap(
        new PixelSize((int)(960 * scale), (int)(560 * scale)),
        new Vector(96 * scale, 96 * scale)))
      {
        bitmap.Render(fixture.Root);
        using var stream = File.Create(path);
        bitmap.Save(stream);
      }

      captures.Add(new
      {
        path,
        theme = theme.ToString().ToLowerInvariant(),
        density = density.ToString().ToLowerInvariant(),
        zoomPercent = zoom,
        sha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(path))),
        editors = editors.Select(editor => new
        {
          id = AutomationProperties.GetAutomationId(editor),
          name = AutomationProperties.GetName(editor),
          status = AutomationProperties.GetItemStatus(editor),
          help = AutomationProperties.GetHelpText(editor),
          invalid = editor.Classes.Contains("fsus-invalid"),
          text = editor.Text,
          focused = editor.IsFocused,
          selectionStart = editor.SelectionStart,
          selectionEnd = editor.SelectionEnd,
          presenters = editor.GetVisualDescendants().OfType<TextPresenter>().Select(presenter => new
          {
            text = presenter.Text,
            foreground = presenter.Foreground?.ToString(),
            bounds = presenter.Bounds,
          }).ToArray(),
        }).ToArray(),
      });
      fixture.Window.Close();
    }

    var manifest = new
    {
      schemaVersion = 1,
      candidateSha = Environment.GetEnvironmentVariable(CandidateEnvironmentVariable)
        ?? "working-tree-candidate",
      evidenceClass = "local-headless-skia-and-input-simulation",
      productionFixture = true,
      limitation = "Avalonia Headless Skia and automation-property inspection; no claim of a physical screen reader session.",
      motionMode = "reduced",
      states = new[] { "rename-selected-name", "create-empty-row", "validation-error" },
      captures,
    };
    File.WriteAllText(
      Path.Combine(outputRoot, "manifest.json"),
      JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }) + "\n");
    Assert.Equal(2, captures.Count);
  }

  private static Fixture CreateFixture(FsusThemeVariant theme, FsusDensity density)
  {
    ApplyTheme(theme, density);
    var tree = CreateTree(out var source, out var editor, out var service, out var readme, out var lazy);
    var outside = new Button { Content = "Outside target", HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Right };
    var root = new Grid
    {
      Width = 960,
      Height = 560,
      Margin = new Thickness(24),
      RowDefinitions = new RowDefinitions("Auto,*"),
    };
    root.Children.Add(outside);
    Grid.SetRow(tree, 1);
    root.Children.Add(tree);
    var window = new Window { Width = 960, Height = 560, Content = root, ShowInTaskbar = false };
    ConfigureWindow(window, theme, density);
    return new Fixture(window, root, tree, source, editor, service, readme, lazy);
  }

  private static EvidenceFixture CreateEvidenceFixture(FsusThemeVariant theme, FsusDensity density)
  {
    ApplyTheme(theme, density);
    var trees = new List<FsusTree>();
    var root = new Grid
    {
      Width = 960,
      Height = 560,
      Margin = new Thickness(28),
      ColumnDefinitions = new ColumnDefinitions("*,*,*"),
      ColumnSpacing = 24,
    };
    var headings = new[] { "Rename", "New file", "Validation" };
    for (var index = 0; index < 3; index++)
    {
      var tree = CreateTree(out _, out _, out _, out _, out _);
      trees.Add(tree);
      tree.Margin = new Thickness(0, 44, 0, 0);
      Grid.SetColumn(tree, index);
      root.Children.Add(tree);
      var heading = new TextBlock
      {
        Text = headings[index],
        FontSize = 18,
        FontWeight = FontWeight.SemiBold,
      };
      Grid.SetColumn(heading, index);
      root.Children.Add(heading);
    }
    var window = new Window { Width = 960, Height = 560, Content = root, ShowInTaskbar = false };
    ConfigureWindow(window, theme, density);
    return new EvidenceFixture(window, root, trees);
  }

  private static FsusTree CreateTree(
    out FsusTreeNode source,
    out FsusTreeNode editor,
    out FsusTreeNode service,
    out FsusTreeNode readme,
    out FsusTreeNode lazy)
  {
    var tree = new FsusTree
    {
      AccessibleName = "Workspace files",
      SelectionMode = FsusTreeSelectionMode.Single,
    };
    source = new FsusTreeNode("src", "src");
    editor = new FsusTreeNode("editor", "EditorView.axaml");
    service = new FsusTreeNode("service", "WorkspaceService.cs");
    readme = new FsusTreeNode("readme", "README.md");
    lazy = new FsusTreeNode("lazy", "Generated") { HasLazyChildren = true };
    source.Children.Add(editor);
    source.Children.Add(service);
    tree.Nodes.Add(source);
    tree.Nodes.Add(readme);
    tree.Nodes.Add(lazy);
    tree.RefreshView();
    return tree;
  }

  private static void EnsureFullTheme()
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    if (!application.Styles.OfType<StyleInclude>().Any(style =>
      style.Source?.ToString().EndsWith("/Themes/FsusTheme.axaml", StringComparison.Ordinal) == true))
    {
      application.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    }
  }

  private static void ApplyTheme(FsusThemeVariant theme, FsusDensity density)
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    new FsusThemeManager().Apply(application, new FsusThemeOptions
    {
      Variant = theme,
      Density = density,
      MotionMode = FsusMotionMode.Reduced,
    });
  }

  private static void ConfigureWindow(
    Window window,
    FsusThemeVariant theme,
    FsusDensity density)
  {
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      Variant = theme,
      Density = density,
      MotionMode = FsusMotionMode.Reduced,
    });
  }

  private static void Arrange(Control control)
  {
    control.InvalidateMeasure();
    control.InvalidateArrange();
    control.Measure(new Size(960, 560));
    control.Arrange(new Rect(0, 0, 960, 560));
    AvaloniaHeadlessPlatform.ForceRenderTimerTick();
  }

  private static TextBox FindEditor(Control root, string key) =>
    Assert.IsType<TextBox>(FindByAutomationId(root, $"fsus-tree-inline-editor-{key}"));

  private static Control FindByAutomationId(Control root, string automationId) =>
    root.GetLogicalDescendants().OfType<Control>().Single(control =>
      AutomationProperties.GetAutomationId(control) == automationId);

  private static Point Center(Control control, Visual relativeTo)
  {
    var origin = control.TranslatePoint(default, relativeTo) ?? default;
    return new Point(origin.X + Math.Max(1, control.Bounds.Width / 2), origin.Y + Math.Max(1, control.Bounds.Height / 2));
  }

  private static void Click(TopLevel window, Point point)
  {
    window.MouseMove(point);
    window.MouseDown(point, MouseButton.Left, RawInputModifiers.None);
    window.MouseUp(point, MouseButton.Left, RawInputModifiers.None);
  }

  private sealed record Fixture(
    Window Window,
    Grid Root,
    FsusTree Tree,
    FsusTreeNode Source,
    FsusTreeNode Editor,
    FsusTreeNode Service,
    FsusTreeNode Readme,
    FsusTreeNode Lazy);

  private sealed record EvidenceFixture(Window Window, Grid Root, IReadOnlyList<FsusTree> Trees);
}
