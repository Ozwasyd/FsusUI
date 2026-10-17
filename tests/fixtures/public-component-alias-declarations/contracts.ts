import {
  ElSplitPane,
  FsusSplitPane,
  type FsusSplitPaneComponent,
  ElInboxLayout,
  FsusInboxLayout,
  type FsusInboxLayoutComponent,
  ElConversationList,
  FsusConversationList,
  type FsusConversationListComponent,
  ElConversationListItem,
  FsusConversationListItem,
  type FsusConversationListItemComponent,
  ElThreadPanel,
  FsusThreadPanel,
  type FsusThreadPanelComponent,
  ElMessageTimeline,
  FsusMessageTimeline,
  type FsusMessageTimelineComponent,
  ElMessageBubble,
  FsusMessageBubble,
  type FsusMessageBubbleComponent,
  ElConversationContextBar,
  FsusConversationContextBar,
  type FsusConversationContextBarComponent,
  ElReplyComposerShell,
  FsusReplyComposerShell,
  type FsusReplyComposerShellComponent,
  ElEmptySelectionState,
  FsusEmptySelectionState,
  type FsusEmptySelectionStateComponent,
  ElInboxEmptyState,
  FsusInboxEmptyState,
  type FsusInboxEmptyStateComponent,
  ElMetricList,
  FsusMetricList,
  type FsusMetricListComponent,
  ElMetricItem,
  FsusMetricItem,
  type FsusMetricItemComponent,
  ElDistributionList,
  FsusDistributionList,
  type FsusDistributionListComponent,
  ElDistributionBarRow,
  FsusDistributionBarRow,
  type FsusDistributionBarRowComponent,
  ElKpiGroup,
  FsusKpiGroup,
  type FsusKpiGroupComponent,
  ElKeyValueGrid,
  FsusKeyValueGrid,
  type FsusKeyValueGridComponent,
  ElKeyValueItem,
  FsusKeyValueItem,
  type FsusKeyValueItemComponent,
  ElStatusSummary,
  FsusStatusSummary,
  type FsusStatusSummaryComponent,
  ElDiagnosticsList,
  FsusDiagnosticsList,
  type FsusDiagnosticsListComponent,
  ElDiagnosticsItem,
  FsusDiagnosticsItem,
  type FsusDiagnosticsItemComponent,
  ElCopyableDetail,
  FsusCopyableDetail,
  type FsusCopyableDetailComponent,
  ElSectionNav,
  FsusSectionNav,
  type FsusSectionNavComponent,
  ElSectionNavLink,
  FsusSectionNavLink,
  type FsusSectionNavLinkComponent,
  ElSettingsSection,
  FsusSettingsSection,
  type FsusSettingsSectionComponent,
  ElSectionHeader,
  FsusSectionHeader,
  type FsusSectionHeaderComponent,
  ElFormSection,
  FsusFormSection,
  type FsusFormSectionComponent,
  ElResourceList,
  FsusResourceList,
  type FsusResourceListComponent,
  ElResourceListItem,
  FsusResourceListItem,
  type FsusResourceListItemComponent,
  ElMetadataRow,
  FsusMetadataRow,
  type FsusMetadataRowComponent,
  ElMetadataItem,
  FsusMetadataItem,
  type FsusMetadataItemComponent,
  ElInlineActions,
  FsusInlineActions,
  type FsusInlineActionsComponent,
  ElDangerZone,
  FsusDangerZone,
  type FsusDangerZoneComponent,
  ElDestructiveActionPanel,
  FsusDestructiveActionPanel,
  type FsusDestructiveActionPanelComponent,
  ElRiskNotice,
  FsusRiskNotice,
  type FsusRiskNoticeComponent,
  ElTypedConfirmField,
  FsusTypedConfirmField,
  type FsusTypedConfirmFieldComponent,
} from '@ozwasyd/element-plus'
import { createApp } from 'vue'
import type {} from '@ozwasyd/element-plus/global'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Check<T extends true> = T
type IsAny<T> = 0 extends 1 & T ? true : false
type PublicInstance<C> = C extends abstract new (...args: never[]) => infer I
  ? I
  : never
