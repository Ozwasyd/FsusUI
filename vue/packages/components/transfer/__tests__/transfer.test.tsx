import { nextTick, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setTextInputValue } from '../../../test-utils/dom'
import Transfer from '../src/transfer.vue'
import type { TransferDataItem, renderContent } from '../src/transfer'

const {
  createAsciiFilterIndex,
  ensureWasmReady,
  filterIndicesSync,
  isWasmReady,
  setWasmReady,
} = vi.hoisted(() => {
  let wasmReady = true
  let readinessResolvers: Array<() => void> = []
  const wasmReadyResult = { ok: true, value: undefined } as const

  const flushReadiness = () => {
    const resolvers = readinessResolvers
    readinessResolvers = []
    resolvers.forEach((resolve) => resolve())
  }

  return {
    ensureWasmReady: vi.fn(
      () =>
        new Promise<typeof wasmReadyResult>((resolve) => {
          if (wasmReady) {
            resolve(wasmReadyResult)
            return
          }

          readinessResolvers.push(() => resolve(wasmReadyResult))
        }),
    ),
    createAsciiFilterIndex: vi.fn((labels: string[]) => labels),
    filterIndicesSync: vi.fn(
      (data: string[], keyword: string, caseSensitive = false) => {
        if (!wasmReady) {
          throw new Error('WASM is not ready')
        }

        const normalizedKeyword = caseSensitive
          ? keyword
          : keyword.toLowerCase()

        return data.reduce<number[]>((matched, item, index) => {
          const normalizedItem = caseSensitive ? item : item.toLowerCase()
          if (normalizedItem.includes(normalizedKeyword)) {
            matched.push(index)
          }
          return matched
        }, [])
      },
    ),
    isWasmReady: vi.fn(() => wasmReady),
    setWasmReady: (value: boolean) => {
      wasmReady = value
      if (value) {
        flushReadiness()
      }
    },
  }
})

vi.mock('@element-plus/wasm', () => ({
  createAsciiFilterIndex,
  ensureWasmReady,
  filterAsciiIndicesSync: filterIndicesSync,
  isWasmReady,
}))

