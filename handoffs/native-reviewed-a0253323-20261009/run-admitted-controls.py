from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET

root = Path('/workspace/native-reviewed-integration')
evidence = Path('/workspace/native-reviewed-evidence')
selection = json.loads((evidence / 'ordinary-selection.json').read_text())
assert not os.environ.get('FSUSUI_UPDATE_VISUAL_ARTIFACTS')
assert not os.environ.get('CustomBeforeDirectoryBuildTargets')
assert subprocess.check_output(['dotnet', '--version'], cwd=root / 'dotnet', text=True).strip() == '10.0.401'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip()
axes = [('headless', '0', 46), ('headless', '1', 46), ('unit', '0', 45)]
admitted = []

def method_name(case):
    return case.split('(', 1)[0].strip()

# Preflight every axis before executing any test. A mismatch stops all tests.
for project, flag, count in axes:
    rows = [r for r in selection if r['project'] == project]
    methods = {r['fqn']: r['expectedCases'] for r in rows}
    assert sum(methods.values()) == count
    selector = (evidence / f'{project}-filter.txt').read_text().strip()
    assert selector == '|'.join('FullyQualifiedName=' + r['fqn'] for r in rows)
    assert methods and selector
    project_path = ('FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj'
                    if project == 'headless' else 'FsusUI.Avalonia.Tests/FsusUI.Avalonia.Tests.csproj')
    env = os.environ.copy()
    env['FSUS_HEADLESS_GSANS'] = flag
    env['PATH'] = '/usr/bin:' + env['PATH']
    common = ['dotnet', 'test', project_path, '-c', 'Release', '--no-build', '--no-restore']
    command = common + ['--list-tests', '--filter', selector]
    result = subprocess.run(command, cwd=root / 'dotnet', env=env, capture_output=True, text=True)
    label = project + '-gsans-' + flag
    (evidence / (label + '-discovery.log')).write_text(result.stdout + result.stderr)
    assert result.returncode == 0, label
    names = [line.strip() for line in result.stdout.splitlines()
             if line.strip().startswith('FsusUI.Avalonia.')]
    assert len(names) == len(set(names)) == count, (label, len(names), count)
    assert Counter(method_name(name) for name in names) == Counter(methods), label
    admission = {'label': label, 'project': project, 'flag': flag, 'expected': count,
                 'expectedCases': sorted(names), 'discoveryCommand': command,
                 'commonCommand': common}
    admitted.append(admission)
    print(label + ': exact discovery=' + str(count), flush=True)
(evidence / 'admission.json').write_text(json.dumps(admitted, indent=2) + '\n')

runs = []
for admission in admitted:
    label = admission['label']
    env = os.environ.copy()
    env['FSUS_HEADLESS_GSANS'] = admission['flag']
    env['PATH'] = '/usr/bin:' + env['PATH']
    results_dir = evidence / label
    results_dir.mkdir(exist_ok=True)
    selector = (evidence / (admission['project'] + '-filter.txt')).read_text().strip()
    command = admission['commonCommand'] + ['--filter', selector, '--logger',
                  'trx;LogFileName=combined.trx', '--results-directory', str(results_dir)]
    result = subprocess.run(command, cwd=root / 'dotnet', env=env, capture_output=True, text=True)
    (evidence / (label + '-test.log')).write_text(result.stdout + result.stderr)
    trx = results_dir / 'combined.trx'
    ns = {'t': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}
    document = ET.parse(trx)
    cases = document.findall('.//t:UnitTestResult', ns)
    names = [case.attrib['testName'] for case in cases]
    assert sorted(names) == admission['expectedCases'], label
    counters = document.find('.//t:Counters', ns).attrib
    assert int(counters['total']) == int(counters['executed']) == admission['expected']
    assert int(counters['notExecuted']) == 0
    per_owner = {}
    for case in cases:
        row = next(row for row in selection if row['fqn'] == method_name(case.attrib['testName']))
        owner_counts = per_owner.setdefault(row['owner'], Counter())
        owner_counts[case.attrib['outcome']] += 1
    run = {'label': label, 'command': command, 'processExit': result.returncode,
           'counters': counters, 'perOwner': per_owner,
           'cases': [{'name': case.attrib['testName'], 'outcome': case.attrib['outcome']}
                     for case in cases], 'trxSha256': hashlib.sha256(trx.read_bytes()).hexdigest()}
    runs.append(run)
    (evidence / 'combined-results.json').write_text(json.dumps(runs, indent=2) + '\n')
    print(label + ': ' + json.dumps(per_owner), flush=True)
sys.exit(1 if any(run['processExit'] != 0 for run in runs) else 0)
