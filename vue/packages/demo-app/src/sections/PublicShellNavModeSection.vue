<template>
  <ElPublicShell
    :brand="fixture.brand"
    brand-href="#home"
    active-nav="archive"
    :mobile-nav-mode="mobileNavMode"
    :mobile-nav-label="fixture.navigationLabel"
    :mobile-nav-menu-label="fixture.menuLabel"
    :nav-items="navItems"
    :auth-label="fixture.authLabel"
    auth-href="#account"
    desktop-search-mode="none"
    mobile-search-mode="trigger"
    :mobile-search-trigger-label="fixture.searchLabel"
    :sticky="false"
    :csp-safe="cspSafe"
  >
    <template #mobile-menu-actions>
      <button type="button" data-testid="public-shell-theme-action">
        {{ fixture.themeLabel }}
      </button>
      <button type="button" data-testid="public-shell-locale-action">
        {{ fixture.localeLabel }}
      </button>
    </template>

    <article
      class="public-shell-nav-fixture"
      data-testid="public-shell-nav-fixture"
    >
      <p class="public-shell-nav-fixture__eyebrow">Public reading surface</p>
      <h1>Notes on explicit mobile navigation</h1>
      <p>
        The consumer chooses a header menu, inline links, bottom tabs, or no
        mobile navigation. Desktop navigation remains unchanged.
      </p>
      <a href="#article-end">Continue reading</a>
      <div
        id="article-end"
        class="public-shell-nav-fixture__body"
        aria-hidden="true"
      />
    </article>

    <template #footer>
      <p>Field Notes archive</p>
    </template>
  </ElPublicShell>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ElPublicShell } from '../../../element-plus'
import type { PublicShellMobileNavMode } from '../../../element-plus'

const props = withDefaults(
  defineProps<{
    cspSafe?: boolean
    navMode?: string
  }>(),
  {
    cspSafe: false,
    navMode: 'menu',
  },
)

const mobileNavModes = new Set<PublicShellMobileNavMode>([
  'inline',
  'menu',
  'bottom',
  'none',
])
const mobileNavMode = computed<PublicShellMobileNavMode>(() =>
  mobileNavModes.has(props.navMode as PublicShellMobileNavMode)
    ? (props.navMode as PublicShellMobileNavMode)
    : 'menu',
)
const fixtureParams = new URLSearchParams(window.location.search)
const fixtureLocale = fixtureParams.get('fixtureLocale') ?? 'en'
const longBrand = fixtureParams.get('longBrand') === '1'
const authenticated = fixtureParams.get('session') === 'authenticated'
const exposesAuth = fixtureParams.has('session')
const contractFixture = fixtureParams.get('contract') === '1'

const fixture = computed(() => {
  if (fixtureLocale === 'zh') {
    return {
      authLabel: exposesAuth
        ? authenticated
          ? '账户：长名称读者'
          : '登录'
        : '',
      brand: longBrand ? '很长的公共知识库品牌名称' : '田野札记',
      localeLabel: '语言：简体中文',
      menuLabel: '菜单',
      navigationLabel: '主要栏目',
      searchLabel: '搜索',
      themeLabel: '主题：跟随系统',
    }
  }

  if (fixtureLocale === 'long') {
    return {
      authLabel: exposesAuth
        ? authenticated
          ? 'Account: International Researcher'
          : 'Sign in to your account'
        : '',
      brand: longBrand
        ? 'International Field Research Publications'
        : 'Field Notes',
      localeLabel: 'Language: English (International)',
      menuLabel: 'Navigation menu',
      navigationLabel: 'Primary publication sections',
      searchLabel: 'Search',
      themeLabel: 'Theme: Follow system preference',
    }
  }

  return {
    authLabel: exposesAuth ? (authenticated ? 'Account' : 'Sign in') : '',
    brand: longBrand ? 'Field Notes Research Archive' : 'Field Notes',
    localeLabel: 'Language: English',
    menuLabel: contractFixture ? 'Menu' : 'Sections',
    navigationLabel: 'Primary sections',
    searchLabel: 'Search',
    themeLabel: 'Theme: System',
  }
})
const navItems = computed(() =>
  fixtureLocale === 'zh'
    ? [
        { key: 'home', label: '首页', href: '#home' },
        { key: 'archive', label: '归档', href: '#archive' },
        { key: 'topics', label: '专题', href: '#topics' },
        { key: 'about', label: '关于', href: '#about' },
      ]
    : [
        { key: 'home', label: 'Home', href: '#home' },
        { key: 'archive', label: 'Archive', href: '#archive' },
        { key: 'topics', label: 'Topics', href: '#topics' },
        { key: 'about', label: 'About', href: '#about' },
      ],
)
</script>

<style scoped>
.public-shell-nav-fixture {
  min-height: 46rem;
  overflow-wrap: anywhere;
}

.public-shell-nav-fixture__eyebrow {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.public-shell-nav-fixture h1 {
  max-width: 18ch;
  font-size: clamp(2rem, 8vw, 4rem);
  line-height: 1.08;
}

.public-shell-nav-fixture p {
  max-width: 58ch;
  line-height: 1.7;
}

.public-shell-nav-fixture__body {
  min-height: 26rem;
}
</style>
