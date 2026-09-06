import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')

export const CONTRACT_V2_SCHEMA_VERSION = 2
export const CONTRACT_V2_REGISTRY_VERSION = '2.0.0'
export const CONTRACT_V2_RELEASE_CLASSIFICATION = 'preview'
export const CONTRACT_V2_OWNER = 'FsusUI Core'

export const MEMBER_STATUSES = [
  'aligned-candidate',
  'partial',
  'missing',
  'web-only',
]
export const GOVERNANCE_FIELDS = [
  'reason',
  'owner',
  'testPolicy',
  'reviewPolicy',
]
export const MARKDOWN_EDITOR_MODES = ['source', 'live', 'split', 'preview']
export const MARKDOWN_EDITOR_CAPABILITIES = [
  'supported',
  'unsupported-platform',
  'runtime-unavailable',
  'projection-failed',
  'feature-degraded',
  'fatal',
]

export const VUE_BASELINE_PATH = 'spec/baselines/vue-current.json'
export const AVALONIA_SEMANTIC_PATHS = {
  avalonia: 'spec/avalonia/semantic/FsusUI.Avalonia.semantic.json',
  avaloniaThemes: 'spec/avalonia/semantic/FsusUI.Avalonia.Themes.semantic.json',
  avaloniaIcons: 'spec/avalonia/semantic/FsusUI.Avalonia.Icons.semantic.json',
}
export const MARKDOWN_EDITOR_GATE_PATH =
  'spec/components/contracts/v2/markdown-editor-gate.json'
export const SEMANTIC_MEMBER_BINDINGS_PATH =
  'spec/components/contracts/v2/semantic-member-bindings.json'
export const CONTRACT_V2_REGISTRY_PATH =
  'spec/components/contracts/v2/contract-v2.json'
export const V1_CONTRACT_REGISTRY_PATH =
  'spec/components/contracts/v1/vue-public-contracts.json'

export const CONTRACT_V2_CONSUMER_BINDINGS = {
  'component-v2.common-picker': { releaseFamily: 'date-time', galleryRoute: 'date-time' },
  'component-v2.dynamic-size-grid': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.dynamic-size-list': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.el-affix': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-alert': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-aside': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-auto-resizer': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.el-autocomplete': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-avatar': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-backtop': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-badge': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-breadcrumb': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-breadcrumb-item': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-button': { releaseFamily: 'button', galleryRoute: 'button' },
  'component-v2.el-button-group': { releaseFamily: 'button', galleryRoute: 'button' },
  'component-v2.el-calendar': { releaseFamily: 'date-time', galleryRoute: 'date-time' },
  'component-v2.el-card': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-carousel': { releaseFamily: 'media-decorative', galleryRoute: 'media-decorative' },
  'component-v2.el-carousel-item': { releaseFamily: 'media-decorative', galleryRoute: 'media-decorative' },
  'component-v2.el-cascader': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-cascader-panel': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-check-tag': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-checkbox': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-checkbox-button': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-checkbox-group': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-col': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-collapse': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-collapse-item': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-collapse-transition': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-collection-summary': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-collection-toolbar': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-color-picker': { releaseFamily: 'value-picker', galleryRoute: 'value-picker' },
  'component-v2.el-config-provider': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-container': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-conversation-context-bar': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-conversation-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-conversation-list-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-copyable-detail': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-countdown': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-danger-zone': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-data-list': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-date-picker': { releaseFamily: 'date-time', galleryRoute: 'date-time' },
  'component-v2.el-descriptions': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-descriptions-item': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-destructive-action-panel': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-diagnostics-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-diagnostics-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-dialog': { releaseFamily: 'modal-panel', galleryRoute: 'modal-panel' },
  'component-v2.el-distribution-bar-row': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-distribution-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-divider': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-drawer': { releaseFamily: 'modal-panel', galleryRoute: 'modal-panel' },
  'component-v2.el-dropdown': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-dropdown-item': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-dropdown-menu': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-empty': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-empty-selection-state': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-empty-state': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-filter-group': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-footer': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-form': { releaseFamily: 'form', galleryRoute: 'form' },
  'component-v2.el-form-item': { releaseFamily: 'form', galleryRoute: 'form' },
  'component-v2.el-form-section': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-header': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-icon': { releaseFamily: 'icon-text', galleryRoute: 'icon-text' },
  'component-v2.el-image': { releaseFamily: 'media-decorative', galleryRoute: 'media-decorative' },
  'component-v2.el-image-viewer': { releaseFamily: 'media-decorative', galleryRoute: 'media-decorative' },
  'component-v2.el-inbox-empty-state': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-inbox-layout': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-infinite-scroll': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.el-inline-actions': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-input': { releaseFamily: 'input', galleryRoute: 'input' },
  'component-v2.el-input-number': { releaseFamily: 'input', galleryRoute: 'input' },
  'component-v2.el-key-value-grid': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-key-value-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-kpi-group': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-link': { releaseFamily: 'icon-text', galleryRoute: 'icon-text' },
  'component-v2.el-loading': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-loading-directive': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-loading-service': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-localization-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.el-main': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-markdown-editor': { releaseFamily: 'text-editor', galleryRoute: 'markdown-editor' },
  'component-v2.el-markdown-renderer': { releaseFamily: 'text-viewer', galleryRoute: 'text-viewer' },
  'component-v2.el-menu': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-menu-item': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-menu-item-group': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-message': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-message-box': { releaseFamily: 'modal-panel', galleryRoute: 'modal-panel' },
  'component-v2.el-message-bubble': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-message-timeline': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-metadata-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-metadata-row': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-metric-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-metric-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-micro-interaction-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.el-notification': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
  'component-v2.el-option': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-option-group': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-overlay': { releaseFamily: 'modal-panel', galleryRoute: 'modal-panel' },
  'component-v2.el-page-header': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-pagination': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-pagination-bar': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-perception-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.el-perception-character-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.el-popconfirm': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-popover': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-popover-directive': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-popper': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-popper-arrow': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-popper-content': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-popper-trigger': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-progress': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-public-shell': { releaseFamily: 'public-shell', galleryRoute: 'public-shell' },
  'component-v2.el-radio': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-radio-button': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-radio-group': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-rate': { releaseFamily: 'value-picker', galleryRoute: 'value-picker' },
  'component-v2.el-reply-composer-shell': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-resource-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-resource-list-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-responsive-collection': { releaseFamily: 'public-shell', galleryRoute: 'public-shell' },
  'component-v2.el-result': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-risk-notice': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-row': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-scrollbar': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-section-header': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-section-nav': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-section-nav-link': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-segmented-control': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-select': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-select-v2': { releaseFamily: 'picker', galleryRoute: 'picker' },
  'component-v2.el-settings-section': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-site-header': { releaseFamily: 'public-shell', galleryRoute: 'public-shell' },
  'component-v2.el-skeleton': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-skeleton-item': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.el-slider': { releaseFamily: 'value-picker', galleryRoute: 'value-picker' },
  'component-v2.el-space': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-split-pane': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-statistic': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-status-summary': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-step': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-steps': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-sub-menu': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-switch': { releaseFamily: 'selection', galleryRoute: 'selection' },
  'component-v2.el-tab-pane': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-table': { releaseFamily: 'data-table', galleryRoute: 'data-table' },
  'component-v2.el-table-column': { releaseFamily: 'data-table', galleryRoute: 'data-table' },
  'component-v2.el-table-v2': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.el-tabs': { releaseFamily: 'navigation', galleryRoute: 'navigation' },
  'component-v2.el-tag': { releaseFamily: 'icon-text', galleryRoute: 'icon-text' },
  'component-v2.el-task-page-header': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-text': { releaseFamily: 'icon-text', galleryRoute: 'icon-text' },
  'component-v2.el-text-task-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.el-theme-mode-toggle': { releaseFamily: 'public-shell', galleryRoute: 'public-shell' },
  'component-v2.el-thread-panel': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-time-picker': { releaseFamily: 'date-time', galleryRoute: 'date-time' },
  'component-v2.el-time-select': { releaseFamily: 'date-time', galleryRoute: 'date-time' },
  'component-v2.el-timeline': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-timeline-item': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.el-tooltip': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-tooltip-v2': { releaseFamily: 'anchored-overlay', galleryRoute: 'anchored-overlay' },
  'component-v2.el-transfer': { releaseFamily: 'upload-transfer', galleryRoute: 'upload-transfer' },
  'component-v2.el-tree': { releaseFamily: 'tree', galleryRoute: 'tree' },
  'component-v2.el-tree-select': { releaseFamily: 'tree', galleryRoute: 'tree' },
  'component-v2.el-tree-v2': { releaseFamily: 'tree', galleryRoute: 'tree' },
  'component-v2.el-typed-confirm-field': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.el-upload': { releaseFamily: 'upload-transfer', galleryRoute: 'upload-transfer' },
  'component-v2.el-visually-hidden': { releaseFamily: 'layout', galleryRoute: 'layout' },
  'component-v2.el-watermark': { releaseFamily: 'media-decorative', galleryRoute: 'media-decorative' },
  'component-v2.fixed-size-grid': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.fixed-size-list': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.fsus-collection-summary': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.fsus-collection-toolbar': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.fsus-conversation-context-bar': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-conversation-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-conversation-list-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-copyable-detail': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-danger-zone': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-data-list': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.fsus-destructive-action-panel': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-diagnostics-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-diagnostics-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-distribution-bar-row': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-distribution-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-empty-selection-state': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-empty-state': { releaseFamily: 'display', galleryRoute: 'display' },
  'component-v2.fsus-filter-group': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.fsus-form-section': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-inbox-empty-state': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-inbox-layout': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-inline-actions': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-key-value-grid': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-key-value-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-kpi-group': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-localization-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.fsus-message-bubble': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-message-timeline': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-metadata-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-metadata-row': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-metric-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-metric-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-micro-interaction-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.fsus-pagination-bar': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.fsus-perception-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.fsus-perception-character-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.fsus-reply-composer-shell': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-resource-list': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-resource-list-item': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-risk-notice': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-section-header': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-section-nav': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-section-nav-link': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-segmented-control': { releaseFamily: 'data-display', galleryRoute: 'data-display' },
  'component-v2.fsus-settings-section': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-split-pane': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-status-summary': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-task-page-header': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-text-task-challenge': { releaseFamily: 'perception-challenge', galleryRoute: 'perception-challenge' },
  'component-v2.fsus-thread-panel': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.fsus-typed-confirm-field': { releaseFamily: 'product-primitives', galleryRoute: 'product-primitives' },
  'component-v2.table-v2': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.table-v2-alignment': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.table-v2-fixed-dir': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.table-v2-placeholder': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.table-v2-sort-order': { releaseFamily: 'virtualization', galleryRoute: 'virtualization' },
  'component-v2.time-pick-panel': { releaseFamily: 'date-time', galleryRoute: 'date-time' },
  'component-v2.v-loading': { releaseFamily: 'service-helper', galleryRoute: 'service-helper' },
}

export const CONTRACT_V2_RELEASE_SCOPE_FAMILIES = [
  'anchored-overlay',
  'button',
  'data-display',
  'data-table',
  'date-time',
  'display',
  'form',
  'icon-text',
  'input',
  'layout',
  'media-decorative',
  'modal-panel',
  'navigation',
  'perception-challenge',
  'picker',
  'product-primitives',
  'public-shell',
  'selection',
  'service-helper',
  'text-editor',
  'text-viewer',
  'tree',
  'upload-transfer',
  'value-picker',
  'virtualization',
]

export const CONTRACT_V2_GALLERY_ROUTES = [
  'anchored-overlay',
  'button',
  'data-display',
  'data-table',
  'date-time',
  'display',
  'form',
  'icon-text',
  'input',
  'layout',
  'markdown-editor',
  'media-decorative',
  'modal-panel',
  'navigation',
  'perception-challenge',
  'picker',
  'product-primitives',
  'public-shell',
  'selection',
  'service-helper',
  'text-viewer',
  'tree',
  'upload-transfer',
  'value-picker',
  'virtualization',
]

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
const parseJson = (file) => JSON.parse(read(file))
const sha256 = (content) =>
  crypto.createHash('sha256').update(content).digest('hex')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const toKebab = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

// Component-level name equality: strip the platform prefix and kebab-case.
// This is an explicit per-component basis and never derives a counterpart from
// the portable/native-adapter/platform-override classification.
export const kebabName = (value) =>
  toKebab(value.replace(/^El/, '').replace(/^Fsus/, ''))

// Member-level name normalization used only for candidate matching. It is
// narrow (single member), documented, and never hides a member gap: every
// member that does not resolve to a real counterpart is explicitly registered.
export const normalizeMemberName = (value) => {
  let normalized = value
    .replace(/^Is(?=[A-Z])/, '')
    .replace(/^Can(?=[A-Z])/, '')
    .replace(/^Has(?=[A-Z])/, '')
  normalized = normalized.replace(/Changed$/, '')
  return toKebab(normalized)
}

const CLR_TO_CATEGORY = {
  'System.String': 'string',
  'System.Boolean': 'boolean',
  'System.Double': 'number',
  'System.Single': 'number',
  'System.Decimal': 'number',
  'System.Int32': 'number',
  'System.Int64': 'number',
  'System.Int16': 'number',
  'System.UInt32': 'number',
  'System.UInt64': 'number',
  'System.Byte': 'number',
  'System.SByte': 'number',
  'System.Object': 'object',
  'System.DateTime': 'date',
  'System.DateTimeOffset': 'date',
  'System.Uri': 'string',
  'System.Guid': 'string',
  'System.Void': 'void',
  'FsusUI.Avalonia.Controls.FsusTableV2Sort': 'object',
}

export const categoriesFromClrType = (type) => {
  const trimmed = (type ?? '').replace(/\?$/, '').trim()
  if (!trimmed) return ['unknown']
  const base = trimmed.split('<')[0].trim()
  if (CLR_TO_CATEGORY[base]) return [CLR_TO_CATEGORY[base]]
  if (
    base.startsWith('System.Collections') ||
    base.startsWith('System.Linq') ||
    base.endsWith('[]')
  ) {
    return ['array']
  }
  if (
    base === 'System.Action' ||
    base === 'System.Func' ||
    base === 'System.EventHandler'
  ) {
    return ['function']
  }
  return [base.split('.').pop() || 'unknown']
}

const VUE_RUNTIME_TO_CATEGORY = {
  String: 'string',
  Boolean: 'boolean',
  Number: 'number',
  BigInt: 'number',
  Array: 'array',
  Function: 'function',
  Object: 'object',
  Date: 'date',
  Symbol: 'symbol',
}

const normalizeVueSemanticType = (value) =>
  (value ?? '')
    .trim()
    .replace(/^readonly\s+/, '')
    .replace(/^PropType<(.+)>$/, '$1')
    .replace(/^Array<(.+)>$/, '$1[]')
    .replace(/\s*\|\s*undefined$/, '')

export const categoriesFromVueProp = (prop) => {
  if (prop?.runtimeType && VUE_RUNTIME_TO_CATEGORY[prop.runtimeType]) {
    return [VUE_RUNTIME_TO_CATEGORY[prop.runtimeType]]
  }
  const semanticType = normalizeVueSemanticType(prop?.semanticType)
  if (semanticType) {
    return semanticType
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const normalized = normalizeVueSemanticType(part)
        if (normalized === 'string') return 'string'
        if (
          normalized === 'boolean' ||
          normalized === 'true' ||
          normalized === 'false'
        )
          return 'boolean'
        if (normalized === 'number') return 'number'
        if (normalized === 'void') return 'void'
        if (normalized.endsWith('[]') || normalized.startsWith('SingleOrRange'))
          return 'array'
        if (normalized.includes('Component') || normalized.includes('VNode'))
          return 'component'
        return 'unknown'
      })
  }
  return ['unknown']
}

