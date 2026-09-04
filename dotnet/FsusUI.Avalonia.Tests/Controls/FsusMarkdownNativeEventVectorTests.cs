using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using FsusUI.Avalonia.Controls;
using Xunit;

namespace FsusUI.Avalonia.Tests.Controls;

/// <summary>
/// Consumes the frozen composition section of
/// spec/avalonia/markdown-editor-input-vectors.json. The Web machine
/// (markdown-editor-native-event.ts) and this C# port must produce identical
/// plans, identities, and traces for identical event sequences.
/// </summary>
public class FsusMarkdownNativeEventVectorTests
{
  [Theory]
  [MemberData(nameof(CompositionVectors))]
  public void ProducesTheFrozenPlansAndTrace(string id, JsonNode vector)
  {
    var machine = CreateMachine(vector);
    var plans = new JsonArray();
    foreach (var eventNode in vector["events"]!.AsArray())
    {
      var plan = machine.Apply(MapEvent(eventNode!));
      plans.Add(PlanJson(plan));
    }

    var actual = new JsonObject
    {
      ["plans"] = plans,
      ["final"] = new JsonObject
      {
        ["composing"] = machine.Composing,
        ["freezeSmartInput"] = machine.FreezeSmartInput,
        ["phase"] = FsusMarkdownNativeEventMachine.PhaseToken(machine.Phase),
        ["trace"] = TraceJson(machine),
      },
    };

    var expected = vector["expected"]!;
    Assert.True(
      JsonNode.DeepEquals(actual["plans"], expected["plans"]),
      $"{id}: plans diverged.{Environment.NewLine}actual:   {actual["plans"]}{Environment.NewLine}expected: {expected["plans"]}");
    Assert.True(
      JsonNode.DeepEquals(actual["final"], expected["final"]),
      $"{id}: final state diverged.{Environment.NewLine}actual:   {actual["final"]}{Environment.NewLine}expected: {expected["final"]}");
  }

  [Fact]
  public void CoversEveryFrozenCompositionVector()
  {
    Assert.Equal(10, LoadComposition().Count);
  }

  public static TheoryData<string, JsonNode> CompositionVectors()
  {
    var data = new TheoryData<string, JsonNode>();
    foreach (var (id, vector) in LoadComposition())
    {
      data.Add(id, vector);
    }
    return data;
  }

  private static List<(string Id, JsonNode Vector)> LoadComposition()
  {
    var path = Path.Combine(
      RepositoryRoot(),
      "spec",
      "avalonia",
      "markdown-editor-input-vectors.json");
    var root = JsonNode.Parse(File.ReadAllText(path))
      ?? throw new InvalidOperationException("Input vectors did not parse.");
    var result = new List<(string, JsonNode)>();
    foreach (var vector in root["composition"]!.AsArray())
    {
      result.Add((vector!["id"]!.GetValue<string>(), vector));
    }
    return result;
  }

  private static FsusMarkdownNativeEventMachine CreateMachine(JsonNode vector)
  {
    var identity = vector["identity"];
    return new FsusMarkdownNativeEventMachine(
      identity is null || identity.GetValueKind() == JsonValueKind.Null
        ? null
        : MapIdentity(identity),
      vector["revision"]?.GetValue<int>());
  }

  private static FsusMarkdownDocumentIdentity MapIdentity(JsonNode node) =>
    new(node["id"]!.GetValue<string>(), node["epoch"]!.GetValue<int>());

