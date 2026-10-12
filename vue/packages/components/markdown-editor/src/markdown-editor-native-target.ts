/** Native input staging only; physical mount and complete resources stay with their original owners. */
export interface MarkdownEditorNativeTargetCleanup {
  readonly scope: 'native-target-staging-admission'
  readonly pending: boolean
  readonly receiving: boolean
  readonly failed: boolean
  readonly firstCause: unknown
  readonly latestCause: unknown
}

export interface MarkdownEditorNativeTargetSubscription {
  hasCustody(): boolean
  unsubscribe(): boolean
  failureCause(): unknown
}

export interface MarkdownEditorNativeTargetReservation {
  readonly scope: 'native-target-birth-staging'
  /** Original owner-observed lifetime only; no DOM, source or document-ticket reader. */
  hasCustody(): boolean
  subscribeBeforeInvalidation(receiver: () => void): MarkdownEditorNativeTargetSubscription
  /** Withdraw first, then release the actual staging input barrier; never unmount or certify resources. */
  cancel(): boolean
  retryCleanup(): boolean
  inspectCleanup(): MarkdownEditorNativeTargetCleanup
}

interface Receiver {
  readonly callback: () => void
  pending: boolean
  registered: boolean
  failed: boolean
  cause: unknown
}

interface NativeTargetRecord {
    readonly reservation: MarkdownEditorNativeTargetReservation
    assertMounted: (() => void) | undefined
    setStagingBlocked: ((blocked: boolean) => void) | undefined
    readonly receivers: Set<Receiver>
    eligible: boolean
    withdrawn: boolean
    receiving: boolean
    releasing: boolean
    notifying: boolean
    barrierHeld: boolean
    failed: boolean
    firstCause: unknown
    latestCause: unknown
  }