const categoriesOverlap = (first, second) => {
  const a = first.includes('unknown')
    ? first.filter((x) => x !== 'unknown')
    : first
  const b = second.includes('unknown')
    ? second.filter((x) => x !== 'unknown')
    : second
  if (a.length === 0 || b.length === 0) return null // not comparable
  return a.some((value) => b.includes(value))
}

const comparableValues = (values) => [
  ...new Set(
    (values ?? [])
      .filter((value) => value != null)
      .map((value) => String(value).toLowerCase()),
  ),
]

const enumMemberNames = (enumMembers) => [
  ...new Set(
    (enumMembers ?? []).map((member) => String(member.name).toLowerCase()),
  ),
]

const knownBoolean = (value) => (typeof value === 'boolean' ? value : null)

const normalizeDefault = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return undefined
  if (typeof value === 'string') return value.toLowerCase()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && value !== null)
    return String(value.value ?? value)
  return String(value)
}

const COMPARISON_KEY = [
  'type',
  'default',
  'required',
  'readWrite',
  'nullability',
  'eventPayload',
  'operationSignature',
  'contentRegion',
  'enumValues',
  'deprecated',
]

const emptyDrift = () =>
  Object.fromEntries(COMPARISON_KEY.map((key) => [key, null]))

const setDrift = (drift, key, detail) => {
  drift[key] = detail
  return drift
}

const compareInputDefaults = (web, avalonia) => {
  const webDefault = web.default
  if (typeof webDefault !== 'object' || webDefault == null) {
    return 'web default metadata unavailable'
  }
  if (avalonia?.defaultKnown !== true) {
    return 'avalonia default metadata unavailable'
  }
  if (!['literal', 'null'].includes(webDefault.kind)) {
    return `web default kind ${webDefault.kind ?? 'unknown'} is not comparable`
  }
  const webValue = webDefault.kind === 'null' ? null : webDefault.value
  if (normalizeDefault(webValue) !== normalizeDefault(avalonia.defaultValue)) {
    return (
      `web default=${JSON.stringify(webValue)} vs ` +
      `avalonia default=${JSON.stringify(avalonia.defaultValue)}`
    )
  }
  return null
}

const compareOperationSignatures = (web, avalonia) => {
  if (!web) return 'web signature unavailable'
  if (!avalonia) return 'avalonia signature unavailable'

  const differences = []
  if (!web.returnType) {
    differences.push('web return type unavailable')
  } else {
    const webReturn = categoriesFromVueProp({
      runtimeType: web.returnType,
      semanticType: web.returnType,
    })
    const avaloniaReturn = categoriesFromClrType(avalonia.returnType)
    const compatible = categoriesOverlap(webReturn, avaloniaReturn)
    if (compatible !== true) {
      differences.push(
        `return type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webReturn.join('|')} vs avalonia ${avaloniaReturn.join('|')}`,
      )
    }
  }

  const webParameters = web.parameters ?? []
  const avaloniaParameters = avalonia.parameters ?? []
  if (webParameters.length !== avaloniaParameters.length) {
    differences.push(
      `parameter count mismatch: web ${webParameters.length} vs avalonia ${avaloniaParameters.length}`,
    )
  }
  const comparableCount = Math.min(
    webParameters.length,
    avaloniaParameters.length,
  )
  for (let index = 0; index < comparableCount; index += 1) {
    const webParameter = webParameters[index]
    const avaloniaParameter = avaloniaParameters[index]
    if (
      Boolean(webParameter.optional) !== Boolean(avaloniaParameter.optional)
    ) {
      differences.push(
        `parameter ${index + 1} optionality mismatch: web ${Boolean(webParameter.optional)} vs avalonia ${Boolean(avaloniaParameter.optional)}`,
      )
    }
    if (webParameter.rest === true) {
      differences.push(
        `parameter ${index + 1} rest semantics unavailable on avalonia`,
      )
    }
    const webType = categoriesFromVueProp({
      runtimeType: webParameter.type,
      semanticType: webParameter.type,
    })
    const avaloniaType = categoriesFromClrType(avaloniaParameter.type)
    const compatible = categoriesOverlap(webType, avaloniaType)
    if (compatible !== true) {
      differences.push(
        `parameter ${index + 1} type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webType.join('|')} vs avalonia ${avaloniaType.join('|')}`,
      )
    }
  }

  return differences.length > 0 ? differences.join('; ') : null
}

const payloadFieldKey = (name) => toKebab(name ?? '')

const comparePayloadFields = (webShape, avaloniaShape) => {
  if (webShape?.kind !== 'object') {
    return `web payload shape unavailable: ${webShape?.reason ?? 'unknown type'}`
  }
  if (avaloniaShape?.kind !== 'object') {
    return `avalonia event args shape unavailable: ${avaloniaShape?.reason ?? 'unknown type'}`
  }

  const differences = []
  const avaloniaFields = new Map(
    avaloniaShape.fields.map((field) => [payloadFieldKey(field.name), field]),
  )
  const webFields = new Map(
    webShape.fields.map((field) => [payloadFieldKey(field.name), field]),
  )
  for (const webField of webShape.fields) {
    const key = payloadFieldKey(webField.name)
    const avaloniaField = avaloniaFields.get(key)
    if (!avaloniaField) {
      differences.push(`missing avalonia field ${webField.name}`)
      continue
    }
    if (Boolean(webField.optional) !== Boolean(avaloniaField.optional)) {
      differences.push(
        `field ${webField.name} optionality mismatch: web ${Boolean(webField.optional)} vs avalonia ${Boolean(avaloniaField.optional)}`,
      )
    }
    if (Boolean(webField.nullable) !== Boolean(avaloniaField.nullable)) {
      differences.push(
        `field ${webField.name} nullability mismatch: web ${Boolean(webField.nullable)} vs avalonia ${Boolean(avaloniaField.nullable)}`,
      )
    }
    const webCategories = categoriesFromVueProp({
      runtimeType: webField.type,
      semanticType: webField.type,
    })
    const avaloniaCategories = categoriesFromClrType(avaloniaField.type)
    const compatible = categoriesOverlap(webCategories, avaloniaCategories)
    if (compatible !== true) {
      differences.push(
        `field ${webField.name} type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
      )
    }
  }
  for (const avaloniaField of avaloniaShape.fields) {
    if (!webFields.has(payloadFieldKey(avaloniaField.name))) {
      differences.push(`extra avalonia field ${avaloniaField.name}`)
    }
  }
  return differences.length > 0 ? differences.join('; ') : null
}

const compareEventPayloads = (web, avalonia) => {
  if (!Array.isArray(web?.payload)) return 'web payload signature unavailable'
  if (web.payload.length !== 1) {
    return `web payload parameter count ${web.payload.length} is not comparable to Avalonia EventArgs`
  }
  const parameter = web.payload[0]
  const differences = []
  if (parameter.rest === true) {
    differences.push('web rest payload is not comparable to Avalonia EventArgs')
  }
  if (parameter.optional === true) {
    differences.push(
      'web optional payload is not comparable to Avalonia EventArgs',
    )
  }

  let avaloniaShape = avalonia?.argsShape
  if (
    avaloniaShape?.kind === 'object' &&
    avaloniaShape.fields.length === 1 &&
    payloadFieldKey(avaloniaShape.fields[0].name) ===
      payloadFieldKey(parameter.name) &&
    avaloniaShape.fields[0].shape?.kind === 'object'
  ) {
    const wrapper = avaloniaShape.fields[0]
    if (Boolean(parameter.nullable) !== Boolean(wrapper.nullable)) {
      differences.push(
        `payload ${parameter.name} nullability mismatch: web ${Boolean(parameter.nullable)} vs avalonia ${Boolean(wrapper.nullable)}`,
      )
    }
    avaloniaShape = wrapper.shape
  }
  if (parameter.shape?.kind !== 'object') {
    // A primitive Vue payload value corresponds to the single value carried
    // by the real .NET event args; compare the value categories directly.
    const field =
      avaloniaShape?.kind === 'object' && avaloniaShape.fields.length === 1
        ? avaloniaShape.fields[0]
        : null
    if (!field) {
      differences.push(
        `web payload shape unavailable: ${parameter.shape?.reason ?? 'unknown type'}`,
      )
    } else {
      const webCategories = categoriesFromVueProp({
        runtimeType: parameter.type,
        semanticType: parameter.type,
      })
      const avaloniaCategories = categoriesFromClrType(field.type)
      const compatible = categoriesOverlap(webCategories, avaloniaCategories)
      if (compatible !== true) {
        differences.push(
          `payload ${parameter.name} type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
        )
      }
    }
    return differences.length > 0 ? differences.join('; ') : null
  }
  const fieldDifference = comparePayloadFields(parameter.shape, avaloniaShape)
  if (fieldDifference) differences.push(fieldDifference)
  return differences.length > 0 ? differences.join('; ') : null
}

const compareContentRegions = (web, avalonia) => {
  const differences = []
  if (web?.nameKnown !== true) {
    differences.push('web content-region name is dynamic or unavailable')
  }
  if (typeof web?.scoped !== 'boolean') {
    differences.push('web content-region scope metadata unavailable')
  }
  if (!Array.isArray(web?.payload)) {
    differences.push('web content-region payload metadata unavailable')
  } else if (web.payloadComplete !== true) {
    differences.push('web content-region payload is incomplete or spread-bound')
  }
  if (!web?.contentType) {
    if (web?.scoped === true) {
      differences.push('web content value type metadata unavailable')
    }
    // Unscoped Vue slots deliver untyped content; that is semantically
    // compatible with an object-typed Avalonia content property (issue #285).
  } else {
    const webCategories = categoriesFromVueProp({
      runtimeType: web.contentType,
      semanticType: web.contentType,
    })
    const avaloniaCategories = categoriesFromClrType(avalonia?.type)
    const compatible = categoriesOverlap(webCategories, avaloniaCategories)
    if (compatible !== true) {
      differences.push(
        `content value type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
      )
    }
  }
  if (avalonia?.content !== true) {
    differences.push('avalonia member is not a compiler-proven content region')
  }
  if (typeof avalonia?.nullable !== 'boolean') {
    differences.push('avalonia content-region nullability unavailable')
  } else if (avalonia.nullable !== true) {
    differences.push('web content can be absent but avalonia nullable=false')
  }
  if (typeof avalonia?.canRead !== 'boolean') {
    differences.push('avalonia content-region read metadata unavailable')
  } else if (!avalonia.canRead) {
    differences.push('avalonia content-region canRead=false')
  }
  if (typeof avalonia?.canWrite !== 'boolean') {
    differences.push('avalonia content-region write metadata unavailable')
  } else if (!avalonia.canWrite) {
    differences.push('avalonia content-region canWrite=false')
  }
  if (web?.scoped === true) {
    if (!Array.isArray(avalonia?.payload)) {
      differences.push('avalonia scoped content payload shape unavailable')
    } else {
      const webPayload = new Map(
        web.payload.map((field) => [payloadFieldKey(field.name), field]),
      )
      const avaloniaPayload = new Map(
        avalonia.payload.map((field) => [payloadFieldKey(field.name), field]),
      )
      for (const field of web.payload) {
        const counterpart = avaloniaPayload.get(payloadFieldKey(field.name))
        if (!counterpart) {
          differences.push(
            `missing avalonia scoped payload field ${field.name}`,
          )
          continue
        }
        const webCategories = categoriesFromVueProp({
          runtimeType: field.type,
          semanticType: field.type,
        })
        const avaloniaCategories = categoriesFromClrType(counterpart.type)
        const compatible = categoriesOverlap(webCategories, avaloniaCategories)
        if (compatible !== true) {
          differences.push(
            `scoped payload field ${field.name} type ${compatible === false ? 'mismatch' : 'not comparable'}: web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
          )
        }
      }
      for (const field of avalonia.payload) {
        if (!webPayload.has(payloadFieldKey(field.name))) {
          differences.push(`extra avalonia scoped payload field ${field.name}`)
        }
      }
    }
  }
  return differences.length > 0 ? differences.join('; ') : null
}

// Compare a single Vue member against a real Avalonia member and record every
// drift that would be required to fail. Returns null when no counterpart exists.
export const compareMembers = ({ web, avalonia, kind }) => {
  const drift = emptyDrift()

  const webCategories = web.categories ?? ['unknown']
  const avaloniaCategories = avalonia?.categories ?? ['unknown']
  const typeCompatibility = categoriesOverlap(webCategories, avaloniaCategories)
  if (typeCompatibility === false) {
    setDrift(
      drift,
      'type',
      `web ${webCategories.join('|')} vs avalonia ${avaloniaCategories.join('|')}`,
    )
  } else if (typeCompatibility === null && kind === 'input') {
    setDrift(drift, 'type', 'web type not comparable to avalonia type')
  }

  if (kind === 'input') {
    const webNullable = web.nullable
    const avaloniaNullable = avalonia?.nullable
    if (typeof webNullable !== 'boolean') {
      setDrift(drift, 'nullability', 'web nullability metadata unavailable')
    } else if (typeof avaloniaNullable !== 'boolean') {
      setDrift(
        drift,
        'nullability',
        'avalonia nullability metadata unavailable',
      )
    } else if (webNullable !== avaloniaNullable) {
      setDrift(
        drift,
        'nullability',
        `web nullable=${webNullable} vs avalonia nullable=${avaloniaNullable}`,
      )
    }

    const defaultDifference = compareInputDefaults(web, avalonia)
    if (defaultDifference) {
      setDrift(drift, 'default', defaultDifference)
    }

    if (typeof web.required !== 'boolean') {
      setDrift(drift, 'required', 'web required metadata unavailable')
    } else if (typeof avalonia?.required !== 'boolean') {
      setDrift(drift, 'required', 'avalonia required metadata unavailable')
    } else if (web.required !== avalonia.required) {
      setDrift(
        drift,
        'required',
        `web required=${web.required} vs avalonia required=${avalonia.required}`,
      )
    }

    const readWriteDifferences = []
    if (typeof web.readonly !== 'boolean') {
      readWriteDifferences.push('web readonly metadata unavailable')
    }
    if (typeof avalonia?.canRead !== 'boolean') {
      readWriteDifferences.push('avalonia canRead metadata unavailable')
    } else if (avalonia.canRead !== true) {
      readWriteDifferences.push('avalonia canRead=false')
    }
    if (typeof avalonia?.canWrite !== 'boolean') {
      readWriteDifferences.push('avalonia canWrite metadata unavailable')
    } else if (
      typeof web.readonly === 'boolean' &&
      web.readonly === avalonia.canWrite
    ) {
      readWriteDifferences.push(
        `web readonly=${web.readonly} vs avalonia canWrite=${avalonia.canWrite}`,
      )
    }
    if (readWriteDifferences.length > 0) {
      setDrift(drift, 'readWrite', readWriteDifferences.join('; '))
    }

    const webValuesKnown = web.valuesKnown === true
    const avaloniaValuesKnown = avalonia?.enumValuesKnown === true
    if (webValuesKnown || avaloniaValuesKnown) {
      if (!webValuesKnown) {
        setDrift(drift, 'enumValues', 'web enum/union values unavailable')
      } else if (!avaloniaValuesKnown) {
        setDrift(drift, 'enumValues', 'avalonia enum values unavailable')
      } else {
        const webValues = comparableValues(web.values).sort()
        const avaloniaValues = enumMemberNames(avalonia.enumMembers).sort()
        if (JSON.stringify(webValues) !== JSON.stringify(avaloniaValues)) {
          setDrift(
            drift,
            'enumValues',
            `web values [${webValues.join(', ')}] vs avalonia enum [${avaloniaValues.join(', ')}]`,
          )
        }
      }
    }

    if (typeof web.deprecated !== 'boolean') {
      setDrift(drift, 'deprecated', 'web deprecated metadata unavailable')
    } else if (typeof avalonia?.deprecated !== 'boolean') {
      setDrift(drift, 'deprecated', 'avalonia deprecated metadata unavailable')
    } else if (web.deprecated !== avalonia.deprecated) {
      setDrift(
        drift,
        'deprecated',
        `web deprecated=${web.deprecated} vs avalonia deprecated=${avalonia.deprecated}`,
      )
    }
  }

  if (kind === 'output') {
    const difference = compareEventPayloads(web, avalonia)
    if (difference) {
      setDrift(drift, 'eventPayload', difference)
    }
  }

  if (kind === 'operation') {
    const difference = compareOperationSignatures(
      web.signature,
      avalonia?.signature,
    )
    if (difference) {
      setDrift(drift, 'operationSignature', difference)
    }
  }

  if (kind === 'contentRegion') {
    const difference = compareContentRegions(web, avalonia)
    if (difference) {
      setDrift(drift, 'contentRegion', difference)
    }
  }

  const drifts = Object.entries(drift).filter(([, value]) => value != null)
  if (drifts.length === 0) return { compatible: true, drift }
  return { compatible: false, drift }
}

