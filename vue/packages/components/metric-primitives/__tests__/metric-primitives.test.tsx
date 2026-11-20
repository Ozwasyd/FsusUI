import { createSSRApp, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { renderToString } from 'vue/server-renderer'
import English from '@element-plus/locale/lang/en'
import Chinese from '@element-plus/locale/lang/zh-cn'
import French from '@element-plus/locale/lang/fr'
import { ElConfigProvider } from '../../config-provider'
import { describe, expect, test, vi } from 'vitest'
import {
  ElCopyableDetail,
  ElDiagnosticsItem,
  ElDiagnosticsList,
  ElDistributionBarRow,
  ElDistributionList,
  ElKeyValueGrid,
  ElKeyValueItem,
  ElKpiGroup,
  ElMetricItem,
  ElMetricList,
  ElStatusSummary,
} from '..'

import type { Language } from '@element-plus/locale'

describe('metric primitives', () => {
  test('renders metric lists with stable label, value, secondary, and meta hierarchy', () => {
    const wrapper = mount(() => (
      <ElMetricList>
        <ElMetricItem
          label="Metric Alpha"
          primary="P75 22ms"
          secondary={['Avg 23ms', 'Min 8ms']}
          meta="58 samples"
        />
      </ElMetricList>
    ))

    expect(wrapper.find('.el-metric-list').attributes('role')).toBe('list')
    expect(wrapper.find('.el-metric-item').attributes('role')).toBe('listitem')
    expect(wrapper.find('.el-metric-item__label').text()).toBe('Metric Alpha')
    expect(wrapper.find('.el-metric-item__primary').text()).toBe('P75 22ms')
    expect(wrapper.find('.el-metric-item__secondary').text()).toContain(
      'Avg 23ms',
    )
    expect(wrapper.find('.el-metric-item__meta').text()).toBe('58 samples')
  })

  test('renders distribution rows with visual-only proportional bars', () => {
    const wrapper = mount(() => (
      <ElDistributionList>
        <ElDistributionBarRow
          rank="1"
          label="Segment Alpha"
          value="245"
          ratio={1.4}
        />
      </ElDistributionList>
    ))

    expect(wrapper.find('.el-distribution-list').attributes('role')).toBe(
      'list',
    )
    expect(
      wrapper.find('.el-distribution-bar-row__bar').attributes('aria-hidden'),
    ).toBe('true')
    expect(
      wrapper.find('.el-distribution-bar-row__bar-fill').attributes('style'),
    ).toContain('width: 100%')
  })

  test('renders KPI groups and key value items without domain assumptions', () => {
    const wrapper = mount(() => (
      <ElKpiGroup>
        <ElKeyValueGrid>
          <ElKeyValueItem label="State" value="Ready" tone="success" />
          <ElKeyValueItem label="Optional" monospace />
        </ElKeyValueGrid>
      </ElKpiGroup>
    ))

    expect(wrapper.find('.el-kpi-group').exists()).toBe(true)
    expect(wrapper.find('.el-key-value-grid').exists()).toBe(true)
    expect(wrapper.find('.el-key-value-item--success').exists()).toBe(true)
    expect(wrapper.find('.el-key-value-item.is-monospace').text()).toContain(
      '-',
    )
  })

  test('keeps punctuation opt-in through the existing badge slot', () => {
    const wrapper = mount(() => (
      <ElKeyValueGrid>
        <ElKeyValueItem label="Default" value="No motif" />
        <ElKeyValueItem label="Authority" value="Runtime">
          {{
            badge: () => <span aria-label="Highlighted metric">·</span>,
          }}
        </ElKeyValueItem>
      </ElKeyValueGrid>
    ))

    const items = wrapper.findAll('.el-key-value-item')
    expect(items[0].find('.el-key-value-item__badge').exists()).toBe(false)
    expect(items[1].find('.el-key-value-item__badge').text()).toBe('·')
    expect(
      items[1]
        .find('.el-key-value-item__badge [aria-label="Highlighted metric"]')
        .exists(),
    ).toBe(true)
  })

  test('renders status and diagnostics items with collapsible detail', () => {
    const wrapper = mount(() => (
      <div>
        <ElStatusSummary
          label="Generic status"
          status="Stable"
          updatedAt="2026-06-14 20:30"
          tone="success"
        >
          {{
            detail: () => 'Product-owned detail copy.',
          }}
        </ElStatusSummary>
        <ElDiagnosticsList>
          <ElDiagnosticsItem
            title="diagnostic.event"
            message="Recent event summary."
            meta="warning - 17:48:11 - 3 times"
            detail="diagnostic-node:runCheck:sample-0001"
            tone="warning"
          />
        </ElDiagnosticsList>
      </div>
    ))

    expect(wrapper.find('.el-status-summary--success').exists()).toBe(true)
    expect(wrapper.find('.el-status-summary__detail').text()).toContain(
      'Product-owned',
    )
    expect(wrapper.find('.el-diagnostics-list').attributes('role')).toBe('list')
    expect(wrapper.find('.el-diagnostics-item--warning').exists()).toBe(true)
    expect(wrapper.find('details').attributes('open')).toBe(undefined)
    expect(wrapper.find('summary').text()).toBe('Details')
  })

  test('copyable detail exposes an accessible copy button and emits copy events', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const wrapper = mount(ElCopyableDetail, {
      props: {
        value: 'technical-detail-001',
        label: 'Copy detail',
      },
    })

    expect(wrapper.find('button').attributes('aria-label')).toBe('Copy detail')
    await wrapper.find('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith('technical-detail-001')
    expect(wrapper.emitted('copy')?.[0]).toEqual(['technical-detail-001'])
    expect(wrapper.find('.el-copyable-detail__feedback').text()).toBe('Copied')
  })

  test('uses reactive provider labels for copy actions, feedback, and details', async () => {
    const locale = ref<Language>(Chinese)
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    try {
      const wrapper = mount(() => (
        <ElConfigProvider locale={locale.value}>
          <ElCopyableDetail value="payload" />
          <ElDiagnosticsItem detail="technical detail" />
        </ElConfigProvider>
      ))
      const button = wrapper.get('button')
      const feedback = wrapper.get('[aria-live="polite"]')
      expect(button.text()).toBe('复制详情')
      expect(button.attributes('aria-label')).toBe('复制详情')
      expect(wrapper.get('summary').text()).toBe('详情')

      await button.trigger('click')
      await flushPromises()
      expect(feedback.text()).toBe('已复制')

      await button.trigger('click')
      await flushPromises()
      expect(feedback.text()).toBe('复制失败')

      locale.value = English
      await nextTick()
      expect(button.text()).toBe('Copy detail')
      expect(button.attributes('aria-label')).toBe('Copy detail')
      expect(feedback.text()).toBe('Copy failed')
      expect(wrapper.get('summary').text()).toBe('Details')

      locale.value = French
      await nextTick()
      expect(button.attributes('aria-label')).toBe('Copy detail')
      expect(feedback.text()).toBe('Copy failed')
      expect(wrapper.get('summary').text()).toBe('Details')
    } finally {
      if (clipboard) {
        Object.defineProperty(navigator, 'clipboard', clipboard)
      } else {
        Reflect.deleteProperty(navigator, 'clipboard')
      }
    }
  })

  test('preserves explicit copy labels, including an empty label', async () => {
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    try {
      const wrapper = mount(() => (
        <ElConfigProvider locale={Chinese}>
          <ElCopyableDetail
            value="payload"
            label=""
            copiedLabel="Saved"
            errorLabel="Try again"
          />
          <ElDiagnosticsItem detail="technical detail" detailLabel="Expand" />
        </ElConfigProvider>
      ))
      const button = wrapper.get('button')
      const feedback = wrapper.get('[aria-live="polite"]')
      expect(button.text()).toBe('')
      expect(button.attributes('aria-label')).toBe('')
      expect(wrapper.get('summary').text()).toBe('Expand')
      await button.trigger('click')
      await flushPromises()
      expect(feedback.text()).toBe('Saved')
      await button.trigger('click')
      await flushPromises()
      expect(feedback.text()).toBe('Try again')
    } finally {
      if (clipboard) {
        Object.defineProperty(navigator, 'clipboard', clipboard)
      } else {
        Reflect.deleteProperty(navigator, 'clipboard')
      }
    }
  })

  test('server-renders localized accessible copy and diagnostics labels', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () => (
          <ElConfigProvider locale={Chinese}>
            <ElCopyableDetail value="payload" />
            <ElDiagnosticsItem detail="technical detail" />
          </ElConfigProvider>
        ),
      }),
    )

    expect(html).toContain('aria-label="复制详情"')
    expect(html.replace(/<!--.*?-->/g, '')).toMatch(
      /<summary[^>]*>详情<\/summary>/,
    )
  })

  test('copyable detail preserves native disabled semantics and does not copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const wrapper = mount(ElCopyableDetail, {
      props: {
        value: 'technical-detail-disabled',
        label: 'Copy unavailable detail',
        disabled: true,
      },
    })

    expect(wrapper.classes()).toContain('is-disabled')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    await wrapper.find('button').trigger('click')
    expect(writeText).not.toHaveBeenCalled()
    expect(wrapper.emitted('copy')).toBeUndefined()
    expect(wrapper.emitted('copy-error')).toBeUndefined()
  })
})
