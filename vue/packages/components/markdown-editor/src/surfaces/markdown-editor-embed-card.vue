<template>
  <section
    class="el-markdown-embed"
    :aria-label="plan.accessibility.name"
    role="region"
  >
    <header class="el-markdown-embed__header">
      <span class="el-markdown-embed__target">{{ plan.title }}</span>
      <span class="el-markdown-embed__mode-tag">{{
        localeText.embeds.modes[plan.mode]
      }}</span>
      <span class="el-markdown-embed__status" role="status">{{
        plan.statusText
      }}</span>
    </header>
    <p v-if="plan.excerpt" class="el-markdown-embed__body">
      {{ plan.excerpt }}
    </p>
    <div class="el-markdown-embed__actions">
      <button
        v-for="action in plan.allowedActions"
        :key="action"
        type="button"
        class="el-markdown-embed__action"
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
