using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorClipboardVectorTests
{
  public static TheoryData<string> ClipboardVectorIds()
  {
    var ids = new TheoryData<string>();
    foreach (var vector in LoadClipboardVectors())
    {
      ids.Add(vector["id"]!.GetValue<string>());
    }
    return ids;
  }

  [Theory]
  [MemberData(nameof(ClipboardVectorIds))]
  public void AvaloniaProducesTheFrozenWebClipboardPlans(string id)
  {
    var vector = LoadClipboardVectors().Single(node => node["id"]!.GetValue<string>() == id);
    var expected = vector["expected"]!;
    var actual = ToExpectedJson(FsusMarkdownEditorClipboardInput.Resolve(Context(vector)));

    Assert.True(
      JsonNode.DeepEquals(expected, actual),
      $"Vector {id} diverged from the frozen Web clipboard plan.\n" +
      $"expected: {expected.ToJsonString()}\n" +
      $"actual:   {actual.ToJsonString()}");
  }

  [Fact]
  public void FrozenClipboardVectorSuiteCoversThirteenVectors()
  {
    Assert.Equal(13, LoadClipboardVectors().Count);
  }

  private static FsusMarkdownClipboardPasteContext Context(JsonNode vector)
  {
    var selection = vector["selection"]!;
    return new FsusMarkdownClipboardPasteContext(
      vector["source"]?.GetValue<string>() ?? string.Empty,
      new FsusMarkdownEditorSelection(
        selection["start"]!.GetValue<int>(),
        selection["end"]!.GetValue<int>(),
        selection["direction"]?.GetValue<string>() ?? "none"),
      vector["items"]?.AsArray()
        .Select(item => new FsusMarkdownClipboardItem(
          item!["type"]!.GetValue<string>(),
          item["text"]?.GetValue<string>()))
        .ToArray(),
      vector["files"]?.AsArray()
        .Select(file => new FsusMarkdownClipboardFileRef(
          file!["name"]!.GetValue<string>(),
          file["size"]!.GetValue<long>(),
          file["type"]!.GetValue<string>()))
        .ToArray(),
      vector["origin"]?.GetValue<string>() ?? "paste",
      vector["composing"]?.GetValue<bool>() ?? false,
      vector["readonly"]?.GetValue<bool>() ?? false,
      vector["disabled"]?.GetValue<bool>() ?? false,
      Mode(vector["mode"]?.GetValue<string>()),
      vector["revision"]?.GetValue<int>(),
      vector["expectedRevision"]?.GetValue<int>(),
      vector["maxPasteUnits"]?.GetValue<int>(),
      Identity(vector["currentIdentity"]),
      Identity(vector["documentIdentity"]));
  }

  private static FsusMarkdownEditorMode? Mode(string? mode) => mode switch
  {
    "source" => FsusMarkdownEditorMode.Source,
    "live" => FsusMarkdownEditorMode.Live,
    "split" => FsusMarkdownEditorMode.Split,
    "preview" => FsusMarkdownEditorMode.Preview,
    null => null,
    _ => throw new ArgumentOutOfRangeException(nameof(mode), mode, "Unknown editor mode."),
  };

  private static FsusMarkdownDocumentIdentity? Identity(JsonNode? node) =>
    node is null ? null : new(node["id"]!.GetValue<string>(), node["epoch"]!.GetValue<int>());

  private static JsonObject ToExpectedJson(FsusMarkdownClipboardPastePlan plan)
  {
    var node = new JsonObject
    {
      ["action"] = plan.Action,
      ["attachmentIntent"] = plan.AttachmentIntent is FsusMarkdownClipboardAttachmentIntent intent
        ? ToIntentJson(intent)
        : null,
      ["identity"] = plan.Identity,
      ["insert"] = plan.Insert,
      ["mime"] = plan.Mime,
    };
    if (plan.Rejected is not null)
    {
      node["rejected"] = plan.Rejected;
    }
    node["transaction"] = plan.Transaction is null ? null : ToTransactionJson(plan.Transaction);
    return node;
  }

  private static JsonObject ToIntentJson(FsusMarkdownClipboardAttachmentIntent intent)
  {
    var node = new JsonObject();
    if (intent.DocumentIdentity is not null)
    {
      node["documentIdentity"] = new JsonObject
      {
        ["id"] = intent.DocumentIdentity.Id,
        ["epoch"] = intent.DocumentIdentity.Epoch,
      };
    }
    node["files"] = new JsonArray(
      [.. intent.Files.Select(file => (JsonNode)new JsonObject
      {
        ["name"] = file.Name,
        ["size"] = file.Size,
        ["type"] = file.Type,
      })]);
    node["kind"] = intent.Kind;
    node["origin"] = intent.Origin;
    if (intent.Revision is not null)
    {
      node["revision"] = intent.Revision.Value;
    }
    node["selection"] = ToSelectionJson(intent.Selection);
    return node;
  }

  private static JsonObject ToTransactionJson(FsusMarkdownEditorTransaction transaction)
  {
    var node = new JsonObject
    {
      ["changes"] = new JsonArray(
        [.. transaction.Changes.Select(change => (JsonNode)new JsonObject
        {
          ["from"] = change.From,
          ["insert"] = change.Insert,
          ["to"] = change.To,
        })]),
      ["history"] = transaction.History,
    };
    if (transaction.Metadata is not null)
    {
      var metadata = new JsonObject();
      foreach (var entry in transaction.Metadata)
      {
        metadata[entry.Key] = entry.Value?.ToString();
      }
      node["metadata"] = metadata;
    }
    node["origin"] = transaction.Origin;
    node["selection"] = transaction.Selection is null ? null : ToSelectionJson(transaction.Selection);
    if (transaction.ExpectedRevision is not null)
    {
      node["expectedRevision"] = transaction.ExpectedRevision.Value;
    }
    return node;
  }

  private static JsonObject ToSelectionJson(FsusMarkdownEditorSelection selection) => new()
  {
    ["direction"] = selection.Direction,
    ["end"] = selection.End,
    ["start"] = selection.Start,
  };

  private static List<JsonNode> LoadClipboardVectors()
  {
    var path = Path.Combine(
      RepositoryRoot(),
      "spec",
      "avalonia",
      "markdown-editor-input-vectors.json");
    var root = JsonNode.Parse(File.ReadAllText(path))
      ?? throw new InvalidOperationException("Shared input vectors did not parse.");
    return root["clipboard"]!.AsArray().Select(node => node!).ToList();
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
