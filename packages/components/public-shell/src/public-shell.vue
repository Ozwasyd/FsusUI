<template>
  <div
    :class="shellKls"
    :style="shellStyle"
    v-bind="{ 'data-public-hydration-kind': hydrationKind || undefined }"
  >
    <el-site-header
      :class="headerKls"
      :sticky="sticky"
      :max-width="maxWidth"
      :inner-class="ns.e('inner')"
      :primary-row-class="ns.e('primary-row')"
      :brand-nav-class="ns.e('brand-nav')"
      :desktop-actions-class="ns.e('actions')"
      :mobile-primary-actions-class="ns.e('mobile-primary-actions')"
      :mobile-secondary-actions-class="ns.e('mobile-toolbar')"
    >
      <template #brand>
        <a
          :href="brandHref"
          :class="ns.e('brand')"
          v-bind="{ 'data-public-nav': 'home' }"
        >
          <slot name="brand">{{ brand }}</slot>
        </a>
      </template>

      <template #desktop-nav>
        <div ref="desktopNavRef" :class="navKls('desktop-nav')">
          <a
            v-for="item in navItems"
            :key="item.key"
            :href="item.href"
            :class="navLinkKls(item.key)"
            v-bind="{ 'data-public-nav': item.key }"
          >
            {{ item.label }}
          </a>
          <span
            v-if="activeNavIndicatorEnabled"
            :class="ns.e('active-nav-indicator')"
            aria-hidden="true"
            v-bind="{ 'data-active-nav': activeNavIndicatorKey }"
          />
        </div>
      </template>

      <template #desktop-actions>
        <slot name="desktop-search">
          <form
            v-if="showSearch"
            :class="[ns.e('search'), ns.em('search', 'desktop')]"
            :action="searchAction"
            method="get"
            @submit="handleSearchSubmit"
          >
            <el-input
              :model-value="searchValue"
              :placeholder="searchPlaceholder"
              :label="searchAriaLabel"
              clearable
              @focus="emit('search-focus')"
              @input="handleSearchInput"
              @keydown.enter="handleSearchEnter"
            />
            <input
              v-if="searchName"
              type="hidden"
              :name="searchName"
              :value="searchValue"
            />
          </form>
        </slot>
        <slot name="desktop-actions" />
        <a
          v-if="hasAuthLink"
          :href="authHref"
          :class="[ns.e('action-link'), ns.e('auth-link')]"
          v-bind="{ 'data-public-nav': 'auth' }"
        >
          {{ authLabel }}
        </a>
      </template>

      <template #mobile-primary-actions>
        <button
          v-if="showMobileSearchTrigger"
          ref="mobileSearchTriggerRef"
          type="button"
          :class="[
            ns.e('mobile-search-trigger'),
            ns.is('expanded', mobileSearchExpanded),
          ]"
          :aria-expanded="mobileSearchExpanded"
          :aria-controls="mobileSearchRowId"
          :aria-label="mobileSearchButtonLabel"
          @click="toggleMobileSearch"
        >
          {{ mobileSearchButtonLabel }}
        </button>
        <slot name="mobile-primary-actions" />
        <a
          v-if="hasAuthLink"
          :href="authHref"
          :class="[
            ns.e('action-link'),
            ns.e('auth-link'),
            ns.em('auth-link', 'mobile'),
          ]"
          v-bind="{ 'data-public-nav': 'auth' }"
        >
          {{ authLabel }}
        </a>
      </template>

      <template #mobile-secondary-actions>
        <Transition name="el-public-shell-mobile-search">
          <div
            v-if="showMobileSearchTrigger"
            v-show="mobileSearchExpanded"
            :id="mobileSearchRowId"
            ref="mobileSearchRowRef"
            :class="[
              ns.e('mobile-search-row'),
              ns.is('expanded', mobileSearchExpanded),
            ]"
            :aria-hidden="!mobileSearchExpanded"
          >
            <slot name="mobile-search">
              <form
                v-if="showSearch"
                :class="[ns.e('search'), ns.em('search', 'trigger')]"
                :action="searchAction"
                method="get"
                @submit="handleSearchSubmit"
                @keydown.esc="handleMobileSearchEscape"
              >
                <el-input
                  :model-value="searchValue"
                  :placeholder="searchPlaceholder"
                  :label="searchAriaLabel"
                  clearable
                  @focus="emit('search-focus')"
                  @input="handleSearchInput"
                  @keydown.enter="handleSearchEnter"
                />
                <input
                  v-if="searchName"
                  type="hidden"
                  :name="searchName"
                  :value="searchValue"
                />
              </form>
            </slot>
          </div>
        </Transition>

        <el-scrollbar
          :class="ns.e('mobile-nav-scrollbar')"
          :wrap-class="ns.e('mobile-nav-wrap')"
          :view-class="ns.e('mobile-nav-view')"
        >
          <nav
            ref="mobileNavRef"
            :class="navKls('mobile-nav')"
            aria-label="Primary navigation"
          >
            <a
              v-for="item in navItems"
              :key="item.key"
              :href="item.href"
              :class="navLinkKls(item.key)"
              v-bind="{ 'data-public-nav': item.key }"
            >
              {{ item.label }}
            </a>
            <span
              v-if="activeNavIndicatorEnabled"
              :class="ns.e('active-nav-indicator')"
              aria-hidden="true"
              v-bind="{ 'data-active-nav': activeNavIndicatorKey }"
            />
          </nav>
        </el-scrollbar>

        <div :class="ns.e('mobile-actions')">
          <template v-if="showMobileInlineSearch">
            <slot name="mobile-search">
              <form
                :class="[ns.e('search'), ns.em('search', 'mobile')]"
                :action="searchAction"
                method="get"
                @submit="handleSearchSubmit"
              >
                <el-input
                  :model-value="searchValue"
                  :placeholder="searchPlaceholder"
                  :label="searchAriaLabel"
                  clearable
                  @focus="emit('search-focus')"
                  @input="handleSearchInput"
                  @keydown.enter="handleSearchEnter"
                />
                <input
                  v-if="searchName"
                  type="hidden"
                  :name="searchName"
                  :value="searchValue"
                />
              </form>
            </slot>
          </template>
          <slot name="mobile-actions" />
        </div>
      </template>
    </el-site-header>

    <main :class="ns.e('main')">
      <slot />
    </main>

    <footer :class="ns.e('footer')">
      <slot name="footer">
        <div :class="ns.e('footer-brand')">
          <slot name="footer-brand">{{ brand }}</slot>
        </div>
      </slot>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElInput } from '@element-plus/components/input'
