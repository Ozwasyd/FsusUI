import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { collectMarkdownSyntaxNodesFromParser } from '../markdown-syntax-collect'

it('preserves strict, equal, overlapping, tied and zero-width native parent ranges', () => {
  const root = path.resolve('vue/packages/wasm/markdown')
  const temp = mkdtempSync(path.join(os.tmpdir(), 'fsusui-syntax-parents-'))
  const binary = path.join(
    temp,
    process.platform === 'win32' ? 'parents.exe' : 'parents',
  )
  try {
    execFileSync(
      process.env.CXX ?? 'c++',
      [
        '-std=c++23',
        '-O2',
        '-I',
        path.join(root, 'include'),
        path.join(root, 'tests/syntax_parent_assignment.cpp'),
        path.join(root, 'src/markdown_latex.cpp'),
        path.join(root, 'src/markdown_mermaid.cpp'),
        '-o',
        binary,
      ],
      { stdio: 'pipe' },
    )
    expect(execFileSync(binary, { encoding: 'utf8' })).toBe(
      '262 native parent-assignment fixtures passed\n',
    )
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}, 60_000)

it('keeps every sibling heading in the actual standalone WASM collector', () => {
  const nodes = collectMarkdownSyntaxNodesFromParser('# Chapter\n'.repeat(4096))
  expect(nodes).toHaveLength(4096)
  expect(
    nodes.every(
      (node) =>
        node.kind === 'heading' &&
        node.parentStart === undefined &&
        node.children?.length === 0,
    ),
  ).toBe(true)
})
