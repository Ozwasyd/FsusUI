<template>
  <header
    :class="headerKls"
    :aria-label="ariaLabel"
    v-bind="cspSafe ? {} : { style: headerStyle }"
  >
    <div :class="[ns.e('inner'), innerClass]">
      <div :class="[ns.e('primary-row'), primaryRowClass]">
        <div :class="[ns.e('brand-nav'), brandNavClass]">
          <div :class="ns.e('brand')">
            <slot name="brand" />
          </div>

          <nav
            v-if="slots['desktop-nav']"
            :class="ns.e('desktop-nav')"
            :aria-label="navAriaLabel"
          >
            <slot name="desktop-nav" />
          </nav>
        </div>

        <div
          v-if="slots['desktop-actions']"
          :class="[ns.e('desktop-actions'), desktopActionsClass]"
        >
          <slot name="desktop-actions" />
        </div>

        <div
          v-if="
            slots['mobile-primary-actions'] || slots['mobile-overflow-trigger']
          "
          :class="[ns.e('mobile-primary-actions'), mobilePrimaryActionsClass]"
        >
          <slot name="mobile-primary-actions" />
          <slot name="mobile-overflow-trigger" />
        </div>
      </div>

      <div
        v-if="slots['mobile-secondary-actions']"
        :class="[ns.e('mobile-secondary-actions'), mobileSecondaryActionsClass]"
      >
        <slot name="mobile-secondary-actions" />
      </div>
    </div>
  </header>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { siteHeaderProps } from './site-header'

import type { CSSProperties } from 'vue'

defineOptions({
  name: 'ElSiteHeader',
})

const props = defineProps(siteHeaderProps)
const slots = useSlots()
const ns = useNamespace('site-header')

const headerKls = computed(() => [ns.b(), ns.is('sticky', props.sticky)])
const headerStyle = computed<CSSProperties>(() => ({
  '--el-site-header-max-width': props.maxWidth,
}))
</script>
