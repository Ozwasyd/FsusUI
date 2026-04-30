# InfiniteScroll 无限滚动

滚动到底部时自动执行加载方法。

> **警告**：该指令已被标记为废弃，将在 3.0.0 版本移除。请改用 [Scrollbar 的无限滚动功能](./scrollbar.md)。

> 💡 **运行示例**：启动 demo-app（`pnpm dev`，端口 5173）查看交互效果。

---

## 基础用法

在列表元素上添加 `v-infinite-scroll` 指令，绑定加载函数，滚动到底部时自动调用。

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