const defaultGovernance = (reason) => ({
  reason,
  owner: CONTRACT_V2_OWNER,
  testPolicy: 'contract',
  reviewPolicy: 'pr-review',
})

const scenarioId = (contractKebab, kind, member) =>
  `scenario.v2.${contractKebab}.${kind}.${toKebab(member)}`

const memberRef = (kind) => ({
  baseline: VUE_BASELINE_PATH,
  kind,
})

const webPropRef = (prop) => ({
  member: prop.name,
  baseline: VUE_BASELINE_PATH,
  categories: categoriesFromVueProp(prop),
  runtimeType: prop.runtimeType ?? null,
  semanticType: prop.semanticType ?? null,
  nullable: knownBoolean(prop.nullable),
  default: prop.default ?? null,
  values: prop.values ?? null,
  valuesKnown: knownBoolean(prop.valuesKnown),
  required: knownBoolean(prop.required),
  readonly: knownBoolean(prop.readonly),
  deprecated: knownBoolean(prop.deprecated),
  deprecationMessage: prop.deprecationMessage ?? null,
})

const avaloniaPropRef = (property) => ({
  member: property.name,
  categories: categoriesFromClrType(property.type),
  type: property.type,
  nullable: knownBoolean(property.nullable),
  propertyKind: property.propertyKind,
  defaultKnown: property.defaultKnown,
  defaultValue: property.defaultKnown ? property.defaultValue : null,
  required: knownBoolean(property.required),
  canRead: knownBoolean(property.canRead),
  canWrite: knownBoolean(property.canWrite),
  isStatic: knownBoolean(property.isStatic),
  enumMembers: property.enumMembers ?? undefined,
  enumValuesKnown: knownBoolean(property.enumValuesKnown),
  deprecated: knownBoolean(property.deprecated),
  deprecationMessage: property.deprecationMessage ?? null,
})

const webEventRef = (member, semantic) => ({
  member,
  baseline: VUE_BASELINE_PATH,
  payload: semantic?.payload ?? null,
  payloadShapeStatus: semantic?.payloadShapeStatus ?? null,
  payloadShapeReason: semantic?.payloadShapeReason ?? null,
})

const avaloniaPayloadShape = (
  typeName,
  typeIndex,
  depth = 0,
  seen = new Set(),
) => {
  const normalized = (typeName ?? '').replace(/[?&]$/u, '')
  if (!normalized) {
    return { kind: 'unknown', type: null, reason: 'event args type is empty' }
  }
  if (seen.has(normalized)) {
    return {
      kind: 'unknown',
      type: normalized,
      reason: 'recursive event args type',
    }
  }
  const type = typeIndex.get(normalized)
  if (!type) {
    return {
      kind: 'unknown',
      type: normalized,
      reason: 'framework or unresolved event args type',
    }
  }
  const nextSeen = new Set(seen)
  nextSeen.add(normalized)
  const properties = (type.properties ?? []).filter(
    (property) => property.canRead !== false && property.isStatic !== true,
  )
  if (properties.length === 0 || properties.length > 64) {
    return {
      kind: 'unknown',
      type: normalized,
      reason:
        properties.length === 0
          ? 'event args type has no readable fields'
          : 'event args type exceeds the 64-field comparison bound',
    }
  }
  return {
    kind: 'object',
    type: normalized,
    fields: properties
      .map((property) => ({
        name: property.name,
        type: property.type,
        optional: false,
        nullable: Boolean(property.nullable),
        shape:
          depth < 1 && typeIndex.has(property.type)
            ? avaloniaPayloadShape(
                property.type,
                typeIndex,
                depth + 1,
                nextSeen,
              )
            : undefined,
      }))
      .sort((first, second) => first.name.localeCompare(second.name)),
  }
}

const avaloniaEventRef = (event, typeIndex, payloadField) => {
  const argsType =
    event.argsType?.match(/^System\.EventHandler<(.+)>$/u)?.[1] ?? null
  const argsShape = avaloniaPayloadShape(argsType, typeIndex)
  const projected =
    payloadField && argsShape?.kind === 'object'
      ? {
          ...argsShape,
          fields: argsShape.fields.filter(
            (field) => field.name === payloadField,
          ),
        }
      : argsShape
  return {
    member: event.name,
    categories: categoriesFromClrType(event.argsType),
    argsType: event.argsType,
    ...(payloadField ? { payloadField } : {}),
    argsShape: projected,
  }
}

const avaloniaMethodRef = (method) => ({
  member: method.name,
  signature: {
    returnType: method.returnType,
    parameters: (method.parameters ?? []).map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      optional: Boolean(parameter.optional),
    })),
  },
})

const avaloniaCommandRef = (command) => ({
  member: command.name,
  operationKind: 'command',
  signature: null,
  command: {
    type: command.type,
    nullable: knownBoolean(command.nullable),
    canRead: knownBoolean(command.canRead),
    canWrite: knownBoolean(command.canWrite),
    isStatic: knownBoolean(command.isStatic),
    propertyKind: command.propertyKind,
    defaultKnown: command.defaultKnown === true,
    defaultValue:
      command.defaultKnown === true ? (command.defaultValue ?? null) : null,
    deprecated: knownBoolean(command.deprecated),
    deprecationMessage: command.deprecationMessage ?? null,
  },
})

const avaloniaOperationRef = (operation) =>
  operation.kind === 'command'
    ? avaloniaCommandRef(operation.value)
    : avaloniaMethodRef(operation.value)

const webMethodRef = (member, semantic) => ({
  member,
  baseline: VUE_BASELINE_PATH,
  signature: semantic
    ? {
        status: semantic.signatureStatus ?? 'syntax-only',
        reason: semantic.signatureReason ?? null,
        returnType: semantic.returnType ?? null,
        parameters: (semantic.parameters ?? []).map((parameter) => ({
          name: parameter.name,
          type: parameter.type ?? null,
          optional: Boolean(parameter.optional),
          rest: Boolean(parameter.rest),
        })),
      }
    : null,
})

const webContentRegionRef = (slot) => ({
  member: slot.name,
  baseline: VUE_BASELINE_PATH,
  nameKnown: slot.nameKnown === true,
  nameExpression: slot.nameExpression ?? null,
  scoped: knownBoolean(slot.scoped),
  payload: Array.isArray(slot.payload)
    ? slot.payload.map((field) => ({
        name: field.name,
        expression: field.expression ?? null,
        type: field.type ?? null,
      }))
    : null,
  payloadComplete: slot.payloadComplete === true,
  contentType: slot.contentType ?? null,
})

const avaloniaContentRegionRef = (region) => ({
  member: region.name,
  content: true,
  type: region.type ?? null,
  nullable: knownBoolean(region.nullable),
  canRead: knownBoolean(region.canRead),
  canWrite: knownBoolean(region.canWrite),
  required: knownBoolean(region.required),
  propertyKind: region.propertyKind ?? null,
  payload: Array.isArray(region.payload) ? region.payload : null,
})

const avaloniaSemanticIndex = (baselines) => {
  const index = new Map()
  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    for (const type of baselines[packageId]?.semanticTypes ?? []) {
      index.set(type.name, { ...type, packageId })
    }
  }
  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    for (const dependency of baselines[packageId]?.tokenThemeContract
      ?.dependencies ?? []) {
      const owner = index.get(dependency.ownerType)
      if (!owner) continue
      owner.tokenThemeDependencies ??= []
      owner.tokenThemeDependencies.push({ ...dependency, packageId })
    }
  }
  return index
}

const canonicalAvaloniaPropertySurface = (
  property,
  avaloniaProperty,
  contentRegions,
) => ({
  kind: 'property',
  member: property.name,
  type: property.type,
  nullable: knownBoolean(property.nullable),
  canRead: knownBoolean(property.canRead),
  canWrite: knownBoolean(property.canWrite),
  isStatic: knownBoolean(property.isStatic),
  required: knownBoolean(property.required),
  defaultKnown: property.defaultKnown === true,
  defaultValue:
    property.defaultKnown === true ? (property.defaultValue ?? null) : null,
  deprecated: knownBoolean(property.deprecated),
  deprecationMessage: property.deprecationMessage ?? null,
  isContentProperty: contentRegions.has(property.name),
  contentRegion: contentRegions.get(property.name) ?? null,
  avaloniaProperty: avaloniaProperty
    ? {
        kind: avaloniaProperty.kind,
        type: avaloniaProperty.type,
        nullable: knownBoolean(avaloniaProperty.nullable),
        defaultKnown: avaloniaProperty.defaultKnown === true,
        defaultValue:
          avaloniaProperty.defaultKnown === true
            ? (avaloniaProperty.defaultValue ?? null)
            : null,
        deprecated: knownBoolean(avaloniaProperty.deprecated),
        deprecationMessage: avaloniaProperty.deprecationMessage ?? null,
      }
    : null,
})

const canonicalAvaloniaPropertyOnlySurface = (property, contentRegions) => ({
  kind: 'avalonia-property',
  member: property.name,
  propertyKind: property.kind,
  type: property.type,
  nullable: knownBoolean(property.nullable),
  defaultKnown: property.defaultKnown === true,
  defaultValue:
    property.defaultKnown === true ? (property.defaultValue ?? null) : null,
  deprecated: knownBoolean(property.deprecated),
  deprecationMessage: property.deprecationMessage ?? null,
  isContentProperty: contentRegions.has(property.name),
  contentRegion: contentRegions.get(property.name) ?? null,
})

const canonicalAvaloniaEventSurface = (event) => ({
  kind: 'event',
  member: event.name,
  eventKind: event.kind,
  argsType: event.argsType,
  isStatic: knownBoolean(event.isStatic),
  deprecated: knownBoolean(event.deprecated),
  deprecationMessage: event.deprecationMessage ?? null,
})

const canonicalAvaloniaMethodSurface = (method) => ({
  kind: 'method',
  member: method.name,
  isStatic: knownBoolean(method.isStatic),
  returnType: method.returnType,
  deprecated: knownBoolean(method.deprecated),
  deprecationMessage: method.deprecationMessage ?? null,
  parameters: (method.parameters ?? []).map((parameter) => ({
    name: parameter.name,
    type: parameter.type,
    optional: knownBoolean(parameter.optional),
  })),
})

const canonicalAvaloniaCommandSurface = (command) => ({
  kind: 'command',
  member: command.name,
  type: command.type,
  nullable: knownBoolean(command.nullable),
  canRead: knownBoolean(command.canRead),
  canWrite: knownBoolean(command.canWrite),
  isStatic: knownBoolean(command.isStatic),
  propertyKind: command.propertyKind,
  defaultKnown: command.defaultKnown === true,
  defaultValue:
    command.defaultKnown === true ? (command.defaultValue ?? null) : null,
  deprecated: knownBoolean(command.deprecated),
  deprecationMessage: command.deprecationMessage ?? null,
})

const canonicalAvaloniaEnumMemberSurface = (member) => ({
  kind: 'enum-member',
  member: member.name,
  value: member.value,
  deprecated: knownBoolean(member.deprecated),
  deprecationMessage: member.deprecationMessage ?? null,
})

export const avaloniaPublicSurfaces = (type) => {
  const commands = new Map(
    (type.commands ?? []).map((command) => [command.name, command]),
  )
  const avaloniaProperties = new Map(
    (type.avaloniaProperties ?? []).map((property) => [
      property.name,
      property,
    ]),
  )
  const contentRegions = new Map(
    (type.contentRegions ?? []).map((region) => [
      region.name,
      {
        type: region.type ?? null,
        nullable: knownBoolean(region.nullable),
        canRead: knownBoolean(region.canRead),
        canWrite: knownBoolean(region.canWrite),
        required: knownBoolean(region.required),
        propertyKind: region.propertyKind ?? null,
      },
    ]),
  )
  if (contentRegions.size === 0 && type.contentProperty) {
    contentRegions.set(type.contentProperty, null)
  }
  const surfaces = (type.properties ?? []).map((property) => {
    const command = commands.get(property.name)
    return command
      ? canonicalAvaloniaCommandSurface(command)
      : canonicalAvaloniaPropertySurface(
          property,
          avaloniaProperties.get(property.name),
          contentRegions,
        )
  })
  const clrPropertyNames = new Set(
    (type.properties ?? []).map((property) => property.name),
  )
  for (const property of type.avaloniaProperties ?? []) {
    if (clrPropertyNames.has(property.name)) continue
    surfaces.push(
      canonicalAvaloniaPropertyOnlySurface(property, contentRegions),
    )
  }
  const coveredPropertyNames = new Set([
    ...clrPropertyNames,
    ...[...(type.avaloniaProperties ?? []).map((property) => property.name)],
  ])
  for (const [regionName, region] of contentRegions) {
    if (coveredPropertyNames.has(regionName)) continue
    surfaces.push({
      kind: 'avalonia-property',
      member: regionName,
      propertyKind: region.propertyKind ?? 'clr',
      type: region.type,
      nullable: knownBoolean(region.nullable),
      defaultKnown: false,
      defaultValue: null,
      deprecated: false,
      deprecationMessage: null,
      isContentProperty: true,
      contentRegion: region,
    })
  }
  surfaces.push(
    ...(type.events ?? []).map(canonicalAvaloniaEventSurface),
    ...(type.methods ?? []).map(canonicalAvaloniaMethodSurface),
    ...(type.enumMembers ?? []).map(canonicalAvaloniaEnumMemberSurface),
  )
  return surfaces.sort(
    (first, second) =>
      first.member.localeCompare(second.member) ||
      first.kind.localeCompare(second.kind) ||
      JSON.stringify(first).localeCompare(JSON.stringify(second)),
  )
}

const avaloniaSurfaceFingerprint = (surface) => sha256(JSON.stringify(surface))

const avaloniaTypeSurfaceHash = (type) =>
  sha256(
    JSON.stringify({
      type: type.name,
      kind: type.kind,
      baseType: type.baseType ?? null,
      isAbstract: knownBoolean(type.isAbstract),
      isSealed: knownBoolean(type.isSealed),
      deprecated: knownBoolean(type.deprecated),
      deprecationMessage: type.deprecationMessage ?? null,
      ...(Array.isArray(type.genericParameters)
        ? {
            genericParameters: type.genericParameters.map((parameter) => ({
              name: parameter.name,
              position: parameter.position,
              variance: parameter.variance,
              referenceTypeConstraint: knownBoolean(
                parameter.referenceTypeConstraint,
              ),
              referenceTypeConstraintNullable: knownBoolean(
                parameter.referenceTypeConstraintNullable,
              ),
              valueTypeConstraint: knownBoolean(parameter.valueTypeConstraint),
              unmanagedTypeConstraint: knownBoolean(
                parameter.unmanagedTypeConstraint,
              ),
              notNullConstraint: knownBoolean(parameter.notNullConstraint),
              constructorConstraint: knownBoolean(
                parameter.constructorConstraint,
              ),
              typeConstraints: parameter.typeConstraints ?? null,
            })),
          }
        : {}),
      surfaces: avaloniaPublicSurfaces(type),
    }),
  )

