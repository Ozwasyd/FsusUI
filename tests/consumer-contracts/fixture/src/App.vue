<script setup lang="ts">
import {
  computed,
  createApp,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  type App,
  type InjectionKey,
} from 'vue'
import {
  createFsusUI,
  FsusAlert,
  FsusButton,
  FsusButtonGroup,
  FsusCard,
  FsusCheckTag,
  FsusConfigProvider,
  FsusCopyableDetail,
  FsusDataList,
  FsusDialog,
  FsusDropdown,
  FsusDropdownItem,
  FsusDropdownMenu,
  FsusForm,
  FsusFormItem,
  FsusIcon,
  FsusImageViewer,
  FsusInput,
  FsusMessage,
  FsusSegmentedControl,
  FsusSelect,
  FsusTabPane,
  FsusTabs,
  FsusTag,
  useFsusConfig,
  useFsusLocale,
  useFsusMessage,
  type FsusMessageService,
} from '@ozwasyd/fsusui'
import { FsusMarkdownRenderer } from '@ozwasyd/fsusui/markdown'
import {
  ensureWasmReady,
  initMarkdownRuntime,
  renderMarkdownResultWithRuntime,
} from '@ozwasyd/fsusui/wasm'
import { FsusIconArrowDown, FsusIconArrowLeft, FsusIconArrowRight } from '@ozwasyd/fsusui/icons'
import { en, zhCN } from '@ozwasyd/fsusui/locale'

const pathname = window.location.pathname
const params = new URLSearchParams(window.location.search)
const themeParam = params.get('theme') === 'dark' ? 'dark' : 'light'
const dirParam = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
const localeParam = params.get('locale') === 'zh-cn' ? 'zh-cn' : 'en'

const activeLocale = computed(() => (localeParam === 'zh-cn' ? zhCN : en))
const activeRoute = computed(() => {
  if (pathname.startsWith('/core')) return 'core'
  if (pathname.startsWith('/overlays')) return 'overlays'
  if (pathname.startsWith('/markdown')) return 'markdown'
  if (pathname.startsWith('/isolation')) return 'isolation'
  return 'home'
})

const selectedCommand = ref('stable')
const checkTagActive = ref(false)
const segmentValue = ref('all')
const selectedLanguage = ref<string | null>('en')
const emailValue = ref('')
const activeTab = ref('overview')
const dialogOpen = ref(false)
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerCloseCount = ref(0)

const wasmProbeStatus = ref('pending')
const wasmProbeHtml = ref('')
const wasmProbeEngine = ref('')

// #1151 & #1152 browser isolation harness (two independently installed Vue apps)
const ISOLATION_TENANT_KEY: InjectionKey<string> = Symbol('isolation-tenant')
const isoMountA = ref<HTMLElement | null>(null)
const isoMountB = ref<HTMLElement | null>(null)
const isoSummary = ref('')
const isoReproHostCountAfterUnmount = ref(-1)
let isoAppA: App | null = null
let isoAppB: App | null = null
let isoMsgA: FsusMessageService | null = null
let isoMsgB: FsusMessageService | null = null

const IsoMessageVNode = defineComponent({
  name: 'IsoMessageVNode',
  props: { label: { type: String, required: true } },
  setup(props) {
    const tenant = inject(ISOLATION_TENANT_KEY, 'missing')
    const cfg = useFsusConfig()
    const { t } = useFsusLocale()
    return () =>
      h(
        'span',
        { 'data-testid': `iso-msg-${tenant}` },
        `${props.label}|${tenant}|${cfg.value.size ?? 'none'}|${t('common.confirm')}`,
      )
  },
})

const mountIsolationApps = () => {
  if (!isoMountA.value || !isoMountB.value) return
  const RootProbe = defineComponent({
    name: 'IsoRootProbe',
    setup() {
      const tenant = inject(ISOLATION_TENANT_KEY, 'missing')
      const cfg = useFsusConfig()
      const { t } = useFsusLocale()
      return () =>
        h(
          'div',
          { 'data-testid': `iso-app-${tenant}` },
          `${tenant}:${cfg.value.size ?? 'none'}:${t('common.confirm')}`,
        )
    },
  })

  isoAppA = createApp(RootProbe)
  isoAppA.use(createFsusUI({ components: [], size: 'sm', locale: en }))
  isoAppA.provide(ISOLATION_TENANT_KEY, 'alpha')
  isoAppA.mount(isoMountA.value)
  isoMsgA = isoAppA.runWithContext(() => useFsusMessage())

  isoAppB = createApp(RootProbe)
  isoAppB.use(createFsusUI({ components: [], size: 'lg', locale: zhCN }))
  isoAppB.provide(ISOLATION_TENANT_KEY, 'beta')
  isoAppB.mount(isoMountB.value)
  isoMsgB = isoAppB.runWithContext(() => useFsusMessage())

  const cfgA = isoAppA.runWithContext(() => useFsusConfig())
  const cfgB = isoAppB.runWithContext(() => useFsusConfig())
  isoSummary.value = `${cfgA.value.size ?? 'none'}/${cfgB.value.size ?? 'none'}`
}

