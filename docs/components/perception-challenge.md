# PerceptionChallenge 感知挑战

`ElPerceptionChallenge` 提供 perception v2 challenge host。组件只负责渲染任务、状态和事件，不绑定业务后端 URL；调用方注入 `challenge`、`client` 或监听 `submit` 后自行完成验证。

## 最小接入

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

支持状态：`loading`、`ready`、`submitting`、`failed`、`expired`、`verified`。兼容旧状态 `idle`、`verifying`、`error`，其中 `submitting` 按 busy/verifying 展示，`failed` 按 error 展示。

事件：`submit`、`cancel`、`refresh`、`expired`、`verified`。当 `state="expired"`、`proofExpired` 或 `expiresAtUnixMs` 到期时会触发 `expired`，同一 challenge 只触发一次。