/** Created once in the actual SFC setup, alongside its original transaction/session owner. */
export const createMarkdownEditorNativeTargetOwner = (owner: {
  readonly captureMountedTarget: () => {
    readonly assertMounted: () => void
    readonly setStagingBlocked: (blocked: boolean) => void
  }
}) => {
  let spent = false
  let unavailable = false
  let generation = 0
  let current: NativeTargetRecord | undefined
  const failure = (record: NativeTargetRecord, cause: unknown) => {
    if (!record.failed) record.firstCause = cause
    record.failed = true
    record.latestCause = cause
  }
  const inspect = (): MarkdownEditorNativeTargetCleanup => Object.freeze({
    scope: 'native-target-staging-admission',
    pending: !!current && current.withdrawn && (current.receiving || current.barrierHeld || current.receivers.size > 0),
    receiving: current?.receiving ?? false,
    failed: current?.failed ?? false,
    firstCause: current?.firstCause,
    latestCause: current?.latestCause,
  })
  const clean = (record: NativeTargetRecord): boolean => {
    if (record.releasing || record.notifying || record.eligible) return false
    record.releasing = true
    let failed = false
    let first: unknown
    const attempt = (action: () => void) => {
      try { action() } catch (cause) {
        if (!failed) first = cause
        failed = true
        failure(record, cause)
      }
    }
    try {
      record.notifying = true
      try {
        for (const receiver of [...record.receivers]) {
          if (!receiver.pending) continue
          attempt(() => {
            receiver.cause = undefined
            receiver.failed = false
            try { receiver.callback() } catch (cause) { receiver.failed = true; receiver.cause = cause; throw cause }
            // A caught unsubscribe reentry still retains its original failure.
            if (receiver.failed) throw receiver.cause
            receiver.pending = false
            receiver.registered = false
            record.receivers.delete(receiver)
          })
        }
      } finally { record.notifying = false }
      // Never unlock native input in the middle of the original async transfer.
      if (!record.receiving && record.barrierHeld) attempt(() => {
        if (!record.setStagingBlocked) throw new Error('editor-native-target-barrier-owner-unavailable')
        record.setStagingBlocked(false)
        record.barrierHeld = false
      })
      if (failed) throw first
      const complete = !record.receiving && !record.barrierHeld && record.receivers.size === 0
      if (complete) { record.assertMounted = undefined; record.setStagingBlocked = undefined }
      return complete
    } finally { record.releasing = false }
  }
  const withdraw = (record: NativeTargetRecord): boolean => {
    record.withdrawn = true
    if (record.eligible) {
      record.eligible = false
      for (const receiver of record.receivers) receiver.pending = true
    }
    return clean(record)
  }
  return Object.freeze({
    reserve(assertPristine: () => void): MarkdownEditorNativeTargetReservation {
      if (spent || unavailable || current) throw new Error('editor-native-target-birth-unavailable')
      const birthGeneration = generation
      assertPristine()
      const mounted = owner.captureMountedTarget()
      const assertMounted = mounted.assertMounted
      const setStagingBlocked = mounted.setStagingBlocked
      assertPristine()
      if (spent || unavailable || current || generation !== birthGeneration) throw new Error('editor-native-target-birth-reentrant')
      const reservation: MarkdownEditorNativeTargetReservation = Object.freeze({
        scope: 'native-target-birth-staging',
        hasCustody: () => current === record && record.eligible && !unavailable && !record.releasing && !record.notifying,
        subscribeBeforeInvalidation(receiver: () => void) {
          if (typeof receiver !== 'function') throw new TypeError('editor-native-target-receiver-invalid')
          if (!reservation.hasCustody()) throw new Error('editor-native-target-subscription-unavailable')
          const registration: Receiver = { callback: receiver, pending: false, registered: true, failed: false, cause: undefined }
          const handle = Object.freeze({
            hasCustody: () => registration.registered,
            failureCause: () => registration.cause,
            unsubscribe() {
              if (record.notifying) {
                const cause = new Error('editor-native-target-unsubscribe-reentrant')
                registration.cause = cause
                registration.failed = true
                failure(record, cause)
                throw cause
              }
              if (!registration.registered) return false
              if (registration.pending) {
                if (registration.failed) throw registration.cause
                throw new Error('editor-native-target-notification-pending')
              }
              registration.registered = false
              record.receivers.delete(registration)
              return true
            },
          })
          if (!reservation.hasCustody()) throw new Error('editor-native-target-subscription-revoked')
          record.receivers.add(registration)
          return handle
        },
        cancel: () => withdraw(record),
        retryCleanup: () => clean(record),
        inspectCleanup: inspect,
      })
      const record: NativeTargetRecord = { reservation, assertMounted, setStagingBlocked, receivers: new Set(), eligible: false, withdrawn: false, receiving: false,
        releasing: false, notifying: false, barrierHeld: true, failed: false, firstCause: undefined, latestCause: undefined }
      // Allocate custody before the real reactive write, so a failed write cannot lose cleanup.
      spent = true
      current = record
      try {
        setStagingBlocked(true)
        assertMounted()
        assertPristine()
        if (unavailable || current !== record || record.withdrawn || generation !== birthGeneration) throw new Error('editor-native-target-birth-revoked')
        record.eligible = true
        return reservation
      } catch (cause) {
        failure(record, cause)
        try { withdraw(record) } catch (cleanupCause) { failure(record, cleanupCause) }
        throw cause
      }
    },
    invalidate(permanent = false) {
      if (generation === Number.MAX_SAFE_INTEGER) unavailable = true
      else generation += 1
      if (permanent) unavailable = true
      if (current) withdraw(current)
    },
    beginReceiving() {
      const record = current
      if (!record) return
      if (!record.reservation.hasCustody() || record.receiving) throw new Error('editor-native-target-staging-revoked')
      if (!record.assertMounted) throw new Error('editor-native-target-mounted-owner-released')
      record.assertMounted()
      if (!record.reservation.hasCustody()) throw new Error('editor-native-target-staging-revoked')
      record.receiving = true
    },
    assertReceiving() {
      const record = current
      if (!record) return
      if (!record.receiving || !record.reservation.hasCustody()) throw new Error('editor-native-target-staging-revoked')
      if (!record.assertMounted) throw new Error('editor-native-target-mounted-owner-released')
      record.assertMounted()
      if (!record.receiving || !record.reservation.hasCustody()) throw new Error('editor-native-target-staging-revoked')
    },
    endReceiving() { if (current) current.receiving = false },
    inspectCleanup: inspect,
    retryCleanup: () => current ? clean(current) : false,
  })
}
