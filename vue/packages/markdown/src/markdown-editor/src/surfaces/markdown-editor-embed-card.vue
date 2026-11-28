<template>
  <section
    class="fsus-markdown-embed"
    :aria-label="plan.accessibility.name"
    role="region"
  >
    <header class="fsus-markdown-embed__header">
      <span class="fsus-markdown-embed__target">{{ plan.title }}</span>
      <span class="fsus-markdown-embed__mode-tag">{{
        localeText.embeds.modes[plan.mode]
      }}</span>
      <span class="fsus-markdown-embed__status" role="status">{{
        plan.statusText
      }}</span>
    </header>
    <p v-if="plan.excerpt" class="fsus-markdown-embed__body">
      {{ plan.excerpt }}
    </p>
    <div class="fsus-markdown-embed__actions">
      <button
        v-for="action in plan.allowedActions"
        :key="action"
        type="button"
        class="fsus-markdown-embed__action"
        @click="emit('action', action)"
      >
        {{ localeText.embeds.actions[action] }}
      </button>
    </div>
  </section>
</template>

<script lang="ts" setup>
import type { MarkdownEditorLocaleText } from '../markdown-editor'
import type {
  MarkdownEmbedActionKind,
  MarkdownEmbedPresentationPlan,
} from '../markdown-editor-embed'

defineProps<{
  localeText: MarkdownEditorLocaleText
  plan: MarkdownEmbedPresentationPlan
}>()

const emit = defineEmits<{
  action: [action: MarkdownEmbedActionKind]
}>()
</script>
