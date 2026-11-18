import { spawn } from 'node:child_process'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'

export const historicalDeadlines = Object.freeze({
  git: 30_000,
  sdk: 60_000,
  checker: 60_000,
  benchmark: 15 * 60_000,
})

// A private POSIX group includes children that outlive the launcher or hold its pipes.
export function runHistoricalProcess(
  command,
  args,
  {
    timeoutMs,
    graceMs = 5_000,
    stage = command,
    stream = false,
    maxOutputBytes = 16 * 1024 * 1024,
    ...options
  },
) {
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isFinite(graceMs) ||
    graceMs < 0 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes < 1
  )
    throw new Error(
      'Historical process deadlines and output limit must be valid',
    )
  return new Promise((resolve, reject) => {
    const grouped = process.platform !== 'win32'
    const child = spawn(command, args, {
      ...options,
      detached: grouped,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = '',
      stderr = '',
      outputBytes = 0,
      finished = false,
      closed = false,
      result,
      failure,
      escalation,
      drain
    const signalChild = (signal) => {
      if (
        !Number.isSafeInteger(child.pid) ||
        child.pid <= 1 ||
        child.pid === process.pid
      )
        return
      try {
        if (grouped) process.kill(-child.pid, signal)
        else child.kill(signal)
      } catch (error) {
        if (error.code !== 'ESRCH') failure ??= error
      }
    }
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(deadline)
      clearTimeout(escalation)
      clearTimeout(drain)
      process.removeListener('SIGTERM', onTerm)
      process.removeListener('SIGINT', onInt)
      const captured = { ...result, stdout, stderr }
      if (failure)
        reject(
          Object.assign(failure, {
            stdout,
            stderr,
            exitCode: result?.code,
            signal: result?.signal,
          }),
        )
      else resolve(captured)
    }
    const stop = (code, message) => {
      if (finished || failure) return
      failure = Object.assign(new Error(`Historical ${stage}: ${message}`), {
        code,
        stage,
        timedOut: code === 'HISTORICAL_TIMEOUT',
        cancelled: code === 'HISTORICAL_CANCELLED',
      })
      clearTimeout(deadline)
      signalChild('SIGTERM')
      escalation = setTimeout(() => {
        // Do this even if the group leader closed: descendants may ignore TERM.
        signalChild('SIGKILL')
        if (closed) finish()
        else
          drain = setTimeout(() => {
            child.stdout.destroy()
            child.stderr.destroy()
            child.unref()
            finish()
          }, 1_000)
      }, graceMs)
    }
    const onTerm = () => stop('HISTORICAL_CANCELLED', 'cancelled by SIGTERM')
    const onInt = () => stop('HISTORICAL_CANCELLED', 'cancelled by SIGINT')
    process.on('SIGTERM', onTerm)
    process.on('SIGINT', onInt)
    const capture = (chunk, target) => {
      if (outputBytes + chunk.length > maxOutputBytes) {
        outputBytes = maxOutputBytes
        stop(
          'HISTORICAL_OUTPUT_LIMIT',
          `output limit exceeded (${maxOutputBytes} bytes)`,
        )
        return
      }
      outputBytes += chunk.length
      if (target === 'stdout') stdout += chunk
      else stderr += chunk
      if (stream) process[target].write(chunk)
    }
    child.stdout.on('data', (chunk) => capture(chunk, 'stdout'))
    child.stderr.on('data', (chunk) => capture(chunk, 'stderr'))
    child.once('error', (error) => {
      if (finished) return
      if (!child.pid) {
        failure ??= error
        finish()
      } else {
        stop('HISTORICAL_PROCESS_ERROR', error.message)
        if (failure) failure.cause ??= error
      }
    })
    child.once('close', (code, signal) => {
      closed = true
      result = { code, signal }
      if (!failure) finish()
    })
    const deadline = setTimeout(
      () => stop('HISTORICAL_TIMEOUT', `deadline exceeded (${timeoutMs}ms)`),
      timeoutMs,
    )
  })
}

export async function execHistoricalProcess(command, args, options) {
  const result = await runHistoricalProcess(command, args, options)
  if (result.code !== 0 || result.signal)
    throw Object.assign(
      new Error(
        `Historical ${options.stage}: ${command} exited with ${result.code ?? result.signal}`,
      ),
      result,
    )
  return result
}
