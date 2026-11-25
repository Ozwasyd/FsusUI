import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FsusUI, * as publicExports from '../../packages/element-plus'
import { ElTable } from '../../packages/element-plus'
import {
  compareRuntimeContract,
  describeComponent,
  describeExports,
  describeInstaller,
  describePackage,
} from '../../../scripts/v1-runtime-contract.mjs'

const root = resolve(__dirname, '../../..')
const baseline = JSON.parse(
  readFileSync(resolve(root, 'spec/baselines/vue-v1-runtime.json'), 'utf8'),
)
const packageJson = JSON.parse(
  readFileSync(resolve(root, 'vue/packages/element-plus/package.json'), 'utf8'),
)

describe('frozen V1 runtime compatibility', () => {
  it('preserves component declarations, root exports, plugin registration and package entry contracts', () => {
    const app = createApp({ render: () => null })
    app.use(FsusUI)
    const candidate = {
      components: Object.fromEntries(
        Object.keys(baseline.components).map((name) => [
          name,
          describeComponent(
            (publicExports as Record<string, unknown>)[name],
            name,
          ),
        ]),
      ),
      exports: describeExports(publicExports),
      installer: describeInstaller(app),
      package: describePackage(packageJson),
    }
    expect(compareRuntimeContract(baseline, candidate)).toEqual([])

    // The installer must remain app-local and idempotent.
    FsusUI.install(app)
    expect(describeInstaller(app)).toEqual(candidate.installer)
    const secondApp = createApp({ render: () => null })
    secondApp.use(FsusUI)
    expect(describeInstaller(secondApp)).toEqual(candidate.installer)
  })

  it('keeps all documented Table instance operations callable', async () => {
    const wrapper = mount(ElTable, { props: { data: [] } })
    try {
      await nextTick()
      for (const name of baseline.documentedInstanceMethods.ElTable) {
        expect(
          typeof (wrapper.vm as unknown as Record<string, unknown>)[name],
          name,
        ).toBe('function')
      }
      expect(wrapper.vm.getSelectionRows()).toEqual([])
      wrapper.vm.clearSelection()
      expect(wrapper.vm.getSelectionRows()).toEqual([])
    } finally {
      wrapper.unmount()
    }
  })
})
