/** Exact original SFC birth; independent of the document ticket retired by native transfer. */
export interface MarkdownEditorNativeTargetBirth {
  readonly scope: 'original-mounted-native-target-birth'
}

export interface MarkdownEditorNativeTargetSubscription {
  hasCustody(): boolean
  unsubscribe(): boolean
  failureCause(): unknown
}

export interface MarkdownEditorNativeTargetLifetimeHandle {
  captureBirth(): MarkdownEditorNativeTargetBirth | null
  /** Original private observed lifetime only; no DOM/source/document-ticket reads. */
  hasCustody(birth: MarkdownEditorNativeTargetBirth): boolean
  subscribeBeforeInvalidation(receiver: () => void): MarkdownEditorNativeTargetSubscription
}

interface Receiver {
  readonly callback: () => void
  registered: boolean
  notified: boolean
  releasing: boolean
  failed: boolean
  cause: unknown
}

/** One actual SFC owner. Native adoption/cancel/cleanup remain in the original handover owner. */
export const createMarkdownEditorNativeTargetOwner = (owner: {
  readonly captureMountedBirth: () => (() => void) | null
}) => {
  let birth: MarkdownEditorNativeTargetBirth | undefined
  let capturing = false
  let retired = false
  let notifying = false
  let activeReceiver: Receiver | undefined
  const receivers = new Set<Receiver>()
  const fail = (record: Receiver, cause: unknown) => { record.failed = true; record.cause = cause }
  const hasCustody = (candidate: MarkdownEditorNativeTargetBirth): boolean =>
    birth !== undefined && birth === candidate && !retired && !capturing && !notifying
  const call = (record: Receiver) => {
    record.failed = false
    const previous = activeReceiver
    activeReceiver = record
    try { record.callback() } catch (cause) { fail(record, cause); throw cause }
    finally { activeReceiver = previous }
    // A caught unsubscribe reentry does not make the notification successful.
    if (record.failed) throw record.cause
    record.notified = true
  }
  const handle: MarkdownEditorNativeTargetLifetimeHandle = Object.freeze({
    hasCustody,
    captureBirth() {
      if (retired || capturing || notifying) return null
      if (birth) return hasCustody(birth) ? birth : null
      capturing = true
      try {
        const assertMounted = owner.captureMountedBirth()
        if (!assertMounted || retired || notifying) return null
        const candidate: MarkdownEditorNativeTargetBirth = Object.freeze({ scope: 'original-mounted-native-target-birth' })
        assertMounted()
        if (retired || notifying || birth) return null
        birth = candidate
        return candidate
      } finally { capturing = false }
    },
    subscribeBeforeInvalidation(receiver: () => void) {
      if (typeof receiver !== 'function') throw new TypeError('editor-native-target-receiver-invalid')
      if (retired || capturing || notifying || !birth) throw new Error('editor-native-target-subscription-unavailable')
      const record: Receiver = { callback: receiver, registered: true, notified: false,
        releasing: false, failed: false, cause: undefined }
      const subscription: MarkdownEditorNativeTargetSubscription = Object.freeze({
        hasCustody: () => record.registered,
        failureCause: () => record.cause,
        unsubscribe() {
          if (!record.registered) return false
          if (notifying || record.releasing) {
            const cause = new Error('editor-native-target-unsubscribe-reentrant')
            fail(record, cause)
            if (activeReceiver) fail(activeReceiver, cause)
            throw cause
          }
          record.releasing = true
          try {
            // Retry only this genuine failed notification before releasing it.
            if (record.failed) call(record)
            if (record.failed) throw record.cause
            record.registered = false
            receivers.delete(record)
            return true
          } catch (cause) { fail(record, cause); throw cause }
          finally { record.releasing = false }
        },
      })
      if (retired || capturing || notifying || !birth) throw new Error('editor-native-target-subscription-revoked')
      receivers.add(record)
      return subscription
    },
  })
  return Object.freeze({
    handle,
    invalidate() {
      // Withdraw before every original receiver and before the subsequent owner effect.
      retired = true
      if (notifying) {
        const cause = new Error('editor-native-target-invalidation-reentrant')
        if (activeReceiver) fail(activeReceiver, cause)
        throw cause
      }
      notifying = true
      let failed = false
      let firstCause: unknown
      try {
        for (const record of [...receivers]) {
          if (!record.registered || (record.notified && !record.failed)) continue
          try {
            if (record.releasing) throw new Error('editor-native-target-release-active')
            call(record)
          } catch (cause) {
            fail(record, cause)
            if (!failed) firstCause = cause
            failed = true
          }
        }
      } finally { notifying = false }
      if (failed) throw firstCause
    },
    assertReceiving() {
      if (retired || capturing || notifying || (birth && !hasCustody(birth)))
        throw new Error('editor-native-target-lifetime-retired')
    },
  })
}
