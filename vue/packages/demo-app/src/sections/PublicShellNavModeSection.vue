<template>
  <ElPublicShell
    brand="Field Notes"
    brand-href="#home"
    active-nav="archive"
    :mobile-nav-mode="mobileNavMode"
    mobile-nav-label="Primary sections"
    mobile-nav-menu-label="Sections"
    :nav-items="navItems"
    desktop-search-mode="none"
    mobile-search-mode="trigger"
    mobile-search-trigger-label="Search"
    :sticky="false"
    :csp-safe="cspSafe"
  >
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
const navItems = [
  { key: 'home', label: 'Home', href: '#home' },
  { key: 'archive', label: 'Archive', href: '#archive' },
  { key: 'topics', label: 'Topics', href: '#topics' },
  { key: 'about', label: 'About', href: '#about' },
]
</script>

<style scoped>
.public-shell-nav-fixture {
  min-height: 46rem;
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
