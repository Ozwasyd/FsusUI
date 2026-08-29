using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;
using System.Windows.Input;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusNotificationHeadlessTests
{
  public static IEnumerable<object[]> ThemeVariants()
  {
    yield return new object[] { nameof(ThemeVariant.Light) };
    yield return new object[] { nameof(ThemeVariant.Dark) };
  }

  [AvaloniaTheory]
  [MemberData(nameof(ThemeVariants))]
  public void NotificationShowsTitleAndMessageWithoutConsumerComposition(string themeName)
  {
    var (window, _, service) = CreateStyledService(themeName);

    var handle = service.ShowAsync(new FsusNotificationOptions
    {
      Title = "Storage almost full",
      Message = "Free up space to keep syncing.",
    }).AsTask().GetAwaiter().GetResult();

    Assert.NotNull(handle);
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();

    var notification = handle!.Control;
    var title = RequirePart<TextBlock>(notification, "PART_TitleText");
    var message = RequirePart<TextBlock>(notification, "PART_MessageText");
    Assert.Equal("Storage almost full", title.Text);
    Assert.True(title.IsVisible);
    Assert.Equal("Free up space to keep syncing.", message.Text);
    Assert.True(message.IsVisible);
    Assert.Equal("Storage almost full", AutomationProperties.GetName(notification));
    Assert.False(RequirePart<FsusButton>(notification, "PART_ActionButton").IsVisible);

    window.Close();
  }

  [AvaloniaFact]
  public async Task ActionActivationIsDistinctFromDismissalForPointerAndKeyboard()
  {
    var (window, host, service) = CreateStyledService(nameof(ThemeVariant.Light));
    var commandExecuted = 0;
    var actionActivated = 0;

    var handle = await service.ShowAsync(new FsusNotificationOptions
    {
      Title = "Update available",
      Message = "Version 2.0 is ready to install.",
      ActionLabel = "Install",
      ActionCommand = new TestCommand(_ => commandExecuted++),
    });
    Assert.NotNull(handle);
    var notification = handle!.Control;
    notification.ActionActivated += (_, _) => actionActivated++;
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();

    var actionButton = RequirePart<FsusButton>(notification, "PART_ActionButton");
    Assert.True(actionButton.IsVisible);
    Assert.Equal("Install", AutomationProperties.GetName(actionButton));

    ClickCenter(window, actionButton);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(1, commandExecuted);
    Assert.Equal(1, actionActivated);
    Assert.False(handle.IsClosed);
    Assert.Single(host.OpenOverlays);

    // Keyboard activation of the action runs the same path.
    Assert.True(actionButton.Focus());
    window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(2, commandExecuted);
    Assert.Equal(2, actionActivated);
    Assert.False(handle.IsClosed);

    window.Close();
  }

  [AvaloniaFact]
  public async Task DismissControlClosesWithoutInvokingAction()
  {
    var (window, _, service) = CreateStyledService(nameof(ThemeVariant.Light));
    var commandExecuted = 0;

    var handle = await service.ShowAsync(new FsusNotificationOptions
    {
      Title = "Warning",
      Message = "Unsaved changes",
      ActionLabel = "Review",
      ActionCommand = new TestCommand(_ => commandExecuted++),
    });
    Assert.NotNull(handle);
    var notification = handle!.Control;
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();

    var dismissButton = RequirePart<Button>(notification, "PART_DismissButton");
    Assert.Equal("Dismiss", AutomationProperties.GetName(dismissButton));
    ClickCenter(window, dismissButton);
    Dispatcher.UIThread.RunJobs();

    Assert.True(handle.IsClosed);
    Assert.Equal(0, commandExecuted);
    Assert.True(notification.IsClosed);

    window.Close();
  }

  [AvaloniaFact]
  public async Task TimeoutClosesWithoutInvokingAction()
  {
    var (window, _, service) = CreateStyledService(nameof(ThemeVariant.Light));
    var commandExecuted = 0;

    var handle = await service.ShowAsync(new FsusNotificationOptions
    {
      Title = "Sync complete",
      Message = "All files are up to date.",
      Duration = TimeSpan.FromMilliseconds(50),
      ActionLabel = "Details",
      ActionCommand = new TestCommand(_ => commandExecuted++),
    });
    Assert.NotNull(handle);
    var notification = handle!.Control;
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();
    Assert.False(handle.IsClosed);

    await Task.Delay(300);
    Dispatcher.UIThread.RunJobs();

    Assert.True(handle.IsClosed);
    Assert.True(notification.IsClosed);
    Assert.Equal(0, commandExecuted);

    window.Close();
  }

  [AvaloniaFact]
  public async Task CloseOnClickDismissesSurfaceWithoutInvokingAction()
  {
    var (window, _, service) = CreateStyledService(nameof(ThemeVariant.Light));
    var commandExecuted = 0;

    var handle = await service.ShowAsync(new FsusNotificationOptions
    {
      Title = "Invitation",
      Message = "Someone shared a folder with you.",
      CloseOnClick = true,
      ActionLabel = "Open",
      ActionCommand = new TestCommand(_ => commandExecuted++),
    });
    Assert.NotNull(handle);
    var notification = handle!.Control;
    window.UpdateLayout();
    Dispatcher.UIThread.RunJobs();
    var message = RequirePart<TextBlock>(notification, "PART_MessageText");

    ClickCenter(window, message);
    Dispatcher.UIThread.RunJobs();

    Assert.True(handle.IsClosed);
    Assert.Equal(0, commandExecuted);

    window.Close();
  }

  private static (Window Window, FsusOverlayHost Host, FsusNotificationService Service)
    CreateStyledService(string themeName)
  {
    var window = new Window
    {
      Width = 600,
      Height = 480,
      ShowInTaskbar = false,
      RequestedThemeVariant = themeName == nameof(ThemeVariant.Dark)
        ? ThemeVariant.Dark
        : ThemeVariant.Light,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    var host = new FsusOverlayHost();
    window.Content = host;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    return (window, host, new FsusNotificationService(host));
  }

  private static void ClickCenter(Window window, Control control)
  {
    var center = control.TransformToVisual(window)!.Value.Transform(new Point());
    var offset = new Point(control.Bounds.Width / 2, control.Bounds.Height / 2);
    window.MouseDown(center + offset, MouseButton.Left);
    window.MouseUp(center + offset, MouseButton.Left);
    Dispatcher.UIThread.RunJobs();
  }

  private static T RequirePart<T>(Control control, string name)
    where T : Control
  {
    var part = control
      .GetVisualDescendants()
      .OfType<T>()
      .SingleOrDefault(candidate => candidate.Name == name);
    return Assert.IsType<T>(part);
  }

  private sealed class TestCommand(Action<object?> execute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;

    public void Execute(object? parameter) => execute(parameter);
  }
}
