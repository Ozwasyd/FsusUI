import { computed, defineComponent, h, onBeforeUnmount, ref, type PropType } from 'vue'
import { useFsusLocale } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import FsusPagination from '../pagination/FsusPagination.vue'
import FsusButton from '../button/FsusButton.vue'
import FsusInput from '../input/FsusInput.vue'

export interface FsusPublicShellNavItem {
  key: string
  label: string
  href?: string
}

// ─── Shells (PublicShell, SiteHeader, ResponsiveCollection) ────────────────────
export const FsusSiteHeader = defineComponent({
  name: 'FsusSiteHeader',
  props: {
    brand: { type: String, default: '' },
    brandHref: { type: String, default: '' },
    sticky: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    return () =>
      h('header', { class: 'fsus-site-header', 'data-sticky': props.sticky ? '' : undefined }, [
        h('div', { class: 'fsus-site-header__inner' }, [
          props.brandHref
            ? h('a', { class: 'fsus-site-header__brand', href: props.brandHref }, slots.brand ? slots.brand() : props.brand)
            : h('div', { class: 'fsus-site-header__brand' }, slots.brand ? slots.brand() : props.brand),
          h('nav', { class: 'fsus-site-header__nav' }, slots.nav?.()),
          h('div', { class: 'fsus-site-header__actions' }, slots.actions?.()),
        ]),
      ])
  },
})

export const FsusPublicShell = defineComponent({
  name: 'FsusPublicShell',
  props: {
    brand: { type: String, default: '' },
    brandHref: { type: String, default: '' },
    maxWidth: { type: String, default: '1200px' },
    sticky: { type: Boolean, default: true },
    activeNav: { type: String, default: '' },
    navItems: { type: Array as PropType<FsusPublicShellNavItem[]>, default: () => [] },
    desktopSearchMode: { type: String as PropType<'inline' | 'trigger' | 'none'>, default: 'none' },
    desktopSearchTriggerLabel: { type: String, default: 'Search' },
    mobileNavMode: { type: String as PropType<'menu' | 'inline' | 'bottom' | 'none'>, default: 'menu' },
    mobileNavLabel: { type: String, default: 'Primary navigation' },
    mobileNavMenuLabel: { type: String, default: 'Menu' },
    mobileSearchMode: { type: String as PropType<'inline' | 'trigger' | 'none'>, default: 'none' },
    mobileSearchTriggerLabel: { type: String, default: 'Search' },
    searchQuery: { type: String, default: '' },
    searchPlaceholder: { type: String, default: 'Search' },
    searchAriaLabel: { type: String, default: 'Search' },
    searchAction: { type: String, default: '/search' },
    searchName: { type: String, default: 'q' },
    spaSearch: { type: Boolean, default: false },
    authLabel: { type: String, default: '' },
    authHref: { type: String, default: '' },
    cspSafe: { type: Boolean, default: false },
  },
  emits: ['search', 'update:searchQuery'],
  setup(props, { emit, slots }) {
    const mobileMenuOpen = ref(false)
    const searchDisclosed = ref(false)

    const renderNavLinks = () => {
      if (slots.nav) return slots.nav()
      return props.navItems.map((item) =>
        h(
          'a',
          {
            key: item.key,
            class: 'fsus-site-header__nav-link',
            href: item.href ?? `#${item.key}`,
            'aria-current': props.activeNav === item.key ? 'page' : undefined,
          },
          item.label,
        ),
      )
    }

    const renderSearchForm = () =>
      h(
        'form',
        {
          class: 'fsus-public-shell__search',
          role: 'search',
          action: props.searchAction,
          onSubmit: (event: Event) => {
            if (props.spaSearch) event.preventDefault()
            emit('search', props.searchQuery)
          },
        },
        [
          h('input', {
            type: 'search',
            name: props.searchName,
            class: 'fsus-public-shell__search-input',
            value: props.searchQuery,
            placeholder: props.searchPlaceholder,
            'aria-label': props.searchAriaLabel,
            onInput: (event: Event) => {
              emit('update:searchQuery', (event.target as HTMLInputElement).value)
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Escape' && props.desktopSearchMode === 'trigger') {
                searchDisclosed.value = false
              }
            },
          }),
        ],
      )

    return () =>
      h(
        'div',
        {
          class: 'fsus-public-shell',
          'data-desktop-search-mode': props.desktopSearchMode,
          'data-mobile-nav-mode': props.mobileNavMode,
        },
        [
          slots.header
            ? slots.header()
            : h(
                FsusSiteHeader,
                {
                  brand: props.brand,
                  brandHref: props.brandHref,
                  sticky: props.sticky,
                  'data-public-shell-header': '',
                },
                {
                  brand: slots.brand,
                  nav: props.mobileNavMode === 'none' ? undefined : renderNavLinks,
                  actions: () => [
                    props.desktopSearchMode === 'inline' ? renderSearchForm() : null,
                    props.desktopSearchMode === 'trigger'
                      ? [
                          searchDisclosed.value ? renderSearchForm() : null,
                          h(
                            'button',
                            {
                              type: 'button',
                              class: 'fsus-public-shell__search-trigger',
                              'data-public-shell-search-trigger': '',
                              'aria-expanded': searchDisclosed.value ? 'true' : 'false',
                              'aria-label': props.desktopSearchTriggerLabel,
                              onClick: () => (searchDisclosed.value = !searchDisclosed.value),
                            },
                            [h(FsusIcon, { name: 'search', size: 16 })],
                          ),
                        ]
                      : null,
                    slots['desktop-actions']?.(),
                    slots.actions?.(),
                    props.authLabel
                      ? h(
                          'a',
                          {
                            class: 'fsus-site-header__nav-link',
                            href: props.authHref || '#auth',
                          },
                          props.authLabel,
                        )
                      : null,
                    props.mobileNavMode === 'menu'
                      ? h(
                          'button',
                          {
                            type: 'button',
                            class: 'fsus-public-shell__menu-btn',
                            'data-public-shell-menu-trigger': '',
                            'aria-expanded': mobileMenuOpen.value ? 'true' : 'false',
                            'aria-label': props.mobileNavMenuLabel,
                            onClick: () => (mobileMenuOpen.value = !mobileMenuOpen.value),
                          },
                          [h(FsusIcon, { name: mobileMenuOpen.value ? 'close' : 'menu', size: 18 })],
                        )
                      : null,
                  ],
                },
              ),
          mobileMenuOpen.value
            ? h(
                'div',
                {
                  class: 'fsus-public-shell__drawer',
                  'data-public-shell-drawer': '',
                  role: 'region',
                  'aria-label': props.mobileNavLabel,
                },
                [
                  renderNavLinks(),
                  slots['mobile-primary-actions']?.(),
                  slots['mobile-menu-actions']?.(),
                ],
              )
            : null,
          h('main', { class: 'fsus-public-shell__main', style: { maxWidth: props.maxWidth } }, slots.default?.()),
          props.mobileNavMode === 'bottom'
            ? h(
                'nav',
                {
                  class: 'fsus-public-shell__bottom-nav',
                  'data-public-shell-bottom-nav': '',
                  'aria-label': props.mobileNavLabel,
                },
                renderNavLinks(),
              )
            : null,
          slots.footer ? h('footer', { class: 'fsus-public-shell__footer' }, slots.footer()) : null,
        ],
      )
  },
})

