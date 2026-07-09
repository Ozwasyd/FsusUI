<template>
  <transition
    :name="messageTransitionName"
    @before-leave="onClose"
    @after-leave="$emit('destroy')"
  >
    <div
      v-show="visible"
      :id="id"
      ref="messageRef"
      v-bind="componentMotionAttrs"
      :class="[
        ns.b(),
        { [ns.m(type)]: type && !icon },
        ns.is('closable', showClose),
        customClass,
      ]"
      :style="customStyle"
      role="alert"
      @mouseenter="clearTimer"
      @mouseleave="startTimer"
    >
      <el-badge
        v-if="repeatNum > 1"
        :value="repeatNum"
        :type="badgeType"
        :class="ns.e('badge')"
      />
      <el-icon v-if="iconComponent" :class="[ns.e('icon'), typeClass]">
        <component :is="iconComponent" />
      </el-icon>
      <slot>
        <p v-if="!dangerouslyUseHTMLString" :class="ns.e('content')">
          {{ message }}
        </p>
        <!-- Caution here, message could've been compromised, never use user's input as message -->
        <p v-else :class="ns.e('content')" v-html="message" />
      </slot>
      <el-icon v-if="showClose" :class="ns.e('closeBtn')" v-on="closeBtnEvents">
        <Close />
      </el-icon>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  useEventListener,
  useResizeObserver,
  useTimeoutFn,
} from '@element-plus/hooks/use-runtime'
import { TypeComponents, TypeComponentsMap } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import ElBadge from '@element-plus/components/badge'
import { useGlobalComponentSettings } from '@element-plus/components/config-provider'
import { ElIcon } from '@element-plus/components/icon'
import {
  resolveComponentTransitionName,
  useComponentMotionAttrs,
} from '@element-plus/components/motion'
import { messageEmits, messageProps } from './message'
import { getLastOffset, getOffsetOrSpace } from './instance'
import type { BadgeProps } from '@element-plus/components/badge'
import type { CSSProperties } from 'vue'

const { Close } = TypeComponents

defineOptions({
  name: 'ElMessage',
})

const props = defineProps(messageProps)
defineEmits(messageEmits)

const { ns, zIndex } = useGlobalComponentSettings('message')
const { currentZIndex, nextZIndex } = zIndex
const componentMotionAttrs = useComponentMotionAttrs(
  computed(() => props.motion),
  'slide-up',
)
const messageTransitionName = computed(() =>
  resolveComponentTransitionName(props.motion, ns.b('fade'), {
    'slide-up': ns.b('fade'),
    'fade-up': ns.b('fade'),
  }),
)

const messageRef = ref<HTMLDivElement>()
const visible = ref(false)
const height = ref(0)

let stopTimer: (() => void) | undefined = undefined

const badgeType = computed<BadgeProps['type']>(() =>
  props.type ? (props.type === 'error' ? 'danger' : props.type) : 'info',
)
const typeClass = computed(() => {
  const type = props.type
  return { [ns.bm('icon', type)]: type && TypeComponentsMap[type] }
})
const iconComponent = computed(
  () => props.icon || TypeComponentsMap[props.type] || '',
)

const lastOffset = computed(() => getLastOffset(props.id))
const offset = computed(
  () => getOffsetOrSpace(props.id, props.offset) + lastOffset.value,
)
const stackOffset = computed(() => offset.value - props.offset)
const bottom = computed((): number => height.value + offset.value)
const customStyle = computed<CSSProperties>(() => ({
  top: `${props.offset}px`,
  zIndex: currentZIndex.value,
  '--el-message-stack-y': `${stackOffset.value}px`,
}))
const closeBtnEvents = {
  click: (event: MouseEvent) => {
    event.stopPropagation()
    close()
  },
}

function startTimer() {
  if (props.duration === 0) return
  ;({ stop: stopTimer } = useTimeoutFn(() => {
    close()
  }, props.duration))
}

function clearTimer() {
  stopTimer?.()
}

function close() {
  visible.value = false
}

function keydown({ code }: KeyboardEvent) {
  if (code === EVENT_CODE.esc) {
    // press esc to close the message
    close()
  }
}

onMounted(() => {
  startTimer()
  nextZIndex()
  visible.value = true
})

watch(
  () => props.repeatNum,
  () => {
    clearTimer()
    startTimer()
  },
)

useEventListener(document, 'keydown', keydown)

useResizeObserver(messageRef, () => {
  height.value = messageRef.value!.getBoundingClientRect().height
})

defineExpose({
  visible,
  bottom,
  close,
})
</script>
