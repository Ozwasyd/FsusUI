using Avalonia.Controls;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusComponentVariant
{
  Default,
  Primary,
  Success,
  Warning,
  Danger,
  Text,
  Info,
}

public enum FsusComponentSize
{
  Sm,
  Md,
  Lg,
}

internal static class FsusComponentClasses
{
  private static readonly string[] VariantClasses =
  [
    "fsus-default",
    "fsus-primary",
    "fsus-success",
    "fsus-warning",
    "fsus-danger",
    "fsus-text",
    "fsus-info",
  ];

  private static readonly string[] SizeClasses =
  [
    "fsus-size-sm",
    "fsus-size-md",
    "fsus-size-lg",
  ];

  private static readonly string[] IconPlacementClasses =
  [
    "fsus-icon-none",
    "fsus-icon-leading",
    "fsus-icon-trailing",
    "fsus-icon-only",
  ];

  public static void SetBaseClasses(Control control, string baseClass)
  {
    Ensure(control, "fsus-control", true);
    Ensure(control, baseClass, true);
  }

  public static void SyncVariant(Control control, FsusComponentVariant variant)
  {
    var normalized = NormalizeVariant(variant);
    foreach (var className in VariantClasses)
    {
      Ensure(control, className, false);
    }

    Ensure(control, VariantClasses[(int)normalized], true);
  }

  public static void SyncSize(Control control, FsusComponentSize size)
  {
    foreach (var className in SizeClasses)
    {
      Ensure(control, className, false);
    }

    Ensure(control, SizeClasses[(int)size], true);
  }

  public static void SyncIconPlacement(
    Control control,
    FsusButtonIconPlacement placement)
  {
    foreach (var className in IconPlacementClasses)
    {
      Ensure(control, className, false);
    }

    Ensure(control, IconPlacementClasses[(int)placement], true);
  }

  public static void Ensure(Control control, string className, bool enabled)
  {
    if (enabled)
    {
      if (!control.Classes.Contains(className))
      {
        control.Classes.Add(className);
      }
    }
    else
    {
      control.Classes.Remove(className);
    }
  }

  public static string VariantName(FsusComponentVariant variant) =>
    NormalizeVariant(variant).ToString().ToLower(CultureInfo.InvariantCulture);

  public static string ResolveName(string? title, object? fallback)
  {
    if (!string.IsNullOrWhiteSpace(title))
    {
      return title!;
    }

    return fallback switch
    {
      null => string.Empty,
      string text => text,
      _ => fallback.ToString() ?? string.Empty,
    };
  }

  private static FsusComponentVariant NormalizeVariant(FsusComponentVariant variant) =>
    Enum.IsDefined(typeof(FsusComponentVariant), variant)
      ? variant
      : FsusComponentVariant.Default;
}
