<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
} from '@ozwasyd/element-plus'
import { ArrowDown, Check, Link as LinkIcon, Refresh } from '@ozwasyd/element-plus/icons-vue'

const props = defineProps<{
  neg?: string
}>()

interface ChannelOption {
  id: string
  label: string
  description: string
  disabled?: boolean
}

const channels: ChannelOption[] = [
  {
    id: 'stable',
    label: 'Stable release channel',
    description: 'Verified runtime artifacts with conservative update cadence across every target environment.',
  },
  {
    id: 'preview',
    label: 'Public preview channel with extended diagnostic metadata',
    description: 'Early public API builds carrying full telemetry and compatibility verification metadata.',
  },
  {
    id: 'archived',
    label: 'Archived channel (disabled)',
    description: 'Read-only historical release track that cannot be activated.',
    disabled: true,
  },
  {
    id: 'canary',
    label: 'Canary validation channel',
    description: 'Pre-release verification target intended for automated contract suites.',
  },
]

const params = new URLSearchParams(window.location.search)
const asyncMode = ref(params.get('async') === '1')
const failNextAsync = ref(params.get('failFirst') === '1')
const mounted = ref(true)
const dropdownRef = ref<{ handleOpen: () => void; handleClose: () => void } | null>(null)
const stolenFocusRef = ref<HTMLButtonElement | null>(null)

const committedId = ref('stable')
const pendingId = ref<string | null>(null)
const failedTargetId = ref<string | null>(null)
const errorMessage = ref('')
const menuVisible = ref(false)
const navigatedUrls = ref<string[]>([])
const commandLog = ref<string[]>([])
const lastVisibleEvents = ref<boolean[]>([])

let pendingResolver: ((ok: boolean) => void) | null = null

const committedLabel = computed(
  () => channels.find((item) => item.id === committedId.value)?.label ?? committedId.value,
)

const isRadioChecked = (id: string): boolean | undefined => {
  if (props.neg === 'menuitem-checked') return undefined
  if (props.neg === 'half-commit' && pendingId.value) {
    return pendingId.value === id
  }
  return committedId.value === id
}

const hideOnClick = computed(() => {
  if (props.neg === 'close-on-pending') return true
  return false
})

const startAsyncSwitch = (targetId: string) => {
  pendingId.value = targetId
  errorMessage.value = ''
  failedTargetId.value = null
  const promise = new Promise<boolean>((resolve) => {
    pendingResolver = resolve
  })
  promise.then((ok) => {
    if (ok) {
      committedId.value = targetId
      pendingId.value = null
      failedTargetId.value = null
      errorMessage.value = ''
      dropdownRef.value?.handleClose()
    } else {
      pendingId.value = null
      failedTargetId.value = targetId
      errorMessage.value = `Activation failed for ${targetId}`
    }
  })
}

const resolvePending = (ok: boolean) => {
  const resolver = pendingResolver
  pendingResolver = null
  resolver?.(ok)
}

const handleCommand = (command: unknown) => {
  if (typeof command !== 'object' || command === null) return
  const payload = command as { kind: string; id?: string; url?: string }
  commandLog.value.push(`${payload.kind}:${payload.id ?? payload.url ?? ''}`)

  if (payload.kind === 'url' && payload.url) {
    navigatedUrls.value.push(payload.url)
    dropdownRef.value?.handleClose()
    return
  }

  if (payload.kind === 'retry' && failedTargetId.value) {
    const retryTarget = failedTargetId.value
    if (asyncMode.value) {
      startAsyncSwitch(retryTarget)
    } else {
      committedId.value = retryTarget
      failedTargetId.value = null
      errorMessage.value = ''
      dropdownRef.value?.handleClose()
    }
    return
  }

  if (payload.kind === 'select' && payload.id) {
    if (asyncMode.value) {
      if (failNextAsync.value) {
        failNextAsync.value = false
        pendingId.value = payload.id
        errorMessage.value = ''
        failedTargetId.value = null
        window.setTimeout(() => {
          pendingId.value = null
          failedTargetId.value = payload.id ?? null
          errorMessage.value = `Activation failed for ${payload.id}`
        }, 25)
      } else {
        startAsyncSwitch(payload.id)
      }
      return
    }
    committedId.value = payload.id
    failedTargetId.value = null
    errorMessage.value = ''
    dropdownRef.value?.handleClose()
  }
}

const handleVisibleChange = (visible: boolean) => {
  menuVisible.value = visible
  lastVisibleEvents.value.push(visible)
  if (!visible && props.neg === 'broken-escape-focus') {
    window.setTimeout(() => {
      stolenFocusRef.value?.focus()
    }, 10)
  }
}

