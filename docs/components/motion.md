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

## Component Motion Prop

关键组件共享同一个 `motion` prop 约定：传 preset 名称启用语义动效，传 `false`
关闭该组件的本地动效。全局 reduced / disabled motion 仍由 `ElConfigProvider`
统一控制。

```vue
<template>
  <el-button motion="scale-fade">保存</el-button>
  <el-card motion="fade-up">评论审核</el-card>
  <el-dialog v-model="open" motion="scale-fade">确认操作</el-dialog>
  <el-drawer v-model="drawerOpen" motion="slide-right">筛选器</el-drawer>
  <el-dropdown motion="fade-down">
    <button>更多</button>
    <template #dropdown>...</template>
  </el-dropdown>
  <el-tooltip motion="fade-scale" content="查看详情">
    <button>?</button>
  </el-tooltip>
  <el-collapse motion="slide-up">...</el-collapse>
  <el-tabs motion="route-fade">...</el-tabs>
  <el-button :motion="false">无动效操作</el-button>
</template>
```

Message 和 Notification 也接受 `motion`：

```ts
ElMessage({ message: '已保存', motion: 'slide-up' })
ElNotification({ title: '完成', message: '同步结束', motion: false })
```

## Presets

Preset gallery：

| Preset         | 用途                         | 建议入口                                    |
| -------------- | ---------------------------- | ------------------------------------------- |
| `fade-in`      | 静态内容淡入                 | 低密度说明、辅助区域                        |
| `fade-up`      | 内容区块进入                 | 文章卡片、搜索结果、设置分区                |
| `fade-down`    | 顶部或触发器下方浮层         | Dropdown、菜单、筛选面板                    |
| `fade-left`    | 从右向左进入的辅助内容       | 右侧摘要、详情预览                          |
| `fade-right`   | 从左向右进入的辅助内容       | 左侧目录、侧栏说明                          |
| `scale-fade`   | 居中浮层或确认面板           | Dialog、Popconfirm、空状态插图              |
| `slide-left`   | 从右侧进入的面板             | 右侧 Drawer、移动端操作面板                 |
| `slide-right`  | 从左侧进入的面板             | 左侧 Drawer、导航侧栏                       |
| `slide-up`     | 从底部进入的反馈             | Message、Notification、底部工具面板         |
| `list-stagger` | 小规模列表错峰               | 不超过 20 项的导航、卡片列表                |
| `route-fade`   | 路由内容切换                 | 主内容区、文章页切换                        |
| `card-hover`   | 可点击卡片的轻量 hover/press | Entry card、管理入口、可交互 Dashboard tile |

## Reduced Motion

当 `ElConfigProvider` 的 `motion.mode` 为 `reduced` / `disabled`，或系统 `prefers-reduced-motion: reduce` 生效时，`v-motion` 和 `FsuTransition` 会跳过位移/缩放过程并直接落到最终状态。

`useTimeline`、`useScrollReveal` 和 `v-scroll-reveal` 同样遵守 reduced motion。
业务组件不应直接创建 ScrollTrigger，也不应在 FsusBlog 页面中散落原始 GSAP
调用；需要新增场景时先封装到 Motion wrapper。

全局关闭：

```vue
<el-config-provider :motion="{ mode: 'disabled' }">
  <RouterView />
</el-config-provider>
```

组件级关闭：

```vue
<el-card :motion="false">文章目录</el-card>
```

## 选择规则

CSS transitions 适合 hover、focus、active、tabs indicator、button press、card lift
这类局部交互。只动 `opacity`、`transform`、`box-shadow` 或颜色 token。

Vue Transition 适合组件 enter/leave：Dialog、Drawer、Dropdown、Tooltip、Message
和路由内容切换。组件只选择 transition/preset，不在业务页面写 class 名。

GSAP timeline 只用于多元素编排或需要暂停、反向、重启的序列。业务页面使用
`useTimeline()`，不要直接 `gsap.timeline()`。

ScrollTrigger 只用于滚动进入视口的内容 reveal。业务页面使用 `v-scroll-reveal`
或 `useScrollReveal()`，不要直接 `ScrollTrigger.create()`。

## Performance Policy

- 优先动画 `transform` 和 `opacity`。
- 避免在热路径动画 `height`、`width`、`top`、`left`、`margin`、`padding`。
- 大列表不要为每一项创建 ScrollTrigger；使用 `list-stagger` 或只 reveal 分组容器。
- 不做 scroll hijacking，不修改用户滚动惯性。
- 阅读型页面保持克制：文章正文、代码块、目录只允许轻量 reveal 或 route fade。
- 移动端减少 blur、shadow 和长距离位移；必要时传 `motion={false}`。
- 动态 markdown、图片、评论或异步卡片加载后显式调用
  `refreshScrollTriggers()`。

## Anti-Patterns

- 不在 FsusBlog 页面直接导入 `gsap` 或 `ScrollTrigger`。
- 不在业务 CSS 里复制 `transition-duration`、`cubic-bezier` 或位移常量。
- 不把 loading、button、tag 的动效做成会改变布局占位的动画。
- 不给大量列表项逐个绑定 `v-scroll-reveal`。
- 不用动效隐藏可访问状态变化；disabled、loading、selected 仍要有明确静态态。

## FsusBlog Integration

文章列表：

```vue
<article
  v-for="(post, index) in posts"
  :key="post.slug"
  v-motion="{ name: 'list-stagger', index }"
>
  <PostCard :post="post" />
</article>
```

文章正文和动态 markdown：

```ts
import { nextTick, watch } from 'vue'
import { refreshScrollTriggers } from 'element-plus'

watch(markdownHtml, async () => {
  await nextTick()
  refreshScrollTriggers()
})
```

管理入口：

```vue
<el-card motion="card-hover">
  <h3>评论审核</h3>
  <p>审核队列、模型风险信号和地区策略结果。</p>
</el-card>
```

路由页面：

```ts
import { onBeforeRouteLeave } from 'vue-router'
import { useMotionRouteCleanup, useScrollReveal } from 'element-plus'

const routeMotion = useMotionRouteCleanup()
const reveal = useScrollReveal()

routeMotion.add(reveal.kill)
onBeforeRouteLeave(routeMotion.cleanup)
```

## QA Checklist

- Route leave 后，context、timeline 和 scroll reveal 的 cleanup 都被调用。
- 组件 unmount 后没有残留 ScrollTrigger 或未 kill 的 timeline。
- `motion={false}` 在 Button、Card、Dialog、Drawer、Dropdown、Tooltip、Message、
  Notification、Collapse、Tabs 上都能禁用本地动效。
- `ElConfigProvider motion.mode="reduced"` 和系统 `prefers-reduced-motion: reduce`
  都会落到最终视觉状态。
- 动态 markdown、图片加载、评论展开后调用了 `refreshScrollTriggers()`。
- 桌面和移动端均无文字重叠、按钮换行挤压、固定列透底或布局跳动。
