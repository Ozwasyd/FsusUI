#!/usr/bin/env python3
"""Diagnostic only. Run archive-verified Markdown cold driver symmetrically."""
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
CANDIDATE_TREE = '2142d45adb06a5954a7d4c9dd66b17e0312636a3'
BROWSER = '147.0.7727.15'
NODE = '22.23.5'
PNPM = '10.33.0'
CASE = 'markdown-cold-24576-60hz-dpr1-enabled'
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
        raise ValueError('Unexpected #1145 driver bytes')
    s = source.decode('utf8')
    s = one(s, 'const root = ' + json.dumps(OLD_ROOT),
            'const root = ' + json.dumps(str(product)))
    for m in MODS:
        s = one(s, f'"file://{OLD_ROOT}/scripts/{m}"', json.dumps((helper / m).as_uri()))
    s = one(s, f'"file://{OLD_ROOT}/node_modules/@playwright/test/index.js"',
            json.dumps(playwright.as_uri()))
    start = s.index('const matrix = scenarioFilter')
    end = s.index('const percentile = ', start)
    s = s[:start] + "const matrix = [['markdown-cold', 24 * 1024, 60, 1, 'enabled']]\n\n" + s[end:]
    s = one(s, '      diagnosticCapture &&', '      false && diagnosticCapture &&')
    cold_observer = """        const coldInitAt = performance.now()
        const coldQuery = new URLSearchParams(location.search)
        if (coldQuery.get('performance') === 'markdown-cold' &&
            coldQuery.get('size') === '24576' &&
            coldQuery.get('motion') === 'enabled') {
          const coldReady = () => {
            const root = document.querySelector('[data-performance-scenario="markdown-cold"][data-performance-ready="true"]')
            if (!root || window.__fsusDiagCold) return
            const probe = window.__FSUSUI_PERFORMANCE_FIXTURE__?.markdownPhaseProbe
            const readyAt = performance.now()
            window.__fsusDiagCold = {
              coldInitAt, readyAt, initToReadyMs: readyAt - coldInitAt,
              readySinceNavigationStartMs: readyAt, query: location.search,
              renderer: root.querySelector('[data-markdown-renderer]')?.getAttribute('data-markdown-renderer') ?? null,
              fixtureError: root.getAttribute('data-performance-error'),
              phases: typeof probe === 'function' ? probe() : null,
            }
            coldObserver.disconnect()
          }
          const coldObserver = new MutationObserver(coldReady)
          coldObserver.observe(document, { subtree: true, childList: true, attributes: true,
            attributeFilter: ['data-performance-ready', 'data-performance-scenario'] })
          coldReady()
        }
"""
    install_at = '        window.__fsusFrameIntervals = []\n        window.__fsusLongTasks = []\n        let previous'
    s = one(s, install_at, cold_observer + install_at)
    nav_at = '    const navigationMs = performance.now() - navigationStarted'
    s = one(s, nav_at, nav_at + '\n    const firstCold = await page.evaluate(() => window.__fsusDiagCold ?? null)\n'
            + '    if (!firstCold) throw new Error("Missing identity-bound first Markdown ready")')
    s = one(s, '      navigationMs,\n      inputToFrame,', '      navigationMs,\n      firstCold,\n      inputToFrame,')

    s = one(s, 'const tick = (now) => {\n          window.__fsusFrameIntervals',
            'const tick = (now) => {\n          window.__fsusDiagLastRaf = now\n'
            '          window.__fsusFrameIntervals')
    s = one(s, '    const inputToFrame = []', '    const phaseAnchors = []\n    const inputToFrame = []')
    s = one(s, '          const started = performance.now()\n          await window.__FSUSUI_PERFORMANCE_FIXTURE__.act',
            '          const previousRaf = window.__fsusDiagLastRaf ?? null\n'
            '          const started = performance.now()\n          await window.__FSUSUI_PERFORMANCE_FIXTURE__.act')
    s = one(s, '            anchor: captureDiagnostic\n',
            '            phaseAnchor: { iteration, previousRaf, started, actionCompleted, frameCompleted, rafTimestamp },\n'
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


def summarize(arm, commit, bundle):
    raw, detail = read(arm / (CASE + '.raw.json')), read(arm / 'summary.json')
    row, = detail['results']
    if (detail['gitSha'] != commit or row['id'] != CASE or raw['id'] != CASE
            or raw['measurementProtocol'] != bundle or detail['measurementProtocol'] != bundle
            or detail['environment']['browser'] != 'Chromium ' + BROWSER
            or detail['environment']['node'] != 'v' + NODE
            or detail['runner'] != dict(warmups=1, samples=21, matrixSize=1)):
        raise ValueError('Arm identity mismatch')
    if raw['idleCadence']['cadence']['status'] != 'consistent-with-request':
        raise ValueError('60Hz idle calibration failed')
    if (raw['size'], raw['refreshHz'], raw['dpr'], raw['motion']) != (24576, 60, 1, 'enabled'):
        raise ValueError('Arm case configuration mismatch')
    cold = raw['firstCold']
    n, init, ready, cold_elapsed, navigation = [v for v in (
        cold['readySinceNavigationStartMs'], cold['coldInitAt'], cold['readyAt'], cold['initToReadyMs'], raw['navigationMs'])]
    good_time = lambda x: type(x) in (int,float) and math.isfinite(x) and x >= 0
    if (any(not good_time(t) for t in (n,init,ready,cold_elapsed,navigation)) or
            not init <= ready or not 0 < cold_elapsed <= navigation or
            abs(ready-init-cold_elapsed) > 1e-7 or n != ready or
            cold['query'] != '?performance=markdown-cold&size=24576&motion=enabled' or cold['renderer'] != 'wasm' or cold['fixtureError'] is not None):
        raise ValueError('Invalid first cold ready identity or clock')
    phases = cold['phases']
    if not isinstance(phases,dict) or any(not good_time(phases.get(key))
            for key in ('parseMs','transferMs','commitMs','activationMs')):
        raise ValueError('Missing cold stage evidence')
    e2e, work, anchors = raw['inputToFrame'], raw['frameWork'], raw['phaseAnchors']
    ep, wp = p95(e2e), p95(work)
    if abs(ep - row['inputToNextFrameMs']['p95']) > 1e-7 or len(anchors) != 21:
        raise ValueError('Raw/summary mismatch')
    waits = []
    for i, (elapsed, acted, timing) in enumerate(zip(e2e, work, anchors), start=1):
        p, s, a, f, r = [timing[k] for k in ('previousRaf','started','actionCompleted','frameCompleted','rafTimestamp')]
        if (timing['iteration'] != i or any(type(x) not in (int,float) or not math.isfinite(x) for x in (p,s,a,f,r))
                or not p <= s <= a <= f or abs((f-s) - elapsed) > 1e-7 or abs((a-s)-acted) > 1e-7):
            raise ValueError('Invalid same-clock phase anchor')
        waits.append(f-a)
    return {'p95':ep,'coldInitToReadyMs':cold_elapsed,'coldNavigationToReadyMs':navigation,
            'coldPhases':phases,'actionP95':wp,'waitP95':p95(waits),'waitOver10':sum(w > 10 for w in waits),
            'domNodes':raw['domNodes'], 'droppedFrameRate':raw['droppedFrameRate'],'environment':detail['environment']}


def plan(n, seed):
    z = random.Random(seed)
    result = [('AB', i, 'ABBA' if i % 2 == 0 else 'BAAB') for i in range(n)]
    result += [('AA', i, 'AXXA' if i % 2 == 0 else 'XAAX') for i in range(n)]
    z.shuffle(result)
    return result


def ratios(blocks, metric):
    groups = {'AB': [], 'AA': []}
    for kind, rows in blocks:
        left = [r[metric] for t,r in rows if t == 'A']
        right = [r[metric] for t,r in rows if t != 'A']
        if len(left) != 2 or len(right) != 2 or min(left+right) <= 0:
            raise ValueError('Incomplete crossover block')
        groups[kind].append(math.sqrt(right[0]*right[1]/(left[0]*left[1])) - 1)
    return {'ratiosMinusOne':groups,'ABMedian':statistics.median(groups['AB']),
            'AAMaxAbs':max(map(abs,groups['AA'])),
            'ABBlocksOver15Percent':sum(x>.15 for x in groups['AB'])}


def score(blocks):
    return {'formalAcceptance':False,
            **{metric:ratios(blocks,metric) for metric in ('coldInitToReadyMs','coldNavigationToReadyMs','p95')}}


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
    arg.add_argument('--blocks-per-kind', type=int, choices=(2,4,6,8), default=6)
    arg.add_argument('--seed', type=int, default=1145)
    arg.add_argument('--port', type=int, default=25145)
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
        if tag == 'B' and command(['git','rev-parse','HEAD^{tree}'],prod) != CANDIDATE_TREE:
            raise ValueError('Candidate tree must match exact #1145')
        code[tag] = adapt(src, prod, a.helpers, a.playwright)
    binding = read(a.archive/'performance-current/web/measurement-binding.json')
    if binding['effectiveSha256'] != SOURCE_SHA:
        raise ValueError('Archive driver identity mismatch')
    a.out.mkdir(mode=0o700)
    shared = {'schema':'fsusui.markdown-cold-diagnostic.v1','formalAcceptance':False,
              'sourceSha256':SOURCE_SHA, 'productShas':ids,
              'candidateTree':CANDIDATE_TREE,'node':NODE,'pnpm':PNPM,'browser':BROWSER,
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
        results.append((kind,rows))
        write(a.out/'blocks-completed.json',results)
    write(a.out/'result.json',score(results))
    print((a.out/'result.json').read_text())


if __name__ == '__main__':
    main()
