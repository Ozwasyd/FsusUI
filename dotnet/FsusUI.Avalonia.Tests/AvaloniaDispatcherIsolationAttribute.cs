using Avalonia.Threading;
using System.Reflection;
using Xunit.Sdk;

[assembly: FsusUI.Avalonia.Tests.AvaloniaDispatcherIsolation]

namespace FsusUI.Avalonia.Tests;

[AttributeUsage(AttributeTargets.Assembly)]
public sealed class AvaloniaDispatcherIsolationAttribute : BeforeAfterTestAttribute
{
  private static readonly MethodInfo ResetDispatcher =
    typeof(Dispatcher).GetMethod(
      "ResetForUnitTests",
      BindingFlags.NonPublic | BindingFlags.Static) ??
    throw new InvalidOperationException(
      "Avalonia Dispatcher.ResetForUnitTests is required by the unit-test harness.");

  public override void Before(MethodInfo methodUnderTest) =>
    ResetDispatcher.Invoke(null, null);

  public override void After(MethodInfo methodUnderTest) =>
    ResetDispatcher.Invoke(null, null);
}
