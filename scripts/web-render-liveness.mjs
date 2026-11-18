/* global AbortController, fetch */
import { Buffer } from 'node:buffer'
import { clearTimeout, setTimeout } from 'node:timers'

// Node-side fail-closed watchdogs. They never supply acceptance measurements.
export async function bounded(operation, label, timeoutMs = 120_000) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`Web performance timeout: ${label} (${timeoutMs}ms)`),
            ),
          timeoutMs,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function guardMethods(target, methods, label, timeoutMs = 120_000) {
  return new Proxy(target, {
    get(object, key) {
      const value = Reflect.get(object, key, object)
      if (typeof value !== 'function') return value
      if (!methods.includes(key)) return value.bind(object)
      return (...args) =>
        bounded(
          () => value.apply(object, args),
          `${label()} ${String(key)}${key === 'send' ? `:${args[0]}` : ''}`,
          timeoutMs,
        )
    },
  })
}

const serverStates = new WeakMap()

// Call immediately after spawn, before any await. Retain only a bounded byte tail.
export function observeServer(server, tailBytes = 16 * 1024) {
  if (!server) return
  const state = { error: null, stderr: Buffer.alloc(0) }
  serverStates.set(server, state)
  server.on('error', (error) => {
    state.error = error
  })
  server.stdout?.resume()
  server.stderr?.on('data', (chunk) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    state.stderr = Buffer.concat([
      state.stderr,
      bytes.subarray(-tailBytes),
    ]).subarray(-tailBytes)
  })
}

function serverFailure(server) {
  const state = serverStates.get(server)
  const suffix = state?.stderr.length
    ? `\nVite stderr tail:\n${state.stderr.toString('utf8')}`
    : ''
  if (state?.error)
    return new Error(`Vite startup failed: ${state.error.message}${suffix}`, {
      cause: state.error,
    })
  if (server.exitCode !== null || server.signalCode)
    return new Error(
      `Vite exited with ${server.signalCode || server.exitCode}${suffix}`,
    )
  return null
}

export async function cleanupAll(
  primaryError,
  operations,
  report = console.error,
) {
  let firstCleanupError
  for (const operation of operations) {
    try {
      await operation()
    } catch (error) {
      if (!firstCleanupError) firstCleanupError = error
      if (primaryError || error !== firstCleanupError)
        report('Secondary Web performance cleanup failure:', error)
    }
  }
  if (!primaryError && firstCleanupError) throw firstCleanupError
}

export async function waitForServer(
  server,
  url,
  timeoutMs = 120_000,
  fetcher = fetch,
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const failure = serverFailure(server)
    if (failure) throw failure
    const controller = new AbortController()
    try {
      const response = await bounded(
        () => fetcher(url, { signal: controller.signal }),
        'fixture-server readiness fetch',
        Math.min(5_000, Math.max(1, deadline - Date.now())),
      )
      // Consume neither an unbounded body nor leave the response stream open.
      void response.body?.cancel().catch(() => {})
      if (response.ok && !serverFailure(server)) return
    } catch {
    } finally {
      controller.abort()
    }
    const remaining = deadline - Date.now()
    if (remaining > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(250, remaining)),
      )
  }
  const failure = serverFailure(server)
  if (failure) throw failure
  const tail = serverStates.get(server)?.stderr.toString('utf8') ?? ''
  throw new Error(
    `Timed out waiting for performance fixture server (${timeoutMs}ms readiness budget)${tail ? `\nVite stderr tail:\n${tail}` : ''}`,
  )
}

export async function readTrace(session, stream, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  const send = (method, params) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0)
      throw new Error(
        `Web performance timeout: ${label} trace stream EOF (${timeoutMs}ms)`,
      )
    return bounded(
      () => session.send(method, params),
      `${label} ${method}`,
      remaining,
    )
  }
  let text = ''
  while (true) {
    const chunk = await send('IO.read', { handle: stream })
    text += chunk.data
    if (chunk.eof) break
  }
  await send('IO.close', { handle: stream })
  return JSON.parse(text).traceEvents ?? []
}

export async function stopServer(server, timeoutMs = 5_000) {
  // Immediate owned child only; detached browser/escaped descendants require the outer supervisor.
  if (
    !server ||
    server.exitCode !== null ||
    server.signalCode ||
    (serverStates.get(server)?.error && !server.pid)
  )
    return
  let onExit
  const exited = new Promise((resolve) => {
    onExit = resolve
    server.once('exit', onExit)
  })
  try {
    server.kill('SIGTERM')
    await bounded(() => exited, 'Vite SIGTERM cleanup', timeoutMs)
  } catch {
    server.kill('SIGKILL')
    await bounded(() => exited, 'Vite SIGKILL cleanup', timeoutMs)
  } finally {
    server.removeListener('exit', onExit)
  }
}
