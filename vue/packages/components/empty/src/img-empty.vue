<template>
  <svg
    v-bind="svgAttrs"
    viewBox="0 0 160 160"
    version="1.1"
    fill="none"
    stroke="currentColor"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M48 28h48l18 18v76H48z"
      stroke-width="1.5"
      opacity="0.35"
    />
    <path d="M36 40h56l20 20v72H36z" stroke-width="2" />
    <path d="M92 40v20h20" stroke-width="2" />
    <path d="M54 78h40M54 94h40M54 110h28" stroke-width="2" opacity="0.62" />
  </svg>
</template>

<script lang="ts" setup>
defineOptions({
  name: 'ImgEmpty',
})

const svgAttrs = {
  xmlns: 'http://www.w3.org/2000/svg',
}
</script>
