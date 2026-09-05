using Avalonia;

namespace FsusUI.Avalonia.Controls;

public enum FsusMarkdownSearchMode
{
  Plain,
  PlainCase,
  WholeWord,
  Regex,
}

public enum FsusMarkdownSearchDirection
{
  Next,
  Previous,
}

public enum FsusMarkdownRevealStatus
{
  Success,
  Deleted,
  Stale,
  NotFound,
  Unsupported,
}

public sealed record FsusMarkdownSearchQuery(
  string Text,
  long QueryVersion,
  FsusMarkdownSearchMode Mode = FsusMarkdownSearchMode.Plain);

public sealed record FsusMarkdownSearchMatch(
  FsusMarkdownSourceRange SourceRange,
  long QueryVersion,
  string? NodeId = null);

public sealed record FsusMarkdownSearchSnapshot(
  FsusMarkdownDocumentIdentity DocumentIdentity,
  int Revision,
  FsusMarkdownSearchQuery Query,
  IReadOnlyList<FsusMarkdownSearchMatch> Matches);

public sealed record FsusMarkdownSearchCommitResult(
  bool Accepted,
  int Revision,
  int MatchCount,
  string? Reason = null);

public sealed record FsusMarkdownSearchNavigationResult(
  FsusMarkdownRevealStatus Status,
  int CurrentIndex,
  FsusMarkdownSearchMatch? Match = null);

public sealed class FsusMarkdownSearchRequestedEventArgs(
  FsusMarkdownDocumentIdentity documentIdentity,
  int revision,
  string source,
  FsusMarkdownSearchQuery query) : EventArgs
{
  public FsusMarkdownDocumentIdentity DocumentIdentity { get; } = documentIdentity;

  public int Revision { get; } = revision;

  public string Source { get; } = source;

  public FsusMarkdownSearchQuery Query { get; } = query;
}

public sealed record FsusMarkdownOutlineDiagnostic(string Code, string? NodeId = null);

public sealed record FsusMarkdownOutlineItem(
  string NodeId,
  int Depth,
  string Text,
  FsusMarkdownSourceRange SourceRange,
  FsusMarkdownSourceRange ContentRange,
  string? ParentId = null,
  IReadOnlyList<FsusMarkdownOutlineDiagnostic>? Diagnostics = null);

public sealed record FsusMarkdownOutlineSnapshot(
  FsusMarkdownDocumentIdentity DocumentIdentity,
  int Revision,
  IReadOnlyList<FsusMarkdownOutlineItem> Items);

public sealed record FsusMarkdownOutlineCommitResult(
  bool Accepted,
  int Revision,
  int ItemCount,
  string? Reason = null);

public enum FsusMarkdownEditorOutputStatus
{
  Succeeded,
  Unsupported,
  Stale,
  Rejected,
}

public sealed record FsusMarkdownEditorOutputCapabilities(
  bool HtmlExport,
  bool Print);

public sealed record FsusMarkdownHtmlExportRequest(
  FsusMarkdownDocumentIdentity DocumentIdentity,
  int Revision,
  string Source,
  FsusMarkdownProjectionSnapshot? Projection,
  string? BaseUri = null,
  bool IncludeDocumentOutline = true);

public sealed record FsusMarkdownHtmlExportResult(
  FsusMarkdownEditorOutputStatus Status,
  string? Html = null,
  string? Detail = null)
{
  public bool Succeeded => Status == FsusMarkdownEditorOutputStatus.Succeeded;
}

public sealed record FsusMarkdownPrintRequest(
  FsusMarkdownDocumentIdentity DocumentIdentity,
  int Revision,
  string Html,
  string? JobName = null);

public sealed record FsusMarkdownPrintResult(
  FsusMarkdownEditorOutputStatus Status,
  string? Detail = null)
{
  public bool Succeeded => Status == FsusMarkdownEditorOutputStatus.Succeeded;
}

/// <summary>
/// Connects the native editor to the canonical Markdown renderer and a host print
/// backend. The host renders the supplied revision-bound source; it must not
/// reconstruct HTML from the editor's native presentation surface.
/// </summary>
public interface IFsusMarkdownEditorOutputHost
{
  FsusMarkdownEditorOutputCapabilities Capabilities { get; }

  ValueTask<FsusMarkdownHtmlExportResult> ExportHtmlAsync(
    FsusMarkdownHtmlExportRequest request,
    CancellationToken cancellationToken = default);

