import FsusUI, {
  FsusLoadingService,
  FsusMessage,
  FsusMessageBox,
  FsusNotification,
  en,
  normalizeThemeMode,
  zhCN,
  type FsusLocale,
  type ThemeMode,
} from '@ozwasyd/fsusui'
import { registerFsusDefaultRenderPipelineComponentPolicies } from '@ozwasyd/fsusui/render-pipeline'
import { demoComponents } from './demo-components'

import type { App, Component } from 'vue'

const demoLocales: readonly FsusLocale[] = [zhCN, en]

const normalizeLanguageTag = (language: string) =>
  language.trim().toLowerCase().replaceAll('_', '-')

const getBrowserLanguages = () => {
  if (typeof navigator === 'undefined') return []
  if (navigator.languages.length > 0) return [...navigator.languages]
  return navigator.language ? [navigator.language] : []
}

export const resolveDemoLocale = (
  preferredLanguages = getBrowserLanguages(),
): FsusLocale => {
  for (const language of preferredLanguages) {
    const normalized = normalizeLanguageTag(language)
    const exactMatch = demoLocales.find(
      (locale) => normalizeLanguageTag(locale.name) === normalized,
    )
    if (exactMatch) return exactMatch
    if (normalized.startsWith('zh')) return zhCN
    if (normalized.startsWith('en')) return en
  }
  return zhCN
}

export const createDemoContract = (
  themeMode: ThemeMode,
  locale = resolveDemoLocale(),
) =>
  ({
    install(app: App) {
      app.use(FsusUI, { themeMode, locale })
      registerFsusDefaultRenderPipelineComponentPolicies(
        Object.values(demoComponents),
      )
      for (const [name, component] of Object.entries(demoComponents)) {
        if (!app.component(name)) {
          app.component(name, component)
        }
      }
    },
    components: demoComponents,
    services: {
      loading: FsusLoadingService,
      message: FsusMessage,
      messageBox: FsusMessageBox,
      notification: FsusNotification,
    },
  }) as const

export type DemoRootOptions = {
  component: Component
  themeMode: ThemeMode
  props?: Record<string, unknown>
}

export const resolveDemoRoot = async (
  searchParams: URLSearchParams,
): Promise<DemoRootOptions> => {
  const themeMode = normalizeThemeMode(searchParams.get('theme'), 'system')
  const visualMode = searchParams.get('visual') || ''

  if (searchParams.get('interactionTrace') === '1') {
    const { default: InteractionTraceFixture } =
      await import('./InteractionTraceFixture.vue')
    return { component: InteractionTraceFixture, themeMode }
  }

  if (visualMode === 'view-transitions') {
    const { default: ViewTransitionSection } =
      await import('./sections/ViewTransitionSection.vue')
    return { component: ViewTransitionSection, themeMode }
  }

  const performanceScenario = searchParams.get('performance')
  if (
    performanceScenario === 'markdown-feature-activation' ||
    performanceScenario === 'markdown-heavy-feature-lifecycle'
  ) {
    const { default: MarkdownFeatureFixture } =
      await import('./MarkdownFeatureFixture.vue')
    return {
      component: MarkdownFeatureFixture,
      themeMode,
      props: {
        scenario: performanceScenario,
        motion: searchParams.get('motion') || 'enabled',
      },
    }
  }

  const auditMode = searchParams.get('audit')
  if (auditMode === 'drawer-safe-area') {
    const { default: DrawerSafeAreaFixture } =
      await import('./DrawerSafeAreaFixture.vue')
    const rawDirection = searchParams.get('direction')
    const direction =
      rawDirection === 'rtl' ||
      rawDirection === 'ttb' ||
      rawDirection === 'btt'
        ? rawDirection
        : 'ltr'
    return {
      component: DrawerSafeAreaFixture,
      themeMode,
      props: {
        direction,
        size: searchParams.get('size') || 'min(86vw, 22rem)',
        destroyOnClose: searchParams.get('destroy') === 'true',
      },
    }
  }

  if (auditMode === 'ui-states' || auditMode === 'ui-boundaries') {
    const { default: AuditFixtures } = await import('./AuditFixtures.vue')
    return {
      component: AuditFixtures,
      themeMode,
      props: {
        boundary: auditMode === 'ui-boundaries',
        theme: themeMode,
        compact: searchParams.get('compact') === '1',
        state: searchParams.get('state') || 'focus',
      },
    }
  }

  if (searchParams.get('collapse') === '1') {
    const { default: CollapseFixture } = await import('./CollapseFixture.vue')
    return { component: CollapseFixture, themeMode }
  }
  if (searchParams.get('checktag') === '1') {
    const { default: CheckTagFixture } = await import('./CheckTagFixture.vue')
    return { component: CheckTagFixture, themeMode }
  }
  if (searchParams.get('avatar') === '1') {
    const { default: AvatarFixture } = await import('./AvatarFixture.vue')
    return { component: AvatarFixture, themeMode }
  }
  if (searchParams.get('checkboxbutton') === '1') {
    const { default: CheckboxButtonFixture } = await import('./CheckboxButtonFixture.vue')
    return { component: CheckboxButtonFixture, themeMode }
  }

  const { default: App } = await import('./App.vue')
  return {
    component: App,
    themeMode,
    props: {
      mode: visualMode,
      theme: themeMode,
      compact: searchParams.get('compact') === '1',
      cspSafe: searchParams.get('cspSafe') === '1',
      navMode: searchParams.get('navMode') || 'menu',
      searchMode: searchParams.get('searchMode') || 'inline',
    },
  }
}
