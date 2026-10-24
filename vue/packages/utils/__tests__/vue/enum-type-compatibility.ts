import type {
  Alignment,
  FixedDir,
  SortOrder,
  sortOrders,
} from '../../../components/table-v2/src/constants'
import type { TooltipV2Sides } from '../../../components/tooltip-v2/src/common'
import type {
  SetOperationEnum,
  TreeOptionsEnum,
} from '../../../components/tree-v2/src/virtual-tree'
import type { PatchFlags } from '../../vue/vnode'

// Compiled by the complete Vitest type project; no product module is executed.
type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type IsAny<T> = 0 extends 1 & T ? true : false

// Qualified names and value-member types must retain the same nominal identity.
export type EnumMemberContracts = [
  Assert<Equal<SortOrder.ASC, typeof SortOrder.ASC>>,
  Assert<Equal<SortOrder.DESC, typeof SortOrder.DESC>>,
  Assert<Equal<Alignment.CENTER, typeof Alignment.CENTER>>,
  Assert<Equal<Alignment.RIGHT, typeof Alignment.RIGHT>>,
  Assert<Equal<FixedDir.LEFT, typeof FixedDir.LEFT>>,
  Assert<Equal<FixedDir.RIGHT, typeof FixedDir.RIGHT>>,
  Assert<Equal<TooltipV2Sides.top, typeof TooltipV2Sides.top>>,
  Assert<Equal<TooltipV2Sides.bottom, typeof TooltipV2Sides.bottom>>,
  Assert<Equal<TooltipV2Sides.left, typeof TooltipV2Sides.left>>,
  Assert<Equal<TooltipV2Sides.right, typeof TooltipV2Sides.right>>,
  Assert<Equal<TreeOptionsEnum.KEY, typeof TreeOptionsEnum.KEY>>,
  Assert<Equal<TreeOptionsEnum.LABEL, typeof TreeOptionsEnum.LABEL>>,
  Assert<Equal<TreeOptionsEnum.CHILDREN, typeof TreeOptionsEnum.CHILDREN>>,
  Assert<Equal<TreeOptionsEnum.DISABLED, typeof TreeOptionsEnum.DISABLED>>,
  Assert<
    Equal<Extract<SetOperationEnum, SetOperationEnum.ADD>, SetOperationEnum.ADD>
  >,
  Assert<
    Equal<
      Extract<SetOperationEnum, SetOperationEnum.DELETE>,
      SetOperationEnum.DELETE
    >
  >,
  Assert<Equal<PatchFlags.TEXT, typeof PatchFlags.TEXT>>,
  Assert<Equal<PatchFlags.CLASS, typeof PatchFlags.CLASS>>,
  Assert<Equal<PatchFlags.STYLE, typeof PatchFlags.STYLE>>,
  Assert<Equal<PatchFlags.PROPS, typeof PatchFlags.PROPS>>,
  Assert<Equal<PatchFlags.FULL_PROPS, typeof PatchFlags.FULL_PROPS>>,
  Assert<Equal<PatchFlags.HYDRATE_EVENTS, typeof PatchFlags.HYDRATE_EVENTS>>,
  Assert<Equal<PatchFlags.STABLE_FRAGMENT, typeof PatchFlags.STABLE_FRAGMENT>>,
  Assert<Equal<PatchFlags.KEYED_FRAGMENT, typeof PatchFlags.KEYED_FRAGMENT>>,
  Assert<
    Equal<PatchFlags.UNKEYED_FRAGMENT, typeof PatchFlags.UNKEYED_FRAGMENT>
  >,
  Assert<Equal<PatchFlags.NEED_PATCH, typeof PatchFlags.NEED_PATCH>>,
  Assert<Equal<PatchFlags.DYNAMIC_SLOTS, typeof PatchFlags.DYNAMIC_SLOTS>>,
  Assert<Equal<PatchFlags.HOISTED, typeof PatchFlags.HOISTED>>,
  Assert<Equal<PatchFlags.BAIL, typeof PatchFlags.BAIL>>,
]

// Plain strings must not become admissible, and no member may become `any`.
type StringEnums =
  | SortOrder
  | Alignment
  | FixedDir
  | TooltipV2Sides
  | TreeOptionsEnum
  | SetOperationEnum
type StringValues =
  | 'asc'
  | 'desc'
  | 'center'
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'id'
  | 'label'
  | 'children'
  | 'disabled'
  | 'add'
  | 'delete'
export type EnumAdmissionContracts = [
  Assert<Equal<IsAny<StringEnums | PatchFlags>, false>>,
  Assert<Equal<Extract<StringValues, StringEnums>, never>>,
  Assert<Equal<Extract<3 | 4096, PatchFlags>, never>>,
  Assert<Equal<Extract<SortOrder.ASC, SortOrder.DESC>, never>>,
  Assert<Equal<Extract<SetOperationEnum.ADD, SetOperationEnum.DELETE>, never>>,
  Assert<Equal<typeof sortOrders, readonly [SortOrder.ASC, SortOrder.DESC]>>,
]

// These golden values describe the original contracts, not a candidate-derived map.
export type EnumValueContracts = [
  Assert<Equal<`${SortOrder.ASC}`, 'asc'>>,
  Assert<Equal<`${SortOrder.DESC}`, 'desc'>>,
  Assert<Equal<`${Alignment.CENTER}`, 'center'>>,
  Assert<Equal<`${Alignment.RIGHT}`, 'right'>>,
  Assert<Equal<`${FixedDir.LEFT}`, 'left'>>,
  Assert<Equal<`${FixedDir.RIGHT}`, 'right'>>,
  Assert<Equal<`${TooltipV2Sides.top}`, 'top'>>,
  Assert<Equal<`${TooltipV2Sides.bottom}`, 'bottom'>>,
  Assert<Equal<`${TooltipV2Sides.left}`, 'left'>>,
  Assert<Equal<`${TooltipV2Sides.right}`, 'right'>>,
  Assert<Equal<`${TreeOptionsEnum.KEY}`, 'id'>>,
  Assert<Equal<`${TreeOptionsEnum.LABEL}`, 'label'>>,
  Assert<Equal<`${TreeOptionsEnum.CHILDREN}`, 'children'>>,
  Assert<Equal<`${TreeOptionsEnum.DISABLED}`, 'disabled'>>,
  Assert<Equal<`${SetOperationEnum.ADD}`, 'add'>>,
  Assert<Equal<`${SetOperationEnum.DELETE}`, 'delete'>>,
  Assert<Equal<`${PatchFlags.TEXT}`, '1'>>,
  Assert<Equal<`${PatchFlags.CLASS}`, '2'>>,
  Assert<Equal<`${PatchFlags.STYLE}`, '4'>>,
  Assert<Equal<`${PatchFlags.PROPS}`, '8'>>,
  Assert<Equal<`${PatchFlags.FULL_PROPS}`, '16'>>,
  Assert<Equal<`${PatchFlags.HYDRATE_EVENTS}`, '32'>>,
  Assert<Equal<`${PatchFlags.STABLE_FRAGMENT}`, '64'>>,
  Assert<Equal<`${PatchFlags.KEYED_FRAGMENT}`, '128'>>,
  Assert<Equal<`${PatchFlags.UNKEYED_FRAGMENT}`, '256'>>,
  Assert<Equal<`${PatchFlags.NEED_PATCH}`, '512'>>,
  Assert<Equal<`${PatchFlags.DYNAMIC_SLOTS}`, '1024'>>,
  Assert<Equal<`${PatchFlags.HOISTED}`, '-1'>>,
  Assert<Equal<`${PatchFlags.BAIL}`, '-2'>>,
]
