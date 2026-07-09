import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { CircleClose } from '@element-plus/icons-vue'

import Progress from '../src/progress.vue'

describe('Progress.vue', () => {
  test('percent', () => {
    const wrapper = mount(() => <Progress percentage={66} />)

    expect(wrapper.find('.el-progress__text').text()).toBe('66%')
    expect(wrapper.find('.el-progress-bar__inner').attributes('style')).toBe(
      'width: 66%; animation-duration: var(--fsus-progress-animation-duration, 3s);'
    )
  })

  test('animation duration keeps token fallback when customized', () => {
    const wrapper = mount(() => <Progress percentage={66} duration={5} />)

    expect(
      wrapper.find('.el-progress-bar__inner').attributes('style')
    ).toContain(
      'animation-duration: var(--fsus-progress-animation-duration, 5s);'
    )
  })

  test('status', () => {
    const wrapper = mount(() => <Progress status="exception" />)

    expect(wrapper.classes()).toContain('is-exception')
    expect(wrapper.findComponent(CircleClose).exists()).toBe(true)
  })

  test('text inside', () => {
    const wrapper = mount(() => <Progress textInside />)

    expect(wrapper.classes()).toContain('el-progress--text-inside')
  })

  test('stroke width', () => {
    const wrapper = mount(() => <Progress strokeWidth={7} />)

    expect(wrapper.find('.el-progress-bar__outer').attributes('style')).toBe(
      'height: 7px;'
    )
  })

  test('show text', () => {
    const wrapper = mount(() => <Progress showText={false} />)

    expect(wrapper.find('.el-progress__text').exists()).toBe(false)
  })

  test('circle', () => {
    const wrapper = mount(() => <Progress type="circle" />)

    expect(wrapper.classes()).toContain('el-progress--circle')
  })

  test('dashboard', () => {
    const wrapper = mount(() => <Progress type="dashboard" />)

    expect(wrapper.classes()).toContain('el-progress--dashboard')
  })

  test('width', () => {
    const wrapper = mount(() => <Progress type="circle" width={120} />)

    expect(wrapper.find('.el-progress-circle').attributes('style')).toBe(
      'height: 120px; width: 120px;'
    )
  })

  test('color', () => {
    const wrapper = mount(() => <Progress color="rgb(255, 255, 255)" />)

    expect(
      wrapper.find('.el-progress-bar__inner').attributes('style')
    ).toContain('background-color: rgb(255, 255, 255);')
  })

  test('striped', () => {
    const wrapper = mount(() => <Progress striped />)

    expect(wrapper.find('.el-progress-bar__inner--striped').exists()).toBe(true)
  })

  test('striped flow', () => {
    const wrapper = mount(() => <Progress striped striped-flow />)

    expect(wrapper.find('.el-progress-bar__inner--striped').exists()).toBe(true)
    expect(wrapper.find('.el-progress-bar__inner--striped-flow').exists()).toBe(
      true
    )
  })

  test('color is function', async () => {
    const percentage = ref(0)

    const wrapper = mount(() => (
      <Progress
        percentage={percentage.value}
        color={(percentage: number) => {
          if (percentage > 50) {
            return 'rgb(4, 5, 6)'
          } else {
            return 'rgb(1, 2, 3)'
          }
        }}
      />
    ))

    expect(
      wrapper.find('.el-progress-bar__inner').attributes('style')
    ).toContain('background-color: rgb(1, 2, 3);')

    percentage.value = 60

    await nextTick()

    expect(
      wrapper.find('.el-progress-bar__inner').attributes('style')
    ).toContain('background-color: rgb(4, 5, 6);')
  })

  test('color is array', async () => {
    const percentage = ref(0)
    const wrapper = mount(() => (
      <Progress
        percentage={percentage.value}
        color={[
          { color: 'rgb(1, 1, 1)', percentage: 10 },
          { color: 'rgb(9, 9, 9)', percentage: 90 },
        ]}
      />
    ))

    percentage.value = 9
    await nextTick()

    expect(
      wrapper.find('.el-progress-bar__inner').attributes('style')
    ).toContain('background-color: rgb(1, 1, 1);')

    percentage.value = 89
    await nextTick()

    expect(
      wrapper.find('.el-progress-bar__inner').attributes('style')
    ).toContain('background-color: rgb(9, 9, 9);')
  })

  test('format', () => {
    const wrapper = mount(() => (
      <Progress
        percentage={100}
        format={(percent: number) => `占比${percent}%`}
      />
    ))
    expect(wrapper.find('.el-progress__text').text()).toBe('占比100%')
  })

  test('slot', () => {
    const wrapper = mount(() => (
      <Progress
        v-slots={{
          default: () => '自定义内容',
        }}
      />
    ))

    expect(wrapper.find('.el-progress__text').text()).toBe('自定义内容')
  })

  // STATUS_COLOR_MAP applies to the SVG path stroke (circle/dashboard type).
  // Line-type bar color for status is handled by CSS classes, not inline style.
  test('status=success circle stroke uses CSS variable', () => {
    const wrapper = mount(() => (
      <Progress type="circle" percentage={100} status="success" />
    ))
    expect(
      wrapper.find('.el-progress-circle__path').attributes('stroke')
    ).toBe('var(--el-color-success)')
  })

  test('status=exception circle stroke uses CSS variable', () => {
    const wrapper = mount(() => (
      <Progress type="circle" percentage={0} status="exception" />
    ))
    expect(
      wrapper.find('.el-progress-circle__path').attributes('stroke')
    ).toBe('var(--el-color-danger)')
  })

  test('status=warning circle stroke uses CSS variable', () => {
    const wrapper = mount(() => (
      <Progress type="circle" percentage={50} status="warning" />
    ))
    expect(
      wrapper.find('.el-progress-circle__path').attributes('stroke')
    ).toBe('var(--el-color-warning)')
  })

  test('no status prop circle uses fsus-scholarly-blue CSS variable', () => {
    const wrapper = mount(() => <Progress type="circle" percentage={30} />)
    expect(
      wrapper.find('.el-progress-circle__path').attributes('stroke')
    ).toBe('var(--fsus-scholarly-blue)')
  })
})

describe('Progress.vue svg token regressions', () => {
  test('dashboard keeps rounded stroke joins and fsus default color', () => {
    const wrapper = mount(() => <Progress type="dashboard" percentage={40} />)

    expect(wrapper.find('svg').attributes('stroke-linejoin')).toBe('round')
    expect(
      wrapper.find('.el-progress-circle__path').attributes('stroke')
    ).toBe('var(--fsus-scholarly-blue)')
  })
})
