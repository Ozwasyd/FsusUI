import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue'
import { useFsusLocale, useRovingFocus } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

const flattenTopVNodes = (nodes: VNode[]): VNode[] => {
  const out: VNode[] = []
  for (const n of nodes) {
    if (n.type === Fragment && Array.isArray(n.children)) {
      out.push(...flattenTopVNodes(n.children as VNode[]))
    } else if (typeof n.type !== 'symbol') {
      out.push(n)
    }
  }
  return out
}

// ─── Menu ──────────────────────────────────────────────────────────────────────
interface MenuCtx {
  activeIndex: string
  mode: 'horizontal' | 'vertical'
  collapsed: boolean
  select: (index: string) => void
}
const MENU_KEY: InjectionKey<ComputedRef<MenuCtx>> = Symbol('fsus-menu')

export const FsusMenu = defineComponent({
  name: 'FsusMenu',
  props: {
    defaultActive: { type: String, default: '' },
    modelValue: { type: String, default: undefined },
    mode: { type: String as PropType<'horizontal' | 'vertical'>, default: 'vertical' },
    collapse: { type: Boolean, default: false },
    ellipsis: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'select'],
  setup(props, { emit, slots, expose }) {
    const { t } = useFsusLocale()
    const internal = ref(props.defaultActive)
    const active = computed(() => props.modelValue ?? internal.value)
    const menuRef = ref<HTMLElement | null>(null)
    const sliceIndex = ref(-1)
    const moreOpen = ref(false)
    let cachedItemWidths: number[] = []
    let resizeObserver: ResizeObserver | null = null

    const { onKeydown } = useRovingFocus(
      menuRef,
      '[role="menuitem"]',
      computed(() => props.mode),
    )

    const select = (index: string) => {
      internal.value = index
      moreOpen.value = false
      emit('update:modelValue', index)
      emit('select', index)
    }

    const recalculateOverflow = () => {
      const el = menuRef.value
      if (!el || props.mode !== 'horizontal' || !props.ellipsis) {
        sliceIndex.value = -1
        return
      }
      const containerWidth = el.clientWidth
      if (containerWidth <= 0) {
        sliceIndex.value = -1
        return
      }
      if (sliceIndex.value === -1 || cachedItemWidths.length === 0) {
        const children = Array.from(el.children).filter(
          (c) => !(c as HTMLElement).classList.contains('fsus-menu__more'),
        ) as HTMLElement[]
        if (children.length === 0) {
          sliceIndex.value = -1
          return
        }
        cachedItemWidths = children.map(
          (c) => c.offsetWidth || c.getBoundingClientRect().width || 0,
        )
      }
      const moreBtnWidth = 48
      const totalWidth = cachedItemWidths.reduce((sum, w) => sum + w + 4, 0)
      if (totalWidth <= containerWidth) {
        sliceIndex.value = -1
        return
      }
      let used = moreBtnWidth
      let fitCount = 0
      for (const w of cachedItemWidths) {
        if (used + w + 4 > containerWidth) break
        used += w + 4
        fitCount++
      }
      sliceIndex.value = fitCount
    }

    onMounted(() => {
      void nextTick(recalculateOverflow)
      if (typeof ResizeObserver !== 'undefined' && menuRef.value) {
        resizeObserver = new ResizeObserver(() => {
          recalculateOverflow()
        })
        resizeObserver.observe(menuRef.value)
      }
    })

    onBeforeUnmount(() => {
      resizeObserver?.disconnect()
    })

    watch(
      () => [props.mode, props.ellipsis],
      () => {
        cachedItemWidths = []
        sliceIndex.value = -1
        void nextTick(recalculateOverflow)
      },
    )

    provide(
      MENU_KEY,
      computed(() => ({
        activeIndex: active.value,
        mode: props.mode,
        collapsed: props.collapse,
        select,
      })),
    )

    expose({ recalculateOverflow })

    return () => {
      const rawChildren = flattenTopVNodes(slots.default?.() ?? [])
      const hasOverflow =
        props.mode === 'horizontal' &&
        props.ellipsis &&
        sliceIndex.value >= 0 &&
        sliceIndex.value < rawChildren.length

      const visibleNodes = hasOverflow ? rawChildren.slice(0, sliceIndex.value) : rawChildren
      const overflowNodes = hasOverflow ? rawChildren.slice(sliceIndex.value) : []

      return h(
        'ul',
        {
          ref: menuRef,
          class: 'fsus-menu',
          role: 'menubar',
          'aria-orientation': props.mode,
          'data-mode': props.mode,
          'data-collapse': props.collapse ? '' : undefined,
          onKeydown,
        },
        [
          ...visibleNodes,
          hasOverflow
            ? h(
                'li',
                {
                  class: 'fsus-menu__more fsus-submenu',
                  'data-open': moreOpen.value ? '' : undefined,
                },
                [
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'fsus-submenu__trigger fsus-menu__more-trigger',
                      'aria-label': t('common.more'),
                      'aria-expanded': moreOpen.value ? 'true' : 'false',
                      onClick: () => (moreOpen.value = !moreOpen.value),
                    },
                    [h(FsusIcon, { name: 'more', size: 16 })],
                  ),
                  moreOpen.value
                    ? h('ul', { class: 'fsus-submenu__list fsus-menu__more-list', role: 'menu' }, overflowNodes)
                    : null,
                ],
              )
            : null,
        ],
      )
    }
  },
})

