using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests.Generated;

public sealed record AccessibilityRuntimeGap(
  string Field,
  string Reason,
  string Owner,
  string TestPolicy,
  string ReviewAfter);

public sealed record AccessibilityRuntimeScenario(
  string Id,
  string ContractId,
  string ScenarioId,
  string Checkpoint,
  string SnapshotId,
  string Factory,
  string Role,
  string AccessibleName,
  string? Value,
  bool? Disabled,
  bool? Checked,
  bool? Invalid,
  int TabOrder,
  IReadOnlyList<AccessibilityRuntimeGap> ImplementationGaps);

internal static class AccessibilityRuntimeEvidence
{
  private const string ContractPath =
    "spec/components/contracts/v2/contract-v2.json";
  private const string WebBaselinePath = "spec/baselines/vue-current.json";
  private const string AvaloniaBaselinePath =
    "spec/avalonia/semantic/FsusUI.Avalonia.semantic.json";
  private const string RuntimeScenariosPath =
    "tests/conformance/accessibility/avalonia-runtime-scenarios.json";
  private const string AccessibilityContractPath =
    "tests/conformance/accessibility/contracts.json";
  private const string DeclaredSnapshotPath =
    "tests/conformance/accessibility/automation-snapshots.json";
  private const string GeneratorPath = "scripts/accessibility-conformance.mjs";
  private const string GeneratedTestPath =
    "dotnet/FsusUI.Avalonia.HeadlessTests/Generated/AccessibilityConformanceTests.cs";
  private const string RuntimeHelperPath =
    "dotnet/FsusUI.Avalonia.HeadlessTests/AccessibilityRuntimeEvidence.cs";

  private static readonly JsonSerializerOptions JsonOptions = new()
  {
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = true,
  };

  public static void Capture(IEnumerable<AccessibilityRuntimeScenario> scenarios)
  {
    var repositoryRoot = FindRepositoryRoot();
    var candidate = Git(repositoryRoot, "rev-parse", "HEAD");
    var contractHash = FileHash(repositoryRoot, ContractPath);
    var webBaselineHash = FileHash(repositoryRoot, WebBaselinePath);
    var avaloniaBaselineHash = FileHash(repositoryRoot, AvaloniaBaselinePath);
    var accessibilityContractHash = FileHash(
      repositoryRoot,
      AccessibilityContractPath);
    var declaredSnapshotHash = FileHash(repositoryRoot, DeclaredSnapshotPath);
    var runnerHash = CombinedFileHash(
      repositoryRoot,
      GeneratorPath,
      GeneratedTestPath,
      RuntimeHelperPath,
      RuntimeScenariosPath);
    var scenarioSetHash = FileHash(repositoryRoot, RuntimeScenariosPath);
    var sourceTreeHash = Git(repositoryRoot, "rev-parse", "HEAD^{tree}");
    var workspaceClean = string.IsNullOrWhiteSpace(
      Git(repositoryRoot, "status", "--porcelain", "--untracked-files=all"));
    var captured = scenarios.Select(scenario => CaptureScenario(
      scenario,
      candidate,
      contractHash,
      webBaselineHash,
      avaloniaBaselineHash,
      accessibilityContractHash,
      declaredSnapshotHash,
      runnerHash,
      scenarioSetHash,
      sourceTreeHash,
      workspaceClean)).ToArray();
    var output = Environment.GetEnvironmentVariable("FSUS_A11Y_RUNTIME_OUTPUT");
    var outputPath = Path.GetFullPath(
      output ?? Path.Combine(
        repositoryRoot,
        ".tmp/conformance-v2/accessibility/avalonia-generated.json"));
    Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
    var evidenceSet = new
    {
      schema = "fsusui.accessibility-evidence-set.v2",
      generatedBy = "AccessibilityConformanceTests.CapturesRealAutomationPeerEvidence",
      real = true,
      legacySnapshotCoverage = 0,
      identity = new
      {
        candidate,
        contractHash,
        webBaselineHash,
        avaloniaBaselineHash,
        accessibilityContractHash,
        declaredSnapshotHash,
        runnerHash,
        scenarioSetHash,
        sourceTreeHash,
        workspaceClean,
      },
      evidence = captured,
    };
    File.WriteAllText(
      outputPath,
      $"{JsonSerializer.Serialize(evidenceSet, JsonOptions)}\n");
    Console.WriteLine(
      $"[accessibility-runtime] wrote {outputPath} scenarios={captured.Length}");
  }

