<template>
  <main class="character-conformance" data-testid="character-conformance">
    <header>
      <h1>Character challenge conformance</h1>
      <p>
        Final-media rendering, alternative access, replacement, and
        deterministic states / 最终媒体、替代方式、替换与确定状态。
      </p>
    </header>

    <section
      class="character-conformance__grid"
      aria-label="Character challenge states"
    >
      <article
        v-for="fixture in fixtures"
        :key="fixture.state"
        class="character-conformance__fixture"
        v-bind="{ 'data-state': fixture.state }"
      >
        <h2>{{ fixture.label }}</h2>
        <ElPerceptionCharacterChallenge
          :challenge-id="`conformance-${fixture.state}`"
          :state="fixture.state"
          :media="fixture.media"
          :model-value="responses[fixture.state]"
          :prompt="fixture.prompt"
          :description="fixture.description"
          :error="fixture.error"
          media-alt="Characters to transcribe"
          input-label="Character response"
          @update:model-value="responses[fixture.state] = $event"
        />
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { ElPerceptionCharacterChallenge } from '../../../element-plus'

import type {
  PerceptionCharacterMedia,
  PerceptionChallengeState,
} from '../../../components/perception-challenge'

type Fixture = {
  state: Extract<
    PerceptionChallengeState,
    | 'loading'
    | 'ready'
    | 'verifying'
    | 'retryable'
    | 'reissue'
    | 'expired'
    | 'unavailable'
    | 'disabled'
  >
  label: string
  prompt: string
  description: string
  error?: string
  media: PerceptionCharacterMedia | null
}

const raster = (suffix: string): PerceptionCharacterMedia => ({
  raster: {
    kind: 'image-url',
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><rect width="240" height="80" fill="#f7f7f8"/><path d="M18 62L42 18l24 44M30 44h24M88 18v44m0-22h28m0-22v44M148 20c42-16 54 48 10 40-30-5-22-40 12-40M208 18v44" fill="none" stroke="#2a599c" stroke-width="5" stroke-linecap="round"/><text x="218" y="70" font-size="10" fill="#71717a">${suffix}</text></svg>`,
    )}`,
    width: 240,
    height: 80,
  },
  audio: {
    src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    type: 'audio/wav',
  },
})

const fixtures: Fixture[] = [
  {
    state: 'loading',
    label: 'Loading',
    prompt: 'Preparing final media',
    description: 'Required controls remain in their canonical source order.',
    media: null,
  },
  {
    state: 'ready',
    label: 'Ready · raster + audio',
    prompt: 'Enter the visible characters / 请输入图像中显示的字符',
    description:
      'The alternative describes purpose only; audio starts only after activation.',
    media: raster('R1'),
  },
  {
    state: 'verifying',
    label: 'Verifying',
    prompt: 'Checking the response',
    description:
      'Input remains in DOM order while task controls are unavailable.',
    media: raster('V1'),
  },
  {
    state: 'retryable',
    label: 'Retryable',
    prompt: 'Try the current media again',
    description: '错误说明与 response input 保持显式关联。',
    error: 'The response was not accepted. Try again.',
    media: raster('T1'),
  },
  {
    state: 'reissue',
    label: 'Reissue',
    prompt: 'Request replacement media',
    description: 'The consumer decides retry and cancellation policy.',
    media: raster('N1'),
  },
  {
    state: 'expired',
    label: 'Expired',
    prompt: 'This media is no longer current',
    description: 'Replacement clears stale media, audio, response, and error.',
    media: raster('E1'),
  },
  {
    state: 'unavailable',
    label: 'Unavailable alternative',
    prompt: 'No final media is available',
    description:
      '字符识别替代方式暂不可用；请返回受保护流程选择其他方式。 Character-recognition alternative is unavailable.',
    media: null,
  },
  {
    state: 'disabled',
    label: 'Disabled',
    prompt: 'Character response is disabled',
    description: 'Required response controls remain discoverable but inactive.',
    media: { raster: raster('D1').raster },
  },
]

const responses = reactive<Record<string, string>>(
  Object.fromEntries(fixtures.map((fixture) => [fixture.state, ''])),
)
</script>

<style scoped>
.character-conformance {
  box-sizing: border-box;
  container-type: inline-size;
  max-width: 1180px;
  margin: 0 auto;
  padding: var(--fsus-space-6, 24px);
  color: var(--el-text-color-primary);
}

.character-conformance > header {
  margin-block-end: var(--fsus-space-6, 24px);
}

.character-conformance h1,
.character-conformance h2,
.character-conformance p {
  margin-block-start: 0;
}

.character-conformance__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--fsus-space-4, 16px);
}

.character-conformance__fixture {
  min-width: 0;
  padding: var(--fsus-space-4, 16px);
  border: 1px solid var(--el-border-color);
  border-radius: var(--fsus-radius-panel, 12px);
  background: var(--el-bg-color);
}

.character-conformance__fixture h2 {
  font-size: var(--el-font-size-base, 14px);
  line-height: 1.5;
}

@media (max-width: 720px) {
  .character-conformance {
    padding: var(--fsus-space-3, 12px);
  }

  .character-conformance__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container (max-width: 720px) {
  .character-conformance__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (forced-colors: active) {
  .character-conformance__fixture {
    border-color: CanvasText;
  }
}
</style>
