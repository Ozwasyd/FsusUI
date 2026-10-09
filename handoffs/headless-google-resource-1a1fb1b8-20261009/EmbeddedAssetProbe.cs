using System;
using System.Linq;
using System.Text.Json;
using Avalonia.Media;
using Avalonia.Platform;
using FsusUI.Avalonia.HeadlessTests;

public static class EmbeddedAssetProbe
{
  public static void Main()
  {
    TestAppBuilder.BuildAvaloniaApp().SetupWithoutStarting();
    using var owner = new GoogleSansFontCollection();
    var collection = owner.Collection;
    var shared = AssetLoader.GetAssets(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests/Assets/Fonts/"), null)
      .Select(uri => uri.AbsoluteUri).OrderBy(uri => uri).ToArray();
    var table = AssetLoader.GetAssets(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests/Assets/TableV2Fonts/"), null)
      .Select(uri => uri.AbsoluteUri).OrderBy(uri => uri).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(new
    {
      gsans = Environment.GetEnvironmentVariable("FSUS_HEADLESS_GSANS"),
      sharedFontAssetCount = shared.Length,
      sharedFontAssets = shared,
      dedicatedTableV2AssetCount = table.Length,
      dedicatedTableV2Assets = table,
      collectionKey = collection.Key.AbsoluteUri,
      collectionFamilies = collection.Select(family => family.Name).ToArray(),
      googleSans18ptRegular = collection.TryGetGlyphTypeface("Google Sans 18pt",
        FontStyle.Normal, FontWeight.Normal, FontStretch.Normal, out _),
      googleSans18ptBold = collection.TryGetGlyphTypeface("Google Sans 18pt",
        FontStyle.Normal, FontWeight.Bold, FontStretch.Normal, out _),
      sharedNoto = collection.TryGetGlyphTypeface("Noto Sans",
        FontStyle.Normal, FontWeight.Normal, FontStretch.Normal, out _),
    }, new JsonSerializerOptions { WriteIndented = true }));
  }
}
