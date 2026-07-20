<template>
  <ElPublicShell
    brand="Field Notes"
    brand-href="#home"
    active-nav="archive"
    active-nav-motion="indicator"
    :nav-items="navItems"
    :desktop-search-mode="activeSearchMode"
    desktop-search-trigger-label="Search archive"
    search-action="/search"
    search-name="q"
    :search-query="searchQuery"
    search-placeholder="Search articles and topics"
    search-aria-label="Search Field Notes"
    :spa-search="true"
    mobile-search-mode="none"
    auth-label="Sign in"
    auth-href="#sign-in"
    :sticky="false"
    :csp-safe="cspSafe"
    @search="handleSearch"
    @update:search-query="searchQuery = $event"
  >
    <template #desktop-actions>
      <ElThemeModeToggle visibility="desktop" compact />
    </template>

    <article
      class="public-shell-search-fixture"
      data-testid="public-shell-search-fixture"
    >
      <p class="public-shell-search-fixture__context">
        Desktop search mode: {{ activeSearchMode }}
      </p>
      <h1>Archive field notes</h1>
      <p>
        Search disclosure belongs to the shell while query and result behavior
        remain consumer-owned.
      </p>
      <button type="button" data-testid="outside-search-action">
        Outside action
      </button>
      <div class="public-shell-search-fixture__modes" aria-label="Fixture mode">
        <button
          v-for="mode in desktopSearchModeOptions"
          :key="mode"
          type="button"
          :data-testid="`set-search-mode-${mode}`"
          @click="activeSearchMode = mode"
        >
          {{ mode }}
        </button>
      </div>
      <p data-testid="search-result">{{ searchResult }}</p>
    </article>

    <template #footer>
      <p>Field Notes archive</p>
    </template>
  </ElPublicShell>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import {
  ElPublicShell,
  ElThemeModeToggle,
  type PublicShellDesktopSearchMode,
} from '../../../element-plus'

const props = withDefaults(
  defineProps<{
    cspSafe?: boolean
    searchMode?: string
  }>(),
  {
    cspSafe: false,
    searchMode: 'inline',
  },
)

const desktopSearchModes = new Set<PublicShellDesktopSearchMode>([
  'inline',
  'trigger',
  'none',
])
const desktopSearchModeOptions = [
  'inline',
  'trigger',
  'none',
] as const satisfies readonly PublicShellDesktopSearchMode[]
const desktopSearchMode = computed<PublicShellDesktopSearchMode>(() =>
  desktopSearchModes.has(props.searchMode as PublicShellDesktopSearchMode)
    ? (props.searchMode as PublicShellDesktopSearchMode)
    : 'inline',
)
const activeSearchMode = ref(desktopSearchMode.value)
const searchQuery = ref('')
const searchResult = ref('No search submitted')
const navItems = [
  { key: 'home', label: 'Home', href: '#home' },
  { key: 'archive', label: 'Archive', href: '#archive' },
  { key: 'topics', label: 'Topics', href: '#topics' },
]

const handleSearch = (query: string) => {
  searchResult.value = `Submitted: ${query}`
}

watch(desktopSearchMode, (mode) => {
  activeSearchMode.value = mode
})
</script>

<style scoped>
.public-shell-search-fixture {
  min-height: 36rem;
}

.public-shell-search-fixture__context {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
}

.public-shell-search-fixture h1 {
  max-width: 18ch;
  margin-block: 16px;
  font-size: 40px;
  line-height: 1.1;
}

.public-shell-search-fixture > p {
  max-width: 58ch;
  line-height: 1.7;
}

.public-shell-search-fixture__modes {
  display: flex;
  gap: 8px;
  margin-block-start: 16px;
}
</style>
