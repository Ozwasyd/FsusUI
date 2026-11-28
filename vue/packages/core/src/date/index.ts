export type FsusDateInput = Date | string | number | null | undefined

const pad2 = (n: number) => String(Math.trunc(n)).padStart(2, '0')

export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

export const startOfWeek = (d: Date, weekStart: 0 | 1 = 1): Date => {
  const diff = (d.getDay() - weekStart + 7) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff, 0, 0, 0, 0)
}

export const endOfWeek = (d: Date, weekStart: 0 | 1 = 1): Date => {
  const start = startOfWeek(d, weekStart)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
}

export const getISOWeekNumber = (d: Date): number => {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export const dateFromISOWeek = (year: number, week: number): Date => {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const week1Monday = new Date(year, 0, 4 - (jan4Day - 1))
  return new Date(
    week1Monday.getFullYear(),
    week1Monday.getMonth(),
    week1Monday.getDate() + (week - 1) * 7,
  )
}

export const getDecadeRange = (year: number): number[] => {
  const start = Math.floor(year / 10) * 10
  return Array.from({ length: 10 }, (_, idx) => start + idx)
}

export const setTime = (d: Date, hours: number, minutes: number, seconds = 0): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, seconds, 0)

export const toDate = (input: FsusDateInput): Date | null => {
  if (input === null || input === undefined || input === '') return null
  if (input instanceof Date) return isValidDate(input) ? new Date(input.getTime()) : null
  if (typeof input === 'number') {
    const d = new Date(input)
    return isValidDate(d) ? d : null
  }
  const trimmed = input.trim()
  const isoWeek = /^(\d{4})-?W(\d{1,2})$/i.exec(trimmed)
  if (isoWeek) {
    const w = Number(isoWeek[2])
    if (w >= 1 && w <= 53) return dateFromISOWeek(Number(isoWeek[1]), w)
  }
  const yearOnly = /^(\d{4})$/.exec(trimmed)
  if (yearOnly) {
    return new Date(Number(yearOnly[1]), 0, 1)
  }
  const yearMonth = /^(\d{4})-(\d{1,2})$/.exec(trimmed)
  if (yearMonth) {
    const m = Number(yearMonth[2])
    if (m >= 1 && m <= 12) return new Date(Number(yearMonth[1]), m - 1, 1)
  }
  const isoDateOnly = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (isoDateOnly) {
    const y = Number(isoDateOnly[1])
    const m = Number(isoDateOnly[2])
    const day = Number(isoDateOnly[3])
    const d = new Date(y, m - 1, day)
    if (d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day) return d
    return null
  }
  const isoDateTime =
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(trimmed)
  if (isoDateTime) {
    const y = Number(isoDateTime[1])
    const m = Number(isoDateTime[2])
    const day = Number(isoDateTime[3])
    const hh = Number(isoDateTime[4])
    const mm = Number(isoDateTime[5])
    const ss = Number(isoDateTime[6] ?? 0)
    if (hh > 23 || mm > 59 || ss > 59) return null
    const d = new Date(y, m - 1, day, hh, mm, ss)
    if (d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day) return d
    return null
  }
  const parsed = new Date(trimmed)
  return isValidDate(parsed) ? parsed : null
}

export const parseDateByFormat = (input: string, format = 'YYYY-MM-DD'): Date | null => {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (format.includes('WW')) {
    const m = /(\d{4})\D+W?(\d{1,2})/i.exec(trimmed)
    if (m) {
      const w = Number(m[2])
      if (w >= 1 && w <= 53) return dateFromISOWeek(Number(m[1]), w)
    }
  }
  // Support slash-delimited dates as well
  const normalized = trimmed.replace(/\//g, '-')
  return toDate(normalized)
}

export const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)

export const endOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

export const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate()

export const addDays = (d: Date, delta: number): Date => {
  const next = new Date(d.getTime())
  next.setDate(next.getDate() + delta)
  return next
}

export const addMonths = (d: Date, delta: number): Date => {
  const targetYear = d.getFullYear()
  const targetMonth = d.getMonth() + delta
  const maxDay = daysInMonth(targetYear, targetMonth)
  return new Date(
    targetYear,
    targetMonth,
    Math.min(d.getDate(), maxDay),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  )
}

export const addYears = (d: Date, delta: number): Date => addMonths(d, delta * 12)

export const isSameDay = (a: Date | null, b: Date | null): boolean =>
  Boolean(
    a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate(),
  )

export const isSameMonth = (a: Date | null, b: Date | null): boolean =>
  Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())

export const isSameYear = (a: Date | null, b: Date | null): boolean =>
  Boolean(a && b && a.getFullYear() === b.getFullYear())

export const isBeforeDay = (a: Date, b: Date): boolean =>
  startOfDay(a).getTime() < startOfDay(b).getTime()

export const isAfterDay = (a: Date, b: Date): boolean =>
  startOfDay(a).getTime() > startOfDay(b).getTime()

export const isBetweenDays = (target: Date, start: Date | null, end: Date | null): boolean => {
  if (!start || !end) return false
  const t = startOfDay(target).getTime()
  const s = startOfDay(start).getTime()
  const e = startOfDay(end).getTime()
  const lo = Math.min(s, e)
  const hi = Math.max(s, e)
  return t >= lo && t <= hi
}

export const formatDate = (input: FsusDateInput, format = 'YYYY-MM-DD'): string => {
  const d = toDate(input)
  if (!d) return ''
  const tokens: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear()).slice(-2),
    MM: pad2(d.getMonth() + 1),
    M: String(d.getMonth() + 1),
    DD: pad2(d.getDate()),
    D: String(d.getDate()),
    HH: pad2(d.getHours()),
    H: String(d.getHours()),
    mm: pad2(d.getMinutes()),
    m: String(d.getMinutes()),
    ss: pad2(d.getSeconds()),
    s: String(d.getSeconds()),
    WW: pad2(getISOWeekNumber(d)),
  }
  return format.replace(
    /\[([^\]]+)\]|YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s|WW/g,
    (match, literal: string | undefined) => (literal !== undefined ? literal : tokens[match]!),
  )
}

export const parseTime = (
  input: string | null | undefined,
): { hours: number; minutes: number; seconds: number } | null => {
  if (!input) return null
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return { hours, minutes, seconds }
}

export const formatTime = (hours: number, minutes: number, seconds?: number): string =>
  seconds === undefined
    ? `${pad2(hours)}:${pad2(minutes)}`
    : `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`

export interface CalendarCell {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  key: string
}

export const getMonthGrid = (
  year: number,
  monthIndex: number,
  weekStart: 0 | 1 = 1,
  today = new Date(),
): CalendarCell[] => {
  const first = new Date(year, monthIndex, 1)
  const firstWeekday = first.getDay()
  const leading = (firstWeekday - weekStart + 7) % 7
  const start = addDays(first, -leading)
  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i)
    cells.push({
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
      isToday: isSameDay(date, today),
      key: formatDate(date, 'YYYY-MM-DD'),
    })
  }
  return cells
}

export const getWeekdayNames = (locale = 'zh-CN', weekStart: 0 | 1 = 1): string[] => {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // 2024-01-07 is Sunday
  const names: string[] = []
  for (let i = 0; i < 7; i++) {
    const dayOffset = (weekStart + i) % 7
    names.push(fmt.format(new Date(2024, 0, 7 + dayOffset)))
  }
  return names
}

export const getMonthNames = (locale = 'zh-CN'): string[] => {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2024, m, 1)))
}
