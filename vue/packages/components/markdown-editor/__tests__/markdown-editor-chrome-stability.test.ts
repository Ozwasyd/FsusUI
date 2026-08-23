import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownEditorChromeStabilityMutations,
  listMarkdownEditorChromeModeCombinations,
  planMarkdownEditorChromeSwitch,
  resolveMarkdownEditorChromeGeometry,
} from '../src/markdown-editor-chrome-stability'

const here = dirname(fileURLToPath(import.meta.url))
const vue = readFileSync(resolve(here, '../src/markdown-editor.vue'), 'utf8')
const scss = readFileSync(
  resolve(here, '../../../theme-chalk/src/markdown-editor.scss'),
  'utf8',
)

describe('markdown editor chrome/mode geometry stability', () => {
  it('covers twelve chrome×mode combinations with one scroll container and no second surface', () => {
    const combinations = listMarkdownEditorChromeModeCombinations()
    expect(combinations).toHaveLength(12)
    for (const geometry of combinations) {
      expect(geometry.instanceKey).toBe('document')
      expect(geometry.scrollContainer).toBe('body')
      expect(geometry.secondDocumentSurface).toBe(false)
      expect(geometry.focusRing).toBe('control-focus-visible')
      expect(geometry.previewAccessibleName).toBe(true)
      expect(geometry.dualLiveOverlay).toBe(false)
      if (geometry.chrome === 'minimal') {
        expect(geometry.emptyMinimalHeight).toBe(false)
        expect(geometry.rootBorder).toBe(false)
        expect(geometry.toolbar).toBe(false)
      }
      if (geometry.chrome === 'embedded') {
        expect(geometry.rootBorder).toBe(false)
      }
      if (geometry.mode === 'split') expect(geometry.splitSeparator).toBe(true)
      if (geometry.mode === 'live') expect(geometry.rendererVisible).toBe(false)
    }
    expect(resolveMarkdownEditorChromeGeometry('framed', 'source').rootBorder).toBe(true)
  })

  it('keeps instance, selection, history, scroll, and epoch across chrome/mode switches', () => {
    const before = {
      instanceId: 'editor-1',
      epoch: 4,
      selection: { start: 3, end: 7, direction: 'backward' },
      history: { undoDepth: 2, redoDepth: 1 },
      scrollTop: 48,
    }
    const switched = planMarkdownEditorChromeSwitch(before, {
      chrome: 'minimal',
      mode: 'preview',
    })
    expect(switched.rebuilt).toBe(false)
    expect(switched.instanceId).toBe('editor-1')
    expect(switched.epoch).toBe(4)
    expect(switched.selection).toEqual(before.selection)
    expect(switched.history).toEqual(before.history)
    expect(switched.scrollTop).toBe(48)
    expect(vue).toMatch(/<section\b/)
    expect(vue).not.toMatch(/<section\b[^>]*\bv-if\b/)
    expect(vue).toMatch(/data-markdown-instance/)
    expect(vue).toMatch(/data-markdown-scroll-container="body"/)
    expect(scss).toMatch(/chrome-embedded/)
    expect(scss).toMatch(/chrome-minimal/)
  })

  it('kills root v-if rebuild, live dual scroll, separator cards, and border-dependent focus', () => {
    const report = evaluateMarkdownEditorChromeStabilityMutations({ vue, scss })
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'root-vif-rebuild',
      'dual-scroll-container',
      'separator-card',
      'border-dependent-focus',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted, mutation.kind).toBe(false)
      expect(mutation.equivalent, mutation.kind).toBe(false)
    }
  })
})
