<template>
  <div
    id="view-transitions"
    class="demo-section view-transition-demo"
    data-testid="section-view-transitions"
  >
    <h2>View Transitions progressive enhancement</h2>
    <p>
      The consumer supplies business intent and the DOM update. FsusUI owns
      capability detection, reduced motion, interruption and fallback cleanup.
    </p>

    <div class="demo-block">
      <h3>State replacement and route crossfade</h3>
      <div class="view-transition-demo__actions">
        <button
          class="el-button"
          type="button"
          data-testid="vt-state"
          @click="replaceState"
        >
          <span>Replace state</span>
        </button>
        <button
          class="el-button"
          type="button"
          data-testid="vt-route"
          @click="crossfadeRoute"
        >
          <span>Simulate route commit</span>
        </button>
        <button
          class="el-button"
          type="button"
          data-testid="vt-fallback"
          @click="forceFallback"
        >
          <span>Verify unsupported fallback</span>
        </button>
      </div>
      <article class="view-transition-demo__surface" data-testid="vt-surface">
        <strong>{{ routeName }}</strong>
        <span>{{ settled ? 'Settled result' : 'Initial result' }}</span>
      </article>
    </div>

    <div class="demo-block">
      <h3>Theme mode and bounded shared element</h3>
      <div class="view-transition-demo__actions">
        <button
          class="el-button"
          type="button"
          data-testid="vt-theme"
          @click="toggleTheme"
        >
          <span>Toggle local theme</span>
        </button>
        <button
          class="el-button"
          type="button"
          data-testid="vt-shared"
          @click="moveSharedElement"
        >
          <span>Move shared element</span>
        </button>
      </div>
      <div
        class="view-transition-demo__theme"
        :class="{ 'is-dark': dark }"
        data-testid="vt-theme-surface"
      >
        <div class="view-transition-demo__shared-track">
          <FsuSharedElement
            id="view-transition-demo-card"
            class="view-transition-demo__shared"
            :class="{ 'is-end': sharedAtEnd }"
          >
            Shared card
          </FsuSharedElement>
        </div>
      </div>
    </div>

    <p aria-live="polite" data-testid="vt-status">{{ status }}</p>
    <p class="view-transition-demo__note">
      SSR/AOT: call the adapter only after hydration is ready. Importing it does
      not access window or document and never changes server-rendered DOM shape.
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  FsuSharedElement,
  runMotionRecipeUpdate,
  runViewTransition,
  useSharedElementMotion,
} from '@element-plus/motion'

const dark = ref(false)
const routeName = ref('Overview route')
const settled = ref(false)
const sharedAtEnd = ref(false)
const status = ref('Ready; no transition has run.')
const shared = useSharedElementMotion()

const report = async (
  label: string,
  result: ReturnType<typeof runViewTransition>,
) => {
  status.value = `${label}: ${result.mode} backend selected.`
  await result.finished
}

const replaceState = () =>
  report(
    'State replacement',
    runMotionRecipeUpdate(() => {
      settled.value = !settled.value
    }, 'state-settled'),
  )

const crossfadeRoute = () =>
  report(
    'Route crossfade',
    runMotionRecipeUpdate(() => {
      routeName.value =
        routeName.value === 'Overview route' ? 'Detail route' : 'Overview route'
    }, 'route-crossfade'),
  )

const forceFallback = () =>
  report(
    'Unsupported capability',
    runViewTransition(
      () => {
        settled.value = !settled.value
      },
      { disabled: true, name: 'unsupported-fallback' },
    ),
  )

const toggleTheme = () =>
  report(
    'Theme mode',
    runViewTransition(
      () => {
        dark.value = !dark.value
      },
      { name: 'theme-mode' },
    ),
  )

const moveSharedElement = () => {
  const result = shared.run('view-transition-demo-card', async () => {
    sharedAtEnd.value = !sharedAtEnd.value
    await nextTick()
  })
  return report('Shared element', result)
}
</script>

<style scoped>
.view-transition-demo__surface {
  display: grid;
  gap: 8px;
  min-height: 96px;
  margin-top: 16px;
  padding: 20px;
  border: 1px solid var(--fsus-border, #d4d4d8);
  border-radius: var(--fsus-radius-panel, 16px);
  background: var(--fsus-paper, #fff);
}

.view-transition-demo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.view-transition-demo__theme {
  margin-top: 16px;
  padding: 20px;
  color: #18181b;
  background: #fafafa;
  border-radius: var(--fsus-radius-panel, 16px);
}

.view-transition-demo__theme.is-dark {
  color: #f4f4f5;
  background: #18181b;
}

.view-transition-demo__shared-track {
  position: relative;
  min-height: 88px;
}

.view-transition-demo__shared {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-start: 8px;
  display: grid;
  place-items: center;
  width: 140px;
  height: 64px;
  border: 1px solid currentcolor;
  border-radius: 12px;
}

.view-transition-demo__shared.is-end {
  inset-inline-start: calc(100% - 148px);
}

.view-transition-demo__note {
  color: var(--fsus-text-secondary, #52525b);
}
</style>
