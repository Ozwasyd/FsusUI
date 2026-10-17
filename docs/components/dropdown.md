# Dropdown

Groups actions or menus inside a dropdown.

> See the [Playground](../playground.md) for runnable component examples.

---

## Basic Usage

Put the trigger in the default slot and menu content in `#dropdown` (using `el-dropdown-menu`).

```vue
<el-dropdown>
  <span>下拉菜单<el-icon><arrow-down /></el-icon></span>
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item command="a">操作一</el-dropdown-item>
      <el-dropdown-item command="b">操作二</el-dropdown-item>
      <el-dropdown-item command="c" divided>操作三（带分隔线）</el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

## Triggering

Set `trigger` to `hover` (default), `click`, or `contextmenu`.

## Split Button

Set `split-button` to turn the trigger into a two-part button group.

## Directive Triggering

Use `handleOpen` / `handleClose` to control menu visibility manually.

## Consumer-owned Single Selection

Set `checked` on every selectable `DropdownItem` under a `role="menu"`
Dropdown. Defined boolean values render `menuitemradio` with `aria-checked`;
omitting `checked` preserves the ordinary `menuitem` command contract. The
consumer supplies exactly one committed checked item in each selection group.
Activation emits `command`; it never mutates `checked` itself.

Use `hide-on-click="false"` for an asynchronous transaction. Keep `checked`
bound to the last committed value while showing pending progress or a visible
error/retry item in the menu. Update that value only after success, and close
through the public `handleClose` method when the consumer decides the
transaction is settled. Failed, interrupted, and superseded transactions remain
consumer-owned. FsusUI does not store preferences, choose locale values, or
perform resource requests.

```vue
<el-dropdown ref="dropdown" trigger="click" :hide-on-click="false">
  <el-button>{{ committedLabel }}</el-button>
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item
        v-for="item in items"
        :key="item.id"
        :command="item"
        :checked="item.id === committedId"
        :disabled="item.disabled"
      >
        {{ item.label }}
        <span v-if="pendingId === item.id">{{ pendingLabel }}</span>
      </el-dropdown-item>
      <el-dropdown-item v-if="error" command="retry">
        <span role="alert">{{ error }}</span>
        {{ retryLabel }}
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

Enter, Space, ArrowDown, and ArrowUp open a click-triggered dropdown. The
existing roving focus model prefers a focusable checked item on keyboard
entry, handles ArrowUp/Down/Home/End, skips disabled items, and restores focus
to the trigger on Escape. A custom trigger, including compact content, remains
in the default slot; public `visible-change` and `handleOpen` / `handleClose`
provide an observable visibility contract. Changing `checked` does not move
focus away from a user who is navigating pending or retry content.

Trigger focus is restored only when Escape actually dismisses that dropdown.
An item that cancels Escape with `@keydown.esc.stop.prevent` keeps the popup
open; a later outside-button dismissal preserves the outside button's focus.
An Escape handled by a nested dropdown does not close its parent.

Forced-colors mode preserves the trigger and item inset keyboard focus rings when the browser
suppresses box shadows. The ring uses the existing focus tokens and lets the
browser map its border color to the user's contrast palette; it does not change
row geometry or require a consumer style override. The popup and arrow use an
opaque system Canvas surface in forced-colors mode so background content cannot
show through the overlay token's alpha. Ordinary light/dark overlay tokens and
automatic browser color adjustment remain unchanged.

## URL and Command Activation Adapter

The `command` event receives `(command, instance, event)`. Use a public
consumer adapter to distinguish navigation records from async commands; do
not query component-private DOM or add another keyboard handler. For example:

```ts
function activate(item, _instance, event) {
  if (item.href) {
    window.location.assign(item.href)
    return
  }
  void requestResource(item.id)
}
```

The adapter owns URL and transaction semantics. A nested anchor alone is not
a keyboard activation adapter: Enter/Space on the menu item activate its
public command rather than dispatching the nested anchor's native click.
Choose and test one coherent URL/command adapter for the consumer.
Keyboard activation intentionally prevents the browser's original key default
before emitting `command`; its event can therefore have `defaultPrevented=true`
while still representing a valid command. Do not discard a public keyboard
command solely because that flag is set.

---

## Dropdown API

### Dropdown Attributes

