import { withInstall } from '@element-plus/utils'
import ResizeSeparator from './src/resize-separator.vue'

const FsusResizeSeparatorComponent = {
  ...ResizeSeparator,
  name: 'FsusResizeSeparator',
} as typeof ResizeSeparator

export const ElResizeSeparator = withInstall(ResizeSeparator, {
  FsusResizeSeparator: FsusResizeSeparatorComponent,
})
export const FsusResizeSeparator = ElResizeSeparator.FsusResizeSeparator
export default ElResizeSeparator

export * from './src/resize-separator'
export type { ResizeSeparatorInstance } from './src/instance'
