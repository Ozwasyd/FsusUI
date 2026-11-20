import { describe, expect, it } from 'vitest'
import {
  Alignment,
  FixedDir,
  SortOrder,
  oppositeOrderMap,
  sortOrders,
} from '../../../components/table-v2/src/constants'
import {
  TooltipV2Sides,
  tooltipV2OppositeSide,
  tooltipV2Sides,
} from '../../../components/tooltip-v2/src/common'
import {
  SetOperationEnum,
  TreeOptionsEnum,
} from '../../../components/tree-v2/src/virtual-tree'
import { PatchFlags } from '../../vue/vnode'

// These expectations describe the existing exported enum objects, including
// reflection visible to consumers; they do not derive values from the candidate.
function expectEnumObject(
  actual: object,
  entries: ReadonlyArray<readonly [string, string | number]>,
) {
  expect(Object.getPrototypeOf(actual)).toBe(Object.prototype)
  expect(Object.keys(actual)).toEqual(entries.map(([key]) => key))
  expect(Object.values(actual)).toEqual(entries.map(([, value]) => value))
  for (const [key, value] of entries) {
    expect(Object.getOwnPropertyDescriptor(actual, key)).toEqual({
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }
}

const numericMembers = [
  ['TEXT', 1],
  ['CLASS', 2],
  ['STYLE', 4],
  ['PROPS', 8],
  ['FULL_PROPS', 16],
  ['HYDRATE_EVENTS', 32],
  ['STABLE_FRAGMENT', 64],
  ['KEYED_FRAGMENT', 128],
  ['UNKEYED_FRAGMENT', 256],
  ['NEED_PATCH', 512],
  ['DYNAMIC_SLOTS', 1024],
  ['HOISTED', -1],
  ['BAIL', -2],
] as const

describe('exported enum runtime compatibility', () => {
  it('preserves TableV2 sort order values and their ordered public collections', () => {
    expectEnumObject(SortOrder, [
      ['ASC', 'asc'],
      ['DESC', 'desc'],
    ])
    expect(sortOrders).toEqual(['asc', 'desc'])
    expect(oppositeOrderMap).toEqual({ asc: 'desc', desc: 'asc' })
  })

  it('preserves TableV2 alignment values and property descriptors', () => {
    expectEnumObject(Alignment, [
      ['CENTER', 'center'],
      ['RIGHT', 'right'],
    ])
  })

  it('preserves TableV2 fixed-direction values and property descriptors', () => {
    expectEnumObject(FixedDir, [
      ['LEFT', 'left'],
      ['RIGHT', 'right'],
    ])
  })

  it('preserves TooltipV2 side order, values and opposite-side lookup', () => {
    expectEnumObject(TooltipV2Sides, [
      ['top', 'top'],
      ['bottom', 'bottom'],
      ['left', 'left'],
      ['right', 'right'],
    ])
    expect(tooltipV2Sides).toEqual(['top', 'bottom', 'left', 'right'])
    expect(tooltipV2OppositeSide).toEqual({
      top: 'bottom',
      bottom: 'top',
      left: 'right',
      right: 'left',
    })
  })

  it('preserves TreeV2 option-key values and their enumeration order', () => {
    expectEnumObject(TreeOptionsEnum, [
      ['KEY', 'id'],
      ['LABEL', 'label'],
      ['CHILDREN', 'children'],
      ['DISABLED', 'disabled'],
    ])
  })

  it('preserves both TreeV2 set-operation member values', () => {
    expect(SetOperationEnum.ADD).toBe('add')
    expect(SetOperationEnum.DELETE).toBe('delete')
  })

  it.each(numericMembers)(
    'preserves PatchFlags.%s = %i and the reverse lookup',
    (name, value) => {
      expect(PatchFlags[name]).toBe(value)
      expect(PatchFlags[value]).toBe(name)
    },
  )

  it('preserves numeric-key ordering and descriptors, including negative reverse keys', () => {
    expectEnumObject(PatchFlags, [
      ['1', 'TEXT'],
      ['2', 'CLASS'],
      ['4', 'STYLE'],
      ['8', 'PROPS'],
      ['16', 'FULL_PROPS'],
      ['32', 'HYDRATE_EVENTS'],
      ['64', 'STABLE_FRAGMENT'],
      ['128', 'KEYED_FRAGMENT'],
      ['256', 'UNKEYED_FRAGMENT'],
      ['512', 'NEED_PATCH'],
      ['1024', 'DYNAMIC_SLOTS'],
      ['TEXT', 1],
      ['CLASS', 2],
      ['STYLE', 4],
      ['PROPS', 8],
      ['FULL_PROPS', 16],
      ['HYDRATE_EVENTS', 32],
      ['STABLE_FRAGMENT', 64],
      ['KEYED_FRAGMENT', 128],
      ['UNKEYED_FRAGMENT', 256],
      ['NEED_PATCH', 512],
      ['DYNAMIC_SLOTS', 1024],
      ['HOISTED', -1],
      ['-1', 'HOISTED'],
      ['BAIL', -2],
      ['-2', 'BAIL'],
    ])
  })
})
