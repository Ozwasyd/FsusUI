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

export type FsusSplitPaneComponent = typeof SplitPane & { name: string }
export type FsusInboxLayoutComponent = typeof InboxLayout & { name: string }
export type FsusConversationListComponent = typeof ConversationList & {
  name: string
}
export type FsusConversationListItemComponent = typeof ConversationListItem & {
  name: string
}
export type FsusThreadPanelComponent = typeof ThreadPanel & { name: string }
export type FsusMessageTimelineComponent = typeof MessageTimeline & {
  name: string
}
export type FsusMessageBubbleComponent = typeof MessageBubble & { name: string }
export type FsusConversationContextBarComponent =
  typeof ConversationContextBar & { name: string }
export type FsusReplyComposerShellComponent = typeof ReplyComposerShell & {
  name: string
}
export type FsusEmptySelectionStateComponent = typeof EmptySelectionState & {
  name: string
}
export type FsusInboxEmptyStateComponent = typeof InboxEmptyState & {
  name: string
}

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})

export const ElSplitPane = withInstall<
  typeof SplitPane,
  { FsusSplitPane: FsusSplitPaneComponent }
>(SplitPane, {
  FsusSplitPane: withFsusAlias(SplitPane, 'FsusSplitPane'),
})
export const FsusSplitPane = ElSplitPane.FsusSplitPane

export const ElInboxLayout = withInstall<
  typeof InboxLayout,
  { FsusInboxLayout: FsusInboxLayoutComponent }
>(InboxLayout, {
  FsusInboxLayout: withFsusAlias(InboxLayout, 'FsusInboxLayout'),
})
export const FsusInboxLayout = ElInboxLayout.FsusInboxLayout

export const ElConversationList = withInstall<
  typeof ConversationList,
  { FsusConversationList: FsusConversationListComponent }
>(ConversationList, {
  FsusConversationList: withFsusAlias(ConversationList, 'FsusConversationList'),
})
export const FsusConversationList = ElConversationList.FsusConversationList

export const ElConversationListItem = withInstall<
  typeof ConversationListItem,
  { FsusConversationListItem: FsusConversationListItemComponent }
>(ConversationListItem, {
  FsusConversationListItem: withFsusAlias(
    ConversationListItem,
    'FsusConversationListItem',
  ),
})
export const FsusConversationListItem =
  ElConversationListItem.FsusConversationListItem

export const ElThreadPanel = withInstall<
  typeof ThreadPanel,
  { FsusThreadPanel: FsusThreadPanelComponent }
>(ThreadPanel, {
  FsusThreadPanel: withFsusAlias(ThreadPanel, 'FsusThreadPanel'),
})
export const FsusThreadPanel = ElThreadPanel.FsusThreadPanel

export const ElMessageTimeline = withInstall<
  typeof MessageTimeline,
  { FsusMessageTimeline: FsusMessageTimelineComponent }
>(MessageTimeline, {
  FsusMessageTimeline: withFsusAlias(MessageTimeline, 'FsusMessageTimeline'),
})
export const FsusMessageTimeline = ElMessageTimeline.FsusMessageTimeline

export const ElMessageBubble = withInstall<
  typeof MessageBubble,
  { FsusMessageBubble: FsusMessageBubbleComponent }
>(MessageBubble, {
  FsusMessageBubble: withFsusAlias(MessageBubble, 'FsusMessageBubble'),
})
export const FsusMessageBubble = ElMessageBubble.FsusMessageBubble

export const ElConversationContextBar = withInstall<
  typeof ConversationContextBar,
  { FsusConversationContextBar: FsusConversationContextBarComponent }
>(ConversationContextBar, {
  FsusConversationContextBar: withFsusAlias(
    ConversationContextBar,
    'FsusConversationContextBar',
  ),
})
export const FsusConversationContextBar =
  ElConversationContextBar.FsusConversationContextBar

export const ElReplyComposerShell = withInstall<
  typeof ReplyComposerShell,
  { FsusReplyComposerShell: FsusReplyComposerShellComponent }
>(ReplyComposerShell, {
  FsusReplyComposerShell: withFsusAlias(
    ReplyComposerShell,
    'FsusReplyComposerShell',
  ),
})
export const FsusReplyComposerShell =
  ElReplyComposerShell.FsusReplyComposerShell

export const ElEmptySelectionState = withInstall<
  typeof EmptySelectionState,
  { FsusEmptySelectionState: FsusEmptySelectionStateComponent }
>(EmptySelectionState, {
  FsusEmptySelectionState: withFsusAlias(
    EmptySelectionState,
    'FsusEmptySelectionState',
  ),
})
export const FsusEmptySelectionState =
  ElEmptySelectionState.FsusEmptySelectionState

export const ElInboxEmptyState = withInstall<
  typeof InboxEmptyState,
  { FsusInboxEmptyState: FsusInboxEmptyStateComponent }
>(InboxEmptyState, {
  FsusInboxEmptyState: withFsusAlias(InboxEmptyState, 'FsusInboxEmptyState'),
})
export const FsusInboxEmptyState = ElInboxEmptyState.FsusInboxEmptyState

export default ElInboxLayout

export * from './src/shared'
export type * from './src/instance'
