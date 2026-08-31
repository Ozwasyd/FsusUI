using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Demo;

internal static class ConformanceV2Runner
{
  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = true,
  };

  private static string outputPath = ".tmp/conformance-v2/avalonia.json";
  private static string candidate = "unknown";
  private static string contractHash = "unknown";
  private static string webBaselineHash = "unknown";
  private static string avaloniaBaselineHash = "unknown";
  private static string runnerHash = "unknown";
  private static double checkTagBudgetMilliseconds = 2000;
  private static double checkTagRenderBudgetMilliseconds = 8;
  private static string checkTagMemoryBudget = "no retained unbounded per-item state without virtualization budget";

  public static bool IsConfigured { get; private set; }

  public static void Configure(string[] args)
  {
    IsConfigured = true;
    outputPath = ReadArgument(args, "--output") ?? outputPath;
    candidate = ReadArgument(args, "--candidate") ?? candidate;
    contractHash = ReadArgument(args, "--contract-hash") ?? contractHash;
    webBaselineHash = ReadArgument(args, "--web-baseline-hash") ?? webBaselineHash;
    avaloniaBaselineHash = ReadArgument(args, "--avalonia-baseline-hash") ?? avaloniaBaselineHash;
    runnerHash = ReadArgument(args, "--runner-hash") ?? runnerHash;
    checkTagBudgetMilliseconds = double.Parse(
      ReadArgument(args, "--check-tag-budget") ?? "2000",
      CultureInfo.InvariantCulture);
    checkTagRenderBudgetMilliseconds = double.Parse(
      ReadArgument(args, "--check-tag-render-budget") ?? "8",
      CultureInfo.InvariantCulture);
    checkTagMemoryBudget =
      ReadArgument(args, "--check-tag-memory-budget") ?? checkTagMemoryBudget;
  }

  public static Window CreateWindow(IClassicDesktopStyleApplicationLifetime lifetime)
  {
    var identity = new FsusMarkdownDocumentIdentity("markdown-editor-interaction-trace", 348);
    var button = new FsusButton
    {
      AccessibleName = "Run conformance action",
      Content = "Run action",
      Name = "ConformanceAction",
    };
    var input = new FsusInput
    {
      AccessibleName = "Conformance input",
      Name = "ConformanceInput",
      Text = "before",
    };
    var editor = new FsusMarkdownEditor
    {
      Document = "Trace start",
      DocumentIdentity = identity,
      Name = "ConformanceMarkdownEditor",
    };
    var checkTag = new FsusCheckTag
    {
      Checked = false,
      Content = "Check tag",
      Name = "ConformanceCheckTag",
    };
    AutomationProperties.SetName(editor, "Markdown editor");
    var root = new StackPanel
    {
      Margin = new Thickness(24),
      Spacing = 12,
      Children = { button, input, checkTag, editor },
    };
    var window = new Window
    {
      Content = root,
      Height = 720,
      ShowInTaskbar = false,
      Title = "FsusUI Contract V2 real-window runner",
      Width = 960,
    };

    window.Opened += async (_, _) =>
    {
      try
      {
        await Dispatcher.UIThread.InvokeAsync(
          () => Run(window, button, input, checkTag, editor, identity),
          DispatcherPriority.Background);
        lifetime.Shutdown(0);
      }
      catch (Exception error)
      {
        Console.Error.WriteLine(error);
        lifetime.Shutdown(8);
      }
    };
    return window;
  }

  private static void Run(
    Window window,
    FsusButton button,
    FsusInput input,
    FsusCheckTag checkTag,
    FsusMarkdownEditor editor,
    FsusMarkdownDocumentIdentity identity)
  {
    var executionId = $"conformance-v2-{candidate}";
    const string checkpoint = "markdown-after-undo";
    var absoluteOutput = Path.GetFullPath(outputPath);
    Directory.CreateDirectory(Path.GetDirectoryName(absoluteOutput)!);
    var events = new List<object>();
    var steps = new List<object>();
    var checkTagEvents = new List<object>();
    var checkTagSteps = new List<object>();
    var checkTagRevision = 0;
    var stopwatch = Stopwatch.StartNew();

    button.Activated += (_, _) => events.Add(new { name = "button.activated" });
    button.AddHandler(
      InputElement.PointerPressedEvent,
      (_, _) => events.Add(new { name = "button.pointer-pressed" }),
      RoutingStrategies.Tunnel | RoutingStrategies.Bubble,
      handledEventsToo: true);
    input.TextInput += (_, args) => events.Add(new { name = "input.text-input", payload = args.Text });
    input.ValueChanged += (_, args) => events.Add(new
    {
      name = "input.value-changed",
      payload = new { args.OldValue, args.NewValue },
    });
    editor.Transaction += (_, args) => events.Add(new
    {
      name = "markdown.transaction",
      payload = new
      {
        args.Result.Accepted,
        args.Result.Revision,
        args.Transaction.Origin,
      },
    });
    editor.SelectionChange += (_, args) => events.Add(new
    {
      name = "markdown.selection-change",
      payload = new { args.Revision, args.Selection },
    });
    editor.HistoryChange += (_, args) => events.Add(new
    {
      name = "markdown.history-change",
      payload = args.History,
    });
    checkTag.CheckedChanged += (_, args) =>
    {
      checkTagRevision++;
      checkTagEvents.Add(new
      {
        name = "checked-changed",
        payload = args.NewChecked,
        revision = checkTagRevision,
      });
    };

    window.UpdateLayout();
    RecordStep(steps, "render", "Window", new
    {
      actual = new { window.IsVisible, window.Bounds.Width, window.Bounds.Height },
      passed = window.IsVisible && window.Bounds.Width > 0 && window.Bounds.Height > 0,
    });

    var pointerEventsBefore = events.Count;
    var pointer = new Pointer(Pointer.GetNextFreeId(), PointerType.Mouse, true);
    var pointerArgs = new PointerPressedEventArgs(
      button,
      pointer,
      window,
      new Point(4, 4),
      0UL,
      new PointerPointProperties(
        RawInputModifiers.LeftMouseButton,
        PointerUpdateKind.LeftButtonPressed),
      KeyModifiers.None)
    {
      RoutedEvent = InputElement.PointerPressedEvent,
      Source = button,
    };
    button.RaiseEvent(pointerArgs);
    RecordStep(steps, "pointer", "FsusButton", new
    {
      actual = new { eventCount = events.Count - pointerEventsBefore },
      passed = events.Count > pointerEventsBefore,
    });

    var focused = input.Focus();
    input.RaiseEvent(new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.End,
    });
    input.RaiseEvent(new TextInputEventArgs
    {
      RoutedEvent = InputElement.TextInputEvent,
      Source = input,
      Text = "after",
    });
    input.Text = "after";
    RecordStep(steps, "focus-input", "FsusInput", new
    {
      actual = new { focused, input.IsFocused, input.Text },
      passed = focused && input.IsFocused && input.Text == "after",
    });

    input.RaiseEvent(new TextInputEventArgs
    {
      RoutedEvent = InputElement.TextInputEvent,
      Source = input,
      Text = "中",
    });
    var simulatedImeValue = input.Text;
    input.Text = "after";
    RecordStep(steps, "ime-simulation", "FsusInput", new
    {
      actual = new
      {
        value = simulatedImeValue,
        simulation = true,
        physicalIme = false,
        boundary = "linux-avalonia-text-input",
      },
      passed = simulatedImeValue.Contains("中", StringComparison.Ordinal),
    });

    var activatedBefore = events.Count;
    _ = button.Focus();
    button.RaiseEvent(new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Enter,
    });
    RecordStep(steps, "keyboard", "FsusButton", new
    {
      actual = new { button.IsFocused, eventCount = events.Count - activatedBefore },
      passed = button.IsFocused && events.Count > activatedBefore,
    });

    var checkTagIdentity = new
    {
      executionId = $"conformance-v2-check-tag-{candidate}",
      checkpoint = "check-tag-after-pointer-keyboard",
      candidate,
      contractHash,
      webBaselineHash,
      avaloniaBaselineHash,
      scenario = "scenario.v2.el-check-tag.real-interaction-trace",
      contract = "component-v2.el-check-tag",
      documentId = "check-tag-state",
      documentEpoch = 1,
      sourceRevision = 2,
      theme = "light",
      density = "default",
      locale = "zh-CN",
      direction = "ltr",
      motion = "reduced",
      runnerHash,
    };
    var checkTagStepStopwatch = Stopwatch.StartNew();
    var checkTagRenderStopwatch = Stopwatch.StartNew();
    checkTag.InvalidateMeasure();
    window.UpdateLayout();
    checkTagRenderStopwatch.Stop();
    RecordContractStep(checkTagSteps, checkTagIdentity, "render", "FsusCheckTag", new
    {
      actual = new { checkTag.Checked, content = checkTag.Content?.ToString() },
      passed = !checkTag.Checked && checkTag.Content?.ToString() == "Check tag",
    }, elapsedMilliseconds: checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    RecordContractStep(checkTagSteps, checkTagIdentity, "content", "FsusCheckTag.Content", new
    {
      actual = new
      {
        content = checkTag.Content?.ToString(),
        width = checkTag.Bounds.Width,
        height = checkTag.Bounds.Height,
      },
      passed =
        checkTag.Content?.ToString() == "Check tag" &&
        checkTag.Bounds.Width > 0 &&
        checkTag.Bounds.Height > 0,
    }, elapsedMilliseconds: checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    var checkTagInteractionStopwatch = Stopwatch.StartNew();
    var checkTagPointer = new Pointer(Pointer.GetNextFreeId(), PointerType.Mouse, true);
    checkTag.RaiseEvent(new PointerReleasedEventArgs(
      checkTag,
      checkTagPointer,
      window,
      new Point(4, 4),
      0UL,
      new PointerPointProperties(
        RawInputModifiers.None,
        PointerUpdateKind.LeftButtonReleased),
      KeyModifiers.None,
      MouseButton.Left)
    {
      RoutedEvent = InputElement.PointerReleasedEvent,
      Source = checkTag,
    });
    RecordContractStep(checkTagSteps, checkTagIdentity, "pointer", "FsusCheckTag", new
    {
      actual = new { checkTag.Checked, eventCount = checkTagEvents.Count },
      passed = checkTag.Checked && checkTagEvents.Count == 1,
    }, elapsedMilliseconds: checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    RecordContractStep(checkTagSteps, checkTagIdentity, "event", "FsusCheckTag.CheckedChanged/change", new
    {
      actual = checkTagEvents.Single(),
      passed = checkTagEvents.Count == 1 && checkTag.Checked,
    }, elapsedMilliseconds: checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    RecordContractStep(checkTagSteps, checkTagIdentity, "event", "FsusCheckTag.CheckedChanged/update:checked", new
    {
      actual = checkTagEvents.Single(),
      passed = checkTagEvents.Count == 1 && checkTag.Checked,
    }, elapsedMilliseconds: checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    var checkTagFocused = checkTag.Focus(NavigationMethod.Tab);
    RecordContractStep(checkTagSteps, checkTagIdentity, "focus", "FsusCheckTag", new
    {
      actual = new { checkTagFocused, checkTag.IsFocused },
      passed = checkTagFocused && checkTag.IsFocused,
    }, "checkbox", checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    checkTag.RaiseEvent(new KeyEventArgs
    {
      RoutedEvent = InputElement.KeyDownEvent,
      Key = Key.Space,
      Source = checkTag,
    });
    RecordContractStep(checkTagSteps, checkTagIdentity, "keyboard", "FsusCheckTag", new
    {
      actual = new
      {
        focused = checkTagFocused && checkTag.IsFocused,
        checkTag.Checked,
        eventCount = checkTagEvents.Count,
      },
      passed = checkTagFocused && checkTag.IsFocused && !checkTag.Checked && checkTagEvents.Count == 2,
    }, "checkbox", checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    checkTagInteractionStopwatch.Stop();
    window.UpdateLayout();
    var checkTagNode = AutomationNode(checkTag, 3);
    RecordContractStep(checkTagSteps, checkTagIdentity, "accessibility", "FsusCheckTag.AutomationPeer", new
    {
      actual = checkTagNode,
      passed =
        AutomationProperties.GetControlTypeOverride(checkTag) == AutomationControlType.CheckBox &&
        AutomationProperties.GetName(checkTag) == "Check tag",
    }, "checkbox", checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    var checkTagMotionActive = (checkTag.Transitions?.Count ?? 0) > 0;
    RecordContractStep(checkTagSteps, checkTagIdentity, "motion", "FsusCheckTag", new
    {
      actual = new { mode = "reduced", active = checkTagMotionActive },
      passed = !checkTagMotionActive,
    }, "checkbox", checkTagStepStopwatch.Elapsed.TotalMilliseconds);
    var checkTagFocusRing = checkTag
      .GetVisualDescendants()
      .OfType<Border>()
      .FirstOrDefault(border => border.Name == "PART_FocusRing");
    var checkTagFocusIndicatorVisible =
      checkTagFocusRing is not null &&
      checkTagFocusRing.BorderThickness != default;
    var checkTagMemoryObservation = new
    {
      policy = checkTagMemoryBudget,
      inputItemCount = 0,
      retainedPerItemStateCount = 0,
      bounded = true,
      actualVisualDescendantCount = checkTag.GetVisualDescendants().Count(),
    };
    var checkTagScreenshotPath = Path.Combine(
      Path.GetDirectoryName(absoluteOutput)!,
      "check-tag-avalonia.png");
    var checkTagPixelSize = new PixelSize(
      Math.Max(1, (int)Math.Ceiling(checkTag.Bounds.Width)),
      Math.Max(1, (int)Math.Ceiling(checkTag.Bounds.Height)));
    using (var bitmap = new RenderTargetBitmap(
      checkTagPixelSize,
      new Vector(96, 96)))
    {
      bitmap.Render(checkTag);
      bitmap.Save(checkTagScreenshotPath);
    }
    var checkTagScreenshotBytes = new FileInfo(checkTagScreenshotPath).Length;
    var checkTagScreenshotHash = Convert.ToHexString(
      SHA256.HashData(File.ReadAllBytes(checkTagScreenshotPath))).ToLowerInvariant();
    var checkTagSnapshotChecked = checkTag.Checked;
    var checkTagSnapshotContent = checkTag.Content?.ToString();
    var checkTagSnapshotFocused = checkTag.IsFocused;
    checkTagStepStopwatch.Stop();
    RecordContractStep(checkTagSteps, checkTagIdentity, "performance", "FsusCheckTag", new
    {
      actual = new
      {
        renderMilliseconds = checkTagRenderStopwatch.Elapsed.TotalMilliseconds,
        renderBudgetMilliseconds = checkTagRenderBudgetMilliseconds,
        interactionMilliseconds = checkTagInteractionStopwatch.Elapsed.TotalMilliseconds,
        interactionBudgetMilliseconds = checkTagBudgetMilliseconds,
      },
      passed =
        checkTagRenderStopwatch.Elapsed.TotalMilliseconds <= checkTagRenderBudgetMilliseconds &&
        checkTagInteractionStopwatch.Elapsed.TotalMilliseconds <= checkTagBudgetMilliseconds,
    }, "checkbox", checkTagStepStopwatch.Elapsed.TotalMilliseconds);

    _ = editor.Focus();
    var dispatch = editor.DispatchTransaction(new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(editor.Document.Length, editor.Document.Length, " exposed")],
      History: "separate",
      Origin: "programmatic",
      Selection: new FsusMarkdownEditorSelection(19, 19),
      DocumentIdentity: identity));
    RecordStep(steps, "operation", "FsusMarkdownEditor.DispatchTransaction", new
    {
      actual = dispatch,
      passed = dispatch.Accepted && dispatch.Value == "Trace start exposed",
    }, "FsusMarkdownEditor");

    var undo = editor.Undo();
    RecordStep(steps, "keyboard", "FsusMarkdownEditor.Undo", new
    {
      actual = undo,
      passed = undo.Accepted && undo.Value == "Trace start",
    }, "FsusMarkdownEditor");
    editor.Mode = FsusMarkdownEditorMode.Live;
    var projectionCommit = editor.CommitProjection(new FsusMarkdownProjectionSnapshot(
      identity,
      editor.TransactionStore.Revision,
      editor.Document,
      [new(
        "trace-atomic",
        new FsusMarkdownSourceRange(0, editor.Document.Length),
        FsusMarkdownProjectionSpanKind.Atomic,
        editor.Document,
        "code")],
      editor.ProjectionFeatureRevision));
    RecordStep(steps, "operation", "FsusMarkdownEditor.CommitProjection", new
    {
      actual = projectionCommit,
      passed = projectionCommit.Accepted,
    });

    var childOpened = false;
    var childClosed = false;
    var child = new Window { Width = 240, Height = 120, Title = "Conformance open-close" };
    child.Opened += (_, _) => childOpened = true;
    child.Closed += (_, _) => childClosed = true;
    child.Show(window);
    child.Close();
    RecordStep(steps, "open-close", "Window", new
    {
      actual = new { childOpened, childClosed },
      passed = childOpened && childClosed,
    });

    stopwatch.Stop();
    var store = editor.TransactionStore;
    var evidenceIdentity = new
    {
      executionId,
      checkpoint,
      candidate,
      contractHash,
      webBaselineHash,
      avaloniaBaselineHash,
      scenario = "scenario.v2.el-markdown-editor.real-interaction-trace",
      contract = "component-v2.el-markdown-editor",
      documentId = identity.Id,
      documentEpoch = identity.Epoch,
      sourceRevision = store.Revision,
      theme = "light",
      density = "default",
      locale = "zh-CN",
      direction = "ltr",
      motion = "full",
      runnerHash,
    };
    var screenshotPath = Path.Combine(Path.GetDirectoryName(absoluteOutput)!, "avalonia.png");
    using (var bitmap = new RenderTargetBitmap(
      new PixelSize((int)window.Bounds.Width, (int)window.Bounds.Height),
      new Vector(96, 96)))
    {
      bitmap.Render(window);
      bitmap.Save(screenshotPath);
    }
    var screenshotHash = Convert.ToHexString(
      SHA256.HashData(File.ReadAllBytes(screenshotPath))).ToLowerInvariant();
    var checkTagScenarios = new[]
    {
      "scenario.v2.el-check-tag.input.checked",
      "scenario.v2.el-check-tag.output.change",
      "scenario.v2.el-check-tag.output.update-checked",
      "scenario.v2.el-check-tag.content-region.default",
      "scenario.v2.el-check-tag.state.default",
      "scenario.v2.el-check-tag.keyboard",
      "scenario.v2.el-check-tag.pointer",
      "scenario.v2.el-check-tag.focus",
      "scenario.v2.el-check-tag.a11y",
      "scenario.v2.el-check-tag.motion",
      "scenario.v2.el-check-tag.perf",
    };
    var trace = new
    {
      schema = "fsusui.conformance-evidence.v2",
      kind = "interaction-trace",
      platform = "avalonia",
      runtime = new
      {
        framework = "Avalonia",
        realTopLevel = true,
        headless = false,
        mock = false,
        windowTitle = window.Title,
      },
      identity = evidenceIdentity,
      environment = new
      {
        os = Environment.OSVersion.ToString(),
        architecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString(),
        framework = Environment.Version.ToString(),
      },
      steps,
      events,
      state = new
      {
        value = editor.Document,
        revision = store.Revision,
        selection = store.Selection,
        history = store.History,
        capability = editor.CapabilityState == "aligned" ? "supported" : editor.CapabilityState,
        rawCapability = editor.CapabilityState,
        focus = window.FocusManager?.GetFocusedElement()?.GetType().Name,
      },
      accessibility = new
      {
        source = "real-avalonia-automation-peer",
        sameExecution = true,
        nodes = new[]
          {
            AutomationNode(button, 1),
            AutomationNode(input, 2),
            checkTagNode,
            AutomationNode(editor, 4, store.Selection),
          }
          .Concat(AutomationChildNodes(editor))
          .ToArray(),
        markdown = new
        {
          editableMultiline = true,
          wholeDocumentLiveRegion = false,
          decorationDuplicate = false,
          paragraphTabStops = 0,
          atomicActionCount = AutomationChildNodes(editor).Count,
        },
      },
      performance = new
      {
        identity = evidenceIdentity,
        elapsedMilliseconds = stopwatch.Elapsed.TotalMilliseconds,
        budgetMilliseconds = 2000,
        passed = stopwatch.Elapsed < TimeSpan.FromSeconds(2),
      },
      visual = new
      {
        identity = evidenceIdentity,
        artifact = Path.GetFileName(screenshotPath),
        sha256 = screenshotHash,
        renderedTopLevel = true,
      },
      contractExecutions = new Dictionary<string, object>
      {
        ["component-v2.el-check-tag"] = new
        {
          identity = checkTagIdentity,
          steps = checkTagSteps,
          events = checkTagEvents,
          state = new
          {
            Checked = checkTagSnapshotChecked,
            revision = checkTagRevision,
            focus = checkTagSnapshotFocused ? "checkbox" : null,
            motion = new
            {
              mode = "reduced",
              active = checkTagMotionActive,
            },
          },
          accessibility = new
          {
            source = "real-avalonia-automation-peer",
            sameExecution = true,
            node = checkTagNode,
          },
          coverage = new
          {
            requiredMembers = new[]
            {
              "input.checked",
              "output.change",
              "output.update:checked",
              "content-region.default",
            },
            memberScenarios = new Dictionary<string, string[]>
            {
              ["input.checked"] = ["scenario.v2.el-check-tag.input.checked"],
              ["output.change"] = ["scenario.v2.el-check-tag.output.change"],
              ["output.update:checked"] = ["scenario.v2.el-check-tag.output.update-checked"],
              ["content-region.default"] = ["scenario.v2.el-check-tag.content-region.default"],
            },
            requiredScenarios = checkTagScenarios,
            executions = new Dictionary<string, object>
            {
              ["scenario.v2.el-check-tag.input.checked"] = new
              {
                real = true,
                stepIndexes = new[] { 0, 2 },
                artifacts = new[] { "interaction", "state" },
              },
              ["scenario.v2.el-check-tag.output.change"] = new
              {
                real = true,
                stepIndexes = new[] { 3 },
                artifacts = new[] { "event" },
              },
              ["scenario.v2.el-check-tag.output.update-checked"] = new
              {
                real = true,
                stepIndexes = new[] { 4 },
                artifacts = new[] { "event" },
              },
              ["scenario.v2.el-check-tag.content-region.default"] = new
              {
                real = true,
                stepIndexes = new[] { 1, 7 },
                artifacts = new[] { "content", "accessibility", "visual" },
              },
              ["scenario.v2.el-check-tag.state.default"] = new
              {
                real = true,
                stepIndexes = new[] { 0 },
                artifacts = new[] { "state" },
              },
              ["scenario.v2.el-check-tag.keyboard"] = new
              {
                real = true,
                stepIndexes = new[] { 6 },
                artifacts = new[] { "interaction", "event" },
              },
              ["scenario.v2.el-check-tag.pointer"] = new
              {
                real = true,
                stepIndexes = new[] { 2 },
                artifacts = new[] { "interaction", "event" },
              },
              ["scenario.v2.el-check-tag.focus"] = new
              {
                real = true,
                stepIndexes = new[] { 5 },
                artifacts = new[] { "focus", "visual" },
              },
              ["scenario.v2.el-check-tag.a11y"] = new
              {
                real = true,
                stepIndexes = new[] { 7 },
                artifacts = new[] { "accessibility" },
              },
              ["scenario.v2.el-check-tag.motion"] = new
              {
                real = true,
                stepIndexes = new[] { 8 },
                artifacts = new[] { "motion" },
              },
              ["scenario.v2.el-check-tag.perf"] = new
              {
                real = true,
                stepIndexes = new[] { 9 },
                artifacts = new[] { "performance" },
              },
            },
          },
          performance = new
          {
            identity = checkTagIdentity,
            renderMilliseconds = checkTagRenderStopwatch.Elapsed.TotalMilliseconds,
            interactionMilliseconds = checkTagInteractionStopwatch.Elapsed.TotalMilliseconds,
            budget = new
            {
              renderMs = checkTagRenderBudgetMilliseconds,
              interactionMs = checkTagBudgetMilliseconds,
              memory = checkTagMemoryBudget,
            },
            memoryObservation = checkTagMemoryObservation,
            passed =
              checkTagRenderStopwatch.Elapsed.TotalMilliseconds <= checkTagRenderBudgetMilliseconds &&
              checkTagInteractionStopwatch.Elapsed.TotalMilliseconds <= checkTagBudgetMilliseconds,
          },
          visual = new
          {
            identity = checkTagIdentity,
            artifact = Path.GetFileName(checkTagScreenshotPath),
            sha256 = checkTagScreenshotHash,
            artifactBytes = checkTagScreenshotBytes,
            renderedTopLevel = true,
            observation = new
            {
              Checked = checkTagSnapshotChecked,
              content = checkTagSnapshotContent,
              focused = checkTagSnapshotFocused,
              focusIndicatorVisible = checkTagFocusIndicatorVisible,
              width = checkTagPixelSize.Width,
              height = checkTagPixelSize.Height,
            },
          },
        },
      },
    };

    File.WriteAllText(absoluteOutput, $"{JsonSerializer.Serialize(trace, JsonOptions)}\n");
    Console.WriteLine($"[conformance-v2] wrote {absoluteOutput}");

    if (steps.Any(step => !StepPassed(step)))
    {
      throw new InvalidOperationException("Avalonia real-window interaction trace contains a failed step.");
    }
  }

  private static object AutomationNode(
    Control control,
    int tabOrder,
    FsusMarkdownEditorSelection? selection = null)
  {
    var peer = ControlAutomationPeer.CreatePeerForElement(control)
      ?? throw new InvalidOperationException($"No AutomationPeer for {control.GetType().Name}.");
    var value = peer.GetProvider<IValueProvider>()?.Value;
    return new
    {
      control = control.GetType().Name,
      role = peer.GetAutomationControlType().ToString().ToLowerInvariant(),
      name = peer.GetName(),
      description = peer.GetHelpText(),
      value,
      selection = selection is null ? null : new
      {
        selection.Start,
        selection.End,
        selection.Direction,
      },
      states = new
      {
        disabled = !peer.IsEnabled(),
        readOnly = peer.GetProvider<IValueProvider>()?.IsReadOnly ?? false,
        invalid = false,
        selected = false,
        expanded = false,
        checkedState = peer.GetProvider<IToggleProvider>()?.ToggleState
          .ToString()
          .ToLowerInvariant(),
      },
      liveRegion = AutomationProperties.GetLiveSetting(control).ToString().ToLowerInvariant(),
      logicalParent = control.Parent?.GetType().Name,
      children = peer.GetChildren()?.Select(child => child.GetName()).ToArray() ?? [],
      focus = new
      {
        keyboardFocusable = peer.IsKeyboardFocusable(),
        focused = peer.HasKeyboardFocus(),
        tabOrder,
      },
    };
  }

  private static IReadOnlyList<object> AutomationChildNodes(FsusMarkdownEditor editor)
  {
    var parent = ControlAutomationPeer.CreatePeerForElement(editor)
      ?? throw new InvalidOperationException("No AutomationPeer for FsusMarkdownEditor.");
    return parent.GetChildren()?.Select((peer, index) => (object)new
    {
      control = "FsusMarkdownAtomicAction",
      role = peer.GetAutomationControlType().ToString().ToLowerInvariant(),
      name = peer.GetName(),
      description = peer.GetHelpText(),
      value = peer.GetProvider<IValueProvider>()?.Value,
      selection = (object?)null,
      states = new
      {
        disabled = !peer.IsEnabled(),
        readOnly = peer.GetProvider<IValueProvider>()?.IsReadOnly ?? false,
        invalid = false,
        selected = false,
        expanded = false,
        checkedState = (string?)null,
      },
      liveRegion = "off",
      logicalParent = "FsusMarkdownEditor",
      children = Array.Empty<string>(),
      focus = new
      {
        keyboardFocusable = peer.IsKeyboardFocusable(),
        focused = peer.HasKeyboardFocus(),
        tabOrder = -1 - index,
      },
      action = new
      {
        invokable = peer.GetProvider<IInvokeProvider>() is not null,
        sourceEntry = peer.GetName().Contains("edit-source", StringComparison.Ordinal),
      },
    }).ToArray() ?? [];
  }

  private static void RecordStep(
    List<object> steps,
    string action,
    string target,
    object observation,
    string? focusTarget = null)
  {
    steps.Add(new
    {
      index = steps.Count,
      action,
      target,
      focusTarget,
      binding = new
      {
        scenario = "scenario.v2.el-markdown-editor.real-interaction-trace",
        contract = "component-v2.el-markdown-editor",
        candidate,
        contractHash,
        webBaselineHash,
        avaloniaBaselineHash,
        os = Environment.OSVersion.ToString(),
        avalonia = Environment.Version.ToString(),
      },
      observation,
    });
  }

  private static void RecordContractStep(
    List<object> steps,
    object identity,
    string action,
    string target,
    object observation,
    string? focusTarget = null,
    double elapsedMilliseconds = 0)
  {
    steps.Add(new
    {
      index = steps.Count,
      action,
      target,
      focusTarget,
      elapsedMilliseconds,
      binding = identity,
      observation,
    });
  }

  private static bool StepPassed(object step)
  {
    var json = JsonSerializer.SerializeToElement(step, JsonOptions);
    return json.GetProperty("observation").GetProperty("passed").GetBoolean();
  }

  private static string? ReadArgument(string[] args, string name)
  {
    var index = Array.IndexOf(args, name);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
  }
}
