<template>
  <div
    class="audit-page"
    :class="{ 'is-compact': compact, 'is-boundary': boundary }"
  >
    <header class="audit-page__header">
      <h1>{{ auditTitle }}</h1>
      <p>{{ auditComponentNames.length }} components · {{ auditState }}</p>
    </header>

    <div class="audit-grid">
      <AuditCard name="FixedSizeList" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--list">
          <fixed-size-list
            :item-size="44"
            :total="12"
            :width="260"
            :height="176"
          >
            <template #default="{ index, style }">
              <div :style="style" class="audit-virtual-row">
                Fixed row {{ index }}
              </div>
            </template>
          </fixed-size-list>
        </div>
      </AuditCard>

      <AuditCard name="DynamicSizeList" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--list">
          <dynamic-size-list
            :estimated-item-size="44"
            :item-size="() => 44"
            :total="12"
            :width="260"
            :height="176"
          >
            <template #default="{ index, style }">
              <div :style="style" class="audit-virtual-row">
                Dynamic row {{ index }}
              </div>
            </template>
          </dynamic-size-list>
        </div>
      </AuditCard>

      <AuditCard name="FixedSizeGrid" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--grid">
          <fixed-size-grid
            :column-width="88"
            :row-height="44"
            :total-column="8"
            :total-row="8"
            :width="264"
            :height="176"
          >
            <template #default="{ columnIndex, rowIndex, style }">
              <div :style="style" class="audit-virtual-row">
                {{ rowIndex }},{{ columnIndex }}
              </div>
            </template>
          </fixed-size-grid>
        </div>
      </AuditCard>

      <AuditCard name="DynamicSizeGrid" :state="auditState">
        <div class="audit-virtual-frame audit-virtual-frame--grid">
          <dynamic-size-grid
            :column-width="() => 88"
            :row-height="() => 44"
            :estimated-column-width="88"
            :estimated-row-height="44"
            :total-column="8"
            :total-row="8"
            :width="264"
            :height="176"
          >
            <template #default="{ columnIndex, rowIndex, style }">
              <div :style="style" class="audit-virtual-row">
                {{ rowIndex }},{{ columnIndex }}
              </div>
            </template>
          </dynamic-size-grid>
        </div>
      </AuditCard>

      <AuditCard name="ElVisuallyHidden" :state="auditState">
        <el-visually-hidden>Hidden audit text</el-visually-hidden>
        <span class="audit-inline-note">Visible companion text</span>
      </AuditCard>

      <AuditCard name="ElAffix" :state="auditState">
        <el-affix :offset="8" target=".audit-page">
          <el-button data-audit-focus data-audit-target>Affix action</el-button>
        </el-affix>
      </AuditCard>

      <AuditCard name="ElAlert" :state="auditState">
        <el-alert title="Focused feedback" type="info" show-icon />
      </AuditCard>

      <AuditCard name="ElAside" :state="auditState">
        <el-container class="audit-container">
          <el-aside width="96px">Aside</el-aside>
          <el-main>Main</el-main>
        </el-container>
      </AuditCard>

      <AuditCard name="ElAutocomplete" :state="auditState">
        <el-autocomplete
          :model-value="activeText"
          :fetch-suggestions="querySearch"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElAvatar" :state="auditState">
        <el-space wrap>
          <el-avatar :src="imageData" />
          <el-avatar shape="square">UI</el-avatar>
        </el-space>
      </AuditCard>

      <AuditCard name="ElBacktop" :state="auditState">
        <div class="audit-scroll-shell">
          <div class="audit-scroll-content">Scroll shell</div>
          <el-backtop :right="16" :bottom="16" :visibility-height="0" />
        </div>
      </AuditCard>

      <AuditCard name="ElBadge" :state="auditState">
        <el-badge :value="active ? 24 : 8">
          <el-button data-audit-focus data-audit-target>Inbox</el-button>
        </el-badge>
      </AuditCard>

      <AuditCard name="ElBreadcrumb" :state="auditState">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>Home</el-breadcrumb-item>
          <el-breadcrumb-item>Library</el-breadcrumb-item>
        </el-breadcrumb>
      </AuditCard>

      <AuditCard name="ElBreadcrumbItem" :state="auditState">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">
            Current item
          </el-breadcrumb-item>
        </el-breadcrumb>
      </AuditCard>

      <AuditCard name="ElButton" :state="auditState">
        <el-button
          :type="active ? 'primary' : undefined"
          data-audit-focus
          data-audit-target
        >
          Button
        </el-button>
      </AuditCard>

      <AuditCard name="ElButtonGroup" :state="auditState">
        <el-button-group>
          <el-button :type="active ? 'primary' : undefined" :icon="ArrowLeft">
            Prev
          </el-button>
          <el-button type="primary">
            Next
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </el-button-group>
      </AuditCard>

      <AuditCard name="ElCalendar" :state="auditState">
        <div class="audit-calendar-frame">
          <el-calendar :model-value="dateValue" :range="calendarRange" />
        </div>
      </AuditCard>

      <AuditCard name="ElCard" :state="auditState">
        <el-card>
          <template #header>Card header</template>
          <p>Curated surface content</p>
        </el-card>
      </AuditCard>

      <AuditCard name="ElCarousel" :state="auditState">
        <el-carousel
          height="120px"
          :autoplay="false"
          :initial-index="active ? 1 : 0"
        >
          <el-carousel-item v-for="item in 3" :key="item">
            <div class="audit-carousel-panel">Slide {{ item }}</div>
          </el-carousel-item>
        </el-carousel>
      </AuditCard>

      <AuditCard name="ElCarouselItem" :state="auditState">
        <el-carousel
          height="120px"
          :autoplay="false"
          :initial-index="active ? 1 : 0"
        >
          <el-carousel-item>
            <div class="audit-carousel-panel">Carousel item</div>
          </el-carousel-item>
        </el-carousel>
      </AuditCard>

      <AuditCard name="ElCascader" :state="auditState">
        <el-cascader
          :model-value="active ? ['guide', 'docs'] : []"
          :options="cascaderOptions"
          :teleported="false"
          placeholder="Cascader"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElCascaderPanel" :state="auditState">
        <el-cascader-panel
          :model-value="active ? ['guide', 'docs'] : []"
          :options="cascaderOptions"
        />
      </AuditCard>

      <AuditCard name="ElCheckbox" :state="auditState">
        <el-checkbox :model-value="active" data-audit-focus data-audit-target>
          Checkbox
        </el-checkbox>
      </AuditCard>

      <AuditCard name="ElCheckboxButton" :state="auditState">
        <el-checkbox-group :model-value="active ? ['A'] : []">
          <el-checkbox-button label="A">Option A</el-checkbox-button>
        </el-checkbox-group>
      </AuditCard>

      <AuditCard name="ElCheckboxGroup" :state="auditState">
        <el-checkbox-group :model-value="active ? ['A', 'B'] : ['A']">
          <el-checkbox label="A">A</el-checkbox>
          <el-checkbox label="B">B</el-checkbox>
        </el-checkbox-group>
      </AuditCard>

      <AuditCard name="ElCheckTag" :state="auditState">
        <el-check-tag :checked="active" data-audit-target>
          Check tag
        </el-check-tag>
      </AuditCard>

      <AuditCard name="ElCol" :state="auditState">
        <el-row :gutter="12">
          <el-col :span="12"><div class="audit-grid-cell">12</div></el-col>
          <el-col :span="12"><div class="audit-grid-cell">12</div></el-col>
        </el-row>
      </AuditCard>

      <AuditCard name="ElCollapse" :state="auditState">
        <el-collapse :model-value="active ? ['1', '2'] : ['1']">
          <el-collapse-item title="Consistency" name="1">
            First panel
          </el-collapse-item>
          <el-collapse-item title="Interaction" name="2">
            Second panel
          </el-collapse-item>
        </el-collapse>
      </AuditCard>

      <AuditCard name="ElCollapseItem" :state="auditState">
        <el-collapse :model-value="active ? ['item'] : []">
          <el-collapse-item title="Collapse item" name="item">
            Item body
          </el-collapse-item>
        </el-collapse>
      </AuditCard>

      <AuditCard name="ElCollapseTransition" :state="auditState">
        <el-button
          data-audit-target
          @click="transitionVisible = !transitionVisible"
        >
          Toggle
        </el-button>
        <el-collapse-transition>
          <div
            v-show="active || transitionVisible"
            class="audit-transition-box"
          >
            Transition content
          </div>
        </el-collapse-transition>
      </AuditCard>

      <AuditCard name="ElColorPicker" :state="auditState">
        <el-color-picker
          :model-value="active ? scholarlyBlue : dotGray"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElConfigProvider" :state="auditState">
        <el-config-provider :button="{ autoInsertSpace: false }">
          <el-button type="primary" data-audit-target>
            Provider child
          </el-button>
        </el-config-provider>
      </AuditCard>

      <AuditCard name="ElContainer" :state="auditState">
        <el-container class="audit-container">
          <el-header height="36px">Header</el-header>
          <el-main>Main</el-main>
          <el-footer height="36px">Footer</el-footer>
        </el-container>
      </AuditCard>

      <AuditCard name="ElCountdown" :state="auditState">
        <el-countdown title="Countdown" :value="countdownValue" />
      </AuditCard>

      <AuditCard name="ElDatePicker" :state="auditState">
        <el-date-picker
          :model-value="dateValue"
          type="date"
          placeholder="Pick day"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElDescriptions" :state="auditState">
        <el-descriptions title="Profile" border :column="1">
          <el-descriptions-item label="Name">FsusUI</el-descriptions-item>
          <el-descriptions-item label="State">
            {{ active ? 'Active' : 'Ready' }}
          </el-descriptions-item>
        </el-descriptions>
      </AuditCard>

      <AuditCard name="ElDescriptionsItem" :state="auditState">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Item">
            Description cell
          </el-descriptions-item>
        </el-descriptions>
      </AuditCard>

      <AuditCard name="ElDialog" :state="auditState">
        <el-button
          v-if="!dialogVisible"
          data-audit-active
          data-audit-focus
          data-audit-target
          @click="dialogVisible = true"
        >
          Open dialog
        </el-button>
        <el-dialog
          v-model="dialogVisible"
          title="Dialog"
          width="280px"
          :append-to-body="false"
          modal-class="audit-floating-overlay"
          :modal="false"
          :lock-scroll="false"
        >
          <span>Dialog content</span>
        </el-dialog>
      </AuditCard>

      <AuditCard name="ElDivider" :state="auditState">
        <span>Before</span>
        <el-divider content-position="left">Divider</el-divider>
        <span>After</span>
      </AuditCard>

      <AuditCard name="ElDrawer" :state="auditState">
        <el-button
          v-if="!drawerVisible"
          data-audit-active
          data-audit-focus
          data-audit-target
          @click="drawerVisible = true"
        >
          Open drawer
        </el-button>
        <el-drawer
          v-model="drawerVisible"
          title="Drawer"
          size="260px"
          :append-to-body="false"
          modal-class="audit-floating-overlay"
          :modal="false"
          :lock-scroll="false"
        >
          Drawer content
        </el-drawer>
      </AuditCard>

      <AuditCard name="ElDropdown" :state="auditState">
        <el-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <el-button
            type="primary"
            data-audit-focus
            data-audit-target
            data-audit-active
          >
            Dropdown
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Action one</el-dropdown-item>
              <el-dropdown-item :disabled="!active">
                Action two
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </AuditCard>

      <AuditCard name="ElDropdownItem" :state="auditState">
        <el-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <el-button data-audit-active data-audit-target>
            Dropdown item
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :divided="active">Item action</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </AuditCard>

      <AuditCard name="ElDropdownMenu" :state="auditState">
        <el-dropdown trigger="click" :show-timeout="0" :teleported="false">
          <el-button data-audit-active data-audit-target>
            Dropdown menu
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>Menu action</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </AuditCard>

      <AuditCard name="ElEmpty" :state="auditState">
        <el-empty description="No records" />
      </AuditCard>

      <AuditCard name="ElEmptyState" :state="auditState">
        <ElEmptyState
          :size="active ? 'page' : 'compact'"
          title="No records"
          description="Adjust filters or create a new item."
          :action-variant="active ? 'primary' : 'secondary'"
        >
          <el-button
            :type="active ? 'primary' : undefined"
            data-audit-focus
            data-audit-target
            data-audit-active
          >
            Create item
          </el-button>
        </ElEmptyState>
      </AuditCard>

      <AuditCard name="ElFooter" :state="auditState">
        <el-container class="audit-container">
          <el-main>Main</el-main>
          <el-footer height="40px">Footer</el-footer>
        </el-container>
      </AuditCard>

      <AuditCard name="ElForm" :state="auditState">
        <el-form :model="formModel" label-width="88px">
          <el-form-item label="Name">
            <el-input :model-value="activeText" />
          </el-form-item>
        </el-form>
      </AuditCard>

      <AuditCard name="ElFormItem" :state="auditState">
        <el-form :model="formModel" label-width="88px">
          <el-form-item label="Region">
            <el-select :model-value="active ? 'one' : ''" :teleported="false">
              <el-option label="Zone one" value="one" />
            </el-select>
          </el-form-item>
        </el-form>
      </AuditCard>

      <AuditCard name="ElHeader" :state="auditState">
        <el-container class="audit-container">
          <el-header height="40px">Header</el-header>
          <el-main>Main</el-main>
        </el-container>
      </AuditCard>

      <AuditCard name="ElIcon" :state="auditState">
        <el-icon :size="32" :color="active ? scholarlyBlue : undefined">
          <Search />
        </el-icon>
      </AuditCard>

      <AuditCard name="ElImage" :state="auditState">
        <el-image
          class="audit-image"
          :src="imageData"
          :preview-src-list="[imageData]"
          fit="cover"
        />
      </AuditCard>

      <AuditCard name="ElImageViewer" :state="auditState">
        <el-image class="audit-image" :src="imageData" fit="cover" />
        <el-button
          data-audit-active
          data-audit-target
          @click="imageViewerVisible = true"
        >
          Preview
        </el-button>
        <el-image-viewer
          v-if="imageViewerVisible"
          :url-list="[imageData]"
          @close="imageViewerVisible = false"
        />
      </AuditCard>

      <AuditCard name="ElInboxLayout" :state="auditState">
        <ElInboxLayout
          class="audit-inbox-layout"
          selected
          mobile-pane="detail"
          list-label="Generic item list"
          detail-label="Generic item detail"
          :density="compact ? 'compact' : 'default'"
        >
          <template #list>
            <ElConversationList ariaLabel="Generic item list">
              <ElConversationListItem
                title="Item alpha"
                preview="Long preview content that should stay contained"
                meta="09:00"
                selected
                :unread-count="active ? 3 : 1"
              />
              <ElConversationListItem
                title="Item beta"
                preview="Secondary neutral preview"
                meta="10:30"
              />
            </ElConversationList>
          </template>
          <template #detail>
            <ElThreadPanel title="Thread alpha">
              <template #status>
                <el-tag size="small" type="info">
                  {{ active ? 'Active' : 'Ready' }}
                </el-tag>
              </template>
              <template #context>
                <ElConversationContextBar>
                  <span>Kind: Generic</span>
                  <span>Source: Neutral</span>
                </ElConversationContextBar>
              </template>
              <template #messages>
                <ElMessageTimeline>
                  <ElMessageBubble author="A" meta="09:00">
                    Neutral timeline content.
                  </ElMessageBubble>
                  <ElMessageBubble variant="self" author="B" meta="09:10">
                    Reply content with enough length to test wrapping in a
                    compact panel.
                  </ElMessageBubble>
                  <ElMessageBubble variant="system">
                    Generic state changed.
                  </ElMessageBubble>
                </ElMessageTimeline>
              </template>
              <template #composer>
                <ElReplyComposerShell title="Reply">
                  <template #input>
                    <el-input
                      type="textarea"
                      :model-value="activeText"
                      label="Reply body"
                    />
                  </template>
                  <template #actions>
                    <el-button
                      type="primary"
                      data-audit-active
                      data-audit-focus
                      data-audit-target
                    >
                      Send
                    </el-button>
                  </template>
                </ElReplyComposerShell>
              </template>
            </ElThreadPanel>
          </template>
        </ElInboxLayout>
      </AuditCard>

      <AuditCard name="ElInput" :state="auditState">
        <el-input
          :model-value="activeText"
          placeholder="Input"
          clearable
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElInputNumber" :state="auditState">
        <el-input-number
          :model-value="active ? 6 : 2"
          :min="1"
          :max="10"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElLink" :state="auditState">
        <el-link
          href="#audit-link"
          :type="active ? 'primary' : 'default'"
          data-audit-focus
          data-audit-target
          @click.prevent
        >
          Link action
        </el-link>
      </AuditCard>

      <AuditCard name="ElMain" :state="auditState">
        <el-container class="audit-container">
          <el-main>Main surface</el-main>
        </el-container>
      </AuditCard>

      <AuditCard name="ElMarkdownEditor" :state="auditState">
        <div class="audit-markdown-editor-frame">
          <el-markdown-editor
            :model-value="markdownEditorAuditContent"
            default-mode="split"
            :min-rows="4"
            data-audit-focus
            data-audit-target
          />
        </div>
      </AuditCard>

      <AuditCard name="ElMarkdownRenderer" :state="auditState">
        <div class="audit-markdown-frame">
          <el-markdown-renderer :content="markdownAuditContent" />
        </div>
      </AuditCard>

      <AuditCard name="ElMenu" :state="auditState">
        <el-menu
          :default-active="active ? '2' : '1'"
          :default-openeds="active ? ['sub'] : []"
        >
          <el-menu-item index="1">Dashboard</el-menu-item>
          <el-sub-menu index="sub">
            <template #title>Workspace</template>
            <el-menu-item index="2">Reports</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElMenuItem" :state="auditState">
        <el-menu :default-active="active ? '2' : '1'">
          <el-menu-item index="1">Overview</el-menu-item>
          <el-menu-item index="2">Active item</el-menu-item>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElMenuItemGroup" :state="auditState">
        <el-menu default-active="group-1" :default-openeds="['group']">
          <el-sub-menu index="group">
            <template #title>Group</template>
            <el-menu-item-group title="Group label">
              <el-menu-item index="group-1">Grouped item</el-menu-item>
            </el-menu-item-group>
          </el-sub-menu>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElOption" :state="auditState">
        <el-select
          :model-value="active ? 'two' : ''"
          placeholder="Option"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option label="Option one" value="one" />
          <el-option label="Option two" value="two" />
        </el-select>
      </AuditCard>

      <AuditCard name="ElOptionGroup" :state="auditState">
        <el-select
          :model-value="active ? 'one' : ''"
          placeholder="Grouped option"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option-group label="Group">
            <el-option label="Grouped option" value="one" />
          </el-option-group>
        </el-select>
      </AuditCard>

      <AuditCard name="ElOverlay" :state="auditState">
        <div class="audit-overlay-demo">
          <el-overlay v-if="active" :z-index="1">
            <div class="audit-overlay-panel">Overlay content</div>
          </el-overlay>
          <el-button v-else data-audit-focus data-audit-target>
            Overlay trigger
          </el-button>
        </div>
      </AuditCard>

      <AuditCard name="ElPageHeader" :state="auditState">
        <el-page-header content="Detail" title="Back" />
      </AuditCard>

      <AuditCard name="ElPublicShell" :state="auditState">
        <el-public-shell
          brand="Fsus"
          brand-href="#brand"
          :nav-items="shellNavItems"
          active-nav="docs"
          auth-label="Sign in"
          auth-href="#auth"
          :show-search="false"
          :sticky="false"
          max-width="100%"
        >
          <p class="audit-public-shell-copy">Public shell content</p>
          <template #desktop-actions>
            <el-button size="small"> Action </el-button>
          </template>
          <template #mobile-actions>
            <el-button size="small"> Go </el-button>
          </template>
        </el-public-shell>
      </AuditCard>

      <AuditCard name="ElPagination" :state="auditState">
        <el-pagination
          background
          small
          layout="prev, pager, next, total"
          :default-current-page="active ? 2 : 1"
          :total="50"
        />
      </AuditCard>

      <AuditCard name="ElPopconfirm" :state="auditState">
        <el-popconfirm title="Delete item?" :teleported="false">
          <template #reference>
            <el-button data-audit-focus data-audit-target data-audit-active>
              Popconfirm
            </el-button>
          </template>
        </el-popconfirm>
      </AuditCard>

      <AuditCard name="ElPopover" :state="auditState">
        <el-popover
          trigger="click"
          placement="bottom-start"
          title="Popover"
          content="Editorial popover content"
          :width="220"
          :teleported="false"
        >
          <template #reference>
            <el-button data-audit-focus data-audit-target data-audit-active>
              Popover
            </el-button>
          </template>
        </el-popover>
      </AuditCard>

      <AuditCard name="ElPopper" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button data-audit-focus data-audit-target>Raw popper</el-button>
          </el-popper-trigger>
          <el-popper-content :visible="true">
            <el-popper-arrow />
            Raw content
          </el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElPopperArrow" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button>Arrow</el-button>
          </el-popper-trigger>
          <el-popper-content :visible="true">
            <el-popper-arrow />Arrow content
          </el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElPopperContent" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button>Content trigger</el-button>
          </el-popper-trigger>
          <el-popper-content :visible="true">Popper content</el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElPopperTrigger" :state="auditState">
        <el-popper>
          <el-popper-trigger>
            <el-button data-audit-focus data-audit-target>Trigger</el-button>
          </el-popper-trigger>
          <el-popper-content
            v-if="active"
            :visible="true"
            placement="bottom-start"
          >
            Triggered content
          </el-popper-content>
        </el-popper>
      </AuditCard>

      <AuditCard name="ElProgress" :state="auditState">
        <el-progress :percentage="active ? 88 : 44" />
        <el-progress type="circle" :percentage="active ? 72 : 28" />
      </AuditCard>

      <AuditCard name="ElRadio" :state="auditState">
        <el-radio :model-value="active ? 'selected' : ''" label="selected">
          Radio
        </el-radio>
      </AuditCard>

      <AuditCard name="ElRadioButton" :state="auditState">
        <el-radio-group :model-value="active ? 'B' : 'A'">
          <el-radio-button label="A">A</el-radio-button>
          <el-radio-button label="B">B</el-radio-button>
        </el-radio-group>
      </AuditCard>

      <AuditCard name="ElRadioGroup" :state="auditState">
        <el-radio-group :model-value="active ? '2' : '1'">
          <el-radio label="1">One</el-radio>
          <el-radio label="2">Two</el-radio>
        </el-radio-group>
      </AuditCard>

      <AuditCard name="ElRate" :state="auditState">
        <el-rate :model-value="active ? 5 : 3" allow-half />
      </AuditCard>

      <AuditCard name="ElResult" :state="auditState">
        <el-result icon="success" title="Success" sub-title="Result detail">
          <template #extra>
            <el-button type="primary">Confirm</el-button>
          </template>
        </el-result>
      </AuditCard>

      <AuditCard name="ElResponsiveCollection" :state="auditState">
        <el-responsive-collection
          :items="responsiveCollectionItems"
          row-key="name"
          :compact="compact"
        >
          <template #table>
            <el-table
              :data="responsiveCollectionItems"
              size="small"
              height="132"
            >
              <el-table-column prop="name" label="Name" />
              <el-table-column prop="state" label="State" />
            </el-table>
          </template>
          <template #card="{ item }">
            <div class="audit-responsive-card" role="listitem">
              {{ formatCollectionItem(item) }}
            </div>
          </template>
        </el-responsive-collection>
      </AuditCard>

      <AuditCard name="ElRow" :state="auditState">
        <el-row :gutter="12">
          <el-col :span="8"><div class="audit-grid-cell">8</div></el-col>
          <el-col :span="16"><div class="audit-grid-cell">16</div></el-col>
        </el-row>
      </AuditCard>

      <AuditCard name="ElScrollbar" :state="auditState">
        <el-scrollbar height="140px">
          <div v-for="item in 6" :key="item" class="audit-virtual-row">
            Scroll item {{ item }}
          </div>
        </el-scrollbar>
      </AuditCard>

      <AuditCard name="ElSelect" :state="auditState">
        <el-select
          :model-value="active ? 'two' : ''"
          placeholder="Select"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option label="One" value="one" />
          <el-option label="Two" value="two" />
        </el-select>
      </AuditCard>

      <AuditCard name="ElSelectV2" :state="auditState">
        <el-select-v2
          :model-value="active ? 'Option 2' : ''"
          :options="selectV2Options"
          placeholder="Select V2"
          :teleported="false"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElSlider" :state="auditState">
        <el-slider :model-value="active ? 80 : 40" data-audit-target />
      </AuditCard>

      <AuditCard name="ElSkeleton" :state="auditState">
        <el-skeleton style="width: 240px" animated>
          <template #template>
            <el-skeleton-item
              variant="image"
              style="width: 100%; height: 88px"
            />
            <el-skeleton-item
              variant="text"
              style="width: 80%; margin-top: 12px"
            />
          </template>
        </el-skeleton>
      </AuditCard>

      <AuditCard name="ElSkeletonItem" :state="auditState">
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="p" style="width: 80%; height: 18px" />
          </template>
        </el-skeleton>
      </AuditCard>

      <AuditCard name="ElSpace" :state="auditState">
        <el-space wrap>
          <el-button>A</el-button>
          <el-button type="primary">B</el-button>
        </el-space>
      </AuditCard>

      <AuditCard name="ElStatistic" :state="auditState">
        <el-statistic title="Active users" :value="active ? 268500 : 128000" />
      </AuditCard>

      <AuditCard name="ElStep" :state="auditState">
        <el-steps :active="active ? 2 : 1">
          <el-step title="Draft" />
          <el-step title="Review" />
          <el-step title="Ship" />
        </el-steps>
      </AuditCard>

      <AuditCard name="ElSteps" :state="auditState">
        <el-steps :active="active ? 2 : 1">
          <el-step title="One" description="Start" />
          <el-step title="Two" description="Middle" />
          <el-step title="Three" description="End" />
        </el-steps>
      </AuditCard>

      <AuditCard name="ElSubMenu" :state="auditState">
        <el-menu default-active="2" :default-openeds="['sub']">
          <el-sub-menu index="sub">
            <template #title>Sub menu</template>
            <el-menu-item index="2">Nested item</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </AuditCard>

      <AuditCard name="ElSwitch" :state="auditState">
        <el-switch
          :model-value="active"
          active-text="Open"
          inactive-text="Closed"
        />
      </AuditCard>

      <AuditCard name="ElTabPane" :state="auditState">
        <el-tabs :model-value="active ? 'second' : 'first'">
          <el-tab-pane label="First" name="first">First pane</el-tab-pane>
          <el-tab-pane label="Second" name="second">Second pane</el-tab-pane>
        </el-tabs>
      </AuditCard>

      <AuditCard name="ElTable" :state="auditState">
        <el-table :data="tableData" border style="width: 100%">
          <el-table-column prop="name" label="Name" width="120" />
          <el-table-column prop="state" label="State" />
        </el-table>
      </AuditCard>

      <AuditCard name="ElTableColumn" :state="auditState">
        <el-table :data="tableData" border style="width: 100%">
          <el-table-column prop="name" label="Column" />
        </el-table>
      </AuditCard>

      <AuditCard name="ElAutoResizer" :state="auditState">
        <div class="audit-table-v2-frame">
          <el-auto-resizer>
            <template #default="{ height, width }">
              <el-table-v2
                :columns="tableV2Columns"
                :data="tableV2Data"
                :width="width"
                :height="height"
              />
            </template>
          </el-auto-resizer>
        </div>
      </AuditCard>

      <AuditCard name="ElTableV2" :state="auditState">
        <div class="audit-table-v2-frame">
          <el-table-v2
            :columns="tableV2Columns"
            :data="tableV2Data"
            :width="260"
            :height="160"
          />
        </div>
      </AuditCard>

      <AuditCard name="ElTabs" :state="auditState">
        <el-tabs :model-value="active ? 'second' : 'first'">
          <el-tab-pane label="First" name="first">First content</el-tab-pane>
          <el-tab-pane label="Second" name="second">Second content</el-tab-pane>
        </el-tabs>
      </AuditCard>

      <AuditCard name="ElTag" :state="auditState">
        <el-space wrap>
          <el-tag :type="active ? 'info' : undefined">Tag</el-tag>
          <el-tag type="info">Info</el-tag>
        </el-space>
      </AuditCard>

      <AuditCard name="ElText" :state="auditState">
        <el-text :type="active ? 'primary' : undefined">
          Editorial text sample
        </el-text>
      </AuditCard>

      <AuditCard name="ElThemeModeToggle" :state="auditState">
        <el-theme-mode-toggle
          :model-value="themeMode"
          :compact="compact"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElTimePicker" :state="auditState">
        <el-time-picker
          :model-value="dateValue"
          placeholder="Pick time"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElTimeSelect" :state="auditState">
        <el-time-select
          :model-value="active ? '09:00' : ''"
          start="08:30"
          step="00:15"
          end="09:00"
          placeholder="Select time"
          data-audit-focus
          data-audit-target
        />
      </AuditCard>

      <AuditCard name="ElTimeline" :state="auditState">
        <el-timeline>
          <el-timeline-item timestamp="2026/05/20" placement="top">
            Audit started
          </el-timeline-item>
          <el-timeline-item timestamp="2026/05/21" placement="top">
            Review
          </el-timeline-item>
        </el-timeline>
      </AuditCard>

      <AuditCard name="ElTimelineItem" :state="auditState">
        <el-timeline>
          <el-timeline-item timestamp="2026/05/20">
            Timeline item
          </el-timeline-item>
        </el-timeline>
      </AuditCard>

      <AuditCard name="ElTooltip" :state="auditState">
        <el-tooltip
          content="Tooltip content"
          placement="bottom-start"
          :trigger="['hover', 'click']"
          :show-after="0"
          :hide-after="0"
          :teleported="false"
        >
          <el-button data-audit-focus data-audit-target data-audit-active>
            Tooltip
          </el-button>
        </el-tooltip>
      </AuditCard>

      <AuditCard name="ElTooltipV2" :state="auditState">
        <el-tooltip-v2
          :placement="boundary ? 'bottom-start' : 'right'"
          :open="active"
          :delay-duration="0"
          :teleported="false"
        >
          <template #trigger>
            <el-button data-audit-focus data-audit-target data-audit-active>
              Tooltip V2
            </el-button>
          </template>
          Tooltip V2 content
        </el-tooltip-v2>
      </AuditCard>

      <AuditCard name="ElTransfer" :state="auditState">
        <el-transfer
          :model-value="active ? [1, 2] : [1]"
          :data="transferData"
          filterable
          filter-placeholder="Search"
        />
      </AuditCard>

      <AuditCard name="ElTree" :state="auditState">
        <el-tree
          :data="treeData"
          node-key="value"
          show-checkbox
          :default-checked-keys="active ? ['level-1-1'] : []"
          :default-expanded-keys="['level-1']"
        />
      </AuditCard>

      <AuditCard name="ElTreeSelect" :state="auditState">
        <el-tree-select
          :model-value="active ? 'level-1-1' : 'level-1'"
          :data="treeData"
          :teleported="false"
          popper-class="audit-tree-select-popper"
          data-audit-focus
          data-audit-target
          data-audit-active
        />
      </AuditCard>

      <AuditCard name="ElTreeV2" :state="auditState">
        <el-tree-v2
          :data="treeDataV2"
          :height="180"
          :item-size="44"
          :default-expanded-keys="[0]"
        />
      </AuditCard>

      <AuditCard name="ElUpload" :state="auditState">
        <el-upload action="#" :auto-upload="false" drag>
          <el-icon><UploadFilled /></el-icon>
          <div class="el-upload__text">Drop file or click</div>
        </el-upload>
      </AuditCard>

      <AuditCard name="ElWatermark" :state="auditState">
        <el-watermark content="FsusUI">
          <div class="audit-watermark-box" />
        </el-watermark>
      </AuditCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import {
  ElConversationContextBar,
  ElConversationList,
  ElConversationListItem,
  ElEmptyState,
  ElInboxLayout,
  ElMessageBubble,
  ElMessageTimeline,
  ElReplyComposerShell,
  ElThreadPanel,
} from '../../element-plus'
import AuditCard from './AuditCard.vue'
import {
  auditComponentNames,
  auditStateNames,
  type UiAuditState,
} from './ui-audit-manifest'

