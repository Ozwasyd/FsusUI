using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Input.TextInput;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

/// <summary>
/// Headless behavior tests for the shared native input pipeline (issue #341).
/// These prove wiring semantics: decorator installation, composition freeze,
/// stale-commit rejection, clipboard priority, and pair dispatch. They are
/// synthetic by definition and must never be presented as the required real
/// Linux IME evidence; that evidence comes from the IME harness with
/// NativeInputProvenance recording the platform.
/// </summary>
public class FsusMarkdownEditorNativeInputHeadlessTests
{
  [AvaloniaFact]
  public void ImeClientRequestIsDecoratedAndPreeditDrivesTheMachine()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var (client, transactionCount) = RequestClient(editor);
      Assert.IsType<FsusMarkdownEditorTextInputMethodClient>(client);
      Assert.True(editor.NativeCandidateCaretRect.Height > 0);
      Assert.NotNull(editor.NativeCandidateCaretVisual);

      client!.SetPreeditText("你");
      Assert.Equal("composing", editor.NativePhase);
      Assert.Equal(0, transactionCount());

      client.SetPreeditText("你好");
      Assert.Equal("composing", editor.NativePhase);

      client.SetPreeditText(null);
      window.KeyTextInput("你好");
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("你好", editor.Document);
      Assert.Equal(2, editor.TransactionStore.Selection.Start);
      Assert.Equal("idle", editor.NativePhase);
      Assert.Equal(1, transactionCount());
      Assert.Equal(1, editor.TransactionStore.History.UndoDepth);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void NativeCommitBeforePreeditClearUsesTheFrozenSourceSelectionOnce()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var (client, transactionCount) = RequestClient(editor);
      client!.SetPreeditText("你好");

      // Linux ibus can deliver committed TextInput before clearing preedit.
      // The TextBox selection includes the preedit span at this point, so the
      // editor must use its frozen source selection instead.
      window.KeyTextInput("你好");
      client.SetPreeditText(null);
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("你好", editor.Document);
      Assert.Equal("idle", editor.NativePhase);
      Assert.Equal(1, transactionCount());
      Assert.Equal(1, editor.TransactionStore.History.UndoDepth);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void EmptyPreeditThenNonTextKeyClosesCancellationWithoutTransaction()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var (client, transactionCount) = RequestClient(editor);
      client!.SetPreeditText("ni");
      client.SetPreeditText(null);
      Assert.Equal("committing", editor.NativePhase);

