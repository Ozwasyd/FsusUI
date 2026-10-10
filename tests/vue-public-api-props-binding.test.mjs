import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const producerRoot = process.env.FSUSUI_PROPS_PRODUCER_ROOT || repository
const { buildArtifacts } = await import(
  pathToFileURL(
    path.join(producerRoot, 'scripts/avalonia-vue-public-api-baseline.mjs'),
  ).href
)
const fixture = path.join(repository, 'tests/fixtures/vue-public-api-baseline')
const modulePath = 'vue/packages/components/fixture-options-widget'
const propsPath = `${modulePath}/src/fixture-options-widget.ts`
const sfcPath = `${modulePath}/src/fixture-options-widget.vue`
const component = (baseline, name = 'ElFixtureOptionsWidget') =>
  baseline.components.find((item) => item.name === name)
const sfc = (imports, expression, extra = '') => `<template><div /></template>
<script lang="ts">
import { defineComponent } from 'vue'
${imports}
${extra}
export default defineComponent({
  name: 'ElFixtureOptionsWidget',
  props: ${expression},
  emits: ['submit'],
  setup(props, { emit }) { return { props, emit } },
})
</script>`

const withFixture = (files, inspect) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fsus-props-binding-'),
  )
  try {
    fs.cpSync(fixture, directory, { recursive: true })
    for (const [relative, contents] of Object.entries(files)) {
      const file = path.join(directory, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, contents)
    }
    inspect(
      buildArtifacts(directory, { commitShaOverride: 'props-binding-control' })
        .baseline,
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}
const assertProps = (files, expected) =>
  withFixture(files, (baseline) => {
    assert.deepEqual(component(baseline).props, [...expected].sort())
  })
const decoy =
  'export const fixtureOptionsWidgetSiblingProps = { intruder: String }'

test('original macro props, emits, slots, exposed and deprecated controls remain positive', () => {
  withFixture({}, (baseline) => {
    const widget = component(baseline, 'ElFixtureWidget')
    assert.deepEqual(widget.props, ['label', 'legacyMode', 'modelValue'])
    assert.deepEqual(widget.emits, ['[UPDATE_MODEL_EVENT]', 'submit'])
    for (const name of ['default', 'actions', 'item'])
      assert.ok(widget.slots.some((slot) => slot.name === name))
    assert.ok(widget.slots.some((slot) => slot.name === 'item' && slot.scoped))
    assert.deepEqual(widget.exposed, ['focus', 'reset'])
    assert.ok(
      baseline.deprecatedApis.some((entry) =>
        entry.target.includes('legacyMode'),
      ),
    )
    assert.ok(
      baseline.services.some((entry) => entry.name === 'ElFixtureService'),
    )
    assert.ok(
      baseline.directives.some((entry) => entry.name === 'ElFixtureDirective'),
    )
  })
})

test('original TSX imported props, emit, exposed and scoped-slot controls remain positive', () => {
  withFixture({}, (baseline) => {
    const widget = component(baseline, 'ElFixtureTsxWidget')
    assert.deepEqual(
      widget.semantic.props.map((item) => item.name),
      ['count', 'label'],
    )
    assert.ok(widget.semantic.emits.some((item) => item.name === 'submit'))
    assert.ok(widget.semantic.exposed.some((item) => item.name === 'focus'))
    assert.ok(
      widget.semantic.slots.some(
        (item) => item.name === 'default' && item.scoped,
      ),
    )
  })
})

test('original Options label positive and setup-context emit negative remain intact', () => {
  withFixture({}, (baseline) => {
    const widget = component(baseline)
    assert.deepEqual(widget.props, ['label'])
    assert.ok(!widget.props.includes('emit'))
    assert.ok(!widget.emits.includes('emit'))
    assert.deepEqual(widget.semantic.props, [])
  })
})

test('parent and item each own their selected binding in a shared module', () => {
  const index = fs.readFileSync(
    path.join(fixture, modulePath, 'index.ts'),
    'utf8',
  )
  withFixture(
    {
      [propsPath]: `export const fixtureOptionsWidgetProps = { disabled: Boolean, viewportBounded: Boolean }
export const fixtureOptionsWidgetItemProps = { checked: Boolean, disabled: Boolean, multiline: Boolean }`,
      [`${modulePath}/index.ts`]: `${index}\nimport Child from './src/fixture-options-child.vue'\nexport const ElFixtureOptionsChild = withInstall(Child)\n`,
      [`${modulePath}/src/fixture-options-child.vue`]: `<template><div /></template><script lang="ts">
import { defineComponent } from 'vue'
import { fixtureOptionsWidgetItemProps } from './fixture-options-widget'
export default defineComponent({ name: 'ElFixtureOptionsChild', props: fixtureOptionsWidgetItemProps })
</script>`,
    },
    (baseline) => {
      assert.deepEqual(component(baseline).props, [
        'disabled',
        'viewportBounded',
      ])
      assert.deepEqual(component(baseline, 'ElFixtureOptionsChild').props, [
        'checked',
        'disabled',
        'multiline',
      ])
    },
  )
})

test('local alias selects its own object rather than a sibling export', () => {
  assertProps(
    {
      [sfcPath]: sfc(
        '',
        'selected',
        'const owned = { local: String }; const selected = owned',
      ),
      [propsPath]: decoy,
    },
    ['local'],
  )
})

test('named import alias follows the declared imported export', () => {
  assertProps(
    {
      [sfcPath]: sfc(
        "import { owned as selected } from './fixture-options-widget'",
        'selected',
      ),
      [propsPath]: `export const owned = { imported: String }; ${decoy}`,
    },
    ['imported'],
  )
})

test('default import follows the actual default export', () => {
  assertProps(
    {
      [sfcPath]: sfc(
        "import selected from './fixture-options-widget'",
        'selected',
      ),
      [propsPath]: `const owned = { defaultOwned: String }; export default owned; ${decoy}`,
    },
    ['defaultOwned'],
  )
})

test('owned spread and aliased buildProps preserve motion without pseudo prop names', () => {
  assertProps(
    {
      [propsPath]: `import { buildProps as makeProps } from '@element-plus/utils'
const motionProps = { motion: [String, Boolean] } as const
export const fixtureOptionsWidgetProps = makeProps({ ...motionProps, owned: String } as const)
${decoy}`,
    },
    ['motion', 'owned'],
  )
})

test('named re-export preserves exact ownership through its declared source', () => {
  assertProps(
    {
      [propsPath]: `export { owned as fixtureOptionsWidgetProps } from './owner'; ${decoy}`,
      [`${modulePath}/src/owner.ts`]:
        'export const owned = { reexported: String }',
    },
    ['reexported'],
  )
})

test('namespace member selects only its named exported object', () => {
  assertProps(
    {
      [sfcPath]: sfc(
        "import * as owner from './fixture-options-widget'",
        'owner.selected',
      ),
      [propsPath]: `export const selected = { namespaced: String }; ${decoy}`,
    },
    ['namespaced'],
  )
})

test('barrel-owned spread follows a single star export', () => {
  assertProps(
    {
      [propsPath]: `import { shared } from './barrel'; export const fixtureOptionsWidgetProps = { ...shared, own: String }; ${decoy}`,
      [`${modulePath}/src/barrel.ts`]: "export * from './owner'",
      [`${modulePath}/src/owner.ts`]:
        'export const shared = { inherited: Boolean }',
    },
    ['inherited', 'own'],
  )
})

test('ambiguous star-export owners stay unresolved', () => {
  assertProps(
    {
      [propsPath]: `import { shared } from './barrel'; export const fixtureOptionsWidgetProps = shared; ${decoy}`,
      [`${modulePath}/src/barrel.ts`]:
        "export * from './owner'; export * from './foreign'",
      [`${modulePath}/src/owner.ts`]:
        'export const shared = { first: Boolean }',
      [`${modulePath}/src/foreign.ts`]:
        'export const shared = { second: Boolean }',
    },
    [],
  )
})

test('an unresolved competing star export cannot confer selected ownership', () => {
  for (const expression of ['unknown', 'shared']) {
    assertProps(
      {
        [propsPath]: `import { shared } from './barrel'; export const fixtureOptionsWidgetProps = shared; ${decoy}`,
        [`${modulePath}/src/barrel.ts`]:
          "export * from './owner'; export * from './foreign'",
        [`${modulePath}/src/owner.ts`]:
          'export const shared = { intruder: Boolean }',
        [`${modulePath}/src/foreign.ts`]: `export const shared = ${expression}`,
      },
      [],
    )
  }
})

test('installed component props spread follows the actual exported component', () => {
  assertProps(
    {
      [propsPath]: `import Other from './installed'; export const fixtureOptionsWidgetProps = { ...Other.props, own: String }; ${decoy}`,
      [`${modulePath}/src/installed.ts`]: `import { withInstall } from '@element-plus/utils'; import Other from './other'; export default withInstall(Other)`,
      [`${modulePath}/src/other.ts`]: `import { defineComponent } from 'vue'; const owned = { inherited: Boolean }; export default defineComponent({ props: owned })`,
    },
    ['inherited', 'own'],
  )
})

test('missing public component import cannot borrow the legacy fallback SFC', () => {
  assertProps(
    {
      [`${modulePath}/index.ts`]: `import { withInstall } from '@element-plus/utils'; import Missing from './missing'; export const ElFixtureOptionsWidget = withInstall(Missing)`,
      [propsPath]:
        'export const fixtureOptionsWidgetProps = { intruder: String }',
    },
    [],
  )
})

test('foreign install wrapper cannot claim the public component owner', () => {
  assertProps(
    {
      [`${modulePath}/index.ts`]: `import { withInstall } from './src/foreign'; import Widget from './src/fixture-options-widget.vue'; export const ElFixtureOptionsWidget = withInstall(Widget)`,
      [`${modulePath}/src/foreign.ts`]:
        'export const withInstall = () => ({ props: { intruder: String } })',
    },
    [],
  )
})

test('declared prop array retains only its literal names', () => {
  assertProps({ [sfcPath]: sfc('', "['arrayProp']"), [propsPath]: decoy }, [
    'arrayProp',
  ])
})

for (const empty of ['{}', '[]']) {
  test(`resolved-empty ${empty} cannot borrow sibling props`, () => {
    assertProps({ [sfcPath]: sfc('', empty), [propsPath]: decoy }, [])
  })
}

test('absent root props cannot borrow nested helper or sibling props', () => {
  assertProps(
    {
      [sfcPath]: `<script lang="ts">
import { defineComponent } from 'vue'
const helper = { props: { intruder: String } }
export default defineComponent({ name: 'ElFixtureOptionsWidget', setup() { return helper } })
</script>`,
      [propsPath]: decoy,
    },
    [],
  )
})

test('unknown selected identifier cannot borrow a sibling', () => {
  assertProps({ [sfcPath]: sfc('', 'unknown'), [propsPath]: decoy }, [])
})

test('missing selected import cannot borrow a same-name export in another file', () => {
  assertProps(
    {
      [sfcPath]: sfc(
        "import { fixtureOptionsWidgetProps } from './missing-owner'",
        'fixtureOptionsWidgetProps',
      ),
      [propsPath]:
        'export const fixtureOptionsWidgetProps = { intruder: String }',
    },
    [],
  )
})

test('private declaration is not evidence for a missing named export', () => {
  assertProps(
    {
      [propsPath]: `const fixtureOptionsWidgetProps = { intruder: String }; ${decoy}`,
    },
    [],
  )
})

test('local alias cycle stays unresolved instead of borrowing a sibling', () => {
  assertProps(
    {
      [propsPath]: `const first = second; const second = first; export const fixtureOptionsWidgetProps = first; ${decoy}`,
    },
    [],
  )
})

test('cross-module export cycle stays unresolved instead of borrowing a sibling', () => {
  assertProps(
    {
      [propsPath]: `export { fixtureOptionsWidgetProps } from './owner'; ${decoy}`,
      [`${modulePath}/src/owner.ts`]:
        "export { fixtureOptionsWidgetProps } from './fixture-options-widget'",
    },
    [],
  )
})

test('spread cycle cannot invent a literal spread prop', () => {
  assertProps(
    {
      [propsPath]: `const first = { ...second }; const second = { ...first }; export const fixtureOptionsWidgetProps = first; ${decoy}`,
    },
    [],
  )
})

test('unknown spread stays unresolved rather than fabricating complete ownership', () => {
  assertProps(
    {
      [propsPath]: `export const fixtureOptionsWidgetProps = { owned: String, ...unknown }; ${decoy}`,
    },
    [],
  )
})

test('foreign buildProps function cannot supply selected props', () => {
  assertProps(
    {
      [propsPath]: `import { buildProps } from './foreign'; export const fixtureOptionsWidgetProps = buildProps({ intruder: String }); ${decoy}`,
      [`${modulePath}/src/foreign.ts`]:
        'export const buildProps = () => ({ differentOwner: String })',
    },
    [],
  )
})

test('nested helper props are excluded from a resolved root options object', () => {
  assertProps(
    {
      [sfcPath]: sfc(
        '',
        '{ owned: String }',
        'const helper = { props: { intruder: String } }',
      ),
      [propsPath]: decoy,
    },
    ['owned'],
  )
})

test('props resolution does not suppress the retained legacy emit fallback', () => {
  withFixture(
    {
      [propsPath]: `export const fixtureOptionsWidgetProps = { label: String }
export const fixtureOptionsWidgetEmits = { legacySignal: () => true }`,
    },
    (baseline) => {
      const widget = component(baseline)
      assert.deepEqual(widget.props, ['label'])
      assert.deepEqual(widget.emits, ['legacySignal'])
      assert.deepEqual(
        widget.semantic.emits.map((item) => item.name),
        ['submit'],
      )
    },
  )
})

test('live Dropdown keeps root, item and menu inventories distinct', () => {
  const { baseline } = buildArtifacts(repository, {
    commitShaOverride: 'props-binding-control',
  })
  assert.deepEqual(component(baseline, 'ElDropdown').props, [
    'buttonProps',
    'disabled',
    'effect',
    'hideOnClick',
    'hideTimeout',
    'id',
    'loop',
    'maxHeight',
    'motion',
    'placement',
    'popperClass',
    'popperOptions',
    'role',
    'showTimeout',
    'size',
    'splitButton',
    'tabindex',
    'teleported',
    'trigger',
    'type',
    'viewportBounded',
  ])
  assert.deepEqual(component(baseline, 'ElDropdownItem').props, [
    'checked',
    'command',
    'disabled',
    'divided',
    'icon',
    'multiline',
    'textValue',
  ])
  assert.deepEqual(component(baseline, 'ElDropdownMenu').props, ['onKeydown'])
  assert.deepEqual(component(baseline, 'ElDropdown').semantic.props, [])
})
