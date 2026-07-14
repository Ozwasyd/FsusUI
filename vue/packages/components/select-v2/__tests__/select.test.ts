import { computed, defineComponent, nextTick, provide } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasClass } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import { makeMountFunc } from '@element-plus/test-utils/make-mount'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import { rAF } from '@element-plus/test-utils/tick'
import {
  clickClearButton as clickSharedClearButton,
  clickOptionItem,
  clickTagCloseButton,
} from '../../../test-utils/dom'
import { CircleClose } from '@element-plus/icons-vue'
import { usePopperContainerId } from '@element-plus/hooks'
import Select from '../src/select.vue'

const NOOP: (...args: any[]) => void = () => {}

const { buildFilterIndex, disposeFilterPipeline, filterWithPipeline } =
  vi.hoisted(() => {
    let labels: string[] = []
    let version = 0
    return {
      buildFilterIndex: vi.fn(
        async (
          _datasetId: string,
          nextVersion: number,
          nextLabels: string[],
        ) => {
          labels = nextLabels
          version = nextVersion
          return { ok: true, value: { kind: 'built', version } }
        },
      ),
      disposeFilterPipeline: vi.fn(),
      filterWithPipeline: vi.fn(
        async (
          _datasetId: string,
          requestedVersion: number,
          query: string,
        ) => ({
          ok: true,
          value: {
            indices: Uint32Array.from(
              labels.flatMap((label, index) =>
                label.toLowerCase().includes(query.toLowerCase())
                  ? [index]
                  : [],
              ),
            ),
            kind: 'indices',
            version: requestedVersion,
          },
        }),
      ),
    }
  })

vi.mock('@element-plus/components/_internal/data-pipeline-client', () => ({
  canUseDataPipelineWorker: () => true,
  createFsusDataPipelineClient: () => ({
    buildFilterIndex,
    dispose: disposeFilterPipeline,
    filter: filterWithPipeline,
    release: vi.fn(),
  }),
}))

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

type SelectValue =
  | string
  | string[]
  | number
  | number[]
  | Record<string, any>
  | Array<Record<string, any>>
  | null
  | undefined

vi.mock('lodash-unified', async () => {
  return {
    ...((await vi.importActual('lodash-unified')) as Record<string, any>),
    debounce: vi.fn((fn) => {
      fn.cancel = vi.fn()
      fn.flush = vi.fn()
      return fn
    }),
  }
})

vi.mock('@element-plus/wasm', () => ({
  createAsciiFilterIndex,
  ensureWasmReady,
  filterAsciiIndicesSync: filterIndicesSync,
  isWasmReady,
}))

const _mount = makeMountFunc({
  components: {
    'el-select': Select,
  },
})

const RenderPipelineProvider = defineComponent({
  setup(_, { slots }) {
    provide(
      configProviderContextKey,
      computed(
        () =>
          ({
            renderPipeline: {
              mode: 'enabled',
              budget: { overscanPx: 280 },
            },
          }) as any,
      ),
    )
    return () => slots.default?.()
  },
})

const _mountWithPipeline = makeMountFunc({
  components: {
    'el-select': Select,
    RenderPipelineProvider,
  },
})

const createData = (count = 1000) => {
  const initials = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
  return Array.from({ length: count }).map((_, idx) => ({
    value: `option_${idx + 1}`,
    label: `${initials[idx % 10]}${idx}`,
  }))
}

const clickClearButton = async (wrapper) => {
  const select = wrapper.findComponent(Select)
  const selectVm = select.vm as any
  selectVm.states.comboBoxHovering = true
  await nextTick()
  const clearBtn = wrapper.findComponent(CircleClose)
  expect(clearBtn.exists()).toBeTruthy()
  await clickSharedClearButton(clearBtn)
}

interface SelectProps {
  popperClass?: string
  value?: SelectValue
  options?: any[]
  disabled?: boolean
  clearable?: boolean
  multiple?: boolean
  collapseTags?: boolean
  collapseTagsTooltip?: boolean
  maxCollapseTags?: number
  filterable?: boolean
  remote?: boolean
  multipleLimit?: number
  allowCreate?: boolean
  popperAppendToBody?: boolean
  placeholder?: string
  [key: string]: any
}

interface SelectEvents {
  onChange?: (...args: unknown[]) => any
  onVisibleChange?: (...args: unknown[]) => any
  onRemoveTag?: (...args: unknown[]) => any
  onFocus?: (...args: unknown[]) => any
  onBlur?: (...args: unknown[]) => any
  filterMethod?: (...args: unknown[]) => any
  remoteMethod?: (...args: unknown[]) => any
  [key: string]: (...args: unknown[]) => any
}

const createSelect = (
  options: {
    data?: () => SelectProps
    methods?: SelectEvents
    slots?: {
      empty?: string
      default?: string
    }
  } = {},
) => {
  const emptySlot =
    (options.slots &&
      options.slots.empty &&
      `<template #empty>${options.slots.empty}</template>`) ||
    ''
  const defaultSlot =
    (options.slots &&
      options.slots.default &&
      `<template #default="{item}">${options.slots.default}</template>`) ||
    ''
  return _mount(
    `
      <el-select
        :options="options"
        :popper-class="popperClass"
        :value-key="valueKey"
        :disabled="disabled"
        :clearable="clearable"
        :multiple="multiple"
        :collapseTags="collapseTags"
        :collapseTagsTooltip="collapseTagsTooltip"
        :max-collapse-tags="maxCollapseTags"
        :filterable="filterable"
        :multiple-limit="multipleLimit"
        :placeholder="placeholder"
        :allow-create="allowCreate"
        :remote="remote"
        :no-match-text="noMatchText"
        :no-data-text="noDataText"
        :reserve-keyword="reserveKeyword"
        :scrollbar-always-on="scrollbarAlwaysOn"
        :teleported="teleported"
        ${
          options.methods && options.methods.filterMethod
            ? `:filter-method="filterMethod"`
            : ''
        }
        ${
          options.methods && options.methods.remoteMethod
            ? `:remote-method="remoteMethod"`
            : ''
        }
        @change="onChange"
        @visible-change="onVisibleChange"
        @remove-tag="onRemoveTag"
        @focus="onFocus"
        @blur="onBlur"
        v-model="value">
        ${defaultSlot}
        ${emptySlot}
      </el-select>
    `,
    {
      data() {
        return {
          options: createData(),
          value: '',
          popperClass: '',
          allowCreate: false,
          valueKey: 'value',
          disabled: false,
          clearable: false,
          multiple: false,
          collapseTags: false,
          collapseTagsTooltip: false,
          maxCollapseTags: 1,
          remote: false,
          filterable: false,
          reserveKeyword: false,
          multipleLimit: 0,
          placeholder: DEFAULT_PLACEHOLDER,
          noMatchText: undefined,
          noDataText: undefined,
          scrollbarAlwaysOn: false,
          popperAppendToBody: undefined,
          teleported: undefined,
          ...(options.data && options.data()),
        }
      },
      methods: {
        onChange: NOOP,
        onVisibleChange: NOOP,
        onRemoveTag: NOOP,
        onFocus: NOOP,
        onBlur: NOOP,
        ...options.methods,
      },
    },
  )
}