interface DropdownContractControls {
  resolvePending: (ok: boolean) => void
}

declare global {
  interface Window {
    __dropdownContractControls?: DropdownContractControls
  }
}

onMounted(() => {
  window.__dropdownContractControls = {
    resolvePending,
  }
})

onBeforeUnmount(() => {
  delete window.__dropdownContractControls
})
</script>

<template>
  <section data-testid="dropdown-contract-section">
    <h1>Dropdown Single-Selection Contract (#830)</h1>

    <div class="contract-toolbar">
      <button type="button" data-testid="outside-button">
        Outside button
      </button>
      <button
        ref="stolenFocusRef"
        type="button"
        data-testid="distractor-button"
      >
        Distractor focus target
      </button>
      <ElButton data-testid="toggle-async-btn" @click="asyncMode = !asyncMode">
        Async mode: {{ asyncMode ? 'on' : 'off' }}
      </ElButton>
      <ElButton
        data-testid="resolve-ok-btn"
        :disabled="!pendingId"
        @click="resolvePending(true)"
      >
        Resolve pending OK
      </ElButton>
      <ElButton
        data-testid="resolve-fail-btn"
        :disabled="!pendingId"
        @click="resolvePending(false)"
      >
        Fail pending
      </ElButton>
      <ElButton
        data-testid="unmount-dropdown-btn"
        @click="mounted = !mounted"
      >
        {{ mounted ? 'Unmount dropdown' : 'Remount dropdown' }}
      </ElButton>
    </div>

    <div v-if="neg === 'menuitem-checked'" data-testid="neg-menuitem-checked-host">
      <ul role="menu">
        <li
          v-for="item in channels"
          :key="item.id"
          role="menuitem"
          :aria-checked="String(committedId === item.id)"
          :data-testid="`channel-item-${item.id}`"
        >
          {{ item.label }}
        </li>
      </ul>
    </div>

    <div v-else-if="mounted" data-testid="dropdown-host">
      <ElDropdown
        ref="dropdownRef"
        trigger="click"
        placement="bottom-start"
        :hide-on-click="hideOnClick"
        viewport-bounded
        max-height="260px"
        @command="handleCommand"
        @visible-change="handleVisibleChange"
      >
        <button
          type="button"
          class="contract-compact-trigger"
          data-testid="compact-trigger"
        >
          <span>{{ committedLabel }}</span>
          <ElIcon aria-hidden="true"><ArrowDown /></ElIcon>
        </button>

        <template #dropdown>
          <ElDropdownMenu data-testid="channel-menu">
            <ElDropdownItem
              v-for="item in channels"
              :key="item.id"
              :command="{ kind: 'select', id: item.id }"
              :checked="isRadioChecked(item.id)"
              :aria-checked="
                neg === 'menuitem-checked'
                  ? String(committedId === item.id)
                  : undefined
              "
              :disabled="item.disabled"
              multiline
              :data-testid="`channel-item-${item.id}`"
            >
              {{ item.label }}
              <template #description>
                {{ item.description }}
              </template>
              <template #suffix>
                <span
                  v-if="pendingId === item.id"
                  data-testid="pending-indicator"
                >
                  Pending…
                </span>
                <ElIcon
                  v-else-if="committedId === item.id"
                  aria-hidden="true"
                >
                  <Check />
                </ElIcon>
              </template>
            </ElDropdownItem>

            <ElDropdownItem
              v-if="errorMessage"
              divided
              :command="{ kind: 'retry' }"
              multiline
              data-testid="retry-item"
            >
              Retry activation
              <template #description>
                <span role="alert" data-testid="error-alert">
                  {{ errorMessage }}
                </span>
              </template>
              <template #suffix>
                <ElIcon aria-hidden="true"><Refresh /></ElIcon>
              </template>
            </ElDropdownItem>

            <ElDropdownItem
              divided
              :command="{ kind: 'url', url: '/docs/channels' }"
              data-testid="url-command-item"
            >
              Open channel specification
              <template #suffix>
                <ElIcon aria-hidden="true"><LinkIcon /></ElIcon>
              </template>
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>

    <div
      v-if="neg === 'private-selector'"
      data-testid="private-selector-fixture"
    >
      .el-dropdown-menu__item { outline: 3px solid red; }
    </div>

    <div class="contract-status" data-testid="dropdown-status">
      <div data-testid="committed-value">{{ committedId }}</div>
      <div data-testid="pending-value">{{ pendingId || 'none' }}</div>
      <div data-testid="menu-visible">{{ String(menuVisible) }}</div>
      <div data-testid="navigated-urls">{{ navigatedUrls.join(',') }}</div>
      <div data-testid="command-log">{{ commandLog.join('|') }}</div>
    </div>
  </section>
</template>