const canonicalStateBinding = (binding) => ({
  kind: binding.kind ?? null,
  action: binding.action ?? null,
  nameKnown: knownBoolean(binding.nameKnown),
  name: binding.name ?? null,
  nameExpression: binding.nameExpression ?? null,
  conditionExpression: binding.conditionExpression ?? null,
  publicDependencies: [...(binding.publicDependencies ?? [])].sort(),
  sourceMember: binding.sourceMember ?? null,
  provider: binding.provider ?? null,
})

export const canonicalAvaloniaStateContract = (type) => {
  const state = type?.stateContract
  if (!state) return null
  const sortBindings = (bindings) =>
    (bindings ?? [])
      .map(canonicalStateBinding)
      .sort((first, second) =>
        JSON.stringify(first).localeCompare(JSON.stringify(second)),
      )
  return {
    pseudoClassDeclarationAuthority:
      state.pseudoClassDeclarationAuthority ?? null,
    declaredPseudoClasses: [...(state.declaredPseudoClasses ?? [])].sort(),
    pseudoClassBindings: sortBindings(state.pseudoClassBindings),
    pseudoClassContractKnown: knownBoolean(state.pseudoClassContractKnown),
    pseudoClassContractComplete: knownBoolean(
      state.pseudoClassContractComplete,
    ),
    classBindingAuthority: state.classBindingAuthority ?? null,
    classContractDeclared: knownBoolean(state.classContractDeclared),
    classBindings: sortBindings(state.classBindings),
    classNamesResolved: knownBoolean(state.classNamesResolved),
  }
}

export const avaloniaStateContractFingerprint = (type) => {
  const state = canonicalAvaloniaStateContract(type)
  return state ? sha256(JSON.stringify(state)) : null
}

const avaloniaStateContractRef = (type) => {
  const fingerprint = avaloniaStateContractFingerprint(type)
  if (!fingerprint) return null
  return {
    baseline: AVALONIA_SEMANTIC_PATHS[type.packageId],
    fingerprint,
    pseudoClassContractKnown: knownBoolean(
      type.stateContract.pseudoClassContractKnown,
    ),
    pseudoClassContractComplete: knownBoolean(
      type.stateContract.pseudoClassContractComplete,
    ),
    classContractDeclared: knownBoolean(
      type.stateContract.classContractDeclared,
    ),
    classNamesResolved: knownBoolean(type.stateContract.classNamesResolved),
  }
}

const canonicalAutomationMapping = (mapping) => ({
  semantic: mapping.semantic ?? null,
  provider: mapping.provider ?? null,
  authority: mapping.authority ?? null,
  targetKind: mapping.targetKind ?? null,
  targetExpression: mapping.targetExpression ?? null,
  valueKnown: knownBoolean(mapping.valueKnown),
  value: mapping.value ?? null,
  valueExpression: mapping.valueExpression ?? null,
  publicDependencies: [...(mapping.publicDependencies ?? [])].sort(),
  sourceMember: mapping.sourceMember ?? null,
})

export const canonicalAvaloniaAutomationContract = (type) => {
  const automation = type?.automationContract
  if (!automation) return null
  return {
    observationAuthorities: [
      ...(automation.observationAuthorities ?? []),
    ].sort(),
    contractDeclared: knownBoolean(automation.contractDeclared),
    runtimeTreeVerified: knownBoolean(automation.runtimeTreeVerified),
    mappingComplete: knownBoolean(automation.mappingComplete),
    observedSemantics: [...(automation.observedSemantics ?? [])].sort(),
    mappings: (automation.mappings ?? [])
      .map(canonicalAutomationMapping)
      .sort((first, second) =>
        JSON.stringify(first).localeCompare(JSON.stringify(second)),
      ),
  }
}

export const avaloniaAutomationContractFingerprint = (type) => {
  const automation = canonicalAvaloniaAutomationContract(type)
  return automation ? sha256(JSON.stringify(automation)) : null
}

const avaloniaAutomationContractRef = (type) => {
  const fingerprint = avaloniaAutomationContractFingerprint(type)
  if (!fingerprint) return null
  return {
    baseline: AVALONIA_SEMANTIC_PATHS[type.packageId],
    fingerprint,
    contractDeclared: knownBoolean(type.automationContract.contractDeclared),
    runtimeTreeVerified: knownBoolean(
      type.automationContract.runtimeTreeVerified,
    ),
    mappingComplete: knownBoolean(type.automationContract.mappingComplete),
    observedSemantics: [
      ...(type.automationContract.observedSemantics ?? []),
    ].sort(),
  }
}

const canonicalTokenDefinition = (definition) => ({
  canonicalName: definition.canonicalName ?? null,
  owner: definition.owner ?? null,
  generatedOutputs: [...(definition.generatedOutputs ?? [])].sort(),
  resourceKeys: [...(definition.resourceKeys ?? [])].sort(),
  csharpMembers: [...(definition.csharpMembers ?? [])].sort(),
  declarationAuthority: definition.declarationAuthority ?? null,
})

const canonicalTokenDependency = (dependency) => ({
  kind: dependency.kind ?? null,
  authority: dependency.authority ?? null,
  sourceFile: dependency.sourceFile ?? null,
  sourceMember: dependency.sourceMember ?? null,
  dependency: dependency.dependency ?? null,
  canonicalName: dependency.canonicalName ?? null,
  resolved: knownBoolean(dependency.resolved),
  ownerType: dependency.ownerType ?? null,
  ownership: dependency.ownership ?? null,
  ownerExpression: dependency.ownerExpression ?? null,
  ...(dependency.packageId ? { packageId: dependency.packageId } : {}),
})

export const canonicalAvaloniaTokenThemeContract = (contract) => {
  if (!contract) return null
  return {
    canonicalAuthority: contract.canonicalAuthority ?? null,
    generatedMetadataAuthority: contract.generatedMetadataAuthority ?? null,
    generatedXamlAuthority: contract.generatedXamlAuthority ?? null,
    generatedCsharpAuthority: contract.generatedCsharpAuthority ?? null,
    contractDeclared: knownBoolean(contract.contractDeclared),
    renderedEvidenceVerified: knownBoolean(contract.renderedEvidenceVerified),
    definitions: (contract.definitions ?? [])
      .map(canonicalTokenDefinition)
      .sort((first, second) =>
        JSON.stringify(first).localeCompare(JSON.stringify(second)),
      ),
    dependencies: (contract.dependencies ?? [])
      .map(canonicalTokenDependency)
      .sort((first, second) =>
        JSON.stringify(first).localeCompare(JSON.stringify(second)),
      ),
  }
}

export const avaloniaTokenThemeContractFingerprint = (contract) => {
  const canonical = canonicalAvaloniaTokenThemeContract(contract)
  return canonical ? sha256(JSON.stringify(canonical)) : null
}

const canonicalAvaloniaTypeTokenThemeContract = (type) => {
  const dependencies = (type?.tokenThemeDependencies ?? [])
    .map(canonicalTokenDependency)
    .sort((first, second) =>
      JSON.stringify(first).localeCompare(JSON.stringify(second)),
    )
  if (dependencies.length === 0) return null
  return {
    contractDeclared: false,
    renderedEvidenceVerified: false,
    dependencies,
  }
}

export const avaloniaTypeTokenThemeContractFingerprint = (type) => {
  const canonical = canonicalAvaloniaTypeTokenThemeContract(type)
  return canonical ? sha256(JSON.stringify(canonical)) : null
}

const avaloniaTypeTokenThemeContractRef = (type) => {
  const canonical = canonicalAvaloniaTypeTokenThemeContract(type)
  if (!canonical) return null
  return {
    fingerprint: sha256(JSON.stringify(canonical)),
    dependencyCount: canonical.dependencies.length,
    resolvedCount: canonical.dependencies.filter(
      (dependency) => dependency.resolved,
    ).length,
    contractDeclared: false,
    renderedEvidenceVerified: false,
    baselines: [
      ...new Set(
        canonical.dependencies.map(
          (dependency) => AVALONIA_SEMANTIC_PATHS[dependency.packageId],
        ),
      ),
    ].sort(),
  }
}

const findAvaloniaType = (componentName, typeIndex) => {
  const kebab = kebabName(componentName)
  for (const [fullName, type] of typeIndex) {
    const shortName = fullName.split('.').pop() ?? ''
    if (kebabName(shortName) === kebab && type.kind === 'class') {
      return type
    }
  }
  return null
}

const combinedAvaloniaProperty = (name, avaloniaType, typeIndex) => {
  const property =
    (avaloniaType.properties ?? []).find(
      (candidate) => candidate.name === name,
    ) ?? null
  const avaloniaProperty =
    (avaloniaType.avaloniaProperties ?? []).find(
      (candidate) => candidate.name === name,
    ) ?? null
  if (!property && !avaloniaProperty) return null
  const propertyType = avaloniaProperty?.type ?? property?.type ?? null
  const enumType = typeIndex.get((propertyType ?? '').replace(/\?$/u, ''))
  const deprecatedMembers = [property, avaloniaProperty].filter(Boolean)
  return {
    name,
    type: propertyType,
    nullable:
      typeof avaloniaProperty?.nullable === 'boolean'
        ? avaloniaProperty.nullable
        : typeof property?.nullable === 'boolean'
          ? property.nullable
          : null,
    propertyKind: avaloniaProperty?.kind ?? 'clr',
    defaultKnown:
      avaloniaProperty != null
        ? avaloniaProperty.defaultKnown === true
        : property?.defaultKnown === true,
    defaultValue:
      avaloniaProperty != null
        ? avaloniaProperty.defaultKnown === true
          ? (avaloniaProperty.defaultValue ?? null)
          : undefined
        : property?.defaultKnown === true
          ? (property.defaultValue ?? null)
          : undefined,
    required:
      typeof property?.required === 'boolean' ? property.required : null,
    canRead: typeof property?.canRead === 'boolean' ? property.canRead : null,
    canWrite:
      typeof property?.canWrite === 'boolean' ? property.canWrite : null,
    isStatic:
      typeof property?.isStatic === 'boolean' ? property.isStatic : null,
    enumMembers: enumType?.kind === 'enum' ? enumType.enumMembers : undefined,
    enumValuesKnown: enumType?.kind === 'enum',
    deprecated: deprecatedMembers.every(
      (member) => typeof member.deprecated === 'boolean',
    )
      ? deprecatedMembers.some((member) => member.deprecated)
      : null,
    deprecationMessage:
      deprecatedMembers.find((member) => member.deprecationMessage)
        ?.deprecationMessage ?? null,
  }
}

const matchAvaloniaProperty = (webName, avaloniaType, typeIndex, binding) => {
  if (binding) {
    return combinedAvaloniaProperty(binding.avalonia, avaloniaType, typeIndex)
  }
  const normalized = normalizeMemberName(webName)
  const properties = [
    ...(avaloniaType.avaloniaProperties ?? []),
    ...(avaloniaType.properties ?? []),
  ]
  const seen = new Set()
  for (const property of properties) {
    if (seen.has(property.name)) continue
    seen.add(property.name)
    if (normalizeMemberName(property.name) === normalized) {
      return combinedAvaloniaProperty(property.name, avaloniaType, typeIndex)
    }
  }
  return null
}

const matchAvaloniaEvent = (webName, avaloniaType, binding) => {
  if (binding) {
    return (
      (avaloniaType.events ?? []).find(
        (event) => event.name === binding.avalonia,
      ) ?? null
    )
  }
  const normalized = normalizeMemberName(webName)
  for (const event of avaloniaType.events ?? []) {
    if (normalizeMemberName(event.name) === normalized) return event
  }
  return null
}

const matchAvaloniaOperation = (webName, avaloniaType, binding) => {
  if (binding) {
    const method = (avaloniaType.methods ?? []).find(
      (candidate) => candidate.name === binding.avalonia,
    )
    if (method) return { kind: 'method', value: method }
    const command = (avaloniaType.commands ?? []).find(
      (candidate) => candidate.name === binding.avalonia,
    )
    return command ? { kind: 'command', value: command } : null
  }
  const normalized = normalizeMemberName(webName)
  for (const method of avaloniaType.methods ?? []) {
    if (normalizeMemberName(method.name) === normalized) {
      return { kind: 'method', value: method }
    }
  }
  return null
}

const bindingMetadata = (binding) =>
  binding
    ? {
        semantic: binding.semantic,
        bindingBasis: 'explicit-semantic',
      }
    : {}

const dispositionMetadata = (disposition) =>
  disposition
    ? {
        dispositionBasis: 'explicit-member-disposition',
        platformAlternative: disposition.alternative,
      }
    : {}

const dispositionGovernance = (disposition) => ({
  reason: disposition.reason,
  owner: disposition.owner,
  testPolicy: disposition.testPolicy,
  reviewPolicy: disposition.reviewPolicy,
})

const inputMember = ({
  contractKebab,
  prop,
  avaloniaType,
  typeIndex,
  classification,
  binding,
  disposition,
}) => {
  if (disposition) {
    return {
      name: prop.name,
      kind: 'input',
      web: webPropRef(prop),
      avalonia: null,
      status: 'web-only',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'input', prop.name)],
      ...dispositionMetadata(disposition),
      governance: dispositionGovernance(disposition),
    }
  }
  if (!avaloniaType) {
    return {
      name: prop.name,
      kind: 'input',
      web: webPropRef(prop),
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'input', prop.name)],
      ...bindingMetadata(binding),
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia public member in the semantic baseline.',
            ),
    }
  }
  const avalonia = matchAvaloniaProperty(
    prop.name,
    avaloniaType,
    typeIndex,
    binding,
  )
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia public member in the semantic baseline.',
    )
  } else {
    const comparison = compareMembers({
      web: webPropRef(prop),
      avalonia: avaloniaPropRef(avalonia),
      kind: 'input',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real member exists on both sides but semantic drift was detected.',
      )
    }
  }
  return {
    name: prop.name,
    kind: 'input',
    web: webPropRef(prop),
    avalonia: avalonia ? avaloniaPropRef(avalonia) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'input', prop.name)],
    ...bindingMetadata(binding),
    governance,
  }
}

const outputMember = ({
  contractKebab,
  emit,
  semantic,
  avaloniaType,
  typeIndex,
  classification,
  binding,
  disposition,
}) => {
  const web = webEventRef(emit, binding ? semantic : null)
  if (disposition) {
    return {
      name: emit,
      kind: 'output',
      web,
      avalonia: null,
      status: 'web-only',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'output', emit)],
      ...dispositionMetadata(disposition),
      governance: dispositionGovernance(disposition),
    }
  }
  if (!avaloniaType) {
    return {
      name: emit,
      kind: 'output',
      web,
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'output', emit)],
      ...bindingMetadata(binding),
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia public event in the semantic baseline.',
            ),
    }
  }
  const avalonia = matchAvaloniaEvent(emit, avaloniaType, binding)
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia public event in the semantic baseline.',
    )
  } else {
    const comparison = compareMembers({
      web,
      avalonia: avaloniaEventRef(avalonia, typeIndex, binding?.avaloniaPayloadField),
      kind: 'output',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real event exists on both sides but payload semantics are not comparable or drift was detected.',
      )
    }
  }
  return {
    name: emit,
    kind: 'output',
    web,
    avalonia: avalonia
      ? avaloniaEventRef(avalonia, typeIndex, binding?.avaloniaPayloadField)
      : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'output', emit)],
    ...bindingMetadata(binding),
    governance,
  }
}

