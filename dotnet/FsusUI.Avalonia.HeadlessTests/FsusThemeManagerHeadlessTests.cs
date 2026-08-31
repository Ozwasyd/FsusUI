using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Demo;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusThemeManagerHeadlessTests
{
  [Fact]
  public void LiveResourceConsumerFollowsVariantPaletteSwitch()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var consumer = new Border();
    consumer.Bind(
      Border.BorderBrushProperty,
      application.Resources.GetResourceObservable(
        FsusTokens.ColorActionPrimaryBrushResourceKey
      )
    );

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Light }
    );
    Assert.Equal(
      Color.Parse("#2A599C"),
      Assert.IsType<SolidColorBrush>(consumer.BorderBrush).Color
    );

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Dark }
    );
    Assert.Equal(
      Color.Parse("#4B79CC"),
      Assert.IsType<SolidColorBrush>(consumer.BorderBrush).Color
    );
  }

  [Fact]
  public void LiveResourceConsumersFollowPaletteOverridesAndFallbackRestoration()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var background = BindBrush(application, FsusThemeResourceKeys.BackgroundBrush);
    var surface = BindBrush(application, FsusThemeResourceKeys.SurfaceBrush);
    var text = BindBrush(application, FsusThemeResourceKeys.TextBrush);
    var icon = BindBrush(application, FsusThemeResourceKeys.IconBrush);

    manager.Apply(
      application,
      FsusThemeOptions.Default with
      {
        Variant = FsusThemeVariant.Dark,
        Palette = new FsusThemePaletteOptions
        {
          Background = Brush("#102030"),
          Text = Brush("#F0E0D0"),
          Icon = Brush("#ABCDEF"),
        },
      }
    );

    AssertBrush(background, "#102030");
    AssertBrush(surface, "#171F2C");
    AssertBrush(text, "#F0E0D0");
    AssertBrush(icon, "#ABCDEF");

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Light }
    );

    AssertBrush(background, "#FFFFFF");
    AssertBrush(surface, "#FFFFFF");
    AssertBrush(text, "#111827");
    AssertBrush(icon, "#111827");
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersPaletteFallbackMatrix()
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    var manager = new FsusThemeManager();
    var themeStyles = new StyleInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    };
    application.Styles.Add(themeStyles);
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests/conformance/visual/artifacts/screenshots/avalonia");
    Directory.CreateDirectory(outputRoot);

    var cases = new[]
    {
      ("light", FsusThemeOptions.Default, "#FFFFFF", "#FFFFFF", "#FFFFFF", "#F8FAFC", "#111827", "#6B7280", "#D9DEE8", "#111827"),
      ("dark", FsusThemeOptions.Default with { Variant = FsusThemeVariant.Dark }, "#121214", "#171F2C", "#1B2433", "#1F2937", "#F0F0F4", "#B6C0CF", "#394657", "#F0F0F4"),
      ("custom", FsusThemeOptions.Default with
      {
        Palette = new FsusThemePaletteOptions
        {
          Background = Brush("#FFF4D6"),
          Surface = Brush("#E0F2FE"),
          SurfaceRaised = Brush("#DCFCE7"),
          Text = Brush("#312E81"),
          MutedText = Brush("#6D28D9"),
          Border = Brush("#BE123C"),
          Icon = Brush("#0369A1"),
        },
      }, "#FFF4D6", "#E0F2FE", "#E0F2FE", "#DCFCE7", "#312E81", "#6D28D9", "#BE123C", "#0369A1"),
      ("partial-dark", FsusThemeOptions.Default with
      {
        Variant = FsusThemeVariant.Dark,
        Palette = new FsusThemePaletteOptions
        {
          Surface = Brush("#14342B"),
          Icon = Brush("#FBBF24"),
        },
      }, "#121214", "#14342B", "#14342B", "#1F2937", "#F0F0F4", "#B6C0CF", "#394657", "#FBBF24"),
      ("highcontrast", FsusThemeOptions.Default with
      {
        HighContrast = true,
        Palette = new FsusThemePaletteOptions
        {
          Surface = Brush("#14342B"),
          SurfaceRaised = Brush("#DCFCE7"),
          Icon = Brush("#FBBF24"),
        },
      }, "#000000", "#000000", "#000000", "#111827", "#FFFFFF", "#FDE68A", "#FFFFFF", "#FFFFFF"),
    };

    try
    {
      foreach (var (
        name,
        options,
        expectedBackground,
        expectedSurface,
        expectedAliasSurface,
        expectedRaised,
        expectedText,
        expectedMutedText,
        expectedBorder,
        expectedIcon) in cases)
      {
        manager.Apply(application, options);
        RenderPalette(
          application,
          Path.Combine(outputRoot, $"issue-708-theme-{name}.png"),
          expectedBackground,
          expectedSurface,
          expectedAliasSurface,
          expectedRaised,
          expectedText,
          expectedMutedText,
          expectedBorder,
          expectedIcon);
      }
    }
    finally
    {
      application.Styles.Remove(themeStyles);
    }
  }

  private static void RenderPalette(
    Application application,
    string output,
    string expectedBackground,
    string expectedSurface,
    string expectedAliasSurface,
    string expectedRaised,
    string expectedText,
    string expectedMutedText,
    string expectedBorder,
    string expectedIcon)
  {
    const int width = 960;
    const int height = 540;
    var window = new Window { Width = width, Height = height, ShowInTaskbar = false };
    window.Resources.MergedDictionaries.Add(new ResourceInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
    });

    var textEditor = new FsusTextEditor
    {
      AccessibleName = "Native text editor",
      MinHeight = 0,
      Height = 108,
      Text = "Surface override reaches the native editor",
      Content = new FsusText { Text = "Text editor" },
    };
    var markdownEditor = new FsusMarkdownEditor
    {
      MinHeight = 0,
      Height = 108,
      Document = "# Markdown editor",
    };
    var tree = new FsusTree
    {
      AccessibleName = "Workspace tree",
      MinHeight = 0,
      Height = 160,
    };
    tree.Nodes.Add(new FsusTreeNode("docs", "docs"));
    tree.RefreshView();

    var select = new FsusSelect
    {
      AccessibleName = "Theme selector",
      MinHeight = 0,
      Height = 48,
    };
    select.Options.Add(new FsusOption
    {
      Label = "Surface palette",
      Value = "surface",
      Content = "Surface palette",
    });
    select.RefreshOptions();
    select.SelectValue("surface");

    var raisedEditor = new FsusTextEditor
    {
      AccessibleName = "Read-only raised editor",
      IsReadOnly = true,
      MinHeight = 0,
      Height = 64,
      Text = "Raised surface fallback",
      Content = new FsusText { Text = "Read-only raised surface" },
    };
    var icon = new FsusIcon
    {
      AccessibleName = "Palette icon",
      IconKey = FsusIconKeys.Folder,
      Width = 40,
      Height = 40,
    };
    var mutedText = new FsusText { Text = "Fallback", Classes = { "fsus-text-muted" } };
    var iconRow = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 12,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      Children =
      {
        icon,
        new FsusText { Text = "Icon / muted text" },
        mutedText,
      },
    };

    var grid = new Grid
    {
      ColumnDefinitions = new ColumnDefinitions("*,*"),
      RowDefinitions = new RowDefinitions("116,72,72"),
      ColumnSpacing = 12,
      RowSpacing = 8,
      Margin = new Thickness(16),
    };
    AddGridChild(grid, textEditor, 0, 0);
    AddGridChild(grid, markdownEditor, 0, 1);
    AddGridChild(grid, select, 1, 1);
    AddGridChild(grid, raisedEditor, 2, 0);
    AddGridChild(grid, iconRow, 2, 1);

    var tabs = new FsusDocumentTabs { AccessibleName = "Open Markdown documents" };
    tabs.AddDocument(new FsusDocumentTab
    {
      Key = "palette",
      Header = "theme-palette.md",
      IsDirty = true,
      Content = grid,
    });
    tabs.SelectKey("palette");

    var shell = new FsusActivityRailShell
    {
      AccessibleName = "Markdown editor workspace",
      PaneWidth = 220,
      DefaultPaneWidth = 220,
      MinPaneWidth = 180,
      MaxPaneWidth = 320,
      MainContent = tabs,
    };
    shell.Sections.Add(new FsusActivityRailSection
    {
      Key = "explorer",
      Header = "Explorer",
      Icon = new FsusIcon
      {
        AccessibleName = "Explorer",
        IconKey = FsusIconKeys.Folder,
      },
      Content = tree,
    });
    if (shell.SelectedKey == "explorer")
    {
      shell.ShowPane();
    }
    else
    {
      shell.ActivateKey("explorer");
    }

    var titleBar = new FsusNativeTitleBar
    {
      AccessibleName = "Markdown workspace title bar",
      DocumentTitle = "theme-palette.md",
      DocumentPath = "/workspace/docs/theme-palette.md",
      Status = "Saved locally",
      Platform = FsusDesktopPlatform.Linux,
    };
    var root = new Grid
    {
      RowDefinitions = new RowDefinitions("Auto,*"),
      Width = width,
      Height = height,
    };
    AddGridChild(root, titleBar, 0, 0);
    AddGridChild(root, shell, 1, 0);
    window.Content = root;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.Measure(new Size(width, height));
    window.Arrange(new Rect(0, 0, width, height));
    root.Measure(new Size(width, height));
    root.Arrange(new Rect(0, 0, width, height));
    Dispatcher.UIThread.RunJobs();

    var activityRail = shell.GetVisualDescendants()
      .OfType<Border>()
      .Single(control => control.Classes.Contains("fsus-activity-rail"));
    var contextualPane = shell.GetVisualDescendants()
      .OfType<Border>()
      .Single(control => control.Classes.Contains("fsus-contextual-pane"));
    var titlePath = titleBar.GetVisualDescendants()
      .OfType<TextBlock>()
      .Single(control => control.Classes.Contains("fsus-title-bar-path"));

    AssertControlBrush(shell.Background, expectedBackground);
    AssertControlBrush(shell.Foreground, expectedText);
    AssertControlBrush(tabs.Background, expectedBackground);
    AssertControlBrush(tabs.Foreground, expectedText);
    AssertControlBrush(activityRail.Background, expectedRaised);
    AssertControlBrush(contextualPane.Background, expectedSurface);
    AssertControlBrush(titleBar.Background, expectedRaised);
    AssertControlBrush(titleBar.Foreground, expectedText);
    AssertControlBrush(titleBar.BorderBrush, expectedBorder);
    AssertControlBrush(titlePath.Foreground, expectedMutedText);
    AssertControlBrush(textEditor.Background, expectedAliasSurface);
    AssertControlBrush(textEditor.Foreground, expectedText);
    AssertControlBrush(markdownEditor.Background, expectedAliasSurface);
    AssertControlBrush(tree.Background, expectedAliasSurface);
    AssertControlBrush(select.Background, expectedAliasSurface);
    AssertControlBrush(select.BorderBrush, expectedBorder);
    AssertControlBrush(raisedEditor.Background, expectedRaised);
    AssertControlBrush(mutedText.Foreground, expectedMutedText);
    AssertControlBrush(icon.Fill, expectedIcon);

    using var bitmap = new RenderTargetBitmap(new PixelSize(width, height), new Vector(96, 96));
    bitmap.Render(root);
    using (var stream = File.Create(output))
    {
      bitmap.Save(stream);
    }
    window.Close();
  }

  private static void AddGridChild(Grid grid, Control child, int row, int column)
  {
    Grid.SetRow(child, row);
    Grid.SetColumn(child, column);
    grid.Children.Add(child);
  }

  private static void AssertControlBrush(IBrush? brush, string color)
  {
    Assert.Equal(Color.Parse(color), Assert.IsType<SolidColorBrush>(brush).Color);
  }

  private static SolidColorBrush Brush(string color) =>
    new(Color.Parse(color));

  private static string FindRepositoryRoot()
  {
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null && !File.Exists(Path.Combine(current.FullName, "pnpm-workspace.yaml")))
    {
      current = current.Parent;
    }
    return current?.FullName ?? throw new InvalidOperationException("Repository root not found.");
  }

  private static Border BindBrush(Application application, string resourceKey)
  {
    var consumer = new Border();
    consumer.Bind(
      Border.BackgroundProperty,
      application.Resources.GetResourceObservable(resourceKey)
    );
    return consumer;
  }

  private static void AssertBrush(Border consumer, string color)
  {
    Assert.Equal(
      Color.Parse(color),
      Assert.IsType<SolidColorBrush>(consumer.Background).Color
    );
  }
}