  private static FsusMarkdownNativeEventInput MapEvent(JsonNode node) =>
    new()
    {
      ClipboardIdentity = node["clipboardIdentity"]?.GetValue<string>(),
      CurrentIdentity = node["currentIdentity"] is { } current ? MapIdentity(current) : null,
      Data = node["data"] is { } data && data.GetValueKind() != JsonValueKind.Null
        ? data.GetValue<string>()
        : null,
      Disabled = node["disabled"]?.GetValue<bool>() ?? false,
      DocumentIdentity = node["documentIdentity"] is { } doc ? MapIdentity(doc) : null,
      ExpectedRevision = node["expectedRevision"]?.GetValue<int>(),
      InputType = node["inputType"]?.GetValue<string>(),
      IsComposing = node["isComposing"]?.GetValue<bool>(),
      Kind = MapKind(node["kind"]!.GetValue<string>()),
      Origin = node["origin"]?.GetValue<string>(),
      PreviousValue = node["previousValue"]?.GetValue<string>(),
      Revision = node["revision"]?.GetValue<int>(),
      Selection = node["selection"] is { } selection
        ? new FsusMarkdownEditorSelection(
            selection["start"]!.GetValue<int>(),
            selection["end"]!.GetValue<int>(),
            selection["direction"]?.GetValue<string>() ?? "none")
        : null,
      Value = node["value"]?.GetValue<string>(),
    };

  private static FsusMarkdownNativeEventKind MapKind(string token) => token switch
  {
    "compositionstart" => FsusMarkdownNativeEventKind.CompositionStart,
    "compositionupdate" => FsusMarkdownNativeEventKind.CompositionUpdate,
    "compositionend" => FsusMarkdownNativeEventKind.CompositionEnd,
    "beforeinput" => FsusMarkdownNativeEventKind.BeforeInput,
    "input" => FsusMarkdownNativeEventKind.Input,
    "paste" => FsusMarkdownNativeEventKind.Paste,
    "drop" => FsusMarkdownNativeEventKind.Drop,
    "external-reset" => FsusMarkdownNativeEventKind.ExternalReset,
    "document-switch" => FsusMarkdownNativeEventKind.DocumentSwitch,
    _ => throw new ArgumentOutOfRangeException(nameof(token), token, "Unknown native event kind."),
  };

  private static JsonObject PlanJson(FsusMarkdownNativeEventPlan plan)
  {
    var json = new JsonObject
    {
      ["action"] = FsusMarkdownNativeEventMachine.ActionToken(plan.Action),
      ["composition"] = plan.Composition,
      ["freezeSmartInput"] = plan.FreezeSmartInput,
      ["history"] = plan.History,
      ["identity"] = plan.Identity,
      ["mergeDirection"] = plan.MergeDirection,
      ["origin"] = plan.Origin,
      ["phase"] = FsusMarkdownNativeEventMachine.PhaseToken(plan.Phase),
      ["preventDefault"] = plan.PreventDefault,
    };
    if (plan.Rejected is not null)
    {
      json["rejected"] = plan.Rejected;
    }
    json["restoreDisplay"] = plan.RestoreDisplay;
    if (plan.Snapshot is { } snapshot)
    {
      json["snapshot"] = new JsonObject
      {
        ["data"] = snapshot.Data,
        ["inputType"] = snapshot.InputType,
        ["selection"] = new JsonObject
        {
          ["direction"] = snapshot.Selection.Direction,
          ["end"] = snapshot.Selection.End,
          ["start"] = snapshot.Selection.Start,
        },
        ["value"] = snapshot.Value,
      };
    }
    return json;
  }

  private static JsonArray TraceJson(FsusMarkdownNativeEventMachine machine)
  {
    var trace = new JsonArray();
    foreach (var entry in machine.Trace)
    {
      var json = new JsonObject
      {
        ["action"] = FsusMarkdownNativeEventMachine.ActionToken(entry.Action),
        ["identity"] = entry.Identity,
      };
      if (!string.IsNullOrEmpty(entry.InputType))
      {
        json["inputType"] = entry.InputType;
      }
      json["kind"] = FsusMarkdownNativeEventMachine.KindToken(entry.Kind);
      json["phase"] = FsusMarkdownNativeEventMachine.PhaseToken(entry.Phase);
      if (entry.Rejected is not null)
      {
        json["rejected"] = entry.Rejected;
      }
      if (entry.Revision is int revision)
      {
        json["revision"] = revision;
      }
      trace.Add(json);
    }
    return trace;
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
