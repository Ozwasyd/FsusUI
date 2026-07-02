using Avalonia.Controls;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

if (args.Contains("--smoke", StringComparer.Ordinal))
{
  return PackedConsumerSmoke.Run() ? 0 : 1;
}

Console.WriteLine("Run with --smoke to validate packed package consumption.");
return 0;

public static class PackedConsumerSmoke
{
  public static bool Run()
  {
    var button = new FsusButton
    {
      Content = "Open report",
      AccessibleName = "Open report",
      Variant = FsusComponentVariant.Primary,
    };
    var input = new FsusInput { AccessibleName = "Report name", Text = "Stable" };
    var icon = new FsusIcon { IconKey = FsusIconKeys.Settings, IsDecorative = true };
    var theme = FsusThemeOptions.Default with { Density = FsusDensity.Compact };

    var panel = new StackPanel();
    panel.Children.Add(button);
    panel.Children.Add(input);
    panel.Children.Add(icon);

    return panel.Children.Count == 3 &&
      button.AccessibleName == "Open report" &&
      input.Text == "Stable" &&
      icon.IconKey == FsusIconKeys.Settings &&
      theme.Density == FsusDensity.Compact;
  }
}
