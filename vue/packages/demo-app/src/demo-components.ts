import { fsusComponents } from '@fsusui/components'
import { FsusMarkdownEditor, FsusMarkdownRenderer } from '@fsusui/markdown'
import { FsusIcon } from '@fsusui/icons'
import type { Component } from 'vue'

const componentEntries: [string, Component][] = [
  ...fsusComponents.map((comp) => {
    const name = (comp as { name?: string; __name?: string }).name ?? (comp as { __name?: string }).__name ?? ''
    return [name, comp] as [string, Component]
  }).filter(([name]) => Boolean(name)),
  ['FsusIcon', FsusIcon],
  ['FsusMarkdownEditor', FsusMarkdownEditor],
  ['FsusMarkdownRenderer', FsusMarkdownRenderer],
]

export const demoComponents: Record<string, Component> = Object.fromEntries(componentEntries)