  ValueTask<FsusMarkdownPrintResult> PrintAsync(
    FsusMarkdownPrintRequest request,
    CancellationToken cancellationToken = default);
}

public enum FsusMarkdownTypewriterAnchor
{
  UpperThird,
  Center,
}

public enum FsusMarkdownWritingAidsState
{
  Idle,
  InputDriven,
  ExplicitNavigation,
  UserScrollSuspended,
  SelectionDragSuspended,
  CompositionSuspended,
  Restoring,
}

public enum FsusMarkdownWritingAidsInteraction
{
  Input,
  ExplicitNavigation,
  UserScroll,
  SelectionDragStart,
  SelectionDragEnd,
  CompositionStart,
  CompositionEnd,
  AsyncLayoutChanged,
}

public sealed record FsusMarkdownWritingAidsSnapshot(
  FsusMarkdownDocumentIdentity DocumentIdentity,
  int Revision,
  IReadOnlyList<FsusMarkdownSourceRange> ActiveRanges,
  IReadOnlyList<FsusMarkdownSourceRange>? ExemptRanges = null);

public sealed record FsusMarkdownWritingAidsCommitResult(
  bool Accepted,
  int Revision,
  string? Reason = null);

public sealed class FsusMarkdownWritingAidsRequestedEventArgs(
  FsusMarkdownDocumentIdentity documentIdentity,
  int revision,
  string source,
  FsusMarkdownProjectionSnapshot? projection,
  FsusMarkdownEditorSelection selection) : EventArgs
{
  public FsusMarkdownDocumentIdentity DocumentIdentity { get; } = documentIdentity;

  public int Revision { get; } = revision;

  public string Source { get; } = source;

  public FsusMarkdownProjectionSnapshot? Projection { get; } = projection;

  public FsusMarkdownEditorSelection Selection { get; } = selection;
}

public sealed class FsusMarkdownWritingAidsStateChangedEventArgs(
  FsusMarkdownWritingAidsState state) : EventArgs
{
  public FsusMarkdownWritingAidsState State { get; } = state;
}

public partial class FsusMarkdownEditor
{
  public static readonly StyledProperty<bool> FocusWritingAidEnabledProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, bool>(nameof(FocusWritingAidEnabled));

  public static readonly StyledProperty<bool> TypewriterWritingAidEnabledProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, bool>(nameof(TypewriterWritingAidEnabled));

  public static readonly StyledProperty<FsusMarkdownTypewriterAnchor> TypewriterAnchorProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownTypewriterAnchor>(
      nameof(TypewriterAnchor),
      FsusMarkdownTypewriterAnchor.UpperThird);

  private FsusMarkdownSearchQuery? searchQuery;
  private IReadOnlyList<FsusMarkdownSearchMatch> searchMatches = [];
  private int currentSearchIndex = -1;
  private FsusMarkdownOutlineSnapshot? outlineSnapshot;
  private FsusMarkdownWritingAidsSnapshot? writingAidsSnapshot;
  private FsusMarkdownWritingAidsState writingAidsState;

  public event EventHandler<FsusMarkdownSearchRequestedEventArgs>? SearchRequested;

  public event EventHandler<FsusMarkdownWritingAidsRequestedEventArgs>? WritingAidsRequested;

  public event EventHandler<FsusMarkdownWritingAidsStateChangedEventArgs>? WritingAidsStateChanged;

  public IFsusMarkdownEditorOutputHost? OutputHost { get; set; }

  public FsusMarkdownSearchQuery? SearchQuery => searchQuery;

  public IReadOnlyList<FsusMarkdownSearchMatch> SearchMatches => searchMatches;

  public int CurrentSearchIndex => currentSearchIndex;

  public IReadOnlyList<FsusMarkdownOutlineItem> Outline => outlineSnapshot?.Items ?? [];

  public FsusMarkdownWritingAidsState WritingAidsState => writingAidsState;

  public bool FocusWritingAidEnabled
  {
    get => GetValue(FocusWritingAidEnabledProperty);
    set => SetValue(FocusWritingAidEnabledProperty, value);
  }

  public bool TypewriterWritingAidEnabled
  {
    get => GetValue(TypewriterWritingAidEnabledProperty);
    set => SetValue(TypewriterWritingAidEnabledProperty, value);
  }

