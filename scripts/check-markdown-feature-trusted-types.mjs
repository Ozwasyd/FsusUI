import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { build } from 'vite'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, '.tmp/markdown-feature-trusted-types')
const gatewaySource = resolve(
  root,
  'vue/packages/wasm/markdown-feature-output-gateway.ts',
)
const gatewayFile = resolve(outputRoot, 'gateway.js')
const policyName = 'fsusui-markdown-feature'
const nonce = 'markdown-feature-tt'
const corpus = JSON.parse(
  await readFile(
    resolve(root, 'spec/security/markdown-xss-corpus.json'),
    'utf8',
  ),
)
const hostileCases = corpus.cases
  .filter((entry) => entry.featureOutput)
  .map((entry) => ({
    id: entry.id,
    options:
      entry.featureOutput.kind === 'code-highlight'
        ? { mode: 'replace-element' }
        : { nonce },
    output: entry.featureOutput,
  }))
const validCases = [
  {
    id: 'valid-mermaid',
    options: { nonce },
    output: {
      kind: 'mermaid',
      payload: `<svg id="fsus-markdown-mermaid-tt" class="flowchart" xmlns="http://www.w3.org/2000/svg"><defs><marker id="fsus-markdown-mermaid-tt_marker"></marker></defs><style>#fsus-markdown-mermaid-tt{fill:#409eff}</style><path marker-end="url(#fsus-markdown-mermaid-tt_marker)"></path><text>Mermaid Trusted Types</text></svg>`,
      rootId: 'fsus-markdown-mermaid-tt',
    },
  },
  {
    id: 'valid-latex',
    options: {},
    output: {
      kind: 'latex',
      payload:
        '<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math></span>',
    },
  },
  {
    id: 'valid-shiki',
    options: { mode: 'replace-element' },
    output: {
      kind: 'code-highlight',
      payload:
        '<pre class="shiki github-light" style="background-color:#fff;color:#24292e" tabindex="0"><code><span class="line"><span style="color:#D73A49">const</span></span></code></pre>',
    },
  },
]
const featureCases = [...validCases, ...hostileCases]

await rm(outputRoot, { force: true, recursive: true })
await mkdir(outputRoot, { recursive: true })
await build({
  build: {
    emptyOutDir: true,
    lib: {
      entry: gatewaySource,
      fileName: () => 'gateway.js',
      formats: ['es'],
    },
    minify: false,
    outDir: outputRoot,
    target: 'es2022',
  },
  configFile: false,
  logLevel: 'warn',
})
const gatewayBytes = await readFile(gatewayFile)
const gatewaySha256 = createHash('sha256').update(gatewayBytes).digest('hex')

