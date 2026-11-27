using Avalonia.Controls;
using Avalonia.Markup.Xaml.Styling;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

internal static class HeadlessTheme
{
  internal static StyleInclude CreateInclude() =>
    new(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    };

  internal static void Attach(Window window, FsusThemeOptions options)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, options);
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(CreateInclude());
  }
}