type PublicSurface<C> =
  PublicInstance<C> extends {
    $props: infer P
    $emit: infer E
    $slots: infer S
  }
    ? [PublicInstance<C>, P, E, S]
    : never
type AliasContract<Base, Alias, Named, Extra> = [
  Equal<Alias, Named>,
  Equal<Extra, Alias>,
  Equal<PublicSurface<Base>, PublicSurface<Alias>>,
  IsAny<Alias>,
  Alias extends { name: infer N } ? Equal<N, string> : false,
]
type Expected = [true, true, true, false, true]

const app = createApp({})

export type SplitPaneContract = Check<
  Equal<
    AliasContract<
      typeof ElSplitPane,
      typeof FsusSplitPane,
      FsusSplitPaneComponent,
      typeof ElSplitPane.FsusSplitPane
    >,
    Expected
  >
>
app.component('FsusSplitPane', FsusSplitPane)
app.use(ElSplitPane)

export type InboxLayoutContract = Check<
  Equal<
    AliasContract<
      typeof ElInboxLayout,
      typeof FsusInboxLayout,
      FsusInboxLayoutComponent,
      typeof ElInboxLayout.FsusInboxLayout
    >,
    Expected
  >
>
app.component('FsusInboxLayout', FsusInboxLayout)
app.use(ElInboxLayout)

export type ConversationListContract = Check<
  Equal<
    AliasContract<
      typeof ElConversationList,
      typeof FsusConversationList,
      FsusConversationListComponent,
      typeof ElConversationList.FsusConversationList
    >,
    Expected
  >
>
app.component('FsusConversationList', FsusConversationList)
app.use(ElConversationList)

export type ConversationListItemContract = Check<
  Equal<
    AliasContract<
      typeof ElConversationListItem,
      typeof FsusConversationListItem,
      FsusConversationListItemComponent,
      typeof ElConversationListItem.FsusConversationListItem
    >,
    Expected
  >
>
app.component('FsusConversationListItem', FsusConversationListItem)
app.use(ElConversationListItem)

export type ThreadPanelContract = Check<
  Equal<
    AliasContract<
      typeof ElThreadPanel,
      typeof FsusThreadPanel,
      FsusThreadPanelComponent,
      typeof ElThreadPanel.FsusThreadPanel
    >,
    Expected
  >
>
app.component('FsusThreadPanel', FsusThreadPanel)
app.use(ElThreadPanel)

export type MessageTimelineContract = Check<
  Equal<
    AliasContract<
      typeof ElMessageTimeline,
      typeof FsusMessageTimeline,
      FsusMessageTimelineComponent,
      typeof ElMessageTimeline.FsusMessageTimeline
    >,
    Expected
  >
>
app.component('FsusMessageTimeline', FsusMessageTimeline)
app.use(ElMessageTimeline)

export type MessageBubbleContract = Check<
  Equal<
    AliasContract<
      typeof ElMessageBubble,
      typeof FsusMessageBubble,
      FsusMessageBubbleComponent,
      typeof ElMessageBubble.FsusMessageBubble
    >,
    Expected
  >
>
app.component('FsusMessageBubble', FsusMessageBubble)
app.use(ElMessageBubble)

export type ConversationContextBarContract = Check<
  Equal<
    AliasContract<
      typeof ElConversationContextBar,
      typeof FsusConversationContextBar,
      FsusConversationContextBarComponent,
      typeof ElConversationContextBar.FsusConversationContextBar
    >,
    Expected
  >
>
app.component('FsusConversationContextBar', FsusConversationContextBar)
app.use(ElConversationContextBar)

export type ReplyComposerShellContract = Check<
  Equal<
    AliasContract<
      typeof ElReplyComposerShell,
      typeof FsusReplyComposerShell,
      FsusReplyComposerShellComponent,
      typeof ElReplyComposerShell.FsusReplyComposerShell
    >,
    Expected
  >
>
app.component('FsusReplyComposerShell', FsusReplyComposerShell)
app.use(ElReplyComposerShell)

