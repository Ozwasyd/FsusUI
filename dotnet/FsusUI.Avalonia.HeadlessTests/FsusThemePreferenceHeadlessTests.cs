using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Styling;
using FsusUI.Avalonia.Controls;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusThemePreferenceHeadlessTests
{
  [AvaloniaFact]
  public void LocalWindowThemeOverridesApplicationPreferenceAndCanSwitchTheButton()
  {
    var application = Application.Current!;
    var originalPreference = application.RequestedThemeVariant;
    // Theme inheritance does not depend on a platform-specific font.
    var button = new FsusButton { Content = new Border { Width = 32, Height = 16 } };
    var window = new Window
    {
      Width = 1180,
      Height = 760,
      RequestedThemeVariant = ThemeVariant.Light,
      Content = new Grid { Width = 1120, Height = 700, Children = { button } },
    };
    window.Styles.Add(HeadlessTheme.CreateInclude());
    try
    {
      window.Show();
      window.UpdateLayout();
      Assert.Equal(ThemeVariant.Light, button.ActualThemeVariant);

      // The legacy performance scenario changes this application preference,
      // but its locally Light window prevents a visible control theme change.
      application.RequestedThemeVariant = ThemeVariant.Dark;
      window.UpdateLayout();
      Assert.Equal(ThemeVariant.Dark, application.ActualThemeVariant);
      Assert.Equal(ThemeVariant.Light, window.ActualThemeVariant);
      Assert.Equal(ThemeVariant.Light, button.ActualThemeVariant);
      application.RequestedThemeVariant = ThemeVariant.Light;
      window.UpdateLayout();
      Assert.Equal(ThemeVariant.Light, button.ActualThemeVariant);

      window.RequestedThemeVariant = ThemeVariant.Dark;
      window.UpdateLayout();
      Assert.Equal(ThemeVariant.Dark, window.ActualThemeVariant);
      Assert.Equal(ThemeVariant.Dark, button.ActualThemeVariant);
      window.RequestedThemeVariant = ThemeVariant.Light;
      window.UpdateLayout();
      Assert.Equal(ThemeVariant.Light, window.ActualThemeVariant);
      Assert.Equal(ThemeVariant.Light, button.ActualThemeVariant);
    }
    finally
    {
      window.Close();
      application.RequestedThemeVariant = originalPreference;
    }
  }
}
