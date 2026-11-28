import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  unref,
  watch,
} from 'vue'
import type { ComputedRef, MaybeRef, Ref } from 'vue'
import { defaultRenderPipelineConfig, positive } from './config'
import { FsusVirtualSizeIndex } from './virtual-window-index'
import type {
  FsusViewport,
  FsusVirtualWindowDiagnosticEvent,
  FsusVirtualWindowItem,
} from './types'

const isWindowViewport = (viewport: FsusViewport): viewport is Window =>
  (typeof window !== 'undefined' && viewport === window) ||
  (typeof Window !== 'undefined' && viewport instanceof Window)

const getViewportScrollTop = (viewport: FsusViewport | null) => {
  if (!viewport) return 0
  if (isWindowViewport(viewport)) {
    return viewport.scrollY || document.documentElement.scrollTop || 0
  }
  return viewport.scrollTop
}

const getViewportHeight = (viewport: FsusViewport | null) => {
  if (!viewport) return 0
  if (isWindowViewport(viewport)) {
    return viewport.innerHeight
  }
  return viewport.clientHeight
}

const setViewportScrollTop = (viewport: FsusViewport | null, value: number) => {
  if (!viewport) return
  if (isWindowViewport(viewport)) {
    viewport.scrollTo({ top: value })
    return
  }
  viewport.scrollTop = value
}