  public FsusMarkdownTypewriterAnchor TypewriterAnchor
  {
    get => GetValue(TypewriterAnchorProperty);
    set => SetValue(TypewriterAnchorProperty, value);
  }

  public void RequestSearch(FsusMarkdownSearchQuery query)
  {
    ArgumentNullException.ThrowIfNull(query);
    if (query.Text is null || query.QueryVersion < 0)
    {
      throw new ArgumentOutOfRangeException(nameof(query));
    }
    EnsureStore();
    searchQuery = query;
    searchMatches = [];
    currentSearchIndex = -1;
    UpdateAdjacentPresentation();
    SearchRequested?.Invoke(
      this,
      new(store.Identity, store.Revision, store.Value, query));
  }

  public void ClearSearch()
  {
    searchQuery = null;
    searchMatches = [];
    currentSearchIndex = -1;
    UpdateAdjacentPresentation();
  }

  public FsusMarkdownSearchCommitResult CommitSearch(FsusMarkdownSearchSnapshot snapshot)
  {
    ArgumentNullException.ThrowIfNull(snapshot);
    EnsureStore();
    if (snapshot.DocumentIdentity != store.Identity)
    {
      return new(false, store.Revision, 0, "document-mismatch");
    }
    if (snapshot.Revision != store.Revision)
    {
      return new(false, store.Revision, 0, "stale-revision");
    }
    if (searchQuery is null || snapshot.Query != searchQuery)
    {
      return new(false, store.Revision, 0, "query-mismatch");
    }
    if (!ValidateSearchMatches(snapshot.Matches, snapshot.Query.QueryVersion, store.Value.Length))
    {
      return new(false, store.Revision, 0, "invalid-search-matches");
    }

    searchMatches = snapshot.Matches.ToArray();
    currentSearchIndex = searchMatches.Count == 0 ? -1 : 0;
    UpdateAdjacentPresentation();
    return new(true, store.Revision, searchMatches.Count);
  }