const isoShowA = () => {
  isoMsgA?.info({ message: h(IsoMessageVNode, { label: 'FromA' }), duration: 0 })
}

const isoShowB = () => {
  isoMsgB?.success({ message: h(IsoMessageVNode, { label: 'FromB' }), duration: 0 })
}

const isoCloseAllA = () => {
  isoMsgA?.closeAll()
}

const isoUnmountA = () => {
  isoAppA?.unmount()
  isoAppA = null
}

const isoUnmountB = () => {
  isoAppB?.unmount()
  isoAppB = null
}

const runIssue1152ReproCycle = () => {
  const mp = document.createElement('div')
  document.body.appendChild(mp)
  const tempApp = createApp({
    setup() {
      onMounted(() => {
        FsusMessage({ message: 'Message from application A', duration: 0 })
      })
      return () => null
    },
  })
  tempApp.use(createFsusUI({ components: [] }))
  tempApp.mount(mp)
  tempApp.unmount()
  mp.remove()
  isoReproHostCountAfterUnmount.value = document.querySelectorAll('[data-fsus-message-host]').length
}

onBeforeUnmount(() => {
  isoAppA?.unmount()
  isoAppB?.unmount()
})
const markdownContent = [
  '# Draft milestone',
  '',
  'Native Markdown rendering and packaged worker verification.',
  '',
  ...Array.from({ length: 1800 }, (_, i) => `- Section ${i + 1}: FsusUI preview 2 packaged worker verification payload line with steady prose.`),
].join('\n')

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
]

const galleryImages = ['/images/fig-1.svg', '/images/fig-2.svg', '/images/fig-3.svg']
const segmentOptions = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
]

const handleCommand = (command: string | number | undefined) => {
  if (command !== undefined) selectedCommand.value = String(command)
}

const handleViewerClose = () => {
  viewerOpen.value = false
  viewerCloseCount.value += 1
}

onMounted(async () => {
  const root = document.documentElement
  root.dir = dirParam
  root.dataset.fsusTheme = themeParam
  root.classList.toggle('dark', themeParam === 'dark')
  root.classList.toggle('light', themeParam === 'light')

  if (activeRoute.value === 'isolation') {
    mountIsolationApps()
  }

  if (activeRoute.value === 'markdown') {
    const core = await ensureWasmReady()
    const md = await initMarkdownRuntime()
    const rendered = await renderMarkdownResultWithRuntime('# Preview baseline')
    if (core.ok && md.ok && rendered.ok) {
      wasmProbeStatus.value = 'ok'
      wasmProbeEngine.value = rendered.value.engine
      wasmProbeHtml.value = rendered.value.html
    } else {
      wasmProbeStatus.value = `error:${JSON.stringify({ core, md, rendered })}`
    }
  }
})
</script>

