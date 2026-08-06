# Inbox Primitives

FsusUI provides generic inbox/thread primitives only. Downstream apps own business copy, status labels, APIs, routing, and permissions.

These primitives cover the reusable display grammar for list/detail, inbox, ticket, notification, support, and conversation-thread layouts without centralizing product logic.

## Basic Layout

```vue
<FsusInboxLayout :selected="Boolean(selectedId)" mobile-pane="detail">
  <template #list>
    <FsusConversationList aria-label="Conversation list">
      <FsusConversationListItem
        title="Item Alpha"
        preview="Neutral preview copy."
        meta="09:00"
        :selected="selectedId === 'alpha'"
        :unread-count="2"
      >
        <template #badges>
          <ElTag size="small" type="info">Ready</ElTag>
        </template>
      </FsusConversationListItem>
    </FsusConversationList>
  </template>

  <template #detail>
    <FsusThreadPanel title="Thread Alpha">
      <template #context>
        <FsusConversationContextBar>
          <span>Kind: Generic</span>
          <span>Source: Neutral</span>
        </FsusConversationContextBar>
      </template>

      <template #messages>
        <FsusMessageTimeline>
          <FsusMessageBubble author="A" meta="09:00">
            Message body with preserved line breaks.
          </FsusMessageBubble>
          <FsusMessageBubble variant="self" author="B" meta="09:10">
            Slot-first reply body.
          </FsusMessageBubble>
          <FsusMessageBubble variant="system">
            Generic state changed.
          </FsusMessageBubble>
        </FsusMessageTimeline>
      </template>

      <template #composer>
        <FsusReplyComposerShell title="Reply">
          <template #input>
            <ElInput type="textarea" aria-label="Reply body" />
          </template>
          <template #actions>
            <ElButton type="primary">Send</ElButton>
          </template>
        </FsusReplyComposerShell>
      </template>
    </FsusThreadPanel>
  </template>
</FsusInboxLayout>
```

## Mobile Pane Switching

Use `mobile-pane="list"` to show the list pane on narrow screens and `mobile-pane="detail"` to show the detail pane. FsusUI controls only visibility and layout. Downstream apps should provide the back action slot and decide when focus moves after a selection.

```vue
<FsusInboxLayout :selected="selected" :mobile-pane="mobilePane">
  <template #list>...</template>
  <template #detail>
    <FsusThreadPanel title="Thread">
      <template #back>
        <ElButton text @click="mobilePane = 'list'">Back</ElButton>
      </template>
    </FsusThreadPanel>
  </template>
</FsusInboxLayout>
```

## Empty States

Use `FsusInboxEmptyState` inside the list pane and `FsusEmptySelectionState` inside the detail pane. These are flat inline states; they do not render page-like illustration cards inside split panes.

```vue
<FsusInboxEmptyState
  title="No items"
  description="Adjust filters or broaden the current view."
/>

<FsusEmptySelectionState
  title="Select an item"
  description="Choose one item from the list to view details."
/>
```

## Message Variants

`FsusMessageBubble` supports generic `other`, `self`, `system`, and `muted` variants. It does not provide sender labels, business roles, or submit copy. Body content uses `white-space: pre-wrap` and wraps long text with `overflow-wrap: anywhere`.

## Context Bar

`FsusConversationContextBar` is a compact metadata row. It supports status badges or metadata items supplied by the caller and wraps on mobile.

## Reply Composer

`FsusReplyComposerShell` is form-compatible layout only. Consumers provide labels, controls, validation, disabled behavior, and action copy. Keep the input label associated with the actual input control.

When `disabled` is set, the shell root keeps full opacity and only marks the surface with `is-disabled` / `aria-disabled`. Do not rely on fading the whole composer: put standard disabled fill, text, and border on the real input and action controls, and keep titles, helpers, and permission-reason copy on readable text roles. FsusUI does not invent lock icons, banners, or helper copy for permission denial.

## Scroll Ownership

- `FsusInboxLayout` and `FsusSplitPane` own the outer list/detail pane overflow.
- `FsusThreadPanel__messages` owns message-region overflow.
- Avoid wrapping panes in another native overflow container unless the surrounding page has a clear height contract.
- Avoid placing a custom scrollbar around another custom scrollbar. Prefer a single scroll owner per pane.
- These primitives use native overflow surfaces and cooperate with FsusUI pointer/touch scrollbar behavior.
- On mobile, only the active pane is displayed, so each pane keeps its own scroll position instead of nesting hidden scroll regions.

## Accessibility Notes

- `FsusConversationList` has an accessible label.
- `FsusConversationListItem` renders a listitem wrapper with a keyboard-reachable button and exposes selected/current state with `aria-current`.
- `FsusThreadPanel` links its visible title to the panel with `aria-labelledby`.
- Empty selection and empty list states use polite status regions.
- `FsusMessageTimeline` preserves DOM reading order.
- `FsusReplyComposerShell` leaves form labels to the consumer so labels remain associated with the real controls.
- Reduced motion should not add pane transitions by default.

## Conformance Guidance

Downstream pages should avoid hand-rolling repeated inbox CSS such as `mail-layout`, `mail-pane`, `mail-item-stack`, `mail-item`, `mail-bubble`, `mail-context-bar`, `mail-reply-form`, `mail-compose-panel`, and `mail-scrollbar-native`. Use the primitives for reusable layout and keep business behavior in the app.
