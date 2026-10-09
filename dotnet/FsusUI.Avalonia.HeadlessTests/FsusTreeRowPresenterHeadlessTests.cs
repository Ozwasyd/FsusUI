using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Layout;
using Avalonia.LogicalTree;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeRowPresenterHeadlessTests
{
  private const string CandidateEnvironmentVariable = "FSUS_ISSUE_813_CANDIDATE_SHA";

  [AvaloniaFact]
  public void CustomWorkspaceRowsRenderAtThirtyDipWithoutChangingDefaultRows()
  {
    EnsureFullTheme();
    var outputRoot = Environment.GetEnvironmentVariable("FSUS_ISSUE_813_EVIDENCE_ROOT")
      ?? Path.Combine(AppContext.BaseDirectory, "TestResults", "issue-813-tree-row-presenter");
    Directory.CreateDirectory(outputRoot);
    var captures = new List<object>();

    foreach (var (theme, zoom) in new[]
    {
      (FsusThemeVariant.Light, 100),
      (FsusThemeVariant.Dark, 200),
    })
    {
      var fixture = CreateEvidenceFixture(theme);
      fixture.Window.Show();
      fixture.CustomTree.Expand("src");
      fixture.DefaultTree.Expand("src");
      fixture.CustomTree.ToggleSelection("notes");
      fixture.CustomTree.FocusNode("editor");
      Dispatcher.UIThread.RunJobs();
      Arrange(fixture.Root);
      Dispatcher.UIThread.RunJobs();

      Assert.DoesNotContain("editor", fixture.CustomTree.SelectedKeys);
      Assert.Contains("notes", fixture.CustomTree.SelectedKeys);
      Assert.Equal("editor", fixture.CustomTree.FocusedKey);

      var customRows = GetRows(fixture.CustomTree);
      Assert.Equal(4, customRows.Length);
      Assert.All(customRows, row => Assert.Equal(30, row.MinHeight));
      Assert.All(customRows, row => Assert.Equal(new Thickness(6, 0), row.Padding));

      var editorContent = Assert.IsType<Grid>(FindRow(fixture.CustomTree, "editor").Child);
      Assert.Contains("workspace-current-file", editorContent.Classes);
      Assert.Contains(
        editorContent.GetLogicalDescendants().OfType<FsusText>(),
        text => text.Text == "CURRENT");
      Assert.Contains(
        editorContent.GetLogicalDescendants().OfType<FsusText>(),
        text => text.Text == "•" && text.AccessibleName == "Modified");
      Assert.Contains(
        editorContent.GetLogicalDescendants().OfType<FsusIcon>(),
        icon => icon.IconKey == FsusFileTypeIcon.Resolve("EditorView.axaml"));

      var notesContent = Assert.IsType<Grid>(FindRow(fixture.CustomTree, "notes").Child);
      Assert.DoesNotContain("workspace-current-file", notesContent.Classes);
      Assert.Contains("fsus-selected", FindRow(fixture.CustomTree, "notes").Classes);
      Assert.Contains(
        notesContent.GetLogicalDescendants().OfType<FsusIcon>(),
        icon => icon.IconKey == FsusIconKeys.FileMarkdown);

      var defaultRows = GetRows(fixture.DefaultTree);
      Assert.Equal(4, defaultRows.Length);
      Assert.All(defaultRows, row => Assert.True(row.MinHeight > 30));
      Assert.All(defaultRows, row =>
      {
        var label = Assert.IsType<FsusTreeDefaultLabel>(row.Child);
        Assert.IsAssignableFrom<TextBlock>(label);
        Assert.Equal(typeof(TextBlock), label.StyleKey);
        Assert.Equal(VerticalAlignment.Center, label.VerticalAlignment);
        Assert.Equal(TextTrimming.CharacterEllipsis, label.TextTrimming);
        Assert.True(label.IsMeasureValid);
        Assert.True(label.Bounds.Height > 0);
        Assert.Equal(AutomationControlType.TreeItem, AutomationProperties.GetControlTypeOverride(row));
      });

      Assert.Equal(2, AutomationProperties.GetPositionInSet(FindRow(fixture.CustomTree, "notes")));
      Assert.Equal(2, AutomationProperties.GetSizeOfSet(FindRow(fixture.CustomTree, "notes")));
      Assert.Equal("notes.md", AutomationProperties.GetName(FindRow(fixture.CustomTree, "notes")));

      var name = $"tree-row-presenter-{theme.ToString().ToLowerInvariant()}-compact-zoom-{zoom}.png";
      var path = Path.Combine(outputRoot, name);
      var scale = zoom / 100d;
      using (var bitmap = new RenderTargetBitmap(
        new PixelSize((int)(960 * scale), (int)(480 * scale)),
        new Vector(96 * scale, 96 * scale)))
      {
        bitmap.Render(fixture.Root);
        using var stream = File.Create(path);
        bitmap.Save(stream);
      }

      captures.Add(new
      {
        path = HeadlessVisualEvidenceOutput.RecordPath(FindRepositoryRoot(), path),
        theme = theme.ToString().ToLowerInvariant(),
        density = "compact",
        zoomPercent = zoom,
        sha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(path))),
        customRowMinHeight = customRows[0].MinHeight,
        defaultRowMinHeight = defaultRows[0].MinHeight,
        selectedKey = "notes",
        currentFileKey = "editor",
        focusedKey = fixture.CustomTree.FocusedKey,
        currentAndSelectedAreIndependent = true,
      });
      fixture.Window.Close();
    }

    File.WriteAllText(
      Path.Combine(outputRoot, "manifest.json"),
      JsonSerializer.Serialize(new
      {
        schemaVersion = 1,
        candidateSha = Environment.GetEnvironmentVariable(CandidateEnvironmentVariable)
          ?? "working-tree-candidate",
        evidenceClass = "local-headless-skia",
        productionFixture = true,
        limitation = "Avalonia Headless Skia rendering; no physical display or screen-reader session claim.",
        motionMode = "reduced",
        states = new[]
        {
          "default-presenter",
          "custom-workspace-presenter",
          "30-dip-row",
          "file-type-icon",
          "truncated-name",
          "dirty-indicator",
          "independent-current-file",
          "independent-selection",
        },
        captures,
      }, new JsonSerializerOptions { WriteIndented = true }) + "\n");

    Assert.Equal(2, captures.Count);
  }

  private static EvidenceFixture CreateEvidenceFixture(FsusThemeVariant theme)
  {
    ApplyTheme(theme);
    var customTree = CreateTree(useCustomPresenter: true);
    var defaultTree = CreateTree(useCustomPresenter: false);
    var root = new Grid
    {
      Width = 960,
      Height = 480,
      Margin = new Thickness(28),
      ColumnDefinitions = new ColumnDefinitions("*,*"),
      ColumnSpacing = 28,
    };

    var customColumn = CreateColumn("Consumer workspace presenter", customTree);
    var defaultColumn = CreateColumn("Default presenter", defaultTree);
    Grid.SetColumn(defaultColumn, 1);
    root.Children.Add(customColumn);
    root.Children.Add(defaultColumn);

    var window = new Window
    {
      Width = 960,
      Height = 480,
      Content = root,
      ShowInTaskbar = false,
    };
    ConfigureWindow(window, theme);
    return new EvidenceFixture(window, root, customTree, defaultTree);
  }

  private static Control CreateColumn(string heading, FsusTree tree) => new Grid
  {
    RowDefinitions = new RowDefinitions("Auto,*"),
    RowSpacing = 16,
    Children =
    {
      new TextBlock
      {
        Text = heading,
        FontSize = 18,
        FontWeight = FontWeight.SemiBold,
      },
      PlaceInSecondRow(tree),
    },
  };

  private static Control PlaceInSecondRow(Control control)
  {
    Grid.SetRow(control, 1);
    return control;
  }

  private static FsusTree CreateTree(bool useCustomPresenter)
  {
    var tree = new FsusTree
    {
      AccessibleName = useCustomPresenter ? "Workspace files custom presenter" : "Workspace files default presenter",
      SelectionMode = FsusTreeSelectionMode.Single,
    };
    if (useCustomPresenter)
    {
      tree.RowMinHeight = 30;
      tree.RowPadding = new Thickness(6, 0);
      tree.RowPresenter = BuildWorkspaceRow;
    }

    var source = new FsusTreeNode("src", "src")
    {
      Payload = new WorkspaceMetadata("src", IsDirectory: true, IsCurrent: false, IsDirty: false),
    };
    source.Children.Add(new FsusTreeNode("editor", "EditorView.axaml")
    {
      Payload = new WorkspaceMetadata("EditorView.axaml", IsDirectory: false, IsCurrent: true, IsDirty: true),
    });
    source.Children.Add(new FsusTreeNode("notes", "notes.md")
    {
      Payload = new WorkspaceMetadata("notes.md", IsDirectory: false, IsCurrent: false, IsDirty: false),
    });
    tree.Nodes.Add(source);
    tree.Nodes.Add(new FsusTreeNode("readme", "README.md")
    {
      Payload = new WorkspaceMetadata("README.md", IsDirectory: false, IsCurrent: false, IsDirty: false),
    });
    tree.RefreshView();
    return tree;
  }

  private static Control BuildWorkspaceRow(FsusTreeRowContext context)
  {
    var metadata = Assert.IsType<WorkspaceMetadata>(context.Payload);
    var row = new Grid
    {
      ColumnDefinitions = new ColumnDefinitions("16,18,*,Auto,Auto"),
      ColumnSpacing = 5,
      VerticalAlignment = VerticalAlignment.Center,
    };
    row.Classes.Set("workspace-current-file", metadata.IsCurrent);

    var disclosure = new FsusText
    {
      Text = context.IsExpandable ? (context.IsExpanded ? "▾" : "▸") : string.Empty,
      Variant = FsusTextVariant.Muted,
      HorizontalAlignment = HorizontalAlignment.Center,
      VerticalAlignment = VerticalAlignment.Center,
    };
    row.Children.Add(disclosure);

    var icon = new FsusIcon
    {
      IconKey = metadata.IsDirectory ? FsusIconKeys.Folder : FsusFileTypeIcon.Resolve(metadata.Path),
      Width = 16,
      Height = 16,
      VerticalAlignment = VerticalAlignment.Center,
    };
    Grid.SetColumn(icon, 1);
    row.Children.Add(icon);

    var label = new FsusText
    {
      Text = context.Node.Label,
      Variant = metadata.IsCurrent ? FsusTextVariant.Strong : FsusTextVariant.Body,
      IsTruncated = true,
      VerticalAlignment = VerticalAlignment.Center,
    };
    Grid.SetColumn(label, 2);
    row.Children.Add(label);

    if (metadata.IsDirty)
    {
      var dirty = new FsusText
      {
        Text = "•",
        AccessibleName = "Modified",
        Variant = FsusTextVariant.Strong,
        VerticalAlignment = VerticalAlignment.Center,
      };
      Grid.SetColumn(dirty, 3);
      row.Children.Add(dirty);
    }

    if (metadata.IsCurrent)
    {
      var current = new FsusText
      {
        Text = "CURRENT",
        AccessibleName = "Current file",
        Variant = FsusTextVariant.Muted,
        FontSize = 10,
        VerticalAlignment = VerticalAlignment.Center,
      };
      Grid.SetColumn(current, 4);
      row.Children.Add(current);
    }

    return row;
  }

  private static Border[] GetRows(FsusTree tree) =>
    Assert.IsType<StackPanel>(tree.Content).Children.OfType<Border>().ToArray();

  private static Border FindRow(FsusTree tree, string key) =>
    GetRows(tree).Single(row => AutomationProperties.GetAutomationId(row) == $"fsus-tree-node-{key}");

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
    if (!application.Resources.MergedDictionaries.OfType<ResourceInclude>().Any(resource =>
      resource.Source?.ToString().EndsWith("/Generated/FsusIcons.axaml", StringComparison.Ordinal) == true))
    {
      application.Resources.MergedDictionaries.Add(new ResourceInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
      });
    }
  }

  private static void ApplyTheme(FsusThemeVariant theme)
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    new FsusThemeManager().Apply(application, new FsusThemeOptions
    {
      Variant = theme,
      Density = FsusDensity.Compact,
      MotionMode = FsusMotionMode.Reduced,
    });
  }

  private static void ConfigureWindow(Window window, FsusThemeVariant theme)
  {
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Resources.MergedDictionaries.Add(new ResourceInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
    });
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      Variant = theme,
      Density = FsusDensity.Compact,
      MotionMode = FsusMotionMode.Reduced,
    });
  }

  private static void Arrange(Control control)
  {
    control.InvalidateMeasure();
    control.InvalidateArrange();
    control.Measure(new Size(960, 480));
    control.Arrange(new Rect(0, 0, 960, 480));
    AvaloniaHeadlessPlatform.ForceRenderTimerTick();
  }

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }
    throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");
  }

  private sealed record WorkspaceMetadata(
    string Path,
    bool IsDirectory,
    bool IsCurrent,
    bool IsDirty);

  private sealed record EvidenceFixture(
    Window Window,
    Grid Root,
    FsusTree CustomTree,
    FsusTree DefaultTree);
}
