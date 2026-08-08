import { withInstall } from '@element-plus/utils'

import DangerZone from './src/danger-zone.vue'
import DestructiveActionPanel from './src/destructive-action-panel.vue'
import FormSection from './src/form-section.vue'
import InlineActions from './src/inline-actions.vue'
import MetadataItem from './src/metadata-item.vue'
import MetadataRow from './src/metadata-row.vue'
import ResourceList from './src/resource-list.vue'
import ResourceListItem from './src/resource-list-item.vue'
import RiskNotice from './src/risk-notice.vue'
import SectionHeader from './src/section-header.vue'
import SectionNav from './src/section-nav.vue'
import SectionNavLink from './src/section-nav-link.vue'
import SettingsSection from './src/settings-section.vue'
import TypedConfirmField from './src/typed-confirm-field.vue'

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})

export const ElSectionNav = withInstall(SectionNav, {
  FsusSectionNav: withFsusAlias(SectionNav, 'FsusSectionNav'),
})
export const FsusSectionNav = ElSectionNav.FsusSectionNav

export const ElSectionNavLink = withInstall(SectionNavLink, {
  FsusSectionNavLink: withFsusAlias(SectionNavLink, 'FsusSectionNavLink'),
})
export const FsusSectionNavLink = ElSectionNavLink.FsusSectionNavLink

export const ElSettingsSection = withInstall(SettingsSection, {
  FsusSettingsSection: withFsusAlias(SettingsSection, 'FsusSettingsSection'),
})
export const FsusSettingsSection = ElSettingsSection.FsusSettingsSection

export const ElSectionHeader = withInstall(SectionHeader, {
  FsusSectionHeader: withFsusAlias(SectionHeader, 'FsusSectionHeader'),
})
export const FsusSectionHeader = ElSectionHeader.FsusSectionHeader

export const ElFormSection = withInstall(FormSection, {
  FsusFormSection: withFsusAlias(FormSection, 'FsusFormSection'),
})
export const FsusFormSection = ElFormSection.FsusFormSection

export const ElResourceList = withInstall(ResourceList, {
  FsusResourceList: withFsusAlias(ResourceList, 'FsusResourceList'),
})
export const FsusResourceList = ElResourceList.FsusResourceList

export const ElResourceListItem = withInstall(ResourceListItem, {
  FsusResourceListItem: withFsusAlias(ResourceListItem, 'FsusResourceListItem'),
})
export const FsusResourceListItem = ElResourceListItem.FsusResourceListItem

export const ElMetadataRow = withInstall(MetadataRow, {
  FsusMetadataRow: withFsusAlias(MetadataRow, 'FsusMetadataRow'),
})
export const FsusMetadataRow = ElMetadataRow.FsusMetadataRow

export const ElMetadataItem = withInstall(MetadataItem, {
  FsusMetadataItem: withFsusAlias(MetadataItem, 'FsusMetadataItem'),
})
export const FsusMetadataItem = ElMetadataItem.FsusMetadataItem

export const ElInlineActions = withInstall(InlineActions, {
  FsusInlineActions: withFsusAlias(InlineActions, 'FsusInlineActions'),
})
export const FsusInlineActions = ElInlineActions.FsusInlineActions

export const ElDangerZone = withInstall(DangerZone, {
  FsusDangerZone: withFsusAlias(DangerZone, 'FsusDangerZone'),
})
export const FsusDangerZone = ElDangerZone.FsusDangerZone

export const ElDestructiveActionPanel = withInstall(DestructiveActionPanel, {
  FsusDestructiveActionPanel: withFsusAlias(
    DestructiveActionPanel,
    'FsusDestructiveActionPanel',
  ),
})
export const FsusDestructiveActionPanel =
  ElDestructiveActionPanel.FsusDestructiveActionPanel

export const ElRiskNotice = withInstall(RiskNotice, {
  FsusRiskNotice: withFsusAlias(RiskNotice, 'FsusRiskNotice'),
})
export const FsusRiskNotice = ElRiskNotice.FsusRiskNotice

export const ElTypedConfirmField = withInstall(TypedConfirmField, {
  FsusTypedConfirmField: withFsusAlias(
    TypedConfirmField,
    'FsusTypedConfirmField',
  ),
})
export const FsusTypedConfirmField = ElTypedConfirmField.FsusTypedConfirmField

export default ElSettingsSection

export * from './src/shared'
export type * from './src/instance'
