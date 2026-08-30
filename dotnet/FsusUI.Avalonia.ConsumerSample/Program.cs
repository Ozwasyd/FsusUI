using Avalonia.Controls;
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

    var page = new StackPanel();
    page.Children.Add(action);
    page.Children.Add(input);
    page.Children.Add(icon);
    page.Children.Add(dropZone);
    page.Children.Add(codeEditor);

    var manager = new FsusThemeManager();

    return manager is not null &&
      themeOptions.Density == FsusDensity.Default &&
      page.Children.Count == 5 &&
      action.AccessibleName == "Save settings" &&
      input.Text == "FsusUI" &&
      icon.IconKey == FsusIconKeys.Search &&
      dropZone.AccessibleName == "Document import zone" &&
      dropZone.Accepts == ".pdf, .png" &&
      codeEditor.DocumentIdentity?.Id == "consumer-smoke" &&
      codeEditor.Selection == new FsusCodeEditorSelection(19, 25) &&
      revealed == new FsusCodeEditorPosition(19, 3, 3);
  }
}