export type EmptySelectionStateContract = Check<
  Equal<
    AliasContract<
      typeof ElEmptySelectionState,
      typeof FsusEmptySelectionState,
      FsusEmptySelectionStateComponent,
      typeof ElEmptySelectionState.FsusEmptySelectionState
    >,
    Expected
  >
>
app.component('FsusEmptySelectionState', FsusEmptySelectionState)
app.use(ElEmptySelectionState)

export type InboxEmptyStateContract = Check<
  Equal<
    AliasContract<
      typeof ElInboxEmptyState,
      typeof FsusInboxEmptyState,
      FsusInboxEmptyStateComponent,
      typeof ElInboxEmptyState.FsusInboxEmptyState
    >,
    Expected
  >
>
app.component('FsusInboxEmptyState', FsusInboxEmptyState)
app.use(ElInboxEmptyState)

export type MetricListContract = Check<
  Equal<
    AliasContract<
      typeof ElMetricList,
      typeof FsusMetricList,
      FsusMetricListComponent,
      typeof ElMetricList.FsusMetricList
    >,
    Expected
  >
>
app.component('FsusMetricList', FsusMetricList)
app.use(ElMetricList)

export type MetricItemContract = Check<
  Equal<
    AliasContract<
      typeof ElMetricItem,
      typeof FsusMetricItem,
      FsusMetricItemComponent,
      typeof ElMetricItem.FsusMetricItem
    >,
    Expected
  >
>
app.component('FsusMetricItem', FsusMetricItem)
app.use(ElMetricItem)

export type DistributionListContract = Check<
  Equal<
    AliasContract<
      typeof ElDistributionList,
      typeof FsusDistributionList,
      FsusDistributionListComponent,
      typeof ElDistributionList.FsusDistributionList
    >,
    Expected
  >
>
app.component('FsusDistributionList', FsusDistributionList)
app.use(ElDistributionList)

export type DistributionBarRowContract = Check<
  Equal<
    AliasContract<
      typeof ElDistributionBarRow,
      typeof FsusDistributionBarRow,
      FsusDistributionBarRowComponent,
      typeof ElDistributionBarRow.FsusDistributionBarRow
    >,
    Expected
  >
>
app.component('FsusDistributionBarRow', FsusDistributionBarRow)
app.use(ElDistributionBarRow)

export type KpiGroupContract = Check<
  Equal<
    AliasContract<
      typeof ElKpiGroup,
      typeof FsusKpiGroup,
      FsusKpiGroupComponent,
      typeof ElKpiGroup.FsusKpiGroup
    >,
    Expected
  >
>
app.component('FsusKpiGroup', FsusKpiGroup)
app.use(ElKpiGroup)

export type KeyValueGridContract = Check<
  Equal<
    AliasContract<
      typeof ElKeyValueGrid,
      typeof FsusKeyValueGrid,
      FsusKeyValueGridComponent,
      typeof ElKeyValueGrid.FsusKeyValueGrid
    >,
    Expected
  >
>
app.component('FsusKeyValueGrid', FsusKeyValueGrid)
app.use(ElKeyValueGrid)

export type KeyValueItemContract = Check<
  Equal<
    AliasContract<
      typeof ElKeyValueItem,
      typeof FsusKeyValueItem,
      FsusKeyValueItemComponent,
      typeof ElKeyValueItem.FsusKeyValueItem
    >,
    Expected
  >
>
app.component('FsusKeyValueItem', FsusKeyValueItem)
app.use(ElKeyValueItem)

export type StatusSummaryContract = Check<
  Equal<
    AliasContract<
      typeof ElStatusSummary,
      typeof FsusStatusSummary,
      FsusStatusSummaryComponent,
      typeof ElStatusSummary.FsusStatusSummary
    >,
    Expected
  >
>
app.component('FsusStatusSummary', FsusStatusSummary)
app.use(ElStatusSummary)

export type DiagnosticsListContract = Check<
  Equal<
    AliasContract<
      typeof ElDiagnosticsList,
      typeof FsusDiagnosticsList,
      FsusDiagnosticsListComponent,
      typeof ElDiagnosticsList.FsusDiagnosticsList
    >,
    Expected
  >
