using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests.Generated;

public sealed record AccessibilityRuntimeGap(
  string Field,
  string ObservedJson,
  string Reason,
  string Owner,
  string TestPolicy,
  string ReviewAfter);

public sealed record AccessibilityRuntimeScenario(
  string Id,
  string? ContractId,
  string? ContractScenarioId,
  string Checkpoint,
  string SnapshotId,
  string Factory,
  string BindingDisposition,
  string Role,
  string AccessibleName,
  string? Value,
  bool? Disabled,
  bool? Selected,
  bool? Checked,
  bool? Expanded,
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
  private const string RootConformanceRunnerPath =
    "scripts/run-conformance-v2.mjs";

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
      RuntimeScenariosPath,
      RootConformanceRunnerPath);
    var scenarioSetHash = FileHash(repositoryRoot, RuntimeScenariosPath);
    var sourceTreeHash = Git(repositoryRoot, "rev-parse", "HEAD^{tree}");
    var workspaceClean = string.IsNullOrWhiteSpace(
      Git(repositoryRoot, "status", "--porcelain", "--untracked-files=all"));
    var assertionErrors = new List<string>();
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
        workspaceClean,
        assertionErrors))
      .ToArray();
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
    if (assertionErrors.Count > 0)
    {
      throw new InvalidOperationException(
        "Accessibility runtime assertions failed:\n- " +
        string.Join("\n- ", assertionErrors));
    }
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
    bool workspaceClean,
    List<string> assertionErrors)
  {
    var control = CreateControl(scenario);
    var presentationRoot = PreparePresentationRoot(control);
    var window = new Window
    {
      Content = new Border
      {
        Child = presentationRoot,
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
      if (control is FsusTextViewer)
      {
        var moveFocus = new KeyEventArgs
        {
          RoutedEvent = InputElement.KeyDownEvent,
          Source = control,
          Key = Key.Down,
        };
        control.RaiseEvent(moveFocus);
        Dispatcher.UIThread.RunJobs();
      }

      var peer = ControlAutomationPeer.CreatePeerForElement(control)
        ?? throw new InvalidOperationException(
          $"No AutomationPeer for {control.GetType().FullName}.");
      var nodes = new List<AccessibilityNode>();
      CapturePeerTree(
        peer,
        control.GetType().Name,
        "root",
        null,
        control.TabIndex,
        nodes);
      try
      {
        AssertScenarioEvidence(scenario, nodes);
      }
      catch (InvalidOperationException error)
      {
        assertionErrors.Add(error.Message);
      }
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
        runtimeScenario = scenario.Id,
        contractScenario = scenario.ContractScenarioId,
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
          scenario.BindingDisposition,
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
      nameof(FsusAlert) => new FsusAlert(),
      nameof(FsusButton) => new FsusButton(),
      nameof(FsusCheckbox) => new FsusCheckbox(),
      nameof(FsusDataTable) => new FsusDataTable(),
      nameof(FsusDialog) => new FsusDialog(),
      nameof(FsusDrawer) => new FsusDrawer(),
      nameof(FsusDropdown) => new FsusDropdown(),
      nameof(FsusForm) => new FsusForm(),
      nameof(FsusIconButton) => new FsusIconButton(),
      nameof(FsusImageViewer) => new FsusImageViewer(),
      nameof(FsusInboxLayout) => new FsusInboxLayout(),
      nameof(FsusInput) => new FsusInput(),
      nameof(FsusInputNumber) => new FsusInputNumber(),
      nameof(FsusLink) => new FsusLink(),
      nameof(FsusMarkdownEditor) => CreateMarkdownEditor(scenario),
      nameof(FsusMenu) => new FsusMenu(),
      nameof(FsusMessageBox) => new FsusMessageBox(),
      nameof(FsusMetricList) => new FsusMetricList(),
      nameof(FsusPerceptionChallenge) => new FsusPerceptionChallenge(),
      nameof(FsusPerceptionCharacterChallenge) =>
        new FsusPerceptionCharacterChallenge(),
      nameof(FsusPopconfirm) => new FsusPopconfirm(),
      nameof(FsusPopover) => new FsusPopover(),
      nameof(FsusPublicShell) => new FsusPublicShell(),
      nameof(FsusRadio) => new FsusRadio(),
      nameof(FsusResponsiveCollection) => new FsusResponsiveCollection(),
      nameof(FsusSettingsSection) => new FsusSettingsSection(),
      nameof(FsusSiteHeader) => new FsusSiteHeader(),
      nameof(FsusSwitch) => new FsusSwitch(),
      nameof(FsusTableV2) => new FsusTableV2(),
      nameof(FsusTabs) => new FsusTabs(),
      nameof(FsusTextEditor) => new FsusTextEditor(),
      nameof(FsusTextarea) => new FsusTextarea(),
      nameof(FsusTextViewer) => new FsusTextViewer(),
      nameof(FsusThemeModeToggle) => new FsusThemeModeToggle(),
      nameof(FsusTooltip) => new FsusTooltip(),
      nameof(FsusTree) => new FsusTree(),
      nameof(FsusTreeTable) => new FsusTreeTable(),
      nameof(FsusVirtualList) => new FsusVirtualList(),
      _ => throw new InvalidOperationException(
        $"Unknown accessibility runtime factory {scenario.Factory}."),
    };
    AutomationProperties.SetName(control, scenario.AccessibleName);
    if (control is ContentControl contentControl && contentControl.Content is null)
    {
      contentControl.Content = scenario.AccessibleName;
    }
    if (control is FsusInput input)
    {
      input.Text = scenario.Value;
      input.IsInvalid = scenario.Invalid == true;
    }
    if (
      control is FsusInputNumber inputNumber &&
      decimal.TryParse(
        scenario.Value,
        NumberStyles.Float,
        CultureInfo.InvariantCulture,
        out var numberValue))
    {
      inputNumber.Value = numberValue;
    }
    if (control is ToggleButton toggle)
    {
      toggle.IsChecked = scenario.Checked;
    }
    if (control is FsusAlert alert)
    {
      alert.Content = scenario.Value ?? scenario.AccessibleName;
    }
    if (control is FsusAnchoredOverlaySurface anchoredOverlay)
    {
      anchoredOverlay.AccessibleName = scenario.AccessibleName;
      anchoredOverlay.OverlayContent = scenario.AccessibleName;
    }
    if (control is FsusTextViewer textViewer)
    {
      textViewer.AccessibleName = scenario.AccessibleName;
      textViewer.Blocks.Add(
        new FsusTextContentBlock(FsusTextBlockKind.Heading, "Release notes", 1));
      textViewer.Blocks.Add(
        new FsusTextContentBlock(FsusTextBlockKind.Paragraph, "发布说明", Language: "zh"));
      textViewer.Blocks.Add(
        new FsusTextContentBlock(FsusTextBlockKind.ListItem, "Keyboard navigation"));
      textViewer.Blocks.Add(
        new FsusTextContentBlock(FsusTextBlockKind.Quote, "Stable behavior"));
      _ = textViewer.RenderAsync().AsTask().GetAwaiter().GetResult();
    }
    if (control is FsusTextEditor textEditor)
    {
      textEditor.AccessibleName = scenario.AccessibleName;
      textEditor.PreviewDebounce = TimeSpan.Zero;
      textEditor.SetText(new string('a', 29));
      textEditor.TypeText("b");
      textEditor.TypeText("c");
      _ = textEditor.Undo();
      _ = textEditor.SyncPreviewAsync().AsTask().GetAwaiter().GetResult();
    }
    control.IsEnabled = scenario.Disabled != true;
    control.TabIndex = scenario.TabOrder;
    return control;
  }

  private static Control PreparePresentationRoot(Control control)
  {
    if (control is FsusModalSurface modalSurface)
    {
      var host = new FsusOverlayHost();
      modalSurface.Open(host);
      return host;
    }

    if (control is FsusAnchoredOverlaySurface anchoredOverlay)
    {
      var host = new FsusOverlayHost();
      anchoredOverlay.TriggerMode = FsusAnchoredTriggerMode.Manual;
      anchoredOverlay.Open(host, FsusAnchoredOpenReason.Manual);
      return host;
    }

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
    var role = peer.GetAutomationControlType().ToString().ToLowerInvariant();
    var className = NullIfEmpty(peer.GetClassName());
    var name = NullIfEmpty(peer.GetName());
    var liveRegion = peer.GetLiveSetting().ToString().ToLowerInvariant();
    var valueProvider = peer.GetProvider<IValueProvider>();
    var providerValue = valueProvider?.Value;
    var value = ResolveAccessibilityValue(
      role,
      className,
      liveRegion,
      name,
      status,
      providerValue);
    var selection = ParseSelection(status);
    nodes.Add(new(
      id,
      control,
      role,
      className,
      name,
      NullIfEmpty(peer.GetHelpText()),
      value.Value,
      providerValue,
      value.Source,
      selection,
      ParseStatusInt(status, "caret"),
      new(
        !peer.IsEnabled(),
        valueProvider?.IsReadOnly,
        ParseStatusBool(status, "invalid"),
        peer.GetProvider<ISelectionItemProvider>()?.IsSelected,
        Expanded(peer.GetProvider<IExpandCollapseProvider>()),
        Checked(peer.GetProvider<IToggleProvider>())),
      liveRegion,
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
    var problems = new Dictionary<string, string>(StringComparer.Ordinal);
    void Compare<T>(string field, T expected, T actual)
    {
      if (!EqualityComparer<T>.Default.Equals(expected, actual))
      {
        problems[field] = JsonSerializer.Serialize(actual);
      }
    }
    var expectedRole = scenario.Role switch
    {
      "text-input" => "edit",
      "spinbutton" => "spinner",
      "radio" => "radiobutton",
      "tablist" => "tab",
      "link" => "hyperlink",
      "grid" => "datagrid",
      "textbox" => "edit",
      _ => scenario.Role,
    };
    Compare("role", expectedRole, NormalizeRole(root));
    Compare("name", scenario.AccessibleName, root.Name);
    if (scenario.Value is not null)
    {
      Compare("value", scenario.Value, root.Value);
    }
    if (scenario.Disabled is not null)
    {
      Compare("states.disabled", scenario.Disabled.Value, root.States.Disabled);
    }
    if (scenario.Selected is not null)
    {
      Compare("states.selected", scenario.Selected.Value, root.States.Selected);
    }
    if (scenario.Checked is not null)
    {
      Compare(
        "states.checkedState",
        scenario.Checked.Value ? "on" : "off",
        root.States.CheckedState);
    }
    if (scenario.Expanded is not null)
    {
      Compare("states.expanded", scenario.Expanded.Value, root.States.Expanded);
    }
    if (scenario.Invalid is not null)
    {
      Compare("states.invalid", scenario.Invalid.Value, root.States.Invalid);
    }
    Compare("focus.tabOrder", (int?)scenario.TabOrder, root.Focus.TabOrder);
    if (scenario.Factory == nameof(FsusMarkdownEditor))
    {
      if (root.Selection is null)
      {
        problems["selection"] = "null";
      }
      if (root.Caret is null)
      {
        problems["caret"] = "null";
      }
      if (root.Children.Count == 0)
      {
        problems["tree.children"] = "[]";
      }
      var descendantRoles = nodes.Skip(1).Select(node => node.Role).ToArray();
      if (
        !descendantRoles.Contains("group", StringComparer.Ordinal) ||
        !descendantRoles.Contains("button", StringComparer.Ordinal))
      {
        problems["tree.roles"] = JsonSerializer.Serialize(descendantRoles);
      }
    }
    var declaredGaps = scenario.ImplementationGaps.ToDictionary(
      gap => gap.Field,
      StringComparer.Ordinal);
    var problemFields = problems.Keys.ToHashSet(StringComparer.Ordinal);
    if (!problemFields.SetEquals(declaredGaps.Keys))
    {
      throw new InvalidOperationException(
        $"{scenario.Id} problem fields [{string.Join(", ", problemFields.Order())}] " +
        $"do not match declared implementation gaps [{string.Join(", ", declaredGaps.Keys.Order())}].");
    }
    foreach (var (field, observedJson) in problems)
    {
      if (!string.Equals(
        observedJson,
        declaredGaps[field].ObservedJson,
        StringComparison.Ordinal))
      {
        throw new InvalidOperationException(
          $"{scenario.Id} implementation gap {field} expected observed=" +
          $"{declaredGaps[field].ObservedJson} actual={observedJson}.");
      }
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

  private static string NormalizeRole(AccessibilityNode node) =>
    (node.Role, node.ClassName, node.LiveRegion) switch
    {
      ("window", _, _) => "dialog",
      ("text", "Alert", "assertive") => "alert",
      ("text", "Document", _) => "document",
      _ => node.Role,
    };

  private static AccessibilityValue ResolveAccessibilityValue(
    string role,
    string? className,
    string liveRegion,
    string? name,
    string? itemStatus,
    string? providerValue) =>
    (role, className, liveRegion) switch
    {
      ("text", "Alert", "assertive") => new(name, "accessible-name"),
      ("text", "Document", _) => new(itemStatus, "item-status"),
      ("edit", "TextEditor", _) => new(itemStatus, "item-status"),
      _ when providerValue is not null => new(providerValue, "value-provider"),
      _ => new(null, "unavailable"),
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
    string? ClassName,
    string? Name,
    string? Description,
    string? Value,
    string? ProviderValue,
    string ValueSource,
    SelectionSnapshot? Selection,
    int? Caret,
    AccessibilityStates States,
    string LiveRegion,
    string? LogicalParent,
    IReadOnlyList<string> Children,
    FocusState Focus,
    string? ItemStatus);

  private sealed record AccessibilityValue(string? Value, string Source);

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
