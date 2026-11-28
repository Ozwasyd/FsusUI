<script setup lang="ts">
import type { CheckboxValueType } from '@ozwasyd/fsusui'
import { ref } from 'vue'
import { FsusCheckboxButton } from '@ozwasyd/fsusui'

const first = ref<CheckboxValueType>(true)
const second = ref<CheckboxValueType>(false)
const third = ref<CheckboxValueType>(false)
</script>

<template>
  <div style="display: inline-flex; gap: 8px; padding: 24px; background: #fff">
    <fsus-checkbox-button v-model="first">Checked</fsus-checkbox-button>
    <fsus-checkbox-button v-model="second">Unchecked</fsus-checkbox-button>
    <fsus-checkbox-button v-model="third" disabled>Disabled</fsus-checkbox-button>
  </div>
</template>