const operationMember = ({
  contractKebab,
  exposed,
  semantic,
  avaloniaType,
  classification,
  binding,
  disposition,
}) => {
  if (disposition) {
    return {
      name: exposed,
      kind: 'operation',
      web: webMethodRef(exposed, semantic),
      avalonia: null,
      status: 'web-only',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'operation', exposed)],
      ...dispositionMetadata(disposition),
      governance: dispositionGovernance(disposition),
    }
  }
  if (!avaloniaType) {
    return {
      name: exposed,
      kind: 'operation',
      web: webMethodRef(exposed, semantic),
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'operation', exposed)],
      ...bindingMetadata(binding),
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia public method in the semantic baseline.',
            ),
    }
  }
  const avalonia = matchAvaloniaOperation(exposed, avaloniaType, binding)
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      'No matching real Avalonia public method in the semantic baseline.',
    )
  } else {
    const comparison = compareMembers({
      web: webMethodRef(exposed, semantic),
      avalonia: avaloniaOperationRef(avalonia),
      kind: 'operation',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real operation exists on both sides but the signature is not comparable or drift was detected.',
      )
    }
  }
  return {
    name: exposed,
    kind: 'operation',
    web: webMethodRef(exposed, semantic),
    avalonia: avalonia ? avaloniaOperationRef(avalonia) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'operation', exposed)],
    ...bindingMetadata(binding),
    governance,
  }
}

const contentRegionMember = ({
  contractKebab,
  slot,
  avaloniaType,
  classification,
  binding,
  disposition,
}) => {
  const web = webContentRegionRef(slot)
  if (disposition) {
    return {
      name: slot.name,
      kind: 'contentRegion',
      scoped: Boolean(slot.scoped),
      web,
      avalonia: null,
      status: 'web-only',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'content-region', slot.name)],
      ...dispositionMetadata(disposition),
      governance: dispositionGovernance(disposition),
    }
  }
  if (!avaloniaType) {
    return {
      name: slot.name,
      kind: 'contentRegion',
      scoped: Boolean(slot.scoped),
      web,
      avalonia: null,
      status: classification === 'web-only' ? 'web-only' : 'missing',
      drift: emptyDrift(),
      scenarioIds: [scenarioId(contractKebab, 'content-region', slot.name)],
      ...bindingMetadata(binding),
      governance:
        classification === 'web-only'
          ? defaultGovernance(
              'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
            )
          : defaultGovernance(
              'No matching real Avalonia content region in the semantic baseline.',
            ),
    }
  }
  const avalonia = binding
    ? ((avaloniaType.contentRegions ?? []).find(
        (region) => region.name === binding.avalonia,
      ) ?? null)
    : null
  let status
  let governance = null
  let drift = emptyDrift()
  if (classification === 'web-only') {
    status = 'web-only'
    governance = defaultGovernance(
      'Web-only export registered as a platform-specific surface; no Avalonia counterpart is claimed.',
    )
  } else if (!avalonia) {
    status = 'missing'
    governance = defaultGovernance(
      binding
        ? 'The explicit Avalonia content region is missing from the semantic baseline.'
        : 'No explicit semantic binding selects a real Avalonia content region.',
    )
  } else {
    const comparison = compareMembers({
      web,
      avalonia: avaloniaContentRegionRef(avalonia),
      kind: 'contentRegion',
    })
    drift = comparison.drift
    status = comparison.compatible ? 'aligned-candidate' : 'partial'
    if (status === 'partial') {
      governance = defaultGovernance(
        'Real content regions exist on both sides but type, scope, payload, nullability, or access semantics are not comparable.',
      )
    }
  }
  return {
    name: slot.name,
    kind: 'contentRegion',
    scoped: Boolean(slot.scoped),
    web,
    avalonia: avalonia ? avaloniaContentRegionRef(avalonia) : null,
    status,
    drift,
    scenarioIds: [scenarioId(contractKebab, 'content-region', slot.name)],
    ...bindingMetadata(binding),
    governance,
  }
}

const deriveStates = ({ component, inputs, outputs }) => {
  const inputNames = new Set(inputs.map((input) => input.name))
  const outputNames = new Set(outputs.map((output) => output.name))
  const states = [{ name: 'default', kind: 'initial' }]
  if (inputNames.has('disabled'))
    states.push({ name: 'disabled', kind: 'derived' })
  if (inputNames.has('loading'))
    states.push({ name: 'loading', kind: 'derived' })
  if (inputNames.has('readonly'))
    states.push({ name: 'readonly', kind: 'derived' })
  if (outputNames.has('open') || outputNames.has('visible')) {
    states.push({ name: 'open', kind: 'derived' })
    states.push({ name: 'closed', kind: 'derived' })
  }
  if (component.name === 'ElMarkdownEditor') {
    for (const mode of MARKDOWN_EDITOR_MODES) {
      states.push({ name: mode, kind: 'derived-mode' })
    }
  }
  const transitions = []
  if (states.some((state) => state.name === 'disabled')) {
    transitions.push({
      from: 'default',
      to: 'disabled',
      trigger: 'disabled input becomes true',
    })
  }
  if (states.some((state) => state.name === 'loading')) {
    transitions.push({
      from: 'default',
      to: 'loading',
      trigger: 'loading input becomes true',
    })
  }
  if (states.some((state) => state.name === 'open')) {
    transitions.push({
      from: 'closed',
      to: 'open',
      trigger: 'open/visible output is raised',
    })
    transitions.push({
      from: 'open',
      to: 'closed',
      trigger: 'close/hide output is raised',
    })
  }
  return { machine: `fsus-${kebabName(component.name)}`, states, transitions }
}

const deriveRequirements = ({
  inputs,
  outputs,
  operations,
  contentRegions,
}) => {
  const inputNames = new Set(inputs.map((input) => input.name))
  const hasInteractiveSurface =
    outputs.length > 0 || inputNames.has('disabled') || operations.length > 0
  const keyboard = [
    'All public operations must be keyboard reachable and activatable.',
  ]
  const pointer = []
  if (outputs.length > 0) {
    pointer.push(
      'Pointer/tap activation must raise the corresponding public output.',
    )
  }
  if (inputNames.has('disabled')) {
    pointer.push('Disabled surfaces must not respond to pointer activation.')
  }
  const focus = [
    'Focus entry must surface the same public focus state on both platforms.',
  ]
  if (inputNames.has('autofocus')) {
    focus.push(
      'autofocus input must map to initial focus on Web and equivalent Avalonia focus behavior.',
    )
  }
  const a11y = []
  if (hasInteractiveSurface) {
    a11y.push('Interactive surfaces must expose an accessible name and role.')
  }
  if (contentRegions.length > 0) {
    a11y.push(
      'Content regions must preserve accessible text content semantics.',
    )
  }
  const motion = ['Honor user reduced-motion preference.']
  if (inputNames.has('loading')) {
    motion.push(
      'Loading transitions must not trap focus and must remain within the motion budget.',
    )
  }
  const perf = [
    'Render and interaction budgets must match the component performance contract.',
  ]
  return { keyboard, pointer, focus, a11y, motion, perf }
}

const markdownEditorSection = () => ({
  modes: [...MARKDOWN_EDITOR_MODES],
  capabilities: [...MARKDOWN_EDITOR_CAPABILITIES],
  writeAlias: false,
  canonical: true,
})

const contractCoverage = (members) => {
  const counts = Object.fromEntries(
    MEMBER_STATUSES.map((status) => [status, 0]),
  )
  for (const member of members) counts[member.status] += 1
  const total = members.length
  const mapped = counts['aligned-candidate'] + counts['partial']
  return {
    total,
    alignedCandidate: counts['aligned-candidate'],
    partial: counts['partial'],
    missing: counts['missing'],
    webOnly: counts['web-only'],
    mappedPercent: total === 0 ? 0 : Math.round((mapped / total) * 1000) / 10,
  }
}

const deriveExportStatus = ({ classification, members }) => {
  if (classification === 'web-only') return 'web-only'
  if (members.some((member) => member.status === 'partial')) return 'partial'
  if (members.some((member) => member.status === 'missing')) return 'missing'
  return 'aligned-candidate'
}

const semanticBindingKey = (component, kind, web) =>
  `${component}\u0000${kind}\u0000${web}`

const semanticBindingIndex = (registry) =>
  new Map(
    (registry?.mappings ?? []).map((binding) => [
      semanticBindingKey(binding.component, binding.kind, binding.web),
      binding,
    ]),
  )

const semanticDispositionIndex = (registry) =>
  new Map(
    (registry?.dispositions ?? []).map((disposition) => [
      semanticBindingKey(
        disposition.component,
        disposition.kind,
        disposition.web,
      ),
      disposition,
    ]),
  )

const contractForComponent = ({
  component,
  avaloniaType,
  typeIndex,
  gate,
  semanticBindings,
  semanticDispositions,
  performanceBudget = null,
  platformException = null,
}) => {
  // Keep the full export name in the stable id so distinct public exports such
  // as ElCollectionSummary and FsusCollectionSummary never collide.
  const contractKebab = toKebab(component.name)
  const classification = component.classification ?? 'portable'
  const bindingFor = (kind, web) =>
    semanticBindings.get(semanticBindingKey(component.name, kind, web))
  const dispositionFor = (kind, web) =>
    semanticDispositions.get(semanticBindingKey(component.name, kind, web))
  const inputs = (component.semantic?.props ?? []).map((prop) =>
    inputMember({
      contractKebab,
      prop,
      avaloniaType,
      typeIndex,
      classification,
      binding: bindingFor('input', prop.name),
      disposition: dispositionFor('input', prop.name),
    }),
  )
  const semanticEmits = component.semantic?.emits ?? []
  const outputNames =
    semanticEmits.length > 0
      ? semanticEmits.map((emit) => emit.name)
      : (component.emits ?? [])
  const outputs = outputNames.map((emit) =>
    outputMember({
      contractKebab,
      emit,
      semantic: semanticEmits.find((member) => member.name === emit),
      avaloniaType,
      typeIndex,
      classification,
      binding: bindingFor('output', emit),
      disposition: dispositionFor('output', emit),
    }),
  )
  const semanticExposed = component.semantic?.exposed ?? []
  const operationNames =
    semanticExposed.length > 0
      ? semanticExposed.map((exposed) => exposed.name)
      : (component.exposed ?? [])
  const operations = operationNames.map((exposed) =>
    operationMember({
      contractKebab,
      exposed,
      semantic: semanticExposed.find((member) => member.name === exposed),
      avaloniaType,
      classification,
      binding: bindingFor('operation', exposed),
      disposition: dispositionFor('operation', exposed),
    }),
  )
  const contentRegions = (component.slots ?? []).map((slot) =>
    contentRegionMember({
      contractKebab,
      slot,
      avaloniaType,
      classification,
      binding: bindingFor('contentRegion', slot.name),
      disposition: dispositionFor('contentRegion', slot.name),
    }),
  )

  const members = [...inputs, ...outputs, ...operations, ...contentRegions]
  const isMarkdownEditor = component.name === 'ElMarkdownEditor'
  const gateBlocked = isMarkdownEditor && gate?.blocked === true
  const exportStatus = gateBlocked
    ? (gate?.requiredStatus ?? 'partial')
    : deriveExportStatus({ classification, members })
  const avaloniaExtras = avaloniaType
    ? extractAvaloniaExtras({
        contractKebab,
        component,
        avaloniaType,
        inputs,
        outputs,
        operations,
        contentRegions,
      })
    : []
  const states = deriveStates({ component, inputs, outputs })
  const requirements = deriveRequirements({
    component,
    inputs,
    outputs,
    operations,
    contentRegions,
  })
  const stateContract = avaloniaType
    ? avaloniaStateContractRef(avaloniaType)
    : null
  const automationContract = avaloniaType
    ? avaloniaAutomationContractRef(avaloniaType)
    : null
  const tokenThemeContract = avaloniaType
    ? avaloniaTypeTokenThemeContractRef(avaloniaType)
    : null

  const contract = {
    id: `component-v2.${contractKebab}`,
    version: '2.0.0',
    releaseClassification: CONTRACT_V2_RELEASE_CLASSIFICATION,
    owner: CONTRACT_V2_OWNER,
    component: {
      name: component.name,
      module: component.module,
      classification,
      exportStatus,
    },
    bindings: {
      web: {
        status: 'source',
        package: '@ozwasyd/element-plus',
        memberRef: memberRef('component'),
      },
      avalonia: avaloniaType
        ? {
            status: 'bound',
            package: 'FsusUI.Avalonia',
            type: avaloniaType.name,
            ...(stateContract ? { stateContract } : {}),
            ...(automationContract ? { automationContract } : {}),
            ...(tokenThemeContract ? { tokenThemeContract } : {}),
          }
        : { status: 'unbound', package: null, type: null },
    },
    inputs,
    outputs,
    operations,
    contentRegions,
    states,
    requirements,
    ...(performanceBudget ? { performanceBudget } : {}),
    platformDifferences: members
      .filter(
        (member) =>
          member.status !== 'aligned-candidate' &&
          (member.status !== 'web-only' ||
            member.dispositionBasis === 'explicit-member-disposition'),
      )
      .map((member) => ({
        member: member.name,
        kind: member.kind,
        status: member.status,
        governance: member.governance,
      })),
    avaloniaExtras,
    scenarioIds: [
      ...members.flatMap((member) => member.scenarioIds),
      ...states.states.map(
        (state) => `scenario.v2.${contractKebab}.state.${toKebab(state.name)}`,
      ),
      ...requirements.keyboard.map(
        () => `scenario.v2.${contractKebab}.keyboard`,
      ),
      ...requirements.pointer.map(() => `scenario.v2.${contractKebab}.pointer`),
      ...requirements.focus.map(() => `scenario.v2.${contractKebab}.focus`),
      ...requirements.a11y.map(() => `scenario.v2.${contractKebab}.a11y`),
      ...requirements.motion.map(() => `scenario.v2.${contractKebab}.motion`),
      ...requirements.perf.map(() => `scenario.v2.${contractKebab}.perf`),
    ],
    coverage: contractCoverage(members),
  }
  if (classification === 'web-only') {
    contract.platformException = platformException
  }
  if (isMarkdownEditor) {
    contract.markdownEditor = markdownEditorSection()
    contract.markdownEditorGate = {
      blocked: gate?.blocked === true,
      blockedBy: gate?.blockedBy ?? [],
      ...(gate?.blocked === true
        ? { requiredStatus: gate?.requiredStatus ?? 'partial' }
        : {}),
    }
  }
  return contract
}

const operationMatchesSurface = (operation, surface) => {
  if (operation.operationKind === 'command') {
    if (surface.kind !== 'command') return false
    return (
      JSON.stringify(operation.command) ===
      JSON.stringify({
        type: surface.type,
        nullable: surface.nullable,
        canRead: surface.canRead,
        canWrite: surface.canWrite,
        isStatic: surface.isStatic,
        propertyKind: surface.propertyKind,
        defaultKnown: surface.defaultKnown,
        defaultValue: surface.defaultValue,
        deprecated: surface.deprecated,
        deprecationMessage: surface.deprecationMessage,
      })
    )
  }
  return (
    surface.kind === 'method' &&
    operation.signature?.returnType === surface.returnType &&
    JSON.stringify(operation.signature?.parameters ?? []) ===
      JSON.stringify(surface.parameters)
  )
}

