import type ConversationContextBar from './conversation-context-bar.vue'
import type ConversationList from './conversation-list.vue'
import type ConversationListItem from './conversation-list-item.vue'
import type EmptySelectionState from './empty-selection-state.vue'
import type InboxEmptyState from './inbox-empty-state.vue'
import type InboxLayout from './inbox-layout.vue'
import type MessageBubble from './message-bubble.vue'
import type MessageTimeline from './message-timeline.vue'
import type ReplyComposerShell from './reply-composer-shell.vue'
import type SplitPane from './split-pane.vue'
import type ThreadPanel from './thread-panel.vue'

export type SplitPaneInstance = InstanceType<typeof SplitPane>
export type InboxLayoutInstance = InstanceType<typeof InboxLayout>
export type ConversationListInstance = InstanceType<typeof ConversationList>
export type ConversationListItemInstance = InstanceType<
  typeof ConversationListItem
>
export type ThreadPanelInstance = InstanceType<typeof ThreadPanel>
export type MessageTimelineInstance = InstanceType<typeof MessageTimeline>
export type MessageBubbleInstance = InstanceType<typeof MessageBubble>
export type ConversationContextBarInstance = InstanceType<
  typeof ConversationContextBar
>
export type ReplyComposerShellInstance = InstanceType<typeof ReplyComposerShell>
export type EmptySelectionStateInstance = InstanceType<
  typeof EmptySelectionState
>
export type InboxEmptyStateInstance = InstanceType<typeof InboxEmptyState>
