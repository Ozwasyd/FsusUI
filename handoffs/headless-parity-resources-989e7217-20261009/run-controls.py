import hashlib
import json
import os
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

root = Path('/workspace/parity-resource-integration')
evidence = Path('/workspace/parity-resource-evidence')
project = 'FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj'
expected = set((evidence / 'expected-tests.txt').read_text().splitlines())
selector = (evidence / 'filter.txt').read_text().strip()
assert len(expected) == 11
assert selector.count('FullyQualifiedName=') == 7
assert 'FsusVueParityBatch3EvidenceTests.' not in selector
assert not os.environ.get('FSUSUI_UPDATE_VISUAL_ARTIFACTS')
assert not os.environ.get('CustomBeforeDirectoryBuildTargets')
runs = []

for flag in ('0', '1'):
    env = os.environ.copy()
    env['FSUS_HEADLESS_GSANS'] = flag
    common = ['dotnet', 'test', project, '-c', 'Release', '--no-build', '--no-restore']
    discovery_command = common + ['--list-tests', '--filter', selector]
    discovery = subprocess.run(discovery_command, cwd=root / 'dotnet', env=env,
                               capture_output=True, text=True)
    discovery_path = evidence / f'gsans-{flag}-discovery.log'
    discovery_path.write_text(discovery.stdout + discovery.stderr)
    assert discovery.returncode == 0, discovery_path
    names = {line.strip() for line in discovery.stdout.splitlines()
             if line.strip().startswith('FsusUI.Avalonia.HeadlessTests.')}
    assert names == expected, {'missing': sorted(expected - names), 'extra': sorted(names - expected)}
    result_dir = evidence / f'gsans-{flag}'
    result_dir.mkdir(exist_ok=True)
    test_command = common + ['--filter', selector, '--logger', 'trx;LogFileName=typography.trx',
                             '--results-directory', str(result_dir)]
    test = subprocess.run(test_command, cwd=root / 'dotnet', env=env,
                          capture_output=True, text=True)
    test_path = evidence / f'gsans-{flag}-test.log'
    test_path.write_text(test.stdout + test.stderr)
    assert test.returncode == 0, test_path
    trx_path = result_dir / 'typography.trx'
    document = ET.parse(trx_path)
    ns = {'t': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}
    results = document.findall('.//t:UnitTestResult', ns)
    assert len(results) == 11
    result_names = {result.attrib['testName'] for result in results}
    assert result_names == expected, {'missing': sorted(expected - result_names), 'extra': sorted(result_names - expected)}
    assert all(result.attrib['outcome'] == 'Passed' for result in results)
    counters = document.find('.//t:Counters', ns).attrib
    assert all(int(counters[x]) == 11 for x in ('total', 'executed', 'passed'))
    assert all(int(counters[x]) == 0 for x in ('failed', 'notExecuted', 'error', 'timeout', 'aborted'))
    run = {'FSUS_HEADLESS_GSANS': flag, 'discoveryCommand': discovery_command,
           'testCommand': test_command, 'discovered': len(names), 'counters': counters,
           'cases': sorted(result_names),
           'trxSha256': hashlib.sha256(trx_path.read_bytes()).hexdigest()}
    runs.append(run)
    (evidence / 'control-results.json').write_text(json.dumps(runs, indent=2) + '\n')
    print(f'GSANS={flag}: discovery=11; passed=11, failed=0, skipped=0', flush=True)
