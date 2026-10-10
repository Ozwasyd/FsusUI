import type { createPopper } from '@popperjs/core'
import type { createTablePopper } from '../src/util'

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
    ? true
    : false

type AssertTrue<Value extends true> = Value

export type OrdinaryTableCorePopperReturn = AssertTrue<
  Equal<ReturnType<typeof createTablePopper>, ReturnType<typeof createPopper>>
>

export type OrdinaryTableCorePopperNeverNull = AssertTrue<
  Equal<null extends ReturnType<typeof createTablePopper> ? true : false, false>
>