export const FsusMenuItem = defineComponent({
  name: 'FsusMenuItem',
  props: {
    index: { type: String, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    const ctx = inject(MENU_KEY, undefined)
    const isActive = computed(() => ctx?.value.activeIndex === props.index)
    return () =>
      h(
        'li',
        {
          class: 'fsus-menu__item',
          role: 'menuitem',
          tabindex: props.disabled ? -1 : 0,
          'aria-current': isActive.value ? 'page' : undefined,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'data-active': isActive.value ? '' : undefined,
          'data-disabled': props.disabled ? '' : undefined,
          onClick: () => {
            if (props.disabled) return
            emit('click', props.index)
            ctx?.value.select(props.index)
          },
        },
        slots.default?.(),
      )
  },
})

export const FsusMenuItemGroup = defineComponent({
  name: 'FsusMenuItemGroup',
  props: { title: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('li', { class: 'fsus-menu__group', role: 'presentation' }, [
        props.title || slots.title
          ? h('div', { class: 'fsus-menu__group-title' }, slots.title ? slots.title() : props.title)
          : null,
        h('ul', { class: 'fsus-menu__group-list', role: 'group' }, slots.default?.()),
      ])
  },
})

export const FsusSubMenu = defineComponent({
  name: 'FsusSubMenu',
  props: {
    index: { type: String, required: true },
    title: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const open = ref(false)
    return () =>
      h('li', { class: 'fsus-submenu', 'data-open': open.value ? '' : undefined }, [
        h(
          'button',
          {
            type: 'button',
            class: 'fsus-submenu__trigger',
            'aria-expanded': open.value ? 'true' : 'false',
            disabled: props.disabled,
            onClick: () => !props.disabled && (open.value = !open.value),
          },
          [
            h('span', slots.title ? slots.title() : props.title),
            h(FsusIcon, { name: open.value ? 'arrow-down' : 'arrow-right', size: 12 }),
          ],
        ),
        open.value ? h('ul', { class: 'fsus-submenu__list', role: 'menu' }, slots.default?.()) : null,
      ])
  },
})

// ─── Tabs ──────────────────────────────────────────────────────────────────────
interface TabPaneMeta {
  name: string | number
  label: string
  disabled?: boolean
  closable?: boolean
}
interface TabsCtx {
  active: string | number
  register: (pane: TabPaneMeta) => void
  unregister: (name: string | number) => void
}
const TABS_KEY: InjectionKey<ComputedRef<TabsCtx>> = Symbol('fsus-tabs')

export const FsusTabPane = defineComponent({
  name: 'FsusTabPane',
  props: {
    name: { type: [String, Number] as PropType<string | number>, required: true },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    closable: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const ctx = inject(TABS_KEY, undefined)
    const sync = () => {
      ctx?.value.register({
        name: props.name,
        label: props.label || String(props.name),
        disabled: props.disabled,
        closable: props.closable,
      })
    }
    sync()
    watch(() => [props.name, props.label, props.disabled, props.closable], sync)
    onBeforeUnmount(() => {
      ctx?.value.unregister(props.name)
    })
    return () =>
      ctx?.value.active === props.name
        ? h('div', { class: 'fsus-tabs__pane', role: 'tabpanel' }, slots.default?.())
        : null
  },
})

export const FsusTabs = defineComponent({
  name: 'FsusTabs',
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    variant: { type: String as PropType<'line' | 'card' | 'segmented'>, default: 'line' },
    closable: { type: Boolean, default: false },
    addable: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'tabChange', 'tabRemove', 'tabAdd', 'edit'],
  setup(props, { emit, slots }) {
    const panes = ref<TabPaneMeta[]>([])
    const tabListRef = ref<HTMLElement | null>(null)
    const navScrollRef = ref<HTMLElement | null>(null)
    const isScrollable = ref(false)
    const canScrollPrev = ref(false)
    const canScrollNext = ref(false)
    let resizeObserver: ResizeObserver | null = null

    const { onKeydown } = useRovingFocus(tabListRef, '[role="tab"]', 'horizontal')

    const active = computed(() => props.modelValue || panes.value[0]?.name || '')

    const updateScrollState = () => {
      const el = navScrollRef.value
      if (!el) return
      isScrollable.value = el.scrollWidth > el.clientWidth + 1
      canScrollPrev.value = el.scrollLeft > 0
      canScrollNext.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    }

    const scrollNavBy = (delta: number) => {
      const el = navScrollRef.value
      if (!el) return
      el.scrollLeft = Math.max(0, el.scrollLeft + delta)
      updateScrollState()
    }

    onMounted(() => {
      void nextTick(updateScrollState)
      if (typeof ResizeObserver !== 'undefined' && navScrollRef.value) {
        resizeObserver = new ResizeObserver(updateScrollState)
        resizeObserver.observe(navScrollRef.value)
      }
    })
    onBeforeUnmount(() => resizeObserver?.disconnect())
    watch(
      () => panes.value.length,
      () => void nextTick(updateScrollState),
    )

    provide(
      TABS_KEY,
      computed(() => ({
        active: active.value,
        register(meta: TabPaneMeta) {
          const idx = panes.value.findIndex((p) => p.name === meta.name)
          if (idx === -1) panes.value.push(meta)
          else panes.value[idx] = meta
        },
        unregister(name: string | number) {
          panes.value = panes.value.filter((p) => p.name !== name)
        },
      })),
    )

    const select = (pane: TabPaneMeta) => {
      if (pane.disabled) return
      emit('update:modelValue', pane.name)
      emit('tabChange', pane.name)
    }

    const onAdd = () => {
      emit('tabAdd')
      emit('edit', undefined, 'add')
    }

    const onRemove = (name: string | number) => {
      emit('tabRemove', name)
      emit('edit', name, 'remove')
    }

    return () => {
      const children = slots.default?.()
      const showAdd = props.editable || props.addable

      return h('div', { class: 'fsus-tabs', 'data-variant': props.variant }, [
        h('div', { class: 'fsus-tabs__header' }, [
          isScrollable.value
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'fsus-tabs__scroll-btn',
                  disabled: !canScrollPrev.value,
                  'aria-label': 'Scroll tabs left',
                  onClick: () => scrollNavBy(-160),
                },
                [h(FsusIcon, { name: 'arrow-left', size: 12 })],
              )
            : null,
          h(
            'div',
            {
              ref: navScrollRef,
              class: 'fsus-tabs__nav-scroll',
              onScroll: updateScrollState,
            },
            [
              h(
                'div',
                { ref: tabListRef, class: 'fsus-tabs__nav', role: 'tablist', onKeydown },
                panes.value.map((pane) => {
                  const canClose = props.editable || props.closable || pane.closable
                  return h(
                    'button',
                    {
                      key: String(pane.name),
                      type: 'button',
                      role: 'tab',
                      class: 'fsus-tabs__tab',
                      'aria-selected': active.value === pane.name ? 'true' : 'false',
                      'data-active': active.value === pane.name ? '' : undefined,
                      disabled: pane.disabled,
                      onClick: () => select(pane),
                    },
                    [
                      h('span', pane.label),
                      canClose
                        ? h(
                            'span',
                            {
                              class: 'fsus-tabs__close',
                              role: 'button',
                              'aria-label': `Close ${pane.label}`,
                              onClick: (e: MouseEvent) => {
                                e.stopPropagation()
                                onRemove(pane.name)
                              },
                            },
                            [h(FsusIcon, { name: 'close', size: 12 })],
                          )
                        : null,
                    ],
                  )
                }),
              ),
            ],
          ),
          isScrollable.value
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'fsus-tabs__scroll-btn',
                  disabled: !canScrollNext.value,
                  'aria-label': 'Scroll tabs right',
                  onClick: () => scrollNavBy(160),
                },
                [h(FsusIcon, { name: 'arrow-right', size: 12 })],
              )
            : null,
          showAdd
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'fsus-tabs__add',
                  'aria-label': 'Add tab',
                  onClick: onAdd,
                },
                [h(FsusIcon, { name: 'plus', size: 14 })],
              )
            : null,
        ]),
        h('div', { class: 'fsus-tabs__content' }, children),
      ])
    }
  },
})