| 属性名        | 说明                                      | 类型                                                                              | 默认值   |
| ------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| type          | 按钮类型（`split-button` 为 true 时有效） | `'default' \| 'primary' \| 'success' \| 'warning' \| 'info' \| 'danger'`          | `''`     |
| size          | 菜单大小                                  | `'large' \| 'default' \| 'small'`                                                 | `''`     |
| split-button  | 是否使用分裂按钮                          | `boolean`                                                                         | `false`  |
| disabled      | 是否禁用                                  | `boolean`                                                                         | `false`  |
| placement     | 弹出位置                                  | `'top' \| 'top-start' \| 'top-end' \| 'bottom' \| 'bottom-start' \| 'bottom-end'` | `bottom` |
| trigger       | 触发方式                                  | `'click' \| 'hover' \| 'contextmenu'`                                             | `hover`  |
| hide-on-click | 点击菜单项后是否关闭菜单                  | `boolean`                                                                         | `true`   |
| show-timeout  | 显示延迟（ms，`hover` 模式有效）          | `number`                                                                          | `150`    |
| hide-timeout  | 隐藏延迟（ms，`hover` 模式有效）          | `number`                                                                          | `150`    |
| max-height    | 菜单最大高度                              | `string \| number`                                                                | `''`     |
| popper-class  | 自定义弹出层 class                        | `string \| object`                                                                | `''`     |
| teleported    | 是否挂载到 body                           | `boolean`                                                                         | `true`   |
| persistent    | 非激活时是否保留 DOM                      | `boolean`                                                                         | `true`   |

### Dropdown Events

| 事件名         | 说明                                          | 回调参数                   |
| -------------- | --------------------------------------------- | -------------------------- |
| click          | `split-button` 为 true 时，点击左侧按钮触发   | `(e: MouseEvent) => void`  |
| command        | 点击菜单项时触发，参数为菜单项的 `command` 值 | `(...args: any[]) => void` |
| visible-change | 菜单显示/隐藏变化时触发                       | `(val: boolean) => void`   |

### Dropdown Slots

| 插槽名   | 说明                                     | 子组件         |
| -------- | ---------------------------------------- | -------------- |
| default  | 触发元素（有效 HTML 元素或 FsusUI 组件） | —              |
| dropdown | 下拉菜单内容                             | `DropdownMenu` |

### Dropdown Exposes

| 名称        | 说明         | 类型         |
| ----------- | ------------ | ------------ |
| handleOpen  | 打开下拉菜单 | `() => void` |
| handleClose | 关闭下拉菜单 | `() => void` |

---

## Dropdown-Menu API

### Dropdown-Menu Slots

| 插槽名  | 说明       | 子组件         |
| ------- | ---------- | -------------- |
| default | 菜单项列表 | `DropdownItem` |

---

## Dropdown-Item API

### Dropdown-Item Attributes

| 属性名   | 说明                                                                                              | 类型                         | 默认值      |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------- | ----------- |
| command  | 点击时传递给 `command` 事件的值                                                                   | `string \| number \| object` | —           |
| disabled | 是否禁用                                                                                          | `boolean`                    | `false`     |
| divided  | 是否显示上方分割线                                                                                | `boolean`                    | `false`     |
| icon     | 自定义图标                                                                                        | `string \| Component`        | —           |
| checked  | Consumer-controlled single-selection state under a menu parent; omit for an ordinary command item | `boolean \| undefined`       | `undefined` |

### Explicit multiline content and viewport bounds

`DropdownItem` accepts `multiline` (Boolean, default `false`). Opting in gives its
primary default slot and optional `description` slot a natural block height with
the existing option-height token as a minimum. Both lines wrap; font sizes remain
canonical, and disabled, checked, hover and focus states retain the flat row
surface. The optional `suffix` slot reserves space for consumer-owned status
content without placing a second focus target in the row. Descriptions are read
with the item; decorative suffix icons should be `aria-hidden`. Supplying a
`description` without `multiline` does not change ordinary command-row geometry.

```vue
<el-dropdown trigger="click" viewport-bounded :hide-on-click="false">
  <el-button>Language</el-button>
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item multiline :checked="true" text-value="日本語" command="ja">
        日本語
        <template #description>Japanese</template>
        <template #suffix><span aria-hidden="true">✓</span></template>
      </el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

`Dropdown.viewportBounded` (Boolean, default `false`) explicitly constrains the
panel width and scrollable height to the visual viewport. Its unset `maxHeight`
uses the documented menu maximum; an explicit maximum remains an upper bound.
For a body-teleported panel under root CSS `zoom`, a modifier adapter presents
consistent client coordinates to the existing Popper engine, then converts style
and arrow output to CSS coordinates. It keeps the enlarged text and delegates
placement, flipping, tethering and lifecycle listeners to Popper. Positioned
custom append contexts keep the existing engine's scale handling; nested or
independently zoomed append contexts are not qualified by this root-zoom contract.
The internal measured CSS properties are not theme tokens or consumer overrides.
Browser page zoom and assistive technology still require separate qualification.