>
app.component('FsusDiagnosticsList', FsusDiagnosticsList)
app.use(ElDiagnosticsList)

export type DiagnosticsItemContract = Check<
  Equal<
    AliasContract<
      typeof ElDiagnosticsItem,
      typeof FsusDiagnosticsItem,
      FsusDiagnosticsItemComponent,
      typeof ElDiagnosticsItem.FsusDiagnosticsItem
    >,
    Expected
  >
>
app.component('FsusDiagnosticsItem', FsusDiagnosticsItem)
app.use(ElDiagnosticsItem)

export type CopyableDetailContract = Check<
  Equal<
    AliasContract<
      typeof ElCopyableDetail,
      typeof FsusCopyableDetail,
      FsusCopyableDetailComponent,
      typeof ElCopyableDetail.FsusCopyableDetail
    >,
    Expected
  >
>
app.component('FsusCopyableDetail', FsusCopyableDetail)
app.use(ElCopyableDetail)

export type SectionNavContract = Check<
  Equal<
    AliasContract<
      typeof ElSectionNav,
      typeof FsusSectionNav,
      FsusSectionNavComponent,
      typeof ElSectionNav.FsusSectionNav
    >,
    Expected
  >
>
app.component('FsusSectionNav', FsusSectionNav)
app.use(ElSectionNav)

export type SectionNavLinkContract = Check<
  Equal<
    AliasContract<
      typeof ElSectionNavLink,
      typeof FsusSectionNavLink,
      FsusSectionNavLinkComponent,
      typeof ElSectionNavLink.FsusSectionNavLink
    >,
    Expected
  >
>
app.component('FsusSectionNavLink', FsusSectionNavLink)
app.use(ElSectionNavLink)

export type SettingsSectionContract = Check<
  Equal<
    AliasContract<
      typeof ElSettingsSection,
      typeof FsusSettingsSection,
      FsusSettingsSectionComponent,
      typeof ElSettingsSection.FsusSettingsSection
    >,
    Expected
  >
>
app.component('FsusSettingsSection', FsusSettingsSection)
app.use(ElSettingsSection)

export type SectionHeaderContract = Check<
  Equal<
    AliasContract<
      typeof ElSectionHeader,
      typeof FsusSectionHeader,
      FsusSectionHeaderComponent,
      typeof ElSectionHeader.FsusSectionHeader
    >,
    Expected
  >
>
app.component('FsusSectionHeader', FsusSectionHeader)
app.use(ElSectionHeader)

export type FormSectionContract = Check<
  Equal<
    AliasContract<
      typeof ElFormSection,
      typeof FsusFormSection,
      FsusFormSectionComponent,
      typeof ElFormSection.FsusFormSection
    >,
    Expected
  >
>
app.component('FsusFormSection', FsusFormSection)
app.use(ElFormSection)

export type ResourceListContract = Check<
  Equal<
    AliasContract<
      typeof ElResourceList,
      typeof FsusResourceList,
      FsusResourceListComponent,
      typeof ElResourceList.FsusResourceList
    >,
    Expected
  >
>
app.component('FsusResourceList', FsusResourceList)
app.use(ElResourceList)

export type ResourceListItemContract = Check<
  Equal<
    AliasContract<
      typeof ElResourceListItem,
      typeof FsusResourceListItem,
      FsusResourceListItemComponent,
      typeof ElResourceListItem.FsusResourceListItem
    >,
    Expected
  >
>
app.component('FsusResourceListItem', FsusResourceListItem)
app.use(ElResourceListItem)

export type MetadataRowContract = Check<
  Equal<
    AliasContract<
      typeof ElMetadataRow,
      typeof FsusMetadataRow,
      FsusMetadataRowComponent,
      typeof ElMetadataRow.FsusMetadataRow
    >,
    Expected
  >
>
app.component('FsusMetadataRow', FsusMetadataRow)
app.use(ElMetadataRow)

