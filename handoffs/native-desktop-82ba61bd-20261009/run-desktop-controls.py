from collections import Counter
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET

root = Path('/workspace/native-desktop-successor')
out = Path('/workspace/native-desktop-evidence')
source_path = root / 'dotnet/FsusUI.Avalonia.HeadlessTests/FsusDesktopShellHeadlessTests.cs'
source = source_path.read_text()
expected = {
    'DocumentTabsCancelClosePreserveDirtyStateReorderAndSelectAdjacentFallback': 1,
    'DocumentContextRequestReturnsTypedStableAnchorWithoutSelectingTarget': 1,
    'DocumentTabsSupportCloseDragReorderOverflowContextAndPlatformCycling': 2,
    'DocumentContentKeepsSingleVisualParentAcrossThemeRemovalAndRemount': 2,
    'AutomationPeersExposeSelectionDirtyExpandedAndCloseSemantics': 1,
}
assert len(expected) == 5 and sum(expected.values()) == 7
assert not re.search(r'IClassFixture|ICollectionFixture|BeforeAfterTestAttribute|\[Collection\(', source)
markers = list(re.finditer(r'^  \[Avalonia(Fact|Theory)\b', source, re.M))
found = {}
for i, marker in enumerate(markers):
    block = source[marker.start():markers[i + 1].start() if i + 1 < len(markers) else len(source)]
    method = re.search(r'public void (\w+)\(', block)
    name = method.group(1)
    if name in expected:
        attrs = block[:method.start()]
        assert not any(word in attrs for word in ['Skip', 'MemberData', 'ClassData'])
        assert not any(word in block for word in ['FindRepositoryRoot(', 'Render(outputRoot', 'File.Create('])
        found[name] = len(re.findall(r'\[InlineData\(', attrs)) if marker.group(1) == 'Theory' else 1
assert found == expected
namespace = 'FsusUI.Avalonia.HeadlessTests.FsusDesktopShellHeadlessTests.'
methods = {namespace + name: count for name, count in expected.items()}
selector = '|'.join('FullyQualifiedName=' + name for name in methods)
(out / 'desktop-filter.txt').write_text(selector + '\n')
(out / 'desktop-selection.json').write_text(json.dumps({'methodCases': methods, 'expected': 7,
    'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest()}, indent=2) + '\n')
assert not os.environ.get('FSUSUI_UPDATE_VISUAL_ARTIFACTS')
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip()
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
assert head == '82ba61bda502230e4c1fcd1e9084ab2e6c006fda'
common = ['dotnet', 'test', 'FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj',
          '--no-build', '--no-restore', '-c', 'Release', '--filter', selector]
admitted = []
for flag in ['0', '1']:
    env = os.environ.copy()
    env['FSUS_HEADLESS_GSANS'] = flag
    env['FSUS_AVALONIA_VISUAL_EVIDENCE_ROOT'] = str(out / 'visual')
    env['FSUS_WEBVIEW_CANDIDATE_SHA'] = head
    command = common + ['--list-tests']
    result = subprocess.run(command, cwd=root / 'dotnet', env=env, capture_output=True, text=True)
    (out / f'desktop-gsans-{flag}-discovery.log').write_text(result.stdout + result.stderr)
    assert result.returncode == 0
    names = [line.strip() for line in result.stdout.splitlines() if line.strip().startswith(namespace)]
    assert len(names) == len(set(names)) == 7
    assert Counter(name.split('(', 1)[0] for name in names) == Counter(methods)
    admitted.append({'flag': flag, 'names': sorted(names), 'discoveryCommand': command})
(out / 'desktop-admission.json').write_text(json.dumps(admitted, indent=2) + '\n')

runs = []
for admission in admitted:
    flag = admission['flag']
    env = os.environ.copy()
    env['FSUS_HEADLESS_GSANS'] = flag
    env['FSUS_AVALONIA_VISUAL_EVIDENCE_ROOT'] = str(out / 'visual')
    env['FSUS_WEBVIEW_CANDIDATE_SHA'] = head
    result_dir = out / f'desktop-gsans-{flag}'
    command = common + ['--logger', 'trx;LogFileName=desktop.trx', '--results-directory', str(result_dir)]
    result = subprocess.run(command, cwd=root / 'dotnet', env=env, capture_output=True, text=True)
    (out / f'desktop-gsans-{flag}-test.log').write_text(result.stdout + result.stderr)
    ns = {'t': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}
    trx = result_dir / 'desktop.trx'
    document = ET.parse(trx)
    cases = document.findall('.//t:UnitTestResult', ns)
    assert sorted(case.attrib['testName'] for case in cases) == admission['names']
    counters = document.find('.//t:Counters', ns).attrib
    assert int(counters['total']) == int(counters['executed']) == 7 and int(counters['notExecuted']) == 0
    runs.append({'head': head, 'flag': flag, 'command': command, 'exit': result.returncode,
                 'counters': counters, 'trxSha256': hashlib.sha256(trx.read_bytes()).hexdigest(),
                 'cases': [{'name': c.attrib['testName'], 'outcome': c.attrib['outcome']} for c in cases]})
    (out / 'desktop-results.json').write_text(json.dumps(runs, indent=2) + '\n')
    print('Desktop GSANS=' + flag + ': ' + json.dumps(counters), flush=True)
assert all(run['exit'] == 0 for run in runs)
