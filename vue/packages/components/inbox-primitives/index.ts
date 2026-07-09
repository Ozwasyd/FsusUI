import { withInstall } from '@element-plus/utils'

import ConversationContextBar from './src/conversation-context-bar.vue'
import ConversationList from './src/conversation-list.vue'
import ConversationListItem from './src/conversation-list-item.vue'
import EmptySelectionState from './src/empty-selection-state.vue'
import InboxEmptyState from './src/inbox-empty-state.vue'
import InboxLayout from './src/inbox-layout.vue'
import MessageBubble from './src/message-bubble.vue'
import MessageTimeline from './src/message-timeline.vue'
import ReplyComposerShell from './src/reply-composer-shell.vue'
import SplitPane from './src/split-pane.vue'
import ThreadPanel from './src/thread-panel.vue'

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})

export const ElSplitPane = withInstall(SplitPane, {
  FsusSplitPane: withFsusAlias(SplitPane, 'FsusSplitPane'),
})
export const FsusSplitPane = ElSplitPane.FsusSplitPane

export const ElInboxLayout = withInstall(InboxLayout, {
  FsusInboxLayout: withFsusAlias(InboxLayout, 'FsusInboxLayout'),
})
export const FsusInboxLayout = ElInboxLayout.FsusInboxLayout

export const ElConversationList = withInstall(ConversationList, {
  FsusConversationList: withFsusAlias(ConversationList, 'FsusConversationList'),
})
export const FsusConversationList = ElConversationList.FsusConversationList

export const ElConversationListItem = withInstall(ConversationListItem, {
  FsusConversationListItem: withFsusAlias(
    ConversationListItem,
    'FsusConversationListItem',
  ),
})
export const FsusConversationListItem =
  ElConversationListItem.FsusConversationListItem

export const ElThreadPanel = withInstall(ThreadPanel, {
  FsusThreadPanel: withFsusAlias(ThreadPanel, 'FsusThreadPanel'),
})
export const FsusThreadPanel = ElThreadPanel.FsusThreadPanel

export const ElMessageTimeline = withInstall(MessageTimeline, {
  FsusMessageTimeline: withFsusAlias(MessageTimeline, 'FsusMessageTimeline'),
})
export const FsusMessageTimeline = ElMessageTimeline.FsusMessageTimeline

export const ElMessageBubble = withInstall(MessageBubble, {
  FsusMessageBubble: withFsusAlias(MessageBubble, 'FsusMessageBubble'),
})
export const FsusMessageBubble = ElMessageBubble.FsusMessageBubble

export const ElConversationContextBar = withInstall(ConversationContextBar, {
  FsusConversationContextBar: withFsusAlias(
    ConversationContextBar,
    'FsusConversationContextBar',
  ),
})
export const FsusConversationContextBar =
  ElConversationContextBar.FsusConversationContextBar

export const ElReplyComposerShell = withInstall(ReplyComposerShell, {
  FsusReplyComposerShell: withFsusAlias(
    ReplyComposerShell,
    'FsusReplyComposerShell',
  ),
})
export const FsusReplyComposerShell =
  ElReplyComposerShell.FsusReplyComposerShell

export const ElEmptySelectionState = withInstall(EmptySelectionState, {
  FsusEmptySelectionState: withFsusAlias(
    EmptySelectionState,
    'FsusEmptySelectionState',
  ),
})
export const FsusEmptySelectionState =
  ElEmptySelectionState.FsusEmptySelectionState

export const ElInboxEmptyState = withInstall(InboxEmptyState, {
  FsusInboxEmptyState: withFsusAlias(InboxEmptyState, 'FsusInboxEmptyState'),
})
export const FsusInboxEmptyState = ElInboxEmptyState.FsusInboxEmptyState

export default ElInboxLayout

export * from './src/shared'
export type * from './src/instance'