export const FsusResponsiveCollection = defineComponent({
  name: 'FsusResponsiveCollection',
  props: {
    minItemWidth: { type: String, default: '260px' },
    gap: { type: String, default: '16px' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'fsus-responsive-collection',
          style: {
            gridTemplateColumns: `repeat(auto-fill, minmax(${props.minItemWidth}, 1fr))`,
            gap: props.gap,
          },
        },
        slots.default?.(),
      )
  },
})

// ─── Collection Primitives ─────────────────────────────────────────────────────
export const FsusCollectionToolbar = defineComponent({
  name: 'FsusCollectionToolbar',
  setup(_, { slots }) {
    return () =>
      h('div', { class: 'fsus-collection-toolbar' }, [
        h('div', { class: 'fsus-collection-toolbar__start' }, slots.default?.()),
        slots.end ? h('div', { class: 'fsus-collection-toolbar__end' }, slots.end()) : null,
      ])
  },
})

export const FsusCollectionSummary = defineComponent({
  name: 'FsusCollectionSummary',
  props: { label: { type: String, default: '' }, count: { type: Number, default: undefined } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-collection-summary' }, slots.default ? slots.default() : `${props.label} ${props.count ?? ''}`.trim())
  },
})

export const FsusFilterGroup = defineComponent({
  name: 'FsusFilterGroup',
  props: { label: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-filter-group', role: 'group', 'aria-label': props.label || undefined }, [
        props.label ? h('span', { class: 'fsus-filter-group__label' }, props.label) : null,
        slots.default?.(),
      ])
  },
})

