import type DangerZone from './danger-zone.vue'
import type DestructiveActionPanel from './destructive-action-panel.vue'
import type FormSection from './form-section.vue'
import type InlineActions from './inline-actions.vue'
import type MetadataItem from './metadata-item.vue'
import type MetadataRow from './metadata-row.vue'
import type ResourceList from './resource-list.vue'
import type ResourceListItem from './resource-list-item.vue'
import type RiskNotice from './risk-notice.vue'
import type SectionHeader from './section-header.vue'
import type SectionNav from './section-nav.vue'
import type SectionNavLink from './section-nav-link.vue'
import type SettingsSection from './settings-section.vue'
import type TypedConfirmField from './typed-confirm-field.vue'

export type SectionNavInstance = InstanceType<typeof SectionNav>
export type SectionNavLinkInstance = InstanceType<typeof SectionNavLink>
export type SettingsSectionInstance = InstanceType<typeof SettingsSection>
export type SectionHeaderInstance = InstanceType<typeof SectionHeader>
export type FormSectionInstance = InstanceType<typeof FormSection>
export type ResourceListInstance = InstanceType<typeof ResourceList>
export type ResourceListItemInstance = InstanceType<typeof ResourceListItem>
export type MetadataRowInstance = InstanceType<typeof MetadataRow>
export type MetadataItemInstance = InstanceType<typeof MetadataItem>
export type InlineActionsInstance = InstanceType<typeof InlineActions>
export type DangerZoneInstance = InstanceType<typeof DangerZone>
export type DestructiveActionPanelInstance = InstanceType<
  typeof DestructiveActionPanel
>
export type RiskNoticeInstance = InstanceType<typeof RiskNotice>
export type TypedConfirmFieldInstance = InstanceType<typeof TypedConfirmField>