export const useFsusVirtualWindow = <TUnit>(options: {
  estimateSize: (unit: TUnit, index: number) => number
  getKey: (unit: TUnit, index: number) => string
  getViewport: () => FsusViewport | null
  itemSize?: MaybeRef<number | undefined>
  measureBatch?: MaybeRef<number | undefined>
  measurementCacheLimit?: MaybeRef<number | undefined>
  minVisibleItems?: MaybeRef<number | undefined>
  onDiagnostic?: (event: FsusVirtualWindowDiagnosticEvent) => void
  overscanPx?: MaybeRef<number | undefined>
  units: Ref<readonly TUnit[]>
}) => {
  const scrollOffset = ref(0)
  const viewportSize = ref(0)
  const indexVersion = ref(0)
  const fixedItemSize = positive(unref(options.itemSize), 0)

  const createVariableState = () => {
    const keys: string[] = []
    const keyToIndex = new Map<string, number>()
    const estimatedSizes: number[] = []
    const values: number[] = []

    options.units.value.forEach((unit, index) => {
      const key = options.getKey(unit, index)
      if (keyToIndex.has(key)) {
        throw new Error(`useFsusVirtualWindow requires unique keys: ${key}`)
      }
      const estimate = positive(options.estimateSize(unit, index), 1)
      keys.push(key)
      keyToIndex.set(key, index)
      estimatedSizes.push(estimate)
      values.push(estimate)
    })

    return {
      elementKeys: new WeakMap<Element, string>(),
      estimatedSizes,
      index: new FsusVirtualSizeIndex(values),
      keys,
      keyToIndex,
      measuredSizes: new Map<string, number>(),
      observedElements: new Map<string, HTMLElement>(),
      pendingMeasurements: new Map<string, number>(),
    }
  }

  const variableState = fixedItemSize > 0 ? null : createVariableState()
  let measurementFrame = 0
  let scrollFrame = 0
  let resizeObserver: ResizeObserver | null = null
  let viewport: FsusViewport | null = null

  const totalSize = computed(() => {
    if (fixedItemSize > 0) return options.units.value.length * fixedItemSize
    indexVersion.value
    return variableState?.index.total ?? 0
  })

  const range = computed(() => {
    const overscan =
      unref(options.overscanPx) ?? defaultRenderPipelineConfig.budget.overscanPx
    const startOffset = Math.max(0, scrollOffset.value - overscan)
    const endOffset = scrollOffset.value + viewportSize.value + overscan
    const count = options.units.value.length
    const minVisibleItems = Math.max(
      1,
      Math.floor(positive(unref(options.minVisibleItems), 1)),
    )
    let start = 0
    let end = 0

    if (fixedItemSize > 0) {
      start = Math.max(0, Math.ceil(startOffset / fixedItemSize) - 1)
      end = Math.min(count, Math.floor(endOffset / fixedItemSize) + 1)
    } else if (variableState) {
      indexVersion.value
      start = variableState.index.findFirstEndAtLeast(startOffset)
      const lastVisible = variableState.index.findFirstEndGreater(endOffset)
      end = lastVisible >= count ? count : lastVisible + 1
    }

    return {
      end: Math.min(count, Math.max(end, start + minVisibleItems)),
      start,
    }
  })

  const offsetForIndex = (index: number) =>
    fixedItemSize > 0
      ? Math.max(0, index) * fixedItemSize
      : (variableState?.index.prefixSize(index) ?? 0)

  const visibleItems: ComputedRef<FsusVirtualWindowItem<TUnit>[]> = computed(
    () => {
      indexVersion.value
      const units = options.units.value
      const currentRange = range.value
      const items: FsusVirtualWindowItem<TUnit>[] = []
      let offset = offsetForIndex(currentRange.start)
      for (
        let index = currentRange.start;
        index < currentRange.end;
        index += 1
      ) {
        const unit = units[index]
        if (unit === undefined) break
        const size =
          fixedItemSize > 0
            ? fixedItemSize
            : (variableState?.index.get(index) ?? 0)
        items.push({
          index,
          key: options.getKey(unit, index),
          offset,
          size,
          unit,
        })
        offset += size
      }
      return items
    },
  )

  const topSpacer = computed(() => offsetForIndex(range.value.start))
  const bottomSpacer = computed(() =>
    Math.max(0, totalSize.value - offsetForIndex(range.value.end)),
  )

  const emitDiagnostic = (
    event: Omit<FsusVirtualWindowDiagnosticEvent, 'itemCount'>,
  ) => {
    options.onDiagnostic?.({
      ...event,
      itemCount: options.units.value.length,
    })
  }

  const readViewport = () => {
    viewport = options.getViewport()
    scrollOffset.value = getViewportScrollTop(viewport)
    viewportSize.value = getViewportHeight(viewport)
  }

  const scheduleViewportRead = () => {
    if (scrollFrame) return
    if (typeof requestAnimationFrame !== 'function') {
      readViewport()
      return
    }
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0
      readViewport()
    })
  }

  const flushMeasurements = () => {
    measurementFrame = 0
    if (!variableState?.pendingMeasurements.size) return

    const batchSize = Math.max(
      1,
      Math.floor(positive(unref(options.measureBatch), 32)),
    )
    const entries: Array<[string, number]> = []
    for (const entry of variableState.pendingMeasurements) {
      entries.push(entry)
      variableState.pendingMeasurements.delete(entry[0])
      if (entries.length >= batchSize) break
    }

    const anchorIndex = range.value.start
    let scrollCorrection = 0
    let changed = false

    for (const [key, nextSize] of entries) {
      const index = variableState.keyToIndex.get(key)
      if (index === undefined || !Number.isFinite(nextSize) || nextSize <= 0)
        continue
      const previous = variableState.index.get(index)
      if (previous === nextSize) continue

      variableState.measuredSizes.delete(key)
      variableState.measuredSizes.set(key, nextSize)
      changed = variableState.index.update(index, nextSize) || changed
      if (index < anchorIndex) scrollCorrection += nextSize - previous
    }

    const cacheLimit = Math.max(
      1,
      Math.floor(positive(unref(options.measurementCacheLimit), 2048)),
    )
    for (const [key] of variableState.measuredSizes) {
      if (variableState.measuredSizes.size <= cacheLimit) break
      if (variableState.observedElements.has(key)) continue
      variableState.measuredSizes.delete(key)
      const index = variableState.keyToIndex.get(key)
      if (index === undefined) continue
      const previous = variableState.index.get(index)
      const estimate = variableState.estimatedSizes[index] ?? previous
      changed = variableState.index.update(index, estimate) || changed
      if (index < anchorIndex) scrollCorrection += estimate - previous
    }

    if (changed) indexVersion.value += 1
    emitDiagnostic({ batchSize: entries.length, type: 'measurement-batch' })
    emitDiagnostic({
      cacheSize: variableState.measuredSizes.size,
      type: 'measurement-cache',
    })

    if (Math.abs(scrollCorrection) > 0.5) {
      const nextOffset = getViewportScrollTop(viewport) + scrollCorrection
      setViewportScrollTop(viewport, nextOffset)
      scrollOffset.value = nextOffset
      emitDiagnostic({
        correction: scrollCorrection,
        reason: 'measurement',
        type: 'scroll-correction',
      })
      readViewport()
    }

    if (variableState.pendingMeasurements.size) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = requestAnimationFrame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const queueMeasurement = (key: string, size: number) => {
    if (!variableState) return
    variableState.pendingMeasurements.set(key, size)
    if (!measurementFrame) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = requestAnimationFrame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const setUnitRef = (key: string, element: Element | null) => {
    if (!variableState) return
    const previousElement = variableState.observedElements.get(key)
    if (previousElement === element) return
    if (previousElement) {
      resizeObserver?.unobserve(previousElement)
      variableState.elementKeys.delete(previousElement)
      variableState.observedElements.delete(key)
    }

    if (!(element instanceof HTMLElement)) return
    if (!variableState.keyToIndex.has(key)) return
    const previousKey = variableState.elementKeys.get(element)
    if (previousKey && previousKey !== key) {
      variableState.observedElements.delete(previousKey)
      variableState.pendingMeasurements.delete(previousKey)
    }
    variableState.observedElements.set(key, element)
    variableState.elementKeys.set(element, key)
    queueMeasurement(key, element.offsetHeight)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
          const entryKey = variableState.elementKeys.get(entry.target)
          if (!entryKey) continue
          const blockSize =
            entry.borderBoxSize?.[0]?.blockSize ??
            entry.contentRect.height ??
            (entry.target instanceof HTMLElement
              ? entry.target.offsetHeight
              : 0)
          queueMeasurement(entryKey, blockSize)
        }
      })
      resizeObserver.observe(element)
    }
  }

  const syncUnits = (nextUnits: readonly TUnit[]) => {
    if (!variableState) return
    const previousStart = range.value.start
    const anchorKey = variableState.keys[previousStart]
    const anchorDelta = scrollOffset.value - offsetForIndex(previousStart)
    const nextKeys: string[] = []
    const seen = new Set<string>()
    for (let index = 0; index < nextUnits.length; index += 1) {
      const unit = nextUnits[index]
      if (unit === undefined) continue
      const key = options.getKey(unit, index)
      if (seen.has(key)) {
        throw new Error(`useFsusVirtualWindow requires unique keys: ${key}`)
      }
      seen.add(key)
      nextKeys.push(key)
    }

    const sharedLength = Math.min(variableState.keys.length, nextKeys.length)
    let prefixMatches = true
    for (let index = 0; index < sharedLength; index += 1) {
      if (variableState.keys[index] !== nextKeys[index]) {
        prefixMatches = false
        break
      }
    }

    if (prefixMatches && nextKeys.length >= variableState.keys.length) {
      for (let index = 0; index < sharedLength; index += 1) {
        const unit = nextUnits[index]
        if (unit === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        variableState.estimatedSizes[index] = estimate
        if (!variableState.measuredSizes.has(nextKeys[index] ?? '')) {
          variableState.index.update(index, estimate)
        }
      }
      for (
        let index = variableState.keys.length;
        index < nextKeys.length;
        index += 1
      ) {
        const unit = nextUnits[index]
        const key = nextKeys[index]
        if (unit === undefined || key === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        variableState.keys.push(key)
        variableState.keyToIndex.set(key, index)
        variableState.estimatedSizes.push(estimate)
        variableState.index.append(estimate)
      }
    } else if (prefixMatches) {
      for (let index = 0; index < sharedLength; index += 1) {
        const unit = nextUnits[index]
        if (unit === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        variableState.estimatedSizes[index] = estimate
        if (!variableState.measuredSizes.has(nextKeys[index] ?? '')) {
          variableState.index.update(index, estimate)
        }
      }
      for (
        let index = nextKeys.length;
        index < variableState.keys.length;
        index += 1
      ) {
        const key = variableState.keys[index]
        if (!key) continue
        const element = variableState.observedElements.get(key)
        if (element) {
          resizeObserver?.unobserve(element)
          variableState.elementKeys.delete(element)
        }
        variableState.observedElements.delete(key)
        variableState.pendingMeasurements.delete(key)
        variableState.measuredSizes.delete(key)
        variableState.keyToIndex.delete(key)
      }
      variableState.keys.length = nextKeys.length
      variableState.estimatedSizes.length = nextKeys.length
      variableState.index.truncate(nextKeys.length)
    } else {
      for (const [key, element] of variableState.observedElements) {
        if (seen.has(key)) continue
        resizeObserver?.unobserve(element)
        variableState.elementKeys.delete(element)
        variableState.observedElements.delete(key)
        variableState.pendingMeasurements.delete(key)
      }
      for (const key of variableState.measuredSizes.keys()) {
        if (!seen.has(key)) variableState.measuredSizes.delete(key)
      }

      const estimates: number[] = []
      const values: number[] = []
      const keyToIndex = new Map<string, number>()
      for (let index = 0; index < nextUnits.length; index += 1) {
        const unit = nextUnits[index]
        const key = nextKeys[index]
        if (unit === undefined || key === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        estimates.push(estimate)
        values.push(variableState.measuredSizes.get(key) ?? estimate)
        keyToIndex.set(key, index)
      }
      variableState.keys = nextKeys
      variableState.keyToIndex = keyToIndex
      variableState.estimatedSizes = estimates
      variableState.index.rebuild(values)
      emitDiagnostic({ reason: 'insert-or-reorder', type: 'index-rebuild' })
    }

    indexVersion.value += 1
    if (anchorKey) {
      const nextAnchorIndex = variableState.keyToIndex.get(anchorKey)
      if (nextAnchorIndex !== undefined) {
        const nextOffset = offsetForIndex(nextAnchorIndex) + anchorDelta
        const correction = nextOffset - scrollOffset.value
        if (Math.abs(correction) > 0.5) {
          setViewportScrollTop(viewport, nextOffset)
          scrollOffset.value = nextOffset
          emitDiagnostic({
            correction,
            reason: 'units',
            type: 'scroll-correction',
          })
        }
      }
    }
    void nextTick(readViewport)
  }

  const connect = () => {
    readViewport()
    viewport?.addEventListener('scroll', scheduleViewportRead, {
      passive: true,
    })
    if (viewport && isWindowViewport(viewport)) {
      viewport.addEventListener('resize', scheduleViewportRead)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', scheduleViewportRead)
    }
  }

  const disconnect = () => {
    viewport?.removeEventListener('scroll', scheduleViewportRead)
    if (viewport && isWindowViewport(viewport)) {
      viewport.removeEventListener('resize', scheduleViewportRead)
    } else if (typeof window !== 'undefined') {
      window.removeEventListener('resize', scheduleViewportRead)
    }
    viewport = null
  }

  onMounted(() => {
    void nextTick(connect)
  })

  watch(options.units, syncUnits, { flush: 'sync' })

  onBeforeUnmount(() => {
    disconnect()
    if (typeof cancelAnimationFrame === 'function') {
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
      if (measurementFrame) cancelAnimationFrame(measurementFrame)
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    variableState?.observedElements.clear()
    variableState?.pendingMeasurements.clear()
    variableState?.measuredSizes.clear()
  })

  return {
    bottomSpacer,
    connect,
    offsetForIndex,
    readViewport,
    range,
    scrollOffset,
    setUnitRef,
    topSpacer,
    totalSize,
    viewportSize,
    visibleItems,
  }
}