function getOptions(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`.${OPTION_ITEM_CLASS_NAME}`),
  )
}

const CLASS_NAME = 'el-select-v2'
const WRAPPER_CLASS_NAME = 'el-select-v2__wrapper'
const OPTION_ITEM_CLASS_NAME = 'el-select-dropdown__option-item'
const PLACEHOLDER_CLASS_NAME = 'el-select-v2__placeholder'
const DEFAULT_PLACEHOLDER = 'Select'

describe('Select', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    setWasmReady(true)
    vi.clearAllMocks()
  })

  it('create', async () => {
    const wrapper = createSelect()
    await nextTick()
    expect(wrapper.classes()).toContain(CLASS_NAME)
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe('')
    const select = wrapper.findComponent(Select)
    await wrapper.trigger('click')
    expect((select.vm as any).expanded).toBeTruthy()
  })

  it('inherits render pipeline budget through virtual option list', async () => {
    const wrapper = _mountWithPipeline(
      `
        <render-pipeline-provider>
          <el-select
            v-model="value"
            :options="options"
            :teleported="false"
            scrollbar-always-on
          />
        </render-pipeline-provider>
      `,
      {
        data() {
          return {
            options: createData(1000),
            value: '',
          }
        },
      },
    )

    await wrapper.findComponent(Select).trigger('click')
    await nextTick()
    await rAF()

    const list = wrapper.find('[data-fsus-render-pipeline="virtual-list"]')
    expect(list.exists()).toBe(true)
    expect(list.attributes('data-fsus-render-strategy')).toBe('chunked-main')
    expect(Number(list.attributes('data-fsus-render-cache'))).toBeGreaterThan(2)
  })

  it('options rendered correctly', async () => {
    const wrapper = createSelect()
    await nextTick()
    const vm = wrapper.vm as any
    const options = Array.from(
      document.querySelectorAll(`.${OPTION_ITEM_CLASS_NAME}`),
    )
    const result = options.every((option, index) => {
      const text = option.textContent
      return text === vm.options[index].label
    })
    expect(result).toBeTruthy()
  })

  it('custom dropdown class', async () => {
    createSelect({
      data: () => ({
        popperClass: 'custom-dropdown',
      }),
    })
    await nextTick()
    expect([...document.querySelector('.el-popper').classList]).toContain(
      'custom-dropdown',
    )
  })

  it('default value', async () => {
    const wrapper = createSelect({
      data: () => ({
        value: '2',
        options: [
          {
            value: '1',
            label: 'option_a',
          },
          {
            value: '2',
            label: 'option_b',
          },
          {
            value: '3',
            label: 'option_c',
          },
        ],
      }),
    })
    const vm = wrapper.vm as any
    await nextTick()
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe(
      vm.options[1].label,
    )
  })

  it('default value is null or undefined', async () => {
    const wrapper = createSelect({
      data: () => ({
        value: undefined,
      }),
    })
    const vm = wrapper.vm as any
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(placeholder.text()).toBe(DEFAULT_PLACEHOLDER)
    vm.value = vm.options[2].value
    await nextTick()
    expect(placeholder.text()).toBe(vm.options[2].label)
    vm.value = null
    await nextTick()
    expect(placeholder.text()).toBe(DEFAULT_PLACEHOLDER)
  })

  it('default value is Object', async () => {
    const wrapper = createSelect({
      data: () => ({
        valueKey: 'id',
        value: { id: 1 },
        options: [
          {
            value: { id: 1 },
            label: 'option_a',
          },
          {
            value: { id: 2 },
            label: 'option_b',
          },
          {
            value: { id: 3 },
            label: 'option_c',
          },
        ],
      }),
    })
    const vm = wrapper.vm as any
    await nextTick()
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe(
      vm.options[0].label,
    )
    expect(vm.value).toEqual(vm.options[0].value)
  })

  it('sync set value and options', async () => {
    const wrapper = createSelect()
    await nextTick()
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    const vm = wrapper.vm as any
    vm.value = vm.options[1].value
    await nextTick()
    expect(placeholder.text()).toBe(vm.options[1].label)
    vm.options[1].label = 'option bb aa'
    await nextTick()
    expect(placeholder.text()).toBe('option bb aa')
  })

  it('single select', async () => {
    const wrapper = createSelect({
      data() {
        return {
          count: 0,
        }
      },
      methods: {
        onChange() {
          this.count++
        },
      },
    })
    await nextTick()
    const options = getOptions()
    const vm = wrapper.vm as any
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(vm.value).toBe('')
    expect(placeholder.text()).toBe('')
    await clickOptionItem(options[2])
    await nextTick()
    expect(vm.value).toBe(vm.options[2].value)
    expect(placeholder.text()).toBe(vm.options[2].label)
    await clickOptionItem(options[4])
    await nextTick()
    expect(vm.value).toBe(vm.options[4].value)
    expect(placeholder.text()).toBe(vm.options[4].label)
    expect(vm.count).toBe(2)
  })

  it('value-key option', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          options: [
            {
              value: { id: 1 },
              label: 'option 1',
            },
            {
              value: { id: 2 },
              label: 'option 2',
            },
            {
              value: { id: 3 },
              label: 'option 3',
            },
          ],
          value: undefined,
          valueKey: 'id',
        }
      },
    })

    await nextTick()
    const vm = wrapper.vm as any
    const options = getOptions()
    await clickOptionItem(options[1])
    await nextTick()
    expect(vm.value).toEqual(vm.options[1].value)

    await clickOptionItem(options[2])
    await nextTick()
    expect(vm.value).toEqual(vm.options[2].value)
  })

  it('uses object label as placeholder when value-key model value is not in options', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          options: [
            {
              value: { id: 1, label: 'option 1' },
              label: 'option 1',
            },
            {
              value: { id: 2, label: 'option 2' },
              label: 'option 2',
            },
          ],
          value: { id: 999, label: 'custom option label' },
          valueKey: 'id',
          filterable: true,
        }
      },
    })

    await nextTick()

    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(placeholder.text()).toBe('custom option label')
  })

  it('disabled option', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          options: [
            {
              value: '1',
              label: 'option 1',
              disabled: false,
            },
            {
              value: '2',
              label: 'option 2',
              disabled: true,
            },
            {
              value: '3',
              label: 'option 3',
              disabled: false,
            },
          ],
        }
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    const option = document.querySelector<HTMLElement>(
      `.el-select-dropdown__option-item.is-disabled`,
    )
    expect(option.textContent).toBe(vm.options[1].label)
    await clickOptionItem(option)
    await nextTick()
    expect(vm.value).toBe('')
    expect(placeholder.text()).toBe('')
    vm.options[2].disabled = true
    await nextTick()
    const options = document.querySelectorAll<HTMLElement>(
      `.el-select-dropdown__option-item.is-disabled`,
    )
    expect(options.length).toBe(2)
    expect(options.item(1).textContent).toBe(vm.options[2].label)
    await clickOptionItem(options.item(1) as HTMLElement)
    await nextTick()
    expect(vm.value).toBe('')
    expect(placeholder.text()).toBe('')
  })

  it('disabled select', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          disabled: true,
        }
      },
    })
    await nextTick()
    expect(wrapper.find(`.${WRAPPER_CLASS_NAME}`).classes()).toContain(
      'is-disabled',
    )
  })

  it('visible event', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          visible: false,
        }
      },
      methods: {
        onVisibleChange(visible) {
          this.visible = visible
        },
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    await wrapper.trigger('click')
    await nextTick()
    expect(vm.visible).toBeTruthy()
  })

  it('clearable', async () => {
    const wrapper = createSelect({
      data: () => ({ clearable: true }),
    })
    const vm = wrapper.vm as any
    vm.value = vm.options[1].value
    await nextTick()
    await clickClearButton(wrapper)
    expect(vm.value).toBeUndefined()
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(placeholder.text()).toBe(DEFAULT_PLACEHOLDER)
  })

  describe('initial value', () => {
    it.each([
      [null, DEFAULT_PLACEHOLDER],
      [undefined, DEFAULT_PLACEHOLDER],
      ['', ''],
      [[], DEFAULT_PLACEHOLDER],
      [{}, ''],
    ])(
      '[single select] initial value is %s, placeholder is "%s"',
      async (value, placeholder) => {
        const wrapper = createSelect({
          data: () => {
            return {
              value,
            }
          },
        })
        await nextTick()
        expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe(
          placeholder,
        )
      },
    )

    it.each([
      [null, DEFAULT_PLACEHOLDER],
      [undefined, DEFAULT_PLACEHOLDER],
      ['', DEFAULT_PLACEHOLDER],
      [[], DEFAULT_PLACEHOLDER],
      [{}, DEFAULT_PLACEHOLDER],
    ])(
      '[multiple select] initial value is %s, placeholder is "%s"',
      async (value, placeholder) => {
        const wrapper = createSelect({
          data: () => {
            return {
              multiple: true,
              value,
            }
          },
        })
        await nextTick()
        expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe(
          placeholder,
        )
      },
    )
  })

  describe('multiple', () => {
    it('multiple select', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            multiple: true,
            value: [],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[1])
      await nextTick()
      expect(vm.value.length).toBe(1)
      expect(vm.value[0]).toBe(vm.options[1].value)
      await clickOptionItem(options[3])
      await nextTick()
      expect(vm.value.length).toBe(2)
      expect(vm.value[1]).toBe(vm.options[3].value)
      await clickTagCloseButton(wrapper)
      expect(vm.value.length).toBe(1)
    })

    it('remove-tag', async () => {
      const wrapper = createSelect({
        data() {
          return {
            removeTag: '',
            multiple: true,
          }
        },
        methods: {
          onRemoveTag(tag) {
            this.removeTag = tag
          },
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[0])
      await nextTick()
      await clickOptionItem(options[1])
      await nextTick()
      await clickOptionItem(options[2])
      await nextTick()
      expect(vm.value.length).toBe(3)
      await clickTagCloseButton(wrapper, 1)
      expect(vm.value.length).toBe(2)
      await clickTagCloseButton(wrapper)
      expect(vm.value.length).toBe(1)
    })

    it('limit', async () => {
      const wrapper = createSelect({
        data() {
          return {
            multiple: true,
            multipleLimit: 2,
            value: [],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[1])
      await nextTick()
      await clickOptionItem(options[2])
      await nextTick()
      expect(vm.value.length).toBe(2)
      await clickOptionItem(options[3])
      await nextTick()
      expect(vm.value.length).toBe(2)
    })

    it('value-key option', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            options: [
              {
                value: { id: 1, value: 'a' },
                label: 'option 1',
              },
              {
                value: { id: 2, value: 'b' },
                label: 'option 2',
              },
              {
                value: { id: 3, value: 'c' },
                label: 'option 3',
              },
            ],
            multiple: true,
            value: [],
            valueKey: 'id',
          }
        },
      })

      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[1])
      await nextTick()
      expect(vm.value.length).toBe(1)
      expect(vm.value).toContainEqual(vm.options[1].value)
      await clickOptionItem(options[2])
      await nextTick()
      expect(vm.value.length).toBe(2)
      expect(vm.value).toContainEqual(vm.options[2].value)
      await clickOptionItem(options[2])
      await nextTick()
      expect(vm.value.length).toBe(1)
      expect(vm.value).not.toContainEqual(vm.options[2].value)

      vm.valueKey = 'value'
      await nextTick()
      expect(vm.value.length).toBe(1)
      expect(vm.value).toContainEqual(vm.options[1].value)
      await clickOptionItem(options[0])
      await nextTick()
      expect(vm.value.length).toBe(2)
      expect(vm.value).toContainEqual(vm.options[0].value)
    })
  })

  describe('collapseTags', () => {
    it('use collapseTags', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            multiple: true,
            collapseTags: true,
            value: [],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[0])
      await nextTick()
      expect(vm.value.length).toBe(1)
      expect(vm.value[0]).toBe(vm.options[0].value)
      await clickOptionItem(options[1])
      await nextTick()
      await clickOptionItem(options[2])
      await nextTick()
      expect(vm.value.length).toBe(3)
      const tags = wrapper.findAll('.el-tag').filter((item) => {
        return !hasClass(item.element, 'in-tooltip')
      })
      expect(tags.length).toBe(2)
    })

    it('use collapseTagsTooltip', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            multiple: true,
            collapseTags: true,
            collapseTagsTooltip: true,
            value: [],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[0])
      await nextTick()
      expect(vm.value.length).toBe(1)
      expect(vm.value[0]).toBe(vm.options[0].value)
      await clickOptionItem(options[1])
      await nextTick()
      await clickOptionItem(options[2])
      await nextTick()
      expect(vm.value.length).toBe(3)
      expect(wrapper.findAll('.el-tag')[3].element.textContent).toBe('c2')
    })

    it('use maxCollapseTags', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            multiple: true,
            collapseTags: true,
            collapseTagsTooltip: true,
            maxCollapseTags: 3,
            value: [],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      const options = getOptions()
      await clickOptionItem(options[0])
      await nextTick()
      await clickOptionItem(options[1])
      await nextTick()
      await clickOptionItem(options[2])
      await nextTick()
      await clickOptionItem(options[3])
      await nextTick()
      expect(vm.value.length).toBe(4)
      const tags = wrapper.findAll('.el-tag').filter((item) => {
        return !hasClass(item.element, 'in-tooltip')
      })
      expect(tags.length).toBe(4)
    })
  })

  describe('manually set modelValue', () => {
    it('set modelValue in single select', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            value: '',
          }
        },
      })
      await nextTick()
      const options = getOptions()
      const vm = wrapper.vm as any
      const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)

      expect(vm.value).toBe('')
      expect(placeholder.text()).toBe('')

      await clickOptionItem(options[0])
      await nextTick()
      expect(vm.value).toBe(vm.options[0].value)
      expect(placeholder.text()).toBe(vm.options[0].label)
      const option = vm.options[0].value

      vm.value = ''
      await nextTick()
      expect(vm.value).toBe('')
      expect(placeholder.text()).toBe('')

      vm.value = option
      await nextTick()
      expect(vm.value).toBe('option_1')
      expect(placeholder.text()).toBe('a0')
    })

    it('set modelValue in multiple select', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            multiple: true,
            value: [],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      let placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
      expect(placeholder.exists()).toBeTruthy()

      vm.value = ['option_1']
      await nextTick()
      expect(wrapper.find('.el-select-v2__tags-text').text()).toBe('a0')
      placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
      expect(placeholder.exists()).toBeFalsy()

      vm.value = []
      await nextTick()
      expect(wrapper.find('.el-select-v2__tags-text').exists()).toBeFalsy()
      placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
      expect(placeholder.exists()).toBeTruthy()
    })
  })

  describe('event', () => {
    it('focus & blur', async () => {
      const onFocus = vi.fn()
      const onBlur = vi.fn()
      const wrapper = createSelect({
        methods: {
          onFocus,
          onBlur,
        },
      })
      const input = wrapper.find('input')
      const select = wrapper.findComponent(Select)
      await input.trigger('focus')
      const selectVm = select.vm as any
      // Simulate focus state to trigger menu multiple times
      selectVm.toggleMenu()
      await nextTick()
      selectVm.toggleMenu()
      await nextTick()
      // Simulate click the outside
      selectVm.handleClickOutside()
      await nextTick()
      expect(onFocus).toHaveBeenCalledTimes(1)
      expect(onBlur).toHaveBeenCalled()
    })

    it('focus & blur for multiple & filterable select', async () => {
      const onFocus = vi.fn()
      const onBlur = vi.fn()
      const wrapper = createSelect({
        data() {
          return {
            multiple: true,
            filterable: true,
            value: [],
          }
        },
        methods: {
          onFocus,
          onBlur,
        },
      })
      const input = wrapper.find('input')
      const select = wrapper.findComponent(Select)
      await input.trigger('focus')
      const selectVm = select.vm as any
      // Simulate focus state to trigger menu multiple times
      selectVm.toggleMenu()
      await nextTick()
      selectVm.toggleMenu()
      await nextTick()
      // Select multiple items in multiple mode without triggering focus
      const options = getOptions()
      await clickOptionItem(options[1])
      await nextTick()
      await clickOptionItem(options[2])
      await nextTick()
      expect(onFocus).toHaveBeenCalledTimes(1)
      // Simulate click the outside
      selectVm.handleClickOutside()
      await nextTick()
      await nextTick()
      expect(onBlur).toHaveBeenCalled()
    })

    it('only emit change on user input', async () => {
      const handleChanged = vi.fn()
      const wrapper = createSelect({
        methods: {
          onChange: handleChanged,
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      vm.value = 'option_2'
      await nextTick()
      expect(handleChanged).toHaveBeenCalledTimes(0)
      const options = getOptions()
      await clickOptionItem(options[4])
      await nextTick()
      expect(handleChanged).toHaveBeenCalled()
    })
  })

  describe('allow-create', () => {
    it('single select', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            allowCreate: true,
            filterable: true,
            clearable: true,
            options: [
              {
                value: '1',
                label: 'option 1',
              },
              {
                value: '2',
                label: 'option 2',
              },
              {
                value: '3',
                label: 'option 3',
              },
            ],
          }
        },
      })
      await nextTick()
      const select = wrapper.findComponent(Select)
      const selectVm = select.vm as any
      selectVm.expanded = true
      await nextTick()
      await rAF()
      const vm = wrapper.vm as any
      const input = wrapper.find('input')
      // create a new option
      input.element.value = '1111'
      await input.trigger('input')
      await nextTick()
      expect(selectVm.filteredOptions.length).toBe(1)
      // selected the new option
      selectVm.onSelect(selectVm.filteredOptions[0])
      expect(vm.value).toBe('1111')
      selectVm.expanded = false
      await nextTick()
      await rAF()
      selectVm.expanded = true
      await nextTick()
      await rAF()
      expect(selectVm.filteredOptions.length).toBe(4)
      selectVm.handleClear()
      expect(selectVm.filteredOptions.length).toBe(3)
    })

    it('multiple', async () => {
      const wrapper = createSelect({
        data: () => {
          return {
            allowCreate: true,
            filterable: true,
            clearable: true,
            multiple: true,
            options: [
              {
                value: '1',
                label: 'option 1',
              },
              {
                value: '2',
                label: 'option 2',
              },
              {
                value: '3',
                label: 'option 3',
              },
            ],
          }
        },
      })
      await nextTick()
      const vm = wrapper.vm as any
      await wrapper.trigger('click')
      const input = wrapper.find('input')
      input.element.value = '1111'
      await input.trigger('input')
      await nextTick()
      const select = wrapper.findComponent(Select)
      const selectVm = select.vm as any
      expect(selectVm.filteredOptions.length).toBe(1)
      // selected the new option
      selectVm.onSelect(selectVm.filteredOptions[0])
      // closed the menu
      await wrapper.trigger('click')
      input.element.value = '2222'
      await input.trigger('input')
      await nextTick()
      selectVm.onSelect(selectVm.filteredOptions[0])
      expect(JSON.stringify(vm.value)).toBe(JSON.stringify(['1111', '2222']))
      await wrapper.trigger('click')
      expect(selectVm.filteredOptions.length).toBe(5)
      // remove tag
      await clickTagCloseButton(wrapper, 1)
      expect(selectVm.filteredOptions.length).toBe(4)
      // simulate backspace
      await wrapper.find('input').trigger('keydown', {
        key: EVENT_CODE.backspace,
      })
      expect(selectVm.filteredOptions.length).toBe(3)
    })
  })

  it('reserve-keyword', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          filterable: true,
          clearable: true,
          multiple: true,
          reserveKeyword: true,
          options: [
            {
              value: 'a1',
              label: 'a1',
            },
            {
              value: 'b1',
              label: 'b1',
            },
            {
              value: 'a2',
              label: 'a2',
            },
            {
              value: 'b2',
              label: 'b2',
            },
          ],
        }
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    await nextTick()
    await wrapper.trigger('click')
    const input = wrapper.find('input')

    input.element.value = 'a'
    await input.trigger('input')
    await nextTick()
    let options = getOptions()
    expect(options.length).toBe(2)
    await clickOptionItem(options[0])
    await nextTick()
    options = getOptions()
    expect(options.length).toBe(2)

    input.element.value = ''
    await input.trigger('input')
    await nextTick()
    options = getOptions()
    expect(options.length).toBe(4)

    vm.reserveKeyword = false
    await nextTick()
    input.element.value = 'a'
    await input.trigger('input')
    await nextTick()
    options = getOptions()
    expect(options.length).toBe(2)
    await clickOptionItem(options[0])
    await nextTick()
    options = getOptions()
    expect(options.length).toBe(4)
  })

  it('render empty slot', async () => {
    const wrapper = createSelect({
      data() {
        return {
          options: [],
        }
      },
      slots: {
        empty: '<div class="empty-slot">EmptySlot</div>',
      },
    })
    await nextTick()
    expect(
      wrapper
        .findComponent({
          name: 'ElPopperContent',
        })
        .find('.empty-slot')
        .exists(),
    ).toBeTruthy()
  })

  it('should set placeholder to label of selected option when filterable is true and multiple is false', async () => {
    const wrapper = createSelect({
      data() {
        return {
          options: [
            {
              value: '1',
              label: 'option 1',
            },
            {
              value: '2',
              label: 'option 2',
            },
            {
              value: '3',
              label: 'option 3',
            },
          ],
          filterable: true,
          multiple: false,
        }
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    vm.value = '2'
    await nextTick()
    const select = wrapper.findComponent(Select)
    const selectVm = select.vm as any
    selectVm.toggleMenu()
    const input = wrapper.find('input')
    await input.trigger('focus')
    expect(placeholder.text()).toBe('option 2')
  })

  it('default value is null or undefined', async () => {
    const wrapper = createSelect({
      data() {
        return {
          value: null,
        }
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(placeholder.text()).toBe(DEFAULT_PLACEHOLDER)
    vm.value = undefined
    await nextTick()
    expect(placeholder.text()).toBe(DEFAULT_PLACEHOLDER)
  })

  it('default value is 0', async () => {
    const wrapper = createSelect({
      data: () => ({
        value: 0,
        options: [
          {
            value: 0,
            label: 'option_a',
          },
          {
            value: 1,
            label: 'option_b',
          },
          {
            value: 2,
            label: 'option_c',
          },
        ],
      }),
    })
    await nextTick()
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(placeholder.text()).toBe('option_a')
  })

  it('emptyText error show', async () => {
    const wrapper = createSelect({
      data() {
        return {
          value: `${Math.random()}`,
        }
      },
    })
    await nextTick()
    const vm = wrapper.vm as any
    const placeholder = wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`)
    expect(placeholder.text()).toBe(vm.value)
  })

  it('customized option renderer', async () => {
    const wrapper = createSelect({
      slots: {
        default: `
          <div class="custom-renderer">
            <span style="margin-right: 8px;">{{ item.label }}</span>
            <span style="color: var(--el-text-color-secondary); font-size: 13px">
              {{ item.value }}
            </span>
          </div>
        `,
      },
    })
    await nextTick()
    expect(
      wrapper
        .findComponent({
          name: 'ElPopperContent',
        })
        .findAll('.custom-renderer').length,
    ).toBeGreaterThan(0)
  })

  it('tag of disabled option is not closable', async () => {
    const wrapper = createSelect({
      data() {
        return {
          multiple: true,
          options: [
            {
              value: 1,
              label: 'option 1',
              disabled: true,
            },
            {
              value: 2,
              label: 'option 2',
              disabled: true,
            },
            {
              value: 3,
              label: 'option 3',
            },
          ],
          value: [2, 3],
        }
      },
    })
    await nextTick()
    expect(wrapper.findAll('.el-tag').length).toBe(2)
    expect(wrapper.findAll('.el-tag__close').length).toBe(1)
    await clickTagCloseButton(wrapper)
    expect(wrapper.findAll('.el-tag__close').length).toBe(0)
    expect(wrapper.findAll('.el-tag').length).toBe(1)
  })

  it('modelValue should be deep reactive in multiple mode', async () => {
    const wrapper = createSelect({
      data() {
        return {
          multiple: true,
          value: ['option_1', 'option_2', 'option_3'],
        }
      },
    })
    await nextTick()
    expect(wrapper.findAll('.el-tag').length).toBe(3)
    const vm = wrapper.vm as any
    vm.value.splice(0, 1)
    await nextTick()
    expect(wrapper.findAll('.el-tag').length).toBe(2)
  })

  it('should reset placeholder after clear when both multiple and filterable are true', async () => {
    const wrapper = createSelect({
      data() {
        return {
          value: ['option_1'],
          clearable: true,
          filterable: true,
          multiple: true,
        }
      },
    })
    await nextTick()
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).exists()).toBeFalsy()
    // When all tags are removed, the placeholder should be displayed
    await clickTagCloseButton(wrapper)
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe(
      DEFAULT_PLACEHOLDER,
    )
    // The placeholder should disappear after it is selected again
    const options = getOptions()
    await clickOptionItem(options[0])
    await nextTick()
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).exists()).toBeFalsy()
    // Simulate keyboard events
    const selectInput = wrapper.find('input')
    await selectInput.trigger('keydown', {
      key: EVENT_CODE.backspace,
    })
    await nextTick()
    expect(wrapper.find(`.${PLACEHOLDER_CLASS_NAME}`).text()).toBe(
      DEFAULT_PLACEHOLDER,
    )
  })

  describe('filter method', () => {
    async function testFilterMethod({ multiple = false }) {
      const filterMethod = vi.fn()
      const wrapper = createSelect({
        data() {
          return {
            filterable: true,
            multiple,
          }
        },
        methods: {
          filterMethod,
        },
      })
      const input = wrapper.find('input')
      input.element.value = 'query'
      await input.trigger('input')
      expect(filterMethod).toHaveBeenCalled()
    }
    it('should call filter method', async () => {
      await testFilterMethod({ multiple: false })
    })

    it('should call filter method in multiple mode', async () => {
      await testFilterMethod({ multiple: true })
    })

    it('should re-render', async () => {
      const wrapper = createSelect({
        data() {
          return {
            multiple: true,
            filterable: true,
          }
        },
        methods: {
          filterMethod() {
            this.options = [
              {
                value: 1,
                label: 'option 1',
              },
              {
                value: 2,
                label: 'option 2',
              },
              {
                value: 3,
                label: 'option 3',
              },
            ]
          },
        },
      })
      const input = wrapper.find('input')
      input.element.value = 'query'
      await input.trigger('input')
      await nextTick()
      input.element.value = ''
      await input.trigger('input')
      await nextTick()
      const options = getOptions()
      expect(options.length).toBe(3)
    })
  })

  describe('remote search', () => {
    async function testRemoteSearch({ multiple = false }) {
      const remoteMethod = vi.fn()
      const wrapper = createSelect({
        data() {
          return {
            filterable: true,
            remote: true,
            multiple,
          }
        },
        methods: {
          remoteMethod,
        },
      })
      const input = wrapper.find('input')
      input.element.value = 'query'
      await input.trigger('input')
      expect(remoteMethod).toHaveBeenCalled()
    }
    it('should call remote method', async () => {
      await testRemoteSearch({ multiple: false })
    })

    it('should call remote method in multiple mode', async () => {
      await testRemoteSearch({ multiple: true })
    })
  })

  it('keyboard operations', async () => {
    const wrapper = createSelect({
      data() {
        return {
          multiple: true,
          options: [
            {
              value: 1,
              label: 'option 1',
              disabled: true,
            },
            {
              value: 2,
              label: 'option 2',
              disabled: true,
            },
            {
              value: 3,
              label: 'option 3',
            },
            {
              value: 4,
              label: 'option 4',
            },
            {
              value: 5,
              label: 'option 5',
              options: [
                {
                  value: 51,
                  label: 'option 5-1',
                },
                {
                  value: 52,
                  label: 'option 5-2',
                },
                {
                  value: 53,
                  label: 'option 5-3',
                  disabled: true,
                },
              ],
            },
            {
              value: 6,
              label: 'option 6',
            },
          ],
          value: [],
        }
      },
    })
    const select = wrapper.findComponent(Select)
    const selectVm = select.vm as any
    const vm = wrapper.vm as any
    await wrapper.trigger('click')
    await nextTick()
    expect(selectVm.states.hoveringIndex).toBe(-1)
    // should skip the disabled option
    selectVm.onKeyboardNavigate('forward')
    selectVm.onKeyboardNavigate('forward')
    await nextTick()
    expect(selectVm.states.hoveringIndex).toBe(3)
    // should skip the group option
    selectVm.onKeyboardNavigate('backward')
    selectVm.onKeyboardNavigate('backward')
    selectVm.onKeyboardNavigate('backward')
    selectVm.onKeyboardNavigate('backward')
    await nextTick()
    expect(selectVm.states.hoveringIndex).toBe(5)
    selectVm.onKeyboardNavigate('backward')
    selectVm.onKeyboardNavigate('backward')
    selectVm.onKeyboardNavigate('backward')
    await nextTick()
    // navigate to the last one
    expect(selectVm.states.hoveringIndex).toBe(9)
    selectVm.onKeyboardSelect()
    await nextTick()
    expect(vm.value).toEqual([6])
  })

  it('multiple select when content overflow', async () => {
    const wrapper = createSelect({
      data() {
        return {
          options: [
            {
              value: '选项1',
              label:
                '黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕',
            },
            {
              value: '选项2',
              label:
                '双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶',
            },
            {
              value: '选项3',
              label: '蚵仔煎蚵仔煎蚵仔煎蚵仔煎蚵仔煎蚵仔煎',
            },
            {
              value: '选项4',
              label: '龙须面',
            },
            {
              value: '选项5',
              label: '北京烤鸭',
            },
          ],
        }
      },
    })
    const select = wrapper.findComponent(Select)
    const selectVm = select.vm as any
    const selectDom = wrapper.find('.el-select-v2__wrapper').element
    const selectRect = {
      height: 40,
      width: 221,
      x: 44,
      y: 8,
      top: 8,
    }
    const mockSelectWidth = vi
      .spyOn(selectDom, 'getBoundingClientRect')
      .mockReturnValue(selectRect as DOMRect)
    selectVm.handleResize()
    const options = getOptions()
    await clickOptionItem(options[0])
    await nextTick()
    await clickOptionItem(options[1])
    await nextTick()
    await clickOptionItem(options[2])
    await nextTick()
    const tagWrappers = wrapper.findAll('.el-select-v2__tags-text')
    for (const tagWrapper of tagWrappers) {
      const tagWrapperDom = tagWrapper.element
      expect(
        Number.parseInt(tagWrapperDom.style.maxWidth) === selectRect.width - 42,
      ).toBe(true)
    }
    mockSelectWidth.mockRestore()
  })

  describe('scrollbarAlwaysOn flag control the scrollbar whether always displayed', () => {
    it('The default scrollbar is not always displayed', async () => {
      const wrapper = createSelect()
      await nextTick()
      const select = wrapper.findComponent(Select)
      await wrapper.trigger('click')
      expect((select.vm as any).expanded).toBeTruthy()
      const box = document.querySelector<HTMLElement>('.el-vl__wrapper')
      expect(hasClass(box, 'always-on')).toBe(false)
    })

    it('set the scrollbar-always-on value to true, keep the scroll bar displayed', async () => {
      const wrapper = createSelect({
        data() {
          return {
            scrollbarAlwaysOn: true,
          }
        },
      })
      await nextTick()
      const select = wrapper.findComponent(Select)
      await wrapper.trigger('click')
      expect((select.vm as any).expanded).toBeTruthy()
      const box = document.querySelector<HTMLElement>('.el-vl__wrapper')
      expect(hasClass(box, 'always-on')).toBe(true)
    })
  })

  describe('teleported API', () => {
    it('should mount on popper container', async () => {
      expect(document.body.innerHTML).toBe('')
      createSelect({
        data() {
          return {
            options: [
              {
                value: '选项1',
                label:
                  '黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕',
              },
              {
                value: '选项2',
                label:
                  '双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶',
              },
              {
                value: '选项3',
                label: '蚵仔煎蚵仔煎蚵仔煎蚵仔煎蚵仔煎蚵仔煎',
              },
              {
                value: '选项4',
                label: '龙须面',
              },
              {
                value: '选项5',
                label: '北京烤鸭',
              },
            ],
          }
        },
      })

      await nextTick()
      const { selector } = usePopperContainerId()
      expect(document.body.querySelector(selector.value)!.innerHTML).not.toBe(
        '',
      )
    })

    it('should not mount on the popper container', async () => {
      expect(document.body.innerHTML).toBe('')
      createSelect({
        data() {
          return {
            teleported: false,
            options: [
              {
                value: '选项1',
                label:
                  '黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕黄金糕',
              },
              {
                value: '选项2',
                label:
                  '双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶双皮奶',
              },
              {
                value: '选项3',
                label: '蚵仔煎蚵仔煎蚵仔煎蚵仔煎蚵仔煎蚵仔煎',
              },
              {
                value: '选项4',
                label: '龙须面',
              },
              {
                value: '选项5',
                label: '北京烤鸭',
              },
            ],
          }
        },
      })

      await nextTick()
      const { selector } = usePopperContainerId()
      expect(document.body.querySelector(selector.value).innerHTML).toBe('')
    })
  })

  it('filterable case-insensitive', async () => {
    const wrapper = createSelect({
      data: () => {
        return {
          filterable: true,
          options: [
            {
              value: '1',
              label: 'option 1',
            },
            {
              value: '2',
              label: 'option 2',
            },
            {
              value: '3',
              label: 'OPtion 3',
            },
          ],
        }
      },
    })
    await nextTick()
    const select = wrapper.findComponent(Select)
    const selectVm = select.vm as any
    selectVm.expanded = true
    await nextTick()
    await rAF()
    const input = wrapper.find('input')
    input.element.value = 'op'
    await input.trigger('input')
    await nextTick()
    expect(selectVm.filteredOptions.length).toBe(3)
  })

  it('filterable supports 100K datasets through the indexed worker path', async () => {
    const options = Array.from({ length: 100_000 }, (_, index) => ({
      value: `${index + 1}`,
      label: index === 92_111 ? 'Wasm Match' : `option ${index + 1}`,
    }))

    const wrapper = createSelect({
      data: () => {
        return {
          filterable: true,
          options,
        }
      },
    })

    await nextTick()
    const select = wrapper.findComponent(Select)
    const selectVm = select.vm as any
    selectVm.expanded = true
    await nextTick()
    await rAF()

    const input = wrapper.find('input')
    input.element.value = 'match'
    await input.trigger('input')
    await vi.waitFor(() => expect(selectVm.filteredOptions).toHaveLength(1))

    expect(filterWithPipeline).toHaveBeenCalled()
    expect(selectVm.filteredOptions[0].label).toBe('Wasm Match')
  })

  it('keeps continuous typing, deletion and option replacement on the latest index version', async () => {
    const options = Array.from({ length: 10_000 }, (_, index) => ({
      value: `${index}`,
      label:
        index === 1_234
          ? 'Target Alpha'
          : index === 8_765
            ? 'Target Beta'
            : `option ${index}`,
    }))
    const wrapper = createSelect({
      data: () => ({ filterable: true, options }),
    })
    const selectVm = wrapper.findComponent(Select).vm as any
    const input = wrapper.find('input')

    input.element.value = 'target a'
    await input.trigger('input')
    input.element.value = 'target beta'
    await input.trigger('input')
    await vi.waitFor(() => expect(selectVm.filteredOptions).toHaveLength(1))
    expect(selectVm.filteredOptions[0].label).toBe('Target Beta')

    input.element.value = 'target'
    await input.trigger('input')
    await vi.waitFor(() => expect(selectVm.filteredOptions).toHaveLength(2))

    const buildCount = buildFilterIndex.mock.calls.length
    ;(wrapper.vm as any).options = Array.from(
      { length: 5_000 },
      (_, index) => ({
        value: `replacement-${index}`,
        label: index === 4_321 ? 'Replacement Target' : `fresh ${index}`,
      }),
    )
    await vi.waitFor(() =>
      expect(buildFilterIndex.mock.calls.length).toBeGreaterThan(buildCount),
    )
    input.element.value = 'replacement'
    await input.trigger('input')
    await vi.waitFor(() => expect(selectVm.filteredOptions).toHaveLength(1))
    expect(selectVm.filteredOptions[0].label).toBe('Replacement Target')
  })

  it('should close the dropdown when tab or esc is pressed inside the list', async () => {
    const wrapper = createSelect()
    const select = wrapper.findComponent(Select)
    const selectVm = select.vm as any

    selectVm.expanded = true
    await nextTick()
    await rAF()

    document.querySelector<HTMLElement>('.el-vl__wrapper')?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        code: EVENT_CODE.tab,
      }),
    )
    await nextTick()
    expect(selectVm.expanded).toBe(false)

    selectVm.expanded = true
    await nextTick()
    await rAF()
    document.querySelector<HTMLElement>('.el-vl__wrapper')?.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        code: EVENT_CODE.esc,
      }),
    )
    await nextTick()
    expect(selectVm.expanded).toBe(false)
  })

  it('should show no-match text when filtering returns no options', async () => {
    const wrapper = createSelect({
      data: () => ({
        filterable: true,
        noMatchText: 'No matched options',
        noDataText: 'No options',
      }),
    })

    await wrapper.trigger('click')
    const input = wrapper.find('input')
    input.element.value = 'missing-option'
    await input.trigger('input')
    await nextTick()

    expect(
      document.querySelector<HTMLElement>('.el-select-v2__empty')?.textContent,
    ).toBe('No matched options')
  })

  it('keeps non-empty JS results while the worker/WASM path is unavailable', async () => {
    filterWithPipeline.mockResolvedValueOnce({
      error: { code: 'infra', message: 'worker unavailable' },
      ok: false,
    } as never)
    const options = Array.from({ length: 10_000 }, (_, index) => ({
      value: `${index + 1}`,
      label: index === 8_765 ? 'Wasm Match' : `option ${index + 1}`,
    }))

    const wrapper = createSelect({
      data: () => ({
        filterable: true,
        options,
      }),
    })

    await wrapper.trigger('click')
    const selectVm = wrapper.findComponent(Select).vm as any
    const input = wrapper.find('input')

    input.element.value = 'match'
    await input.trigger('input')
    await nextTick()

    expect(selectVm.filteredOptions.length).toBeGreaterThan(0)
    await vi.waitFor(() => expect(selectVm.filteredOptions).toHaveLength(1))
    expect(selectVm.filteredOptions[0].label).toBe('Wasm Match')

    input.element.value = 'option 12'
    await input.trigger('input')
    await vi.waitFor(() =>
      expect(selectVm.filteredOptions.length).toBeGreaterThan(0),
    )
  })

  it('should keep non-ascii filtering on the JS path', async () => {
    const options = Array.from({ length: 2_200 }, (_, index) => ({
      value: `${index + 1}`,
      label: index === 1_024 ? 'Éclair' : `option ${index + 1}`,
    }))

    const wrapper = createSelect({
      data: () => ({
        filterable: true,
        options,
      }),
    })

    await wrapper.trigger('click')
    const selectVm = wrapper.findComponent(Select).vm as any
    const input = wrapper.find('input')

    input.element.value = 'é'
    await input.trigger('input')
    await nextTick()

    expect(filterIndicesSync).not.toHaveBeenCalled()
    expect(selectVm.filteredOptions).toHaveLength(1)
    expect(selectVm.filteredOptions[0].label).toBe('Éclair')
  })

  it('should render variable-height mode without undefined item sizes', async () => {
    const wrapper = createSelect({
      data: () => ({
        filterable: true,
        estimatedOptionHeight: 28,
        options: [
          {
            value: '1',
            label: 'A very long option label that should still render safely',
          },
          {
            value: '2',
            label: 'Another long option label for variable-height mode',
          },
          {
            value: '3',
            label: 'Short label',
          },
        ],
      }),
    })

    await wrapper.trigger('click')
    await nextTick()

    expect(
      getOptions().every((option) => option.style.height !== 'undefinedpx'),
    ).toBe(true)

    const input = wrapper.find('input')
    input.element.value = 'long'
    await input.trigger('input')
    await nextTick()

    expect(
      getOptions().every((option) => option.style.height !== 'undefinedpx'),
    ).toBe(true)
  })
})
