using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusProductPrimitiveKeyboardHeadlessTests
{
  [AvaloniaTheory]
  [InlineData("settings")]
  [InlineData("diagnostics")]
  [InlineData("conversations")]
  public void WindowKeysReachTheProductionControlOnce(string family)
  {
    var control = Create(family);
    var window = Show(control);
    try
    {
      Assert.True(control.Focus(NavigationMethod.Tab));
      foreach (var (key, expected) in new[]
      {
        (Key.Home, "a"), (Key.Down, "b"), (Key.Right, "c"),
        (Key.Up, "b"), (Key.Left, "a"), (Key.End, "c"),
      })
      {
        Assert.True(Press(window, key));
        AssertState(control, expected);
        Assert.Same(control, window.FocusManager!.GetFocusedElement());
      }
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData("settings")]
  [InlineData("diagnostics")]
  [InlineData("conversations")]
  public void UnsupportedAndEmptyInputDoNotMutateOrConsume(string family)
  {
    var control = Create(family);
    var window = Show(control);
    try
    {
      Assert.True(control.Focus());
      foreach (var key in new[] { Key.A, Key.Enter, Key.Space, Key.Escape })
      {
        Assert.False(Press(window, key));
        AssertState(control, string.Empty);
      }

      Assert.True(Press(window, Key.End));
      AssertState(control, "c");
      Assert.False(Press(window, Key.Escape));
      AssertState(control, "c");
      Clear(control);
      Assert.False(Press(window, Key.Down));
      AssertState(control, "c");
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData("settings", false)]
  [InlineData("diagnostics", false)]
  [InlineData("conversations", false)]
  [InlineData("settings", true)]
  [InlineData("diagnostics", true)]
  [InlineData("conversations", true)]
  public void DisabledControlOrAncestorDoesNotHandleKeys(string family, bool disableAncestor)
  {
    var control = Create(family);
    var host = new ContentControl { Content = control };
    var window = Show(host);
    try
    {
      Assert.True(control.Focus());
      if (disableAncestor)
      {
        host.IsEnabled = false;
      }
      else
      {
        control.IsEnabled = false;
      }

      Assert.False(Press(window, Key.Down));
      AssertState(control, string.Empty);
      host.IsEnabled = true;
      control.IsEnabled = true;
      Assert.True(control.Focus());
      Assert.True(Press(window, Key.Home));
      AssertState(control, "a");
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData("settings")]
  [InlineData("diagnostics")]
  [InlineData("conversations")]
  public void TunnelCancellationPreventsSelectionAndCanBeRemoved(string family)
  {
    var control = Create(family);
    var window = Show(control);
    EventHandler<KeyEventArgs> cancel = (_, e) => e.Handled = true;
    try
    {
      Assert.True(control.Focus());
      window.AddHandler(InputElement.KeyDownEvent, cancel, RoutingStrategies.Tunnel);
      Assert.True(Press(window, Key.Down));
      AssertState(control, string.Empty);
      window.RemoveHandler(InputElement.KeyDownEvent, cancel);
      Assert.True(Press(window, Key.Home));
      AssertState(control, "a");
    }
    finally
    {
      window.RemoveHandler(InputElement.KeyDownEvent, cancel);
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData("settings")]
  [InlineData("diagnostics")]
  [InlineData("conversations")]
  public void HandledChildDoesNotAlsoNavigateItsParent(string family)
  {
    var parent = Create(family);
    var child = Create(family);
    parent.Content = child;
    var window = Show(parent);
    try
    {
      Assert.True(child.Focus());
      Assert.True(Press(window, Key.Home));
      Assert.True(Press(window, Key.Down));
      AssertState(child, "b");
      AssertState(parent, string.Empty);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData("settings")]
  [InlineData("diagnostics")]
  [InlineData("conversations")]
  public void ReparentingDoesNotDuplicateRoutingOrRetainTheOldWindow(string family)
  {
    var control = Create(family);
    var first = Show(control);
    var second = Show(null);
    try
    {
      for (var pass = 0; pass < 3; pass++)
      {
        first.Content = control;
        Assert.True(control.Focus());
        Assert.True(Press(first, Key.Home));
        first.Content = null;
        second.Content = control;
        Assert.True(control.Focus());
        Assert.True(Press(second, Key.Down));
        AssertState(control, "b");
        Press(first, Key.End);
        AssertState(control, "b");
        second.Content = null;
      }
    }
    finally
    {
      first.Close();
      second.Close();
    }
  }

  [AvaloniaFact]
  public void ConversationNavigationSkipsDisabledRowsAndAllDisabledIsANoOp()
  {
    var control = new FsusConversationList();
    control.Items.Add(new("a", "A", "First"));
    control.Items.Add(new("disabled", "Disabled", "Unavailable", IsDisabled: true));
    control.Items.Add(new("c", "C", "Last"));
    var window = Show(control);
    try
    {
      Assert.True(control.Focus());
      Assert.True(Press(window, Key.Home));
      Assert.True(Press(window, Key.Down));
      AssertState(control, "c");
      Assert.True(Press(window, Key.Up));
      AssertState(control, "a");
      control.Items.Clear();
      control.Items.Add(new("disabled", "Disabled", "Unavailable", IsDisabled: true));
      Assert.False(Press(window, Key.End));
      AssertState(control, "a");
    }
    finally
    {
      window.Close();
    }
  }

  private static FsusProductPrimitiveControl Create(string family)
  {
    switch (family)
    {
      case "settings":
        var settings = new FsusSettingsSectionNav();
        foreach (var key in new[] { "a", "b", "c" })
        {
          settings.Items.Add(new(key, key));
        }
        return settings;
      case "diagnostics":
        var diagnostics = new FsusDiagnosticsList();
        foreach (var key in new[] { "a", "b", "c" })
        {
          diagnostics.Items.Add(new(key, key, FsusStatusTone.Neutral));
        }
        return diagnostics;
      default:
        var conversations = new FsusConversationList();
        foreach (var key in new[] { "a", "b", "c" })
        {
          conversations.Items.Add(new(key, key, key));
        }
        return conversations;
    }
  }

  private static void Clear(FsusProductPrimitiveControl control)
  {
    switch (control)
    {
      case FsusSettingsSectionNav settings: settings.Items.Clear(); break;
      case FsusDiagnosticsList diagnostics: diagnostics.Items.Clear(); break;
      case FsusConversationList conversations: conversations.Items.Clear(); break;
    }
  }

  private static void AssertState(FsusProductPrimitiveControl control, string expected)
  {
    switch (control)
    {
      case FsusSettingsSectionNav settings:
        Assert.Equal(expected, settings.FocusedKey);
        Assert.Equal(expected, settings.SelectedKey);
        break;
      case FsusDiagnosticsList diagnostics:
        Assert.Equal(expected, diagnostics.FocusedKey);
        break;
      case FsusConversationList conversations:
        Assert.Equal(expected, conversations.FocusedKey);
        Assert.Equal(expected, conversations.SelectedKey);
        break;
    }
  }

  private static Window Show(Control? content)
  {
    var window = new Window { Content = content, Width = 480, Height = 320 };
    window.Show();
    window.UpdateLayout();
    return window;
  }

  private static bool Press(Window window, Key key)
  {
    bool? handled = null;
    EventHandler<KeyEventArgs> observe = (_, e) => handled = e.Handled;
    window.AddHandler(InputElement.KeyDownEvent, observe, RoutingStrategies.Bubble, handledEventsToo: true);
    try
    {
      window.KeyPress(key, RawInputModifiers.None, PhysicalKey.None, null);
      window.KeyRelease(key, RawInputModifiers.None, PhysicalKey.None, null);
      Dispatcher.UIThread.RunJobs();
      Assert.NotNull(handled);
      return handled.Value;
    }
    finally
    {
      window.RemoveHandler(InputElement.KeyDownEvent, observe);
    }
  }
}
