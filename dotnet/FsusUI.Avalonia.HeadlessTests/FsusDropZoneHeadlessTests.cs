using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform.Storage;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows.Input;

namespace FsusUI.Avalonia.HeadlessTests;

[CollectionDefinition("FsusDropZoneTheme", DisableParallelization = true)]
public sealed class FsusDropZoneThemeCollection;

[Collection("FsusDropZoneTheme")]
public class FsusDropZoneHeadlessTests
{
  public static IEnumerable<object[]> ThemeAndDirectionVariants()
  {
    yield return new object[] { nameof(FsusThemeVariant.Light), false, FlowDirection.LeftToRight, 96.0 };
    yield return new object[] { nameof(FsusThemeVariant.Dark), false, FlowDirection.LeftToRight, 96.0 };
    yield return new object[] { "HighContrast", true, FlowDirection.LeftToRight, 96.0 };
    yield return new object[] { nameof(FsusThemeVariant.Light), false, FlowDirection.RightToLeft, 96.0 };
    yield return new object[] { nameof(FsusThemeVariant.Light), false, FlowDirection.LeftToRight, 144.0 }; // 150%
    yield return new object[] { nameof(FsusThemeVariant.Dark), false, FlowDirection.LeftToRight, 192.0 }; // 200%
  }

  [AvaloniaTheory]
  [MemberData(nameof(ThemeAndDirectionVariants))]
  public void DropZoneMountsAndRendersUnderThemesRtlAndScales(
    string themeName,
    bool highContrast,
    FlowDirection flowDirection,
    double dpi)
  {
    var dropZone = new FsusDropZone
    {
      Width = 380,
      Height = 120,
      AccessibleName = "Contract upload zone",
      Instruction = "Drop contracts here or click to browse",
      HelpText = "PDF or PNG format up to 25MB",
      FlowDirection = flowDirection,
    };

    var window = CreateStyledWindow();
    ApplyTheme(window, themeName, highContrast);

    var container = new Border
    {
      Width = 440,
      Height = 180,
      Padding = new Thickness(24),
      Child = dropZone,
      FlowDirection = flowDirection,
    };

    window.Content = container;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(dropZone.IsVisible);
    Assert.Equal("Contract upload zone", AutomationProperties.GetName(dropZone));
    Assert.Equal("PDF or PNG format up to 25MB", AutomationProperties.GetHelpText(dropZone));
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
    var expectedSurface = Assert.IsAssignableFrom<ISolidColorBrush>(
      window.Resources[FsusThemeResourceKeys.SurfaceBrush]);
    var defaultSurface = Assert.Single(
      dropZone.GetVisualDescendants().OfType<Border>(),
      border => border.Name == "PART_DefaultSurface");
    var actualSurface = Assert.IsAssignableFrom<ISolidColorBrush>(defaultSurface.Background);
    Assert.Equal(expectedSurface.Color, actualSurface.Color);

    // Render verification under specified DPI scaling
    var pixelScale = dpi / 96.0;
    var pixelWidth = (int)Math.Round(440 * pixelScale);
    var pixelHeight = (int)Math.Round(180 * pixelScale);

    using var bitmap = new RenderTargetBitmap(
      new PixelSize(pixelWidth, pixelHeight),
      new Vector(dpi, dpi));
    bitmap.Render(container);

    Assert.Equal(pixelWidth, bitmap.PixelSize.Width);
    Assert.Equal(pixelHeight, bitmap.PixelSize.Height);

    window.Close();
  }

  [AvaloniaFact]
  public void DropZoneMaintainsZeroLayoutShiftAcrossFocusDropAndStatusStates()
  {
    var dropZone = new FsusDropZone
    {
      Width = 360,
      Instruction = "Drop files here",
    };

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);

    var panel = new StackPanel
    {
      Children = { dropZone },
    };

    window.Content = panel;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    // 1. Initial baseline bounds
    var baseBounds = dropZone.Bounds;
    Assert.True(baseBounds.Width > 0);
    Assert.True(baseBounds.Height > 0);
    var expectedWidth = baseBounds.Width;
    var expectedHeight = baseBounds.Height;

