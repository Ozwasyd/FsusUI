import { withInstall } from '@element-plus/utils'

import TaskPageHeader from './src/task-page-header.vue'

const FsusTaskPageHeaderComponent = {
  ...TaskPageHeader,
  name: 'FsusTaskPageHeader',
} as typeof TaskPageHeader

export const ElTaskPageHeader = withInstall(TaskPageHeader, {
  FsusTaskPageHeader: FsusTaskPageHeaderComponent,
})
export const FsusTaskPageHeader = ElTaskPageHeader.FsusTaskPageHeader
export default ElTaskPageHeader

export * from './src/task-page-header'
