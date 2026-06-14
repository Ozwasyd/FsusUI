import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

export type RowStateKey = string | number

export type RowStatePhase =
  | 'idle'
  | 'busy'
  | 'success'
  | 'partial'
  | 'error'
  | 'locked'

export type RowStateEntry = {
  phase: RowStatePhase
  message?: string
}

export type RowStateMotionUpdate = RowStateEntry & {
  clearDelay?: number
}

export type UseRowStateMotionOptions = {
  clearDelay?: number
}

export const rowStateMotionClasses: Record<
  Exclude<RowStatePhase, 'idle'>,
  string
> = {
  busy: 'fsu-motion-row-busy-line',
  success: 'fsu-motion-row-confirm-line',
  partial: 'fsu-motion-summary-receipt',
  error: 'fsu-motion-row-error-lock',
  locked: 'fsu-motion-row-error-lock',
}

const cloneRows = (rows: Map<RowStateKey, RowStateEntry>) => new Map(rows)

export const useRowStateMotion = (options: UseRowStateMotionOptions = {}) => {
  const rows = ref(new Map<RowStateKey, RowStateEntry>())
  const timers = new Map<RowStateKey, ReturnType<typeof setTimeout>>()

  const cancelTimer = (key: RowStateKey) => {
    const timer = timers.get(key)
    if (!timer) return
    clearTimeout(timer)
    timers.delete(key)
  }

  const clear = (key: RowStateKey) => {
    cancelTimer(key)
    const next = cloneRows(rows.value)
    next.delete(key)
    rows.value = next
  }

  const clearAll = () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    rows.value = new Map()
  }

  const set = (key: RowStateKey, update: RowStateMotionUpdate) => {
    cancelTimer(key)
    const next = cloneRows(rows.value)
    if (update.phase === 'idle') {
      next.delete(key)
    } else {
      next.set(key, {
        phase: update.phase,
        message: update.message,
      })
    }
    rows.value = next

    const clearDelay = update.clearDelay ?? options.clearDelay
    if (clearDelay && update.phase !== 'busy' && update.phase !== 'idle') {
      timers.set(key, setTimeout(() => clear(key), clearDelay))
    }
  }

  const get = (key: RowStateKey): RowStateEntry => {
    return rows.value.get(key) ?? { phase: 'idle' }
  }

  const getClass = (key: RowStateKey) => {
    const phase = get(key).phase
    return phase === 'idle' ? '' : rowStateMotionClasses[phase]
  }

  const activeCount = computed(() => rows.value.size)

  if (getCurrentScope()) {
    onScopeDispose(clearAll)
  }

  return {
    rows,
    activeCount,
    set,
    get,
    getClass,
    clear,
    clearAll,
    cancelTimer,
  }
}

export default useRowStateMotion
