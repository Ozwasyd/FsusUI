# PerceptionChallenge 感知挑战

`ElPerceptionChallenge` 提供 protocol-neutral perception challenge host。组件只负责渲染任务、状态和事件，不绑定业务后端 URL；调用方注入 `challenge`、`client` 或监听 `submit` 后自行完成验证。

## 最小接入

### character

`character` 是独立 kind，不会归一化到 `text-task`。`characterMedia` 只描述调用方已经准备好的最终媒体；组件不生成字符、不下载媒体、不定义 token/proof/provider wire protocol，也不验证答案。光栅的替代文本应描述媒体用途，不能包含答案；audio 使用原生 controls 且永不 autoplay。

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

需要直接控制字段、焦点或重置时，可以使用 `ElPerceptionCharacterChallenge`。它公开 `focus()`、`reset()` 和 `inputRef`，支持 `raster` / `audio` slots，并发出 `update:modelValue`、`submit`、`refresh`、`alternative`、`retry`、`reissue`。challenge identity 改变时会清除旧 response 与可见错误；refresh/reissue 后只在替换媒体进入 `ready` 且 identity 已改变时把焦点送回输入框。

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
