import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import {
  ElConversationContextBar,
  ElConversationList,
  ElConversationListItem,
  ElEmptySelectionState,
  ElInboxEmptyState,
  ElInboxLayout,
  ElMessageBubble,
  ElMessageTimeline,
  ElReplyComposerShell,
  ElSplitPane,
  ElThreadPanel,
  FsusInboxLayout,
} from '..'

describe('inbox primitives', () => {
  test('renders split and inbox panes with accessible labels and mobile state', () => {
    const wrapper = mount(() => (
      <div>
        <ElSplitPane
          selected
          mobilePane="detail"
          listLabel="Items"
          detailLabel="Details"
        >
          {{
            list: () => <span>List content</span>,
            detail: () => <span>Detail content</span>,
          }}
        </ElSplitPane>
        <ElInboxLayout mobilePane="list" density="compact">
          {{
            list: () => <span>Inbox list</span>,
            detail: () => <span>Inbox detail</span>,
          }}
        </ElInboxLayout>
      </div>
    ))

    expect(wrapper.find('.el-split-pane').classes()).toContain(
      'el-split-pane--mobile-detail',
    )
    expect(wrapper.find('.el-split-pane').classes()).toContain('is-selected')
    expect(wrapper.find('.el-split-pane__list').attributes('aria-label')).toBe(
      'Items',
    )
    expect(
      wrapper.find('.el-split-pane__detail').attributes('aria-label'),
    ).toBe('Details')
    expect(wrapper.find('.el-inbox-layout').classes()).toContain(
      'el-inbox-layout--compact',
    )
    expect(FsusInboxLayout.name).toBe('FsusInboxLayout')
  })

  test('renders selectable conversation items with current state and unread label', async () => {
    const handleSelect = vi.fn()
    const wrapper = mount(() => (
      <ElConversationList ariaLabel="Work queue">
        <ElConversationListItem
          title="Item alpha"
          preview="A generic preview"
          meta="09:00"
          selected
          unreadCount={3}
          unreadLabel="pending updates"
          onSelect={handleSelect}
        >
          {{
            badges: () => <span class="badge-slot">Badge</span>,
          }}
        </ElConversationListItem>
        <ElConversationListItem title="Disabled item" disabled />
      </ElConversationList>
    ))

    expect(wrapper.find('.el-conversation-list').attributes()).toMatchObject({
      role: 'list',
      'aria-label': 'Work queue',
    })
    expect(wrapper.find('.el-conversation-list-item').attributes('role')).toBe(
      'listitem',
    )
    expect(
      wrapper
        .find('.el-conversation-list-item__button')
        .attributes('aria-current'),
    ).toBe('true')
    expect(
      wrapper.find('.el-conversation-list-item__unread').attributes(),
    ).toMatchObject({
      'aria-label': '3 pending updates',
    })
    expect(wrapper.find('.badge-slot').text()).toBe('Badge')

    await wrapper.find('.el-conversation-list-item__button').trigger('click')

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(
      wrapper
        .findAll('.el-conversation-list-item__button')[1]
        .attributes('disabled'),
    ).toBeDefined()
  })

  test('renders thread panel slots with a labelled heading and scroll region', () => {
    const wrapper = mount(() => (
      <ElThreadPanel title="Thread alpha" titleTag="h2">
        {{
          back: () => <button type="button">Back</button>,
          status: () => <span>Generic state</span>,
          actions: () => <button type="button">Action</button>,
          context: () => <div>Context</div>,
          messages: () => <div class="message-region">Messages</div>,
          composer: () => <form>Composer</form>,
        }}
      </ElThreadPanel>
    ))

    const title = wrapper.find('.el-thread-panel__title')
    expect(title.element.tagName).toBe('H2')
    expect(wrapper.find('.el-thread-panel').attributes('aria-labelledby')).toBe(
      title.attributes('id'),
    )
    expect(wrapper.find('.el-thread-panel__back button').text()).toBe('Back')
    expect(wrapper.find('.el-thread-panel__context').text()).toBe('Context')
    expect(
      wrapper.find('.el-thread-panel__messages .message-region').text(),
    ).toBe('Messages')
  })

  test('renders message timeline and copy-agnostic bubble variants', () => {
    const wrapper = mount(() => (
      <ElMessageTimeline>
        <ElMessageBubble variant="self" author="Author" meta="10:00">
          Line one{'\n'}Line two
        </ElMessageBubble>
        <ElMessageBubble variant="system">
          {{
            body: () => <span>System-neutral event</span>,
          }}
        </ElMessageBubble>
      </ElMessageTimeline>
    ))

    expect(wrapper.find('.el-message-timeline').attributes('role')).toBe('list')
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(2)
    expect(wrapper.find('.el-message-bubble--self').text()).toContain('Author')
    expect(wrapper.find('.el-message-bubble--system').text()).toBe(
      'System-neutral event',
    )
  })

  test('renders context bar, composer shell, and empty states without business copy', () => {
    const wrapper = mount(() => (
      <div>
        <ElConversationContextBar>
          <span>Status: Generic</span>
          <span>Source: Neutral</span>
        </ElConversationContextBar>
        <ElReplyComposerShell title="Reply" disabled>
          {{
            input: () => <textarea aria-label="Reply body" />,
            actions: () => <button type="submit">Send</button>,
          }}
        </ElReplyComposerShell>
        <ElEmptySelectionState
          title="Select an item"
          description="Choose one item to view details."
        />
        <ElInboxEmptyState
          title="No items"
          description="Adjust filters and try again."
        />
      </div>
    ))

    expect(wrapper.find('.el-conversation-context-bar').text()).toContain(
      'Status: Generic',
    )
    expect(wrapper.find('.el-reply-composer-shell').classes()).toContain(
      'is-disabled',
    )
    expect(
      wrapper.find('.el-reply-composer-shell').attributes('aria-disabled'),
    ).toBe('true')
    expect(
      wrapper.find('.el-empty-selection-state').attributes(),
    ).toMatchObject({
      role: 'status',
      'aria-live': 'polite',
    })
    expect(wrapper.find('.el-inbox-empty-state__title').text()).toBe('No items')
  })

  test('disabled composer keeps readable title and reason copy without shell opacity', () => {
    const wrapper = mount(() => (
      <ElReplyComposerShell title="Reply" disabled>
        {{
          input: () => (
            <>
              <p class="permission-reason">
                You do not have permission to reply to this conversation.
              </p>
              <textarea aria-label="Reply body" disabled />
            </>
          ),
          actions: () => (
            <button type="submit" disabled>
              Send
            </button>
          ),
        }}
      </ElReplyComposerShell>
    ))

    const shell = wrapper.find('.el-reply-composer-shell')
    expect(shell.classes()).toContain('is-disabled')
    expect(shell.attributes('aria-disabled')).toBe('true')
    // Shell layout only — no inline opacity fade; CSS contract forbids ancestor
    // opacity (see fsus-theme + CSR ancestor-opacity mutation).
    expect(shell.attributes('style') ?? '').not.toMatch(/opacity/i)
    expect(wrapper.find('.el-reply-composer-shell__title').text()).toBe('Reply')
    expect(wrapper.find('.permission-reason').text()).toContain(
      'permission to reply',
    )
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