  public FsusMarkdownSearchNavigationResult NavigateSearch(
    FsusMarkdownSearchDirection direction)
  {
    EnsureStore();
    if (searchMatches.Count == 0)
    {
      return new(FsusMarkdownRevealStatus.NotFound, -1);
    }

    currentSearchIndex = direction == FsusMarkdownSearchDirection.Next
      ? (currentSearchIndex + 1 + searchMatches.Count) % searchMatches.Count
      : (currentSearchIndex <= 0 ? searchMatches.Count : currentSearchIndex) - 1;
    var match = searchMatches[currentSearchIndex];
    UpdateAdjacentPresentation();
    var status = RevealSourceRange(
      match.SourceRange,
      store.Identity,
      store.Revision,
      selectRange: true);
    if (status == FsusMarkdownRevealStatus.Success)
    {
      NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.ExplicitNavigation);
    }
    return new(status, currentSearchIndex, match);
  }

  public FsusMarkdownOutlineCommitResult CommitOutline(FsusMarkdownOutlineSnapshot snapshot)
  {
    ArgumentNullException.ThrowIfNull(snapshot);
    EnsureStore();
    if (snapshot.DocumentIdentity != store.Identity)
    {
      return new(false, store.Revision, 0, "document-mismatch");
    }
    if (snapshot.Revision != store.Revision)
    {
      return new(false, store.Revision, 0, "stale-revision");
    }
    if (!ValidateOutline(snapshot.Items, store.Value.Length))
    {
      return new(false, store.Revision, 0, "invalid-outline");
    }

    outlineSnapshot = snapshot with { Items = snapshot.Items.ToArray() };
    return new(true, store.Revision, snapshot.Items.Count);
  }

  public FsusMarkdownRevealStatus RevealHeading(
    string nodeId,
    FsusMarkdownDocumentIdentity expectedDocumentIdentity,
    int expectedRevision)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(nodeId);
    EnsureStore();
    if (expectedDocumentIdentity != store.Identity || expectedRevision != store.Revision)
    {
      return FsusMarkdownRevealStatus.Stale;
    }
    if (Mode is not (FsusMarkdownEditorMode.Source or FsusMarkdownEditorMode.Live))
    {
      return FsusMarkdownRevealStatus.Unsupported;
    }
    if (outlineSnapshot is null ||
      outlineSnapshot.DocumentIdentity != store.Identity ||
      outlineSnapshot.Revision != store.Revision)
    {
      return FsusMarkdownRevealStatus.Stale;
    }
    var item = outlineSnapshot.Items.FirstOrDefault(candidate =>
      string.Equals(candidate.NodeId, nodeId, StringComparison.Ordinal));
    if (item is null)
    {
      return FsusMarkdownRevealStatus.NotFound;
    }

    var status = RevealSourceRange(
      item.ContentRange,
      expectedDocumentIdentity,
      expectedRevision,
      selectRange: true);
    if (status == FsusMarkdownRevealStatus.Success)
    {
      NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction.ExplicitNavigation);
    }
    return status;
  }

  public FsusMarkdownRevealStatus RevealSourceRange(
    FsusMarkdownSourceRange range,
    FsusMarkdownDocumentIdentity expectedDocumentIdentity,
    int expectedRevision,
    bool selectRange = false)
  {
    ArgumentNullException.ThrowIfNull(range);
    EnsureStore();
    if (expectedDocumentIdentity != store.Identity || expectedRevision != store.Revision)
    {
      return FsusMarkdownRevealStatus.Stale;
    }
    if (Mode is not (FsusMarkdownEditorMode.Source or FsusMarkdownEditorMode.Live))
    {
      return FsusMarkdownRevealStatus.Unsupported;
    }
    if (!IsValidRange(range, store.Value.Length))
    {
      return FsusMarkdownRevealStatus.NotFound;
    }
    if (projectionView is null || scrollViewer is null)
    {
      return FsusMarkdownRevealStatus.Unsupported;
    }

    if (selectRange)
    {
      SetNativeSelection(new(range.Start, range.End));
    }
    if (!ScrollToSourceLine(range.Start))
    {
      return FsusMarkdownRevealStatus.Unsupported;
    }
    _ = inputOwner?.Focus();
    return FsusMarkdownRevealStatus.Success;
  }

  public async ValueTask<FsusMarkdownHtmlExportResult> ExportHtmlAsync(
    string? baseUri = null,
    bool includeDocumentOutline = true,
    CancellationToken cancellationToken = default)
  {
    EnsureStore();
    var host = OutputHost;
    if (host is null || !host.Capabilities.HtmlExport)
    {
      return new(FsusMarkdownEditorOutputStatus.Unsupported, Detail: "html-export-unsupported");
    }
    var identity = store.Identity;
    var revision = store.Revision;
    var request = new FsusMarkdownHtmlExportRequest(
      identity,
      revision,
      store.Value,
      projection.Snapshot,
      baseUri,
      includeDocumentOutline);
    var result = await host.ExportHtmlAsync(request, cancellationToken);
    if (identity != store.Identity || revision != store.Revision)
    {
      return new(FsusMarkdownEditorOutputStatus.Stale, Detail: "document-changed");
    }
    if (result.Status == FsusMarkdownEditorOutputStatus.Succeeded &&
      string.IsNullOrWhiteSpace(result.Html))
    {
      return new(FsusMarkdownEditorOutputStatus.Rejected, Detail: "empty-html");
    }
    return result;
  }

  public async ValueTask<FsusMarkdownPrintResult> PrintAsync(
    string? jobName = null,
    string? baseUri = null,
    CancellationToken cancellationToken = default)
  {
    EnsureStore();
    var host = OutputHost;
    if (host is null || !host.Capabilities.Print)
    {
      return new(FsusMarkdownEditorOutputStatus.Unsupported, "print-unsupported");
    }
    var identity = store.Identity;
    var revision = store.Revision;
    var exported = await ExportHtmlAsync(baseUri, true, cancellationToken);
    if (!exported.Succeeded || exported.Html is null)
    {
      return new(exported.Status, exported.Detail);
    }
    if (identity != store.Identity || revision != store.Revision)
    {
      return new(FsusMarkdownEditorOutputStatus.Stale, "document-changed");
    }
    var result = await host.PrintAsync(
      new(identity, revision, exported.Html, jobName),
      cancellationToken);
    return identity == store.Identity && revision == store.Revision
      ? result
      : new(FsusMarkdownEditorOutputStatus.Stale, "document-changed");
  }

  public FsusMarkdownWritingAidsCommitResult CommitWritingAids(
    FsusMarkdownWritingAidsSnapshot snapshot)
  {
    ArgumentNullException.ThrowIfNull(snapshot);
    EnsureStore();
    if (snapshot.DocumentIdentity != store.Identity)
    {
      return new(false, store.Revision, "document-mismatch");
    }
    if (snapshot.Revision != store.Revision)
    {
      return new(false, store.Revision, "stale-revision");
    }
    if (!ValidateRanges(snapshot.ActiveRanges, store.Value.Length) ||
      !ValidateRanges(snapshot.ExemptRanges ?? [], store.Value.Length))
    {
      return new(false, store.Revision, "invalid-ranges");
    }

    writingAidsSnapshot = snapshot with
    {
      ActiveRanges = snapshot.ActiveRanges.ToArray(),
      ExemptRanges = snapshot.ExemptRanges?.ToArray(),
    };
    UpdateAdjacentPresentation();
    return new(true, store.Revision);
  }

  public void NotifyWritingAidsInteraction(FsusMarkdownWritingAidsInteraction interaction)
  {
    var wasSuspended = IsWritingAidsSuspended(writingAidsState);
    var next = interaction switch
    {
      FsusMarkdownWritingAidsInteraction.Input when wasSuspended =>
        FsusMarkdownWritingAidsState.Restoring,
      FsusMarkdownWritingAidsInteraction.Input => FsusMarkdownWritingAidsState.InputDriven,
      FsusMarkdownWritingAidsInteraction.ExplicitNavigation =>
        FsusMarkdownWritingAidsState.ExplicitNavigation,
      FsusMarkdownWritingAidsInteraction.UserScroll =>
        FsusMarkdownWritingAidsState.UserScrollSuspended,
      FsusMarkdownWritingAidsInteraction.SelectionDragStart =>
        FsusMarkdownWritingAidsState.SelectionDragSuspended,
      FsusMarkdownWritingAidsInteraction.SelectionDragEnd
        when writingAidsState == FsusMarkdownWritingAidsState.SelectionDragSuspended =>
          FsusMarkdownWritingAidsState.Idle,
      FsusMarkdownWritingAidsInteraction.CompositionStart =>
        FsusMarkdownWritingAidsState.CompositionSuspended,
      FsusMarkdownWritingAidsInteraction.CompositionEnd
        when writingAidsState == FsusMarkdownWritingAidsState.CompositionSuspended =>
          FsusMarkdownWritingAidsState.Idle,
      _ => writingAidsState,
    };
    SetWritingAidsState(next);

    if (interaction is FsusMarkdownWritingAidsInteraction.Input or
      FsusMarkdownWritingAidsInteraction.ExplicitNavigation or
      FsusMarkdownWritingAidsInteraction.AsyncLayoutChanged)
    {
      RequestWritingAidsSnapshot();
    }
    var shouldApplyTypewriter = interaction switch
    {
      FsusMarkdownWritingAidsInteraction.Input => !wasSuspended,
      FsusMarkdownWritingAidsInteraction.ExplicitNavigation => true,
      FsusMarkdownWritingAidsInteraction.AsyncLayoutChanged =>
        writingAidsState is FsusMarkdownWritingAidsState.InputDriven or
          FsusMarkdownWritingAidsState.ExplicitNavigation,
      _ => false,
    };
    if (TypewriterWritingAidEnabled && shouldApplyTypewriter)
    {
      ApplyTypewriterAnchor();
    }
  }

  private void ResetAdjacentState(bool preserveSearchQuery)
  {
    searchMatches = [];
    currentSearchIndex = -1;
    if (!preserveSearchQuery)
    {
      searchQuery = null;
    }
    outlineSnapshot = null;
    writingAidsSnapshot = null;
    SetWritingAidsState(FsusMarkdownWritingAidsState.Idle);
    UpdateAdjacentPresentation();
  }

  private void RefreshAdjacentStateAfterTransaction()
  {
    outlineSnapshot = null;
    writingAidsSnapshot = null;
    searchMatches = [];
    currentSearchIndex = -1;
    UpdateAdjacentPresentation();
    if (searchQuery is not null)
    {
      SearchRequested?.Invoke(
        this,
        new(store.Identity, store.Revision, store.Value, searchQuery));
    }
    RequestWritingAidsSnapshot();
  }

  private void RequestWritingAidsSnapshot()
  {
    if (!FocusWritingAidEnabled)
    {
      return;
    }
    WritingAidsRequested?.Invoke(
      this,
      new(
        store.Identity,
        store.Revision,
        store.Value,
        projection.Snapshot,
        store.Selection));
  }

  private void UpdateAdjacentPresentation()
  {
    if (projectionView is null)
    {
      return;
    }
    var focusEnabled =
      FocusWritingAidEnabled &&
      string.Equals(Profile, "prose", StringComparison.Ordinal) &&
      !IsReadOnly &&
      Mode != FsusMarkdownEditorMode.Preview &&
      writingAidsSnapshot is not null &&
      writingAidsSnapshot.DocumentIdentity == store.Identity &&
      writingAidsSnapshot.Revision == store.Revision;
    projectionView.UpdateAdjacent(
      searchMatches,
      currentSearchIndex,
      focusEnabled ? writingAidsSnapshot!.ActiveRanges : [],
      focusEnabled ? writingAidsSnapshot!.ExemptRanges ?? [] : [],
      focusEnabled);
  }

  private void ApplyTypewriterAnchor()
  {
    if (projectionView is null || scrollViewer is null)
    {
      return;
    }
    var caretTop = projectionView.GetVisualLineTopForSource(store.Selection.End);
    var anchor = TypewriterAnchor == FsusMarkdownTypewriterAnchor.Center
      ? scrollViewer.Viewport.Height / 2
      : scrollViewer.Viewport.Height / 3;
    scrollRestoreGeneration++;
    scrollViewer.Offset = new(
      scrollViewer.Offset.X,
      Math.Clamp(caretTop - anchor, 0, Math.Max(0, scrollViewer.Extent.Height - scrollViewer.Viewport.Height)));
  }

  private void SetWritingAidsState(FsusMarkdownWritingAidsState value)
  {
    if (writingAidsState == value)
    {
      return;
    }
    writingAidsState = value;
    WritingAidsStateChanged?.Invoke(this, new(value));
  }

  private static bool IsWritingAidsSuspended(FsusMarkdownWritingAidsState value) =>
    value is FsusMarkdownWritingAidsState.UserScrollSuspended or
      FsusMarkdownWritingAidsState.SelectionDragSuspended or
      FsusMarkdownWritingAidsState.CompositionSuspended;

  private static bool ValidateSearchMatches(
    IReadOnlyList<FsusMarkdownSearchMatch>? matches,
    long queryVersion,
    int sourceLength)
  {
    if (matches is null)
    {
      return false;
    }
    var cursor = 0;
    foreach (var match in matches)
    {
      if (match is null ||
        match.QueryVersion != queryVersion ||
        !IsValidRange(match.SourceRange, sourceLength) ||
        match.SourceRange.Start == match.SourceRange.End ||
        match.SourceRange.Start < cursor)
      {
        return false;
      }
      cursor = match.SourceRange.End;
    }
    return true;
  }

  private static bool ValidateOutline(
    IReadOnlyList<FsusMarkdownOutlineItem>? items,
    int sourceLength)
  {
    if (items is null)
    {
      return false;
    }
    var identities = new HashSet<string>(StringComparer.Ordinal);
    var cursor = 0;
    foreach (var item in items)
    {
      if (item is null ||
        string.IsNullOrWhiteSpace(item.NodeId) ||
        !identities.Add(item.NodeId) ||
        item.Depth is < 1 or > 6 ||
        !IsValidRange(item.SourceRange, sourceLength) ||
        !IsValidRange(item.ContentRange, sourceLength) ||
        item.SourceRange.Start < cursor ||
        item.ContentRange.Start < item.SourceRange.Start ||
        item.ContentRange.End > item.SourceRange.End ||
        (item.ParentId is not null && !identities.Contains(item.ParentId)))
      {
        return false;
      }
      cursor = item.SourceRange.End;
    }
    return true;
  }

  private static bool ValidateRanges(
    IReadOnlyList<FsusMarkdownSourceRange>? ranges,
    int sourceLength)
  {
    if (ranges is null)
    {
      return false;
    }
    var cursor = 0;
    foreach (var range in ranges)
    {
      if (!IsValidRange(range, sourceLength) || range.Start < cursor)
      {
        return false;
      }
      cursor = range.End;
    }
    return true;
  }

  private static bool IsValidRange(FsusMarkdownSourceRange? range, int sourceLength) =>
    range is not null &&
    range.Start >= 0 &&
    range.End >= range.Start &&
    range.End <= sourceLength;
}
