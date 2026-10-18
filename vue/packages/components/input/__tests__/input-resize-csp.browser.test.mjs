import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { compile } from 'sass'
import { chromium } from '@playwright/test'

// Run with node --test; jsdom cannot verify computed CSS or HTTP CSP enforcement.
const root = fileURLToPath(new URL('../../../../..', import.meta.url))
const values = ['none', 'both', 'horizontal', 'vertical']
const variants = ['default', 'editor-title']

async function dragTextarea(page, editor) {
  await editor.scrollIntoViewIfNeeded()
  const before = await editor.boundingBox()
  assert.ok(before)
  await page.mouse.move(
    before.x + before.width - 3,
    before.y + before.height - 3,
  )
  await page.mouse.down()
  await page.mouse.move(
    before.x + before.width + 27,
    before.y + before.height + 77,
    {
      steps: 8,
    },
  )
  await page.mouse.up()
  const after = await editor.boundingBox()
  assert.ok(after)
  return { before, after }
}

test('public Input honors resize under enforced HTTP CSP', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'fsus-input-csp-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await writeFile(
    path.join(fixture, 'index.html'),
    `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><title>Input CSP resize</title>
    <link rel="icon" href="data:,"><link rel="stylesheet" href="/input.css"></head>
    <body><div id="negative" style="display:none">Blocked inline style control</div>
    <div id="app"></div><script type="module" src="/main.js"></script></body></html>`,
  )
  await writeFile(
    path.join(fixture, 'main.js'),
    `
    import { createApp, h, ref } from 'vue'
    import { ElInput } from '@ozwasyd/element-plus'
    const resize = ref('none'), cspSafe = ref(true), variant = ref('default')
    const disabled = ref(false), readonly = ref(false), rows = ref(3), content = ref('draft')
    createApp({ setup: () => () => h('main', [
      h('select', { id:'resize', value: resize.value ?? 'unset', onChange: e => resize.value = e.target.value === 'unset' ? undefined : e.target.value },
        ['unset','none','both','horizontal','vertical'].map(value => h('option', {value}, value))),
      ...[['csp', cspSafe], ['disabled', disabled], ['readonly', readonly]].map(([id, state]) => h('button', {id, onClick: () => state.value = !state.value}, id)),
      h('button', {id:'variant', onClick: () => variant.value = variant.value === 'default' ? 'editor-title' : 'default'}, 'variant'),
      h('button', {id:'rows', onClick: () => rows.value = rows.value === 3 ? 12 : 3}, 'expand'),
      h(ElInput, { id:'editor', type:'textarea', cspSafe:cspSafe.value, resize:resize.value,
        textareaVariant:variant.value, disabled:disabled.value, readonly:readonly.value,
        rows:rows.value, autosize:{minRows:3,maxRows:8}, showWordLimit:true, maxlength:100,
        modelValue:content.value, 'onUpdate:modelValue':value => content.value = value, label:'Comment' }),
    ]) }).mount('#app')
  `,
  )
  await build({
    configFile: false,
    root: fixture,
    plugins: [vue(), vueJsx()],
    logLevel: 'error',
    worker: { format: 'es' },
    resolve: {
      dedupe: ['vue'],
      alias: [
        {
          find: 'vue',
          replacement: path.join(
            root,
            'node_modules/vue/dist/vue.runtime.esm-bundler.js',
          ),
        },
        {
          find: '@ozwasyd/element-plus',
          replacement: path.join(root, 'vue/packages/element-plus/index.ts'),
        },
        {
          find: '@element-plus/icons-vue',
          replacement: path.join(root, 'vue/packages/icons-vue/src/index.ts'),
        },
        {
          find: /^@element-plus\/(.+)$/,
          replacement: `${root}/vue/packages/$1`,
        },
      ],
    },
    build: { outDir: path.join(fixture, 'dist'), reportCompressedSize: false },
  })
  await writeFile(
    path.join(fixture, 'dist/input.css'),
    compile(path.join(root, 'vue/packages/theme-chalk/src/input.scss'), {
      logger: { warn() {} },
    }).css,
  )
  const policy =
    "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'"
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    try {
      const body = await readFile(
        path.join(fixture, 'dist', pathname === '/' ? 'index.html' : pathname),
      )
      res.writeHead(200, {
        'Content-Security-Policy': policy,
        'Content-Type': pathname.endsWith('.js')
          ? 'text/javascript'
          : pathname.endsWith('.css')
            ? 'text/css'
            : 'text/html',
      })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const browser = await chromium.launch({
    executablePath: process.env.FSUS_INPUT_CSP_BROWSER_PATH || undefined,
  })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => {
    window.violations = []
    document.addEventListener('securitypolicyviolation', (e) =>
      window.violations.push(e.effectiveDirective),
    )
  })
  const response = await page.goto(`http://127.0.0.1:${server.address().port}`)
  assert.equal(response.headers()['content-security-policy'], policy)
  assert.equal(await page.title(), 'Input CSP resize')
  const editor = page.getByRole('textbox', { name: 'Comment' })
  await editor.waitFor()
  assert.equal(await page.locator('vite-error-overlay').count(), 0)
  assert.equal(
    await page
      .locator('#negative')
      .evaluate((el) => getComputedStyle(el).display),
    'block',
  )
  await page.waitForFunction(() => window.violations.includes('style-src-attr'))
  await page.evaluate(() => (window.violations.length = 0))
  const results = []
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport)
    for (const variant of variants) {
      if (variant === 'editor-title') await page.locator('#variant').click()
      for (const expanded of [false, true]) {
        if (expanded) await page.locator('#rows').click()
        for (const resize of ['unset', ...values]) {
          await page.locator('#resize').selectOption(resize)
          const expected =
            resize === 'unset'
              ? variant === 'default'
                ? 'vertical'
                : 'none'
              : resize
          const actual = await editor.evaluate(
            (el) => getComputedStyle(el).resize,
          )
          assert.equal(
            actual,
            expected,
            `${viewport.width}/${variant}/${expanded}/${resize}`,
          )
          assert.equal(await page.locator('#app [style]').count(), 0)
          assert.equal(await editor.getAttribute('rows'), expanded ? '12' : '3')
          results.push({
            viewport: viewport.width,
            variant,
            expanded,
            resize,
            actual,
          })
        }
        if (expanded) await page.locator('#rows').click()
      }
      if (variant === 'editor-title') await page.locator('#variant').click()
    }
  }
  for (const state of ['disabled', 'readonly']) {
    await page.locator(`#${state}`).click()
    for (const resize of values) {
      await page.locator('#resize').selectOption(resize)
      assert.equal(
        await editor.evaluate((el) => getComputedStyle(el).resize),
        resize,
      )
      assert.equal(
        await editor.evaluate(
          (el, state) => (state === 'disabled' ? el.disabled : el.readOnly),
          state,
        ),
        true,
      )
      assert.equal(await page.locator('#app [style]').count(), 0)
    }
    await page.locator(`#${state}`).click()
  }
  await editor.fill('content survives expanded rows and resize updates')
  await page.locator('#rows').click()
  await page.locator('#resize').selectOption('none')
  assert.equal(
    await editor.inputValue(),
    'content survives expanded rows and resize updates',
  )
  assert.deepEqual(await page.evaluate(() => window.violations), [])
  assert.deepEqual(pageErrors, [])
  const evidenceDir = process.env.FSUS_INPUT_CSP_EVIDENCE_DIR
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDir, 'input-csp-resize.png'),
      caret: 'initial',
    })
    await writeFile(
      path.join(evidenceDir, 'input-csp-resize.json'),
      JSON.stringify({ policy, results, pageErrors }, null, 2),
    )
  }
  // Ordinary behavior remains inline; switching back to CSP-safe removes the style.
  await page.locator('#csp').click()
  for (const resize of values) {
    await page.locator('#resize').selectOption(resize)
    assert.equal(await editor.evaluate((el) => el.style.resize), resize)
  }
  await page.locator('#csp').click()
  assert.equal(await page.locator('#app [style]').count(), 0)
  assert.equal(
    await editor.evaluate((el) => getComputedStyle(el).resize),
    'vertical',
  )

  const mouseResults = []
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 })
    for (const expanded of [false, true]) {
      for (const resize of ['vertical', 'none']) {
        // Start a new document so native user-resize styles cannot carry over.
        await page.reload()
        await editor.waitFor()
        await page.waitForFunction(() =>
          window.violations.includes('style-src-attr'),
        )
        await page.evaluate(() => (window.violations.length = 0))
        if (expanded) await page.locator('#rows').click()
        await page.locator('#resize').selectOption(resize)
        assert.equal(
          await editor.evaluate((el) => getComputedStyle(el).resize),
          resize,
        )
        const content = await editor.inputValue()
        const geometry = await dragTextarea(page, editor)
        if (resize === 'vertical') {
          assert.ok(
            geometry.after.height >= geometry.before.height + 40,
            'The positive control must actually resize through the native mouse handle',
          )
        } else {
          assert.ok(
            Math.abs(geometry.after.height - geometry.before.height) <= 1,
          )
          assert.ok(Math.abs(geometry.after.width - geometry.before.width) <= 1)
          assert.equal(await page.locator('#app [style]').count(), 0)
        }
        assert.equal(await editor.inputValue(), content)
        assert.deepEqual(await page.evaluate(() => window.violations), [])
        mouseResults.push({ width, expanded, resize, ...geometry })
      }
    }
  }
  assert.deepEqual(pageErrors, [])
  if (evidenceDir) {
    await writeFile(
      path.join(evidenceDir, 'input-csp-mouse.json'),
      JSON.stringify(mouseResults, null, 2),
    )
    await page.screenshot({
      path: path.join(evidenceDir, 'input-csp-mouse-none.png'),
    })
  }
})
