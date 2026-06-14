export const boundaryTypes = [
  'default-render',
  'props-state',
  'model-value',
  'disabled-readonly',
  'loading-clearable',
  'empty-null-undefined',
  'slot',
  'event',
  'keyboard-focus',
  'responsive-desktop-mobile',
  'responsive-tiny',
  'safe-text',
  'injection-payload',
  'raw-html-opt-in',
  'teleport-popper',
  'overflow-virtual',
  'unmount-cleanup',
] as const

export type BoundaryType = (typeof boundaryTypes)[number]

export type ComponentBoundaryCoverage = {
  exports: 'all'
  boundaries: BoundaryType[]
  coveredBy?: string
  fixtureModes?: string[]
}

const formBoundaries: BoundaryType[] = [
  'default-render',
  'props-state',
  'model-value',
  'disabled-readonly',
  'empty-null-undefined',
  'event',
  'keyboard-focus',
]

const overlayBoundaries: BoundaryType[] = [
  'default-render',
  'props-state',
  'slot',
  'event',
  'keyboard-focus',
  'teleport-popper',
  'unmount-cleanup',
]

const dataBoundaries: BoundaryType[] = [
  'default-render',
  'props-state',
  'empty-null-undefined',
  'slot',
  'overflow-virtual',
  'unmount-cleanup',
]

const simpleBoundaries: BoundaryType[] = [
  'default-render',
  'props-state',
  'slot',
  'unmount-cleanup',
]

const pluginBoundaries: BoundaryType[] = [
  'default-render',
  'props-state',
  'event',
  'unmount-cleanup',
]

const responsiveBoundaries: BoundaryType[] = [
  'responsive-desktop-mobile',
  'responsive-tiny',
]

const rawHtmlOptInBoundaries: BoundaryType[] = [
  'safe-text',
  'injection-payload',
  'raw-html-opt-in',
]

const entry = (
  boundaries: BoundaryType[],
  options: Omit<ComponentBoundaryCoverage, 'exports' | 'boundaries'> = {},
): ComponentBoundaryCoverage => ({
  exports: 'all',
  boundaries: Array.from(new Set([...boundaries, ...responsiveBoundaries])),
  ...options,
})

export const rawHtmlBoundaryComponents = [
  'markdown-renderer',
  'message',
  'message-box',
  'notification',
  'tooltip',
] as const

export const publicComponentBoundaries: Record<
  string,
  ComponentBoundaryCoverage
