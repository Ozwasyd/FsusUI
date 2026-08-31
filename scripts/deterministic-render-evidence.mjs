export const captureDeterministicLocatorPng = async (
  locator,
  { samples = 2 } = {},
) => {
  if (!Number.isInteger(samples) || samples < 2) {
    throw new Error('deterministic screenshot requires at least two samples')
  }
  await locator.evaluate(async (element) => {
    await document.fonts.ready
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    )
    await new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
    )
  })
  let accepted = null
  for (let index = 0; index < samples; index += 1) {
    const current = await locator.screenshot()
    if (!Buffer.isBuffer(current)) {
      throw new Error('deterministic screenshot did not return PNG bytes')
    }
    if (accepted && !accepted.equals(current)) {
      throw new Error(
        `deterministic screenshot samples differ first=${sha256(accepted)} current=${sha256(current)}`,
      )
    }
    accepted = current
  }
  return accepted
}
import { createHash } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
