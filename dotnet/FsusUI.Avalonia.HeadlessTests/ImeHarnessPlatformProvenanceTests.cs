using FsusUI.Avalonia.Demo;

namespace FsusUI.Avalonia.HeadlessTests;

public sealed class ImeHarnessPlatformProvenanceTests
{
  [Theory]
  [InlineData(":22")]
  [InlineData(":22.0")]
  public void DetectXServerBindsExactLocalDisplay(string display)
  {
    var result = ImeHarnessPlatformProvenance.DetectXServer(
      display,
      [
        (111, ["/usr/bin/Xorg", ":0", "-nolisten", "tcp"]),
        (222, ["/usr/bin/Xvfb", ":22", "-screen", "0", "1920x1080x24"]),
      ]);

    Assert.NotNull(result);
    Assert.Equal("Xvfb", result.Kind);
    Assert.Equal(222, result.ProcessId);
    Assert.Equal(":22", result.Display);
    Assert.True(ImeHarnessPlatformProvenance.IsAcceptedXServer(
      result.Kind,
      result.ProcessId));
  }

  [Theory]
  [InlineData(":23")]
  [InlineData("localhost:22.0")]
  [InlineData("unset")]
  public void DetectXServerRejectsMismatchedOrNonLocalDisplay(string display)
  {
    var result = ImeHarnessPlatformProvenance.DetectXServer(
      display,
      [(222, ["/usr/bin/Xvfb", ":22", "-screen", "0", "1920x1080x24"])]);

    Assert.Null(result);
  }

  [Fact]
  public void DetectXServerRejectsUnknownExecutableSpoofingDisplay()
  {
    var result = ImeHarnessPlatformProvenance.DetectXServer(
      ":22",
      [(333, ["/tmp/Xvfb-wrapper", ":22", "Xvfb"])]);

    Assert.Null(result);
    Assert.False(ImeHarnessPlatformProvenance.IsAcceptedXServer(
      "unverified",
      333));
    Assert.False(ImeHarnessPlatformProvenance.IsAcceptedXServer(
      "Xvfb",
      null));
  }

  [Theory]
  [InlineData("Xorg")]
  [InlineData("Xvfb")]
  [InlineData("XWayland")]
  public void AcceptedServersRequireKnownKindAndPositivePid(string kind)
  {
    Assert.True(ImeHarnessPlatformProvenance.IsAcceptedXServer(kind, 1));
    Assert.False(ImeHarnessPlatformProvenance.IsAcceptedXServer(kind, 0));
  }
}
