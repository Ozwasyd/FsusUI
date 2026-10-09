using System;
using System.Collections;
using System.Reflection;
using Avalonia.Media.Fonts;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using Avalonia;
using Avalonia.Media;
using Avalonia.Platform;
using FsusUI.Avalonia.HeadlessTests;

public static class CollectionProbe
{
  public static void Main()
  {
    TestAppBuilder.BuildAvaloniaApp().SetupWithoutStarting();
    using var owner = new GoogleSansFontCollection();
    var collection = owner.Collection;
    var assets = AssetLoader.GetAssets(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests/Assets/Fonts/"), null)
      .Select(uri => uri.AbsoluteUri).OrderBy(uri => uri).ToArray();
    var regular = collection.TryGetGlyphTypeface("Noto Sans", FontStyle.Normal,
      FontWeight.Normal, FontStretch.Normal, out var regularTypeface);
    var bold = collection.TryGetGlyphTypeface("Noto Sans", FontStyle.Normal,
      FontWeight.Bold, FontStretch.Normal, out var boldTypeface);
    var matched = collection.TryMatchCharacter('A', FontStyle.Normal,
      FontWeight.Normal, FontStretch.Normal, null, CultureInfo.InvariantCulture,
      out var characterTypeface);
    var registered = ((IEnumerable)typeof(FontManager)
      .GetField("_fontCollections", BindingFlags.Instance | BindingFlags.NonPublic)
      .GetValue(FontManager.Current)).Cast<object>()
      .Select(entry => entry.GetType().GetProperty("Value").GetValue(entry))
      .OfType<IFontCollection>()
      .Where(item => item.Key.AbsoluteUri.StartsWith("fonts:GoogleSans", StringComparison.Ordinal))
      .Select(item => new
      {
        key = item.Key.AbsoluteUri,
        count = item.Count,
        families = item.Select(family => family.Name).ToArray(),
      }).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(new
    {
      gsans = Environment.GetEnvironmentVariable("FSUS_HEADLESS_GSANS"),
      registeredSharedCollections = registered,
      collectionKey = collection.Key.AbsoluteUri,
      count = collection.Count,
      families = collection.Select(family => family.Name).ToArray(),
      sharedPrefixAssets = assets,
      notoRegularAvailable = regular,
      notoBoldAvailable = bold,
      matchesLatinA = matched,
      latinAFamily = matched ? characterTypeface.FontFamily.Name : null,
      latinAKey = matched ? characterTypeface.FontFamily.Key?.ToString() : null,
    }, new JsonSerializerOptions { WriteIndented = true }));
  }
}
