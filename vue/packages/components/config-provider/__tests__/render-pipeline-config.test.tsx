import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfigProvider from '../src/config-provider'
import { useGlobalConfig } from '../src/hooks/use-global-config'
import { normalizeRenderPipelineConfig } from '../src/render-pipeline'

describe('render-pipeline-config', () => {
  it('normalizes partial render pipeline config', () => {
    const config = normalizeRenderPipelineConfig({
      mode: 'enabled',
      worker: 'disabled',
      acceleration: {
        mode: 'cpu',
        compositor: 'disabled',
        contentVisibility: 'enabled',
        layerBudget: 24,
      },
      budget: { frameMs: 4 },
      thresholds: { htmlBytes: 64_000 },
    })

    expect(config.mode).toBe('enabled')
    expect(config.worker).toBe('disabled')
    expect(config.acceleration.mode).toBe('cpu')
    expect(config.acceleration.compositor).toBe('disabled')
    expect(config.acceleration.contentVisibility).toBe('enabled')
    expect(config.acceleration.layerBudget).toBe(24)
    expect(config.budget.frameMs).toBe(4)
    expect(config.budget.dynamicFrameMs).toBe(false)
    expect(config.budget.overscanPx).toBe(800)
    expect(config.thresholds.htmlBytes).toBe(64_000)
    expect(config.thresholds.itemCount).toBe(500)
  })

  it('marks omitted frame budgets for runtime refresh calibration', () => {
    const config = normalizeRenderPipelineConfig({
      budget: { overscanPx: 900 },
    })
    expect(config.budget.dynamicFrameMs).toBe(true)
    expect(config.budget.frameMs).toBe(7.5)
  })

  it('provides render pipeline config through ConfigProvider', () => {
    const Probe = defineComponent({
      setup() {
        const renderPipeline = useGlobalConfig('renderPipeline')
        return () => (
          <div data-mode={renderPipeline.value?.mode}>
            {renderPipeline.value?.budget?.overscanPx}
          </div>
        )
      },
    })

    const wrapper = mount(() => (
      <ConfigProvider
        renderPipeline={{
          mode: 'enabled',
          budget: { overscanPx: 1200 },
        }}
      >
        <Probe />
      </ConfigProvider>
    ))

    expect(wrapper.find('[data-mode="enabled"]').exists()).toBe(true)
    expect(wrapper.text()).toBe('1200')
  })
})
