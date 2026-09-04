using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Input;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.Demo;

/// <summary>
/// Required Linux IME evidence harness for the FsusMarkdownEditor native input
/// pipeline (issue #341). Runs headful on a live X display with the OS input
/// method (ibus), injects real key events through XTestFakeKeyEvent, and
/// records the editor's machine trace, document, caret, and clipboard
/// behavior as structured JSON. Synthetic (headless) runs must never be
/// presented as this evidence: the JSON records the full provenance so
/// downstream verifiers can reject anything without a real platform signal.
/// </summary>
internal static class ImeHarnessRunner
{
  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = true,
  };

  private static string outputPath = ".tmp/ime-harness/avalonia-ime-evidence.json";
  private static string candidate = "unknown";

  public static bool IsConfigured { get; private set; }

  public static void Configure(string[] args)
  {
    IsConfigured = true;
    outputPath = ReadArgument(args, "--output") ?? outputPath;
    candidate = ReadArgument(args, "--candidate") ?? candidate;
  }

  public static Window CreateWindow(IClassicDesktopStyleApplicationLifetime lifetime)
  {
    var editor = new FsusMarkdownEditor
    {
      Width = 640,
      Height = 280,
    };
    var platformProbe = new TextBox
    {
      Width = 640,
      Height = 36,
      AcceptsReturn = false,
    };
    var content = new StackPanel
    {
      Spacing = 8,
      Children = { platformProbe, editor },
    };
    var surface = new Border
    {
      Width = 720,
      Height = 380,
      Padding = new Thickness(16),
      Child = content,
    };
    var window = new Window
    {
      Width = 720,
      Height = 380,
      Content = surface,
      Title = "FsusUI IME harness",
      ShowInTaskbar = false,
    };
    AttachTheme(window, surface);

    window.KeyDown += (_, args) =>
    {
      RawKeyLog.Add($"window-keydown:{args.Key}");
    };
    window.Opened += (_, _) =>
    {
      FocusEditorInput(editor);
      _ = RunAsync(lifetime, window, platformProbe, editor);
    };
    return window;
  }

  private static async Task RunAsync(
    IClassicDesktopStyleApplicationLifetime lifetime,
    Window window,
    TextBox platformProbe,
    FsusMarkdownEditor editor)
  {
    var evidence = new ImeEvidence
    {
      Schema = "fsusui.markdown-editor-ime-evidence.v1",
      Provenance = BuildProvenance(editor),
    };
    harnessWindow = window;
    var transactions = 0;
    editor.Transaction += (_, _) => transactions += 1;

    try
    {
      XTest.Initialize();
      XTest.ActivateWindow(window.Title ?? "FsusUI IME harness");

      window.Activate();
      FocusEditorInput(editor);
      var activationDeadline = DateTime.UtcNow.AddSeconds(10);
      while (!window.IsActive && DateTime.UtcNow < activationDeadline)
      {
        await Settle(200);
      }
      if (!window.IsActive)
      {
        throw new InvalidOperationException(
          "Harness window did not become the active window; refusing to " +
          "inject key events while another window owns focus.");
      }

      await Settle(600);
      evidence.Provenance.InputMethodEngine = SelectIbusEngine("libpinyin");
      editor.NativeInputProvenance =
        $"linux-x11-ibus:{evidence.Provenance.InputMethodEngine}";
      evidence.Provenance.EditorProvenance = editor.NativeInputProvenance;
      evidence.Provenance.RawKeyEvents = RawKeyLog;
      await Settle(800);

      platformProbe.Focus();
      await Settle(300);
      SelectIbusEngine("libpinyin");
      XTest.TypeText("nihao");
      await Settle(800);
      XTest.Key("space", true);
      XTest.Key("space", false);
      await WaitFor(() => !string.IsNullOrEmpty(platformProbe.Text), 3000);
      evidence.Provenance.PlatformProbeText = platformProbe.Text ?? string.Empty;
      if (platformProbe.Text != "你好")
      {
        throw new InvalidOperationException(
          $"Stock Avalonia TextBox did not receive native libpinyin composition; " +
          $"observed '{platformProbe.Text}'. The host cell cannot claim native IME evidence.");
      }
      FocusEditorInput(editor);
      await Settle(300);
      SelectIbusEngine("libpinyin");

      evidence.Scenarios.Add(await PinyinCompositionCommit(editor, () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await PinyinCompositionCancel(editor, () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await PinyinCompositionUndo(editor, () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await StaleCompositionAfterDocumentSwitch(
        editor,
        () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await ScrolledHighDpiCandidateCaret(
        editor,
        () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await ClipboardPlainPaste(editor, () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await ClipboardHtmlFallsBackToPlain(
        editor,
        () => transactions));
      await Reset(editor, () => transactions);
      evidence.Scenarios.Add(await ClipboardUnicodeNoDrift(editor, () => transactions));
    }
    catch (Exception exception)
    {
      evidence.Fatal = exception.ToString();
    }
    finally
    {
      XTest.Dispose();
      evidence.NativeProvenanceAccepted = HasNativePlatformProvenance(evidence.Provenance);
      evidence.AllPassed = evidence.Fatal is null &&
        evidence.NativeProvenanceAccepted &&
        evidence.Scenarios.Count > 0 &&
        evidence.Scenarios.All(scenario => scenario.Pass);
      WriteEvidence(evidence, outputPath);
      Console.WriteLine(
        $"IME harness finished: allPassed={evidence.AllPassed} " +
        $"scenarios={evidence.Scenarios.Count} output={outputPath}");
      foreach (var scenario in evidence.Scenarios)
      {
        Console.WriteLine(
          $"  {scenario.Id}: pass={scenario.Pass} document='{scenario.DocumentAfter}'" +
          (scenario.Reasons.Count > 0 ? $" reasons=[{string.Join("; ", scenario.Reasons)}]" : string.Empty));
      }
      Dispatcher.UIThread.Post(() => lifetime.Shutdown(evidence.AllPassed ? 0 : 1));
    }
    GC.KeepAlive(window);
  }

  private static async Task<Scenario> PinyinCompositionCommit(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "pinyin-composition-commit",
      Title = "Real ibus pinyin preedit composes and commits 你好 without loss or duplication",
    };
    RequireActive();
    var before = transactions();
    XTest.TypeText("nihao");
    await WaitFor(() => editor.NativePhase == "composing", 6000);
    scenario.PhaseDuringComposition = editor.NativePhase;
    scenario.CandidateCaret = CandidateCaret(editor);
    var composingTrace = editor.NativeTrace
      .Where(entry => entry.Kind is FsusMarkdownNativeEventKind.CompositionStart or FsusMarkdownNativeEventKind.CompositionUpdate)
      .ToList();
    RequireActive();
    XTest.Key("space", true);
    XTest.Key("space", false);
    await WaitFor(() => editor.NativePhase == "idle", 6000);
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.PhaseAfter = editor.NativePhase;
    scenario.Transactions = transactions() - before;
    scenario.EditorTrace = editor.NativeTrace
      .Select(TraceLine)
      .ToList();
    // XIM may clear preedit before delivering committed text. In that valid
    // ordering the machine records one ignored composition-end while waiting
    // for text, followed by the single composition-end commit. Qualify the
    // semantic commit, not the platform callback count.
    var commitTrace = editor.NativeTrace.Count(entry =>
      entry.Kind == FsusMarkdownNativeEventKind.CompositionEnd &&
      entry.Action == FsusMarkdownNativeAction.Commit);
    scenario.Pass =
      scenario.PhaseDuringComposition == "composing" &&
      composingTrace.Count >= 2 &&
      scenario.DocumentAfter == "你好" &&
      scenario.CaretAfter == 2 &&
      scenario.PhaseAfter == "idle" &&
      scenario.Transactions == 1 &&
      commitTrace == 1;
    if (scenario.PhaseDuringComposition != "composing")
    {
      scenario.Reasons.Add(
        $"phase during preedit '{scenario.PhaseDuringComposition}' != 'composing' " +
        "(the OS preedit must drive the machine)");
    }
    if (scenario.DocumentAfter != "你好")
    {
      scenario.Reasons.Add($"document '{scenario.DocumentAfter}' != '你好' (commit must be lossless and unduplicated)");
    }
    if (scenario.Transactions != 1)
    {
      scenario.Reasons.Add($"transactions {scenario.Transactions} != 1 (one commit, one transaction)");
    }
    if (commitTrace != 1)
    {
      scenario.Reasons.Add($"composition commits {commitTrace} != 1 (native callback ordering must still yield one semantic commit)");
    }
    return scenario;
  }

  private static async Task<Scenario> PinyinCompositionCancel(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "pinyin-composition-cancel",
      Title = "Deleting real preedit cancels without dispatching or dropping characters",
    };
    RequireActive();
    var before = transactions();
    XTest.TypeText("ni");
    await WaitFor(() => editor.NativePhase == "composing", 6000);
    scenario.PhaseDuringComposition = editor.NativePhase;
    RequireActive();
    XTest.Key("BackSpace", true);
    XTest.Key("BackSpace", false);
    XTest.Key("BackSpace", true);
    XTest.Key("BackSpace", false);
    await Settle(250);
    // A following non-text key deterministically closes the pending empty
    // composition without a timer or synthetic composition callback.
    XTest.Key("Escape", true);
    XTest.Key("Escape", false);
    await WaitFor(() => editor.NativePhase == "idle", 6000);
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.PhaseAfter = editor.NativePhase;
    scenario.Transactions = transactions() - before;
    scenario.EditorTrace = editor.NativeTrace
      .Select(TraceLine)
      .ToList();
    scenario.Pass =
      scenario.PhaseDuringComposition == "composing" &&
      scenario.DocumentAfter == "" &&
      scenario.CaretAfter == 0 &&
      scenario.PhaseAfter == "idle" &&
      scenario.Transactions == 0;
    if (scenario.Transactions != 0)
    {
      scenario.Reasons.Add($"transactions {scenario.Transactions} != 0 (a cancelled composition must not dispatch)");
    }
    if (scenario.DocumentAfter != "")
    {
      scenario.Reasons.Add($"document '{scenario.DocumentAfter}' != '' (cancel must not leave preedit text)");
    }
    return scenario;
  }

  private static async Task<Scenario> PinyinCompositionUndo(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "pinyin-composition-undo",
      Title = "Undo after a real composition commit reverts exactly one commit",
    };
    RequireActive();
    var before = transactions();
    XTest.TypeText("nihao");
    await WaitFor(() => editor.NativePhase == "composing", 6000);
    RequireActive();
    XTest.Key("space", true);
    XTest.Key("space", false);
    await WaitFor(() => editor.NativePhase == "idle" && transactions() - before > 0, 6000);
    var committed = editor.Document;
    scenario.EditorTrace = editor.NativeTrace
      .Select(TraceLine)
      .ToList();
    RequireActive();
    XTest.Key("Control_L", true);
    XTest.Key("z", true);
    XTest.Key("z", false);
    XTest.Key("Control_L", false);
    await WaitFor(() => editor.Document == "", 6000);
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.PhaseAfter = editor.NativePhase;
    scenario.Transactions = transactions() - before;
    scenario.Pass =
      committed == "你好" &&
      scenario.DocumentAfter == "" &&
      scenario.CaretAfter == 0 &&
      scenario.Transactions == 2;
    if (committed != "你好")
    {
      scenario.Reasons.Add($"commit produced '{committed}' instead of '你好'");
    }
    if (scenario.DocumentAfter != "")
    {
      scenario.Reasons.Add(
        $"document after undo '{scenario.DocumentAfter}' != '' (undo must revert exactly the commit)");
    }
    return scenario;
  }

  private static async Task<Scenario> StaleCompositionAfterDocumentSwitch(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "same-source-different-document-stale-rejection",
      Title = "Composition state from a previous document never lands in the new one",
    };
    RequireActive();
    editor.Document = "before";
    await Settle(300);
    var before = transactions();
    XTest.TypeText("ni");
    await Settle(900);
    scenario.PhaseDuringComposition = editor.NativePhase;

    editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("ime-doc-b", 1);
    editor.Document = "second";
    await Settle(600);
    before = transactions();

    XTest.Key("Escape", true);
    XTest.Key("Escape", false);
    RequireActive();
    XTest.Key("space", true);
    XTest.Key("space", false);
    await WaitFor(() => editor.NativePhase == "idle" && transactions() - before > 0, 6000);
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.PhaseAfter = editor.NativePhase;
    scenario.Transactions = transactions() - before;
    scenario.EditorTrace = editor.NativeTrace
      .Select(TraceLine)
      .ToList();
    var rejectedOrphaned = editor.NativeTrace.Any(entry =>
      entry.Rejected is "orphaned-composition" or "stale-document");
    scenario.Pass =
      scenario.DocumentAfter == "second" &&
      rejectedOrphaned &&
      scenario.Transactions == 0;
    if (scenario.DocumentAfter != "second")
    {
      scenario.Reasons.Add($"document '{scenario.DocumentAfter}' != 'second' (stale composition must not land)");
    }
    if (!rejectedOrphaned)
    {
      scenario.Reasons.Add("no orphaned-composition/stale-document rejection in the machine trace");
    }
    return scenario;
  }

  private static async Task<Scenario> ClipboardPlainPaste(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "clipboard-plain-paste",
      Title = "Ctrl+V through the OS clipboard inserts plain text exactly once",
    };
    RequireActive();
    const string payload = "pasted plain";
    SetClipboard(payload);
    await Settle(500);
    RequireActive();
    var before = transactions();
    XTest.Combo("Control_L", "v");
    await WaitFor(() => editor.Document == payload, 6000);
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.Transactions = transactions() - before;
    scenario.Pass =
      scenario.DocumentAfter == payload &&
      scenario.CaretAfter == payload.Length &&
      scenario.Transactions == 1;
    if (scenario.DocumentAfter != payload)
    {
      scenario.Reasons.Add($"document '{scenario.DocumentAfter}' != '{payload}'");
    }
    return scenario;
  }

  private static async Task<Scenario> ScrolledHighDpiCandidateCaret(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "candidate-caret-scrolled-high-dpi",
      Title = "Native IME candidate caret stays in the scrolled viewport at host DPI",
    };
    var document = string.Join('\n', Enumerable.Range(0, 80).Select(index =>
      $"line {index:D2} 你好 😀"));
    editor.Document = document;
    await Settle(500);
    editor.ScrollPosition = new Vector(0, Math.Max(1, editor.ScrollExtentHeight - editor.ScrollViewportHeight));
    FocusEditorInput(editor);
    await Settle(300);
    var before = transactions();
    RequireActive();
    XTest.TypeText("ni");
    await WaitFor(() => editor.NativePhase == "composing", 6000);
    scenario.PhaseDuringComposition = editor.NativePhase;
    scenario.CandidateCaret = CandidateCaret(editor);
    XTest.Key("BackSpace", true);
    XTest.Key("BackSpace", false);
    XTest.Key("BackSpace", true);
    XTest.Key("BackSpace", false);
    await Settle(250);
    XTest.Key("Escape", true);
    XTest.Key("Escape", false);
    await WaitFor(() => editor.NativePhase == "idle", 6000);
    scenario.PhaseAfter = editor.NativePhase;
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.Transactions = transactions() - before;
    scenario.EditorTrace = editor.NativeTrace.Select(TraceLine).ToList();
    scenario.Pass =
      scenario.PhaseDuringComposition == "composing" &&
      scenario.PhaseAfter == "idle" &&
      scenario.DocumentAfter == document &&
      scenario.Transactions == 0 &&
      scenario.CandidateCaret is
      {
        Valid: true,
        RenderScaling: > 1,
        ScrollOffset: [_, > 0],
      };
    if (scenario.CandidateCaret?.Valid != true)
    {
      scenario.Reasons.Add("candidate caret was outside the live top-level viewport");
    }
    if (scenario.CandidateCaret?.RenderScaling <= 1)
    {
      scenario.Reasons.Add("host render scaling did not exercise high-DPI coordinates");
    }
    if (scenario.CandidateCaret?.ScrollOffset.ElementAtOrDefault(1) <= 0)
    {
      scenario.Reasons.Add("editor did not expose a non-zero virtual viewport offset");
    }
    return scenario;
  }

  private static async Task<Scenario> ClipboardHtmlFallsBackToPlain(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "clipboard-html-falls-back-to-plain",
      Title = "HTML clipboard payload obeys the security contract (plain fallback, no script)",
    };
    RequireActive();
    await SetClipboardHtmlAndPlain(
      editor,
      plain: "rich plain",
      html: "<b>rich</b><script>alert(1)</script>");
    try
    {
      await Settle(700);
      RequireActive();
      var before = transactions();
      XTest.Combo("Control_L", "v");
      await WaitFor(() => editor.Document != "", 6000);
      scenario.DocumentAfter = editor.Document;
      scenario.Transactions = transactions() - before;
    }
    finally
    {
    }
    scenario.Pass =
      scenario.DocumentAfter == "rich plain" &&
      !scenario.DocumentAfter.Contains("<b>", StringComparison.Ordinal) &&
      !scenario.DocumentAfter.Contains("script", StringComparison.Ordinal);
    if (scenario.DocumentAfter != "rich plain")
    {
      scenario.Reasons.Add($"document '{scenario.DocumentAfter}' != 'rich plain' (rich HTML must fall back to plain)");
    }
    return scenario;
  }

  private static async Task<Scenario> ClipboardUnicodeNoDrift(
    FsusMarkdownEditor editor,
    Func<int> transactions)
  {
    var scenario = new Scenario
    {
      Id = "clipboard-unicode-no-drift",
      Title = "CRLF/BOM/CJK/emoji/combining/RTL survive a real clipboard paste byte-exactly",
    };
    RequireActive();
    const string payload = "﻿a\r\nb 你好 😀 שלום é";
    SetClipboard(payload);
    await Settle(500);
    RequireActive();
    var before = transactions();
    XTest.Combo("Control_L", "v");
    await WaitFor(() => editor.Document == payload, 6000);
    scenario.DocumentAfter = editor.Document;
    scenario.CaretAfter = editor.TransactionStore.Selection.Start;
    scenario.Transactions = transactions() - before;
    scenario.Pass =
      scenario.DocumentAfter == payload &&
      scenario.CaretAfter == payload.Length;
    if (scenario.DocumentAfter != payload)
    {
      scenario.Reasons.Add(
        $"document drifted: expected {Describe(payload)} observed {Describe(scenario.DocumentAfter)}");
    }
    return scenario;
  }

  private static async Task Reset(FsusMarkdownEditor editor, Func<int> transactions)
  {
    editor.Document = "";
    await Settle(300);
    FocusEditorInput(editor);
    GC.KeepAlive(transactions);
  }

  private static void FocusEditorInput(FsusMarkdownEditor editor)
  {
    var owner = editor.GetVisualDescendants().OfType<TextBox>().SingleOrDefault()
      ?? throw new InvalidOperationException("Markdown editor native TextBox owner is missing");
    if (!owner.Focus())
    {
      throw new InvalidOperationException("Markdown editor native TextBox owner refused focus");
    }
  }

  private static Window? harnessWindow;

  private static void RequireActive()
  {
    if (harnessWindow is null)
    {
      throw new InvalidOperationException("Harness window missing");
    }
    var deadline = DateTime.UtcNow.AddSeconds(5);
    while (!harnessWindow.IsActive)
    {
      XTest.ActivateWindow(harnessWindow.Title ?? "FsusUI IME harness");
      harnessWindow.Activate();
      Thread.Sleep(100);
      if (DateTime.UtcNow > deadline)
      {
        throw new InvalidOperationException(
          "Harness window lost activation mid-run and could not regain it; " +
          "aborting before injecting further key events so they cannot land " +
          "in another application.");
      }
    }
  }

  private static async Task<bool> WaitFor(Func<bool> condition, int timeoutMilliseconds)
  {
    var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMilliseconds);
    while (DateTime.UtcNow < deadline)
    {
      if (condition())
      {
        await Settle(150);
        return true;
      }
      await Settle(80);
    }
    return condition();
  }

  private static async Task Settle(int milliseconds)
  {
    await Dispatcher.UIThread.InvokeAsync(() => { });
    await Task.Delay(milliseconds);
    await Dispatcher.UIThread.InvokeAsync(() => { });
  }

  private static string TraceLine(FsusMarkdownNativeTraceEntry entry) =>
    $"{FsusMarkdownNativeEventMachine.KindToken(entry.Kind)}:" +
    $"{FsusMarkdownNativeEventMachine.ActionToken(entry.Action)}:" +
    $"{FsusMarkdownNativeEventMachine.PhaseToken(entry.Phase)}" +
    (entry.Rejected is null ? string.Empty : $":rejected={entry.Rejected}");

  private static CandidateCaretEvidence CandidateCaret(FsusMarkdownEditor editor)
  {
    var rect = editor.NativeCandidateCaretRect;
    var visual = editor.NativeCandidateCaretVisual;
    var screen = visual?.PointToScreen(rect.TopLeft) ?? default;
    var topLevel = visual is null ? null : TopLevel.GetTopLevel(visual);
    var viewportTopLeft = topLevel?.PointToScreen(default) ?? default;
    var viewportBottomRight = topLevel?.PointToScreen(
      new Point(topLevel.Bounds.Width, topLevel.Bounds.Height)) ?? default;
    return new CandidateCaretEvidence
    {
      LocalRect = new[] { rect.X, rect.Y, rect.Width, rect.Height },
      ScreenPoint = new[] { (double)screen.X, (double)screen.Y },
      RenderScaling = topLevel?.RenderScaling ?? 0,
      ScrollOffset = new[] { editor.ScrollPosition.X, editor.ScrollPosition.Y },
      ScreenViewport = new[]
      {
        (double)viewportTopLeft.X,
        (double)viewportTopLeft.Y,
        (double)viewportBottomRight.X,
        (double)viewportBottomRight.Y,
      },
      Valid = visual is not null && rect.Height > 0 &&
        screen.X >= viewportTopLeft.X && screen.Y >= viewportTopLeft.Y &&
        screen.X <= viewportBottomRight.X && screen.Y <= viewportBottomRight.Y,
    };
  }

  private static void SetClipboard(string text)
  {
    Run("xclip", ["-selection", "clipboard", "-i"], text);
  }

  internal static List<string> RawKeyLog { get; } = [];

  private static async Task SetClipboardHtmlAndPlain(
    FsusMarkdownEditor editor,
    string plain,
    string html)
  {
    var clipboard = TopLevel.GetTopLevel(editor)?.Clipboard
      ?? throw new InvalidOperationException("Harness clipboard is unavailable");
    var transfer = new DataTransfer();
    var item = new DataTransferItem();
    item.Set(DataFormat.Text, plain);
    item.Set(DataFormat.CreateStringPlatformFormat("text/html"), html);
    transfer.Add(item);
    await clipboard.SetDataAsync(transfer);
  }

  private static void Run(string fileName, string[] arguments, string input)
  {
    var process = Process.Start(new ProcessStartInfo
    {
      FileName = fileName,
      Arguments = string.Join(' ', arguments),
      RedirectStandardInput = true,
      RedirectStandardError = true,
      UseShellExecute = false,
    }) ?? throw new InvalidOperationException($"Failed to start {fileName}");
    process.StandardInput.Write(input);
    process.StandardInput.Close();
    if (!process.WaitForExit(5000))
    {
      process.Kill();
      throw new InvalidOperationException($"{fileName} timed out");
    }
    if (process.ExitCode != 0)
    {
      throw new InvalidOperationException(
        $"{fileName} exited {process.ExitCode}: {process.StandardError.ReadToEnd()}");
    }
  }

  private static string ReadIbusEngine()
  {
    try
    {
      var process = Process.Start(new ProcessStartInfo
      {
        FileName = "ibus",
        Arguments = "engine",
        RedirectStandardOutput = true,
        UseShellExecute = false,
      }) ?? throw new InvalidOperationException("Failed to start ibus");
      _ = process.WaitForExit(5000);
      return process.StandardOutput.ReadToEnd().Trim();
    }
    catch (Exception exception)
    {
      return $"unknown ({exception.GetType().Name})";
    }
  }

  private static string SelectIbusEngine(string engine)
  {
    for (var attempt = 0; attempt < 3; attempt += 1)
    {
      using var process = Process.Start(new ProcessStartInfo
      {
        FileName = "ibus",
        ArgumentList = { "engine", engine },
        RedirectStandardError = true,
        UseShellExecute = false,
      }) ?? throw new InvalidOperationException("Failed to start ibus engine selector");
      _ = process.WaitForExit(3000);
      Thread.Sleep(200);
      var selected = ReadIbusEngine();
      if (string.Equals(selected, engine, StringComparison.Ordinal))
      {
        return selected;
      }
    }
    throw new InvalidOperationException(
      $"Could not select required ibus engine '{engine}'; observed '{ReadIbusEngine()}'");
  }

  private static ImeProvenance BuildProvenance(FsusMarkdownEditor editor)
  {
    var display = Environment.GetEnvironmentVariable("DISPLAY") ?? "unset";
    var xServer = ImeHarnessPlatformProvenance.DetectXServer(display);
    return new ImeProvenance
    {
      Kind = "linux-x11-ibus",
      Platform = xServer is null
        ? $"unverified X11 display {display} (Avalonia.Desktop UsePlatformDetect)"
        : $"{xServer.Kind} {xServer.Display} (Avalonia.Desktop UsePlatformDetect)",
      InputMethod = "ibus (XIM bridge: ibus-x11)",
      InputMethodEngine = "unknown",
      Injection = "XTestFakeKeyEvent (libXtst) — real key events through the X server input pipeline",
      Display = display,
      SessionType = Environment.GetEnvironmentVariable("XDG_SESSION_TYPE") ?? "unset",
      ScreenScaleFactors =
        Environment.GetEnvironmentVariable("AVALONIA_SCREEN_SCALE_FACTORS") ?? "system",
      XModifiers = Environment.GetEnvironmentVariable("XMODIFIERS") ?? "unset",
      XServerKind = xServer?.Kind ?? "unverified",
      XServerPid = xServer?.ProcessId,
      HostOs = Environment.OSVersion.ToString(),
      CandidateSha = candidate,
      EditorProvenance = editor.NativeInputProvenance,
    };
  }

  private static bool HasNativePlatformProvenance(ImeProvenance provenance) =>
    OperatingSystem.IsLinux() &&
    provenance.Kind == "linux-x11-ibus" &&
    provenance.InputMethodEngine == "libpinyin" &&
    provenance.PlatformProbeText == "你好" &&
    provenance.EditorProvenance == "linux-x11-ibus:libpinyin" &&
    provenance.Display is not ("" or "unset") &&
    provenance.XModifiers == "@im=ibus" &&
    ImeHarnessPlatformProvenance.IsAcceptedXServer(
      provenance.XServerKind,
      provenance.XServerPid) &&
    provenance.CandidateSha.Length == 40 &&
    provenance.CandidateSha.All(Uri.IsHexDigit) &&
    provenance.RawKeyEvents is { Count: > 0 } &&
    provenance.Injection.Contains("XTestFakeKeyEvent", StringComparison.Ordinal) &&
    !provenance.Platform.Contains("headless", StringComparison.OrdinalIgnoreCase);

  private static void WriteEvidence(ImeEvidence evidence, string path)
  {
    var directory = Path.GetDirectoryName(Path.GetFullPath(path));
    if (!string.IsNullOrEmpty(directory))
    {
      Directory.CreateDirectory(directory);
    }
    File.WriteAllText(path, JsonSerializer.Serialize(evidence, JsonOptions));
  }

  private static string? ReadArgument(string[] args, string name)
  {
    for (var index = 0; index < args.Length - 1; index += 1)
    {
      if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
      {
        return args[index + 1];
      }
    }
    return null;
  }

  private static void AttachTheme(Window window, Border surface)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions
    {
      Variant = FsusThemeVariant.Light,
      MotionMode = FsusMotionMode.Reduced,
    });
    window.Resources.MergedDictionaries.Add(resources);
    window.Resources.MergedDictionaries.Add(
      new ResourceInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
      {
        Source = new Uri(
          "avares://FsusUI.Avalonia.Themes/Themes/FsusLight.axaml"),
      });
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.Demo"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    surface.Background = new SolidColorBrush(Colors.White);
  }

  private static string Describe(string value) =>
    string.Join(' ', value.Select(character =>
      $"U+{(int)character:X04}"));

  private sealed class ImeEvidence
  {
    public string Schema { get; set; } = "";

    public ImeProvenance Provenance { get; set; } = new();

    public List<Scenario> Scenarios { get; set; } = [];

    public bool NativeProvenanceAccepted { get; set; }

    public bool AllPassed { get; set; }

    public string? Fatal { get; set; }
  }

  private sealed class ImeProvenance
  {
    public string Kind { get; set; } = "";

    public string Platform { get; set; } = "";

    public string InputMethod { get; set; } = "";

    public string InputMethodEngine { get; set; } = "";

    public string Injection { get; set; } = "";

    public string Display { get; set; } = "";

    public string SessionType { get; set; } = "";

    public string ScreenScaleFactors { get; set; } = "";

    public string XModifiers { get; set; } = "";

    public string XServerKind { get; set; } = "";

    public int? XServerPid { get; set; }

    public string HostOs { get; set; } = "";

    public string CandidateSha { get; set; } = "";

    public string EditorProvenance { get; set; } = "";

    public string PlatformProbeText { get; set; } = "";

    public List<string>? RawKeyEvents { get; set; } = [];
  }

  private sealed class Scenario
  {
    public string Id { get; set; } = "";

    public string Title { get; set; } = "";

    public string? PhaseDuringComposition { get; set; }

    public string? PhaseAfter { get; set; }

    public string? DocumentAfter { get; set; }

    public int? CaretAfter { get; set; }

    public int? Transactions { get; set; }

    public List<string>? EditorTrace { get; set; }

    public CandidateCaretEvidence? CandidateCaret { get; set; }

    public List<string> Reasons { get; set; } = [];

    public bool Pass { get; set; }
  }

  private sealed class CandidateCaretEvidence
  {
    public double[] LocalRect { get; set; } = [];

    public double[] ScreenPoint { get; set; } = [];

    public double RenderScaling { get; set; }

    public double[] ScrollOffset { get; set; } = [];

    public double[] ScreenViewport { get; set; } = [];

    public bool Valid { get; set; }
  }

  /// <summary>
  /// Real X server input injection through libXtst. The synthetic
  /// Avalonia.Headless keyboard helpers are deliberately not used: the
  /// required evidence must pass through the OS input pipeline (X server,
  /// XIM/ibus) exactly like a physical keyboard.
  /// </summary>
  internal static class XTest
  {
    private static IntPtr display;

    public static void Initialize()
    {
      display = XOpenDisplay(null);
      if (display == IntPtr.Zero)
      {
        throw new InvalidOperationException(
          "XOpenDisplay failed: the IME harness requires a live X display " +
          "(DISPLAY must point at XWayland or an X server with ibus).");
      }
    }

    public static void Dispose()
    {
      if (display != IntPtr.Zero)
      {
        _ = XCloseDisplay(display);
        display = IntPtr.Zero;
      }
    }

    public static void Key(string keysym, bool press) => SendKey(keysym, press);

    public static void ActivateWindow(string title)
    {
      if (display == IntPtr.Zero)
      {
        throw new InvalidOperationException("XTest is not initialized");
      }
      var root = XDefaultRootWindow(display);
      var window = FindWindow(root, title);
      if (window == IntPtr.Zero)
      {
        throw new InvalidOperationException($"Could not find X11 harness window '{title}'");
      }
      _ = XRaiseWindow(display, window);
      _ = XSetInputFocus(display, window, 1, 0);
      _ = XSync(display, false);
    }

    public static void Combo(string modifierKeysym, string keysym)
    {
      SendKey(modifierKeysym, true);
      SendKey(keysym, true);
      SendKey(keysym, false);
      SendKey(modifierKeysym, false);
    }

    public static void TypeText(string text)
    {
      foreach (var character in text)
      {
        var keysym = character.ToString();
        SendKey(keysym, true);
        SendKey(keysym, false);
      }
    }

    private static void SendKey(string keysymName, bool press)
    {
      if (display == IntPtr.Zero)
      {
        throw new InvalidOperationException("XTest is not initialized");
      }
      var keysym = XStringToKeysym(keysymName);
      if (keysym == 0)
      {
        throw new InvalidOperationException($"Unknown keysym '{keysymName}'");
      }
      var keycode = XKeysymToKeycode(display, keysym);
      if (keycode == 0)
      {
        throw new InvalidOperationException(
          $"No keycode maps to keysym '{keysymName}' in the current keymap");
      }
      RawKeyLog.Add($"xtest:{keysymName}:{(press ? "down" : "up")}");
      var sent = XTestFakeKeyEvent(display, keycode, press, 0);
      if (sent == 0)
      {
        throw new InvalidOperationException(
          $"XTestFakeKeyEvent failed for keysym '{keysymName}' (press={press})");
      }
      _ = XSync(display, false);
    }

    private static IntPtr FindWindow(IntPtr parent, string title)
    {
      if (XFetchName(display, parent, out var namePointer) != 0 && namePointer != IntPtr.Zero)
      {
        try
        {
          if (string.Equals(Marshal.PtrToStringAnsi(namePointer), title, StringComparison.Ordinal))
          {
            return parent;
          }
        }
        finally
        {
          _ = XFree(namePointer);
        }
      }
      if (XQueryTree(display, parent, out _, out _, out var children, out var count) == 0)
      {
        return IntPtr.Zero;
      }
      try
      {
        for (var index = 0u; index < count; index += 1)
        {
          var child = Marshal.ReadIntPtr(children, checked((int)index * IntPtr.Size));
          var match = FindWindow(child, title);
          if (match != IntPtr.Zero)
          {
            return match;
          }
        }
      }
      finally
      {
        if (children != IntPtr.Zero)
        {
          _ = XFree(children);
        }
      }
      return IntPtr.Zero;
    }

    [DllImport("libX11.so.6")]
    private static extern IntPtr XOpenDisplay(string? display);

    [DllImport("libX11.so.6")]
    private static extern IntPtr XDefaultRootWindow(IntPtr display);

    [DllImport("libX11.so.6")]
    private static extern int XFetchName(IntPtr display, IntPtr window, out IntPtr name);

    [DllImport("libX11.so.6")]
    private static extern int XQueryTree(
      IntPtr display,
      IntPtr window,
      out IntPtr root,
      out IntPtr parent,
      out IntPtr children,
      out uint childCount);

    [DllImport("libX11.so.6")]
    private static extern int XRaiseWindow(IntPtr display, IntPtr window);

    [DllImport("libX11.so.6")]
    private static extern int XSetInputFocus(IntPtr display, IntPtr window, int revertTo, ulong time);

    [DllImport("libX11.so.6")]
    private static extern int XFree(IntPtr data);

    [DllImport("libX11.so.6")]
    private static extern int XCloseDisplay(IntPtr display);

    [DllImport("libX11.so.6")]
    private static extern ulong XStringToKeysym(string keysymName);

    [DllImport("libX11.so.6")]
    private static extern uint XKeysymToKeycode(IntPtr display, ulong keysym);

    [DllImport("libX11.so.6")]
    private static extern int XSync(IntPtr display, bool discard);

    [DllImport("libXtst.so.6")]
    private static extern int XTestFakeKeyEvent(
      IntPtr display,
      uint keycode,
      bool press,
      ulong delay);
  }
}
