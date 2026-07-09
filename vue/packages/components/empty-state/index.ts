import { withInstall } from '@element-plus/utils'

import EmptyState from './src/empty-state.vue'

import type { Component } from 'vue'
import type { SFCWithInstall } from '@element-plus/utils'

type EmptyStateWithAlias = SFCWithInstall<typeof EmptyState> & {
  FsusEmptyState: Component
}

const FsusEmptyStateComponent = {
  ...EmptyState,
  name: 'FsusEmptyState',
} as Component

export const ElEmptyState = withInstall(EmptyState, {
  FsusEmptyState: FsusEmptyStateComponent,
}) as EmptyStateWithAlias
export const FsusEmptyState = ElEmptyState.FsusEmptyState
export default ElEmptyState

export * from './src/empty-state'
export type { EmptyStateInstance } from './src/instance'