const instrumentSource = `
globalThis.__FSUSUI_TT_POLICY_CALLS__ = [];
globalThis.__FSUSUI_TT_CSP_VIOLATIONS__ = [];
document.addEventListener('securitypolicyviolation', (event) => {
  globalThis.__FSUSUI_TT_CSP_VIOLATIONS__.push({
    blockedURI: event.blockedURI,
    effectiveDirective: event.effectiveDirective,
    violatedDirective: event.violatedDirective,
  });
});
const factory = globalThis.trustedTypes;
if (factory) {
  const originalCreatePolicy = factory.createPolicy.bind(factory);
  Object.defineProperty(factory, 'createPolicy', {
    configurable: true,
    value(name, rules) {
      globalThis.__FSUSUI_TT_POLICY_CALLS__.push({
        callbacks: Object.keys(rules ?? {}).sort(),
        name,
      });
      return originalCreatePolicy(name, rules);
    },
  });
}
`
const probeSource = String.raw`
import { commitMarkdownFeatureOutput } from '/gateway.js';
const cases = ${JSON.stringify(featureCases)};
const mode = location.pathname.slice(1);

const trackPolicyCreation = (factory, calls) => {
  if (!factory) return;
  const originalCreatePolicy = factory.createPolicy.bind(factory);
  Object.defineProperty(factory, 'createPolicy', {
    configurable: true,
    value(name, rules) {
      calls.push({ callbacks: Object.keys(rules ?? {}).sort(), name });
      return originalCreatePolicy(name, rules);
    },
  });
};

const project = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return { kind: 'text', value: node.textContent ?? '' };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  return {
    attributes: node.getAttributeNames()
      .map((name) => [name, node.getAttribute(name) ?? ''])
      .sort(([left], [right]) => left.localeCompare(right)),
    children: Array.from(node.childNodes).map(project).filter(Boolean),
    kind: 'element',
    namespace: node.namespaceURI ?? '',
    tag: node.localName,
  };
};

const audit = (root) => {
  const violations = [];
  const allowedNamespaces = new Set([
    'http://www.w3.org/1998/Math/MathML',
    'http://www.w3.org/1999/xhtml',
    'http://www.w3.org/2000/svg',
  ]);
  for (const element of [root, ...root.querySelectorAll('*')]) {
    const tag = element.localName.toLowerCase();
    if (['base', 'embed', 'form', 'foreignobject', 'iframe', 'img', 'object', 'script'].includes(tag)) {
      violations.push('forbidden-element:' + tag);
    }
    if (!allowedNamespaces.has(element.namespaceURI ?? '')) {
      violations.push('unknown-namespace:' + (element.namespaceURI ?? 'null'));
    }
    for (const attribute of element.getAttributeNames()) {
      const lower = attribute.toLowerCase();
      const value = element.getAttribute(attribute) ?? '';
      if (lower.startsWith('on')) violations.push('event-attribute:' + lower);
      if (lower === 'srcdoc') violations.push('forbidden-attribute:srcdoc');
      if (/^(?:href|src|xlink:href)$/u.test(lower) && /^(?:https?:|data:|javascript:|\/\/)/iu.test(value.trim())) {
        violations.push('unsafe-url:' + lower);
      }
      if (lower === 'style' && /(?:@import|url\s*\()/iu.test(value)) {
        violations.push('unsafe-style');
      }
    }
    if (tag === 'style' && /(?:@import|url\s*\()/iu.test(element.textContent ?? '')) {
      violations.push('unsafe-style-element');
    }
  }
  return [...new Set(violations)].sort();
};

const runCase = (entry) => {
  const target = document.createElement(entry.output.kind === 'code-highlight' ? 'pre' : 'div');
  target.dataset.sentinel = entry.id;
  target.append(document.createTextNode('unchanged-before-commit'));
  const host = document.createElement('section');
  host.append(target);
  document.body.append(host);
  const before = project(host);
  try {
    const committed = commitMarkdownFeatureOutput(target, entry.output, entry.options);
    return {
      audit: audit(committed),
      id: entry.id,
      projection: project(host),
      status: 'committed',
      checks: {
        localMarker: committed.querySelector('path')?.getAttribute('marker-end') ?? null,
        mathNamespace: committed.querySelector('math')?.namespaceURI ?? null,
        styleNonce: committed.querySelector('style')?.nonce ?? null,
      },
    };
  } catch (error) {
    return {
      after: project(host),
      before,
      errorName: error?.name ?? null,
      id: entry.id,
      message: String(error?.message ?? error),
      status: 'failed',
    };
  } finally {
    host.remove();
  }
};

const frame = mode === 'allowed'
  ? await new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.addEventListener('load', () => resolve(iframe), { once: true });
      iframe.src = '/frame/allowed';
      document.body.append(iframe);
    })
  : null;
let frameResult = null;
if (frame) {
  const policyCalls = [];
  trackPolicyCreation(frame.contentWindow.trustedTypes, policyCalls);
  const target = frame.contentDocument.createElement('div');
  frame.contentDocument.body.append(target);
  try {
    const committed = commitMarkdownFeatureOutput(target, cases[0].output, cases[0].options);
    frameResult = {
      policyCalls,
      projection: project(committed),
      status: 'committed',
    };
  } catch (error) {
    frameResult = {
      message: String(error?.message ?? error),
      policyCalls,
      status: 'failed',
    };
  }
}

globalThis.__FSUSUI_TT_PROBE__ = {
  frame: frameResult,
  policyCalls: globalThis.__FSUSUI_TT_POLICY_CALLS__,
  results: cases.map(runCase),
};
`

const csp = {
  allowed: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-src 'self'; require-trusted-types-for 'script'; trusted-types ${policyName}`,
  denied:
    "default-src 'self'; script-src 'self'; style-src 'none'; object-src 'none'; base-uri 'none'; require-trusted-types-for 'script'; trusted-types vue fsusblog",
  off: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'`,
}
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (url.pathname.startsWith('/frame/')) {
    const mode = url.pathname.slice('/frame/'.length)
    if (!(mode in csp)) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'content-security-policy': csp[mode],
      'content-type': 'text/html; charset=utf-8',
    })
    response.end('<!doctype html><html><body></body></html>')
    return
  }
  if (url.pathname === '/gateway.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
    })
    response.end(gatewayBytes)
    return
  }
  if (url.pathname === '/instrument.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
    })
    response.end(instrumentSource)
    return
  }
  if (url.pathname === '/probe.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
    })
    response.end(probeSource)
    return
  }
  const mode = url.pathname.slice(1)
  if (!(mode in csp)) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, {
    'content-security-policy': csp[mode],
    'content-type': 'text/html; charset=utf-8',
  })
  response.end(
    '<!doctype html><html><body><script src="/instrument.js"></script><script type="module" src="/probe.js"></script></body></html>',
  )
})

await new Promise((resolvePromise, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolvePromise)
})

const address = server.address()
if (!address || typeof address === 'string') {
  throw new Error('markdown_feature_tt_server_address_unavailable')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const chromiumExecutablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  chromium.executablePath(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate))