  private static object CaptureScenario(
    AccessibilityRuntimeScenario scenario,
    string candidate,
    string contractHash,
    string webBaselineHash,
    string avaloniaBaselineHash,
    string accessibilityContractHash,
    string declaredSnapshotHash,
    string runnerHash,
    string runtimeScenarioSetHash,
    string sourceTreeHash,
    bool workspaceClean)
  {
    var control = CreateControl(scenario);
    var window = new Window
    {
      Content = new Border
      {
        Child = control,
        Padding = new Thickness(12),
      },
      Height = 240,
      ShowInTaskbar = false,
      Width = 480,
    };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
    {
      Source = new Uri(
        "avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(
      window.Resources,
      new FsusThemeOptions
      {
        Variant = FsusThemeVariant.Light,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
    try
    {
      window.Show();
      window.Measure(new Size(480, 240));
      window.Arrange(new Rect(0, 0, 480, 240));
      window.UpdateLayout();
      _ = control.Focus();
      Dispatcher.UIThread.RunJobs();
      window.UpdateLayout();

      var peer = ControlAutomationPeer.CreatePeerForElement(control)
        ?? throw new InvalidOperationException(
          $"No AutomationPeer for {control.GetType().FullName}.");
      var nodes = new List<AccessibilityNode>();
      CapturePeerTree(
        peer,
        control.GetType().Name,
        "root",
        null,
        scenario.TabOrder,
        nodes);
      AssertScenarioEvidence(scenario, nodes);
      var executionId =
        $"accessibility-v2-{candidate[..Math.Min(candidate.Length, 12)]}-{scenario.Id}";
      var locale = string.IsNullOrWhiteSpace(CultureInfo.CurrentCulture.Name)
        ? "invariant"
        : CultureInfo.CurrentCulture.Name;
      var identity = new
      {
        executionId,
        checkpoint = scenario.Checkpoint,
        candidate,
        contractHash,
        webBaselineHash,
        avaloniaBaselineHash,
        accessibilityContractHash,
        declaredSnapshotHash,
        runtimeScenarioSetHash,
        scenario = scenario.ScenarioId,
        contract = scenario.ContractId,
        documentId = scenario.SnapshotId,
        documentEpoch = 1,
        sourceRevision = 0,
        theme = "light",
        density = "default",
        locale,
        direction = window.FlowDirection == FlowDirection.RightToLeft
          ? "rtl"
          : "ltr",
        motion = "reduced",
        runnerHash,
        sourceTreeHash,
        workspaceClean,
      };
      return new
      {
        schema = "fsusui.conformance-evidence.v2",
        kind = "accessibility-tree",
        platform = "avalonia",
        real = true,
        alignmentEligible = false,
        coverageScope = "avalonia-accessibility-tree-only",
        runtime = new
        {
          framework = "Avalonia",
          realControl = true,
          headless = true,
          mock = false,
        },
        identity,
        accessibility = new
        {
          source = "real-avalonia-automation-peer",
          sameExecution = true,
          nodes,
        },
        scenarioInput = new
        {
          scenario.SnapshotId,
          scenario.Factory,
        },
        source = new
        {
          repositoryRoot = ".",
          runtimeScenarios = RuntimeScenariosPath,
          accessibilityContract = AccessibilityContractPath,
          declaredSnapshots = DeclaredSnapshotPath,
          contract = ContractPath,
          webBaseline = WebBaselinePath,
          avaloniaBaseline = AvaloniaBaselinePath,
        },
      };
    }
    finally
    {
      window.Close();
    }
  }

  private static Control CreateControl(AccessibilityRuntimeScenario scenario)
  {
    Control control = scenario.Factory switch
    {
      "button" => new FsusButton
      {
        AccessibleName = scenario.AccessibleName,
        Content = "Runtime accessibility action",
      },
      "input" => new FsusInput
      {
        AccessibleName = scenario.AccessibleName,
        IsInvalid = scenario.Invalid == true,
        Text = scenario.Value,
      },
      "checkbox" => new FsusCheckbox
      {
        AccessibleName = scenario.AccessibleName,
        Content = scenario.AccessibleName,
        IsChecked = scenario.Checked,
      },
      "switch" => new FsusSwitch
      {
        AccessibleName = scenario.AccessibleName,
        Content = scenario.AccessibleName,
        IsChecked = scenario.Checked,
      },
      "markdown-editor-atomic" => CreateMarkdownEditor(scenario),
      _ => throw new InvalidOperationException(
        $"Unknown accessibility runtime factory {scenario.Factory}."),
    };
    control.IsEnabled = scenario.Disabled != true;
    control.TabIndex = scenario.TabOrder;
    return control;
  }

  private static FsusMarkdownEditor CreateMarkdownEditor(
    AccessibilityRuntimeScenario scenario)
  {
    var identity = new FsusMarkdownDocumentIdentity(scenario.SnapshotId, 1);
    var document = scenario.Value ?? string.Empty;
    var editor = new FsusMarkdownEditor
    {
      Document = document,
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var projection = editor.CommitProjection(
      new FsusMarkdownProjectionSnapshot(
        identity,
        0,
        document,
        [
          new(
            "runtime-atomic",
            new FsusMarkdownSourceRange(0, document.Length),
            FsusMarkdownProjectionSpanKind.Atomic,
            document.Trim('`'),
            "inline-code"),
        ],
        editor.ProjectionFeatureRevision));
    if (!projection.Accepted)
    {
      throw new InvalidOperationException(
        "MarkdownEditor runtime accessibility projection was rejected.");
    }
    return editor;
  }

  private static void CapturePeerTree(
    AutomationPeer peer,
    string control,
    string id,
    string? logicalParent,
    int? tabOrder,
    List<AccessibilityNode> nodes)
  {
    var children = peer.GetChildren() ?? [];
    var childIds = children
      .Select((_, index) => $"{id}.{index}")
      .ToArray();
    var status = peer.GetItemStatus();
    var selection = ParseSelection(status);
    nodes.Add(new(
      id,
      control,
      peer.GetAutomationControlType().ToString().ToLowerInvariant(),
      NullIfEmpty(peer.GetName()),
      NullIfEmpty(peer.GetHelpText()),
      peer.GetProvider<IValueProvider>()?.Value,
      selection,
      ParseStatusInt(status, "caret"),
      new(
        !peer.IsEnabled(),
        peer.GetProvider<IValueProvider>()?.IsReadOnly,
        ParseStatusBool(status, "invalid"),
        peer.GetProvider<ISelectionItemProvider>()?.IsSelected,
        Expanded(peer.GetProvider<IExpandCollapseProvider>()),
        Checked(peer.GetProvider<IToggleProvider>())),
      peer.GetLiveSetting().ToString().ToLowerInvariant(),
      logicalParent,
      childIds,
      new(peer.IsKeyboardFocusable(), peer.HasKeyboardFocus(), tabOrder),
      NullIfEmpty(status)));
    for (var index = 0; index < children.Count; index++)
    {
      var child = children[index];
      CapturePeerTree(
        child,
        NullIfEmpty(child.GetClassName()) ?? child.GetType().Name,
        childIds[index],
        id,
        null,
        nodes);
    }
  }

  private static void AssertScenarioEvidence(
    AccessibilityRuntimeScenario scenario,
    IReadOnlyList<AccessibilityNode> nodes)
  {
    var root = nodes.FirstOrDefault(node => node.Id == "root")
      ?? throw new InvalidOperationException(
        $"{scenario.Id} root AutomationPeer node is missing.");
    var unavailableFields = new HashSet<string>(StringComparer.Ordinal);
    var expectedRole = scenario.Role switch
    {
      "text-input" => "edit",
      "spinbutton" => "spinner",
      "radio" => "radiobutton",
      _ => scenario.Role,
    };
    RequireEqual(scenario, "role", expectedRole, root.Role);
    RequireEqual(scenario, "name", scenario.AccessibleName, root.Name);
    if (scenario.Value is not null)
    {
      RequireEqual(scenario, "value", scenario.Value, root.Value);
    }
    if (scenario.Disabled is not null)
    {
      RequireEqual(
        scenario,
        "states.disabled",
        scenario.Disabled.Value,
        root.States.Disabled);
    }
    if (scenario.Checked is not null)
    {
      RequireEqual(
        scenario,
        "states.checkedState",
        scenario.Checked.Value ? "on" : "off",
        root.States.CheckedState);
    }
    if (scenario.Invalid is not null)
    {
      if (root.States.Invalid is null)
      {
        unavailableFields.Add("states.invalid");
      }
      else
      {
        RequireEqual(
          scenario,
          "states.invalid",
          scenario.Invalid.Value,
          root.States.Invalid.Value);
      }
    }
    var declaredGapFields = scenario.ImplementationGaps
      .Select(gap => gap.Field)
      .ToHashSet(StringComparer.Ordinal);
    if (!unavailableFields.SetEquals(declaredGapFields))
    {
      throw new InvalidOperationException(
        $"{scenario.Id} unavailable fields [{string.Join(", ", unavailableFields.Order())}] " +
        $"do not match declared implementation gaps [{string.Join(", ", declaredGapFields.Order())}].");
    }
    var nodeById = nodes.ToDictionary(node => node.Id);
    foreach (var node in nodes)
    {
      foreach (var childId in node.Children)
      {
        if (!nodeById.TryGetValue(childId, out var child))
        {
          throw new InvalidOperationException(
            $"{scenario.Id} node {node.Id} references missing child {childId}.");
        }
        RequireEqual(
          scenario,
          $"node {childId} logicalParent",
          node.Id,
          child.LogicalParent);
      }
    }
    if (scenario.Factory != "markdown-editor-atomic")
    {
      return;
    }
    if (root.Selection is null || root.Caret is null)
    {
      throw new InvalidOperationException(
        $"{scenario.Id} MarkdownEditor selection/caret is unavailable.");
    }
    if (
      root.Children.Count == 0 ||
      !nodes.Skip(1).Any(node => node.Role == "group") ||
      !nodes.Skip(1).Any(node => node.Role == "button"))
    {
      throw new InvalidOperationException(
        $"{scenario.Id} MarkdownEditor atomic peer tree is incomplete.");
    }
  }

  private static void RequireEqual<T>(
    AccessibilityRuntimeScenario scenario,
    string field,
    T expected,
    T actual)
  {
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
      throw new InvalidOperationException(
        $"{scenario.Id} {field} expected={expected} actual={actual}.");
    }
  }

  private static bool? Expanded(IExpandCollapseProvider? provider) =>
    provider?.ExpandCollapseState switch
    {
      ExpandCollapseState.Expanded or ExpandCollapseState.PartiallyExpanded => true,
      ExpandCollapseState.Collapsed => false,
      _ => null,
    };

  private static string? Checked(IToggleProvider? provider) =>
    provider?.ToggleState.ToString().ToLowerInvariant();

  private static SelectionSnapshot? ParseSelection(string? status)
  {
    var value = ParseStatusValue(status, "selection");
    if (value is null)
    {
      return null;
    }
    var parts = value.Split(':', StringSplitOptions.TrimEntries);
    return parts.Length == 2 &&
      int.TryParse(parts[0], out var start) &&
      int.TryParse(parts[1], out var end)
        ? new(start, end, null)
        : null;
  }

  private static bool? ParseStatusBool(string? status, string key) =>
    bool.TryParse(ParseStatusValue(status, key), out var value) ? value : null;

  private static int? ParseStatusInt(string? status, string key) =>
    int.TryParse(ParseStatusValue(status, key), out var value) ? value : null;

  private static string? ParseStatusValue(string? status, string key)
  {
    if (string.IsNullOrWhiteSpace(status))
    {
      return null;
    }
    foreach (var part in status.Split(';', StringSplitOptions.TrimEntries))
    {
      var separator = part.IndexOf('=');
      if (
        separator > 0 &&
        string.Equals(part[..separator], key, StringComparison.Ordinal))
      {
        return part[(separator + 1)..];
      }
    }
    return null;
  }

  private static string? NullIfEmpty(string? value) =>
    string.IsNullOrWhiteSpace(value) ? null : value;

  private static string FindRepositoryRoot()
  {
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null)
    {
      if (
        File.Exists(Path.Combine(directory.FullName, "package.json")) &&
        Directory.Exists(Path.Combine(directory.FullName, "dotnet")))
      {
        return directory.FullName;
      }
      directory = directory.Parent;
    }
    throw new DirectoryNotFoundException(
      "Could not find the FsusUI repository root.");
  }

  private static string Git(string workingDirectory, params string[] arguments)
  {
    var startInfo = new ProcessStartInfo("git")
    {
      RedirectStandardError = true,
      RedirectStandardOutput = true,
      UseShellExecute = false,
      WorkingDirectory = workingDirectory,
    };
    foreach (var argument in arguments)
    {
      startInfo.ArgumentList.Add(argument);
    }
    using var process = Process.Start(startInfo)
      ?? throw new InvalidOperationException("Could not start git.");
    var stdout = process.StandardOutput.ReadToEnd();
    var stderr = process.StandardError.ReadToEnd();
    process.WaitForExit();
    if (process.ExitCode != 0)
    {
      throw new InvalidOperationException(
        $"git {string.Join(' ', arguments)} failed: {stderr}");
    }
    return stdout.Trim();
  }

  private static string FileHash(string repositoryRoot, string relativePath) =>
    Convert.ToHexString(
      SHA256.HashData(File.ReadAllBytes(Path.Combine(repositoryRoot, relativePath))))
      .ToLowerInvariant();

  private static string CombinedFileHash(
    string repositoryRoot,
    params string[] relativePaths)
  {
    using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    foreach (var relativePath in relativePaths)
    {
      hash.AppendData(
        File.ReadAllBytes(Path.Combine(repositoryRoot, relativePath)));
    }
    return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
  }

  private sealed record AccessibilityNode(
    string Id,
    string Control,
    string Role,
    string? Name,
    string? Description,
    string? Value,
    SelectionSnapshot? Selection,
    int? Caret,
    AccessibilityStates States,
    string LiveRegion,
    string? LogicalParent,
    IReadOnlyList<string> Children,
    FocusState Focus,
    string? ItemStatus);

  private sealed record SelectionSnapshot(
    int Start,
    int End,
    string? Direction);

  private sealed record AccessibilityStates(
    bool Disabled,
    bool? ReadOnly,
    bool? Invalid,
    bool? Selected,
    bool? Expanded,
    string? CheckedState);

  private sealed record FocusState(
    bool KeyboardFocusable,
    bool Focused,
    int? TabOrder);
}
