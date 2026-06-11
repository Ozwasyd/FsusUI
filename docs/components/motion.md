# Motion 动效

Motion 提供 FsusUI 的语义化动效层。业务页面只选择 preset，不直接编写底层 `transform`、`duration` 或 GSAP 参数。

## 基础用法

完整安装 FsusUI 后会自动注册 `v-motion` 和 `FsuTransition`。

```vue
<template>
  <article v-motion="'fade-up'">文章摘要</article>
</template>
```

对象写法可覆盖 duration、delay、easing，并支持 `once`。

```vue
<template>
  <section
    v-motion="{
      name: 'fade-up',
      duration: 220,
      delay: 80,
      once: true,
    }"
  >
    内容区块
  </section>
</template>
```

## 卡片

```vue
<template>
  <el-card v-motion="'fade-up'">
    <h3>评论审核</h3>
    <p>审核队列、风险信号和地区策略结果。</p>
  </el-card>
</template>
```

## 对话框

```vue
<template>
  <FsuTransition name="scale-fade">
    <el-dialog v-if="open" model-value title="确认操作">
      操作完成后不可恢复。
    </el-dialog>
  </FsuTransition>
</template>
```

## 下拉面板

```vue
<template>
  <FsuTransition name="fade-down">
    <div v-if="visible" class="menu-panel">
      <button>编辑</button>
      <button>归档</button>
    </div>
  </FsuTransition>
</template>
```

## 列表错峰

```vue
<template>
  <ul>
    <li
      v-for="(item, index) in items"
      :key="item.id"
      v-motion="{ name: 'list-stagger', index }"
    >
      {{ item.title }}
    </li>
  </ul>
</template>
```

## Timeline

使用 `useTimeline` 编排多个元素。业务页面只添加 preset step，不直接拼 GSAP
timeline 参数。

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTimeline } from 'element-plus'

const titleRef = ref<HTMLElement>()
const summaryRef = ref<HTMLElement>()
const timeline = useTimeline()

onMounted(() => {
  timeline
    .add({ target: titleRef, preset: 'fade-up' })
    .add({ target: summaryRef, preset: 'fade-up', position: '-=0.08' })
    .play()
})
</script>
```

## Scroll Reveal

完整安装后会自动注册 `v-scroll-reveal`。它会通过 FsusUI 管理
ScrollTrigger 注册、实例清理和 reduced motion 终态。

```vue
<template>
  <section v-scroll-reveal="{ name: 'fade-up', once: true }">
    动态内容区块
  </section>
</template>
```

组合式用法：

```ts
import { onMounted, ref } from 'vue'
import { useScrollReveal } from 'element-plus'

const blockRef = ref<HTMLElement>()
const reveal = useScrollReveal({ target: blockRef, name: 'fade-up' })

onMounted(() => {
  reveal.reveal()
})
```

## GSAP Context

自定义编排必须包在 `useGsapContext` 中，组件卸载或路由离开时调用
`revert()`。

```ts
import { onMounted, ref } from 'vue'
import { getGsap, useGsapContext } from 'element-plus'

const scope = ref<HTMLElement>()
const motion = useGsapContext(scope)

onMounted(() => {
  motion.create(() => {
    getGsap().set('.title', { opacity: 1 })
  })
})
```

## Route Cleanup

路由页面里创建的 context、timeline 和 scroll reveal 都要加入清理桶。离开路由
时清理动画实例，并在清理后刷新 ScrollTrigger。

```ts
import { onBeforeRouteLeave } from 'vue-router'
import {
  useGsapContext,
  useMotionRouteCleanup,
  useScrollReveal,
  useTimeline,
} from 'element-plus'

const routeMotion = useMotionRouteCleanup()
const context = useGsapContext()
const timeline = useTimeline()
const reveal = useScrollReveal()

routeMotion.add(context.revert)
routeMotion.add(timeline.kill)
routeMotion.add(reveal.kill)

onBeforeRouteLeave(() => {
  routeMotion.cleanup()
})
```

## Dynamic Content Refresh

Markdown、图片、评论列表等内容在初次渲染后改变高度时，等待内容稳定后调用
`refreshScrollTriggers()`。调用端不需要直接访问 `ScrollTrigger.refresh()`。

```ts
import { nextTick } from 'vue'
import { refreshScrollTriggers } from 'element-plus'

await nextTick()
refreshScrollTriggers()
```

## Presets

第一批 preset 包括：

`fade-in`、`fade-up`、`fade-down`、`fade-left`、`fade-right`、`scale-fade`、`slide-left`、`slide-right`、`slide-up`、`list-stagger`、`route-fade`、`card-hover`。

## Reduced Motion

当 `ElConfigProvider` 的 `motion.mode` 为 `reduced` / `disabled`，或系统 `prefers-reduced-motion: reduce` 生效时，`v-motion` 和 `FsuTransition` 会跳过位移/缩放过程并直接落到最终状态。

`useTimeline`、`useScrollReveal` 和 `v-scroll-reveal` 同样遵守 reduced motion。
业务组件不应直接创建 ScrollTrigger，也不应在 FsusBlog 页面中散落原始 GSAP
调用；需要新增场景时先封装到 Motion wrapper。
