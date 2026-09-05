# PerceptionChallenge

`ElPerceptionChallenge` provides a protocol-neutral perception-challenge host. It renders the task, state, and events without binding to a backend URL; consumers inject `challenge` or `client`, or handle verification after listening for `submit`.

Visual, density, typography, focus, motion, and forced-colors behavior follow
[`docs/design.md`](../design.md). The Character primitive is a display and input boundary, not a security or protocol boundary.

## Minimal Integration

### character

`character` is a distinct kind and is not normalized into the generic `text-task` branch.
`characterMedia` describes only final media already prepared by the consumer; the component does not generate characters, download media, define tokens, proofs, risk scores, machine error codes, or provider wire protocols, and does not verify answers.
The consumer owns Dialog composition, protocol, cancellation, retry policy, and protected workflow. Raster alternative text describes the media purpose only and must not contain the answer; audio uses native controls, must be user-initiated, and never autoplays.

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

Use `ElPerceptionCharacterChallenge` when direct control of fields, focus, or reset is needed. It exposes `focus()`, `reset()`, and `inputRef`; these exposed members are part of the generated Vue public baseline and component contract. The component supports `raster` / `audio` slots and emits `update:modelValue`, `submit`, `refresh`, `alternative`, `retry`, and `reissue`. A changed challenge identity or replacement media descriptor clears the old response and visible error; after refresh/reissue, focus returns to the input only when replacement media is `ready` and its identity changed.

### Character State, Keyboard, and Resource Ownership

- Deterministic states are `loading | ready | verifying | retryable | reissue | expired | unavailable | disabled`. Only `ready` / `retryable` accept input; busy, expired, reissue, unavailable, and disabled states never submit.
- DOM and Tab order are fixed as alternative, refresh, response input, submit, and state action. Reduced motion removes only non-essential transitions and does not change task availability or DOM order. Enter submits from the response input; Tab / Shift+Tab use the browser's native order. The component does not take over Dialog Escape or focus trapping.
- The label explicitly targets the response input. State and error share one component live-region owner, and the error links to the input through `aria-describedby`. The audio toggle changes only the alternative and never autoplays.
- After receiving an `ImageBitmap`, ownership transfers to the current primitive; `close()` runs when media is replaced or the component unmounts. Even if `challengeId`, audio URL, and raster dimensions are unchanged, replacing the media descriptor pauses and reloads the old audio element after removing its source, and clears the old response/error. The component does not reuse the old bitmap, RGBA canvas frame, or audio control. URL and RGBA data remain consumer-owned.
- Required controls wrap on desktop and mobile. 200% / 400% zoom does not hide the response input or state action. forced-colors / high contrast retains the frame, error boundary, and native focus indicator.

### Character Tokens

`--fsus-space-2`, `--fsus-space-3`, `--fsus-radius-control`,
`--fsus-radius-panel`, `--fsus-border`, `--fsus-scholarly-blue`,
`--el-color-danger`, `--fsus-motion-control`, and canonical disabled/focus tokens.

### Known limitations

The Web primitive does not decode, generate, or verify media, and does not own Dialog, protocol, network cancellation, or retry policy.
The platform controls the internal layout of native audio controls. When replacing them with a slot, the consumer must preserve user-initiated playback, an equivalent accessible name, and old-media cleanup. The Avalonia semantic equivalent requests audio playback through events; the consumer supplies the actual audio device and player.

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

## States and Events

The Character primitive's deterministic states are `loading | ready | verifying | retryable | reissue | unavailable | expired | disabled`. The host remains compatible with `idle`, `submitting`, `failed`, `verified`, and `error`; `submitting` renders as busy/verifying and `failed` renders as error.

Events are `submit`, `cancel`, `refresh`, `expired`, and `verified`. `expired` fires when `state="expired"`, `proofExpired`, or `expiresAtUnixMs` reaches its deadline, and fires only once per challenge.
