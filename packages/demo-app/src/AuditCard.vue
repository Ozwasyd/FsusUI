<template>
  <article
    class="audit-card"
    :class="`is-${state}`"
    :data-audit-component="name"
    tabindex="0"
    data-audit-focus
    data-audit-target
  >
    <header class="audit-card__header">
      <span class="audit-card__name">{{ name }}</span>
      <span class="audit-card__state">{{ state }}</span>
    </header>
    <div class="audit-card__body">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { UiAuditState } from './ui-audit-manifest'

defineProps<{
  name: string
  state: UiAuditState
}>()
</script>
