<template>
  <svg v-bind="svgAttrs" viewBox="0 0 160 160" version="1.1">
    <g
      id="Illustrations"
      fill="none"
      fill-rule="evenodd"
    >
      <g transform="translate(80.000000, 80.000000)">
        <!-- Outer Orbit -->
        <circle
          cx="0"
          cy="0"
          r="48"
          :stroke="`var(${ns.cssVarBlockName('border-color')})`"
          stroke-width="0.8"
          stroke-dasharray="2 4"
        />
        <!-- Inner Orbit -->
        <circle
          cx="0"
          cy="0"
          r="24"
          :stroke="`var(${ns.cssVarBlockName('border-color')})`"
          stroke-width="0.8"
        />
        <!-- Center Node -->
        <circle
          cx="0"
          cy="0"
          r="6"
          :fill="`var(--el-color-primary)`"
          opacity="0.8"
        />
        <!-- Orbiting Nodes -->
        <circle
          cx="-34"
          cy="-34"
          r="3"
          :fill="`var(${ns.cssVarBlockName('border-color')})`"
          opacity="0.5"
        />
        <circle
          cx="40"
          cy="26"
          r="4"
          :stroke="`var(--el-color-primary)`"
          stroke-width="1"
        />
        <!-- Decorator Line -->
        <line
          x1="-48"
          y1="0"
          x2="-64"
          y2="0"
          :stroke="`var(${ns.cssVarBlockName('border-color')})`"
          stroke-width="0.8"
        />
        <line
          x1="0"
          y1="-48"
          x2="0"
          y2="-64"
          :stroke="`var(${ns.cssVarBlockName('border-color')})`"
          stroke-width="0.8"
        />
        <line
          x1="48"
          y1="0"
          x2="64"
          y2="0"
          :stroke="`var(${ns.cssVarBlockName('border-color')})`"
          stroke-width="0.8"
        />
      </g>
    </g>
  </svg>
</template>

<script lang="ts" setup>
import { useNamespace } from '@element-plus/hooks'

defineOptions({
  name: 'ImgEmpty',
})

const ns = useNamespace('empty')

const svgAttrs = {
  xmlns: 'http://www.w3.org/2000/svg',
  'xmlns:xlink': 'http://www.w3.org/1999/xlink',
}
</script>
