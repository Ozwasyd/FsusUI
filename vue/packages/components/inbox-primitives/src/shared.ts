import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, HTMLAttributes } from 'vue'

export const inboxPrimitiveDensities = ['default', 'compact'] as const
export const inboxMobilePanes = ['list', 'detail'] as const
export const messageBubbleVariants = [
  'self',
  'other',
  'system',
  'muted',
] as const
export const threadPanelTitleTags = ['h2', 'h3', 'h4', 'h5', 'h6'] as const

export type InboxPrimitiveDensity = (typeof inboxPrimitiveDensities)[number]
export type InboxMobilePane = (typeof inboxMobilePanes)[number]
export type MessageBubbleVariant = (typeof messageBubbleVariants)[number]
export type ThreadPanelTitleTag = (typeof threadPanelTitleTags)[number]

export const splitPaneProps = buildProps({
  selected: Boolean,
  mobilePane: {
    type: String,
    values: inboxMobilePanes,
    default: 'list',
  },
  listLabel: {
    type: String,
    default: 'List pane',
  },
  detailLabel: {
    type: String,
    default: 'Detail pane',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const inboxLayoutProps = splitPaneProps

export const conversationListProps = buildProps({
  ariaLabel: {
    type: String,
    default: 'Conversation list',
  },
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
    default: 'list',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const conversationListItemProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  preview: {
    type: String,
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  selected: Boolean,
  disabled: Boolean,
  unreadCount: {
    type: Number,
    default: 0,
  },
  unreadLabel: {
    type: String,
    default: 'unread items',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const conversationListItemEmits = {
  select: (payload: MouseEvent) => payload instanceof MouseEvent,
}

export const threadPanelProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  titleTag: {
    type: String,
    values: threadPanelTitleTags,
    default: 'h3',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const messageTimelineProps = buildProps({
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
    default: 'list',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const messageBubbleProps = buildProps({
  variant: {
    type: String,
    values: messageBubbleVariants,
    default: 'other',
  },
  author: {
    type: String,
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const conversationContextBarProps = buildProps({
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const replyComposerShellProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  disabled: Boolean,
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const emptySelectionStateProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  density: {
    type: String,
    values: inboxPrimitiveDensities,
    default: 'default',
  },
} as const)

export const inboxEmptyStateProps = emptySelectionStateProps

export type SplitPaneProps = ExtractPropTypes<typeof splitPaneProps>
export type InboxLayoutProps = ExtractPropTypes<typeof inboxLayoutProps>
export type ConversationListProps = ExtractPropTypes<
  typeof conversationListProps
>
export type ConversationListItemProps = ExtractPropTypes<
  typeof conversationListItemProps
>
export type ThreadPanelProps = ExtractPropTypes<typeof threadPanelProps>
export type MessageTimelineProps = ExtractPropTypes<typeof messageTimelineProps>
export type MessageBubbleProps = ExtractPropTypes<typeof messageBubbleProps>
export type ConversationContextBarProps = ExtractPropTypes<
  typeof conversationContextBarProps
>
export type ReplyComposerShellProps = ExtractPropTypes<
  typeof replyComposerShellProps
>
export type EmptySelectionStateProps = ExtractPropTypes<
  typeof emptySelectionStateProps
>
export type InboxEmptyStateProps = ExtractPropTypes<typeof inboxEmptyStateProps>