export interface FsusSegmentOption {
  value: string | number
  label: string
  disabled?: boolean
}

export const FsusSegmentedControl = defineComponent({
  name: 'FsusSegmentedControl',
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: '' },
    options: { type: Array as PropType<FsusSegmentOption[]>, default: () => [] },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { class: 'fsus-segmented', role: 'radiogroup' },
        props.options.map((opt) =>
          h(
            'button',
            {
              key: String(opt.value),
              type: 'button',
              role: 'radio',
              class: 'fsus-segmented__item',
              'aria-checked': props.modelValue === opt.value ? 'true' : 'false',
              'data-active': props.modelValue === opt.value ? '' : undefined,
              disabled: opt.disabled,
              onClick: () => {
                emit('update:modelValue', opt.value)
                emit('change', opt.value)
              },
            },
            opt.label,
          ),
        ),
      )
  },
})

export const FsusDataList = defineComponent({
  name: 'FsusDataList',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-data-list', role: 'list' }, slots.default?.())
  },
})

export const FsusPaginationBar = defineComponent({
  name: 'FsusPaginationBar',
  props: {
    total: { type: Number, required: true },
    pageSize: { type: Number, default: 20 },
    currentPage: { type: Number, default: 1 },
  },
  emits: ['update:currentPage', 'change'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'fsus-pagination-bar' }, [
        h(FsusPagination, {
          total: props.total,
          pageSize: props.pageSize,
          currentPage: props.currentPage,
          'onUpdate:currentPage': (p: number) => emit('update:currentPage', p),
          onChange: (p: number) => emit('change', p),
        }),
      ])
  },
})

// ─── Settings Primitives ───────────────────────────────────────────────────────
export const FsusSectionHeader = defineComponent({
  name: 'FsusSectionHeader',
  props: { title: { type: String, required: true }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('header', { class: 'fsus-section-header' }, [
        h('div', [
          h('h2', { class: 'fsus-section-header__title' }, props.title),
          props.description ? h('p', { class: 'fsus-section-header__desc' }, props.description) : null,
        ]),
        slots.actions ? h('div', { class: 'fsus-section-header__actions' }, slots.actions()) : null,
      ])
  },
})

export const FsusSectionNav = defineComponent({
  name: 'FsusSectionNav',
  setup(_, { slots }) {
    return () => h('nav', { class: 'fsus-section-nav' }, slots.default?.())
  },
})

export const FsusSettingsSection = defineComponent({
  name: 'FsusSettingsSection',
  props: { title: { type: String, default: '' }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('section', { class: 'fsus-settings-section' }, [
        props.title ? h(FsusSectionHeader, { title: props.title, description: props.description }, { actions: slots.actions }) : null,
        h('div', { class: 'fsus-settings-section__body' }, slots.default?.()),
      ])
  },
})

export const FsusFormSection = defineComponent({
  name: 'FsusFormSection',
  props: { title: { type: String, default: '' }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () => h(FsusSettingsSection, { title: props.title, description: props.description }, slots)
  },
})

export const FsusResourceList = defineComponent({
  name: 'FsusResourceList',
  setup(_, { slots }) {
    return () => h('ul', { class: 'fsus-resource-list' }, slots.default?.())
  },
})

export const FsusResourceListItem = defineComponent({
  name: 'FsusResourceListItem',
  props: { title: { type: String, default: '' }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('li', { class: 'fsus-resource-list__item' }, [
        h('div', { class: 'fsus-resource-list__main' }, [
          props.title ? h('div', { class: 'fsus-resource-list__title' }, props.title) : null,
          props.description ? h('div', { class: 'fsus-resource-list__desc' }, props.description) : null,
          slots.default?.(),
        ]),
        slots.actions ? h('div', { class: 'fsus-resource-list__actions' }, slots.actions()) : null,
      ])
  },
})

export const FsusMetadataRow = defineComponent({
  name: 'FsusMetadataRow',
  setup(_, { slots }) {
    return () => h('dl', { class: 'fsus-metadata-row' }, slots.default?.())
  },
})

export const FsusMetadataItem = defineComponent({
  name: 'FsusMetadataItem',
  props: { label: { type: String, required: true }, value: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-metadata-item' }, [
        h('dt', { class: 'fsus-metadata-item__label' }, props.label),
        h('dd', { class: 'fsus-metadata-item__value' }, slots.default ? slots.default() : props.value),
      ])
  },
})

