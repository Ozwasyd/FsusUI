# InfiniteScroll

Automatically runs a loading method when scrolling reaches the bottom.

> **Warning:** This directive is deprecated and will be removed in 3.0.0. Use [Scrollbar's infinite-scroll feature](./scrollbar.md) instead.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Add `v-infinite-scroll` to a list element and bind a loading function; it is called automatically at the bottom.

```vue
<ul v-infinite-scroll="loadMore" :infinite-scroll-disabled="loading">
  <li v-for="item in list" :key="item">{{ item }}</li>
</ul>
```

---

## API

### Directives

| 指令名 | 说明 | 类型 | 默认值 |
|--------|------|------|--------|
| v-infinite-scroll | 滚动到底部时触发的加载函数 | `Function` | — |
| infinite-scroll-disabled | 是否禁用 | `boolean` | `false` |
| infinite-scroll-delay | 节流延迟（ms） | `number` | `200` |
| infinite-scroll-distance | 触发距离（px）—— 距底部多少像素时触发 | `number` | `0` |
| infinite-scroll-immediate | 是否立即执行一次（防止初始内容不足时未触发） | `boolean` | `true` |
