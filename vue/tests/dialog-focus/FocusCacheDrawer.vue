<script setup lang="ts">
import { ref } from 'vue'
import { ElDrawer } from '@ozwasyd/element-plus'

interface FixtureItem {
  kind: 'negative' | 'control'
  id: string
  label: string
  index?: number
}

const params = new URLSearchParams(window.location.search)
const count =
  params.get('count') === '0' ? 0 : params.get('count') === '1' ? 1 : 2
const position = params.get('position') ?? 'before'
const nested = params.get('nested') === '1'
const open = ref(false)
const opened = ref(false)
const nestedOpen = ref(false)
const nestedOpened = ref(false)
const items = Array.from(
  { length: count },
  (_, index): FixtureItem => ({
    kind: 'control',
    id: `control-${index}`,
    label: nested && index === 0 ? 'Open nested drawer' : `Action ${index + 1}`,
    index,
  }),
)
const negativeIndex =
  position === 'after' ? count : position === 'between' ? Math.min(1, count) : 0
items.splice(negativeIndex, 0, {
  kind: 'negative',
  id: 'programmatic-target',
  label: 'Focus target',
})

function activate(item: FixtureItem) {
  if (nested && item.index === 0) nestedOpen.value = true
}
</script>

<template>
  <button id="focus-opener" type="button" @click="open = true">
    Open drawer
  </button>
  <output aria-label="Drawer readiness">{{
    opened ? 'Ready' : 'Closed'
  }}</output>
  <output aria-label="Nested drawer readiness">{{
    nestedOpened ? 'Ready' : 'Closed'
  }}</output>
  <button id="outside-target" type="button">Outside target</button>
  <ElDrawer
    v-model="open"
    title="Focus containment"
    :with-header="false"
    :show-close="false"
    append-to-body
    @opened="opened = true"
    @closed="opened = false"
  >
    <template v-for="item in items" :key="item.id">
      <span v-if="item.kind === 'negative'" :id="item.id" tabindex="-1">{{
        item.label
      }}</span>
      <button v-else :id="item.id" type="button" @click="activate(item)">
        {{ item.label }}
      </button>
    </template>
    <ElDrawer
      v-if="nested"
      v-model="nestedOpen"
      title="Nested containment"
      :with-header="false"
      :show-close="false"
      append-to-body
      @opened="nestedOpened = true"
      @closed="nestedOpened = false"
    >
      <span id="nested-programmatic-target" tabindex="-1"
        >Nested focus target</span
      >
      <button id="nested-control-0" type="button">Nested action 1</button>
      <button id="nested-control-1" type="button">Nested action 2</button>
    </ElDrawer>
  </ElDrawer>
</template>
