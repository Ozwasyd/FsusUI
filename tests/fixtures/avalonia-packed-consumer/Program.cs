using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Markup.Xaml;
using Avalonia.Themes.Fluent;
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
    AppBuilder.Configure<PackedConsumerApplication>()
      .UseHeadless(new AvaloniaHeadlessPlatformOptions())
      .SetupWithoutStarting();
    Application.Current!.Styles.Add(new FluentTheme());
    var button = new FsusButton
    {
      Content = "Open report",
      AccessibleName = "Open report",
      Variant = FsusComponentVariant.Primary,
    };
    var input = new FsusInput { AccessibleName = "Report name", Text = "Stable" };
    var icon = new FsusIcon { IconKey = FsusIconKeys.Settings, IsDecorative = true };
    var theme = FsusThemeOptions.Default with { Density = FsusDensity.Compact };
    var resources = new[]
    {
      new Uri("avares://FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml"),
      new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
    };
    foreach (var resource in resources)
    {
      if (AvaloniaXamlLoader.Load(resource) is null)
      {
        throw new InvalidOperationException($"Packed Avalonia resource is missing: {resource}");
      }
    }

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

public sealed class PackedConsumerApplication : Application
{
}