export const FsusInlineActions = defineComponent({
  name: 'FsusInlineActions',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-inline-actions' }, slots.default?.())
  },
})

export const FsusRiskNotice = defineComponent({
  name: 'FsusRiskNotice',
  props: { title: { type: String, default: '' }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-risk-notice', role: 'alert' }, [
        props.title ? h('div', { class: 'fsus-risk-notice__title' }, props.title) : null,
        h('div', { class: 'fsus-risk-notice__desc' }, slots.default ? slots.default() : props.description),
      ])
  },
})

export const FsusDangerZone = defineComponent({
  name: 'FsusDangerZone',
  props: { title: { type: String, default: 'Danger Zone' }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('section', { class: 'fsus-danger-zone' }, [
        h(FsusSectionHeader, { title: props.title, description: props.description }),
        h('div', { class: 'fsus-danger-zone__body' }, slots.default?.()),
      ])
  },
})

export const FsusDestructiveActionPanel = defineComponent({
  name: 'FsusDestructiveActionPanel',
  props: { title: { type: String, required: true }, description: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-destructive-panel' }, [
        h('div', [
          h('div', { class: 'fsus-destructive-panel__title' }, props.title),
          props.description ? h('p', { class: 'fsus-destructive-panel__desc' }, props.description) : null,
        ]),
        slots.action ? h('div', slots.action()) : slots.default?.(),
      ])
  },
})

export const FsusTypedConfirmField = defineComponent({
  name: 'FsusTypedConfirmField',
  props: {
    expected: { type: String, required: true },
    label: { type: String, default: '' },
    confirmText: { type: String, default: 'Confirm' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const value = ref('')
    return () =>
      h('div', { class: 'fsus-typed-confirm' }, [
        props.label ? h('label', { class: 'fsus-typed-confirm__label' }, props.label) : null,
        h(FsusInput, {
          modelValue: value.value,
          'onUpdate:modelValue': (v: string | number) => (value.value = String(v)),
          placeholder: props.expected,
        }),
        h(
          FsusButton,
          {
            variant: 'danger',
            disabled: value.value !== props.expected,
            onClick: () => emit('confirm'),
          },
          () => props.confirmText,
        ),
      ])
  },
})

// ─── Metric Primitives ─────────────────────────────────────────────────────────
export const FsusMetricList = defineComponent({
  name: 'FsusMetricList',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-metric-list' }, slots.default?.())
  },
})

export const FsusMetricItem = defineComponent({
  name: 'FsusMetricItem',
  props: { label: { type: String, required: true }, value: { type: [String, Number], required: true }, delta: { type: String, default: '' } },
  setup(props) {
    return () =>
      h('div', { class: 'fsus-metric-item' }, [
        h('span', { class: 'fsus-metric-item__label' }, props.label),
        h('strong', { class: 'fsus-metric-item__value' }, String(props.value)),
        props.delta ? h('span', { class: 'fsus-metric-item__delta' }, props.delta) : null,
      ])
  },
})

export const FsusKpiGroup = defineComponent({
  name: 'FsusKpiGroup',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-kpi-group' }, slots.default?.())
  },
})

export const FsusDistributionList = defineComponent({
  name: 'FsusDistributionList',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-distribution-list' }, slots.default?.())
  },
})

export const FsusDistributionBarRow = defineComponent({
  name: 'FsusDistributionBarRow',
  props: { label: { type: String, required: true }, value: { type: Number, required: true }, percentage: { type: Number, default: 0 } },
  setup(props) {
    return () =>
      h('div', { class: 'fsus-distribution-row' }, [
        h('div', { class: 'fsus-distribution-row__meta' }, [
          h('span', props.label),
          h('span', String(props.value)),
        ]),
        h('div', { class: 'fsus-distribution-row__track' }, [
          h('div', { class: 'fsus-distribution-row__bar', style: { width: `${Math.min(100, Math.max(0, props.percentage))}%` } }),
        ]),
      ])
  },
})

export const FsusKeyValueGrid = defineComponent({
  name: 'FsusKeyValueGrid',
  setup(_, { slots }) {
    return () => h('dl', { class: 'fsus-kv-grid' }, slots.default?.())
  },
})

