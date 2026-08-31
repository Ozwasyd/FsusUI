export const captureDeterministicLocatorPng = async (
  locator,
  { samples = 2 } = {},
) => {
  if (!Number.isInteger(samples) || samples < 2) {
    throw new Error('deterministic screenshot requires at least two samples')
  }
  let accepted = null
  for (let index = 0; index < samples; index += 1) {
    const current = await locator.screenshot({ animations: 'disabled' })
    if (!Buffer.isBuffer(current)) {
      throw new Error('deterministic screenshot did not return PNG bytes')
    }
    if (accepted && !accepted.equals(current)) {
      throw new Error('deterministic screenshot samples differ')
    }
    accepted = current
  }
  return accepted
}
