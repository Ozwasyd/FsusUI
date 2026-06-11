using FsusUI.Avalonia.Demo;

namespace FsusUI.Avalonia.HeadlessTests;

public class AvaloniaHeadlessSmokeTests
{
  [Fact]
  public void DemoAppBuilderCanBeCreatedWithoutStartingDesktopLifetime()
  {
    var builder = Program.BuildAvaloniaApp();

    Assert.NotNull(builder);
  }
}