const { ArrowDown, ArrowLeft, ArrowRight, Search, UploadFilled } = Icons

const props = withDefaults(
  defineProps<{
    boundary?: boolean
    compact?: boolean
    state?: UiAuditState
    theme?: string
  }>(),
  {
    boundary: false,
    compact: false,
    state: 'focus',
    theme: 'light',
  },
)

const boundaryText =
  'Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback'
const auditTitle = computed(() =>
  props.boundary
    ? 'FsusUI Component Boundary Audit'
    : 'FsusUI Component State Audit',
)
const auditState = computed<UiAuditState>(() =>
  auditStateNames.includes(props.state) ? props.state : 'focus',
)
const active = computed(() => auditState.value === 'active')
const activeText = computed(() => {
  if (props.boundary) {
    return active.value
      ? `${boundaryText} - active value with extra density`
      : `${boundaryText} - pending value`
  }

  return active.value ? 'Active value' : ''
})
const themeMode = computed(() => (props.theme === 'dark' ? 'dark' : 'light'))
const markdownAuditContent = computed(() =>
  props.boundary
    ? `# Markdown\n\n${boundaryText}\n\n\`inline-code-boundary-token\``
    : '# Markdown\n\nCompact rendered content.',
)
const markdownEditorAuditContent = computed(() =>
  props.boundary
    ? `## Editor\n\n${boundaryText}\n\n[Audit link](https://example.com)`
    : '## Editor\n\nCompact editable content.',
)
const shellNavItems = computed(() => [
  {
    key: 'home',
    label: props.boundary ? `Home ${boundaryText}` : 'Home',
    href: '#home',
  },
  {
    key: 'docs',
    label: props.boundary ? `Docs ${boundaryText}` : 'Docs',
    href: '#docs',
  },
  {
    key: 'api',
    label: props.boundary ? `API ${boundaryText}` : 'API',
    href: '#api',
  },
])
const responsiveCollectionItems = computed(() => [
  {
    name: props.boundary ? `Alpha ${boundaryText}` : 'Alpha',
    state: active.value ? 'Active' : 'Ready',
  },
  {
    name: props.boundary ? `Beta ${boundaryText}` : 'Beta',
    state: 'Review',
  },
])
const formatCollectionItem = (item: unknown) => {
  if (!item || typeof item !== 'object') return String(item)

  const row = item as { name?: unknown; state?: unknown }
  return `${String(row.name ?? '')} - ${String(row.state ?? '')}`
}
const readCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  )
}
const scholarlyBlue = readCssVar('--fsus-scholarly-blue', '#2a599c')
const dotGray = readCssVar('--fsus-dot-gray', '#a1a1aa')
const dateValue = new Date('2026-05-20T09:30:00Z')
const calendarRange: [Date, Date] = [
  new Date('2026-05-18T00:00:00Z'),
  new Date('2026-05-31T00:00:00Z'),
]
const countdownValue = Date.now() + 1000 * 60 * 60 * 24
const imageData = computed(() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="${readCssVar('--fsus-page', '#f7f7f8')}"/><circle cx="60" cy="60" r="30" fill="${scholarlyBlue}" opacity="0.18"/><path d="M42 68h36M42 54h36" stroke="${readCssVar('--fsus-ink', '#0f0f11')}" stroke-width="6" stroke-linecap="round"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})

