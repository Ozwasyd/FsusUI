import type {
  MarkdownCodeLanguage,
  MarkdownFeatureRenderContext,
} from './markdown-runtime'
import type { FeatureRenderOutput } from './markdown-feature-output-gateway'
import { MarkdownRuntimeError } from './markdown-runtime-error'

export type MermaidRuntime = {
  initialize?: (options: Record<string, unknown>) => void
  render?: (
    id: string,
    source: string,
  ) => Promise<{ svg: string }> | { svg: string } | string
}

export type KatexRuntime = {
  renderToString?: (source: string, options: Record<string, unknown>) => string
}

type ShikiRenderOptions = {
  lang: string
  theme: string
}

export type ShikiRuntime = {
  codeToHtml?: (
    source: string,
    options: ShikiRenderOptions,
  ) => string | Promise<string>
  ensureLoaded?: (language: string, theme: string) => Promise<void>
}

type ShikiHighlighter = {
  codeToHtml: (
    source: string,
    options: ShikiRenderOptions,
  ) => string | Promise<string>
  loadLanguage?: (...languages: unknown[]) => Promise<void>
  loadTheme?: (...themes: unknown[]) => Promise<void>
}

type ShikiCoreModule = {
  createHighlighterCore?: (options: {
    engine: unknown
    langs: unknown[]
    themes: unknown[]
  }) => Promise<ShikiHighlighter>
  default?: ShikiCoreModule
}

type ShikiJavaScriptEngineModule = {
  createJavaScriptRegexEngine?: () => unknown
  default?: ShikiJavaScriptEngineModule
}

const resolveDefaultModule = <T>(module: T | { default?: T }) =>
  'default' in (module as Record<string, unknown>) &&
  (module as { default?: T }).default
    ? (module as { default: T }).default
    : (module as T)

let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null

export const loadMermaidRuntime = async () => {
  mermaidRuntimePromise ??= import('mermaid')
    .then((module) =>
      resolveDefaultModule<MermaidRuntime>(
        module as unknown as MermaidRuntime | { default?: MermaidRuntime },
      ),
    )
    .catch((error) => {
      mermaidRuntimePromise = null
      throw error
    })

  return mermaidRuntimePromise
}

export const loadKatexRuntime = async () =>
  resolveDefaultModule<KatexRuntime>(
    (await import('katex')) as unknown as
      | KatexRuntime
      | { default?: KatexRuntime },
  )

const shikiLanguageLoaders = {
  bash: () => import('shiki/dist/langs/bash.mjs'),
  'c#': () => import('shiki/dist/langs/csharp.mjs'),
  js: () => import('shiki/dist/langs/javascript.mjs'),
  ts: () => import('shiki/dist/langs/typescript.mjs'),
} satisfies Record<
  Exclude<MarkdownCodeLanguage, 'text'>,
  () => Promise<unknown>
>
const shikiThemeLoaders: Record<string, () => Promise<unknown>> = {
  'github-dark': () => import('shiki/dist/themes/github-dark.mjs'),
  'github-light': () => import('shiki/dist/themes/github-light.mjs'),
}
let shikiRuntimePromise: Promise<ShikiRuntime> | null = null

export const loadShikiRuntime = async () => {
  shikiRuntimePromise ??= (async (): Promise<ShikiRuntime> => {
    const [coreModule, engineModule] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ])
    const { createHighlighterCore } = resolveDefaultModule<ShikiCoreModule>(
      coreModule as ShikiCoreModule,
    )
    const { createJavaScriptRegexEngine } =
      resolveDefaultModule<ShikiJavaScriptEngineModule>(
        engineModule as ShikiJavaScriptEngineModule,
      )
    if (!createHighlighterCore || !createJavaScriptRegexEngine) {
      throw new MarkdownRuntimeError('infra', 'shiki_runtime_unavailable')
    }
    const highlighter = await createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [],
      themes: [],
    })
    const loadedLanguages = new Set<string>()
    const loadedThemes = new Set<string>()
    const pendingLanguages = new Map<string, Promise<void>>()
    const pendingThemes = new Map<string, Promise<void>>()
    const loadOne = async (
      key: string,
      loaders: Record<string, () => Promise<unknown>>,
      loaded: Set<string>,
      pending: Map<string, Promise<void>>,
      apply: ((...values: unknown[]) => Promise<void>) | undefined,
    ) => {
      if (loaded.has(key) || !apply) return
      const loader = loaders[key]
      if (!loader) return
      let promise = pending.get(key)
      if (!promise) {
        promise = loader()
          .then((module) => {
            const value = (module as { default?: unknown }).default ?? module
            return apply(...(Array.isArray(value) ? value : [value]))
          })
          .then(() => {
            loaded.add(key)
            pending.delete(key)
          })
          .catch((error) => {
            pending.delete(key)
            throw error
          })
        pending.set(key, promise)
      }
      await promise
    }

    return {
      codeToHtml: (source, options) => highlighter.codeToHtml(source, options),
      ensureLoaded: async (language, theme) => {
        await Promise.all([
          loadOne(
            language,
            shikiLanguageLoaders,
            loadedLanguages,
            pendingLanguages,
            highlighter.loadLanguage?.bind(highlighter),
          ),
          loadOne(
            theme,
            shikiThemeLoaders,
            loadedThemes,
            pendingThemes,
            highlighter.loadTheme?.bind(highlighter),
          ),
        ])
      },
    }
  })().catch((error) => {
    shikiRuntimePromise = null
    throw error
  })

  return shikiRuntimePromise
}
const renderShikiHtml = async (
  shiki: ShikiRuntime,
  source: string,
  language: string,
  theme: string,
) => {
  if (typeof shiki.codeToHtml !== 'function') {
    throw new MarkdownRuntimeError('infra', 'shiki_code_to_html_unavailable')
  }

  try {
    return await shiki.codeToHtml(source, { lang: language, theme })
  } catch (error) {
    if (language === 'text') throw error
    return shiki.codeToHtml(source, { lang: 'text', theme })
  }
}

export const renderCodeHighlightFeature = async (
  source: string,
  language: string,
  context: MarkdownFeatureRenderContext,
): Promise<FeatureRenderOutput> => {
  const theme = context.theme === 'dark' ? 'github-dark' : 'github-light'
  const shiki = await loadShikiRuntime()
  await shiki.ensureLoaded?.(language, theme)
  if (context.signal?.aborted) {
    throw new MarkdownRuntimeError('infra', 'shiki_render_aborted')
  }
  const payload = await renderShikiHtml(shiki, source, language, theme)
  if (context.signal?.aborted) {
    throw new MarkdownRuntimeError('infra', 'shiki_render_aborted')
  }
  return Object.freeze({ kind: 'code-highlight', payload })
}