export const FsusKeyValueItem = defineComponent({
  name: 'FsusKeyValueItem',
  props: { label: { type: String, required: true }, value: { type: [String, Number], default: '' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-kv-item' }, [
        h('dt', { class: 'fsus-kv-item__key' }, props.label),
        h('dd', { class: 'fsus-kv-item__val' }, slots.default ? slots.default() : String(props.value)),
      ])
  },
})

export const FsusStatusSummary = defineComponent({
  name: 'FsusStatusSummary',
  props: { label: { type: String, required: true }, tone: { type: String, default: 'neutral' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-status-summary', 'data-tone': props.tone }, [
        h('span', { class: 'fsus-status-summary__dot', 'aria-hidden': 'true' }),
        h('span', props.label),
        slots.default?.(),
      ])
  },
})

export const FsusDiagnosticsList = defineComponent({
  name: 'FsusDiagnosticsList',
  setup(_, { slots }) {
    return () => h('ul', { class: 'fsus-diagnostics-list' }, slots.default?.())
  },
})

export const FsusDiagnosticsItem = defineComponent({
  name: 'FsusDiagnosticsItem',
  props: { title: { type: String, required: true }, detail: { type: String, default: '' }, tone: { type: String, default: 'neutral' } },
  setup(props) {
    return () =>
      h('li', { class: 'fsus-diagnostics-item', 'data-tone': props.tone }, [
        h('strong', props.title),
        props.detail ? h('span', props.detail) : null,
      ])
  },
})

let lastCopyAnnouncement = ''

export const FsusCopyableDetail = defineComponent({
  name: 'FsusCopyableDetail',
  props: {
    value: { type: String, required: true },
    label: { type: String, default: '' },
    copyLabel: { type: String, default: undefined },
    copiedLabel: { type: String, default: undefined },
    copyErrorLabel: { type: String, default: undefined },
  },
  emits: ['copy', 'copyError'],
  setup(props, { emit }) {
    const { t } = useFsusLocale()
    const status = ref<'idle' | 'copied' | 'error'>('idle')
    const announcement = ref('')
    let resetTimer: ReturnType<typeof setTimeout> | null = null

    const clearResetTimer = () => {
      if (resetTimer !== null) {
        clearTimeout(resetTimer)
        resetTimer = null
      }
    }

    onBeforeUnmount(clearResetTimer)

    const resolveCopyLabel = computed(() => {
      if (props.copyLabel) return props.copyLabel
      const base = t('common.copy')
      return props.label ? `${base} ${props.label}` : base
    })
    const resolveCopiedLabel = computed(() => props.copiedLabel ?? t('common.copied'))
    const resolveErrorLabel = computed(() => props.copyErrorLabel ?? t('common.copyFailed'))

    const announce = (rawMessage: string) => {
      let message = rawMessage
      if (message === lastCopyAnnouncement) {
        message += '\u00A0'
      }
      lastCopyAnnouncement = message
      announcement.value = message
    }

    const scheduleReset = (delayMs: number) => {
      clearResetTimer()
      resetTimer = setTimeout(() => {
        status.value = 'idle'
        announcement.value = ''
        resetTimer = null
      }, delayMs)
    }

    const copy = async () => {
      clearResetTimer()
      try {
        if (
          typeof navigator === 'undefined' ||
          !navigator.clipboard ||
          typeof navigator.clipboard.writeText !== 'function'
        ) {
          throw new Error('Clipboard API is unavailable')
        }
        await navigator.clipboard.writeText(props.value)
        status.value = 'copied'
        announce(resolveCopiedLabel.value)
        emit('copy', props.value)
        scheduleReset(1500)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        status.value = 'error'
        announce(resolveErrorLabel.value)
        emit('copyError', error)
        scheduleReset(2000)
      }
    }

    return () => {
      const iconName =
        status.value === 'copied'
          ? 'check'
          : status.value === 'error'
            ? 'warning'
            : 'copy-document'
      const buttonLabel =
        status.value === 'copied'
          ? resolveCopiedLabel.value
          : status.value === 'error'
            ? resolveErrorLabel.value
            : resolveCopyLabel.value

      return h(
        'div',
        {
          class: 'fsus-copyable-detail',
          'data-status': status.value,
          'data-copied': status.value === 'copied' ? '' : undefined,
          'data-failed': status.value === 'error' ? '' : undefined,
        },
        [
          props.label ? h('span', { class: 'fsus-copyable-detail__label' }, props.label) : null,
          h('code', { class: 'fsus-copyable-detail__code' }, props.value),
          h(
            'button',
            {
              type: 'button',
              class: 'fsus-copyable-detail__btn',
              'aria-label': buttonLabel,
              'data-status': status.value,
              'data-copied': status.value === 'copied' ? '' : undefined,
              'data-failed': status.value === 'error' ? '' : undefined,
              onClick: copy,
            },
            [h(FsusIcon, { name: iconName, size: 14, 'aria-hidden': 'true' })],
          ),
          h(
            'span',
            {
              class: 'fsus-sr-only',
              role: 'status',
              'aria-live': 'polite',
              'aria-atomic': 'true',
            },
            announcement.value,
          ),
        ],
      )
    }
  },
})

