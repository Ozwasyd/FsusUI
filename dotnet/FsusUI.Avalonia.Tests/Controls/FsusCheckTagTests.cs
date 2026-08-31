using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusCheckTagTests
{
  [Fact]
  public void CheckTagThemeUsesLayoutNeutralFocusRingAndReducedMotion()
  {
    var root = RepositoryRoot();
    var theme = File.ReadAllText(Path.Combine(
      root,
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      "CheckTag.axaml"));
    Assert.Contains("Name=\"PART_FocusRing\"", theme);
    Assert.Contains("Border#PART_FocusRing", theme);
    Assert.Contains("BorderThickness\" Value=\"2\"", theme);
    Assert.DoesNotContain("Background=\"{DynamicResource FsusThemeFocusRingBrush}\"", theme);

    var webTheme = File.ReadAllText(Path.Combine(
      root,
      "vue",
      "packages",
      "theme-chalk",
      "src",
      "check-tag.scss"));
    Assert.Contains("prefers-reduced-motion: reduce", webTheme);
    Assert.Contains("transition-duration: 1ms", webTheme);
  }

  [Fact]
  public void CheckTagSupportsKeyboardAndToggleAutomation()
  {
    var changes = new List<(bool OldChecked, bool NewChecked)>();
    var tag = new KeyboardCheckTag { Content = "Review complete" };
    tag.CheckedChanged += (_, args) =>
      changes.Add((args.OldChecked, args.NewChecked));

    tag.Press(Key.Enter);
    tag.Press(Key.Space);

    Assert.False(tag.Checked);
    Assert.Equal(new[] { (false, true), (true, false) }, changes);
    Assert.True(tag.Focusable);
    Assert.True(tag.IsTabStop);
    Assert.Equal(
      AutomationControlType.CheckBox,
      AutomationProperties.GetControlTypeOverride(tag));
    Assert.Equal("Review complete", AutomationProperties.GetName(tag));

    var toggle = Assert.IsAssignableFrom<IToggleProvider>(
      ControlAutomationPeer.CreatePeerForElement(tag));
    Assert.Equal(ToggleState.Off, toggle.ToggleState);

    toggle.Toggle();

    Assert.True(tag.Checked);
    Assert.Equal(ToggleState.On, toggle.ToggleState);
    Assert.Equal((false, true), changes[^1]);
  }

  private sealed class KeyboardCheckTag : FsusCheckTag
  {
    public void Press(Key key) => OnKeyDown(new KeyEventArgs { Key = key });
  }

  private static string RepositoryRoot()
  {
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null)
    {
      if (File.Exists(Path.Combine(current.FullName, "package.json")))
      {
        return current.FullName;
      }
      current = current.Parent;
    }
    throw new DirectoryNotFoundException("FsusUI repository root not found.");
  }
}
