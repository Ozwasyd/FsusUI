import hashlib
import json
from pathlib import Path
import re

root = Path('/workspace/native-reviewed-integration')
out = Path('/workspace/native-reviewed-evidence')
headless = 'dotnet/FsusUI.Avalonia.HeadlessTests/'
unit = 'dotnet/FsusUI.Avalonia.Tests/Controls/'
table = {
    'AutoResizerObservesArrangedViewportAndHonorsDisabledAxes',
    'AutoResizerAndTableV2VirtualizeRowsColumnsResizeAndBudget',
    'TableV2BindsTypedRowsFixedColumnsAndRealKeyboardScroll',
    'TableV2MeasuresDynamicRowsAndRaisesRealScrollCallbacks',
    'TableV2UsesFixedDataGetterAndExpandedRowCallbacks',
    'TableV2MapsViewportGeometryAndCacheToRealLayout',
    'TableV2SortsTypedRowsAndReportsColumnSort',
    'TableV2RendersBoundedContentRegions',
    'TableV2ContentRegionsReceiveScopedPayloads',
    'TableV2VirtualizesFrozenAxesNavigatesAndRejectsStaleBackgroundResults',
}
pdf = {
    'TaggedPdfAndHierarchicalOutlineAreProvenByAdapterSimulation',
    'UnsupportedPdfCapabilityDoesNotInvokeBackendOrTouchStream',
    'CancellationPropagatesAndDestinationOwnershipStaysWithCaller',
    'InFlightCancellationInterruptsBackendAndPreservesDestinationOwnership',
    'BackendCannotSilentlyClaimRequestedOutlineWasApplied',
    'BackendCannotCloseCallerOwnedPdfStream',
    'BackendCannotClaimSuccessWithoutWritingPdfBytes',
    'BackendCannotClaimPdfStructureOrMissingOutlineDestination',
    'BackendCannotClaimSuccessWithPdfMarkersButNoObjectGraph',
}
specs = [
    ('headless', 'Font', headless + 'FsusBundledInterFontRegistrationRegressionTests.cs', None, set()),
    ('headless', 'Tree', headless + 'FsusTreeScrollingHeadlessTests.cs', None, set()),
    ('headless', 'TableV2', headless + 'FsusVirtualizationHeadlessTests.cs', table, set()),
    ('headless', 'Shortcut', headless + 'FsusNativeMenuHeadlessTests.cs', None, set()),
    ('headless', 'Shortcut', headless + 'FsusNativeMenuTests.cs', None, {'LocalPlatformSimulationProducesBoundEvidence'}),
    ('headless', 'Shortcut', headless + 'FsusShortcutRecorderHeadlessTests.cs', None, {'ProductionFixtureRendersShortcutRecorderStateMatrix'}),
    ('unit', 'Tree', unit + 'FsusTreeRowRetentionTests.cs', None, set()),
    ('unit', 'Shortcut', unit + 'FsusCommandPaletteTests.cs', None, set()),
    ('unit', 'Shortcut', unit + 'FsusShortcutRecorderTests.cs', None, set()),
    ('unit', 'PDF', unit + 'FsusWebViewAdapterTests.cs', pdf, set()),
]
rows = []
for project, owner, path, include, exclude in specs:
    source = (root / path).read_text()
    namespace = re.search(r'namespace (\S+);', source).group(1)
    cls = re.search(r'public class (\w+)', source).group(1)
    assert not re.search(r'IClassFixture|ICollectionFixture|BeforeAfterTestAttribute|\[Collection\(', source)
    markers = list(re.finditer(r'^  \[(Avalonia)?(Fact|Theory)\b', source, re.M))
    selected = set()
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(source)
        block = source[marker.start():end]
        method = re.search(r'public (?:async )?(?:void|Task) (\w+)\(', block)
        assert method, path
        name = method.group(1)
        if name in exclude or (include is not None and name not in include):
            continue
        attrs = block[:method.start()]
        assert 'MemberData' not in attrs and 'ClassData' not in attrs
        cases = len(re.findall(r'\[InlineData\(', attrs)) if marker.group(2) == 'Theory' else 1
        assert cases > 0
        if 'Skip' in attrs:
            assert owner == 'Font' and 'SkipUnless = nameof(IsLinux)' in attrs
        # The last block can include private helpers, so inspect only the body
        # through the first following private declaration for held route calls.
        body = re.split(r'^  private ', block, maxsplit=1, flags=re.M)[0]
        assert not re.search(r'FindRepositoryRoot\(|RepositoryRoot\(|File\.Create\(|RenderStateMatrix\(', body), name
        selected.add(name)
        rows.append({'project': project, 'owner': owner, 'path': path,
                     'fqn': f'{namespace}.{cls}.{name}', 'expectedCases': cases,
                     'sourceSha256': hashlib.sha256((root / path).read_bytes()).hexdigest()})
    if include is not None:
        assert selected == include

assert len({row['fqn'] for row in rows}) == len(rows)
for project, expected_methods, expected_cases in [('headless', 38, 46), ('unit', 33, 45)]:
    subset = [row for row in rows if row['project'] == project]
    assert len(subset) == expected_methods, (project, len(subset))
    assert sum(row['expectedCases'] for row in subset) == expected_cases
    selector = '|'.join('FullyQualifiedName=' + row['fqn'] for row in subset)
    (out / f'{project}-filter.txt').write_text(selector + '\n')
    print(project, 'exact methods:', expected_methods, 'expected cases:', expected_cases)
(out / 'ordinary-selection.json').write_text(json.dumps(rows, indent=2) + '\n')
