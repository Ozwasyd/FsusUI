using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

if (args.Contains("--smoke", StringComparer.Ordinal))
{
  return ConsumerSampleSmoke.Run() ? 0 : 1;
}

Console.WriteLine("Run with --smoke to validate the clean consumer sample.");
return 0;

public static class ConsumerSampleSmoke
{
  public static bool Run()
  {
    var themeOptions = FsusThemeOptions.Default with
    {
      Variant = FsusThemeVariant.Light,
      Density = FsusDensity.Default,
      MotionMode = FsusMotionMode.System,
    };

    var action = new FsusButton
    {
      Content = "Save settings",
      AccessibleName = "Save settings",
      Variant = FsusComponentVariant.Primary,
    };

    var input = new FsusInput
    {
      AccessibleName = "Project name",
      Text = "FsusUI",
      IsClearable = true,
    };

    var icon = new FsusIcon
    {
      IconKey = FsusIconKeys.Search,
      IsDecorative = true,
      Size = FsusComponentSize.Md,
    };

    var dropZone = new FsusDropZone
    {
      AccessibleName = "Document import zone",
      Instruction = "Drop files here",
      Accepts = ".pdf, .png",
    };

    var command = new FsusPlatformCommand("workspace.publish", "Publish workspace")
    {
      Category = "Workspace",
      Description = "Build and publish the active workspace",
      Gesture = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift),
      ExecuteAsyncAction = (_, _) => ValueTask.CompletedTask,
    };
    var commandPalette = new FsusCommandPalette
    {
      CommandTree = [FsusNativeMenuItemModel.Action(command)],
      SearchPlaceholder = "Search workspace commands",
    };
    var codeEditor = new FsusCodeEditor
    {
      AccessibleName = "Release notes source",
      WordWrap = true,
      ShowLineNumbers = true,
      TabWidth = 4,
    };
    codeEditor.LoadDocument(
      new FsusMarkdownDocumentIdentity("consumer-smoke", 1),
      "# Release notes\n\n- Native editor");
    var revealed = codeEditor.RevealLineColumn(3, 3);
    _ = codeEditor.FindNext("Native");
    var markdownIdentity = new FsusMarkdownDocumentIdentity(
      "consumer-projection",
      1);
    var markdownEditor = new FsusMarkdownEditor
    {
      Document = "**Draft**",
      DocumentIdentity = markdownIdentity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var projectionRequest = new FsusMarkdownProjectionRequestedEventArgs(
      markdownIdentity,
      0,
      markdownEditor.Document,
      0,
      markdownEditor.SourceCoordinateMap);
    var projectionCommit = FsusMarkdownProjectionProducerContract
      .ProduceAndCommitAsync(
        markdownEditor,
        new ConsumerProjectionProducer(markdownIdentity),
        projectionRequest)
      .AsTask()
      .GetAwaiter()
      .GetResult();

    var page = new StackPanel();
    page.Children.Add(action);
    page.Children.Add(input);
    page.Children.Add(icon);
    page.Children.Add(dropZone);
    page.Children.Add(commandPalette);
    page.Children.Add(codeEditor);
    page.Children.Add(markdownEditor);

    var manager = new FsusThemeManager();

    return manager is not null &&
      themeOptions.Density == FsusDensity.Default &&
      page.Children.Count == 7 &&
      action.AccessibleName == "Save settings" &&
      input.Text == "FsusUI" &&
      icon.IconKey == FsusIconKeys.Search &&
      dropZone.AccessibleName == "Document import zone" &&
      dropZone.Accepts == ".pdf, .png" &&
      commandPalette.CommandTree?.Single().Command?.Id == "workspace.publish" &&
      commandPalette.SearchPlaceholder == "Search workspace commands" &&
      codeEditor.DocumentIdentity?.Id == "consumer-smoke" &&
      codeEditor.Selection == new FsusCodeEditorSelection(19, 25) &&
      revealed == new FsusCodeEditorPosition(19, 3, 3) &&
      projectionCommit.Accepted &&
      markdownEditor.CapabilityState == "aligned";
  }

  private sealed class ConsumerProjectionProducer(
    FsusMarkdownDocumentIdentity identity) : IFsusMarkdownProjectionProducer
  {
    public ValueTask<FsusMarkdownProjectionProduction> ProduceAsync(
      FsusMarkdownProjectionRequestedEventArgs request,
      CancellationToken cancellationToken = default)
    {
      cancellationToken.ThrowIfCancellationRequested();
      return ValueTask.FromResult(new FsusMarkdownProjectionProduction(
        new(
          FsusMarkdownProjectionProducerContract.Version,
          FsusMarkdownProjectionProducerKind.InterimHostBridge,
          "consumer-canonical-runtime-bridge",
          "1.0.0",
          FsusMarkdownProjectionProducerContract.CanonicalRuntimeIdentity,
          "consumer-smoke-runtime"),
        new(
          identity,
          request.Revision,
          request.Source,
          [
            new(
              "strong",
              new(0, 2),
              FsusMarkdownProjectionSpanKind.HiddenMarker,
              ""),
            new(
              "strong",
              new(2, 7),
              FsusMarkdownProjectionSpanKind.Text,
              "Draft",
              "strong"),
            new(
              "strong",
              new(7, 9),
              FsusMarkdownProjectionSpanKind.HiddenMarker,
              ""),
          ],
          request.FeatureRevision),
        []));
    }
  }
}
