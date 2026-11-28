import { computed, ref, type PropType } from 'vue'
import { useFsusConfig } from '@fsusui/core'
import { markdownEditorLocaleEn } from './locale-en'

export * from '@fsusui/core/render-pipeline'
export * from '../hooks/use-markdown-editor-frame-scheduler'
export * from '../hooks/use-markdown-heavy-feature-lifecycle'

export const UPDATE_MODEL_EVENT = 'update:modelValue'
export const CHANGE_EVENT = 'change'

export const definePropType = <T>(val: any): PropType<T> => val
export const buildProps = <T extends Record<string, any>>(props: T): T => props

export interface TranslatePair {
  [key: string]: string | string[] | TranslatePair
}

export interface Language {
  name: string
  el: TranslatePair
}

export const defaultMarkdownLanguage = {
  name: 'en',
  el: {
    markdownEditor: markdownEditorLocaleEn,
  },
} as const

const getNested = (obj: Record<string, any>, path: string): unknown => {
  let cur: any = obj
  for (const key of path.split('.')) {
    if (cur == null) return undefined
    cur = cur[key]
  }
  return cur
}

export const useLocale = () => {
  const locale = computed<Language>(() => defaultMarkdownLanguage)
  const lang = computed(() => locale.value.name)
  const t = (path: string, option?: Record<string, string | number>): string => {
    const raw = getNested(locale.value, path)
    if (typeof raw !== 'string') return path
    if (!option) return raw
    return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
      option[k] !== undefined ? String(option[k]) : `{${k}}`,
    )
  }
  return { lang, locale, t }
}

/**
 * Native FsusUI 2.0 static `fsus-` namespace helper for the migrated Markdown surfaces.
 */
export const useNamespace = (block: string) => {
  const ns = 'fsus'
  const namespace = ref(ns)
  const b = (suffix = '') => (suffix ? `${ns}-${block}-${suffix}` : `${ns}-${block}`)
  const e = (el?: string) => (el ? `${ns}-${block}__${el}` : '')
  const m = (mod?: string) => (mod ? `${ns}-${block}--${mod}` : '')
  const be = (suffix?: string, el?: string) => (suffix && el ? `${ns}-${block}-${suffix}__${el}` : '')
  const em = (el?: string, mod?: string) => (el && mod ? `${ns}-${block}__${el}--${mod}` : '')
  const bm = (suffix?: string, mod?: string) => (suffix && mod ? `${ns}-${block}-${suffix}--${mod}` : '')
  const bem = (suffix?: string, el?: string, mod?: string) =>
    suffix && el && mod ? `${ns}-${block}-${suffix}__${el}--${mod}` : ''
  const is = (name: string, state: boolean | undefined = true) => (name && state ? `is-${name}` : '')
  const cssVarName = (name: string) => `--${ns}-${name}`
  const cssVarBlockName = (name: string) => `--${ns}-${block}-${name}`
  const cssVar = (obj: Record<string, string>) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) if (v) out[`--${ns}-${k}`] = v
    return out
  }
  const cssVarBlock = (obj: Record<string, string>) => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) if (v) out[`--${ns}-${block}-${k}`] = v
    return out
  }
  return { namespace, b, e, m, be, em, bm, bem, is, cssVar, cssVarBlock, cssVarName, cssVarBlockName }
}

export const useGlobalConfig = (key?: string) => {
  const cfg = useFsusConfig()
  return computed(() => (key ? (cfg.value as Record<string, any>)[key] : cfg.value))
}
