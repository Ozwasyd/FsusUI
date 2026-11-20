export declare enum TreeOptionsEnum {
  KEY = 'id',
  LABEL = 'label',
  CHILDREN = 'children',
  DISABLED = 'disabled',
}
declare const enum SetOperationEnum {
  ADD = 'add',
  DELETE = 'delete',
}
export type { SetOperationEnum }
import type { SetOperationEnum as SetOperationEnumRuntime } from './virtual-tree'
declare module './virtual-tree' {
  namespace SetOperationEnum {
    type ADD = typeof SetOperationEnumRuntime.ADD
    type DELETE = typeof SetOperationEnumRuntime.DELETE
  }
}