export type MetadataItemContract = Check<
  Equal<
    AliasContract<
      typeof ElMetadataItem,
      typeof FsusMetadataItem,
      FsusMetadataItemComponent,
      typeof ElMetadataItem.FsusMetadataItem
    >,
    Expected
  >
>
app.component('FsusMetadataItem', FsusMetadataItem)
app.use(ElMetadataItem)

export type InlineActionsContract = Check<
  Equal<
    AliasContract<
      typeof ElInlineActions,
      typeof FsusInlineActions,
      FsusInlineActionsComponent,
      typeof ElInlineActions.FsusInlineActions
    >,
    Expected
  >
>
app.component('FsusInlineActions', FsusInlineActions)
app.use(ElInlineActions)

export type DangerZoneContract = Check<
  Equal<
    AliasContract<
      typeof ElDangerZone,
      typeof FsusDangerZone,
      FsusDangerZoneComponent,
      typeof ElDangerZone.FsusDangerZone
    >,
    Expected
  >
>
app.component('FsusDangerZone', FsusDangerZone)
app.use(ElDangerZone)

export type DestructiveActionPanelContract = Check<
  Equal<
    AliasContract<
      typeof ElDestructiveActionPanel,
      typeof FsusDestructiveActionPanel,
      FsusDestructiveActionPanelComponent,
      typeof ElDestructiveActionPanel.FsusDestructiveActionPanel
    >,
    Expected
  >
>
app.component('FsusDestructiveActionPanel', FsusDestructiveActionPanel)
app.use(ElDestructiveActionPanel)

export type RiskNoticeContract = Check<
  Equal<
    AliasContract<
      typeof ElRiskNotice,
      typeof FsusRiskNotice,
      FsusRiskNoticeComponent,
      typeof ElRiskNotice.FsusRiskNotice
    >,
    Expected
  >
>
app.component('FsusRiskNotice', FsusRiskNotice)
app.use(ElRiskNotice)

export type TypedConfirmFieldContract = Check<
  Equal<
    AliasContract<
      typeof ElTypedConfirmField,
      typeof FsusTypedConfirmField,
      FsusTypedConfirmFieldComponent,
      typeof ElTypedConfirmField.FsusTypedConfirmField
    >,
    Expected
  >
>
app.component('FsusTypedConfirmField', FsusTypedConfirmField)
app.use(ElTypedConfirmField)

declare const item: InstanceType<typeof FsusConversationListItem>
declare const copy: InstanceType<typeof FsusCopyableDetail>
declare const confirm: InstanceType<typeof FsusTypedConfirmField>
item.$emit('select', new MouseEvent('click'))
copy.$emit('copy', 'value')
confirm.$emit('update:modelValue', 'CONFIRM')
const inboxProps: typeof item.$props = { title: 'Thread', selected: true }
const metricProps: typeof copy.$props = { value: 'detail', disabled: false }
const settingsProps: typeof confirm.$props = {
  phrase: 'CONFIRM',
  modelValue: '',
}
const slots: typeof confirm.$slots = { description: () => [] }
void [inboxProps, metricProps, settingsProps, slots]
// @ts-expect-error select retains its MouseEvent payload
item.$emit('select', 'click')
// @ts-expect-error copy retains its string payload
copy.$emit('copy', 1)
// @ts-expect-error model updates retain their string payload
confirm.$emit('update:modelValue', false)
// @ts-expect-error selected retains its boolean prop
const badInboxProps: typeof item.$props = { selected: 'yes' }
// @ts-expect-error copy value retains its string prop
const badMetricProps: typeof copy.$props = { value: 1 }
// @ts-expect-error phrase remains a required string
const badSettingsProps: typeof confirm.$props = { phrase: false }
// @ts-expect-error slots retain callable values
const badSlots: typeof confirm.$slots = { description: 1 }
// @ts-expect-error aliases do not invent exposed instance APIs
confirm.nonexistentMethod()
// @ts-expect-error aliases retain their original component-only installer contract
app.use(FsusTypedConfirmField)
void [badInboxProps, badMetricProps, badSettingsProps, badSlots]
