using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

/// <summary>
/// Cross-platform equivalence gate for issue #341: the native pair-input
/// resolver must reproduce every frozen <c>pairInput</c> vector in
/// <c>spec/avalonia/markdown-editor-input-vectors.json</c> exactly at the JSON
/// level, including the Web transaction shape (camelCase, "history" and
/// "origin", null transaction, omitted rejected reason).
/// </summary>
public class FsusMarkdownEditorPairInputVectorTests
{
  public static TheoryData<string> FrozenPairVectorIds()
  {
    var data = new TheoryData<string>();
    foreach (var vector in LoadVectors().OfType<JsonObject>())
    {
      data.Add((string)vector["id"]!);
    }
    return data;
  }

  [Theory]
  [MemberData(nameof(FrozenPairVectorIds))]
  public void AvaloniaProducesTheFrozenWebPairInputVector(string id)
  {
    var vector = LoadVectors().OfType<JsonObject>().Single(candidate => (string)candidate["id"]! == id);
    var selection = vector["selection"]!.AsObject();
    var plan = FsusMarkdownEditorPairInput.Resolve(new FsusMarkdownPairInputContext(
      (string)vector["source"]!,
      new FsusMarkdownEditorSelection(
        (int)selection["start"]!,
        (int)selection["end"]!,
        (string)selection["direction"]!),
      Inserted: (string?)vector["inserted"],
      Key: (string?)vector["key"],
      Composing: vector["composing"]?.GetValue<bool>() ?? false,
      Readonly: vector["readonly"]?.GetValue<bool>() ?? false,
      Mode: (string?)vector["mode"]));

    var actual = ToJson(plan);
    var expected = vector["expected"];
    Assert.True(
      JsonNode.DeepEquals(actual, expected),
      $"vector {id}: expected {expected?.ToJsonString()} but got {actual.ToJsonString()}");
  }

  [Fact]
  public void TheFrozenPairInputVectorSetIsFullyCovered()
  {
    var ids = LoadVectors().OfType<JsonObject>().Select(vector => (string)vector["id"]!).ToArray();
    Assert.Equal(20, ids.Length);
    Assert.Equal(ids.Length, ids.Distinct(StringComparer.Ordinal).Count());
  }

  /// <summary>
  /// Serializes the plan in the exact frozen shape: <c>action</c>,
  /// <c>transaction</c> (always present, null on passthrough), and
  /// <c>rejected</c> omitted when null, matching how the Web producer froze
  /// the vectors.
  /// </summary>
  private static JsonObject ToJson(FsusMarkdownPairInputPlan plan)
  {
    var json = new JsonObject
    {
      ["action"] = plan.Action,
      ["transaction"] = plan.Transaction is null ? null : ToJson(plan.Transaction),
    };
    if (plan.Rejected is not null)
    {
      json["rejected"] = plan.Rejected;
    }
    return json;
  }

  private static JsonObject ToJson(FsusMarkdownEditorTransaction transaction) =>
    new()
    {
      ["changes"] = new JsonArray(
        [.. transaction.Changes.Select(change => (JsonNode?)new JsonObject
        {
          ["from"] = change.From,
          ["to"] = change.To,
          ["insert"] = change.Insert,
        })]),
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

  private static JsonArray LoadVectors()
  {
    var path = Path.Combine(
      RepositoryRoot(),
      "spec",
      "avalonia",
      "markdown-editor-input-vectors.json");
    var document = JsonNode.Parse(File.ReadAllText(path))
      ?? throw new InvalidOperationException("Input vectors did not parse.");
    return document["pairInput"]?.AsArray()
      ?? throw new InvalidOperationException("Input vectors are missing the pairInput section.");
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