    // 2. Focus state
    Assert.True(dropZone.Focus(), "DropZone should accept keyboard focus");
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.IsFocused);
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 3. Accepted drop feedback
    dropZone.HandleDrop(new[] { "payload.json" });
    Dispatcher.UIThread.RunJobs();
    Assert.Contains("fsus-dropped", dropZone.Classes);
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 4. Filter error with realistic long feedback
    dropZone.Accepts = ".png";
    dropZone.HandleDrop(new[] { "annual-contract-export-with-a-long-file-name.json" });
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.HasFilterError);
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 5. Application error with realistic long feedback
    dropZone.HasFilterError = false;
    dropZone.FilterErrorMessage = null;
    dropZone.IsError = true;
    dropZone.ErrorMessage =
      "Storage volume is unavailable while the consumer prepares the import.";
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 6. Loading state
    dropZone.IsError = false;
    dropZone.ErrorMessage = null;
    dropZone.IsLoading = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    // 7. Disabled state
    dropZone.IsLoading = false;
    dropZone.IsDisabled = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(expectedWidth, dropZone.Bounds.Width);
    Assert.Equal(expectedHeight, dropZone.Bounds.Height);

    window.Close();
  }

  [AvaloniaFact]
  public void KeyboardActivationTriggersConsumerSpecifiedBrowseAction()
  {
    var browseRequestedCount = 0;
    var commandExecutedCount = 0;
    var command = new TestCommand(_ => commandExecutedCount++);

    var dropZone = new FsusDropZone
    {
      Width = 320,
      Height = 100,
      BrowseCommand = command,
      BrowseCommandParameter = "select-docs",
    };
    dropZone.BrowseRequested += (_, _) => browseRequestedCount++;

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);
    window.Content = dropZone;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.True(dropZone.Focus());
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.IsFocused);

    // Trigger Enter key
    var enterArgs = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Enter,
      Source = dropZone,
    };
    dropZone.RaiseEvent(enterArgs);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(1, browseRequestedCount);
    Assert.Equal(1, commandExecutedCount);
    Assert.True(enterArgs.Handled);

    // Trigger Space key
    var spaceArgs = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Space,
      Source = dropZone,
    };
    dropZone.RaiseEvent(spaceArgs);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(2, browseRequestedCount);
    Assert.Equal(2, commandExecutedCount);
    Assert.True(spaceArgs.Handled);

    // Non-activation key (e.g. Tab or Escape) does not trigger browse
    var tabArgs = new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Tab,
      Source = dropZone,
    };
    dropZone.RaiseEvent(tabArgs);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(2, browseRequestedCount);
    Assert.Equal(2, commandExecutedCount);

    var center = dropZone.TranslatePoint(
      new Point(dropZone.Bounds.Width / 2, dropZone.Bounds.Height / 2),
      window);
    Assert.NotNull(center);
    window.MouseDown(center!.Value, MouseButton.Left);
    window.MouseUp(center.Value, MouseButton.Left);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(3, browseRequestedCount);
    Assert.Equal(3, commandExecutedCount);

    var peer = Assert.IsAssignableFrom<AutomationPeer>(
      ControlAutomationPeer.CreatePeerForElement(dropZone));
    var invoke = Assert.IsAssignableFrom<IInvokeProvider>(peer);
    invoke.Invoke();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(4, browseRequestedCount);
    Assert.Equal(4, commandExecutedCount);
    Assert.Equal(AutomationLiveSetting.Polite, AutomationProperties.GetLiveSetting(dropZone));

    window.Close();
  }

  [AvaloniaFact]
  public void LocalRoutedDragSimulationCoversEnterLeaveTypedDropAndFiltering()
  {
    var dropZone = new FsusDropZone
    {
      Width = 360,
      Instruction = "Drop contracts here",
      Accepts = ".pdf",
    };
    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);
    window.Content = dropZone;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var tempRoot = Path.Combine(Path.GetTempPath(), $"fsusui-drop-zone-{Guid.NewGuid():N}");
    Directory.CreateDirectory(tempRoot);
    var acceptedPath = Path.Combine(tempRoot, "contract.pdf");
    var secondAcceptedPath = Path.Combine(tempRoot, "appendix.pdf");
    var rejectedPath = Path.Combine(tempRoot, "notes.txt");
    File.WriteAllText(acceptedPath, "local drag simulation fixture");
    File.WriteAllText(secondAcceptedPath, "local drag simulation fixture");
    File.WriteAllText(rejectedPath, "local drag simulation fixture");

    try
    {
      using var acceptedFile = Assert.IsAssignableFrom<IStorageFile>(
        window.StorageProvider.TryGetFileFromPathAsync(acceptedPath).GetAwaiter().GetResult());
      using var secondAcceptedFile = Assert.IsAssignableFrom<IStorageFile>(
        window.StorageProvider.TryGetFileFromPathAsync(secondAcceptedPath).GetAwaiter().GetResult());
      using var rejectedFile = Assert.IsAssignableFrom<IStorageFile>(
        window.StorageProvider.TryGetFileFromPathAsync(rejectedPath).GetAwaiter().GetResult());
      var transfer = new DataTransfer();
      transfer.Add(DataTransferItem.CreateFile(acceptedFile));
      transfer.Add(DataTransferItem.CreateFile(rejectedFile));

      var enter = RaiseDrag(dropZone, DragDrop.DragEnterEvent, transfer);
      Assert.True(enter.Handled);
      Assert.Equal(DragDropEffects.Copy, enter.DragEffects);
      Assert.True(dropZone.IsDragOver);
      Assert.Equal("dragover", AutomationProperties.GetItemStatus(dropZone));

      var leave = RaiseDrag(dropZone, DragDrop.DragLeaveEvent, transfer);
      Assert.False(dropZone.IsDragOver);
      Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
      Assert.False(leave.Handled);

      FsusFileDropEventArgs? dropped = null;
      FsusFileDropEventArgs? rejected = null;
      dropZone.FilesDropped += (_, args) => dropped = args;
      dropZone.FilesRejected += (_, args) => rejected = args;

      RaiseDrag(dropZone, DragDrop.DragEnterEvent, transfer);
      var drop = RaiseDrag(dropZone, DragDrop.DropEvent, transfer);

      Assert.True(drop.Handled);
      Assert.NotNull(dropped);
      Assert.NotNull(rejected);
      Assert.Same(acceptedFile, Assert.Single(dropped!.StorageItems));
      Assert.Same(rejectedFile, Assert.Single(rejected!.RejectedItems));
      Assert.True(dropZone.HasFilterError);
      Assert.StartsWith("rejected:", AutomationProperties.GetItemStatus(dropZone));

      var acceptedOnlyTransfer = new DataTransfer();
      acceptedOnlyTransfer.Add(DataTransferItem.CreateFile(acceptedFile));
      RaiseDrag(dropZone, DragDrop.DragEnterEvent, acceptedOnlyTransfer);
      RaiseDrag(dropZone, DragDrop.DropEvent, acceptedOnlyTransfer);

      Assert.False(dropZone.HasFilterError);
      Assert.Contains("fsus-dropped", dropZone.Classes);
      Assert.Equal("dropped: 1 accepted", AutomationProperties.GetItemStatus(dropZone));

      dropZone.AllowMultiple = false;
      dropped = null;
      rejected = null;
      var singleTransfer = new DataTransfer();
      singleTransfer.Add(DataTransferItem.CreateFile(acceptedFile));
      singleTransfer.Add(DataTransferItem.CreateFile(secondAcceptedFile));
      RaiseDrag(dropZone, DragDrop.DragEnterEvent, singleTransfer);
      RaiseDrag(dropZone, DragDrop.DropEvent, singleTransfer);

      Assert.Same(acceptedFile, Assert.Single(dropped!.StorageItems));
      Assert.Same(secondAcceptedFile, Assert.Single(rejected!.RejectedItems));
      Assert.Equal("Only a single file is accepted.", dropZone.FilterErrorMessage);
      Assert.StartsWith("rejected:", AutomationProperties.GetItemStatus(dropZone));
    }
    finally
    {
      window.Close();
      Directory.Delete(tempRoot, true);
    }
  }

  [AvaloniaFact]
  public void FilterFailureDisabledErrorAndLoadingStatesAreClearlyDistinguishable()
  {
    var dropZone = new FsusDropZone
    {
      Width = 340,
      Height = 100,
    };

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);
    window.Content = dropZone;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    // 1. Ready state
    Assert.Equal("ready", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-multiple", dropZone.Classes);

    // 2. Disabled state
    dropZone.IsDisabled = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("disabled", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-disabled", dropZone.Classes);
    Assert.False(dropZone.Focusable);

    // 3. Loading state
    dropZone.IsDisabled = false;
    dropZone.IsLoading = true;
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("loading", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-loading", dropZone.Classes);

    // 4. Custom Error state
    dropZone.IsLoading = false;
    dropZone.IsError = true;
    dropZone.ErrorMessage = "Cloud sync failed";
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("error: Cloud sync failed", AutomationProperties.GetItemStatus(dropZone));
    Assert.Contains("fsus-has-error", dropZone.Classes);

    // 5. Filter Failure state
    dropZone.IsError = false;
    dropZone.ErrorMessage = null;
    dropZone.Accepts = ".png, .jpg";
    dropZone.HandleDrop(new[] { "manual.docx" });
    Dispatcher.UIThread.RunJobs();
    Assert.True(dropZone.HasFilterError);
    Assert.Contains("fsus-filter-error", dropZone.Classes);
    Assert.StartsWith("rejected:", AutomationProperties.GetItemStatus(dropZone));

    // Confirm that each state maps to distinct status identifiers
    var stateStatuses = new[]
    {
      "ready",
      "disabled",
      "loading",
      "error: Cloud sync failed",
      AutomationProperties.GetItemStatus(dropZone),
    };
    Assert.Equal(5, stateStatuses.Distinct().Count());

    window.Close();
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersDropZoneVisualStatesAndSavesArtifacts()
  {
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "screenshots",
      "avalonia");
    Directory.CreateDirectory(outputRoot);

    var captures = new List<DropZoneRenderCapture>();

    foreach (var (themeName, highContrast) in new[]
      {
        (Theme: "Light", HighContrast: false),
        (Theme: "Dark", HighContrast: false),
        (Theme: "HighContrast", HighContrast: true),
      })
    {
      foreach (var state in new[]
        {
          "ready",
          "hover",
          "dragover",
          "dropped",
          "focus",
          "disabled",
          "loading",
          "error",
          "rejected",
        })
      {
        captures.Add(
          RenderDropZoneState(
            outputRoot,
            themeName,
            highContrast,
            state,
            FlowDirection.LeftToRight,
            96));
      }

      foreach (var (flowDirection, dpi) in new[]
        {
          (FlowDirection.RightToLeft, 96.0),
          (FlowDirection.LeftToRight, 144.0),
          (FlowDirection.LeftToRight, 192.0),
        })
      {
        foreach (var state in new[] { "ready", "rejected" })
        {
          captures.Add(
            RenderDropZoneState(
              outputRoot,
              themeName,
              highContrast,
              state,
              flowDirection,
              dpi));
        }
      }
    }

    Assert.Equal(45, captures.Count);
    Assert.All(captures, capture =>
    {
      Assert.Equal(64, capture.Sha256.Length);
      Assert.Equal(
        (int)Math.Round(480 * capture.ZoomPercent / 100.0),
        capture.PixelSize.Width);
      Assert.Equal(
        (int)Math.Round(160 * capture.ZoomPercent / 100.0),
        capture.PixelSize.Height);
      Assert.True(File.Exists(Path.Combine(FindRepositoryRoot(), capture.File)));
    });
    foreach (var themeCaptures in captures
      .Where(capture =>
        capture.FlowDirection == FlowDirection.LeftToRight.ToString() &&
        capture.ZoomPercent == 100 &&
        capture.State is "ready" or "disabled" or "loading" or "error" or "rejected")
      .GroupBy(capture => capture.Theme))
    {
      Assert.Equal(5, themeCaptures.Select(capture => capture.Sha256).Distinct().Count());
    }

    var manifestPath = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "issue-655-avalonia-drop-zone-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 2,
          generatedBy =
            "FsusDropZoneHeadlessTests.RealHeadlessSkiaRendersDropZoneVisualStatesAndSavesArtifacts",
          renderer = new
          {
            platform = "avalonia",
            runner = "headless-skia",
            drawingBackend = "Skia",
            avaloniaVersion = typeof(Application).Assembly.GetName().Version?.ToString(),
            evidenceClass = "local-headless-render",
            limitations =
              "Pointer and drag visual-state captures use production classes; routed DataTransfer behavior is exercised separately by LocalRoutedDragSimulationCoversEnterLeaveTypedDropAndFiltering. No operating-system drag source or physical display is claimed.",
          },
          issue = 655,
          captures,
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
  }

  private static DropZoneRenderCapture RenderDropZoneState(
    string outputRoot,
    string themeName,
    bool highContrast,
    string state,
    FlowDirection flowDirection,
    double dpi)
  {
    var dropZone = new FsusDropZone
    {
      Width = 400,
      Height = 110,
      AccessibleName = "Attachment import",
      Instruction = "Drag files here or click to browse",
      HelpText = "Supported formats: PDF, PNG, CSV up to 15MB",
      FlowDirection = flowDirection,
    };

    var stateSetup = state;
    switch (state)
    {
      case "hover":
        dropZone.Classes.Add("fsus-pointerover");
        stateSetup = "production visual class projection; pointer activation tested separately";
        break;
      case "dragover":
        dropZone.Classes.Add("fsus-dragover");
        stateSetup = "production visual class projection; routed DataTransfer tested separately";
        break;
      case "dropped":
        dropZone.HandleDrop(new[] { "contract.pdf" });
        stateSetup = "HandleDrop accepted-file simulation";
        break;
      case "disabled":
        dropZone.IsDisabled = true;
        stateSetup = "IsDisabled property";
        break;
      case "loading":
        dropZone.IsLoading = true;
        stateSetup = "IsLoading property";
        break;
      case "error":
        dropZone.IsError = true;
        dropZone.ErrorMessage =
          "Storage volume is unavailable while the consumer prepares the import.";
        stateSetup = "IsError and ErrorMessage properties";
        break;
      case "rejected":
        dropZone.Accepts = ".pdf";
        dropZone.HandleDrop(new[] { "annual-contract-export-with-a-long-file-name.sh" });
        stateSetup = "HandleDrop rejected-file simulation";
        break;
    }

    var window = CreateStyledWindow();
    window.Width = 480;
    window.Height = 160;
    ApplyTheme(window, themeName, highContrast);

    var surfaceRoot = new Border
    {
      Width = 480,
      Height = 160,
      Padding = new Thickness(24),
      Background = Assert.IsAssignableFrom<IBrush>(
        window.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = dropZone,
      FlowDirection = flowDirection,
    };

    window.Content = surfaceRoot;
    window.Show();

    if (state == "focus")
    {
      dropZone.Focus();
    }

    Dispatcher.UIThread.RunJobs();

    if (flowDirection == FlowDirection.RightToLeft && state == "rejected")
    {
      var filterError = Assert.Single(
        dropZone.GetVisualDescendants().OfType<TextBlock>(),
        text => text.Name == "PART_FilterErrorText");
      Assert.Equal(FlowDirection.LeftToRight, filterError.FlowDirection);
    }

    window.Measure(new Size(480, 160));
    window.Arrange(new Rect(0, 0, 480, 160));
    surfaceRoot.Measure(new Size(480, 160));
    surfaceRoot.Arrange(new Rect(0, 0, 480, 160));

    var pixelScale = dpi / 96;
    var pixelSize = new PixelSize(
      (int)Math.Round(480 * pixelScale),
      (int)Math.Round(160 * pixelScale));
    using var bitmap = new RenderTargetBitmap(pixelSize, new Vector(dpi, dpi));
    bitmap.Render(surfaceRoot);

    var zoomPercent = (int)Math.Round(pixelScale * 100);
    var variantSuffix = flowDirection == FlowDirection.LeftToRight && zoomPercent == 100
      ? string.Empty
      : $"-{(flowDirection == FlowDirection.RightToLeft ? "rtl" : "ltr")}-{zoomPercent}";
    var fileName =
      $"issue-655-dropzone-{themeName.ToLowerInvariant()}{variantSuffix}-{state}.png";
    var outputPath = Path.Combine(outputRoot, fileName);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    window.Close();

    return new DropZoneRenderCapture(
      Path.GetRelativePath(FindRepositoryRoot(), outputPath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(outputPath))),
      new PixelDimension(bitmap.PixelSize.Width, bitmap.PixelSize.Height),
      themeName,
      state,
      flowDirection.ToString(),
      dpi,
      zoomPercent,
      stateSetup);
  }

  [AvaloniaFact]
  public void LocalAutomationSimulationWritesInspectableReceipt()
  {
    var browseRequestedCount = 0;
    var dropZone = new FsusDropZone
    {
      Width = 360,
      Height = 100,
      AccessibleName = "Attachment import",
      Instruction = "Drag files here or click to browse",
      HelpText = "PDF documents, up to 15MB",
    };
    dropZone.BrowseRequested += (_, _) => browseRequestedCount++;

    var window = CreateStyledWindow();
    ApplyTheme(window, nameof(FsusThemeVariant.Light), false);
    window.Content = dropZone;
    window.Show();
    Dispatcher.UIThread.RunJobs();

    var states = new List<object>();
    void Capture(string state) =>
      states.Add(new
      {
        state,
        name = AutomationProperties.GetName(dropZone),
        helpText = AutomationProperties.GetHelpText(dropZone),
        itemStatus = AutomationProperties.GetItemStatus(dropZone),
        liveSetting = AutomationProperties.GetLiveSetting(dropZone).ToString(),
        isEnabled = !dropZone.IsDisabled && dropZone.IsEnabled && !dropZone.IsLoading,
      });

    Capture("ready");
    dropZone.HandleDrop(new[] { "contract.pdf" });
    Capture("dropped");
    dropZone.Accepts = ".pdf";
    dropZone.HandleDrop(new[] { "notes.txt" });
    Capture("rejected");
    dropZone.HasFilterError = false;
    dropZone.FilterErrorMessage = null;
    dropZone.IsError = true;
    dropZone.ErrorMessage = "Storage volume unavailable";
    Capture("error");
    dropZone.IsError = false;
    dropZone.ErrorMessage = null;
    dropZone.IsLoading = true;
    Capture("loading");
    dropZone.IsLoading = false;
    dropZone.IsDisabled = true;
    Capture("disabled");
    dropZone.IsDisabled = false;

    var peer = Assert.IsAssignableFrom<AutomationPeer>(
      ControlAutomationPeer.CreatePeerForElement(dropZone));
    var invoke = Assert.IsAssignableFrom<IInvokeProvider>(peer);
    invoke.Invoke();
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(1, browseRequestedCount);

    var reportPath = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "issue-655-avalonia-drop-zone-automation-report.json");
    File.WriteAllText(
      reportPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 655,
          generatedBy =
            "FsusDropZoneHeadlessTests.LocalAutomationSimulationWritesInspectableReceipt",
          evidenceClass = "local-headless-automation-simulation",
          notRealOsScreenReader = true,
          controlType = AutomationProperties.GetControlTypeOverride(dropZone).ToString(),
          invokePattern = peer is IInvokeProvider,
          browseRequestedCount,
          states,
          relatedInteractionTests = new[]
          {
            "KeyboardActivationTriggersConsumerSpecifiedBrowseAction",
            "LocalRoutedDragSimulationCoversEnterLeaveTypedDropAndFiltering",
          },
          limitations =
            "This receipt inspects Avalonia automation properties and the production automation peer in the headless backend. It does not claim a Windows UIA, macOS VoiceOver, Linux AT-SPI, or physical assistive-technology session.",
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    Assert.True(new FileInfo(reportPath).Length > 500);
    window.Close();
  }

  private static Window CreateStyledWindow()
  {
    var window = new Window
    {
      Width = 480,
      Height = 240,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    return window;
  }

  private static DragEventArgs RaiseDrag(
    FsusDropZone dropZone,
    global::Avalonia.Interactivity.RoutedEvent<DragEventArgs> routedEvent,
    IDataTransfer transfer)
  {
    var args = new DragEventArgs(
      routedEvent,
      transfer,
      dropZone,
      new Point(12, 12),
      KeyModifiers.None);
    dropZone.RaiseEvent(args);
    Dispatcher.UIThread.RunJobs();
    return args;
  }

  private static void ApplyTheme(Window window, string themeName, bool highContrast)
  {
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = highContrast
          ? FsusThemeVariant.Dark
          : Enum.Parse<FsusThemeVariant>(themeName),
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
  }

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }

    throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");
  }

  private sealed class TestCommand(Action<object?> execute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => execute(parameter);
  }

  private sealed record PixelDimension(int Width, int Height);

  private sealed record DropZoneRenderCapture(
    string File,
    string Sha256,
    PixelDimension PixelSize,
    string Theme,
    string State,
    string FlowDirection,
    double Dpi,
    int ZoomPercent,
    string StateSetup);
}
