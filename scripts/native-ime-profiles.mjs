import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Linux-local native IME matrix profiles.
 *
 * Required cells analogize Windows/macOS CJK IMEs and Safari to ibus engines
 * and headed Chromium/Firefox/WebKit windows. Synthetic composition events
 * are still not acceptance evidence.
 */

export const ENGINE_PROFILES = {
  libpinyin: {
    ibusName: 'libpinyin',
    processMatch: 'ibus-engine-libpinyin',
    locale: 'zh-CN',
    scriptName: 'Han',
    hasCandidates: true,
    activateKeys: [],
    commitKeys: ['n', 'i', 'h', 'a', 'o', 'delay=300', 'space'],
    cancelKeys: ['n', 'i', 'h', 'a', 'o', 'delay=300', 'Escape'],
    candidateKeys: [
      'n',
      'i',
      'h',
      'a',
      'o',
      'delay=300',
      'Down',
      'delay=200',
      'space',
    ],
  },
  chewing: {
    ibusName: 'chewing',
    processMatch: 'ibus-engine-chewing',
    locale: 'zh-TW',
    scriptName: 'Han',
    hasCandidates: true,
    activateKeys: [],
    // 你好 in default chewing (Bopomofo): ㄋㄧˇㄏㄠˇ = su3cl3
    // Return finalizes the still-open composition after Space commits the phrase.
    commitKeys: [
      's',
      'u',
      '3',
      'c',
      'l',
      '3',
      'delay=300',
      'space',
      'delay=200',
      'Return',
    ],
    cancelKeys: ['s', 'u', 'delay=250', 'Escape'],
    candidateKeys: [
      's',
      'u',
      '3',
      'c',
      'l',
      '3',
      'delay=300',
      'Down',
      'delay=300',
      'space',
      'delay=300',
      'Return',
      'delay=300',
      'Return',
    ],
  },
  'mozc-jp': {
    ibusName: 'mozc-jp',
    processMatch: 'ibus-engine-mozc',
    locale: 'ja-JP',
    scriptName: 'Hiragana',
    hasCandidates: true,
    activateKeys: ['keycode=248', 'delay=250'],
    commitKeys: [
      'k',
      'o',
      'n',
      'n',
      'i',
      'c',
      'h',
      'i',
      'h',
      'a',
      'delay=400',
      'space',
      'delay=200',
      'Return',
    ],
    cancelKeys: [
      'k',
      'o',
      'n',
      'n',
      'i',
      'c',
      'h',
      'i',
      'h',
      'a',
      'delay=400',
      'Escape',
    ],
    candidateKeys: [
      'k',
      'o',
      'n',
      'n',
      'i',
      'c',
      'h',
      'i',
      'h',
      'a',
      'delay=400',
      'Down',
      'delay=200',
      'space',
      'delay=200',
      'Return',
    ],
  },
  hangul: {
    ibusName: 'hangul',
    processMatch: 'ibus-engine-hangul',
    locale: 'ko-KR',
    scriptName: 'Hangul',
    hasCandidates: false,
    // Session gsettings start hangul in Hangul mode. Do not send Hangul/keycode
    // 209 here: that toggle flips back to latin/English on this host.
    activateKeys: [],
    // 안녕 on 2-set Korean (US keycaps): dkssud. Space confirms the last
    // syllable; the following lastTransaction may be the space itself.
    commitKeys: ['d', 'k', 's', 's', 'u', 'd', 'delay=300', 'space'],
    // Chromium+ibus-hangul treats Escape as "commit preedit". Native cancel
    // is BackSpace while the first jamo is still composing, then Escape to
    // end the empty composition.
    cancelKeys: ['d', 'BackSpace', 'Escape'],
    candidateKeys: ['d', 'k', 's', 's', 'u', 'd', 'delay=300'],
  },
}

export const BROWSER_PROFILES = {
  chromium: {
    name: 'chromium',
    windowClass: 'Google-chrome',
    needsSystemChrome: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,1100',
      '--window-position=80,80',
    ],
  },
  firefox: {
    name: 'firefox',
    windowClass: 'firefox',
    needsSystemChrome: false,
    args: [],
    firefoxUserPrefs: {
      'ui.osk.enabled': false,
      // Playwright Firefox otherwise injects keys as Latin and skips ibus.
      'security.sandbox.content.level': 0,
      'security.sandbox.gpu.level': 0,
      'fission.autostart': false,
      // Autoconfig enables testmode, which keeps IME from attaching to XTEST.
      'focusmanager.testmode': false,
    },
    gtkImModule: 'ibus',
  },
  webkit: {
    name: 'webkit',
    windowClass: 'MiniBrowser',
    needsSystemChrome: false,
    args: [],
  },
}

/**
 * Convert a textarea client rect into an X11 root coordinate using the real
 * mapped window geometry. Playwright `screenX`/`outerHeight` omit Firefox and
 * WebKit chrome, so clicks that use them land in the tab/URL bar.
 */
export const officialFirefoxCandidates = () =>
  [
    process.env.FSUS_IME_FIREFOX_PATH,
    join(homedir(), '.cache/fsus-mozilla-firefox/firefox/firefox'),
  ].filter(Boolean)

export const resolveOfficialFirefox = () =>
  officialFirefoxCandidates().find((candidate) => existsSync(candidate)) ?? null

export const computeX11Target = ({
  windowGeometry,
  innerWidth,
  innerHeight,
  rect,
}) => {
  const [windowX, windowY, windowWidth, windowHeight] = windowGeometry
  const topChrome = Math.max(0, windowHeight - innerHeight)
  const leftChrome = Math.max(0, windowWidth - innerWidth)
  return {
    x: Math.round(windowX + leftChrome + rect.x + rect.width / 2),
    y: Math.round(windowY + topChrome + rect.y + rect.height / 2),
  }
}

export const scriptPattern = (scriptName) => {
  if (scriptName === 'Hangul') return /\p{Script=Hangul}/u
  if (scriptName === 'Hiragana') {
    return /\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Han}/u
  }
  return /\p{Script=Han}/u
}

export const resolveEngineProfile = (name) => {
  const profile = ENGINE_PROFILES[name]
  if (!profile) {
    throw new Error(
      `unknown IME engine "${name}"; expected ${Object.keys(ENGINE_PROFILES).join(', ')}`,
    )
  }
  return profile
}

export const resolveBrowserProfile = (name) => {
  const profile = BROWSER_PROFILES[name]
  if (!profile) {
    throw new Error(
      `unknown browser "${name}"; expected ${Object.keys(BROWSER_PROFILES).join(', ')}`,
    )
  }
  return profile
}
