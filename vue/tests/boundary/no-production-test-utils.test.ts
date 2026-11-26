import { readFileSync } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../../..')

const FORBIDDEN_TEST_UTIL_SPECIFIER =
  /(?:from|import)\s*\(?['"](?:@element-plus\/test-utils|@vue\/test-utils)(?:\/[^'"]*)?['"]/u

describe('production package test-utils boundary', () => {
  it('forbids @element-plus/test-utils and @vue/test-utils imports in non-test package sources', async () => {
    const files = await fg(
      [
        'vue/packages/**/*.{ts,tsx,js,jsx,mjs,cjs,vue}',
        '!vue/packages/test-utils/**',
        '!vue/packages/demo-app/**',
        '!**/__tests__/**',
        '!**/*.{test,spec,vitest}.{ts,tsx,js,jsx,mjs,cjs}',
        '!**/node_modules/**',
        '!**/dist/**',
      ],
      { cwd: repoRoot },
    )

    expect(files.length).toBeGreaterThan(100)

    const offenders = files.filter((relPath) => {
      const content = readFileSync(path.join(repoRoot, relPath), 'utf8')
      return FORBIDDEN_TEST_UTIL_SPECIFIER.test(content)
    })

    expect(offenders).toEqual([])
  })
})