const resolveAvaloniaSurfaceClaims = ({
  contract,
  avaloniaType,
  errors = [],
}) => {
  const surfaces = avaloniaPublicSurfaces(avaloniaType)
  const claims = new Map()
  const sections = [
    ['inputs', new Set(['property', 'avalonia-property'])],
    ['outputs', new Set(['event'])],
    ['operations', new Set(['method', 'command'])],
    ['contentRegions', new Set(['property', 'avalonia-property'])],
  ]
  for (const [section, surfaceKinds] of sections) {
    for (const member of contract[section] ?? []) {
      if (!member.avalonia?.member) continue
      let candidates = surfaces.filter(
        (surface) =>
          surfaceKinds.has(surface.kind) &&
          surface.member === member.avalonia.member,
      )
      if (section === 'operations') {
        candidates = candidates.filter((surface) =>
          operationMatchesSurface(member.avalonia, surface),
        )
      } else if (section === 'contentRegions') {
        candidates = candidates.filter(
          (surface) => surface.isContentProperty === true,
        )
      }
      const context =
        `${contract.id} ${member.kind} ${member.name} Avalonia ` +
        `${member.avalonia.member}`
      if (candidates.length !== 1) {
        errors.push(
          `${context} resolves to ${candidates.length} real public surfaces`,
        )
        continue
      }
      const fingerprint = avaloniaSurfaceFingerprint(candidates[0])
      const claimSection = claims.get(fingerprint)
      if (claimSection != null && claimSection !== section) {
        errors.push(
          `${context} duplicates an already registered public surface`,
        )
      }
      // Vue's v-model convention fans two emitted events (update:x plus the
      // domain event) into one real .NET event; Contract V2 keeps both
      // members bound to that same surface, which issue #285 allows as a
      // many-to-one mapping proven per semantic member.
      claims.set(fingerprint, section)
    }
  }
  return claims
}

const avaloniaExtraForSurface = (
  contractKebab,
  surface,
  disambiguateMember,
) => ({
  member: surface.member,
  kind: 'avalonia-extra',
  surfaceKind: surface.kind,
  surfaceHash: avaloniaSurfaceFingerprint(surface),
  governance: defaultGovernance(
    'Avalonia-only public member explicitly registered; no Vue counterpart exists in the baseline.',
  ),
  scenarioIds: [
    `scenario.v2.${contractKebab}.avalonia-extra.${toKebab(surface.member)}${
      disambiguateMember
        ? `.${toKebab(surface.kind)}.${avaloniaSurfaceFingerprint(surface).slice(0, 12)}`
        : ''
    }`,
  ],
})

const extractAvaloniaExtras = ({
  contractKebab,
  avaloniaType,
  inputs,
  outputs,
  operations,
  contentRegions,
}) => {
  const contract = {
    id: `component-v2.${contractKebab}`,
    inputs,
    outputs,
    operations,
    contentRegions,
  }
  const matchedSurfaces = resolveAvaloniaSurfaceClaims({
    contract,
    avaloniaType,
  })
  const unmatched = avaloniaPublicSurfaces(avaloniaType).filter(
    (surface) => !matchedSurfaces.has(avaloniaSurfaceFingerprint(surface)),
  )
  const memberCounts = new Map()
  for (const surface of unmatched) {
    memberCounts.set(
      surface.member,
      (memberCounts.get(surface.member) ?? 0) + 1,
    )
  }
  return unmatched.map((surface) =>
    avaloniaExtraForSurface(
      contractKebab,
      surface,
      memberCounts.get(surface.member) > 1,
    ),
  )
}

const avaloniaOnlyType = ({ type, packageId }) => {
  const stateContractFingerprint = avaloniaStateContractFingerprint(type)
  const automationContractFingerprint =
    avaloniaAutomationContractFingerprint(type)
  const tokenThemeContractFingerprint =
    avaloniaTypeTokenThemeContractFingerprint(type)
  return {
    type: type.name,
    kind: type.kind,
    packageId,
    baseline: AVALONIA_SEMANTIC_PATHS[packageId],
    memberCount: avaloniaPublicSurfaces(type).length,
    surfaceHash: avaloniaTypeSurfaceHash(type),
    ...(stateContractFingerprint ? { stateContractFingerprint } : {}),
    ...(automationContractFingerprint ? { automationContractFingerprint } : {}),
    ...(tokenThemeContractFingerprint ? { tokenThemeContractFingerprint } : {}),
    scenarioIds: [
      `scenario.v2.avalonia-only.${toKebab(type.name.split('.').pop() ?? type.name)}`,
    ],
    governance: defaultGovernance(
      'Avalonia-only public type explicitly registered; no Vue component counterpart exists in the baseline.',
    ),
  }
}

export const buildComponentMap = ({ vueBaseline, typeIndex }) => {
  const map = []
  for (const component of vueBaseline.components ?? []) {
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    if (!avaloniaType) continue
    const stateContractFingerprint =
      avaloniaStateContractFingerprint(avaloniaType)
    const automationContractFingerprint =
      avaloniaAutomationContractFingerprint(avaloniaType)
    const tokenThemeContractFingerprint =
      avaloniaTypeTokenThemeContractFingerprint(avaloniaType)
    map.push({
      vue: { name: component.name, module: component.module },
      avalonia: {
        type: avaloniaType.name,
        packageId: avaloniaType.packageId,
        surfaceHash: avaloniaTypeSurfaceHash(avaloniaType),
        ...(stateContractFingerprint ? { stateContractFingerprint } : {}),
        ...(automationContractFingerprint
          ? { automationContractFingerprint }
          : {}),
        ...(tokenThemeContractFingerprint
          ? { tokenThemeContractFingerprint }
          : {}),
      },
      basis: 'name-equality',
    })
  }
  return map.sort((first, second) =>
    first.vue.name.localeCompare(second.vue.name),
  )
}

export const buildRegistry = ({
  vueBaseline,
  avaloniaBaseline,
  avaloniaThemesBaseline,
  avaloniaIconsBaseline,
  gate,
  semanticMemberBindings = { mappings: [] },
  v1Registry = null,
}) => {
  const baselines = {
    avalonia: avaloniaBaseline,
    avaloniaThemes: avaloniaThemesBaseline,
    avaloniaIcons: avaloniaIconsBaseline,
  }
  const typeIndex = avaloniaSemanticIndex(baselines)
  const semanticBindings = semanticBindingIndex(semanticMemberBindings)
  const semanticDispositions = semanticDispositionIndex(semanticMemberBindings)
  const performanceBudgetByComponent = new Map(
    [
      ...(v1Registry?.contracts ?? []),
      ...(v1Registry?.webOnlyDecisions ?? []),
    ]
      .filter((entry) => entry.source?.kind === 'component')
      .map((entry) => [entry.source.name, entry.performanceBudget ?? null]),
  )
  const platformExceptionByComponent = new Map(
    (v1Registry?.webOnlyDecisions ?? [])
      .filter((entry) => entry.source?.kind === 'component')
      .map((entry) => [
        entry.source.name,
        {
          reason: entry.reason,
          alternative: entry.alternative,
          owner: entry.owner,
          testPolicy:
            entry.testPolicy ??
            'Keep the Web component in its real browser regression suite; do not substitute metadata-only or Avalonia evidence.',
          reviewPolicy:
            entry.reviewPolicy ??
            'Re-review the browser dependency, native alternative, and public-surface classification by reviewAfter or when either platform surface changes.',
          reviewedAt: entry.reviewedAt ?? entry.reviewAfter,
          reviewAfter: entry.reviewAfter,
          authority:
            entry.authority ??
            AVALONIA_SEMANTIC_PATHS.avalonia,
          nativeSymbols: entry.nativeSymbols ?? [
            {
              type: 'FsusUI.Avalonia.Controls.FsusAnchoredOverlaySurface',
              members: [],
            },
          ],
        },
      ]),
  )
  const componentMap = buildComponentMap({ vueBaseline, typeIndex })
  const mappedTypes = new Set(componentMap.map((entry) => entry.avalonia.type))
  const contracts = []
  for (const component of vueBaseline.components ?? []) {
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    contracts.push(
      contractForComponent({
        component,
        avaloniaType,
        typeIndex,
        gate,
        semanticBindings,
        semanticDispositions,
        performanceBudget:
          performanceBudgetByComponent.get(component.name) ?? {
            renderMs: 8,
            interactionMs: 50,
            memory:
              'no retained unbounded per-item state without virtualization budget',
          },
        platformException: platformExceptionByComponent.get(component.name),
      }),
    )
  }
  contracts.sort((first, second) => first.id.localeCompare(second.id))

  const avaloniaOnlyTypes = []
  for (const type of typeIndex.values()) {
    if (mappedTypes.has(type.name)) continue
    avaloniaOnlyTypes.push(
      avaloniaOnlyType({ type, packageId: type.packageId }),
    )
  }
  avaloniaOnlyTypes.sort((first, second) =>
    first.type.localeCompare(second.type),
  )

  const allMembers = contracts.flatMap((contract) => [
    ...contract.inputs,
    ...contract.outputs,
    ...contract.operations,
    ...contract.contentRegions,
  ])
  const coverage = Object.fromEntries(
    MEMBER_STATUSES.map((status) => [status, 0]),
  )
  for (const member of allMembers) coverage[member.status] += 1
  coverage.total = allMembers.length
  coverage.mappedPercent =
    coverage.total === 0
      ? 0
      : Math.round(
          ((coverage['aligned-candidate'] + coverage['partial']) /
            coverage.total) *
            1000,
        ) / 10

  const tokenThemeBaselines = Object.fromEntries(
    Object.entries(baselines)
      .filter(([, baseline]) => baseline?.tokenThemeContract)
      .map(([packageId, baseline]) => {
        const contract = baseline.tokenThemeContract
        return [
          packageId,
          {
            baseline: AVALONIA_SEMANTIC_PATHS[packageId],
            fingerprint: avaloniaTokenThemeContractFingerprint(contract),
            definitionCount: contract.definitions?.length ?? 0,
            dependencyCount: contract.dependencies?.length ?? 0,
            resolvedCount: (contract.dependencies ?? []).filter(
              (dependency) => dependency.resolved === true,
            ).length,
            ownerBoundCount: (contract.dependencies ?? []).filter(
              (dependency) => dependency.ownership === 'resolved',
            ).length,
            contractDeclared: false,
            renderedEvidenceVerified: false,
          },
        ]
      }),
  )

  return {
    schemaVersion: CONTRACT_V2_SCHEMA_VERSION,
    registryVersion: CONTRACT_V2_REGISTRY_VERSION,
    releaseClassification: CONTRACT_V2_RELEASE_CLASSIFICATION,
    owner: CONTRACT_V2_OWNER,
    generatedBy: {
      tool: 'scripts/contract-v2.mjs',
      toolVersion: '1.6.0',
    },
    baselines: {
      web: {
        path: VUE_BASELINE_PATH,
        hash: sha256(read(path.join(root, VUE_BASELINE_PATH))),
        packageVersion: vueBaseline.source?.packageVersion ?? 'unknown',
      },
      avalonia: {
        path: AVALONIA_SEMANTIC_PATHS.avalonia,
        hash: sha256(read(path.join(root, AVALONIA_SEMANTIC_PATHS.avalonia))),
        packageId: avaloniaBaseline.packageId ?? 'FsusUI.Avalonia',
      },
      avaloniaThemes: {
        path: AVALONIA_SEMANTIC_PATHS.avaloniaThemes,
        hash: sha256(
          read(path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaThemes)),
        ),
        packageId: avaloniaThemesBaseline.packageId ?? 'FsusUI.Avalonia.Themes',
      },
      avaloniaIcons: {
        path: AVALONIA_SEMANTIC_PATHS.avaloniaIcons,
        hash: sha256(
          read(path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaIcons)),
        ),
        packageId: avaloniaIconsBaseline.packageId ?? 'FsusUI.Avalonia.Icons',
      },
      markdownEditorGate: {
        path: MARKDOWN_EDITOR_GATE_PATH,
        hash: sha256(read(path.join(root, MARKDOWN_EDITOR_GATE_PATH))),
      },
      semanticMemberBindings: {
        path: SEMANTIC_MEMBER_BINDINGS_PATH,
        hash: sha256(read(path.join(root, SEMANTIC_MEMBER_BINDINGS_PATH))),
      },
    },
    rules: {
      componentMappingBasis:
        'explicit kebab name equality between the Vue export and the Avalonia public type',
      classificationBasis:
        'portable/native-adapter/platform-override classifications never claim a counterpart',
      memberNameNormalization: [
        'case-insensitive',
        'strip Is/Can/Has prefix',
        'strip Changed suffix',
        'kebab-case',
      ],
      semanticMemberBindings:
        'explicit platform-neutral semantic ids bind non-equivalent framework member names before normalized candidate matching',
      semanticMemberDispositions:
        'exact reviewed Vue members may be registered as web-only with owner, test, review, reason, and native alternative; wildcards and mapping collisions fail validation',
      statusDerivation: {
        alignedCandidate:
          'real member matched with no type/default/required/read-write/nullability/enum/payload drift',
        partial:
          'real member matched but semantic drift or non-comparable typing',
        missing: 'no real counterpart member on the other platform',
        webOnly: 'explicit web-only registration with governance',
      },
      aligned:
        'final aligned status is never hand-written; only aligned-candidate is derived',
    },
    componentMap,
    consumerBindings: {
      byContract: CONTRACT_V2_CONSUMER_BINDINGS,
      releaseScopeFamilies: CONTRACT_V2_RELEASE_SCOPE_FAMILIES,
      galleryRoutes: CONTRACT_V2_GALLERY_ROUTES,
    },
    contracts,
    avaloniaOnlyTypes,
    tokenThemeBaselines,
    coverage,
  }
}

const validateGovernance = (governance, context, errors) => {
  if (governance == null) {
    errors.push(`${context} missing governance`)
    return
  }
  for (const field of GOVERNANCE_FIELDS) {
    if (
      typeof governance[field] !== 'string' ||
      governance[field].trim() === ''
    ) {
      errors.push(`${context} governance missing ${field}`)
    }
  }
}

const vueMembersForKind = (component, kind) => {
  if (kind === 'input') {
    return (component.semantic?.props ?? []).map((item) => item.name)
  }
  if (kind === 'output')
    return (component.semantic?.emits ?? []).length > 0
      ? component.semantic.emits.map((member) => member.name)
      : (component.emits ?? [])
  if (kind === 'operation')
    return (component.semantic?.exposed ?? []).length > 0
      ? component.semantic.exposed.map((member) => member.name)
      : (component.exposed ?? [])
  if (kind === 'contentRegion') {
    return (component.slots ?? []).map((item) => item.name)
  }
  return []
}

const avaloniaMembersForKind = (type, kind) => {
  if (kind === 'input') {
    return [...(type.avaloniaProperties ?? []), ...(type.properties ?? [])].map(
      (item) => item.name,
    )
  }
  if (kind === 'output') return (type.events ?? []).map((item) => item.name)
  if (kind === 'operation') {
    return [...(type.methods ?? []), ...(type.commands ?? [])].map(
      (item) => item.name,
    )
  }
  if (kind === 'contentRegion') {
    return (type.contentRegions ?? []).map((item) => item.name)
  }
  return []
}

