import {
  devices,
  type PlaywrightTestConfig,
  type Project,
} from '@playwright/test'
import { resolveTestPort } from '../scripts/test-parallelism'

export const FSUS_DEFAULT_LOCALE = 'zh-CN'
export const FSUS_DEFAULT_TIMEZONE = 'Asia/Shanghai'

export const FSUS_VISUAL_VIEWPORTS = {
  desktop: { width: 1440, height: 1600 },
  mobile: { width: 412, height: 1200 },
  tiny: { width: 320, height: 900 },
  safeArea: { width: 390, height: 844 },
} as const

export const resolveChromiumLaunchOptions = () =>
  process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
    : undefined

export const createBaseUse = (
  baseURL: string,
  overrides: NonNullable<PlaywrightTestConfig['use']> = {},
): NonNullable<PlaywrightTestConfig['use']> => ({
  baseURL,
  colorScheme: 'light',
  locale: FSUS_DEFAULT_LOCALE,
  timezoneId: FSUS_DEFAULT_TIMEZONE,
  ...overrides,
})

export const resolveServerEndpoint = (
  portEnv: string,
  defaultPort: number,
  externalMode: 'url' | 'flag' | 'none' = 'none',
) => {
  delete process.env.NO_COLOR
  const port = resolveTestPort(portEnv, defaultPort)
  const localUrl = `http://127.0.0.1:${port}`
  if (externalMode === 'url') {
    const externalServer = process.env.FSUS_PLAYWRIGHT_EXTERNAL_SERVER
    return {
      port,
      baseURL: externalServer ?? localUrl,
      useExternalServer: Boolean(externalServer),
    }
  }
  if (externalMode === 'flag') {
    return {
      port,
      baseURL: localUrl,
      useExternalServer: process.env.FSUS_PLAYWRIGHT_EXTERNAL_SERVER === '1',
    }
  }
  return { port, baseURL: localUrl, useExternalServer: false }
}

export const createDemoPreviewWebServer = (
  port: number,
  url: string,
  timeout = 180_000,
): NonNullable<PlaywrightTestConfig['webServer']> => ({
  command: `pnpm -C .. run build:demo && pnpm -C packages/demo-app exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
  url,
  reuseExistingServer: !process.env.CI,
  timeout,
})

export const createDemoDevWebServer = (
  port: number,
  url: string,
  {
    ensureWasm = true,
    reuseExistingServer = !process.env.CI,
    timeout = 120_000,
  }: {
    ensureWasm?: boolean
    reuseExistingServer?: boolean
    timeout?: number
  } = {},
): NonNullable<PlaywrightTestConfig['webServer']> => ({
  command: ensureWasm
    ? `pnpm -C .. run ensure:wasm && pnpm -C packages/demo-app exec vite --host 127.0.0.1 --port ${port} --strictPort`
    : `pnpm -C packages/demo-app dev --host 127.0.0.1 --port ${port} --strictPort`,
  url,
  reuseExistingServer,
  timeout,
})

export const createIsolatedVitePreviewWebServer = (
  viteConfigRelative: string,
  port: number,
  url: string,
  timeout = 180_000,
): NonNullable<PlaywrightTestConfig['webServer']> => ({
  command: `pnpm exec vite build --config ${viteConfigRelative} && pnpm exec vite preview --config ${viteConfigRelative} --host 127.0.0.1 --port ${port} --strictPort`,
  cwd: '..',
  url,
  reuseExistingServer: false,
  timeout,
})

export const createVisualRuntimeWebServer = (
  suite: 'preview' | 'dev',
  port: number,
  url: string,
  {
    reuseExistingServer = process.env.FSUS_VISUAL_REUSE_SERVER === '1',
    timeout = suite === 'preview' ? 240_000 : 120_000,
  }: {
    reuseExistingServer?: boolean
    timeout?: number
  } = {},
): NonNullable<PlaywrightTestConfig['webServer']> => ({
  command: `node ../scripts/serve-visual-runtime.mjs --suite=${suite} --host=127.0.0.1 --port=${port}`,
  url,
  reuseExistingServer,
  timeout,
})

export const createDesktopBrowserProjects = (
  overrides: Partial<
    Record<'chromium' | 'firefox' | 'webkit', Partial<Project>>
  > = {},
): Project[] => [
  {
    name: 'chromium',
    ...overrides.chromium,
    use: { ...devices['Desktop Chrome'], ...overrides.chromium?.use },
  },
  {
    name: 'firefox',
    ...overrides.firefox,
    use: { ...devices['Desktop Firefox'], ...overrides.firefox?.use },
  },
  {
    name: 'webkit',
    ...overrides.webkit,
    use: { ...devices['Desktop Safari'], ...overrides.webkit?.use },
  },
]

export const createChromiumDefaultProjects = (): Project[] => [
  {
    name: 'default',
    use: { browserName: 'chromium' },
  },
]

export const createViewportThemeMatrixProjects = ({
  includeTiny = false,
  customize,
}: {
  includeTiny?: boolean
  customize?: (projectName: string) => Partial<Project>
} = {}): Project[] => {
  const entries: Array<{
    name: string
    use: NonNullable<Project['use']>
  }> = [
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: FSUS_VISUAL_VIEWPORTS.desktop,
      },
    },
    {
      name: 'mobile-light',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'light',
        viewport: FSUS_VISUAL_VIEWPORTS.mobile,
      },
    },
    ...(includeTiny
      ? [
          {
            name: 'tiny-light',
            use: {
              ...devices['Pixel 7'],
              colorScheme: 'light' as const,
              viewport: FSUS_VISUAL_VIEWPORTS.tiny,
            },
          },
        ]
      : []),
    {
      name: 'desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: FSUS_VISUAL_VIEWPORTS.desktop,
      },
    },
    {
      name: 'mobile-dark',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
        viewport: FSUS_VISUAL_VIEWPORTS.mobile,
      },
    },
    ...(includeTiny
      ? [
          {
            name: 'tiny-dark',
            use: {
              ...devices['Pixel 7'],
              colorScheme: 'dark' as const,
              viewport: FSUS_VISUAL_VIEWPORTS.tiny,
            },
          },
        ]
      : []),
  ]

  return entries.map(({ name, use }) => {
    const extra = customize ? customize(name) : {}
    return {
      ...extra,
      name,
      use: { ...use, ...extra.use },
    }
  })
}
