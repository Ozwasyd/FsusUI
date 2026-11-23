<template>
  <main class="narrow-regression-host" data-testid="narrow-layout-regressions">
    <section
      v-if="showFixture('thread-panel')"
      class="narrow-regression-block"
      data-testid="thread-panel-regression"
    >
      <div data-testid="thread-panel-both">
        <ElThreadPanel
          title="Inbox QA support case"
          title-tag="h2"
          density="compact"
        >
          <template #back>
            <ElButton text @click="backClicks += 1">
              Back to conversations
            </ElButton>
          </template>
          <template #actions>
            <ElButton text @click="reloadClicks += 1">
              Reload conversation
            </ElButton>
          </template>
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </ElThreadPanel>
      </div>

      <div data-testid="thread-panel-back-only">
        <ElThreadPanel
          title="Back only thread title"
          title-tag="h2"
          density="compact"
        >
          <template #back>
            <ElButton text>Back to conversations</ElButton>
          </template>
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </ElThreadPanel>
      </div>

      <div data-testid="thread-panel-actions-only">
        <ElThreadPanel
          title="Actions only thread title"
          title-tag="h2"
          density="compact"
        >
          <template #actions>
            <ElButton text>Reload conversation</ElButton>
          </template>
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </ElThreadPanel>
      </div>

      <div data-testid="thread-panel-title-only">
        <ElThreadPanel
          title="Title only thread"
          title-tag="h2"
          density="compact"
        >
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </ElThreadPanel>
      </div>

      <span data-testid="thread-panel-click-counts">
        {{ backClicks }}:{{ reloadClicks }}
      </span>
    </section>

    <section
      v-if="showFixture('checkbox')"
      class="narrow-regression-block"
      data-testid="checkbox-regression"
    >
      <div data-testid="checkbox-long-enabled">
        <ElCheckbox v-model="checkedLong">
          I have verified these changes and confirm updating public site
          configuration immediately.
        </ElCheckbox>
      </div>

      <div data-testid="checkbox-long-disabled">
        <ElCheckbox :model-value="false" disabled>
          I have verified these changes and confirm updating public site
          configuration immediately.
        </ElCheckbox>
      </div>

      <div data-testid="checkbox-short-enabled">
        <ElCheckbox v-model="checkedShort">Confirm changes</ElCheckbox>
      </div>

      <div data-testid="checkbox-long-bordered">
        <ElCheckbox v-model="checkedBordered" border>
          I have verified these changes and confirm updating public site
          configuration immediately.
        </ElCheckbox>
      </div>

      <div data-testid="checkbox-group-long">
        <ElCheckboxGroup v-model="groupSelection">
          <ElCheckbox label="first">
            I have verified these changes and confirm updating public site
            configuration immediately.
          </ElCheckbox>
          <ElCheckbox label="second">
            Notify workspace administrators after publishing updated site
            configuration.
          </ElCheckbox>
        </ElCheckboxGroup>
      </div>
    </section>

    <section
      v-if="showFixture('resource-list')"
      class="narrow-regression-block"
      data-testid="resource-list-regression"
    >
      <div data-testid="toggle-resource-badge-wrap">
        <ElButton
          v-bind="{ 'data-testid': 'toggle-resource-badge' }"
          @click="named = !named"
        >
          Toggle name
        </ElButton>
      </div>
      <ElResourceList>
        <ElResourceListItem
          v-bind="{ 'data-testid': 'resource-list-dynamic' }"
          :title="named ? 'Named device' : 'Current device'"
        >
          <template v-if="named" #badge>
            <ElTag>Current device</ElTag>
          </template>
        </ElResourceListItem>
        <ElResourceListItem
          v-bind="{ 'data-testid': 'resource-list-initial' }"
          title="Initial named device"
        >
          <template #badge>
            <ElTag>Current device</ElTag>
          </template>
        </ElResourceListItem>
      </ElResourceList>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElResourceList,
  ElResourceListItem,
  ElTag,
  ElThreadPanel,
  type CheckboxGroupValueType,
  type CheckboxValueType,
} from '../../../element-plus'

const params =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()
const activeFixture = params.get('fixture') || 'all'
const showFixture = (name: string) =>
  activeFixture === 'all' || activeFixture === name

const backClicks = ref(0)
const reloadClicks = ref(0)
const checkedLong = ref<CheckboxValueType>(false)
const checkedShort = ref<CheckboxValueType>(false)
const checkedBordered = ref<CheckboxValueType>(false)
const groupSelection = ref<CheckboxGroupValueType>([])
const named = ref(false)
</script>

<style scoped>
.narrow-regression-host {
  display: grid;
  gap: 24px;
  min-width: 0;
  width: 100%;
}

.narrow-regression-block {
  display: grid;
  gap: 16px;
  min-width: 0;
  width: 100%;
}

.narrow-regression-message {
  margin: 0;
  padding: 12px;
}
</style>