const transitionVisible = ref(false)
const dialogVisible = ref(false)
const drawerVisible = ref(false)
const imageViewerVisible = ref(false)

watch(auditState, () => {
  transitionVisible.value = false
  dialogVisible.value = false
  drawerVisible.value = false
  imageViewerVisible.value = false
})

const cascaderOptions = computed(() => [
  {
    value: 'guide',
    label: props.boundary
      ? 'Guide / extremely long discipline branch'
      : 'Guide',
    children: [
      {
        value: 'docs',
        label: props.boundary
          ? 'Documentation leaf with long localized metadata'
          : 'Docs',
      },
    ],
  },
])
const selectV2Options = computed(() =>
  Array.from({ length: props.boundary ? 24 : 6 }, (_, idx) => ({
    value: `Option ${idx + 1}`,
    label: props.boundary
      ? `Option ${idx + 1} - ${boundaryText}`
      : `Option ${idx + 1}`,
  })),
)
const transferData = computed(() =>
  Array.from({ length: props.boundary ? 18 : 6 }, (_, idx) => ({
    key: idx + 1,
    label: props.boundary
      ? `Option ${idx + 1} - ${boundaryText}`
      : `Option ${idx + 1}`,
    disabled: idx === 4,
  })),
)
const formModel = reactive({ name: 'FsusUI', region: 'one' })
const tableData = computed(() => [
  {
    name: props.boundary ? `Alpha ${boundaryText}` : 'Alpha',
    state: props.boundary ? 'Ready with extended lifecycle metadata' : 'Ready',
  },
  {
    name: props.boundary ? `Beta ${boundaryText}` : 'Beta',
    state: active.value ? 'Active' : 'Idle',
  },
])
const tableV2Columns = computed(() => [
  {
    key: 'name',
    dataKey: 'name',
    title: props.boundary ? 'Name / long boundary heading' : 'Name',
    width: props.boundary ? 180 : 140,
  },
  {
    key: 'state',
    dataKey: 'state',
    title: props.boundary ? 'State / dense metadata' : 'State',
    width: props.boundary ? 180 : 120,
  },
])
const tableV2Data = computed(() =>
  Array.from({ length: props.boundary ? 80 : 8 }, (_, id) => ({
    id,
    name: props.boundary ? `Row ${id} ${boundaryText}` : `Row ${id}`,
    state: id % 2 === 0 ? 'Ready' : 'Review',
  })),
)
const treeData = computed(() => [
  {
    value: 'level-1',
    label: props.boundary ? `Level one ${boundaryText}` : 'Level one',
    children: [
      {
        value: 'level-1-1',
        label: props.boundary ? `Level two ${boundaryText}` : 'Level two',
        children: [
          {
            value: 'level-1-1-1',
            label: props.boundary
              ? `Level three ${boundaryText}`
              : 'Level three',
          },
        ],
      },
    ],
  },
])
const treeDataV2 = computed(() =>
  Array.from({ length: props.boundary ? 240 : 80 }, (_, id) => ({
    id,
    label: props.boundary ? `Node ${id} ${boundaryText}` : `Node ${id}`,
    children:
      id === 0
        ? [
            {
              id: 1000,
              label: props.boundary
                ? `Nested node ${boundaryText}`
                : 'Nested node',
            },
          ]
        : undefined,
  })),
)

const querySearch = (
  _queryString: string,
  cb: (items: { value: string }[]) => void,
) => {
  cb(
    props.boundary
      ? [
          { value: `FsusUI ${boundaryText}` },
          { value: `Element Plus ${boundaryText}` },
        ]
      : [{ value: 'FsusUI' }, { value: 'Element Plus' }],
  )
}
</script>
