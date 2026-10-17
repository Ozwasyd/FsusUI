type ResizeDomain = Readonly<{ min: number; max: number; step: number }>
type Decimal = { coefficient: bigint; exponent: number }

// Normalize finite Number inputs to their shortest round-trippable decimals.
// Keep mapping and half-step decisions exact; convert only the final proposal.
const decimal = (value: number): Decimal => {
  const [mantissa, exponent = '0'] = value.toString().split('e')
  const point = mantissa.indexOf('.')
  return {
    coefficient: BigInt(mantissa.replace('.', '')),
    exponent: Number(exponent) - (point < 0 ? 0 : mantissa.length - point - 1),
  }
}
const decimalUnits = (values: number[]) => {
  const decimals = values.map(decimal)
  const exponent = Math.min(...decimals.map((entry) => entry.exponent))
  return {
    exponent,
    units: decimals.map(
      (entry) => entry.coefficient * 10n ** BigInt(entry.exponent - exponent),
    ),
  }
}

export const hasResolvableResizeStep = (domain: ResizeDomain) => {
  const magnitude = Math.max(Math.abs(domain.min), Math.abs(domain.max))
  const bits = new DataView(new ArrayBuffer(8))
  bits.setFloat64(0, magnitude)
  const exponent = (bits.getUint32(0) >>> 20) & 0x7ff
  const ulp = exponent === 0 ? Number.MIN_VALUE : 2 ** (exponent - 1023 - 52)
  // Both a step and its half-step boundary must remain distinguishable.
  return domain.step / 2 >= ulp
}

const quantizeRatio = (
  domain: ResizeDomain,
  exponent: number,
  min: bigint,
  max: bigint,
  step: bigint,
  numerator: bigint,
  denominator: bigint,
) => {
  if (denominator < 0n) {
    numerator = -numerator
    denominator = -denominator
  }
  if (numerator <= min * denominator) return domain.min
  if (numerator >= max * denominator) return domain.max
  const distance = numerator - min * denominator
  const increment = step * denominator
  // Nonnegative integer division gives floor; exact half steps round upward.
  const steps = (2n * distance + increment) / (2n * increment)
  const proposal = min + steps * step
  if (proposal <= min) return domain.min
  if (proposal >= max) return domain.max
  return Math.min(
    domain.max,
    Math.max(domain.min, Number(`${proposal}e${exponent}`)),
  )
}

export const getResizePointerProposal = (
  domain: ResizeDomain,
  initialValue: number,
  initialCoordinate: number,
  coordinate: number,
  range: Readonly<{ start: number; end: number }>,
) => {
  const { exponent, units } = decimalUnits([
    domain.min,
    domain.max,
    domain.step,
    initialValue,
    initialCoordinate,
    coordinate,
    range.start,
    range.end,
  ])
  const [min, max, step, value, origin, axis, start, end] = units
  const denominator = end - start
  const numerator = value * denominator + (axis - origin) * (max - min)
  return quantizeRatio(domain, exponent, min, max, step, numerator, denominator)
}

export const getResizeKeyboardProposal = (
  domain: ResizeDomain,
  value: number,
  direction: -1 | 1,
) => {
  const { exponent, units } = decimalUnits([
    domain.min,
    domain.max,
    domain.step,
    value,
  ])
  const [min, max, step, current] = units
  return quantizeRatio(
    domain,
    exponent,
    min,
    max,
    step,
    current + BigInt(direction) * step,
    1n,
  )
}
