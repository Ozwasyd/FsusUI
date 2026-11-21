import { Teleport, createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, test } from 'vitest'
import ImageViewer from '../src/image-viewer.vue'

interface SsrContext {
  teleports?: Record<string, string>
}

describe('ImageViewer SSR teleport and strict CSP contract (#835)', () => {
  test('initially open cspSafe viewer emits dialog/image in dedicated teleport target with zero inline style attributes', async () => {
    const app = createSSRApp(
      defineComponent({
        render() {
          return h('main', [
            h('p', 'Background content'),
            h(
              ImageViewer,
              {
                visible: true,
                teleported: true,
                appendTo: '#viewer-teleports',
                cspSafe: true,
                urlList: ['/images/fig-1.svg', '/images/fig-2.svg'],
                altList: ['First SSR figure', 'Second SSR figure'],
                ariaLabel: 'SSR gallery',
              },
              {
                caption: ({ alt, index }: { alt: string; index: number }) =>
                  h('span', `${index + 1}: ${alt}`),
              },
            ),
          ])
        },
      }),
    )

    const context: SsrContext = {}
    const html = await renderToString(app, context)
    const teleported = context.teleports?.['#viewer-teleports'] ?? ''

    expect(html).toContain('Background content')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toMatch(/\sstyle=/u)

    expect(teleported).toContain('role="dialog"')
    expect(teleported).toContain('aria-modal="true"')
    expect(teleported).toContain('aria-label="SSR gallery"')
    expect(teleported).toContain('aria-describedby=')
    expect(teleported).toContain('/images/fig-1.svg')
    expect(teleported).toContain('alt="First SSR figure"')
    expect(teleported).toContain('/images/fig-2.svg')
    expect(teleported).toContain('alt="Second SSR figure"')
    expect(teleported).toContain('is-hidden')
    expect(teleported).toContain('1: First SSR figure')
    expect(teleported).not.toMatch(/\sstyle=/u)
  })

  test('initially closed viewer emits empty/comment teleport without overlay markup', async () => {
    const app = createSSRApp(
      defineComponent({
        render() {
          return h('main', [
            h('button', { type: 'button' }, 'Open preview'),
            h(ImageViewer, {
              visible: false,
              teleported: true,
              appendTo: '#viewer-teleports',
              cspSafe: true,
              urlList: ['/images/fig-1.svg'],
              altList: ['Closed figure'],
            }),
          ])
        },
      }),
    )

    const context: SsrContext = {}
    const html = await renderToString(app, context)
    const teleported = context.teleports?.['#viewer-teleports'] ?? ''

    expect(html).toContain('Open preview')
    expect(html).not.toMatch(/\sstyle=/u)
    expect(teleported).not.toContain('role="dialog"')
    expect(teleported).not.toContain('el-image-viewer__wrapper')
    expect(teleported).not.toContain('<img')
    expect(teleported.replaceAll(/<!--[\s\S]*?-->/gu, '').trim()).toBe('')
    expect(teleported).not.toMatch(/\sstyle=/u)
  })

  test('plain Vue Teleport positive control populates context.teleports alongside viewer host', async () => {
    const app = createSSRApp(
      defineComponent({
        render() {
          return h('main', [
            h(Teleport, { to: '#probe-teleports' }, [
              h(
                'div',
                { 'data-probe': 'dedicated-host' },
                'Plain Vue teleport probe',
              ),
            ]),
            h(ImageViewer, {
              visible: true,
              teleported: true,
              appendTo: '#viewer-teleports',
              cspSafe: true,
              urlList: ['/images/fig-1.svg'],
              altList: ['Coexisting figure'],
            }),
          ])
        },
      }),
    )

    const context: SsrContext = {}
    const html = await renderToString(app, context)
    const probe = context.teleports?.['#probe-teleports'] ?? ''
    const viewer = context.teleports?.['#viewer-teleports'] ?? ''

    expect(html).not.toContain('Plain Vue teleport probe')
    expect(html).not.toContain('role="dialog"')
    expect(probe).toContain('data-probe="dedicated-host"')
    expect(probe).toContain('Plain Vue teleport probe')
    expect(probe).not.toContain('role="dialog"')
    expect(viewer).toContain('role="dialog"')
    expect(viewer).toContain('alt="Coexisting figure"')
    expect(viewer).not.toMatch(/\sstyle=/u)
  })

  test('non-cspSafe mode emits inline style attributes as negative control for CSP assertion', async () => {
    const app = createSSRApp(
      defineComponent({
        render() {
          return h(ImageViewer, {
            visible: true,
            teleported: true,
            appendTo: '#viewer-teleports',
            cspSafe: false,
            urlList: ['/images/fig-1.svg', '/images/fig-2.svg'],
          })
        },
      }),
    )

    const context: SsrContext = {}
    await renderToString(app, context)
    const teleported = context.teleports?.['#viewer-teleports'] ?? ''

    expect(teleported).toContain('role="dialog"')
    expect(teleported).toMatch(/\sstyle=/u)
  })
})