<template>
  <FsusConfigProvider :locale="activeLocale" :theme-mode="themeParam">
    <main class="contract-shell" :data-contract-route="activeRoute" data-contract-ready="true">
      <section v-if="activeRoute === 'core'" data-testid="core-contract">
        <div class="contract-toolbar">
          <FsusDropdown trigger="click" @command="handleCommand">
            <FsusButton variant="primary" data-testid="dropdown-trigger">
              Release channel
              <FsusIcon class="fsus-icon--right"><FsusIconArrowDown /></FsusIcon>
            </FsusButton>
            <template #dropdown>
              <FsusDropdownMenu data-testid="dropdown-menu">
                <FsusDropdownItem command="stable" data-testid="cmd-stable">Stable</FsusDropdownItem>
                <FsusDropdownItem command="preview" data-testid="cmd-preview">Preview</FsusDropdownItem>
                <FsusDropdownItem command="archived" disabled data-testid="cmd-archived">Archived</FsusDropdownItem>
                <FsusDropdownItem command="next" divided data-testid="cmd-next">Next</FsusDropdownItem>
              </FsusDropdownMenu>
            </template>
          </FsusDropdown>

          <FsusButton data-testid="outside-button">Outside focus target</FsusButton>

          <FsusButtonGroup data-testid="button-group">
            <FsusButton variant="primary" :icon="FsusIconArrowLeft">Prev</FsusButton>
            <FsusButton variant="primary">
              Next<FsusIcon class="fsus-icon--right"><FsusIconArrowRight /></FsusIcon>
            </FsusButton>
          </FsusButtonGroup>

          <FsusCheckTag v-model:checked="checkTagActive" data-testid="check-tag">
            Pinned filter
          </FsusCheckTag>
        </div>

        <FsusSegmentedControl
          v-model="segmentValue"
          :options="segmentOptions"
          data-testid="segmented-control"
        />

        <FsusDataList data-testid="data-list">
          <FsusCard header="Release Status">
            <FsusTag tone="info">v2.0.0</FsusTag>
            <FsusAlert title="Pure ESM consumer contract" tone="success" />
          </FsusCard>
        </FsusDataList>

        <FsusForm data-testid="a11y-form">
          <FsusFormItem label="Language">
            <FsusSelect v-model="selectedLanguage" :options="languageOptions" data-testid="language-select" />
          </FsusFormItem>
          <FsusFormItem label="Contact Email">
            <FsusInput
              id="contact-email"
              v-model="emailValue"
              aria-describedby="email-hint"
              required
              inputmode="email"
              data-testid="contact-email-input"
            />
            <template #help>
              <span id="email-hint">Work email</span>
            </template>
          </FsusFormItem>
        </FsusForm>

        <FsusTabs v-model="activeTab" data-testid="a11y-tabs">
          <FsusTabPane name="overview" label="Overview">
            <p data-testid="tab-overview-body">Overview content</p>
          </FsusTabPane>
          <FsusTabPane name="details" label="Details">
            <p data-testid="tab-details-body">Details content</p>
          </FsusTabPane>
        </FsusTabs>

        <FsusCopyableDetail label="API Token" value="fsus-preview-token" data-testid="copyable-detail" />

        <div class="contract-status">
          <span data-testid="selected-command">{{ selectedCommand }}</span>
          <span data-testid="check-tag-state">{{ String(checkTagActive) }}</span>
          <span data-testid="segment-state">{{ segmentValue }}</span>
        </div>
      </section>

      <section v-else-if="activeRoute === 'overlays'" data-testid="overlays-contract">
        <div class="contract-toolbar">
          <FsusButton variant="primary" data-testid="open-dialog-btn" @click="dialogOpen = true">
            Open dialog
          </FsusButton>
          <FsusButton variant="secondary" data-testid="open-viewer-btn" @click="viewerOpen = true">
            Open image viewer
          </FsusButton>
        </div>

        <FsusDialog v-model:open="dialogOpen" title="Confirm preview release">
          <p data-testid="dialog-body">Verify immutable candidate before publishing.</p>
          <template #footer>
            <FsusButton data-testid="dialog-cancel-btn" @click="dialogOpen = false">Cancel</FsusButton>
            <FsusButton variant="primary" data-testid="dialog-confirm-btn" @click="dialogOpen = false">
              Confirm
            </FsusButton>
          </template>
        </FsusDialog>

        <FsusImageViewer
          v-if="viewerOpen"
          :url-list="galleryImages"
          :initial-index="viewerIndex"
          @switch="(idx: number) => (viewerIndex = idx)"
          @close="handleViewerClose"
        />

        <div class="contract-status">
          <span data-testid="dialog-open-state">{{ String(dialogOpen) }}</span>
          <span data-testid="viewer-open-state">{{ String(viewerOpen) }}</span>
          <span data-testid="viewer-index-state">{{ viewerIndex }}</span>
          <span data-testid="viewer-close-count">{{ viewerCloseCount }}</span>
        </div>
      </section>

      <section v-else-if="activeRoute === 'markdown'" data-testid="markdown-contract">
        <div data-testid="wasm-probe-status">{{ wasmProbeStatus }}</div>
        <div data-testid="wasm-probe-engine">{{ wasmProbeEngine }}</div>
        <div data-testid="wasm-probe-html">{{ wasmProbeHtml }}</div>
        <FsusMarkdownRenderer :content="markdownContent" data-testid="markdown-renderer" />
      </section>

      <section v-else-if="activeRoute === 'isolation'" data-testid="isolation-contract">
        <div ref="isoMountA"></div>
        <div ref="isoMountB"></div>
        <div data-testid="iso-config-summary">{{ isoSummary }}</div>
        <div data-testid="iso-repro-hosts">{{ isoReproHostCountAfterUnmount }}</div>
        <div class="contract-toolbar">
          <FsusButton data-testid="iso-show-a" @click="isoShowA">Show A</FsusButton>
          <FsusButton data-testid="iso-show-b" @click="isoShowB">Show B</FsusButton>
          <FsusButton data-testid="iso-close-all-a" @click="isoCloseAllA">Close All A</FsusButton>
          <FsusButton data-testid="iso-unmount-a" @click="isoUnmountA">Unmount A</FsusButton>
          <FsusButton data-testid="iso-unmount-b" @click="isoUnmountB">Unmount B</FsusButton>
          <FsusButton data-testid="iso-run-repro" @click="runIssue1152ReproCycle">Run Repro</FsusButton>
        </div>
      </section>

      <section v-else>
        <h1>FsusUI 2.0 Public API Consumer Contract Fixture</h1>
        <nav aria-label="Contract routes">
          <ul>
            <li><a href="/core">Core &amp; Dropdown contract</a></li>
            <li><a href="/overlays">Dialog &amp; ImageViewer contract</a></li>
            <li><a href="/ssr/closed">SSR + Strict CSP contract</a></li>
          </ul>
        </nav>
      </section>
    </main>
  </FsusConfigProvider>
</template>
