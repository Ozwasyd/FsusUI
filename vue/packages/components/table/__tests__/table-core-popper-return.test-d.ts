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

// Without strictNullChecks, null is assignable to both returns. The independent
// strict source/declaration controls verify that neither return accepts null.
export type OrdinaryTableCorePopperNullability = AssertTrue<
  Equal<
    null extends ReturnType<typeof createTablePopper> ? true : false,
    null extends ReturnType<typeof createPopper> ? true : false
  >
>