import { ElScrollbar } from '@element-plus/components/scrollbar'
import { ElSiteHeader } from '@element-plus/components/site-header'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useId, useNamespace } from '@element-plus/hooks'
import { publicShellEmits, publicShellProps } from './public-shell'

import type { CSSProperties } from 'vue'

defineOptions({
  name: 'ElPublicShell',
})

const props = defineProps(publicShellProps)
const emit = defineEmits(publicShellEmits)

const ns = useNamespace('public-shell')
const searchValue = ref(props.searchQuery)
const mobileSearchRowId = useId().value
const mobileSearchRowRef = ref<HTMLElement>()
const mobileSearchTriggerRef = ref<HTMLButtonElement>()
const desktopNavRef = ref<HTMLElement>()
const mobileNavRef = ref<HTMLElement>()
const mobileSearchExpanded = ref(
  props.mobileSearchMode === 'trigger' && props.searchQuery.trim().length > 0,
)

watch(
  () => props.searchQuery,
  (value) => {
    searchValue.value = value
  },
)

const shellKls = computed(() => [ns.b(), ns.is('sticky', props.sticky)])
const headerKls = computed(() => [
  ns.e('header'),
  ns.is('sticky', props.sticky),
])
const showMobileSearchTrigger = computed(
  () => props.showSearch && props.mobileSearchMode === 'trigger',
)
const showMobileInlineSearch = computed(
  () => props.showSearch && props.mobileSearchMode === 'inline',
)
const hasAuthLink = computed(() => Boolean(props.authLabel && props.authHref))
const mobileSearchTriggerText = computed(
  () => props.mobileSearchTriggerLabel || props.searchAriaLabel,
)
const mobileSearchButtonLabel = computed(() =>
  mobileSearchExpanded.value
    ? props.mobileSearchCancelLabel
    : mobileSearchTriggerText.value,
)
const activeNavIndicatorEnabled = computed(
  () => props.activeNavMotion === 'indicator' && props.navItems.length > 0,
)
const activeNavIndicatorKey = computed(() => {
  const activeItem = props.navItems.find((item) => item.key === props.activeNav)
  return activeItem?.key ?? ''
})
const shellStyle = computed<CSSProperties>(() => ({
  '--el-public-shell-mobile-nav-gap': props.mobileNavGap,
  '--el-public-shell-mobile-search-width': props.mobileSearchWidth,
  '--el-public-shell-max-width': props.maxWidth,
  '--el-public-shell-nav-gap': props.navGap,
}))