export const validateSemanticMemberBindings = ({
  registry,
  vueBaseline,
  avaloniaBaselines,
}) => {
  const errors = []
  if (registry?.schemaVersion !== 2) {
    errors.push('semantic member bindings schemaVersion must be 2')
  }
  if (!Array.isArray(registry?.mappings)) {
    return [...errors, 'semantic member bindings mappings must be an array']
  }
  if (!Array.isArray(registry?.dispositions)) {
    errors.push('semantic member bindings dispositions must be an array')
  }
  const typeIndex = avaloniaSemanticIndex(avaloniaBaselines)
  const components = new Map(
    (vueBaseline.components ?? []).map((component) => [
      component.name,
      component,
    ]),
  )
  const seenBindings = new Set()
  const seenSemantics = new Set()
  for (const binding of registry.mappings) {
    const context =
      `semantic binding ${binding?.component ?? '<unknown>'}/` +
      `${binding?.kind ?? '<unknown>'}/${binding?.web ?? '<unknown>'}`
    for (const field of ['component', 'semantic', 'kind', 'web', 'avalonia']) {
      if (
        typeof binding?.[field] !== 'string' ||
        binding[field].trim() === ''
      ) {
        errors.push(`${context} missing ${field}`)
      }
    }
    if (
      !['input', 'output', 'operation', 'contentRegion'].includes(binding?.kind)
    ) {
      errors.push(`${context} has invalid kind ${binding?.kind}`)
      continue
    }
    const key = semanticBindingKey(binding.component, binding.kind, binding.web)
    if (seenBindings.has(key)) errors.push(`${context} is duplicated`)
    seenBindings.add(key)
    const semanticKey = `${binding.component}\u0000${binding.kind}\u0000${binding.semantic}`
    if (seenSemantics.has(semanticKey)) {
      errors.push(`${context} duplicates semantic id ${binding.semantic}`)
    }
    seenSemantics.add(semanticKey)
    const component = components.get(binding.component)
    if (!component) {
      errors.push(`${context} references an unknown Vue component`)
      continue
    }
    if (!vueMembersForKind(component, binding.kind).includes(binding.web)) {
      errors.push(`${context} references a missing real Vue member`)
    }
    const avaloniaType = findAvaloniaType(component.name, typeIndex)
    if (!avaloniaType) {
      errors.push(`${context} has no real Avalonia component type`)
      continue
    }
    if (
      !avaloniaMembersForKind(avaloniaType, binding.kind).includes(
        binding.avalonia,
      )
    ) {
      errors.push(
        `${context} references a missing real Avalonia member ${binding.avalonia}`,
      )
    }
    if (binding.avaloniaPayloadField != null) {
      if (binding.kind !== 'output') {
        errors.push(
          `${context} only output bindings may declare avaloniaPayloadField`,
        )
      } else {
        const event = (avaloniaType.events ?? []).find(
          (candidate) => candidate.name === binding.avalonia,
        )
        const argsType =
          event?.argsType?.match(/^System\.EventHandler<(.+)>$/u)?.[1] ?? null
        const argsTypeSemantics = argsType
          ? typeIndex.get(argsType)
          : undefined
        const fieldNames = (argsTypeSemantics?.properties ?? []).map(
          (property) => property.name,
        )
        if (!fieldNames.includes(binding.avaloniaPayloadField)) {
          errors.push(
            `${context} references a missing real Avalonia event args field ${binding.avaloniaPayloadField}`,
          )
        }
      }
    }
  }
  const seenDispositions = new Set()
  for (const disposition of registry.dispositions ?? []) {
    const context =
      `member disposition ${disposition?.component ?? '<unknown>'}/` +
      `${disposition?.kind ?? '<unknown>'}/${disposition?.web ?? '<unknown>'}`
    for (const field of [
      'component',
      'kind',
      'web',
      'status',
      'reason',
      'owner',
      'testPolicy',
      'reviewPolicy',
      'alternative',
    ]) {
      if (
        typeof disposition?.[field] !== 'string' ||
        disposition[field].trim() === ''
      ) {
        errors.push(`${context} missing ${field}`)
      }
    }
    if (
      !['input', 'output', 'operation', 'contentRegion'].includes(
        disposition?.kind,
      )
    ) {
      errors.push(`${context} has invalid kind ${disposition?.kind}`)
      continue
    }
    if (disposition?.status !== 'web-only') {
      errors.push(`${context} has invalid status ${disposition?.status}`)
    }
    if (
      disposition?.component?.includes('*') ||
      disposition?.web?.includes('*')
    ) {
      errors.push(`${context} uses a broad member disposition`)
    }
    const key = semanticBindingKey(
      disposition.component,
      disposition.kind,
      disposition.web,
    )
    if (seenDispositions.has(key)) errors.push(`${context} is duplicated`)
    seenDispositions.add(key)
    if (seenBindings.has(key)) {
      errors.push(`${context} conflicts with an explicit semantic mapping`)
    }
    const component = components.get(disposition.component)
    if (!component) {
      errors.push(`${context} references an unknown Vue component`)
      continue
    }
    if (component.classification === 'web-only') {
      errors.push(
        `${context} redundantly classifies a component-level web-only export`,
      )
    }
    if (
      !vueMembersForKind(component, disposition.kind).includes(disposition.web)
    ) {
      errors.push(`${context} references a missing real Vue member`)
    }
  }
  return errors
}

const validateMember = (member, contractId, classification, errors) => {
  const context = `${contractId} ${member.kind ?? 'member'} ${member.name ?? '<unknown>'}`
  if (!MEMBER_STATUSES.includes(member.status)) {
    errors.push(`${context} has invalid status ${member.status}`)
  }
  if (!Array.isArray(member.scenarioIds) || member.scenarioIds.length === 0) {
    errors.push(`${context} is required semantic without scenario coverage id`)
  }
  if (member.status !== 'aligned-candidate') {
    validateGovernance(member.governance, context, errors)
  }
  if (member.status === 'aligned-candidate' && member.governance != null) {
    errors.push(
      `${context} aligned-candidate must not carry an override governance`,
    )
  }
  if (member.status === 'aligned-candidate') {
    for (const key of COMPARISON_KEY) {
      if (member.drift?.[key] != null) {
        errors.push(
          `${context} claims aligned-candidate with ${key} drift: ${member.drift[key]}`,
        )
      }
    }
  }
  if (member.status === 'aligned-candidate' && member.avalonia == null) {
    errors.push(
      `${context} claims aligned-candidate without a real Avalonia member (auto counterpart)`,
    )
  }
  if (member.bindingBasis === 'explicit-semantic') {
    if (typeof member.semantic !== 'string' || member.semantic.trim() === '') {
      errors.push(`${context} explicit semantic binding is missing semantic id`)
    }
    if (member.avalonia == null) {
      errors.push(
        `${context} explicit semantic binding is missing its Avalonia member`,
      )
    }
  }
  if (
    member.status === 'web-only' &&
    classification !== 'web-only' &&
    member.dispositionBasis !== 'explicit-member-disposition'
  ) {
    errors.push(
      `${context} web-only status lacks an explicit member disposition`,
    )
  }
  if (member.dispositionBasis === 'explicit-member-disposition') {
    if (member.status !== 'web-only') {
      errors.push(`${context} explicit member disposition must be web-only`)
    }
    if (member.avalonia != null) {
      errors.push(
        `${context} explicit member disposition must not claim an Avalonia member`,
      )
    }
    if (
      typeof member.platformAlternative !== 'string' ||
      member.platformAlternative.trim() === ''
    ) {
      errors.push(
        `${context} explicit member disposition missing platform alternative`,
      )
    }
  }
}

const validateMarkdownEditorGate = (gate, errors) => {
  if (typeof gate !== 'object' || gate == null) {
    errors.push('MarkdownEditor gate must be an object')
    return
  }
  if (gate.schemaVersion !== 1) {
    errors.push('MarkdownEditor gate schemaVersion must be 1')
  }
  if (gate.component !== 'ElMarkdownEditor') {
    errors.push('MarkdownEditor gate must target ElMarkdownEditor')
  }
  if (typeof gate.blocked !== 'boolean') {
    errors.push('MarkdownEditor gate blocked must be a boolean')
  }
  if (!Array.isArray(gate.blockedBy)) {
    errors.push('MarkdownEditor gate blockedBy must be an array')
  } else {
    const blockers = new Set()
    for (const blocker of gate.blockedBy) {
      if (!Number.isInteger(blocker) || blocker <= 0) {
        errors.push(
          'MarkdownEditor gate blockedBy must contain positive issue numbers',
        )
      } else if (blockers.has(blocker)) {
        errors.push(`MarkdownEditor gate blockedBy duplicates #${blocker}`)
      }
      blockers.add(blocker)
    }
    if (gate.blocked === false && gate.blockedBy.length > 0) {
      errors.push(
        'MarkdownEditor gate blocked=false cannot retain stale blockedBy entries',
      )
    }
    if (gate.blocked === true && gate.blockedBy.length === 0) {
      errors.push('MarkdownEditor gate blocked=true requires blockedBy entries')
    }
  }
  if (typeof gate.reason !== 'string' || gate.reason.trim() === '') {
    errors.push('MarkdownEditor gate must record a non-empty reason')
  }
}

const validateMarkdownEditor = (contract, gate, errors) => {
  if (contract.component?.name !== 'ElMarkdownEditor') return
  const editor = contract.markdownEditor
  if (!editor) {
    errors.push(`${contract.id} missing markdownEditor canonical section`)
    return
  }
  if (editor.writeAlias !== false) {
    errors.push(`${contract.id} MarkdownEditor must not carry a write alias`)
  }
  if (
    JSON.stringify(editor.modes ?? []) !== JSON.stringify(MARKDOWN_EDITOR_MODES)
  ) {
    errors.push(
      `${contract.id} MarkdownEditor modes must be source/live/split/preview`,
    )
  }
  if (
    JSON.stringify(editor.capabilities ?? []) !==
    JSON.stringify(MARKDOWN_EDITOR_CAPABILITIES)
  ) {
    errors.push(
      `${contract.id} MarkdownEditor capability set must be the six canonical values`,
    )
  }
  const serialized = JSON.stringify(editor)
  if (serialized.includes('"write"')) {
    errors.push(
      `${contract.id} MarkdownEditor must not reference write anywhere`,
    )
  }
  const embeddedGate = contract.markdownEditorGate
  const expectedGate = {
    blocked: gate?.blocked === true,
    blockedBy: gate?.blockedBy ?? [],
    ...(gate?.blocked === true
      ? { requiredStatus: gate?.requiredStatus ?? 'partial' }
      : {}),
  }
  if (JSON.stringify(embeddedGate) !== JSON.stringify(expectedGate)) {
    errors.push(
      `${contract.id} markdownEditorGate disagrees with the authoritative gate`,
    )
  }
  const members = [
    ...(contract.inputs ?? []),
    ...(contract.outputs ?? []),
    ...(contract.operations ?? []),
    ...(contract.contentRegions ?? []),
  ]
  const expectedStatus =
    gate?.blocked === true
      ? (gate?.requiredStatus ?? 'partial')
      : deriveExportStatus({
          classification: contract.component?.classification,
          members,
        })
  if (contract.component?.exportStatus !== expectedStatus) {
    errors.push(
      `${contract.id} exportStatus ${contract.component?.exportStatus ?? '<unknown>'} disagrees with derived status ${expectedStatus}`,
    )
  }
}

