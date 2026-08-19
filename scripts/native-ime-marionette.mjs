/**
 * Minimal Marionette client for official Firefox native IME evidence.
 * Playwright's patched Firefox does not attach ibus; stock Firefox does.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'

const decode = (buffer) => {
  const text = buffer.toString('utf8')
  const split = text.indexOf(':')
  if (split < 1) return { rest: buffer, message: null }
  const length = Number(text.slice(0, split))
  if (!Number.isFinite(length)) return { rest: buffer, message: null }
  const payload = buffer.subarray(split + 1)
  if (payload.length < length) return { rest: buffer, message: null }
  return {
    message: JSON.parse(payload.subarray(0, length).toString('utf8')),
    rest: payload.subarray(length),
  }
}

export const connectMarionette = async (port, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      return await new Promise((resolve, reject) => {
        const socket = createConnection({ host: '127.0.0.1', port }, () => {})
        let buffer = Buffer.alloc(0)
        let commandId = 0
        const pending = new Map()
        let helloDone = false
        socket.on('error', reject)
        socket.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk])
          while (true) {
            const decoded = decode(buffer)
            if (!decoded.message) break
            buffer = decoded.rest
            if (!helloDone) {
              helloDone = true
              resolve({
                socket,
                hello: decoded.message,
                send: (name, params = {}) =>
                  new Promise((resolveSend, rejectSend) => {
                    commandId += 1
                    const id = commandId
                    pending.set(id, { resolveSend, rejectSend })
                    const payload = JSON.stringify([0, id, name, params])
                    socket.write(`${Buffer.byteLength(payload)}:${payload}`)
                  }),
                close: () => socket.destroy(),
              })
              continue
            }
            const [, id, error, result] = decoded.message
            const waiter = pending.get(id)
            if (!waiter) continue
            pending.delete(id)
            if (error) waiter.rejectSend(new Error(error.message || JSON.stringify(error)))
            else waiter.resolveSend(result)
          }
        })
      })
    } catch (error) {
      lastError = error
      await new Promise((resolveWait) => setTimeout(resolveWait, 200))
    }
  }
  throw lastError ?? new Error(`marionette port ${port} not ready`)
}

const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

export const createMarionettePage = async (session) => {
  await session.send('WebDriver:NewSession', {})
  const evaluate = async (fn, ...args) => {
    const source = typeof fn === 'function' ? fn.toString() : String(fn)
    const result = await session.send('WebDriver:ExecuteScript', {
      script: `return (${source})(...arguments)`,
      args,
    })
    return result?.value
  }
  return {
    evaluate,
    goto: async (url) => {
      await session.send('WebDriver:Navigate', { url })
      const deadline = Date.now() + 20_000
      while (Date.now() < deadline) {
        const ready = await evaluate(() => ({
          readyState: document.readyState,
          url: window.location.href,
        }))
        if (ready?.readyState === 'complete' && ready.url === url) return
        await sleep(200)
      }
    },
    locator: (selector) => ({
      waitFor: async ({ timeout = 20_000 } = {}) => {
        const deadline = Date.now() + timeout
        while (Date.now() < deadline) {
          const found = await evaluate(
            (sel) => Boolean(document.querySelector(sel)),
            selector,
          )
          if (found) return
          await sleep(200)
        }
        throw new Error(`locator ${selector} not found`)
      },
      click: async () => {
        const element = await session.send('WebDriver:FindElement', {
          value: selector,
          using: 'css selector',
        })
        const id = Object.values(element.value)[0]
        await session.send('WebDriver:ElementClick', { id })
      },
      getAttribute: async (name) =>
        evaluate(
          (sel, attr) => document.querySelector(sel)?.getAttribute(attr) ?? null,
          selector,
          name,
        ),
    }),
    screenshot: async ({ path }) => {
      const result = await session.send('WebDriver:TakeScreenshot', {
        full: true,
        hash: false,
      })
      writeFileSync(path, Buffer.from(result.value, 'base64'))
    },
    reload: async () => {
      await session.send('WebDriver:Refresh', {})
      await sleep(300)
    },
    waitForFunction: async (fn, argument, { timeout = 20_000 } = {}) => {
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        const value = await evaluate(fn, argument)
        if (value) return value
        await sleep(200)
      }
      throw new Error('waitForFunction timed out')
    },
  }
}

export const spawnOfficialFirefox = ({ executable, profileDirectory, env, marionettePort }) => {
  writeFileSync(
    join(profileDirectory, 'user.js'),
    [
      `user_pref("marionette.port", ${Number(marionettePort)});`,
      'user_pref("security.sandbox.content.level", 0);',
      'user_pref("security.sandbox.gpu.level", 0);',
      'user_pref("focusmanager.testmode", false);',
      'user_pref("widget.use-xdg-desktop-portal", 0);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
      '',
    ].join('\n'),
  )
  return spawn(
    executable,
    ['--marionette', '-no-remote', '-profile', profileDirectory],
    {
      env: {
        ...env,
        MOZ_DISABLE_CONTENT_SANDBOX: '1',
        IBUS_ENABLE_SYNC_MODE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}
