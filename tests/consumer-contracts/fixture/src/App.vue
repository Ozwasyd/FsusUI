<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElConfigProvider } from '@ozwasyd/element-plus'
import en from '@ozwasyd/element-plus/es/locale/lang/en'
import zhCn from '@ozwasyd/element-plus/es/locale/lang/zh-cn'
import DropdownContractView from './views/DropdownContractView.vue'
import DataListContractView from './views/DataListContractView.vue'
import ImageViewerModalView from './views/ImageViewerModalView.vue'
import ImageViewerContentView from './views/ImageViewerContentView.vue'
import ImageViewerGeometryView from './views/ImageViewerGeometryView.vue'

const pathname = window.location.pathname
const params = new URLSearchParams(window.location.search)
const themeParam = params.get('theme') === 'dark' ? 'dark' : 'light'
const dirParam = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
const localeParam = params.get('locale') === 'zh-cn' ? 'zh-cn' : 'en'
const negParam = params.get('neg') || ''

const activeLocale = computed(() => (localeParam === 'zh-cn' ? zhCn : en))

const activeRoute = computed(() => {
  if (pathname.startsWith('/830')) return '830'
  if (pathname.startsWith('/831')) return '831'
  if (pathname.startsWith('/832')) return '832'
  if (pathname.startsWith('/833')) return '833'
  if (pathname.startsWith('/834')) return '834'
  return 'home'
})

onMounted(() => {
  const root = document.documentElement
  root.dir = dirParam
  root.classList.toggle('dark', themeParam === 'dark')
  root.classList.toggle('light', themeParam === 'light')
  root.dataset.themeMode = themeParam
  root.dataset.themeResolved = themeParam
})
</script>

<template>
  <ElConfigProvider :locale="activeLocale" :theme-mode="themeParam">
    <main class="contract-shell" :data-contract-route="activeRoute" data-contract-ready="true">
      <DropdownContractView v-if="activeRoute === '830'" :neg="negParam" />
      <DataListContractView v-else-if="activeRoute === '831'" :neg="negParam" />
      <ImageViewerModalView v-else-if="activeRoute === '832'" :neg="negParam" />
      <ImageViewerContentView v-else-if="activeRoute === '833'" :neg="negParam" />
      <ImageViewerGeometryView v-else-if="activeRoute === '834'" :neg="negParam" />
      <section v-else>
        <h1>FsusUI Public API Consumer Contract Fixture</h1>
        <nav aria-label="Contract routes">
          <ul>
            <li><a href="/830">#830 Dropdown single selection</a></li>
            <li><a href="/831">#831 DataList activation</a></li>
            <li><a href="/832">#832 ImageViewer modal lifecycle</a></li>
            <li><a href="/833">#833 ImageViewer content &amp; navigation</a></li>
            <li><a href="/834">#834 ImageViewer toolbar geometry</a></li>
            <li><a href="/ssr/open">#835 ImageViewer SSR open + CSP</a></li>
            <li><a href="/ssr/closed">#835 ImageViewer SSR closed + CSP</a></li>
          </ul>
        </nav>
      </section>
    </main>
  </ElConfigProvider>
</template>
