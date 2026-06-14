import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

export type TaskFeedbackPhase =
  | 'idle'
  | 'pending'
  | 'success'
  | 'partial'
  | 'error'

export type TaskFeedbackUpdate = {
  phase: TaskFeedbackPhase
  message?: string
  clearDelay?: number
}

export type UseTaskFeedbackOptions = {
  clearDelay?: number
  initialPhase?: TaskFeedbackPhase
  initialMessage?: string
}

export const taskFeedbackMotionClasses: Record<
  Exclude<TaskFeedbackPhase, 'idle'>,
  string
> = {
  pending: 'fsu-motion-task-receipt',
  success: 'fsu-motion-task-receipt',
  partial: 'fsu-motion-summary-receipt',
  error: 'fsu-motion-row-error-lock',
}

export const useTaskFeedback = (options: UseTaskFeedbackOptions = {}) => {
  const phase = ref<TaskFeedbackPhase>(options.initialPhase ?? 'idle')
  const message = ref(options.initialMessage ?? '')
  let timer: ReturnType<typeof setTimeout> | undefined

  const cancelTimer = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
  }

  const clear = () => {
    cancelTimer()
    phase.value = 'idle'
    message.value = ''
  }

  const set = (update: TaskFeedbackUpdate) => {
    cancelTimer()
    phase.value = update.phase
    message.value = update.message ?? ''

    const clearDelay = update.clearDelay ?? options.clearDelay
    if (clearDelay && update.phase !== 'pending') {
      timer = setTimeout(clear, clearDelay)
    }
  }

  const pending = (nextMessage = '') => set({ phase: 'pending', message: nextMessage })
  const success = (nextMessage = '', clearDelay = options.clearDelay) =>
    set({ phase: 'success', message: nextMessage, clearDelay })
  const partial = (nextMessage = '', clearDelay = options.clearDelay) =>
    set({ phase: 'partial', message: nextMessage, clearDelay })
  const error = (nextMessage = '') => set({ phase: 'error', message: nextMessage })

  const ariaLive = computed(() =>
    phase.value === 'error' ? 'assertive' : 'polite',
  )
  const motionClass = computed(() =>
    phase.value === 'idle' ? '' : taskFeedbackMotionClasses[phase.value],
  )
  const receiptProps = computed(() => ({
    'aria-live': ariaLive.value,
    'data-fsus-task-feedback': phase.value,
    class: motionClass.value,
  }))

  if (getCurrentScope()) {
    onScopeDispose(clear)
  }

  return {
    phase,
    message,
    ariaLive,
    motionClass,
    receiptProps,
    set,
    pending,
    success,
    partial,
    error,
    clear,
    cancelTimer,
  }
}

export default useTaskFeedback