if (!chromiumExecutablePath) {
  throw new Error('markdown_feature_tt_chromium_executable_unavailable')
}
const browser = await chromium.launch({
  executablePath: chromiumExecutablePath,
})
const runMode = async (mode) => {
  const page = await browser.newPage()
  const diagnostics = []
  const externalRequests = []
  page.on('console', (message) => diagnostics.push(`console:${message.text()}`))
  page.on('pageerror', (error) =>
    diagnostics.push(`pageerror:${error.message}`),
  )
  page.on('request', (request) => {
    if (!request.url().startsWith(baseUrl)) externalRequests.push(request.url())
  })
  try {
    await page.goto(`${baseUrl}/${mode}`, { waitUntil: 'networkidle' })
    try {
      await page.waitForFunction(
        () => globalThis.__FSUSUI_TT_PROBE__ !== undefined,
        undefined,
        { timeout: 10_000 },
      )
    } catch (cause) {
      throw new Error(
        `markdown_feature_tt_probe_timeout:${mode}:${diagnostics.join('|')}`,
        { cause },
      )
    }
    const evaluated = await page.evaluate(() => ({
      cspViolations: globalThis.__FSUSUI_TT_CSP_VIOLATIONS__,
      probe: globalThis.__FSUSUI_TT_PROBE__,
    }))
    return { ...evaluated, externalRequests }
  } finally {
    await page.close()
  }
}

try {
  const [allowed, denied, off] = await Promise.all([
    runMode('allowed'),
    runMode('denied'),
    runMode('off'),
  ])
  const allowedCalls = allowed.probe.policyCalls
  const offCalls = off.probe.policyCalls
  if (
    JSON.stringify(allowedCalls) !==
      JSON.stringify([{ callbacks: ['createHTML'], name: policyName }]) ||
    JSON.stringify(offCalls) !==
      JSON.stringify([{ callbacks: ['createHTML'], name: policyName }])
  ) {
    throw new Error(
      `markdown_feature_tt_policy_calls_invalid:${JSON.stringify({ allowedCalls, offCalls })}`,
    )
  }
  if (
    allowed.probe.frame?.status !== 'committed' ||
    JSON.stringify(allowed.probe.frame?.policyCalls) !==
      JSON.stringify([{ callbacks: ['createHTML'], name: policyName }])
  ) {
    throw new Error('markdown_feature_tt_iframe_realm_contract_failed')
  }
  if (
    allowed.probe.results.some(
      (entry) => entry.status !== 'committed' || entry.audit.length,
    ) ||
    off.probe.results.some(
      (entry) => entry.status !== 'committed' || entry.audit.length,
    )
  ) {
    throw new Error('markdown_feature_tt_commit_or_audit_failed')
  }
  if (
    JSON.stringify(allowed.probe.results) !== JSON.stringify(off.probe.results)
  ) {
    throw new Error('markdown_feature_tt_on_off_projection_mismatch')
  }
  const allowedById = Object.fromEntries(
    allowed.probe.results.map((entry) => [entry.id, entry]),
  )
  if (
    allowedById['valid-mermaid'].checks.styleNonce !== nonce ||
    allowedById['valid-mermaid'].checks.localMarker !==
      'url(#fsus-markdown-mermaid-tt_marker)' ||
    allowedById['valid-latex'].checks.mathNamespace !==
      'http://www.w3.org/1998/Math/MathML'
  ) {
    throw new Error(
      `markdown_feature_tt_valid_contract_mismatch:${JSON.stringify({
        latex: allowedById['valid-latex'].checks,
        mermaid: allowedById['valid-mermaid'].checks,
      })}`,
    )
  }
  if (
    denied.probe.results.some(
      (entry) =>
        entry.status !== 'failed' ||
        entry.message !== 'markdown_feature_trusted_types_policy_unavailable' ||
        JSON.stringify(entry.before) !== JSON.stringify(entry.after),
    ) ||
    denied.probe.policyCalls.some((entry) => entry.name !== policyName) ||
    denied.cspViolations.length === 0 ||
    allowed.cspViolations.length !== 0 ||
    off.cspViolations.length !== 0
  ) {
    throw new Error('markdown_feature_tt_denied_policy_not_fail_closed')
  }
  if (
    [
      ...allowed.probe.policyCalls,
      ...denied.probe.policyCalls,
      ...off.probe.policyCalls,
    ].some((entry) => ['default', 'fsusblog', 'vue'].includes(entry.name))
  ) {
    throw new Error('markdown_feature_tt_forbidden_policy_created')
  }
  if (
    allowed.externalRequests.length ||
    denied.externalRequests.length ||
    off.externalRequests.length
  ) {
    throw new Error('markdown_feature_tt_external_request_observed')
  }
  console.log(
    JSON.stringify(
      {
        browser: await browser.version(),
        cases: featureCases.length,
        deniedCspViolations: denied.cspViolations.length,
        gatewaySha256,
        hostileCases: hostileCases.length,
        policyName,
        status: 'passed',
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
  await new Promise((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()))
  })
}
