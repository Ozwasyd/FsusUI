using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using FsusUI.Avalonia.Controls;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusNativeMenuMacOSAdapterTests
{
  [AvaloniaFact]
  public void AdapterMapsDeclaredRolesToNativeResponderSelectors()
  {
    var runtime = new RecordingRuntime();
    var adapter = new FsusMacOSNativeMenuAdapter(runtime);

    foreach (var role in new[]
      {
        FsusPlatformRole.Hide,
        FsusPlatformRole.HideOthers,
        FsusPlatformRole.ShowAll,
        FsusPlatformRole.WindowMinimize,
        FsusPlatformRole.WindowZoom,
        FsusPlatformRole.WindowBringAllToFront,
        FsusPlatformRole.Quit,
      })
    {
      Assert.True(adapter.TryExecuteRole(role));
    }

    Assert.Equal(
      [
        "hide:",
        "hideOtherApplications:",
        "unhideAllApplications:",
        "performMiniaturize:",
        "performZoom:",
        "arrangeInFront:",
        "terminate:",
      ],
      runtime.Selectors);
    Assert.False(adapter.TryExecuteRole(FsusPlatformRole.About));
  }

  [AvaloniaFact]
  public void BuilderBindsServicesAndRoutesEveryDeclaredNativeRole()
  {
    var adapter = new RecordingAdapter { HandlesRoles = true };
    using var builder = new FsusNativeMenuBuilder(adapter);
    var menu = builder.Build(BuildRoleTree(), FsusShortcutPlatform.macOS);

    var services = EnumerateItems(menu).Single(
      item => FsusNativeMenuMetadata.GetRole(item) ==
          FsusPlatformRole.Services &&
        item.Menu is not null);
    Assert.NotNull(services.Menu);
    Assert.Same(services.Menu, Assert.Single(adapter.ServicesMenus));

    var routedRoles = new[]
    {
      FsusPlatformRole.Hide,
      FsusPlatformRole.HideOthers,
      FsusPlatformRole.ShowAll,
      FsusPlatformRole.WindowMinimize,
      FsusPlatformRole.WindowZoom,
      FsusPlatformRole.WindowBringAllToFront,
      FsusPlatformRole.Quit,
    };
    foreach (var role in routedRoles)
    {
      var item = FindRole(menu, role);
      Assert.NotNull(item.Command);
      item.Command.Execute(null);
    }

    Assert.Equal(routedRoles, adapter.ExecutedRoles);
  }

  [AvaloniaFact]
  public void UnavailableNativeActionFallsBackToConsumerCommand()
  {
    var executed = 0;
    var hide = new FsusPlatformCommand(
      "app.hide",
      "Hide",
      FsusPlatformRole.Hide)
    {
      ExecuteAction = _ => executed++,
    };
    var roots = new[]
    {
      FsusNativeMenuItemModel.SubMenu(
        "Application",
        FsusPlatformRole.Application,
        FsusNativeMenuItemModel.Action(hide)),
    };
    var adapter = new RecordingAdapter { HandlesRoles = false };
    using var builder = new FsusNativeMenuBuilder(adapter);

    var menu = builder.Build(roots, FsusShortcutPlatform.macOS);
    FindRole(menu, FsusPlatformRole.Hide).Command!.Execute(null);

    Assert.Equal([FsusPlatformRole.Hide], adapter.ExecutedRoles);
    Assert.Equal(1, executed);
  }

  [AvaloniaFact]
  public void NonMacPlatformsNeverInvokeMacOSAdapter()
  {
    foreach (var platform in new[]
      {
        FsusShortcutPlatform.Windows,
        FsusShortcutPlatform.Linux,
      })
    {
      var adapter = new RecordingAdapter { HandlesRoles = true };
      using var builder = new FsusNativeMenuBuilder(adapter);
      var menu = builder.Build(BuildRoleTree(), platform);

      Assert.Empty(adapter.ServicesMenus);
      Assert.Empty(adapter.ExecutedRoles);
      Assert.DoesNotContain(
        EnumerateItems(menu),
        item => FsusNativeMenuMetadata.GetRole(item) is
          FsusPlatformRole.Services or
          FsusPlatformRole.Hide or
          FsusPlatformRole.HideOthers or
          FsusPlatformRole.ShowAll or
          FsusPlatformRole.WindowMinimize or
          FsusPlatformRole.WindowZoom or
          FsusPlatformRole.WindowBringAllToFront);
    }
  }

  [AvaloniaFact]
  public void AvaloniaNativeServicesMarkerContractIsResolvable()
  {
    var property =
      FsusMacOSNativeMenuRuntime.ResolveServicesMenuProperty();
    Assert.NotNull(property);

    var servicesMenu = new NativeMenu();
    servicesMenu.SetValue(property, true);
    Assert.True(servicesMenu.GetValue(property));
  }

  [AvaloniaFact]
  public void LocalAdapterSimulationProducesInspectableEvidence()
  {
    var runtime = new RecordingRuntime();
    var adapter = new FsusMacOSNativeMenuAdapter(runtime);
    using var builder = new FsusNativeMenuBuilder(adapter);
    var menu = builder.Build(BuildRoleTree(), FsusShortcutPlatform.macOS);
    var routedRoles = new[]
    {
      FsusPlatformRole.Hide,
      FsusPlatformRole.HideOthers,
      FsusPlatformRole.ShowAll,
      FsusPlatformRole.WindowMinimize,
      FsusPlatformRole.WindowZoom,
      FsusPlatformRole.WindowBringAllToFront,
      FsusPlatformRole.Quit,
    };

    foreach (var role in routedRoles)
    {
      FindRole(menu, role).Command!.Execute(null);
    }

    Assert.Single(runtime.ServicesMenus);
    Assert.Equal(
      [
        "hide:",
        "hideOtherApplications:",
        "unhideAllApplications:",
        "performMiniaturize:",
        "performZoom:",
        "arrangeInFront:",
        "terminate:",
      ],
      runtime.Selectors);

    var nonMacRoleCounts = new Dictionary<string, int>();
    foreach (var platform in new[]
      {
        FsusShortcutPlatform.Windows,
        FsusShortcutPlatform.Linux,
      })
    {
      var nonMacRuntime = new RecordingRuntime();
      using var nonMacBuilder = new FsusNativeMenuBuilder(
        new FsusMacOSNativeMenuAdapter(nonMacRuntime));
      var nonMacMenu = nonMacBuilder.Build(BuildRoleTree(), platform);
      var count = EnumerateItems(nonMacMenu).Count(item =>
        FsusNativeMenuMetadata.GetRole(item) is
          FsusPlatformRole.Services or
          FsusPlatformRole.Hide or
          FsusPlatformRole.HideOthers or
          FsusPlatformRole.ShowAll or
          FsusPlatformRole.WindowMinimize or
          FsusPlatformRole.WindowZoom or
          FsusPlatformRole.WindowBringAllToFront);
      Assert.Equal(0, count);
      Assert.Empty(nonMacRuntime.ServicesMenus);
      Assert.Empty(nonMacRuntime.Selectors);
      nonMacRoleCounts.Add(platform.ToString(), count);
    }

    var json = JsonSerializer.Serialize(
      new
      {
        schemaVersion = 1,
        issue = 688,
        fixtureClass = "production-builder-with-library-owned-adapter-seam",
        localSimulation = true,
        physicalMacOSHardware = false,
        servicesMenusMarkedForAvaloniaNativeExporter =
          runtime.ServicesMenus.Count,
        routedRoles = routedRoles.Select(role => role.ToString()).ToArray(),
        responderSelectors = runtime.Selectors,
        nonMacRoleCounts,
        note =
          "The trace proves deterministic builder-to-adapter routing and the Avalonia native exporter marker contract; it does not claim a physical macOS run.",
      },
      new JsonSerializerOptions { WriteIndented = true }) + "\n";
    var digest = Convert.ToHexStringLower(
      SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json)));
    Assert.Equal(64, digest.Length);

    var outputRoot = Environment.GetEnvironmentVariable(
      "FSUS_ISSUE_688_NATIVE_MENU_EVIDENCE_ROOT");
    if (!string.IsNullOrWhiteSpace(outputRoot))
    {
      Directory.CreateDirectory(outputRoot);
      File.WriteAllText(
        Path.Combine(outputRoot, "native-menu-macos-adapter-trace.json"),
        json);
      File.WriteAllText(
        Path.Combine(outputRoot, "native-menu-macos-adapter-trace.sha256"),
        $"{digest}  native-menu-macos-adapter-trace.json\n");
    }
  }

  private static FsusNativeMenuItemModel[] BuildRoleTree() =>
  [
    FsusNativeMenuItemModel.SubMenu(
      "Application",
      FsusPlatformRole.Application,
      FsusNativeMenuItemModel.SubMenu(
        "Services",
        FsusPlatformRole.Services,
        new FsusNativeMenuItemModel
        {
          Header = "No Services",
          Role = FsusPlatformRole.Services,
        }),
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "app.hide",
        "Hide",
        FsusPlatformRole.Hide)),
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "app.hideOthers",
        "Hide Others",
        FsusPlatformRole.HideOthers)),
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "app.showAll",
        "Show All",
        FsusPlatformRole.ShowAll)),
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "app.quit",
        "Quit",
        FsusPlatformRole.Quit))),
    FsusNativeMenuItemModel.SubMenu(
      "Window",
      FsusPlatformRole.Window,
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "window.minimize",
        "Minimize",
        FsusPlatformRole.WindowMinimize)),
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "window.zoom",
        "Zoom",
        FsusPlatformRole.WindowZoom)),
      FsusNativeMenuItemModel.Action(new FsusPlatformCommand(
        "window.bringAllToFront",
        "Bring All to Front",
        FsusPlatformRole.WindowBringAllToFront))),
  ];

  private static NativeMenuItem FindRole(
    NativeMenu menu,
    FsusPlatformRole role) =>
    EnumerateItems(menu).Single(
      item => FsusNativeMenuMetadata.GetRole(item) == role);

  private static IEnumerable<NativeMenuItem> EnumerateItems(NativeMenu menu)
  {
    foreach (var item in menu.Items.OfType<NativeMenuItem>())
    {
      yield return item;
      if (item.Menu is null)
      {
        continue;
      }

      foreach (var child in EnumerateItems(item.Menu))
      {
        yield return child;
      }
    }
  }

  private sealed class RecordingAdapter : IFsusMacOSNativeMenuAdapter
  {
    public bool HandlesRoles { get; init; }

    public List<NativeMenu> ServicesMenus { get; } = [];

    public List<FsusPlatformRole> ExecutedRoles { get; } = [];

    public bool BindServicesMenu(NativeMenu servicesMenu)
    {
      ServicesMenus.Add(servicesMenu);
      return true;
    }

    public bool TryExecuteRole(FsusPlatformRole role)
    {
      ExecutedRoles.Add(role);
      return HandlesRoles;
    }
  }

  private sealed class RecordingRuntime : IFsusMacOSNativeMenuRuntime
  {
    public List<NativeMenu> ServicesMenus { get; } = [];

    public List<string> Selectors { get; } = [];

    public bool TryMarkServicesMenu(NativeMenu servicesMenu)
    {
      ServicesMenus.Add(servicesMenu);
      return true;
    }

    public bool TrySendApplicationAction(string selector)
    {
      Selectors.Add(selector);
      return true;
    }
  }
}
