using Avalonia.Automation;
using Avalonia.Automation.Peers;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusDisplayPrimitiveTests
{
  [Fact]
  public void DisplayPrimitivesExposeIssue150StateAndAutomationMetadata()
  {
    var card = new FsusCard
    {
      Title = "Quarterly report",
      Description = "Revenue and retention summary",
      IconContent = "chart",
      ActionContent = "Open report",
      IsSelected = true,
      Variant = FsusComponentVariant.Primary,
    };

    Assert.Contains("fsus-card", card.Classes);
    Assert.Contains("fsus-selected", card.Classes);
    Assert.Contains("fsus-primary", card.Classes);
    Assert.Equal("Quarterly report", AutomationProperties.GetName(card));
    Assert.Equal("selected", AutomationProperties.GetItemStatus(card));
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(card));

    var progress = new FsusProgress
    {
      AccessibleName = "Upload progress",
      Minimum = 0,
      Maximum = 100,
      Value = 42,
      ShowText = true,
      Variant = FsusComponentVariant.Success,
    };

    Assert.Contains("fsus-progress", progress.Classes);
    Assert.Contains("fsus-success", progress.Classes);
    Assert.Equal("42%", progress.ProgressText);
    Assert.Equal("Upload progress", AutomationProperties.GetName(progress));
    Assert.Equal("42%", AutomationProperties.GetItemStatus(progress));
    Assert.Equal(AutomationControlType.ProgressBar, AutomationProperties.GetControlTypeOverride(progress));

    var skeleton = new FsusSkeleton
    {
      LineCount = 3,
      AnimationPolicy = FsusSkeletonAnimationPolicy.Reduced,
    };

    Assert.Contains("fsus-skeleton", skeleton.Classes);
    Assert.Contains("fsus-motion-reduced", skeleton.Classes);
    Assert.DoesNotContain("fsus-animated", skeleton.Classes);
    Assert.False(skeleton.IsAnimationActive);

    var empty = new FsusEmpty
    {
      Title = "No invoices",
      Description = "Create the first invoice to start collection.",
      ActionContent = "Create invoice",
    };

    Assert.Contains("fsus-empty", empty.Classes);
    Assert.Contains("fsus-has-action", empty.Classes);
    Assert.Equal("No invoices", AutomationProperties.GetName(empty));
    Assert.Equal("Create the first invoice to start collection.", AutomationProperties.GetHelpText(empty));
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(empty));

    var result = new FsusResult
    {
      Title = "Payment failed",
      Description = "The card issuer declined the payment.",
      ActionContent = "Retry payment",
      Variant = FsusComponentVariant.Danger,
    };

    Assert.Contains("fsus-result", result.Classes);
    Assert.Contains("fsus-danger", result.Classes);
    Assert.Contains("fsus-has-action", result.Classes);
    Assert.Equal("Payment failed", AutomationProperties.GetName(result));
    Assert.Equal("danger", AutomationProperties.GetItemStatus(result));
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(result));
  }

  [Fact]
  public void DismissAndRemoveEventsAreEmittedExactlyOnce()
  {
    var removed = 0;
    var tag = new FsusTag
    {
      Content = "Review",
      IsRemovable = true,
      IsSelected = true,
    };
    tag.Removed += (_, _) => removed++;

    tag.Remove();
    tag.Remove();

    Assert.Equal(1, removed);
    Assert.True(tag.IsRemoved);
    Assert.Contains("fsus-removed", tag.Classes);
    Assert.Equal("removed", AutomationProperties.GetItemStatus(tag));

    var ignoredRemoves = 0;
    var lockedTag = new FsusTag { Content = "Locked", IsRemovable = false };
    lockedTag.Removed += (_, _) => ignoredRemoves++;

    lockedTag.Remove();

    Assert.Equal(0, ignoredRemoves);
    Assert.False(lockedTag.IsRemoved);

    var dismissed = 0;
    var alert = new FsusAlert
    {
      Title = "Connection lost",
      Description = "Changes will retry automatically.",
      IsDismissible = true,
      Variant = FsusComponentVariant.Warning,
    };
    alert.Dismissed += (_, _) => dismissed++;

    alert.Dismiss();
    alert.Dismiss();

    Assert.Equal(1, dismissed);
    Assert.True(alert.IsDismissed);
    Assert.Contains("fsus-dismissed", alert.Classes);
    Assert.Equal("dismissed", AutomationProperties.GetItemStatus(alert));

    var ignoredDismissals = 0;
    var lockedAlert = new FsusAlert { Title = "Always visible", IsDismissible = false };
    lockedAlert.Dismissed += (_, _) => ignoredDismissals++;

    lockedAlert.Dismiss();

    Assert.Equal(0, ignoredDismissals);
    Assert.False(lockedAlert.IsDismissed);
  }

  [Fact]
  public void DisplayPrimitiveThemeStylesAreTokenBackedAndCoverModes()
  {
    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Card.axaml", theme);
    Assert.Contains("Controls/Feedback.axaml", theme);
    Assert.Contains("Controls/Display.axaml", theme);

    var card = ReadControlTheme("Card.axaml");
    Assert.Contains("Property=\"Template\"", card);
    Assert.Contains("FsusComponentDialogPadding", card);
    Assert.Contains("FsusRadiusSurfaceMd", card);
    Assert.DoesNotContain("Value=\"16\"", card);

    var feedback = ReadControlTheme("Feedback.axaml");
    Assert.Contains("Property=\"Template\"", feedback);
    Assert.Contains("FsusDensityControlCompactY", feedback);
    Assert.Contains("FsusColorActionPrimaryBrush", feedback);
    Assert.Contains("FsusThemeDangerBrush", feedback);
    Assert.DoesNotContain("Value=\"White\"", feedback);
    Assert.DoesNotContain("Value=\"8,4\"", feedback);

    var display = ReadControlTheme("Display.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusProgress",
      "fsus|FsusSkeleton",
      "fsus|FsusEmpty",
      "fsus|FsusResult",
    })
    {
      Assert.Contains(selector, display);
    }

    Assert.Contains("Property=\"Template\"", display);
    Assert.Contains("FsusMotionDurationEffective", display);
    Assert.Contains("FsusDensityControlDefaultY", display);
    Assert.Contains("FsusThemeSurfaceBrush", display);
    Assert.DoesNotContain("Value=\"White\"", display);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
