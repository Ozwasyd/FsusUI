# PerceptionChallenge 感知挑战

`ElPerceptionChallenge` 提供 protocol-neutral perception challenge host。组件只负责渲染任务、状态和事件，不绑定业务后端 URL；调用方注入 `challenge`、`client` 或监听 `submit` 后自行完成验证。

视觉、密度、字体、焦点、动效与 forced-colors 行为遵循
[`docs/design.md`](../design.md)。Character primitive 是展示和录入边界，不是安全或协议边界。

## 最小接入

### character

`character` 是独立 kind，不会归一化到通用 `text-task` 分支。`characterMedia`
只描述调用方已经准备好的最终媒体；组件不生成字符、不下载媒体、不定义
token、proof、risk score、machine error code 或 provider wire protocol，也不验证答案。
调用方拥有 Dialog 组合、protocol、取消、重试策略和受保护工作流。光栅替代文本只描述
媒体用途，不能包含答案；audio 使用原生 controls，必须由用户发起且永不 autoplay。

```vue
<template>
  <ElPerceptionChallenge
    :challenge="characterTask"
    state="ready"
    @submit="submitCharacterResponse"
    @refresh="requestReplacement"
    @reissue="requestReplacement"
  />
</template>

<script setup lang="ts">
const characterTask = {
  challengeId: 'character-1',
  kind: 'character',
  prompt: 'Enter the characters shown in the image.',
  characterMedia: {
    raster: {
      kind: 'image-url',
      src: '/consumer-owned/challenge.png',
      width: 240,
      height: 80,
    },
    audio: {
      src: '/consumer-owned/challenge.mp3',
      type: 'audio/mpeg',
    },
  },
}
</script>
```

需要直接控制字段、焦点或重置时，可以使用 `ElPerceptionCharacterChallenge`。它公开 `focus()`、`reset()` 和 `inputRef`；这些 exposed members 也是生成的 Vue public baseline 与 component contract 的一部分。组件支持 `raster` / `audio` slots，并发出 `update:modelValue`、`submit`、`refresh`、`alternative`、`retry`、`reissue`。challenge identity 改变或调用方替换 media descriptor 时都会清除旧 response 与可见错误；refresh/reissue 后只在替换媒体进入 `ready` 且 identity 已改变时把焦点送回输入框。

### Character 状态、键盘与资源所有权

- 确定状态为 `loading | ready | verifying | retryable | reissue | expired |
unavailable | disabled`。仅 `ready` / `retryable` 接受输入；busy、过期、重发、不可用和
  disabled 均不会提交。
- DOM 与 Tab 顺序固定为 alternative、refresh、response input、submit、state action；
  reduced motion 只移除非必要过渡，不改变任务可用性或 DOM 顺序。Enter 在 response input
  提交，Tab / Shift+Tab 使用浏览器原生顺序；组件不接管 Dialog 的 Escape 或焦点圈闭。
- label 显式关联 response input；状态与错误共用一个组件级 live region owner，错误通过
  `aria-describedby` 关联到输入。音频切换按钮只切换 alternative，不自动播放。
- 传入 `ImageBitmap` 后，其生命周期移交给当前 primitive；媒体被替换或组件卸载时调用
  `close()`。即使 `challengeId`、audio URL 或光栅尺寸不变，只要 media descriptor 被替换，
  旧 audio element 也会 pause、移除 source 并 reload，同时清除旧 response/error；组件不会
  复用旧 bitmap、RGBA canvas frame 或 audio control。URL 和 RGBA 数据仍由调用方拥有。
- desktop 和 mobile 均保持必需控件可换行；200% / 400% zoom 不隐藏 response input 或
  state action。forced-colors / high contrast 保留外框、错误边界与原生 focus indicator。

### Character 相关 token

`--fsus-space-2`、`--fsus-space-3`、`--fsus-radius-control`、
`--fsus-radius-panel`、`--fsus-border`、`--fsus-scholarly-blue`、
`--el-color-danger`、`--fsus-motion-control` 与 canonical disabled/focus tokens。

### Known limitations

Web primitive 不解码、生成或验证 media，也不拥有 Dialog、协议、网络取消和 retry policy。
浏览器原生 audio controls 的内部布局由平台决定；使用 slot 替换时调用方仍必须保证
user-initiated playback、等价 accessible name 与清理旧媒体。Avalonia 的语义等价组件通过
事件请求音频播放，实际音频设备与播放器由 consumer 提供。

### text-task

```vue
<template>
  <ElPerceptionChallenge
    :challenge="textTask"
    state="ready"
    @submit="handleSubmit"
    @cancel="handleCancel"
    @refresh="handleRefresh"
    @expired="handleExpired"
    @verified="handleVerified"
  />
</template>

<script setup lang="ts">
const textTask = {
  challengeId: 'text-1',
  kind: 'text-task',
  prompt: 'Enter the visible characters.',
}
</script>
```

### localization

```vue
<template>
  <ElPerceptionChallenge
    :challenge="localizationTask"
    state="ready"
    @submit="handleSubmit"
  />
</template>

<script setup lang="ts">
const localizationTask = {
  challengeId: 'localize-1',
  kind: 'localization',
  prompt: 'Select the marked point.',
  gridWidth: 120,
  gridHeight: 64,
  renderPayload: {
    kind: 'image-url',
    src: '/challenge/localize-1.png',
    width: 120,
    height: 64,
    alt: 'Challenge target',
  },
}
</script>
```

### micro-interaction

```vue
<template>
  <ElPerceptionChallenge
    :challenge="microInteractionTask"
    state="ready"
    @submit="handleSubmit"
  />
</template>

<script setup lang="ts">
const microInteractionTask = {
  challengeId: 'micro-1',
  kind: 'micro-interaction',
  prompt: 'Confirm the interaction.',
  microInteractionEnabled: true,
}
</script>
```

## 状态与事件

Character primitive 的确定性状态是 `loading | ready | verifying | retryable | reissue | unavailable | expired | disabled`。host 继续兼容 `idle`、`submitting`、`failed`、`verified`、`error`，其中 `submitting` 按 busy/verifying 展示，`failed` 按 error 展示。

事件：`submit`、`cancel`、`refresh`、`expired`、`verified`。当 `state="expired"`、`proofExpired` 或 `expiresAtUnixMs` 到期时会触发 `expired`，同一 challenge 只触发一次。
