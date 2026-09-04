using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorBlockInputVectorTests
{
  [Fact]
  public void AvaloniaProducesTheFrozenWebBlockInputPlans()
  {
    var vectors = LoadVectors();
    Assert.Equal(33, vectors.Count);
    foreach (var vector in vectors)
    {
      var id = vector["id"]!.GetValue<string>();
      var selectionNode = vector["selection"]!;
      var nodes = vector["projection"]!["nodes"]!.AsArray()
        .Select(node => new FsusMarkdownBlockInputNode(
          node!["id"]!.GetValue<string>(),
          node["kind"]!.GetValue<string>(),
          node["start"]!.GetValue<int>(),
          node["end"]!.GetValue<int>()))
        .ToArray();
      var context = new FsusMarkdownBlockInputContext(
        vector["key"]!.GetValue<string>(),
        new FsusMarkdownEditorSelection(
          selectionNode["start"]!.GetValue<int>(),
          selectionNode["end"]!.GetValue<int>(),
          selectionNode["direction"]!.GetValue<string>()),
        vector["source"]!.GetValue<string>(),
        vector["composing"]?.GetValue<bool>() ?? false,
        nodes);

      var actual = ToJson(FsusMarkdownEditorBlockInput.Resolve(context));
      var expected = vector["expected"]!;
      Assert.True(
        JsonNode.DeepEquals(actual, expected),
        $"Block input vector '{id}' drifted from the frozen Web plan.\n" +
        $"expected: {expected.ToJsonString()}\n" +
        $"actual:   {actual?.ToJsonString()}");
    }
  }

  private static JsonNode? ToJson(FsusMarkdownBlockInputPlan plan)
  {
    var result = new JsonObject
    {
      ["intent"] = new JsonObject
      {
        ["key"] = plan.Intent.Key,
        ["context"] = plan.Intent.Context,
        ["nodeId"] = plan.Intent.NodeId,
        ["position"] = plan.Intent.Position,
        ["action"] = plan.Intent.Action,
      },
      ["transaction"] = plan.Transaction is null ? null : ToJson(plan.Transaction),
    };
    if (plan.Rejected is not null)
    {
      result["rejected"] = plan.Rejected;
    }
    return result;
  }

  private static JsonNode ToJson(FsusMarkdownEditorTransaction transaction) => new JsonObject
  {
    ["changes"] = new JsonArray(
      transaction.Changes
        .Select(change => (JsonNode)new JsonObject
        {
          ["from"] = change.From,
          ["to"] = change.To,
          ["insert"] = change.Insert,
        })
        .ToArray()),
    ["history"] = transaction.History,
    ["origin"] = transaction.Origin,
    ["selection"] = transaction.Selection is null
      ? null
      : new JsonObject
      {
        ["direction"] = transaction.Selection.Direction,
        ["start"] = transaction.Selection.Start,
        ["end"] = transaction.Selection.End,
      },
  };

  private static List<JsonNode> LoadVectors()
  {
    var path = Path.Combine(
      RepositoryRoot(),
      "spec",
      "avalonia",
      "markdown-editor-input-vectors.json");
    var document = JsonNode.Parse(File.ReadAllText(path))
      ?? throw new InvalidOperationException("Frozen input vectors did not parse.");
    return document["blockInput"]!.AsArray()
      .Select(node => node ?? throw new InvalidOperationException("Null block input vector."))
      .ToList();
  }

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var directory = new DirectoryInfo(Path.GetDirectoryName(sourceFile) ?? string.Empty);
    while (directory is not null)
    {
      if (File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
      {
        return directory.FullName;
      }
      directory = directory.Parent;
    }
    throw new DirectoryNotFoundException("FsusUI repository root was not found.");
  }
}