// ─── Inbox Primitives ──────────────────────────────────────────────────────────
export const FsusInboxLayout = defineComponent({
  name: 'FsusInboxLayout',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-inbox-layout' }, slots.default?.())
  },
})

export const FsusSplitPane = defineComponent({
  name: 'FsusSplitPane',
  props: { sidebarWidth: { type: String, default: '320px' } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-split-pane', style: { gridTemplateColumns: `${props.sidebarWidth} 1fr` } }, [
        h('div', { class: 'fsus-split-pane__start' }, slots.start?.()),
        h('div', { class: 'fsus-split-pane__end' }, slots.end ? slots.end() : slots.default?.()),
      ])
  },
})

export const FsusConversationList = defineComponent({
  name: 'FsusConversationList',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-conversation-list', role: 'list' }, slots.default?.())
  },
})

export const FsusConversationListItem = defineComponent({
  name: 'FsusConversationListItem',
  props: { title: { type: String, required: true }, preview: { type: String, default: '' }, active: { type: Boolean, default: false }, unread: { type: Boolean, default: false } },
  emits: ['click'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          role: 'listitem',
          class: 'fsus-conversation-item',
          'data-active': props.active ? '' : undefined,
          'data-unread': props.unread ? '' : undefined,
          onClick: () => emit('click'),
        },
        [
          h('div', { class: 'fsus-conversation-item__title' }, props.title),
          props.preview ? h('div', { class: 'fsus-conversation-item__preview' }, props.preview) : null,
        ],
      )
  },
})

export const FsusThreadPanel = defineComponent({
  name: 'FsusThreadPanel',
  setup(_, { slots }) {
    return () => h('section', { class: 'fsus-thread-panel' }, slots.default?.())
  },
})

export const FsusConversationContextBar = defineComponent({
  name: 'FsusConversationContextBar',
  props: { title: { type: String, default: '' } },
  setup(props, { slots }) {
    return () =>
      h('header', { class: 'fsus-conversation-context' }, [
        h('span', { class: 'fsus-conversation-context__title' }, props.title),
        slots.default?.(),
      ])
  },
})

export const FsusMessageTimeline = defineComponent({
  name: 'FsusMessageTimeline',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-message-timeline' }, slots.default?.())
  },
})

export const FsusMessageBubble = defineComponent({
  name: 'FsusMessageBubble',
  props: { sender: { type: String, default: '' }, direction: { type: String as PropType<'incoming' | 'outgoing'>, default: 'incoming' } },
  setup(props, { slots }) {
    return () =>
      h('article', { class: 'fsus-message-bubble', 'data-direction': props.direction }, [
        props.sender ? h('div', { class: 'fsus-message-bubble__sender' }, props.sender) : null,
        h('div', { class: 'fsus-message-bubble__body' }, slots.default?.()),
      ])
  },
})

export const FsusReplyComposerShell = defineComponent({
  name: 'FsusReplyComposerShell',
  setup(_, { slots }) {
    return () => h('div', { class: 'fsus-reply-composer' }, slots.default?.())
  },
})

export const FsusInboxEmptyState = defineComponent({
  name: 'FsusInboxEmptyState',
  props: { title: { type: String, default: 'No conversations' } },
  setup(props, { slots }) {
    return () => h('div', { class: 'fsus-empty-state' }, slots.default ? slots.default() : props.title)
  },
})

export const FsusEmptySelectionState = defineComponent({
  name: 'FsusEmptySelectionState',
  props: { title: { type: String, default: 'Select an item to view details' } },
  setup(props, { slots }) {
    return () => h('div', { class: 'fsus-empty-state' }, slots.default ? slots.default() : props.title)
  },
})
