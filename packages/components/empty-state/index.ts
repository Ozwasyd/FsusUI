import { withInstall } from '@element-plus/utils'

import EmptyState from './src/empty-state.vue'

const FsusEmptyStateComponent = {
  ...EmptyState,
  name: 'FsusEmptyState',
}

export const ElEmptyState = withInstall(EmptyState, {
  FsusEmptyState: FsusEmptyStateComponent,
})
export const FsusEmptyState = ElEmptyState.FsusEmptyState
export default ElEmptyState

export * from './src/empty-state'
export type { EmptyStateInstance } from './src/instance'
