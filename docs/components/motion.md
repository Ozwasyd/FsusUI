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

## Presets

第一批 preset 包括：

`fade-in`、`fade-up`、`fade-down`、`fade-left`、`fade-right`、`scale-fade`、`slide-left`、`slide-right`、`slide-up`、`list-stagger`、`route-fade`、`card-hover`。

## Reduced Motion

当 `ElConfigProvider` 的 `motion.mode` 为 `reduced` / `disabled`，或系统 `prefers-reduced-motion: reduce` 生效时，`v-motion` 和 `FsuTransition` 会跳过位移/缩放过程并直接落到最终状态。
