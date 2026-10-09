import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// Run from the installed consumer. The DOM provider comes from the original
// repository toolchain; Vue and every component come from the real install.
const requireTools = createRequire(
  process.env.FSUS_ALIAS_REPOSITORY + '/package.json',
)
const { JSDOM } = requireTools('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>')
for (const key of [
  'window',
  'document',
  'navigator',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Event',
  'MouseEvent',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'window' ? dom.window : dom.window[key],
  })
}
const vue = await import('vue')
const esm = await import('@ozwasyd/element-plus')
const cjs = createRequire(import.meta.url)('@ozwasyd/element-plus')
const groups = JSON.parse(
  readFileSync(new URL('./components.json', import.meta.url)),
)
let aliases = 0
for (const exports of [esm, cjs]) {
  for (const names of Object.values(groups)) {
    for (const name of names) {
      const base = exports['El' + name]
      const alias = exports['Fsus' + name]
      assert.equal(alias.name, 'Fsus' + name)
      assert.notEqual(base, alias)
      assert.equal(base['Fsus' + name], alias)
      for (const key of ['setup', 'render', 'props', 'emits']) {
        assert.equal(alias[key], base[key], name + ':' + key)
      }
      const app = vue.createApp({})
      app.use(base)
      assert.equal(app.component('El' + name), base)
      assert.equal(app.component('Fsus' + name), alias)
      aliases++
    }
  }
}
assert.equal(aliases, 72)

function mount(component, props, slots) {
  const target = document.createElement('div')
  document.body.append(target)
  const app = vue.createApp({ render: () => vue.h(component, props, slots) })
  const instance = app.mount(target)
  return {
    target,
    instance,
    close: () => {
      app.unmount()
      target.remove()
    },
  }
}

let selected
const inbox = mount(
  esm.FsusConversationListItem,
  {
    title: 'Thread',
    selected: true,
    onSelect: (event) => {
      selected = event
    },
  },
  { badges: () => vue.h('span', 'Inbox slot') },
)
assert.match(inbox.target.textContent, /Thread.*Inbox slot/s)
inbox.target.querySelector('button').click()
await vue.nextTick()
assert.ok(selected instanceof MouseEvent)
inbox.close()

let copied
let clipboardCalls = 0
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: async (value) => {
      assert.equal(value, 'detail')
      clipboardCalls++
    },
  },
})
const metric = mount(
  esm.FsusCopyableDetail,
  {
    value: 'detail',
    label: 'Copy',
    onCopy: (value) => {
      copied = value
    },
  },
  { button: () => vue.h('span', 'Metric slot') },
)
assert.match(metric.target.textContent, /Metric slot/)
metric.target.querySelector('button').click()
await Promise.resolve()
await vue.nextTick()
assert.equal(copied, 'detail')
metric.close()
const disabled = mount(esm.FsusCopyableDetail, {
  value: 'detail',
  disabled: true,
})
disabled.target.querySelector('button').click()
await vue.nextTick()
assert.equal(clipboardCalls, 1)
assert.equal(disabled.target.querySelector('button').disabled, true)
disabled.close()

let updated
const settings = mount(
  esm.FsusTypedConfirmField,
  {
    phrase: 'CONFIRM',
    'onUpdate:modelValue': (value) => {
      updated = value
    },
  },
  { description: () => vue.h('span', 'Settings slot') },
)
assert.match(settings.target.textContent, /Settings slot/)
const input = settings.target.querySelector('input')
input.value = 'CONFIRM'
input.dispatchEvent(new Event('input', { bubbles: true }))
await vue.nextTick()
assert.equal(updated, 'CONFIRM')
assert.ok(settings.instance.$el instanceof Element)
settings.close()
dom.window.close()
console.log(JSON.stringify({ aliases, mountedControls: 4, passed: true }))