// ─── Breadcrumb ────────────────────────────────────────────────────────────────
const BREADCRUMB_SEP_KEY: InjectionKey<string> = Symbol('fsus-breadcrumb-sep')

export const FsusBreadcrumb = defineComponent({
  name: 'FsusBreadcrumb',
  props: { separator: { type: String, default: '/' } },
  setup(props, { slots }) {
    provide(BREADCRUMB_SEP_KEY, props.separator)
    return () =>
      h('nav', { class: 'fsus-breadcrumb', 'aria-label': 'Breadcrumb' }, [
        h('ol', { class: 'fsus-breadcrumb__list' }, slots.default?.()),
      ])
  },
})

export const FsusBreadcrumbItem = defineComponent({
  name: 'FsusBreadcrumbItem',
  props: { href: { type: String, default: undefined }, current: { type: Boolean, default: false } },
  setup(props, { slots }) {
    const sep = inject(BREADCRUMB_SEP_KEY, '/')
    return () =>
      h('li', { class: 'fsus-breadcrumb__item', 'aria-current': props.current ? 'page' : undefined }, [
        props.href && !props.current
          ? h('a', { class: 'fsus-breadcrumb__link', href: props.href }, slots.default?.())
          : h('span', { class: 'fsus-breadcrumb__text' }, slots.default?.()),
        h('span', { class: 'fsus-breadcrumb__sep', 'aria-hidden': 'true' }, sep),
      ])
  },
})