const navLinkKls = (key: string) => [
  ns.e('nav-link'),
  ns.is('active', key === props.activeNav),
]
const navKls = (element: 'desktop-nav' | 'mobile-nav') => [
  ns.e(element),
  ns.is('indicator-motion', activeNavIndicatorEnabled.value),
]

const clearNavIndicator = (nav: HTMLElement) => {
  nav.style.removeProperty('--el-public-shell-active-nav-indicator-x')
  nav.style.removeProperty('--el-public-shell-active-nav-indicator-width')
  nav.style.setProperty('--el-public-shell-active-nav-indicator-opacity', '0')
}

const syncNavIndicator = (nav: HTMLElement | undefined) => {
  if (!nav) return

  if (!activeNavIndicatorEnabled.value || !activeNavIndicatorKey.value) {
    clearNavIndicator(nav)
    return
  }

  const activeLink = Array.from(
    nav.querySelectorAll<HTMLElement>(`.${ns.e('nav-link')}`),
  ).find((link) => link.dataset.publicNav === activeNavIndicatorKey.value)

  if (!activeLink) {
    clearNavIndicator(nav)
    return
  }

  const navRect = nav.getBoundingClientRect()
  const linkRect = activeLink.getBoundingClientRect()
  nav.style.setProperty(
    '--el-public-shell-active-nav-indicator-x',
    `${Math.max(0, linkRect.left - navRect.left + nav.scrollLeft)}px`,
  )
  nav.style.setProperty(
    '--el-public-shell-active-nav-indicator-width',
    `${Math.max(0, linkRect.width)}px`,
  )
  nav.style.setProperty('--el-public-shell-active-nav-indicator-opacity', '1')
}

const syncNavIndicators = async () => {
  await nextTick()
  syncNavIndicator(desktopNavRef.value)
  syncNavIndicator(mobileNavRef.value)
}

const handleIndicatorResize = () => {
  void syncNavIndicators()
}

watch(
  () => [props.activeNav, props.activeNavMotion, props.navItems],
  () => {
    void syncNavIndicators()
  },
  { deep: true },
)

onMounted(() => {
  void syncNavIndicators()
  window.addEventListener('resize', handleIndicatorResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleIndicatorResize)
})

const handleSearchInput = (value: string) => {
  searchValue.value = value
  emit(UPDATE_MODEL_EVENT, value)
  emit('update:searchQuery', value)
  emit(CHANGE_EVENT, value)
}

const focusMobileSearchInput = async () => {
  await nextTick()
  mobileSearchRowRef.value?.querySelector<HTMLInputElement>('input')?.focus()
}

const focusMobileSearchTrigger = async () => {
  await nextTick()
  mobileSearchTriggerRef.value?.focus()
}

const openMobileSearch = () => {
  mobileSearchExpanded.value = true
  void focusMobileSearchInput()
}

const closeMobileSearch = (restoreFocus = false) => {
  mobileSearchExpanded.value = false
  if (restoreFocus) {
    void focusMobileSearchTrigger()
  }
}

const toggleMobileSearch = () => {
  if (mobileSearchExpanded.value) {
    closeMobileSearch(true)
    return
  }

  openMobileSearch()
}

const handleMobileSearchEscape = (event: KeyboardEvent) => {
  event.preventDefault()
  closeMobileSearch(true)
}

const submitSearch = (event: Event) => {
  if (!props.spaSearch) return

  event.preventDefault()
  const query = searchValue.value.trim()
  if (!query) return

  emit('search', query)
}

const handleSearchSubmit = (event: Event) => {
  submitSearch(event)
}

const handleSearchEnter = (event: Event | KeyboardEvent) => {
  submitSearch(event)
}

watch(
  () => props.mobileSearchMode,
  (mode) => {
    if (mode !== 'trigger') {
      mobileSearchExpanded.value = false
    }
  },
)
</script>
