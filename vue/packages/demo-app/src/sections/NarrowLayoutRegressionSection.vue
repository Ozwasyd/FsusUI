<template>
  <main class="narrow-regression-host" data-testid="narrow-layout-regressions">
    <section
      v-if="showFixture('thread-panel')"
      class="narrow-regression-block"
      data-testid="thread-panel-regression"
    >
      <div data-testid="thread-panel-both">
        <FsusThreadPanel
          title="Inbox QA support case"
          title-tag="h2"
          density="compact"
        >
          <template #back>
            <FsusButton text @click="backClicks += 1">
              Back to conversations
            </FsusButton>
          </template>
          <template #actions>
            <FsusButton text @click="reloadClicks += 1">
              Reload conversation
            </FsusButton>
          </template>
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </FsusThreadPanel>
      </div>

      <div data-testid="thread-panel-back-only">
        <FsusThreadPanel
          title="Back only thread title"
          title-tag="h2"
          density="compact"
        >
          <template #back>
            <FsusButton text>Back to conversations</FsusButton>
          </template>
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </FsusThreadPanel>
      </div>

      <div data-testid="thread-panel-actions-only">
        <FsusThreadPanel
          title="Actions only thread title"
          title-tag="h2"
          density="compact"
        >
          <template #actions>
            <FsusButton text>Reload conversation</FsusButton>
          </template>
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </FsusThreadPanel>
      </div>

      <div data-testid="thread-panel-title-only">
        <FsusThreadPanel
          title="Title only thread"
          title-tag="h2"
          density="compact"
        >
          <template #messages>
            <p class="narrow-regression-message">Example message</p>
          </template>
        </FsusThreadPanel>
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
        <FsusCheckbox v-model="checkedLong">
          I have verified these changes and confirm updating public site
          configuration immediately.
        </FsusCheckbox>
      </div>

      <div data-testid="checkbox-long-disabled">
        <FsusCheckbox :model-value="false" disabled>
          I have verified these changes and confirm updating public site
          configuration immediately.
        </FsusCheckbox>
      </div>

      <div data-testid="checkbox-short-enabled">
        <FsusCheckbox v-model="checkedShort">Confirm changes</FsusCheckbox>
      </div>

      <div data-testid="checkbox-long-bordered">
        <FsusCheckbox v-model="checkedBordered" border>
          I have verified these changes and confirm updating public site
          configuration immediately.
        </FsusCheckbox>
      </div>

      <div data-testid="checkbox-group-long">
        <FsusCheckboxGroup v-model="groupSelection">
          <FsusCheckbox label="first">
            I have verified these changes and confirm updating public site
            configuration immediately.
          </FsusCheckbox>
          <FsusCheckbox label="second">
            Notify workspace administrators after publishing updated site
            configuration.
          </FsusCheckbox>
        </FsusCheckboxGroup>
      </div>
    </section>

    <section
      v-if="showFixture('resource-list')"
      class="narrow-regression-block"
      data-testid="resource-list-regression"
    >
      <div data-testid="toggle-resource-badge-wrap">
        <FsusButton
          v-bind="{ 'data-testid': 'toggle-resource-badge' }"
          @click="named = !named"
        >
          Toggle name
        </FsusButton>
      </div>
      <FsusResourceList>
        <FsusResourceListItem
          v-bind="{ 'data-testid': 'resource-list-dynamic' }"
          :title="named ? 'Named device' : 'Current device'"
        >
          <template v-if="named" #badge>
            <FsusTag>Current device</FsusTag>
          </template>
        </FsusResourceListItem>
        <FsusResourceListItem
          v-bind="{ 'data-testid': 'resource-list-initial' }"
          title="Initial named device"
        >
          <template #badge>
            <FsusTag>Current device</FsusTag>
          </template>
        </FsusResourceListItem>
      </FsusResourceList>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  FsusButton,
  FsusCheckbox,
  FsusCheckboxGroup,
  FsusResourceList,
  FsusResourceListItem,
  FsusTag,
  FsusThreadPanel,
  type CheckboxGroupValueType,
  type CheckboxValueType,
} from '@ozwasyd/fsusui'

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
