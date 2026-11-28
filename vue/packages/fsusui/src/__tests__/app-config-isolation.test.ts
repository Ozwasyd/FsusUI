import { createApp, createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createFsusUI,
  en,
  FsusButton,
  FsusConfigProvider,
  getFsusGlobalConfig,
  setFsusGlobalConfig,
  useFsusConfig,
  useFsusLocale,
  zhCN,
} from '../index'

const createMountPoint = () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('#1151 createFsusUI application-owned configuration isolation', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
    // Reset explicit global fallback state without affecting app-scoped tests
    setFsusGlobalConfig({ size: undefined, locale: undefined, zIndex: undefined })
  })

  it('passes the exact #1151 public-API reproduction fixture', () => {
    const root = { render: () => null }
    const appA = createApp(root)
    appA.use(createFsusUI({ components: [], size: 'sm' }))
    const configA = appA.runWithContext(() => useFsusConfig())
    const before = configA.value.size

    const appB = createApp(root)
    appB.use(createFsusUI({ components: [], size: 'lg' }))
    const configB = appB.runWithContext(() => useFsusConfig())

    expect({ before, after: configA.value.size, appB: configB.value.size }).toEqual({
      before: 'sm',
      after: 'sm',
      appB: 'lg',
    })
  })

  it('keeps two mounted apps with different sizes and locales isolated regardless of installation order', async () => {
    const SampleView = defineComponent({
      name: 'SampleView',
      setup() {
        const { t } = useFsusLocale()
        return () =>
          h('div', [
            h(FsusButton, {}, () => t('common.confirm')),
          ])
      },
    })

    for (const order of ['AB', 'BA'] as const) {
      const mountA = createMountPoint()
      const mountB = createMountPoint()

      const appA = createApp(SampleView)
      const appB = createApp(SampleView)

      if (order === 'AB') {
        appA.use(createFsusUI({ components: [], size: 'sm', locale: en }))
        appB.use(createFsusUI({ components: [], size: 'lg', locale: zhCN }))
      } else {
        appB.use(createFsusUI({ components: [], size: 'lg', locale: zhCN }))
        appA.use(createFsusUI({ components: [], size: 'sm', locale: en }))
      }

      appA.mount(mountA)
      appB.mount(mountB)
      cleanups.push(() => {
        appA.unmount()
        appB.unmount()
        mountA.remove()
        mountB.remove()
      })

      // Mutating module-level fallback must never bleed into installed apps
      setFsusGlobalConfig({ size: 'md', locale: zhCN })
      await nextTick()

      const btnA = mountA.querySelector('.fsus-button')
      const btnB = mountB.querySelector('.fsus-button')
      expect(btnA?.getAttribute('data-size')).toBe('sm')
      expect(btnA?.textContent?.trim()).toBe(en.common.confirm)
      expect(btnB?.getAttribute('data-size')).toBe('lg')
      expect(btnB?.textContent?.trim()).toBe(zhCN.common.confirm)
    }
  })

  it('nested FsusConfigProvider inherits only its owning app defaults and preserves reactive local overrides', async () => {
    setFsusGlobalConfig({ size: 'lg', zIndex: 9999 })

    const localSize = ref<'sm' | 'md' | 'lg'>('lg')
    const observedA = ref<{ size?: string; localeName?: string; zIndex?: number }>({})
    const observedB = ref<{ size?: string; localeName?: string; zIndex?: number }>({})

    const Reader = defineComponent({
      props: {
        onRead: { type: Function, required: true },
      },
      setup(props) {
        const cfg = useFsusConfig()
        const { locale } = useFsusLocale()
        return () => {
          props.onRead({
            size: cfg.value.size,
            localeName: locale.value.name,
            zIndex: cfg.value.zIndex,
          })
          return h('span', `${cfg.value.size ?? 'none'}:${locale.value.name}:${cfg.value.zIndex ?? 'none'}`)
        }
      },
    })

    const mountA = createMountPoint()
    const mountB = createMountPoint()

    // App A sets locale: en and zIndex: 3100, omits size; nested provider overrides only size
    const appA = createApp({
      render: () =>
        h(FsusConfigProvider, { size: localSize.value }, () =>
          h(Reader, { onRead: (val: any) => (observedA.value = val) }),
        ),
    })
    appA.use(createFsusUI({ components: [], locale: en, zIndex: 3100 }))

    // App B installs empty defaults; nested provider overrides only locale: en
    // It must NOT inherit globalConfig's size: 'lg' or zIndex: 9999 or App A's zIndex: 3100
    const appB = createApp({
      render: () =>
        h(FsusConfigProvider, { locale: en }, () =>
          h(Reader, { onRead: (val: any) => (observedB.value = val) }),
        ),
    })
    appB.use(createFsusUI({ components: [] }))

    appA.mount(mountA)
    appB.mount(mountB)
    cleanups.push(() => {
      appA.unmount()
      appB.unmount()
      mountA.remove()
      mountB.remove()
    })

    expect(observedA.value).toEqual({ size: 'lg', localeName: 'en', zIndex: 3100 })
    expect(observedB.value).toEqual({ size: undefined, localeName: 'en', zIndex: undefined })

    localSize.value = 'sm'
    await nextTick()
    expect(observedA.value).toEqual({ size: 'sm', localeName: 'en', zIndex: 3100 })
    expect(observedB.value).toEqual({ size: undefined, localeName: 'en', zIndex: undefined })
  })

  it('isolates separate createSSRApp instances across sequential and interleaved renders', async () => {
    const SyncLeaf = defineComponent({
      setup() {
        const cfg = useFsusConfig()
        const { t } = useFsusLocale()
        return () =>
          h(FsusButton, {}, () => `${cfg.value.size}:${t('common.confirm')}`)
      },
    })

    const AsyncLabel = defineComponent({
      props: { delayMs: { type: Number, default: 0 } },
      async setup(props) {
        const cfg = useFsusConfig()
        const { t } = useFsusLocale()
        await new Promise((resolve) => setTimeout(resolve, props.delayMs))
        return () =>
          h('div', { 'data-size': cfg.value.size ?? 'none' }, [
            h('span', `${cfg.value.size}:${t('common.confirm')}`),
            h(SyncLeaf),
          ])
      },
    })

    const makeSsrApp = (size: 'sm' | 'lg', locale: typeof en | typeof zhCN, delayMs: number) => {
      const app = createSSRApp({
        render: () => h(AsyncLabel, { delayMs }),
      })
      app.use(createFsusUI({ components: [], size, locale }))
      return app
    }

    // Sequential
    const seqA = await renderToString(makeSsrApp('sm', en, 0))
    const seqB = await renderToString(makeSsrApp('lg', zhCN, 0))
    expect(seqA).toContain(`data-size="sm"`)
    expect(seqA).toContain(`sm:${en.common.confirm}`)
    expect(seqB).toContain(`data-size="lg"`)
    expect(seqB).toContain(`lg:${zhCN.common.confirm}`)

    // Interleaved (App A yields longer than App B so B installs and finishes while A is in-flight)
    const [interleavedA, interleavedB] = await Promise.all([
      renderToString(makeSsrApp('sm', en, 20)),
      renderToString(makeSsrApp('lg', zhCN, 5)),
    ])
    expect(interleavedA).toContain(`data-size="sm"`)
    expect(interleavedA).toContain(`sm:${en.common.confirm}`)
    expect(interleavedB).toContain(`data-size="lg"`)
    expect(interleavedB).toContain(`lg:${zhCN.common.confirm}`)
  })

  it('unmounting one app does not reset or mutate another app configuration', async () => {
    const mountA = createMountPoint()
    const mountB = createMountPoint()
    const counter = ref(0)

    const View = defineComponent({
      setup() {
        const cfg = useFsusConfig()
        const { t } = useFsusLocale()
        return () =>
          h(FsusButton, { 'data-tick': counter.value }, () => `${cfg.value.size}:${t('common.cancel')}`)
      },
    })

    const appA = createApp(View)
    appA.use(createFsusUI({ components: [], size: 'sm', locale: en }))
    const appB = createApp(View)
    appB.use(createFsusUI({ components: [], size: 'lg', locale: zhCN }))

    appA.mount(mountA)
    appB.mount(mountB)
    cleanups.push(() => {
      appB.unmount()
      mountB.remove()
    })

    appA.unmount()
    mountA.remove()

    counter.value += 1
    await nextTick()

    const configB = appB.runWithContext(() => useFsusConfig())
    expect(configB.value.size).toBe('lg')
    expect(configB.value.locale).toBe(zhCN)
    expect(mountB.querySelector('.fsus-button')?.getAttribute('data-size')).toBe('lg')
    expect(mountB.textContent).toContain(`lg:${zhCN.common.cancel}`)
  })

  it('isolates runtime options when one createFsusUI plugin instance is reused across apps', () => {
    const plugin = createFsusUI({ components: [], size: 'md', zIndex: 2100 })
    const appA = createApp({ render: () => null })
    const appB = createApp({ render: () => null })

    appA.use(plugin, { size: 'sm' })
    appB.use(plugin, { size: 'lg', zIndex: 4200 })

    expect(appA.runWithContext(() => useFsusConfig()).value).toEqual({ size: 'sm', zIndex: 2100 })
    expect(appB.runWithContext(() => useFsusConfig()).value).toEqual({ size: 'lg', zIndex: 4200 })
  })

  it('keeps setFsusGlobalConfig as an explicit fallback only when no plugin or provider owns config', () => {
    const before = getFsusGlobalConfig()
    const installedApp = createApp({ render: () => null })
    installedApp.use(createFsusUI({ components: [], size: 'sm' }))
    expect(getFsusGlobalConfig()).toEqual(before)

    setFsusGlobalConfig({ size: 'lg', locale: en })
    const standaloneApp = createApp({ render: () => null })
    const standaloneCfg = standaloneApp.runWithContext(() => useFsusConfig())
    expect(standaloneCfg.value.size).toBe('lg')
    expect(standaloneCfg.value.locale).toBe(en)
    expect(installedApp.runWithContext(() => useFsusConfig()).value.size).toBe('sm')
  })
})