// ─── Unified PageHeader (merges PageHeader + TaskPageHeader) ───────────────────
export const FsusPageHeader = defineComponent({
  name: 'FsusPageHeader',
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    showBack: { type: Boolean, default: false },
    backLabel: { type: String, default: undefined },
  },
  emits: ['back'],
  setup(props, { emit, slots }) {
    const { t } = useFsusLocale()
    return () =>
      h('header', { class: 'fsus-page-header' }, [
        slots.breadcrumb ? h('div', { class: 'fsus-page-header__breadcrumb' }, slots.breadcrumb()) : null,
        h('div', { class: 'fsus-page-header__row' }, [
          h('div', { class: 'fsus-page-header__main' }, [
            props.showBack
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'fsus-page-header__back',
                    onClick: () => emit('back'),
                  },
                  [h(FsusIcon, { name: 'back', size: 16 }), h('span', props.backLabel ?? t('common.back'))],
                )
              : null,
            h('div', { class: 'fsus-page-header__headings' }, [
              h('h1', { class: 'fsus-page-header__title' }, slots.title ? slots.title() : props.title),
              props.subtitle || slots.subtitle
                ? h(
                    'p',
                    { class: 'fsus-page-header__subtitle' },
                    slots.subtitle ? slots.subtitle() : props.subtitle,
                  )
                : null,
            ]),
          ]),
          slots.extra || slots.actions
            ? h('div', { class: 'fsus-page-header__actions' }, [slots.actions?.(), slots.extra?.()])
            : null,
        ]),
        slots.default ? h('div', { class: 'fsus-page-header__content' }, slots.default()) : null,
      ])
  },
})

// ─── Steps ─────────────────────────────────────────────────────────────────────
interface StepsCtx {
  active: number
  direction: 'horizontal' | 'vertical'
  register: () => number
}
const STEPS_KEY: InjectionKey<ComputedRef<StepsCtx>> = Symbol('fsus-steps')

export const FsusSteps = defineComponent({
  name: 'FsusSteps',
  props: {
    active: { type: Number, default: 0 },
    direction: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
  },
  setup(props, { slots }) {
    let seed = 0
    provide(
      STEPS_KEY,
      computed(() => ({
        active: props.active,
        direction: props.direction,
        register: () => seed++,
      })),
    )
    return () =>
      h('ol', { class: 'fsus-steps', 'data-direction': props.direction }, slots.default?.())
  },
})

export const FsusStep = defineComponent({
  name: 'FsusStep',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String as PropType<'wait' | 'process' | 'finish' | 'error'>, default: undefined },
  },
  setup(props, { slots }) {
    const ctx = inject(STEPS_KEY, undefined)
    const index = ctx ? ctx.value.register() : 0
    const resolvedStatus = computed(() => {
      if (props.status) return props.status
      const active = ctx?.value.active ?? 0
      if (index < active) return 'finish'
      if (index === active) return 'process'
      return 'wait'
    })
    return () =>
      h('li', { class: 'fsus-step', 'data-status': resolvedStatus.value }, [
        h('span', { class: 'fsus-step__indicator' }, [
          resolvedStatus.value === 'finish'
            ? h(FsusIcon, { name: 'check', size: 12 })
            : String(index + 1),
        ]),
        h('div', { class: 'fsus-step__body' }, [
          h('div', { class: 'fsus-step__title' }, slots.title ? slots.title() : props.title),
          props.description || slots.description
            ? h(
                'div',
                { class: 'fsus-step__desc' },
                slots.description ? slots.description() : props.description,
              )
            : null,
        ]),
      ])
  },
})
