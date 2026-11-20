#!/usr/bin/env python3
"""Diagnostic only. Run the #1147 frame gate driver for fixed-list and pipeline on one runner."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import random
import re
import signal
import statistics
import subprocess

SOURCE_SHA = '8184f9c3235e2437099c4cbb741a1fb17cad0aa658498d58de8f823233d984fb'
BASE_SHA = 'f2d929a5d045439c35e93b4771f912ce50ec2337'
CANDIDATE_TREE = '302622aed21489a1d04e468a1cc2fa4815696ac8'
CANDIDATE_SHA = '85ac42755432f06aa6b8fbdff751a98b29b8dad6'
ARCHIVED_CANDIDATE_SHA = '340712f4049e03e3282ad92f3c0f4d8121bd85d9'
PROTOCOL = 'd36a8ee405bcb0884294a1bf3a2c1ae691c5c9c22e33b0304a007d3db79188c1'
BINDING_SHA = '621e5cb7e91aea44618ec5b64b01195480aa6d02353383b1ff134e57f78f1f1e'
BROWSER = '147.0.7727.15'
NODE = '22.23.5'
PNPM = '10.33.0'
CASES = {
    'virtual-list-fixed-100000-60hz-dpr1-enabled': ['virtual-list-fixed', 100000, 60, 1, 'enabled'],
    'data-pipeline-table-100000-60hz-dpr2-reduced': ['data-pipeline-table', 100000, 60, 2, 'reduced'],
}
HOST_FIELDS = ('os', 'cpu', 'logicalCores', 'totalMemoryBytes', 'node', 'browser')
OLD_ROOT = '/home/runner/work/FsusUI/FsusUI/current'
MODS = ('web-idle-cadence.mjs', 'web-render-cadence.mjs',
        'web-render-diagnostics.mjs', 'web-render-liveness.mjs')
MOD_SHA = dict(zip(MODS, (
    'f2463d789414dea4d8642e84e230a86d4b23ab9eb47dc51277903a803ef2a3f7',
    '8382081035eab274e23f505a730c8bd1aea0f8a7c93b442d0a59d9c28f6723d5',
    '1797c650722d29511a525afe14da4dbb83f31d12e94b9a4debca39dc554f422c',
    'e9cfe6ff5c94a5897d4eaa336582d429d96ed0b74de8d2af050600a733c4e952',
)))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def one(s, a, b):
    if s.count(a) != 1:
        raise ValueError('Pinned driver anchor missing or ambiguous: ' + a[:80])
    return s.replace(a, b)


def adapt(source, product, helper, playwright):
    if sha(source) != SOURCE_SHA:
        raise ValueError('Unexpected #1147 driver bytes')
    s = source.decode('utf8')
    s = one(s, 'const root = ' + json.dumps(OLD_ROOT),
            'const root = ' + json.dumps(str(product)))
    for m in MODS:
        s = one(s, f'"file://{OLD_ROOT}/scripts/{m}"', json.dumps((helper / m).as_uri()))
    s = one(s, f'"file://{OLD_ROOT}/node_modules/@playwright/test/index.js"',
            json.dumps(playwright.as_uri()))
    start = s.index('const matrix = scenarioFilter')
    end = s.index('const percentile = ', start)
    s = s[:start] + 'const matrix = ' + json.dumps(list(CASES.values())) + '\n\n' + s[end:]
    s = one(s, '      diagnosticCapture &&', '      false && diagnosticCapture &&')
    s = one(s, 'const tick = (now) => {\n          window.__fsusFrameIntervals',
            'const tick = (now) => {\n          window.__fsusDiagLastRaf = now\n'
            '          window.__fsusFrameIntervals')
    s = one(s, '    const inputToFrame = []', '    const phaseAnchors = []\n    const inputToFrame = []')
    s = one(s, '          const started = performance.now()\n          await window.__FSUSUI_PERFORMANCE_FIXTURE__.act',
            '          const previousRaf = window.__fsusDiagLastRaf ?? null\n'
            '          const previousProbeCompleted = window.__fsusDiagLastTableProbe ?? null\n'
            '          const started = performance.now()\n          await window.__FSUSUI_PERFORMANCE_FIXTURE__.act')
    s = one(s, '          const actionCompleted = performance.now()',
            '          const actionRaf = window.__fsusDiagLastRaf ?? null\n'
            '          const actionCompleted = performance.now()')
    s = one(s, '          await page.evaluate(() =>\n            window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe(),\n          ),',
            '          await page.evaluate(async () => {\n'
            '            const probe = await window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe()\n'
            '            window.__fsusDiagLastTableProbe = performance.now()\n'
            '            return probe\n'
            '          }),')
    s = one(s, '            anchor: captureDiagnostic\n',
            '            phaseAnchor: { iteration, previousRaf, started, actionRaf, actionCompleted, frameCompleted, rafTimestamp, previousProbeCompleted },\n'
            '            anchor: captureDiagnostic\n')
    s = one(s, '      inputToFrame.push(sample.inputToNextFrameMs)',
            '      inputToFrame.push(sample.inputToNextFrameMs)\n      phaseAnchors.push(sample.phaseAnchor)')
    s = one(s, '      inputToFrame,\n      frameWork,',
            '      inputToFrame,\n      phaseAnchors,\n      frameWork,')
    return s


def read(p):
    return json.loads(p.read_text())


def write(p, x):
    p.write_text(json.dumps(x, indent=2, allow_nan=False) + '\n')


def p95(xs):
    if len(xs) != 21 or any(type(x) not in (int, float) or not math.isfinite(x) or x < 0 for x in xs):
        raise ValueError('Expected 21 finite nonnegative samples')
    return sorted(xs)[19]


def summarize_case(arm, detail, case, config, row, bundle):
    raw = read(arm / (case + '.raw.json'))
    if raw['id'] != case or raw['measurementProtocol'] != bundle:
        raise ValueError('Arm identity mismatch')
    if raw['idleCadence']['cadence']['status'] != 'consistent-with-request':
        raise ValueError('60Hz idle calibration failed')
    coordinates = ['scenario', 'size', 'refreshHz', 'dpr', 'motion']
    if ([raw[k] for k in coordinates] != config or [row[k] for k in coordinates] != config
            or row['measurementProtocol'] != bundle or raw['idleCadence'] != detail['idleCadence']):
        raise ValueError('Arm case configuration mismatch')
    e2e, work, anchors = raw['inputToFrame'], raw['frameWork'], raw['phaseAnchors']
    ep, wp = p95(e2e), p95(work)
    if abs(ep - row['inputToNextFrameMs']['p95']) > 1e-7 or len(anchors) != 21:
        raise ValueError('Raw/summary mismatch')
    waits, probe_gaps, submission_offsets, callbacks_since_start = [], [], [], []
    for i, (elapsed, acted, timing) in enumerate(zip(e2e, work, anchors), start=1):
        p, s, ar, a, f, r = [timing[k] for k in
                            ('previousRaf','started','actionRaf','actionCompleted','frameCompleted','rafTimestamp')]
        if (timing['iteration'] != i or any(type(x) not in (int,float) or not math.isfinite(x) for x in (p,s,ar,a,f,r))
                or not p <= s <= a <= f or not p <= ar <= a or not ar <= r <= f or abs((f-s) - elapsed) > 1e-7 or abs((a-s)-acted) > 1e-7):
            raise ValueError('Invalid same-clock phase anchor')
        waits.append(f-a)
        callbacks_since_start.append(ar > p)
        submission_offsets.append(a - ar)
        previous_probe = timing['previousProbeCompleted']
        if config[0] == 'data-pipeline-table' and i > 1:
            if (type(previous_probe) not in (int, float) or not math.isfinite(previous_probe)
                    or not anchors[i-2]['frameCompleted'] <= previous_probe <= s):
                raise ValueError('Invalid previous table probe anchor')
            probe_gaps.append(s - previous_probe)
        elif previous_probe is not None:
            raise ValueError('Unexpected previous table probe')
    probes = raw['dataPipeline']
    if len(probes) != (21 if config[0] == 'data-pipeline-table' else 0):
        raise ValueError('Unchanged table auxiliary probe count is required')
    probe_summary = {
        label:p95([entry[label] for entry in probes])
        for label in ('legacyBlockMs','workerEndToEndMs','workerSubmitBlockMs')
    } if probes else None
    return {'p95':ep,'actionP95':wp,'waitP95':p95(waits),'waitOver10':sum(w > 10 for w in waits),
            'submissionPhaseMedian':statistics.median(submission_offsets),
            'actionCrossedRafCount':sum(callbacks_since_start),
            'priorTableProbeToStartMedian':statistics.median(probe_gaps) if probe_gaps else None,
            'tableAuxiliaryP95':probe_summary,
            'domNodes':raw['domNodes'], 'droppedFrameRate':raw['droppedFrameRate']}


def summarize(arm, commit, bundle):
    detail = read(arm / 'summary.json')
    if (detail['gitSha'] != commit or detail['measurementProtocol'] != bundle
            or detail['environment']['browser'] != 'Chromium ' + BROWSER
            or detail['environment']['node'] != 'v' + NODE
            or detail['runner'] != dict(warmups=1, samples=21, matrixSize=len(CASES))
            or [row['id'] for row in detail['results']] != list(CASES)):
        raise ValueError('Arm identity or case order mismatch')
    host = {name:detail['environment'][name] for name in HOST_FIELDS}
    if not all(host.values()):
        raise ValueError('Missing runner signature')
    return {'host':host, 'cases':{
        case:summarize_case(arm, detail, case, cfg, row, bundle)
        for (case,cfg),row in zip(CASES.items(),detail['results'])
    }}


def plan(n, seed):
    z = random.Random(seed)
    result = [('AB', i, 'ABBA' if i % 2 == 0 else 'BAAB') for i in range(n)]
    result += [('AA', i, 'AXXA' if i % 2 == 0 else 'XAAX') for i in range(n)]
    z.shuffle(result)
    return result


def score_case(blocks):
    groups = {'AB':[], 'AA':[]}
    fields = ('actionP95','waitP95','submissionPhaseMedian','priorTableProbeToStartMedian')
    phases = {field:{'AB':[],'AA':[]} for field in fields}
    for kind, rows in blocks:
        left = [r['p95'] for t,r in rows if t == 'A']
        right = [r['p95'] for t,r in rows if t != 'A']
        if len(left) != 2 or len(right) != 2 or min(left+right) <= 0:
            raise ValueError('Incomplete crossover block')
        groups[kind].append(math.sqrt(right[0]*right[1]/(left[0]*left[1])) - 1)
        for field in fields:
            left_phase = [r[field] for t,r in rows if t == 'A']
            right_phase = [r[field] for t,r in rows if t != 'A']
            if all(x is None for x in left_phase + right_phase):
                continue
            if not all(type(x) in (int,float) and math.isfinite(x) for x in left_phase + right_phase):
                raise ValueError('Mixed or invalid diagnostic phase')
            phases[field][kind].append(statistics.mean(right_phase)-statistics.mean(left_phase))
    return {'formalAcceptance':False,'ratiosMinusOne':groups,'phaseDifferencesMs':phases,
            'ABMedian':statistics.median(groups['AB']),
            'AAMaxAbs':max(map(abs,groups['AA'])),
            'ABBlocksOver15Percent':sum(x>.15 for x in groups['AB'])}


def summarize_blocks(blocks, expected_plan):
    if len(expected_plan) < 8 or len(blocks) != len(expected_plan):
        raise ValueError('Incomplete predeclared blocks')
    fingerprint = None
    case_blocks = {case:[] for case in CASES}
    for (kind,i,rows),(expected_kind,expected_i,order) in zip(blocks,expected_plan):
        if (kind,i,''.join(t for t,_ in rows)) != (expected_kind,expected_i,order):
            raise ValueError('Unexpected block identity or arm order')
        for _,row in rows:
            if fingerprint is None:
                fingerprint = row['host']
            if row['host'] != fingerprint or list(row['cases']) != list(CASES):
                raise ValueError('Mixed CPUs, environment, or case sets')
        for case in CASES:
            case_blocks[case].append((kind,[(t,r['cases'][case]) for t,r in rows]))
    return {'formalAcceptance':False, 'host':fingerprint, 'cases':{
        case:score_case(material) for case,material in case_blocks.items()
    }}


def command(args, cwd):
    return subprocess.check_output(args, cwd=cwd, text=True, timeout=12).strip()


def child(args, log, env):
    with log.open('xb') as out:
        p = subprocess.Popen(args, env=env, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            status = p.wait(timeout=120)
        except BaseException:
            try:
                os.killpg(p.pid, signal.SIGTERM)
                p.wait(timeout=3)
            except (TimeoutError, subprocess.TimeoutExpired, ProcessLookupError):
                pass
            finally:
                try: os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                p.wait()
            raise
    if status:
        raise RuntimeError('Driver failed; see ' + str(log))


def main():
    arg = argparse.ArgumentParser(description=__doc__)
    for name in ('archive','baseline','candidate','helpers','playwright','chrome','out'):
        arg.add_argument('--'+name, type=lambda x: Path(x).resolve(), required=True)
    arg.add_argument('--blocks-per-kind', type=int, choices=(4,6,8), default=4)
    arg.add_argument('--seed', type=int, default=1147)
    arg.add_argument('--port', type=int, default=25147)
    arg.add_argument('--prepare-only', action='store_true')
    a = arg.parse_args()
    src = (a.archive / 'performance-current/web/measurement-effective.mjs').read_bytes()
    code = {}
    ids = {}
    for tag, prod in (('A', a.baseline), ('B', a.candidate)):
        ids[tag] = command(['git','rev-parse','HEAD'], prod)
        if command(['git','status','--porcelain','--untracked-files=no'],prod):
            raise ValueError('Tracked files dirty: '+str(prod))
        if tag == 'A' and ids[tag] != BASE_SHA:
            raise ValueError('Baseline must be exact '+BASE_SHA)
        if tag == 'B' and (ids[tag] != CANDIDATE_SHA
                           or command(['git','rev-parse','HEAD^{tree}'],prod) != CANDIDATE_TREE):
            raise ValueError('Candidate commit and tree must match exact #1147')
        code[tag] = adapt(src, prod, a.helpers, a.playwright)
    binding_path = a.archive/'performance-current/web/measurement-binding.json'
    if sha(binding_path.read_bytes()) != BINDING_SHA:
        raise ValueError('Archive binding digest mismatch')
    binding = read(binding_path)
    if (binding['effectiveSha256'] != SOURCE_SHA or binding['productSha'] != ARCHIVED_CANDIDATE_SHA
            or binding['protocolDigest'] != PROTOCOL):
        raise ValueError('Archive driver identity mismatch')
    a.out.mkdir(mode=0o700)
    shared = {'schema':'fsusui.web-frame-1147-diagnostic.v1','formalAcceptance':False,
              'sourceSha256':SOURCE_SHA,'archiveBindingSha256':BINDING_SHA,'productShas':ids,
              'candidateTree':CANDIDATE_TREE,'originalCandidateSha':ARCHIVED_CANDIDATE_SHA,
              'cases':list(CASES),'node':NODE,'pnpm':PNPM,'browser':BROWSER,
              'protocolDigest':binding['protocolDigest'],'seed':a.seed,'plan':plan(a.blocks_per_kind,a.seed)}
    write(a.out/'plan.json',shared)
    bundles = {}
    for tag, adapted in code.items():
        assembled = a.out / (tag + '.mjs')
        assembled.write_text(adapted)
        command(['node','--check',str(assembled)], a.out)
        bundles[tag]={'schema':shared['schema'],'formalAcceptance':False,
                      'diagnosticDriverSha256':sha(adapted.encode()),'productSha':ids[tag]}
    if a.prepare_only:
        print('Prepared exact-source diagnostic and checked module syntax; did not launch.')
        return
    if command(['node','--version'],a.out) != 'v'+NODE or not re.search(r'(?<![\d.])'+re.escape(BROWSER)+r'(?![\d.])',command([str(a.chrome),'--version'], a.out)):
        raise ValueError('Exact Node and Chromium are required; refusing substitution')
    for product in (a.baseline, a.candidate):
        if command(['pnpm','--version'],product) != PNPM:
            raise ValueError('Exact pnpm 10.33.0 is required')
        command(['pnpm','-C','vue/packages/demo-app','exec','vite','--version'],product)
    if not 1024 <= a.port <= 65535:
        raise ValueError('Port must be unprivileged and valid')
    for helper in MODS:
        if sha((a.helpers/helper).read_bytes()) != MOD_SHA[helper]:
            raise ValueError('Wrong helper bytes: '+helper)
    package = read(a.playwright.parent / 'package.json')
    if package['name'] not in ('playwright', '@playwright/test') or package['version'] != '1.59.1':
        raise ValueError('Exact Playwright 1.59.1 is required')
    write(a.out/'toolchain.json', {'browserSha256':sha(a.chrome.read_bytes()),
          'playwrightEntrySha256':sha(a.playwright.read_bytes()),
          'playwrightVersion':package['version'], 'helperSha256':MOD_SHA})
    # Same environment for all arms. Leave original trace categories and sample sequence intact.
    base_env={**os.environ, 'FSUSUI_PERF_BROWSER_EXECUTABLE':str(a.chrome), 'FSUSUI_WEB_FAILURE_DIAGNOSTICS':'0'}
    base_env.pop('NODE_OPTIONS',None)
    results=[]
    for kind,i,order in shared['plan']:
        rows=[]
        for j,t in enumerate(order):
            tag='A' if t=='X' else t
            out=a.out/f'{kind}-{i+1:02d}-{j+1}-{t}'
            out.mkdir()
            env={**base_env,'GITHUB_SHA':ids[tag], 'GIT_COMMIT':ids[tag],
                 'FSUSUI_WEB_PROTOCOL_BINDING':json.dumps(bundles[tag])}
            child(['node',str(a.out/(tag+'.mjs')),'--profile','quick','--warmups','1',
                   '--samples','21','--port',str(a.port),'--output',str(out)], out/'driver.log', env)
            rows.append((t,summarize(out,ids[tag],bundles[tag])))
            write(out/'diagnostic-summary.json',rows[-1][1])
        results.append((kind,i,rows))
        write(a.out/'blocks-completed.json',results)
    write(a.out/'result.json',summarize_blocks(results,shared['plan']))
    print((a.out/'result.json').read_text())


if __name__ == '__main__':
    main()
