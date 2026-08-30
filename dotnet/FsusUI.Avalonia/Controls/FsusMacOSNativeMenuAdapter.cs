using Avalonia;
using Avalonia.Controls;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Runtime.InteropServices;

namespace FsusUI.Avalonia.Controls;

internal interface IFsusMacOSNativeMenuAdapter
{
  bool BindServicesMenu(NativeMenu servicesMenu);

  bool TryExecuteRole(FsusPlatformRole role);
}

internal interface IFsusMacOSNativeMenuRuntime
{
  bool TryMarkServicesMenu(NativeMenu servicesMenu);

  bool TrySendApplicationAction(string selector);
}

internal sealed class FsusMacOSNativeMenuAdapter(
  IFsusMacOSNativeMenuRuntime runtime) : IFsusMacOSNativeMenuAdapter
{
  public static FsusMacOSNativeMenuAdapter Instance { get; } =
    new(FsusMacOSNativeMenuRuntime.Instance);

  public bool BindServicesMenu(NativeMenu servicesMenu)
  {
    ArgumentNullException.ThrowIfNull(servicesMenu);
    return runtime.TryMarkServicesMenu(servicesMenu);
  }

  public bool TryExecuteRole(FsusPlatformRole role)
  {
    var selector = role switch
    {
      FsusPlatformRole.Hide => "hide:",
      FsusPlatformRole.HideOthers => "hideOtherApplications:",
      FsusPlatformRole.ShowAll => "unhideAllApplications:",
      FsusPlatformRole.Quit => "terminate:",
      FsusPlatformRole.WindowMinimize => "performMiniaturize:",
      FsusPlatformRole.WindowZoom => "performZoom:",
      FsusPlatformRole.WindowBringAllToFront => "arrangeInFront:",
      _ => null,
    };

    return selector is not null &&
      runtime.TrySendApplicationAction(selector);
  }
}

internal sealed class FsusMacOSNativeMenuRuntime : IFsusMacOSNativeMenuRuntime
{
  private const string ObjectiveCLibrary = "/usr/lib/libobjc.A.dylib";
  private const string ServicesCommandsType =
    "Avalonia.Native.MacOSNativeMenuCommands, Avalonia.Native";
  private const string ServicesPropertyField = "IsServicesSubmenuProperty";

  public static FsusMacOSNativeMenuRuntime Instance { get; } = new();

  public bool TryMarkServicesMenu(NativeMenu servicesMenu)
  {
    ArgumentNullException.ThrowIfNull(servicesMenu);
    if (!OperatingSystem.IsMacOS())
    {
      return false;
    }

    var property = ResolveServicesMenuProperty();
    if (property is null)
    {
      return false;
    }

    servicesMenu.SetValue(property, true);
    return true;
  }

  public bool TrySendApplicationAction(string selector)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(selector);
    if (!OperatingSystem.IsMacOS())
    {
      return false;
    }

    try
    {
      var applicationClass = GetClass("NSApplication");
      if (applicationClass == 0)
      {
        return false;
      }

      var application = SendMessage(
        applicationClass,
        RegisterSelector("sharedApplication"));
      if (application == 0)
      {
        return false;
      }

      return SendAction(
        application,
        RegisterSelector("sendAction:to:from:"),
        RegisterSelector(selector),
        0,
        0);
    }
    catch (DllNotFoundException)
    {
      return false;
    }
    catch (EntryPointNotFoundException)
    {
      return false;
    }
    catch (BadImageFormatException)
    {
      return false;
    }
  }

  [DynamicDependency(
    DynamicallyAccessedMemberTypes.PublicFields,
    "Avalonia.Native.MacOSNativeMenuCommands",
    "Avalonia.Native")]
  internal static AttachedProperty<bool>? ResolveServicesMenuProperty()
  {
    var commandsType = Type.GetType(ServicesCommandsType, throwOnError: false);
    return commandsType?
      .GetField(
        ServicesPropertyField,
        BindingFlags.Public | BindingFlags.Static)?
      .GetValue(null) as AttachedProperty<bool>;
  }

  [DllImport(ObjectiveCLibrary, EntryPoint = "objc_getClass")]
  private static extern nint GetClass(
    [MarshalAs(UnmanagedType.LPUTF8Str)] string name);

  [DllImport(ObjectiveCLibrary, EntryPoint = "sel_registerName")]
  private static extern nint RegisterSelector(
    [MarshalAs(UnmanagedType.LPUTF8Str)] string name);

  [DllImport(ObjectiveCLibrary, EntryPoint = "objc_msgSend")]
  private static extern nint SendMessage(nint receiver, nint selector);

  [DllImport(ObjectiveCLibrary, EntryPoint = "objc_msgSend")]
  [return: MarshalAs(UnmanagedType.I1)]
  private static extern bool SendAction(
    nint receiver,
    nint selector,
    nint action,
    nint target,
    nint sender);
}
