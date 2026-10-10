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

export type FsusSectionNavComponent = typeof SectionNav & { name: string }
export type FsusSectionNavLinkComponent = typeof SectionNavLink & {
  name: string
}
export type FsusSettingsSectionComponent = typeof SettingsSection & {
  name: string
}
export type FsusSectionHeaderComponent = typeof SectionHeader & { name: string }
export type FsusFormSectionComponent = typeof FormSection & { name: string }
export type FsusResourceListComponent = typeof ResourceList & { name: string }
export type FsusResourceListItemComponent = typeof ResourceListItem & {
  name: string
}
export type FsusMetadataRowComponent = typeof MetadataRow & { name: string }
export type FsusMetadataItemComponent = typeof MetadataItem & { name: string }
export type FsusInlineActionsComponent = typeof InlineActions & { name: string }
export type FsusDangerZoneComponent = typeof DangerZone & { name: string }
export type FsusDestructiveActionPanelComponent =
  typeof DestructiveActionPanel & { name: string }
export type FsusRiskNoticeComponent = typeof RiskNotice & { name: string }
export type FsusTypedConfirmFieldComponent = typeof TypedConfirmField & {
  name: string
}

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})

export const ElSectionNav = withInstall<
  typeof SectionNav,
  { FsusSectionNav: FsusSectionNavComponent }
>(SectionNav, {
  FsusSectionNav: withFsusAlias(SectionNav, 'FsusSectionNav'),
})
export const FsusSectionNav = ElSectionNav.FsusSectionNav

export const ElSectionNavLink = withInstall<
  typeof SectionNavLink,
  { FsusSectionNavLink: FsusSectionNavLinkComponent }
>(SectionNavLink, {
  FsusSectionNavLink: withFsusAlias(SectionNavLink, 'FsusSectionNavLink'),
})
export const FsusSectionNavLink = ElSectionNavLink.FsusSectionNavLink

export const ElSettingsSection = withInstall<
  typeof SettingsSection,
  { FsusSettingsSection: FsusSettingsSectionComponent }
>(SettingsSection, {
  FsusSettingsSection: withFsusAlias(SettingsSection, 'FsusSettingsSection'),
})
export const FsusSettingsSection = ElSettingsSection.FsusSettingsSection

export const ElSectionHeader = withInstall<
  typeof SectionHeader,
  { FsusSectionHeader: FsusSectionHeaderComponent }
>(SectionHeader, {
  FsusSectionHeader: withFsusAlias(SectionHeader, 'FsusSectionHeader'),
})
export const FsusSectionHeader = ElSectionHeader.FsusSectionHeader

export const ElFormSection = withInstall<
  typeof FormSection,
  { FsusFormSection: FsusFormSectionComponent }
>(FormSection, {
  FsusFormSection: withFsusAlias(FormSection, 'FsusFormSection'),
})
export const FsusFormSection = ElFormSection.FsusFormSection

export const ElResourceList = withInstall<
  typeof ResourceList,
  { FsusResourceList: FsusResourceListComponent }
>(ResourceList, {
  FsusResourceList: withFsusAlias(ResourceList, 'FsusResourceList'),
})
export const FsusResourceList = ElResourceList.FsusResourceList

export const ElResourceListItem = withInstall<
  typeof ResourceListItem,
  { FsusResourceListItem: FsusResourceListItemComponent }
>(ResourceListItem, {
  FsusResourceListItem: withFsusAlias(ResourceListItem, 'FsusResourceListItem'),
})
export const FsusResourceListItem = ElResourceListItem.FsusResourceListItem

export const ElMetadataRow = withInstall<
  typeof MetadataRow,
  { FsusMetadataRow: FsusMetadataRowComponent }
>(MetadataRow, {
  FsusMetadataRow: withFsusAlias(MetadataRow, 'FsusMetadataRow'),
})
export const FsusMetadataRow = ElMetadataRow.FsusMetadataRow

export const ElMetadataItem = withInstall<
  typeof MetadataItem,
  { FsusMetadataItem: FsusMetadataItemComponent }
>(MetadataItem, {
  FsusMetadataItem: withFsusAlias(MetadataItem, 'FsusMetadataItem'),
})
export const FsusMetadataItem = ElMetadataItem.FsusMetadataItem

export const ElInlineActions = withInstall<
  typeof InlineActions,
  { FsusInlineActions: FsusInlineActionsComponent }
>(InlineActions, {
  FsusInlineActions: withFsusAlias(InlineActions, 'FsusInlineActions'),
})
export const FsusInlineActions = ElInlineActions.FsusInlineActions

export const ElDangerZone = withInstall<
  typeof DangerZone,
  { FsusDangerZone: FsusDangerZoneComponent }
>(DangerZone, {
  FsusDangerZone: withFsusAlias(DangerZone, 'FsusDangerZone'),
})
export const FsusDangerZone = ElDangerZone.FsusDangerZone

export const ElDestructiveActionPanel = withInstall<
  typeof DestructiveActionPanel,
  { FsusDestructiveActionPanel: FsusDestructiveActionPanelComponent }
>(DestructiveActionPanel, {
  FsusDestructiveActionPanel: withFsusAlias(
    DestructiveActionPanel,
    'FsusDestructiveActionPanel',
  ),
})
export const FsusDestructiveActionPanel =
  ElDestructiveActionPanel.FsusDestructiveActionPanel

export const ElRiskNotice = withInstall<
  typeof RiskNotice,
  { FsusRiskNotice: FsusRiskNoticeComponent }
>(RiskNotice, {
  FsusRiskNotice: withFsusAlias(RiskNotice, 'FsusRiskNotice'),
})
export const FsusRiskNotice = ElRiskNotice.FsusRiskNotice

export const ElTypedConfirmField = withInstall<
  typeof TypedConfirmField,
  { FsusTypedConfirmField: FsusTypedConfirmFieldComponent }
>(TypedConfirmField, {
  FsusTypedConfirmField: withFsusAlias(
    TypedConfirmField,
    'FsusTypedConfirmField',
  ),
})
export const FsusTypedConfirmField = ElTypedConfirmField.FsusTypedConfirmField

export default ElSettingsSection

export * from './src/shared'
export type * from './src/instance'
