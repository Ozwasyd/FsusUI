export type FsusErrorCode =
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'infra'
  | 'protocol'
  | 'timeout'
  | 'aborted'
  | 'invariant'
  | 'unknown'

export type FsusErrorCategory =
  | 'auth'
  | 'conflict'
  | 'invariant'
  | 'not-found'
  | 'runtime'
  | 'unknown'
  | 'validation'

export interface FsusErrorDetail {
  code: FsusErrorCode
  message: string
  category: FsusErrorCategory
  cause?: unknown
  details?: string
  traceId?: string
}

export type FsusResult<T, E extends FsusErrorDetail = FsusErrorDetail> =
  | { ok: true; value: T }
  | { ok: false; error: E }

const fsusErrorCodes = new Set<FsusErrorCode>([
  'validation',
  'not-found',
  'conflict',
  'unauthorized',
  'forbidden',
  'infra',
  'protocol',
  'timeout',
  'aborted',
  'invariant',
  'unknown',
])

const categoryByCode: Record<FsusErrorCode, FsusErrorCategory> = {
  aborted: 'runtime',
  conflict: 'conflict',
  forbidden: 'auth',
  infra: 'runtime',
  invariant: 'invariant',
  'not-found': 'not-found',
  protocol: 'runtime',
  timeout: 'runtime',
  unauthorized: 'auth',
  unknown: 'unknown',
  validation: 'validation',
}

const isFsusErrorCode = (code: unknown): code is FsusErrorCode =>
  typeof code === 'string' && fsusErrorCodes.has(code as FsusErrorCode)

const isAbortLike = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const payload = error as { message?: unknown; name?: unknown }
  return (
    payload.name === 'AbortError' ||
    (typeof payload.message === 'string' &&
      /abort|aborted|cancel|canceled/i.test(payload.message))
  )
}

const isTimeoutLike = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const payload = error as { message?: unknown; name?: unknown }
  return (
    payload.name === 'TimeoutError' ||
    (typeof payload.message === 'string' && /timeout/i.test(payload.message))
  )
}

export const createFsusError = (
  code: FsusErrorCode,
  message: string,
  options: Omit<Partial<FsusErrorDetail>, 'category' | 'code' | 'message'> & {
    category?: FsusErrorCategory
  } = {},
): FsusErrorDetail => ({
  category: options.category ?? categoryByCode[code],
  code,
  message,
  ...(options.cause === undefined ? {} : { cause: options.cause }),
  ...(options.details === undefined ? {} : { details: options.details }),
  ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
})

export const fsusOk = <T>(value: T): FsusResult<T> => ({ ok: true, value })

export const fsusErr = <T = never, E extends FsusErrorDetail = FsusErrorDetail>(
  error: E,
): FsusResult<T, E> => ({ ok: false, error })

export const isFsusResult = (value: unknown): value is FsusResult<unknown> => {
  if (!value || typeof value !== 'object') return false

  const payload = value as {
    error?: unknown
    ok?: unknown
    value?: unknown
  }

  if (payload.ok === true) {
    return 'value' in payload
  }

  if (
    payload.ok !== false ||
    !payload.error ||
    typeof payload.error !== 'object'
  ) {
    return false
  }

  const error = payload.error as { code?: unknown; message?: unknown }
  return isFsusErrorCode(error.code) && typeof error.message === 'string'
}

export const isFsusOk = <T, E extends FsusErrorDetail>(
  result: FsusResult<T, E>,
): result is { ok: true; value: T } => result.ok

export const isFsusErr = <T, E extends FsusErrorDetail>(
  result: FsusResult<T, E>,
): result is { ok: false; error: E } => !result.ok

export const isTruthyFsusOk = (value: unknown): boolean =>
  isFsusResult(value) && value.ok === true && Boolean(value.value)

export const getFsusErrorMessage = (
  value: unknown,
  fallback = 'fsus_unknown_error',
): string => {
  if (isFsusResult(value) && value.ok === false) {
    return value.error.message || fallback
  }

  if (value && typeof value === 'object') {
    const payload = value as { error?: unknown; message?: unknown }
    if (typeof payload.message === 'string' && payload.message) {
      return payload.message
    }
    if (payload.error && typeof payload.error === 'object') {
      const error = payload.error as { message?: unknown }
      if (typeof error.message === 'string' && error.message) {
        return error.message
      }
    }
  }

  return typeof value === 'string' && value ? value : fallback
}

export const toFsusError = (
  error: unknown,
  fallbackMessage = 'fsus_unknown_error',
  fallbackCode: FsusErrorCode = 'unknown',
): FsusErrorDetail => {
  if (error && typeof error === 'object') {
    const payload = error as {
      category?: unknown
      code?: unknown
      details?: unknown
      message?: unknown
      traceId?: unknown
    }
    if (isFsusErrorCode(payload.code) && typeof payload.message === 'string') {
      return createFsusError(payload.code, payload.message, {
        category:
          typeof payload.category === 'string'
            ? (payload.category as FsusErrorCategory)
            : undefined,
        cause: error,
        details:
          typeof payload.details === 'string' ? payload.details : undefined,
        traceId:
          typeof payload.traceId === 'string' ? payload.traceId : undefined,
      })
    }
  }

  const code = isAbortLike(error)
    ? 'aborted'
    : isTimeoutLike(error)
      ? 'timeout'
      : fallbackCode
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallbackMessage

  return createFsusError(code, message || fallbackMessage, { cause: error })
}

export const mapFsusResult = <
  T,
  U,
  E extends FsusErrorDetail = FsusErrorDetail,
>(
  result: FsusResult<T, E>,
  mapper: (value: T) => U,
): FsusResult<U, E> =>
  isFsusOk(result) ? { ok: true, value: mapper(result.value) } : result

export const bindFsusResult = <
  T,
  U,
  E extends FsusErrorDetail = FsusErrorDetail,
>(
  result: FsusResult<T, E>,
  binder: (value: T) => FsusResult<U, E>,
): FsusResult<U, E> => (isFsusOk(result) ? binder(result.value) : result)

export const fsusTry = <T>(
  fn: () => T,
  fallbackMessage = 'fsus_operation_failed',
  fallbackCode: FsusErrorCode = 'unknown',
): FsusResult<T> => {
  try {
    return fsusOk(fn())
  } catch (error) {
    return fsusErr(toFsusError(error, fallbackMessage, fallbackCode))
  }
}

export const fsusTryAsync = async <T>(
  fn: () => Promise<T>,
  fallbackMessage = 'fsus_async_operation_failed',
  fallbackCode: FsusErrorCode = 'unknown',
): Promise<FsusResult<T>> => {
  try {
    return fsusOk(await fn())
  } catch (error) {
    return fsusErr(toFsusError(error, fallbackMessage, fallbackCode))
  }
}