export const validateContract = (contract, gate, errors) => {
  const contractErrors = errors ?? []
  if (!/^component-v2\.[a-z0-9][a-z0-9.-]+$/.test(contract.id ?? '')) {
    contractErrors.push(`${contract.id ?? '<unknown>'} has invalid stable id`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(contract.version ?? '')) {
    contractErrors.push(`${contract.id ?? '<unknown>'} has invalid version`)
  }
  for (const section of [
    'inputs',
    'outputs',
    'operations',
    'contentRegions',
    'platformDifferences',
    'avaloniaExtras',
    'scenarioIds',
  ]) {
    if (!Array.isArray(contract[section])) {
      contractErrors.push(`${contract.id} ${section} must be an array`)
    }
  }
  for (const section of ['states', 'requirements', 'bindings']) {
    if (typeof contract[section] !== 'object' || contract[section] == null) {
      contractErrors.push(`${contract.id} ${section} must be an object`)
    }
  }
  const members = [
    ...(contract.inputs ?? []),
    ...(contract.outputs ?? []),
    ...(contract.operations ?? []),
    ...(contract.contentRegions ?? []),
  ]
  for (const member of members) {
    validateMember(
      member,
      contract.id,
      contract.component?.classification,
      contractErrors,
    )
  }
  for (const difference of contract.platformDifferences ?? []) {
    validateGovernance(
      difference.governance,
      `${contract.id} platform difference ${difference.member ?? '<unknown>'}`,
      contractErrors,
    )
    if (difference.scope && difference.scope !== 'member') {
      contractErrors.push(
        `${contract.id} platform difference ${difference.member ?? '<unknown>'} uses broad scope ${difference.scope}`,
      )
    }
  }
  for (const extra of contract.avaloniaExtras ?? []) {
    validateGovernance(
      extra.governance,
      `${contract.id} avalonia extra ${extra.member ?? '<unknown>'}`,
      contractErrors,
    )
    if (!Array.isArray(extra.scenarioIds) || extra.scenarioIds.length === 0) {
      contractErrors.push(
        `${contract.id} avalonia extra ${extra.member ?? '<unknown>'} missing scenario coverage id`,
      )
    }
    if (
      typeof extra.surfaceKind !== 'string' ||
      !/^[a-f0-9]{64}$/.test(extra.surfaceHash ?? '')
    ) {
      contractErrors.push(
        `${contract.id} avalonia extra ${extra.member ?? '<unknown>'} missing canonical public surface identity`,
      )
    }
  }
  if (contract.scenarioIds.length === 0) {
    contractErrors.push(`${contract.id} missing required scenario ids`)
  }
  if (/"aligned"\s*:\s*true/.test(JSON.stringify(contract))) {
    contractErrors.push(
      `${contract.id} must not hand-write final aligned: true`,
    )
  }
  validateMarkdownEditor(contract, gate, contractErrors)
  return contractErrors
}

export const validateAvaloniaSurfaceRegistration = ({
  registry,
  avaloniaBaselines,
}) => {
  const errors = []
  const seenTypes = new Set()
  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    for (const type of avaloniaBaselines[packageId]?.semanticTypes ?? []) {
      if (seenTypes.has(type.name)) {
        errors.push(`duplicate Avalonia baseline type ${type.name}`)
        continue
      }
      seenTypes.add(type.name)
    }
  }
  const types = avaloniaSemanticIndex(avaloniaBaselines)

  for (const [packageId] of Object.entries(AVALONIA_SEMANTIC_PATHS)) {
    const baselineContract = avaloniaBaselines[packageId]?.tokenThemeContract
    const actual = registry.tokenThemeBaselines?.[packageId] ?? null
    if (!baselineContract) {
      if (actual) {
        errors.push(
          `token/theme baseline ${packageId} exists without baseline metadata`,
        )
      }
      continue
    }
    const expected = {
      baseline: AVALONIA_SEMANTIC_PATHS[packageId],
      fingerprint: avaloniaTokenThemeContractFingerprint(baselineContract),
      definitionCount: baselineContract.definitions?.length ?? 0,
      dependencyCount: baselineContract.dependencies?.length ?? 0,
      resolvedCount: (baselineContract.dependencies ?? []).filter(
        (dependency) => dependency.resolved === true,
      ).length,
      ownerBoundCount: (baselineContract.dependencies ?? []).filter(
        (dependency) => dependency.ownership === 'resolved',
      ).length,
      contractDeclared: false,
      renderedEvidenceVerified: false,
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push(`token/theme baseline ${packageId} is stale`)
    }
  }

  const contracts = new Map()
  for (const contract of registry.contracts ?? []) {
    const componentName = contract.component?.name
    if (!componentName) continue
    if (contracts.has(componentName)) {
      errors.push(`duplicate contract component ${componentName}`)
      continue
    }
    contracts.set(componentName, contract)
  }

  const mappedTypes = new Set()
  const mappedComponents = new Set()
  let mappedSurfaceStates = 0
  let mappedClaims = 0
  let avaloniaExtras = 0
  for (const mapping of registry.componentMap ?? []) {
    const componentName = mapping.vue?.name
    const typeName = mapping.avalonia?.type
    const context =
      `componentMap ${componentName ?? '<unknown>'} -> ` +
      `${typeName ?? '<unknown>'}`
    if (mappedComponents.has(componentName)) {
      errors.push(`${context} duplicates a Vue component mapping`)
      continue
    }
    mappedComponents.add(componentName)
    const type = types.get(typeName)
    if (!type) {
      errors.push(`${context} references a missing Avalonia baseline type`)
      continue
    }
    mappedTypes.add(typeName)
    if (mapping.avalonia?.packageId !== type.packageId) {
      errors.push(`${context} has stale package ownership`)
    }
    if (mapping.avalonia?.surfaceHash !== avaloniaTypeSurfaceHash(type)) {
      errors.push(`${context} has stale public surface hash`)
    }
    if (
      (mapping.avalonia?.stateContractFingerprint ?? null) !==
      avaloniaStateContractFingerprint(type)
    ) {
      errors.push(`${context} has stale state contract fingerprint`)
    }
    if (
      (mapping.avalonia?.automationContractFingerprint ?? null) !==
      avaloniaAutomationContractFingerprint(type)
    ) {
      errors.push(`${context} has stale automation contract fingerprint`)
    }
    if (
      (mapping.avalonia?.tokenThemeContractFingerprint ?? null) !==
      avaloniaTypeTokenThemeContractFingerprint(type)
    ) {
      errors.push(`${context} has stale token/theme contract fingerprint`)
    }
    const contract = contracts.get(componentName)
    if (!contract) {
      errors.push(`${context} has no component contract`)
      continue
    }
    if (
      JSON.stringify(contract.bindings?.avalonia?.stateContract ?? null) !==
      JSON.stringify(avaloniaStateContractRef(type))
    ) {
      errors.push(`${contract.id} has stale Avalonia state contract binding`)
    }
    if (
      JSON.stringify(
        contract.bindings?.avalonia?.automationContract ?? null,
      ) !== JSON.stringify(avaloniaAutomationContractRef(type))
    ) {
      errors.push(
        `${contract.id} has stale Avalonia automation contract binding`,
      )
    }
    if (
      JSON.stringify(
        contract.bindings?.avalonia?.tokenThemeContract ?? null,
      ) !== JSON.stringify(avaloniaTypeTokenThemeContractRef(type))
    ) {
      errors.push(
        `${contract.id} has stale Avalonia token/theme contract binding`,
      )
    }

    const surfaces = avaloniaPublicSurfaces(type)
    const claims = resolveAvaloniaSurfaceClaims({
      contract,
      avaloniaType: type,
      errors,
    })
    mappedSurfaceStates += surfaces.length
    mappedClaims += claims.size

    const unmatchedSurfaces = surfaces.filter(
      (surface) => !claims.has(avaloniaSurfaceFingerprint(surface)),
    )
    const unmatchedMemberCounts = new Map()
    for (const surface of unmatchedSurfaces) {
      unmatchedMemberCounts.set(
        surface.member,
        (unmatchedMemberCounts.get(surface.member) ?? 0) + 1,
      )
    }
    const expectedExtras = new Map(
      unmatchedSurfaces.map((surface) => [
        avaloniaSurfaceFingerprint(surface),
        surface,
      ]),
    )
    const actualExtras = new Map()
    for (const extra of contract.avaloniaExtras ?? []) {
      avaloniaExtras += 1
      const extraContext = `${contract.id} avalonia extra ${extra.member ?? '<unknown>'}`
      if (extra.kind !== 'avalonia-extra') {
        errors.push(`${extraContext} has invalid status ${extra.kind}`)
      }
      if (
        typeof extra.surfaceKind !== 'string' ||
        typeof extra.surfaceHash !== 'string'
      ) {
        errors.push(`${extraContext} has no canonical public surface identity`)
        continue
      }
      const fingerprint = extra.surfaceHash
      if (actualExtras.has(fingerprint)) {
        errors.push(`${extraContext} duplicates a public surface registration`)
      }
      actualExtras.set(fingerprint, extra)
      const expectedSurface = expectedExtras.get(fingerprint)
      if (!expectedSurface) {
        errors.push(
          `${extraContext} does not match an unmatched real public surface`,
        )
      } else if (
        extra.member !== expectedSurface.member ||
        extra.surfaceKind !== expectedSurface.kind
      ) {
        errors.push(
          `${extraContext} member or kind disagrees with its real public surface`,
        )
      } else {
        const expectedEntry = avaloniaExtraForSurface(
          toKebab(componentName),
          expectedSurface,
          unmatchedMemberCounts.get(expectedSurface.member) > 1,
        )
        if (
          JSON.stringify(extra.scenarioIds) !==
          JSON.stringify(expectedEntry.scenarioIds)
        ) {
          errors.push(
            `${extraContext} has stale or non-unique scenario coverage identity`,
          )
        }
      }
    }
    for (const [fingerprint, surface] of expectedExtras) {
      if (actualExtras.has(fingerprint)) continue
      errors.push(
        `${contract.id} real Avalonia ${surface.kind} ${surface.member} is neither mapped nor registered as avalonia-extra`,
      )
    }
  }

  const onlyTypes = new Map()
  for (const entry of registry.avaloniaOnlyTypes ?? []) {
    const context = `avalonia-only type ${entry.type ?? '<unknown>'}`
    if (onlyTypes.has(entry.type)) {
      errors.push(`${context} is registered more than once`)
      continue
    }
    onlyTypes.set(entry.type, entry)
    const type = types.get(entry.type)
    if (!type) {
      errors.push(`${context} does not exist in the Avalonia baselines`)
      continue
    }
    if (mappedTypes.has(entry.type)) {
      errors.push(`${context} is also registered as a Vue counterpart`)
    }
    const expected = avaloniaOnlyType({
      type,
      packageId: type.packageId,
    })
    for (const field of [
      'kind',
      'packageId',
      'baseline',
      'memberCount',
      'surfaceHash',
      'stateContractFingerprint',
      'automationContractFingerprint',
      'tokenThemeContractFingerprint',
    ]) {
      if ((entry[field] ?? null) !== (expected[field] ?? null)) {
        errors.push(`${context} has stale ${field}`)
      }
    }
  }

  let avaloniaOnlySurfaces = 0
  let mappedTypeSurfaces = 0
  for (const type of types.values()) {
    const surfaceCount = avaloniaPublicSurfaces(type).length
    if (mappedTypes.has(type.name)) {
      mappedTypeSurfaces += surfaceCount
      continue
    }
    avaloniaOnlySurfaces += surfaceCount
    if (!onlyTypes.has(type.name)) {
      errors.push(
        `real Avalonia type ${type.name} has no Vue counterpart and is not registered as avalonia-extra`,
      )
    }
  }

  return {
    errors,
    stats: {
      baselineTypes: types.size,
      mappedTypes: mappedTypes.size,
      mappedContracts: mappedComponents.size,
      avaloniaOnlyTypes: types.size - mappedTypes.size,
      avaloniaOnlySurfaces,
      mappedTypeSurfaces,
      baselineSurfaces: mappedTypeSurfaces + avaloniaOnlySurfaces,
      mappedSurfaceStates,
      mappedClaims,
      avaloniaExtras,
      internalSurfaces: 0,
    },
  }
}

export const validateRegistry = (
  registry,
  gate,
  { avaloniaBaselines = null } = {},
) => {
  const errors = []
  validateMarkdownEditorGate(gate, errors)
  if (registry.schemaVersion !== CONTRACT_V2_SCHEMA_VERSION) {
    errors.push('registry schemaVersion must be 2')
  }
  if (registry.registryVersion !== CONTRACT_V2_REGISTRY_VERSION) {
    errors.push('registry registryVersion must be 2.0.0')
  }
  if (!Array.isArray(registry.contracts)) {
    errors.push('registry contracts must be an array')
    return errors
  }
  if (!Array.isArray(registry.avaloniaOnlyTypes)) {
    errors.push('registry avaloniaOnlyTypes must be an array')
  }
  if (!Array.isArray(registry.componentMap)) {
    errors.push('registry componentMap must be an array')
  }

  const consumerBindings = registry.consumerBindings
  if (
    !consumerBindings ||
    typeof consumerBindings !== 'object' ||
    Array.isArray(consumerBindings) ||
    !consumerBindings.byContract ||
    typeof consumerBindings.byContract !== 'object' ||
    Array.isArray(consumerBindings.byContract)
  ) {
    errors.push('registry consumerBindings.byContract must be an object')
  }
  if (!Array.isArray(consumerBindings?.releaseScopeFamilies)) {
    errors.push(
      'registry consumerBindings.releaseScopeFamilies must be an array',
    )
  }
  if (!Array.isArray(consumerBindings?.galleryRoutes)) {
    errors.push('registry consumerBindings.galleryRoutes must be an array')
  }
  const contractIds = new Set()
  for (const contract of registry.contracts) {
    if (contractIds.has(contract.id)) {
      errors.push(`duplicate contract id ${contract.id}`)
    }
    contractIds.add(contract.id)
    validateContract(contract, gate, errors)
  }

  const sortedContractIds = [...contractIds].sort()
  const actualConsumerIds = Object.keys(
    registry.consumerBindings?.byContract ?? {},
  ).sort()
  if (
    JSON.stringify(actualConsumerIds) !== JSON.stringify(sortedContractIds)
  ) {
    errors.push(
      'consumer bindings must bind every exact contract id once with no unknown contracts',
    )
  }
  const expectedConsumerIds = Object.keys(
    CONTRACT_V2_CONSUMER_BINDINGS,
  ).sort()
  const usesProductionAuthority =
    JSON.stringify(sortedContractIds) === JSON.stringify(expectedConsumerIds)
  if (
    usesProductionAuthority &&
    JSON.stringify(actualConsumerIds) !== JSON.stringify(expectedConsumerIds)
  ) {
    errors.push(
      'consumer bindings drifted from the explicit generator authority',
    )
  }
  const allowedReleaseFamilies = new Set(
    registry.consumerBindings?.releaseScopeFamilies ?? [],
  )
  const allowedGalleryRoutes = new Set(
    registry.consumerBindings?.galleryRoutes ?? [],
  )
  for (const contractId of actualConsumerIds) {
    const binding = registry.consumerBindings.byContract[contractId]
    const expected = CONTRACT_V2_CONSUMER_BINDINGS[contractId]
    if (
      usesProductionAuthority &&
      JSON.stringify(binding) !== JSON.stringify(expected)
    ) {
      errors.push(
        `${contractId} consumer binding drifted from generator authority`,
      )
      continue
    }
    if (!allowedReleaseFamilies.has(binding.releaseFamily)) {
      errors.push(
        `${contractId} references unknown release family ${binding.releaseFamily}`,
      )
    }
    if (!allowedGalleryRoutes.has(binding.galleryRoute)) {
      errors.push(
        `${contractId} references unknown Gallery route ${binding.galleryRoute}`,
      )
    }
  }
  if (
    usesProductionAuthority &&
    JSON.stringify(
      [...(registry.consumerBindings?.releaseScopeFamilies ?? [])].sort(),
    ) !== JSON.stringify(CONTRACT_V2_RELEASE_SCOPE_FAMILIES)
  ) {
    errors.push('consumer release scope drifted from generator authority')
  }
  if (
    usesProductionAuthority &&
    JSON.stringify(
      [...(registry.consumerBindings?.galleryRoutes ?? [])].sort(),
    ) !== JSON.stringify(CONTRACT_V2_GALLERY_ROUTES)
  ) {
    errors.push('consumer Gallery routes drifted from generator authority')
  }
  for (const entry of registry.avaloniaOnlyTypes ?? []) {
    const context = `avalonia-only type ${entry.type ?? '<unknown>'}`
    validateGovernance(entry.governance, context, errors)
    if (!Array.isArray(entry.scenarioIds) || entry.scenarioIds.length === 0) {
      errors.push(`${context} missing scenario coverage id`)
    }
  }
  for (const entry of registry.componentMap ?? []) {
    if (entry.basis !== 'name-equality') {
      errors.push(
        `componentMap ${entry.vue?.name ?? '<unknown>'} must use name-equality basis`,
      )
    }
  }
  if (avaloniaBaselines) {
    errors.push(
      ...validateAvaloniaSurfaceRegistration({
        registry,
        avaloniaBaselines,
      }).errors,
    )
  }
  return errors
}

const main = () => {
  const args = new Set(process.argv.slice(2))
  const checkMode = args.has('--check')
  const registryPath = path.join(root, CONTRACT_V2_REGISTRY_PATH)
  const gatePath = path.join(root, MARKDOWN_EDITOR_GATE_PATH)
  const semanticBindingsPath = path.join(root, SEMANTIC_MEMBER_BINDINGS_PATH)
  const v1RegistryPath = path.join(root, V1_CONTRACT_REGISTRY_PATH)

  for (const requiredPath of [gatePath, semanticBindingsPath]) {
    if (exists(requiredPath)) continue
    console.error(`${path.relative(root, requiredPath)} must exist`)
    process.exitCode = 1
    return
  }

  const vueBaseline = parseJson(path.join(root, VUE_BASELINE_PATH))
  const avaloniaBaseline = parseJson(
    path.join(root, AVALONIA_SEMANTIC_PATHS.avalonia),
  )
  const avaloniaThemesBaseline = parseJson(
    path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaThemes),
  )
  const avaloniaIconsBaseline = parseJson(
    path.join(root, AVALONIA_SEMANTIC_PATHS.avaloniaIcons),
  )
  const gate = parseJson(gatePath)
  const semanticMemberBindings = parseJson(semanticBindingsPath)
  const v1Registry = parseJson(v1RegistryPath)
  const avaloniaBaselines = {
    avalonia: avaloniaBaseline,
    avaloniaThemes: avaloniaThemesBaseline,
    avaloniaIcons: avaloniaIconsBaseline,
  }
  const bindingErrors = validateSemanticMemberBindings({
    registry: semanticMemberBindings,
    vueBaseline,
    avaloniaBaselines,
  })
  if (bindingErrors.length > 0) {
    console.error('semantic member binding validation failed:')
    for (const error of bindingErrors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  const registry = buildRegistry({
    vueBaseline,
    avaloniaBaseline,
    avaloniaThemesBaseline,
    avaloniaIconsBaseline,
    gate,
    semanticMemberBindings,
    v1Registry,
  })
  const surfaceAudit = validateAvaloniaSurfaceRegistration({
    registry,
    avaloniaBaselines,
  })
  const errors = validateRegistry(registry, gate, { avaloniaBaselines })
  if (errors.length > 0) {
    console.error('contract-v2 validation failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  const output = stableJson(registry)
  if (checkMode) {
    if (!exists(registryPath)) {
      console.error(
        `${CONTRACT_V2_REGISTRY_PATH} is missing; run pnpm run contract-v2:generate`,
      )
      process.exitCode = 1
      return
    }
    if (read(registryPath) !== output) {
      console.error(
        `${CONTRACT_V2_REGISTRY_PATH} drifted from generated output; run pnpm run contract-v2:generate`,
      )
      process.exitCode = 1
      return
    }
    console.log(
      `contract-v2:check passed (${registry.contracts.length} contracts, ${registry.coverage.total} members; ` +
        `${surfaceAudit.stats.baselineTypes} Avalonia types/${surfaceAudit.stats.baselineSurfaces} public surfaces, ` +
        `${surfaceAudit.stats.mappedSurfaceStates} mapped-contract surface states, ` +
        `${surfaceAudit.stats.avaloniaOnlyTypes} avalonia-only types)`,
    )
    return
  }

  write(registryPath, output)
  console.log(
    `contract-v2:generate wrote ${CONTRACT_V2_REGISTRY_PATH} (${registry.contracts.length} contracts, ${registry.coverage.total} members; ` +
      `${surfaceAudit.stats.baselineTypes} Avalonia types/${surfaceAudit.stats.baselineSurfaces} public surfaces, ` +
      `${surfaceAudit.stats.mappedSurfaceStates} mapped-contract surface states, ` +
      `${surfaceAudit.stats.avaloniaOnlyTypes} avalonia-only types)`,
  )
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