describe('Transfer', () => {
  afterEach(() => {
    setWasmReady(true)
    vi.clearAllMocks()
  })

  const getTestData = () => {
    const data = []
    for (let i = 1; i <= 15; i++) {
      data.push({
        key: i,
        label: `备选项 ${i}`,
        disabled: i % 4 === 0,
      })
    }
    return data
  }

  it('create', () => {
    const wrapper = mount(() => <Transfer data={getTestData()} />)
    expect(wrapper.findComponent({ name: 'ElTransfer' })).toBeTruthy()
  })

  it('default target list', () => {
    const value = ref([1, 4])
    const wrapper = mount(() => (
      <Transfer v-model={value.value} data={getTestData()} />
    ))
    const ElTransfer: any = wrapper.findComponent({ name: 'ElTransfer' })
    expect(ElTransfer.vm.sourceData.length).toBe(13)
  })

  it('filterable', async () => {
    const value = ref([])
    const method = (query: string, option: TransferDataItem) => {
      return option.key === Number(query)
    }

    const wrapper = mount(() => (
      <Transfer
        v-model={value.value}
        filterable
        data={getTestData()}
        filter-method={method}
      />
    ))
    const leftList: any = wrapper.findComponent({ name: 'ElTransferPanel' })
    leftList.vm.query = '1'
    await setTextInputValue(leftList.find('input'), '1')
    expect(leftList.vm.filteredData.length).toBe(1)
  })

  it('filterable large dataset keeps default matching semantics', async () => {
    const value = ref([])
    const data = Array.from({ length: 1_001 }, (_, index) => ({
      key: index + 1,
      label: index === 917 ? 'Wasm Match' : `option ${index + 1}`,
      disabled: false,
    }))

    const wrapper = mount(() => (
      <Transfer v-model={value.value} filterable data={data} />
    ))

    const leftList: any = wrapper.findComponent({ name: 'ElTransferPanel' })
    leftList.vm.query = 'match'
    await setTextInputValue(leftList.find('input'), 'match')
    await nextTick()

    expect(filterIndicesSync).toHaveBeenCalled()
    expect(leftList.vm.filteredData.length).toBe(1)
    expect(leftList.vm.filteredData[0].label).toBe('Wasm Match')
  }, 30000)

  it('suspends default filtering on cold start and uses wasm after readiness', async () => {
    setWasmReady(false)
    const value = ref([])
    const data = Array.from({ length: 1_001 }, (_, index) => ({
      key: index + 1,
      label: index === 499 ? 'Deferred Match' : `option ${index + 1}`,
      disabled: false,
    }))

    const wrapper = mount(() => (
      <Transfer v-model={value.value} filterable data={data} />
    ))

    const leftList: any = wrapper.findComponent({ name: 'ElTransferPanel' })
    leftList.vm.query = 'match'
    await setTextInputValue(leftList.find('input'), 'match')
    await nextTick()

    expect(ensureWasmReady).toHaveBeenCalled()
    expect(filterIndicesSync).not.toHaveBeenCalled()
    expect(leftList.vm.filteredData.length).toBe(0)

    vi.clearAllMocks()
    setWasmReady(true)
    await nextTick()
    await nextTick()
    expect(filterIndicesSync).toHaveBeenCalled()
    expect(leftList.vm.filteredData.length).toBe(1)
    expect(leftList.vm.filteredData[0].label).toBe('Deferred Match')

    vi.clearAllMocks()
    leftList.vm.query = '500'
    await setTextInputValue(leftList.find('input'), '500')
    await nextTick()

    expect(filterIndicesSync).toHaveBeenCalled()
    expect(ensureWasmReady).not.toHaveBeenCalled()
  }, 30000)

  it('keeps non-ascii queries on the JS path', async () => {
    const value = ref([])
    const data = Array.from({ length: 1_001 }, (_, index) => ({
      key: index + 1,
      label: index === 777 ? 'Éclair' : `option ${index + 1}`,
      disabled: false,
    }))

    const wrapper = mount(() => (
      <Transfer v-model={value.value} filterable data={data} />
    ))

    const leftList: any = wrapper.findComponent({ name: 'ElTransferPanel' })
    leftList.vm.query = 'é'
    await setTextInputValue(leftList.find('input'), 'é')
    await nextTick()

    expect(filterIndicesSync).not.toHaveBeenCalled()
    expect(leftList.vm.filteredData.length).toBe(1)
    expect(leftList.vm.filteredData[0].label).toBe('Éclair')
  }, 30000)

  it('transfer', async () => {
    const value = ref([1, 4])
    const wrapper = mount(() => (
      <Transfer
        v-model={value.value}
        leftDefaultChecked={[2, 3]}
        rightDefaultChecked={[1]}
        data={getTestData()}
      />
    ))

    const ElTransfer: any = wrapper.findComponent({ name: 'ElTransfer' })

    ElTransfer.vm.addToLeft()
    await nextTick()
    expect(ElTransfer.vm.sourceData.length).toBe(14)
    ElTransfer.vm.addToRight()
    await nextTick()
    expect(ElTransfer.vm.sourceData.length).toBe(12)
  })

  it('customize', () => {
    const state = reactive({
      value: [2],
      titles: ['表1', '表2'],
      format: { noChecked: 'no', hasChecked: 'has' },
    })
    const renderFunc: renderContent = (_h, option) => (
      <span>{`${option.key} - ${option.label}`}</span>
    )
    const wrapper = mount(() => (
      <Transfer
        v-model={state.value}
        titles={state.titles as [string, string]}
        format={state.format}
        renderContent={renderFunc}
        data={getTestData()}
      />
    ))

    const label = wrapper.find('.el-transfer-panel__header .el-checkbox__label')
    expect(label.text().includes('表1')).toBeTruthy()
    expect(
      wrapper.find('.el-transfer-panel__list .el-checkbox__label span').text(),
    ).toBe('1 - 备选项 1')
    expect(label.find('span').text()).toBe('no')
  })

  it('check', () => {
    const value = ref([])
    const wrapper = mount(() => (
      <Transfer v-model={value.value} data={getTestData()} />
    ))

    const leftList: any = wrapper.findComponent({ name: 'ElTransferPanel' })
    leftList.vm.handleAllCheckedChange({ target: { checked: true } })
    expect(leftList.vm.checked.length).toBe(12)
  })

  describe('target order', () => {
    it('original(default)', async () => {
      const value = ref([1, 4])
      const wrapper = mount(() => (
        <Transfer
          v-model={value.value}
          leftDefaultChecked={[2, 3]}
          data={getTestData()}
        />
      ))

      const ElTransfer: any = wrapper.findComponent({ name: 'ElTransfer' })
      ElTransfer.vm.addToRight()
      await nextTick()
      const targetItems = wrapper.findAll(
        '.el-transfer__buttons + .el-transfer-panel .el-transfer-panel__body .el-checkbox__label span',
      )
      expect(targetItems.map((item) => item.text())).toStrictEqual([
        '备选项 1',
        '备选项 2',
        '备选项 3',
        '备选项 4',
      ])
    })

    it('push', async () => {
      const value = ref([1, 4])
      const wrapper = mount(() => (
        <Transfer
          v-model={value.value}
          leftDefaultChecked={[2, 3]}
          target-order="push"
          data={getTestData()}
        />
      ))

      const ElTransfer: any = wrapper.findComponent({ name: 'ElTransfer' })
      ElTransfer.vm.addToRight()
      await nextTick()
      const targetItems = wrapper.findAll(
        '.el-transfer__buttons + .el-transfer-panel .el-transfer-panel__body .el-checkbox__label span',
      )
      expect(targetItems.map((item) => item.text())).toStrictEqual([
        '备选项 1',
        '备选项 4',
        '备选项 2',
        '备选项 3',
      ])
    })

    it('unshift', async () => {
      const value = ref([1, 4])
      const wrapper = mount(() => (
        <Transfer
          v-model={value.value}
          leftDefaultChecked={[2, 3]}
          target-order="unshift"
          data={getTestData()}
        />
      ))

      const ElTransfer: any = wrapper.findComponent({ name: 'ElTransfer' })
      ElTransfer.vm.addToRight()
      await nextTick()
      const targetItems = wrapper.findAll(
        '.el-transfer__buttons + .el-transfer-panel .el-transfer-panel__body .el-checkbox__label span',
      )
      expect(targetItems.map((item) => item.text())).toStrictEqual([
        '备选项 2',
        '备选项 3',
        '备选项 1',
        '备选项 4',
      ])
    })
  })

  describe('validate clearQuery', () => {
    it('set query and clear query', async () => {
      const value = ref([])
      const wrapper = mount(() => (
        <Transfer
          v-model={value.value}
          filterable={true}
          data={getTestData()}
        />
      ))

      const ElTransfer: any = wrapper.findComponent({ name: 'ElTransfer' })
      const app = ElTransfer.vm
      app.leftPanel.query = '11'
      app.rightPanel.query = '22'
      await nextTick()
      expect(app.leftPanel.query).toBe('11')
      expect(app.rightPanel.query).toBe('22')

      app.clearQuery('left')
      await nextTick()
      expect(app.leftPanel.query).toBeFalsy()

      app.clearQuery('right')
      await nextTick()
      expect(app.rightPanel.query).toBeFalsy()
    })
  })
})
