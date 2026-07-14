import ElementPlus, {
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification,
  ElOverlay,
  ElPopperArrow,
  ElPopperContent,
  ElPopperTrigger,
  normalizeThemeMode,
  registerFsusDefaultRenderPipelineComponentPolicies,
} from '../../element-plus'
import * as localeLanguages from '../../locale'
import { demoComponents } from './demo-components'

import type { App, Component } from 'vue'
import type { Language } from '../../locale'
import type { ThemeMode } from '../../element-plus'

const demoLocales = (Object.values(localeLanguages) as unknown[]).filter(
  (locale): locale is Language =>
    typeof locale === 'object' &&
    locale !== null &&
    typeof (locale as Language).name === 'string',
)

const normalizeLanguageTag = (language: string) =>
  language.trim().toLowerCase().replaceAll('_', '-')

const getBrowserLanguages = () => {
  if (typeof navigator === 'undefined') return []

  if (navigator.languages.length > 0) {
    return [...navigator.languages]
  }

  return navigator.language ? [navigator.language] : []
}

export const resolveDemoLocale = (
  preferredLanguages = getBrowserLanguages(),
) => {
  for (const language of preferredLanguages) {
    const normalized = normalizeLanguageTag(language)
    const exactMatch = demoLocales.find(
      (locale) => normalizeLanguageTag(locale.name) === normalized,
    )

    if (exactMatch) return exactMatch

    if (normalized.startsWith('zh')) {
      const chineseLocale = /-(tw|hk|mo|hant)\b/.test(normalized)
        ? 'zh-tw'
        : 'zh-cn'
      const locale = demoLocales.find(
        (item) => normalizeLanguageTag(item.name) === chineseLocale,
      )

      if (locale) return locale
    }

    const baseLanguage = normalized.split('-')[0]
    const baseMatch = demoLocales.find((locale) => {
      const localeName = normalizeLanguageTag(locale.name)
      return (
        localeName === baseLanguage || localeName.startsWith(`${baseLanguage}-`)
      )
    })

    if (baseMatch) return baseMatch
  }

  return undefined
}

export const createDemoContract = (
  themeMode: ThemeMode,
  locale = resolveDemoLocale(),
) =>
  ({
    install(app: App) {
      app.use(ElementPlus, { themeMode, locale })
      registerFsusDefaultRenderPipelineComponentPolicies(
        Object.values(demoComponents),
      )
      for (const [name, component] of Object.entries(demoComponents)) {
        if (!app.component(name)) {
          app.component(name, component as Component)
        }
      }
    },
    components: demoComponents,
    services: {
      loading: ElLoading,
      message: ElMessage,
      messageBox: ElMessageBox,
      notification: ElNotification,
    },
    rawPopper: {
      Overlay: ElOverlay,
      Arrow: ElPopperArrow,
      Content: ElPopperContent,
      Trigger: ElPopperTrigger,
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
  const performanceScenario = searchParams.get('performance')

  if (performanceScenario) {
    const { default: PerformanceFixture } =
      await import('./PerformanceFixture.vue')
    return {
      component: PerformanceFixture,
      themeMode,
      props: {
        scenario: performanceScenario,
        size: Number(searchParams.get('size') || 1_000_000),
        motion: searchParams.get('motion') || 'enabled',
      },
    }
  }
  const auditMode = searchParams.get('audit')

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

  const { default: App } = await import('./App.vue')
  return {
    component: App,
    themeMode,
    props: {
      mode: searchParams.get('visual') || '',
      theme: themeMode,
      compact: searchParams.get('compact') === '1',
      navMode: searchParams.get('navMode') || 'menu',
    },
  }
}
