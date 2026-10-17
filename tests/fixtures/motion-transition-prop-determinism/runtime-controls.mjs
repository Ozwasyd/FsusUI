import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { setTimeout, clearTimeout } from 'node:timers'

const [root, beforeFile, afterFile, outputFile] = process.argv.slice(2)
assert.ok(root && beforeFile && afterFile && outputFile)
const requireRoot = createRequire(path.join(path.resolve(root), 'package.json'))
const { JSDOM } = requireRoot('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
})
for (const key of [
  'window',
  'document',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Node',
  'MutationObserver',
]) {
  globalThis[key] = dom.window[key]
}
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = clearTimeout
const vue = requireRoot('vue')
const { mount } = requireRoot('@vue/test-utils')
const load = (file) => {
  const module = { exports: {} }
  const requireFile = createRequire(path.resolve(file))
  new Function('module', 'exports', 'require', fs.readFileSync(file, 'utf8'))(
    module,
    module.exports,
    (id) => (id === 'vue' ? vue : requireFile(id)),
  )
  return module.exports.default
}
const before = load(beforeFile)
const after = load(afterFile)
assert.ok(before && after)
const metadata = [before, after].map((component) => ({
  ownType: Object.hasOwn(component.props.mode, 'type'),
  type: component.props.mode.type,
  required: component.props.mode.required,
}))
const values = [
  undefined,
  null,
  'in-out',
  'out-in',
  'default',
  'invalid-mode',
  42,
  false,
  { invalid: true },
]
const rows = []
for (const value of values) {
  const results = []
  for (const component of [before, after]) {
    const warnings = []
    const wrapper = mount(component, {
      props: { mode: value, disabled: true },
      slots: {
        default: () => vue.h('div', { class: 'motion-probe' }, 'probe'),
      },
      global: { config: { warnHandler: (message) => warnings.push(message) } },
    })
    const instance = wrapper.vm.$
    results.push({
      propsMode: instance.props.mode,
      html: wrapper.html(),
      warnings,
      shouldCast: instance.propsOptions[0].mode[0],
      shouldCastTrue: instance.propsOptions[0].mode[1],
      inNeedCastKeys: instance.propsOptions[1].includes('mode'),
    })
    wrapper.unmount()
  }
  assert.deepEqual(results[1], results[0])
  rows.push({
    input: value ?? null,
    inputUndefined: value === undefined,
    observed: results[1],
    parity: 'PASS',
  })
}
const metadataParity =
  metadata[0].ownType === metadata[1].ownType &&
  metadata[0].type === metadata[1].type &&
  metadata[0].required === metadata[1].required
fs.writeFileSync(
  outputFile,
  `${JSON.stringify(
    {
      environment: `Node ${process.version}/jsdom ${requireRoot('jsdom/package.json').version}/Vue ${requireRoot('vue/package.json').version}; not browser/device evidence`,
      beforeFile,
      afterFile,
      metadata,
      metadataOwnPropertyParity: metadataParity ? 'PASS' : 'FAIL',
      modeValueCastingValidationAndInitialRenderParity: 'PASS',
      rows,
    },
    null,
    2,
  )}\n`,
)
process.stdout.write(
  `PASS ${rows.length} original actual CJS-module prop/render controls; metadata own-property parity ${metadataParity ? 'PASS' : 'FAIL'}\n`,
)
dom.window.close()
assert.deepEqual(
  metadata[1],
  metadata[0],
  'Actual emitted mode metadata must match',
)