      window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
      window.KeyRelease(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
      Dispatcher.UIThread.RunJobs();

      Assert.Equal(string.Empty, editor.Document);
      Assert.Equal("idle", editor.NativePhase);
      Assert.Equal(0, transactionCount());
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void ShrinkingScrolledDocumentBoundsTheRestoredSourceAnchor()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Document = string.Join('\n', Enumerable.Range(0, 80).Select(index => $"line {index}"));
      Dispatcher.UIThread.RunJobs();
      editor.ScrollPosition = new Vector(0, Math.Max(1, editor.ScrollExtentHeight - editor.ScrollViewportHeight));
      Dispatcher.UIThread.RunJobs();
      Assert.True(editor.ScrollPosition.Y > 0);

      var error = Record.Exception(() => editor.Document = string.Empty);
      Dispatcher.UIThread.RunJobs();

      Assert.Null(error);
      Assert.Equal(string.Empty, editor.Document);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void ImeDecoratorForwardsTheNativeCandidateCaretOwnerAndRectangle()
  {
    var (window, editor) = CreateEditor();
    try
    {
      var textBox = editor.inputOwner ?? throw new InvalidOperationException();
      var decorated = new FsusMarkdownEditorTextInputMethodClient(
        new FakeTextInputMethodClient(textBox));

      Assert.Equal(new Rect(12, 24, 2, 18), decorated.CursorRectangle);
      Assert.Same(textBox, decorated.TextViewVisual);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void CompositionFreezesStructuralKeysUntilCommit()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var (client, transactionCount) = RequestClient(editor)!;
      client!.SetPreeditText("n");
      Assert.Equal("composing", editor.NativePhase);

      foreach (var key in new[] { Key.Enter, Key.Tab, Key.Back, Key.Delete })
      {
        window.KeyPress(key, RawInputModifiers.None, PhysicalKey.Enter, null);
        Assert.Equal("", editor.Document);
        Assert.Equal(0, transactionCount());
      }

      client.SetPreeditText("你好");
      client.SetPreeditText(null);
      window.KeyTextInput("你好");
      Dispatcher.UIThread.RunJobs();
      Assert.Equal("你好", editor.Document);
      Assert.Equal(1, transactionCount());
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void LateCommitAfterDocumentSwitchIsRejectedAsOrphaned()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var (client, transactionCount) = RequestClient(editor)!;
      client!.SetPreeditText("你");
      Assert.Equal("composing", editor.NativePhase);

      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-b", 1);
      editor.Document = "second";
      Dispatcher.UIThread.RunJobs();
      // The document switch itself dispatches external-reset transactions;
      // the orphaned-commit contract is about what follows the switch.
      (_, transactionCount) = RequestClient(editor);

      client.SetPreeditText(null);
      window.KeyTextInput("你好");
      Dispatcher.UIThread.RunJobs();

      Assert.True(
        "second" == editor.Document,
        "a commit from an aborted composition must never land in the new document");
      Assert.Equal(0, transactionCount());
      Assert.Contains(
        editor.NativeTrace,
        entry => entry.Rejected == "orphaned-composition");
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public async Task HtmlRichPasteFallsBackToPlainText()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var transfer = new DataTransfer();
      var htmlItem = new DataTransferItem();
      htmlItem.Set(DataFormat.CreateStringPlatformFormat("text/html"), "<b>rich</b><script>alert(1)</script>");
      var plainItem = new DataTransferItem();
      plainItem.Set(DataFormat.Text, "rich");
      transfer.Add(htmlItem);
      transfer.Add(plainItem);
      await window.Clipboard!.SetDataAsync(transfer);
      Dispatcher.UIThread.RunJobs();

      await editor.HandlePasteCoreAsync("paste");
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("rich", editor.Document);
      Assert.DoesNotContain("<b>", editor.Document);
      Assert.DoesNotContain("script", editor.Document);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public async Task MarkdownMimePasteWinsOverPlainText()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      var transfer = new DataTransfer();
      var markdownItem = new DataTransferItem();
      markdownItem.Set(DataFormat.CreateStringPlatformFormat("text/markdown"), "**md**");
      var plainItem = new DataTransferItem();
      plainItem.Set(DataFormat.Text, "plain");
      transfer.Add(markdownItem);
      transfer.Add(plainItem);
      await window.Clipboard!.SetDataAsync(transfer);
      Dispatcher.UIThread.RunJobs();

      await editor.HandlePasteCoreAsync("paste");
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("**md**", editor.Document);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public async Task DelayedPasteRejectsSameSourceFromDifferentDocument()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-a", 1);
      editor.Document = "same";
      Dispatcher.UIThread.RunJobs();
      var transactions = 0;
      editor.Transaction += (_, _) => transactions += 1;
      var clipboard = new TaskCompletionSource<IAsyncDataTransfer?>(
        TaskCreationOptions.RunContinuationsAsynchronously);

      var paste = editor.HandlePasteCoreAsync("paste", () => clipboard.Task);
      editor.Document = "other";
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-b", 2);
      editor.Document = "same";
      Dispatcher.UIThread.RunJobs();
      var transactionsBeforeClipboardCompletes = transactions;

      clipboard.SetResult(PlainTextTransfer(" stale"));
      await paste;
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("same", editor.Document);
      Assert.Equal(
        new FsusMarkdownDocumentIdentity("doc-b", 2),
        editor.TransactionStore.Identity);
      Assert.Equal(transactionsBeforeClipboardCompletes, transactions);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public async Task DelayedPasteRejectsRevisionChange()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Document = "before";
      Dispatcher.UIThread.RunJobs();
      var transactions = 0;
      editor.Transaction += (_, _) => transactions += 1;
      var clipboard = new TaskCompletionSource<IAsyncDataTransfer?>(
        TaskCreationOptions.RunContinuationsAsynchronously);

      var paste = editor.HandlePasteCoreAsync("paste", () => clipboard.Task);
      editor.Document = "after";
      Dispatcher.UIThread.RunJobs();
      var transactionsBeforeClipboardCompletes = transactions;

      clipboard.SetResult(PlainTextTransfer(" stale"));
      await paste;
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("after", editor.Document);
      Assert.Equal(transactionsBeforeClipboardCompletes, transactions);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public async Task DelayedPasteRejectsSelectionChange()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Document = "before";
      Dispatcher.UIThread.RunJobs();
      var textBox = editor.inputOwner ?? throw new InvalidOperationException();
      textBox.Focus();
      Dispatcher.UIThread.RunJobs();
      window.KeyPress(Key.Home, RawInputModifiers.None, PhysicalKey.Home, null);
      window.KeyRelease(Key.Home, RawInputModifiers.None, PhysicalKey.Home, null);
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(0, editor.TransactionStore.Selection.Start);
      var transactions = 0;
      editor.Transaction += (_, _) => transactions += 1;
      var clipboard = new TaskCompletionSource<IAsyncDataTransfer?>(
        TaskCreationOptions.RunContinuationsAsynchronously);

      var paste = editor.HandlePasteCoreAsync("paste", () => clipboard.Task);
      window.KeyPress(Key.End, RawInputModifiers.None, PhysicalKey.End, null);
      window.KeyRelease(Key.End, RawInputModifiers.None, PhysicalKey.End, null);
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(editor.Document.Length, editor.TransactionStore.Selection.Start);

      clipboard.SetResult(PlainTextTransfer(" stale"));
      await paste;
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("before", editor.Document);
      Assert.Equal(0, transactions);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void PairInsertionMatchesTheFrozenWebSemantics()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      window.KeyTextInput("*");
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("**", editor.Document);
      Assert.Equal(1, editor.TransactionStore.Selection.Start);

      window.KeyTextInput("你");
      Dispatcher.UIThread.RunJobs();
      // A non-pairable character between the fresh pair is a plain
      // insertion (no frozen vector relocates the closing marker).
      Assert.Equal("*你*", editor.Document);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void EnterDispatchesThroughTheSharedResolver()
  {
    var (window, editor) = CreateEditor();
    try
    {
      editor.Focus();
      Dispatcher.UIThread.RunJobs();
      editor.Document = "hello world";
      Dispatcher.UIThread.RunJobs();
      // Enter resolution needs the block context the web parser provides;
      // seed the same paragraph node the frozen vector carries.
      var commit = editor.CommitProjection(new FsusMarkdownProjectionSnapshot(
        editor.TransactionStore.Identity,
        editor.TransactionStore.Revision,
        "hello world",
        [new FsusMarkdownProjectionSpan(
          "syn:test:paragraph:0",
          new FsusMarkdownSourceRange(0, 11),
          FsusMarkdownProjectionSpanKind.Text,
          "hello world",
          "paragraph")]));
      Assert.True(commit.Accepted, commit.Reason ?? "projection rejected");
      // The external reset leaves the caret at the document end; go to line
      // start first so the caret matches the frozen vector's middle position.
      window.KeyPress(Key.Home, RawInputModifiers.None, PhysicalKey.Home, null);
      window.KeyRelease(Key.Home, RawInputModifiers.None, PhysicalKey.Home, null);
      for (var index = 0; index < 5; index += 1)
      {
        window.KeyPress(Key.Right, RawInputModifiers.None, PhysicalKey.ArrowRight, null);
        window.KeyRelease(Key.Right, RawInputModifiers.None, PhysicalKey.ArrowRight, null);
      }
      Dispatcher.UIThread.RunJobs();

      window.KeyPress(Key.Enter, RawInputModifiers.None, PhysicalKey.Enter, null);
      Dispatcher.UIThread.RunJobs();

      Assert.Equal("hello\n world", editor.Document);
      Assert.Equal(6, editor.TransactionStore.Selection.Start);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void SyntheticProvenanceIsTheDefault()
  {
    var (window, editor) = CreateEditor();
    try
    {
      Assert.Equal("headless-synthetic", editor.NativeInputProvenance);
    }
    finally
    {
      window.Close();
    }
  }

  private static (TextInputMethodClient? Client, Func<int> TransactionCount) RequestClient(
    FsusMarkdownEditor editor)
  {
    var count = 0;
    editor.Transaction += (_, _) => count += 1;
    var textBox = editor.inputOwner ?? throw new InvalidOperationException(
      $"inputOwner missing; textBoxes={editor.GetVisualDescendants().OfType<TextBox>().Count()}");
    var args = new TextInputMethodClientRequestedEventArgs();
    args.RoutedEvent = InputElement.TextInputMethodClientRequestedEvent;
    args.Client = new FakeTextInputMethodClient(textBox);
    textBox.RaiseEvent(args);
    return (args.Client, () => count);
  }

  private static IAsyncDataTransfer PlainTextTransfer(string text)
  {
    var transfer = new DataTransfer();
    var item = new DataTransferItem();
    item.Set(DataFormat.Text, text);
    transfer.Add(item);
    return transfer;
  }

  private static (Window Window, FsusMarkdownEditor Editor) CreateEditor()
  {
    var editor = new FsusMarkdownEditor
    {
      Width = 560,
      Height = 260,
    };
    var surface = new Border
    {
      Width = 620,
      Height = 320,
      Padding = new Thickness(10),
      Child = editor,
    };
    var window = new Window
    {
      Width = 620,
      Height = 320,
      Content = surface,
      ShowInTaskbar = false,
    };
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
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
    window.Show();
    window.Measure(new Size(window.Width, window.Height));
    window.Arrange(new Rect(0, 0, window.Width, window.Height));
    surface.Measure(new Size(surface.Width, surface.Height));
    surface.Arrange(new Rect(0, 0, surface.Width, surface.Height));
    Dispatcher.UIThread.RunJobs();
    return (window, editor);
  }

  private sealed class FakeTextInputMethodClient : TextInputMethodClient
  {
    private readonly Visual visual;

    public FakeTextInputMethodClient(Visual visual)
    {
      this.visual = visual;
    }

    public override Visual TextViewVisual => visual;

    public override bool SupportsPreedit => true;

    public override bool SupportsSurroundingText => true;

    public override string SurroundingText => string.Empty;

    public override Rect CursorRectangle => new(12, 24, 2, 18);

    public override TextSelection Selection { get; set; }
  }
}
