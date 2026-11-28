export type FsusColorFormat = 'hex' | 'rgb' | 'hsl'

export interface HsvaColor {
  /** Hue in [0, 360] */
  h: number
  /** Saturation in [0, 100] */
  s: number
  /** Value / Brightness in [0, 100] */
  v: number
  /** Alpha in [0, 1] */
  a: number
}

export interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

export interface HslaColor {
  h: number
  s: number
  l: number
  a: number
}

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))
const toHex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')

export const hsvaToRgba = ({ h, s, v, a }: HsvaColor): RgbaColor => {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const vv = clamp(v, 0, 100) / 100
  const c = vv * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = vv - c
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hh < 60) [r1, g1, b1] = [c, x, 0]
  else if (hh < 120) [r1, g1, b1] = [x, c, 0]
  else if (hh < 180) [r1, g1, b1] = [0, c, x]
  else if (hh < 240) [r1, g1, b1] = [0, x, c]
  else if (hh < 300) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
    a: clamp(Number(a.toFixed(2)), 0, 1),
  }
}

export const rgbaToHsva = (r: number, g: number, b: number, a = 1): HsvaColor => {
  const rr = clamp(r, 0, 255) / 255
  const gg = clamp(g, 0, 255) / 255
  const bb = clamp(b, 0, 255) / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6)
    else if (max === gg) h = 60 * ((bb - rr) / d + 2)
    else h = 60 * ((rr - gg) / d + 4)
  }
  if (h < 0) h += 360
  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100
  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
    a: clamp(Number(a.toFixed(2)), 0, 1),
  }
}

export const hsvaToHsla = ({ h, s, v, a }: HsvaColor): HslaColor => {
  const ss = clamp(s, 0, 100) / 100
  const vv = clamp(v, 0, 100) / 100
  const l = vv * (1 - ss / 2)
  const sl = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l)
  return {
    h: Math.round(((h % 360) + 360) % 360),
    s: Math.round(sl * 100),
    l: Math.round(l * 100),
    a: clamp(Number(a.toFixed(2)), 0, 1),
  }
}

export const hslaToHsva = (h: number, s: number, l: number, a = 1): HsvaColor => {
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100
  const v = ll + ss * Math.min(ll, 1 - ll)
  const sv = v === 0 ? 0 : 2 * (1 - ll / v)
  return {
    h: Math.round(((h % 360) + 360) % 360),
    s: Math.round(sv * 100),
    v: Math.round(v * 100),
    a: clamp(Number(a.toFixed(2)), 0, 1),
  }
}

export const parseColor = (input: string | null | undefined): HsvaColor | null => {
  if (!input) return null
  const raw = input.trim()
  if (!raw) return null

  // #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw)
  if (hexMatch) {
    const hex = hexMatch[1]!
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16)
      const g = parseInt(hex[1]! + hex[1]!, 16)
      const b = parseInt(hex[2]! + hex[2]!, 16)
      const a = hex.length === 4 ? parseInt(hex[3]! + hex[3]!, 16) / 255 : 1
      return rgbaToHsva(r, g, b, a)
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    return rgbaToHsva(r, g, b, a)
  }

  // rgb(r, g, b) / rgba(r, g, b, a) / rgb(r g b / a)
  const rgbMatch =
    /^rgba?\(\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i.exec(
      raw,
    )
  if (rgbMatch) {
    const r = Number(rgbMatch[1])
    const g = Number(rgbMatch[2])
    const b = Number(rgbMatch[3])
    const aRaw = rgbMatch[4]
    const a = aRaw
      ? aRaw.endsWith('%')
        ? Number(aRaw.slice(0, -1)) / 100
        : Number(aRaw)
      : 1
    return rgbaToHsva(r, g, b, a)
  }

  // hsl(h, s%, l%) / hsla(h, s%, l%, a)
  const hslMatch =
    /^hsla?\(\s*([0-9.]+)(?:deg)?\s*[,\s]\s*([0-9.]+)%\s*[,\s]\s*([0-9.]+)%(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i.exec(
      raw,
    )
  if (hslMatch) {
    const h = Number(hslMatch[1])
    const s = Number(hslMatch[2])
    const l = Number(hslMatch[3])
    const aRaw = hslMatch[4]
    const a = aRaw
      ? aRaw.endsWith('%')
        ? Number(aRaw.slice(0, -1)) / 100
        : Number(aRaw)
      : 1
    return hslaToHsva(h, s, l, a)
  }

  return null
}

export const formatColor = (
  hsva: HsvaColor,
  format: FsusColorFormat = 'hex',
  showAlpha = false,
): string => {
  const rgba = hsvaToRgba(hsva)
  const includeAlpha = showAlpha && rgba.a < 1

  if (format === 'rgb') {
    return showAlpha
      ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`
      : `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`
  }
  if (format === 'hsl') {
    const hsla = hsvaToHsla(hsva)
    return showAlpha
      ? `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`
      : `hsl(${hsla.h}, ${hsla.s}%, ${hsla.l}%)`
  }
  const baseHex = `#${toHex2(rgba.r)}${toHex2(rgba.g)}${toHex2(rgba.b)}`.toUpperCase()
  return includeAlpha ? `${baseHex}${toHex2(rgba.a * 255).toUpperCase()}` : baseHex
}
