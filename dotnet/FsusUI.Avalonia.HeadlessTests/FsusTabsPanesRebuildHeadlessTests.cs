using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTabsPanesRebuildHeadlessTests
{
  [AvaloniaFact]
  public void ClearAndRebuildCommitsSelectionAfterItemsSourceStabilizes()
  {
    var tabs = new FsusTabs { AccessibleName = "Open documents" };
    var first = new FsusTabPane { Key = "a", Header = "A", Content = "First" };
    var second = new FsusTabPane { Key = "b", Header = "B", Content = "Second" };
    var replacement = new FsusTabPane { Key = "c", Header = "C", Content = "Replacement" };
    tabs.Panes.Add(first);
    tabs.Panes.Add(second);
    tabs.SelectedIndex = -1;

    var surface = new Border
    {
      Padding = new Thickness(24),
      Child = tabs,
    };
    var window = new Window
    {
      Width = 480,
      Height = 240,
      Content = surface,
    };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      Variant = FsusThemeVariant.Light,
      MotionMode = FsusMotionMode.Reduced,
    });
    surface.Background = Assert.IsAssignableFrom<IBrush>(
      window.Resources[FsusThemeResourceKeys.BackgroundBrush]);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    tabs.Panes.Clear();
    tabs.Panes.Add(replacement);
    tabs.SelectKey("c");
    Dispatcher.UIThread.RunJobs();

    Assert.Same(tabs.Panes, tabs.ItemsSource);
    Assert.Single(tabs.Panes);
    Assert.Same(replacement, tabs.Panes[0]);
    Assert.Equal(0, tabs.SelectedIndex);
    Assert.Same(replacement, tabs.SelectedItem);
    Assert.Equal("c", tabs.SelectedKey);
    Assert.Equal("c", tabs.FocusedKey);
    Assert.True(replacement.IsSelected);
    Assert.Contains("fsus-selected", replacement.Classes);
    Assert.Equal("selected", AutomationProperties.GetItemStatus(replacement));
    Assert.Equal(
      AutomationControlType.Tab,
      ControlAutomationPeer.CreatePeerForElement(tabs).GetAutomationControlType());
    Assert.True(tabs.IsMeasureValid);
    Assert.True(tabs.IsArrangeValid);
    Assert.True(tabs.Bounds.Width > 0);
    Assert.True(tabs.Bounds.Height > 0);

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-tabs-panes-rebuild");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "tabs-rebuilt-selected-light.png");
    using var bitmap = new RenderTargetBitmap(
      new PixelSize(480, 240),
      new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }
    Assert.True(new FileInfo(outputPath).Length > 1_000);

    window.Close();
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
}
