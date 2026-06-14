import { withInstall } from '@element-plus/utils'

import CollectionSummary from './src/collection-summary.vue'
import CollectionToolbar from './src/collection-toolbar.vue'
import FilterGroup from './src/filter-group.vue'
import PaginationBar from './src/pagination-bar.vue'
import SegmentedControl from './src/segmented-control.vue'

const createAlias = <T extends { name?: string }>(component: T, name: string) =>
  ({
    ...component,
    name,
  }) as T

export const ElCollectionToolbar = withInstall(CollectionToolbar, {
  FsusCollectionToolbar: createAlias(
    CollectionToolbar,
    'FsusCollectionToolbar',
  ),
})
export const FsusCollectionToolbar = ElCollectionToolbar.FsusCollectionToolbar

export const ElFilterGroup = withInstall(FilterGroup, {
  FsusFilterGroup: createAlias(FilterGroup, 'FsusFilterGroup'),
})
export const FsusFilterGroup = ElFilterGroup.FsusFilterGroup

export const ElSegmentedControl = withInstall(SegmentedControl, {
  FsusSegmentedControl: createAlias(SegmentedControl, 'FsusSegmentedControl'),
})
export const FsusSegmentedControl = ElSegmentedControl.FsusSegmentedControl

export const ElCollectionSummary = withInstall(CollectionSummary, {
  FsusCollectionSummary: createAlias(
    CollectionSummary,
    'FsusCollectionSummary',
  ),
})
export const FsusCollectionSummary = ElCollectionSummary.FsusCollectionSummary

export const ElPaginationBar = withInstall(PaginationBar, {
  FsusPaginationBar: createAlias(PaginationBar, 'FsusPaginationBar'),
})
export const FsusPaginationBar = ElPaginationBar.FsusPaginationBar

export * from './src/collection-toolbar'
export * from './src/filter-group'
export * from './src/segmented-control'
export * from './src/collection-summary'
export * from './src/pagination-bar'
