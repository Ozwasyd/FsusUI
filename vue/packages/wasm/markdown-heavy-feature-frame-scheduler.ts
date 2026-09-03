export type MarkdownHeavyFeatureTrustedScriptUrlFactory = (
  moduleUrl: URL,
) => unknown

export type MarkdownHeavyFeatureFrameContinueScheduler = (
  key: string,
  run: () => void,
  drop: () => void,
) => (() => void) | null

interface MarkdownHeavyFeatureFrameSchedulerTask {
  readonly key: string
  readonly mutate?: () => void
  readonly postPaint?: () => void
}

interface MarkdownHeavyFeatureFrameSchedulerAuthority {
  readonly cancel: (key: string) => void
  readonly schedule: (task: MarkdownHeavyFeatureFrameSchedulerTask) => boolean
}

export const scheduleMarkdownHeavyFeatureFrameContinue = (
  scheduler: MarkdownHeavyFeatureFrameSchedulerAuthority,
  key: string,
  run: () => void,
  drop: () => void,
) => {
  const gateKey = `${key}:gate`
  const dispatchKey = `${key}:dispatch`
  let cancelled = false
  const cancel = () => {
    if (cancelled) return
    cancelled = true
    scheduler.cancel(gateKey)
    scheduler.cancel(dispatchKey)
  }
  const accepted = scheduler.schedule({
    key: gateKey,
    postPaint: () => {
      if (cancelled) return
      if (
        !scheduler.schedule({
          key: dispatchKey,
          mutate: () => {
            if (!cancelled) run()
          },
        })
      ) {
        cancel()
        drop()
      }
    },
  })
  return accepted ? cancel : null
}