> = {
  affix: entry(['default-render', 'props-state', 'event', 'unmount-cleanup'], {
    fixtureModes: ['states'],
  }),
  alert: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  autocomplete: entry(
    [...formBoundaries, 'loading-clearable', 'teleport-popper'],
    {
      fixtureModes: ['forms', 'states'],
    },
  ),
  avatar: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  backtop: entry(
    ['default-render', 'props-state', 'event', 'unmount-cleanup'],
    {
      fixtureModes: ['states'],
    },
  ),
  badge: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  breadcrumb: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  button: entry(
    [...simpleBoundaries, 'disabled-readonly', 'loading-clearable', 'event'],
    {
      fixtureModes: ['forms', 'states'],
    },
  ),
  calendar: entry(dataBoundaries, { fixtureModes: ['data-boundaries'] }),
  card: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  carousel: entry([...simpleBoundaries, 'event', 'keyboard-focus'], {
    fixtureModes: ['states'],
  }),
  'cascader-panel': entry([...formBoundaries, 'teleport-popper'], {
    fixtureModes: ['forms'],
  }),
  cascader: entry([...formBoundaries, 'teleport-popper'], {
    fixtureModes: ['forms'],
  }),
  'check-tag': entry([...simpleBoundaries, 'model-value', 'event'], {
    fixtureModes: ['forms', 'states'],
  }),
  checkbox: entry(formBoundaries, { fixtureModes: ['forms', 'states'] }),
  col: entry(simpleBoundaries, {
    coveredBy: 'row',
    fixtureModes: ['data-boundaries'],
  }),
  'collapse-transition': entry(['default-render', 'slot', 'unmount-cleanup'], {
    fixtureModes: ['states'],
  }),
  collapse: entry([...simpleBoundaries, 'model-value', 'event'], {
    fixtureModes: ['states'],
  }),
  collection: entry([
    'default-render',
    'props-state',
    'slot',
    'unmount-cleanup',
  ]),
  'color-picker': entry([...formBoundaries, 'teleport-popper'], {
    fixtureModes: ['forms'],
  }),
  'config-provider': entry([...simpleBoundaries, 'empty-null-undefined'], {
    fixtureModes: ['states'],
  }),
  container: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  countdown: entry([...dataBoundaries, 'event'], {
    fixtureModes: ['data-boundaries'],
  }),
  'date-picker': entry([...formBoundaries, 'teleport-popper'], {
    fixtureModes: ['forms', 'data-boundaries'],
  }),
  descriptions: entry(dataBoundaries, { fixtureModes: ['data-boundaries'] }),
  dialog: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  divider: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  drawer: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  dropdown: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  empty: entry(simpleBoundaries, {
    fixtureModes: ['states', 'data-boundaries'],
  }),
  'empty-state': entry([...simpleBoundaries, 'empty-null-undefined'], {
    fixtureModes: ['states', 'data-boundaries'],
  }),
  'focus-trap': entry([
    'default-render',
    'event',
    'keyboard-focus',
    'unmount-cleanup',
  ]),
  form: entry([...formBoundaries, 'slot'], { fixtureModes: ['forms'] }),
  icon: entry(simpleBoundaries, { fixtureModes: ['icons'] }),
  image: entry([...simpleBoundaries, 'event', 'empty-null-undefined'], {
    fixtureModes: ['states'],
  }),
  'image-viewer': entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  'inbox-primitives': entry(
    [
      ...dataBoundaries,
      'event',
      'keyboard-focus',
      'empty-null-undefined',
      'overflow-virtual',
    ],
    {
      fixtureModes: ['states', 'data-boundaries'],
    },
  ),
  'infinite-scroll': entry(pluginBoundaries, {
    fixtureModes: ['data-boundaries'],
  }),
  input: entry([...formBoundaries, 'loading-clearable'], {
    fixtureModes: ['forms', 'states'],
  }),
  'input-number': entry(formBoundaries, { fixtureModes: ['forms', 'states'] }),
  link: entry([...simpleBoundaries, 'disabled-readonly', 'event'], {
    fixtureModes: ['states'],
  }),
  loading: entry(pluginBoundaries, { fixtureModes: ['states', 'overlays'] }),
  'markdown-renderer': entry(
    [...dataBoundaries, 'overflow-virtual', ...rawHtmlOptInBoundaries],
    {
      fixtureModes: ['data-boundaries'],
    },
  ),
  'markdown-editor': entry(
    [
      ...formBoundaries,
      'slot',
      'keyboard-focus',
      'overflow-virtual',
      ...rawHtmlOptInBoundaries,
    ],
    {
      fixtureModes: ['forms', 'data-boundaries'],
    },
  ),
  menu: entry([...simpleBoundaries, 'model-value', 'keyboard-focus', 'event'], {
    fixtureModes: ['overlays'],
  }),
  message: entry([...pluginBoundaries, ...rawHtmlOptInBoundaries], {
    fixtureModes: ['overlays'],
  }),
  'message-box': entry(
    [
      ...pluginBoundaries,
      'keyboard-focus',
      'teleport-popper',
      ...rawHtmlOptInBoundaries,
    ],
    {
      fixtureModes: ['overlays'],
    },
  ),
  notification: entry([...pluginBoundaries, ...rawHtmlOptInBoundaries], {
    fixtureModes: ['overlays'],
  }),
  overlay: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  'page-header': entry([...simpleBoundaries, 'event'], {
    fixtureModes: ['states'],
  }),
  pagination: entry([...formBoundaries, 'event'], {
    fixtureModes: ['data-boundaries'],
  }),
  popconfirm: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  popover: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  popper: entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  progress: entry([...simpleBoundaries, 'empty-null-undefined'], {
    fixtureModes: ['data-boundaries'],
  }),
  'public-shell': entry([...simpleBoundaries, 'event', 'overflow-virtual'], {
    fixtureModes: ['states'],
  }),
  radio: entry(formBoundaries, { fixtureModes: ['forms', 'states'] }),
  rate: entry([...formBoundaries, 'keyboard-focus'], {
    fixtureModes: ['forms'],
  }),
  'responsive-collection': entry([...dataBoundaries, 'overflow-virtual'], {
    fixtureModes: ['data-boundaries'],
  }),
  result: entry(simpleBoundaries, { fixtureModes: ['states'] }),
  'roving-focus-group': entry([
    'default-render',
    'event',
    'keyboard-focus',
    'unmount-cleanup',
  ]),
  row: entry([...simpleBoundaries, 'overflow-virtual'], {
    fixtureModes: ['data-boundaries'],
  }),
  scrollbar: entry([...dataBoundaries, 'event'], {
    fixtureModes: ['data-boundaries'],
  }),
  select: entry([...formBoundaries, 'loading-clearable', 'teleport-popper'], {
    fixtureModes: ['forms', 'states'],
  }),
  'select-v2': entry(
    [...formBoundaries, 'loading-clearable', 'overflow-virtual'],
    {
      fixtureModes: ['forms', 'data-boundaries'],
    },
  ),
  skeleton: entry([...simpleBoundaries, 'loading-clearable'], {
    fixtureModes: ['states', 'data-boundaries'],
  }),
  slider: entry([...formBoundaries, 'keyboard-focus'], {
    fixtureModes: ['forms'],
  }),
  slot: entry(['default-render', 'slot', 'unmount-cleanup']),
  space: entry([...simpleBoundaries, 'overflow-virtual'], {
    fixtureModes: ['states'],
  }),
  statistic: entry(dataBoundaries, { fixtureModes: ['data-boundaries'] }),
  steps: entry([...simpleBoundaries, 'props-state'], {
    fixtureModes: ['states'],
  }),
  switch: entry(formBoundaries, { fixtureModes: ['forms', 'states'] }),
  table: entry(dataBoundaries, { fixtureModes: ['data-boundaries'] }),
  'table-v2': entry([...dataBoundaries, 'overflow-virtual'], {
    fixtureModes: ['data-boundaries'],
  }),
  tabs: entry([...simpleBoundaries, 'model-value', 'keyboard-focus', 'event'], {
    fixtureModes: ['states'],
  }),
  tag: entry([...simpleBoundaries, 'event'], { fixtureModes: ['states'] }),
  teleport: entry(['default-render', 'teleport-popper', 'unmount-cleanup']),
  text: entry([...simpleBoundaries, 'empty-null-undefined'], {
    fixtureModes: ['states'],
  }),
  'theme-mode-toggle': entry([...formBoundaries, 'event'], {
    fixtureModes: ['states'],
  }),
  'time-picker': entry([...formBoundaries, 'teleport-popper'], {
    fixtureModes: ['forms', 'data-boundaries'],
  }),
  'time-select': entry([...formBoundaries, 'teleport-popper'], {
    fixtureModes: ['forms'],
  }),
  timeline: entry(dataBoundaries, { fixtureModes: ['data-boundaries'] }),
  tooltip: entry([...overlayBoundaries, ...rawHtmlOptInBoundaries], {
    fixtureModes: ['overlays'],
  }),
  'tooltip-v2': entry(overlayBoundaries, { fixtureModes: ['overlays'] }),
  transfer: entry([...formBoundaries, 'overflow-virtual'], {
    fixtureModes: ['forms'],
  }),
  tree: entry([...dataBoundaries, 'keyboard-focus'], {
    fixtureModes: ['data-boundaries'],
  }),
  'tree-select': entry(
    [...formBoundaries, 'overflow-virtual', 'teleport-popper'],
    {
      fixtureModes: ['forms', 'data-boundaries'],
    },
  ),
  'tree-v2': entry([...dataBoundaries, 'keyboard-focus', 'overflow-virtual'], {
    fixtureModes: ['data-boundaries'],
  }),
  upload: entry([...formBoundaries, 'loading-clearable', 'event'], {
    fixtureModes: ['forms', 'states'],
  }),
  'virtual-list': entry([...dataBoundaries, 'overflow-virtual'], {
    fixtureModes: ['data-boundaries'],
  }),
  'visual-hidden': entry(
    ['default-render', 'props-state', 'slot', 'unmount-cleanup'],
    {
      fixtureModes: ['states'],
    },
  ),
  watermark: entry(simpleBoundaries, { fixtureModes: ['states'] }),
}

export const groupedComponentCoverage: Record<string, string> = {
  aside: 'container',
  'breadcrumb-item': 'breadcrumb',
  'button-group': 'button',
  'carousel-item': 'carousel',
  'checkbox-button': 'checkbox',
  'checkbox-group': 'checkbox',
  'collapse-item': 'collapse',
  'descriptions-item': 'descriptions',
  'dropdown-item': 'dropdown',
  'dropdown-menu': 'dropdown',
  footer: 'container',
  'form-item': 'form',
  header: 'container',
  main: 'container',
  'menu-item': 'menu',
  'menu-item-group': 'menu',
  option: 'select',
  'option-group': 'select',
  'radio-button': 'radio',
  'radio-group': 'radio',
  step: 'steps',
  'sub-menu': 'menu',
  'tab-pane': 'tabs',
  'table-column': 'table',
  'timeline-item': 'timeline',
}
