<template>
  <div
    class="audit-page"
    :class="{ 'is-compact': compact, 'is-boundary': boundary }"
    v-bind="auditRootDataAttributes"
  >
    <header
      v-if="!markdownEditorTableEvidenceFixture"
      class="audit-page__header"
    >
      <h1>{{ auditTitle }}</h1>
      <p>{{ auditComponentNames.length }} components · {{ auditState }}</p>
    </header>

    <!--
      Safe-area lab (#262): public component APIs only.
      No modal-class geometry patches, no test-only forks, no selector overrides.
      Profile overrides are applied by tests via #260 CSS variables on :root.
    -->
    <section
      v-if="!markdownEditorTableEvidenceFixture"
      class="audit-safe-area-lab"
      v-bind="safeAreaDataAttributes.lab"
    >
      <h2 class="audit-safe-area-lab__title">Safe-area surfaces</h2>
      <div class="audit-safe-area-lab__controls">
        <el-button
          v-bind="safeAreaDataAttributes.openOverlay"
          @click="safeOverlayVisible = true"
        >
          Open Overlay
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openDialog"
          @click="openSafeDialog(false)"
        >
          Open Dialog
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openDialogFullscreen"
          @click="openSafeDialog(true)"
        >
          Open Fullscreen Dialog
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openMessageBox"
          @click="openSafeMessageBox"
        >
          Open MessageBox
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openDrawerLtr"
          @click="openSafeDrawer('ltr')"
        >
          Open Drawer LTR
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openDrawerRtl"
          @click="openSafeDrawer('rtl')"
        >
          Open Drawer RTL
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openDrawerTtb"
          @click="openSafeDrawer('ttb')"
        >
          Open Drawer TTB
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openDrawerBtt"
          @click="openSafeDrawer('btt')"
        >
          Open Drawer BTT
        </el-button>
        <el-button
          v-bind="safeAreaDataAttributes.openImageViewer"
          @click="safeImageViewerVisible = true"
        >
          Open ImageViewer
        </el-button>
      </div>

      <el-overlay
        v-if="safeOverlayVisible"
        :z-index="4000"
        @click="safeOverlayVisible = false"
      >
        <div class="audit-safe-area-lab__panel" @click.stop>
          <p>Safe-area Overlay content</p>
          <el-button
            v-bind="safeAreaDataAttributes.actionOverlayClose"
            @click="safeOverlayVisible = false"
          >
            Close Overlay
          </el-button>
        </div>
      </el-overlay>

      <el-dialog
        v-model="safeDialogVisible"
        :title="
          safeDialogFullscreen
            ? 'Safe-area Fullscreen Dialog'
            : 'Safe-area Dialog'
        "
        :fullscreen="safeDialogFullscreen"
        width="320px"
        append-to-body
        destroy-on-close
      >
        <div class="audit-safe-area-lab__long-body">
          <p v-for="index in safeAreaLongParagraphCount" :key="index">
            Safe-area dialog paragraph {{ index }}. Long copy forces short
            viewports to scroll so footer actions remain reachable.
          </p>
        </div>
        <template #footer>
          <el-button
            v-bind="safeAreaDataAttributes.actionDialogCancel"
            @click="safeDialogVisible = false"
          >
            Cancel
          </el-button>
          <el-button
            type="primary"
            v-bind="safeAreaDataAttributes.actionDialogConfirm"
            @click="safeDialogVisible = false"
          >
            Confirm
          </el-button>
        </template>
      </el-dialog>

      <el-drawer
        v-model="safeDrawerVisible"
        :direction="safeDrawerDirection"
        :title="`Safe-area Drawer ${safeDrawerDirection.toUpperCase()}`"
        size="70%"
        append-to-body
        destroy-on-close
      >
        <div class="audit-safe-area-lab__long-body">
          <p v-for="index in safeAreaLongParagraphCount" :key="index">
            Drawer {{ safeDrawerDirection }} body {{ index }}.
          </p>
        </div>
        <template #footer>
          <el-button
            v-bind="safeAreaDataAttributes.actionDrawerCancel"
            @click="safeDrawerVisible = false"
          >
            Cancel
          </el-button>
          <el-button
            type="primary"
            v-bind="safeAreaDataAttributes.actionDrawerConfirm"
            @click="safeDrawerVisible = false"
          >
            Confirm
          </el-button>
        </template>
      </el-drawer>

      <el-image-viewer
        v-if="safeImageViewerVisible"
        :url-list="safeImageViewerUrls"
        teleported
        @close="safeImageViewerVisible = false"
      />
    </section>

    <section
      v-if="markdownProjectionFixture"
      data-testid="markdown-projection-production-fixture"
    >
      <el-markdown-editor
        v-model="markdownProjectionSource"
        default-mode="live"
        :min-rows="4"
        :show-actions="false"
        :show-mode-switcher="false"
      />
      <output data-testid="markdown-projection-main">
        {{ JSON.stringify(markdownProjectionMainSummary) }}
      </output>
      <output data-testid="markdown-projection-worker">
        {{ JSON.stringify(markdownProjectionWorkerSummary) }}
      </output>
    </section>

    <section
      v-if="markdownEditorTransactionFixture && markdownEditorMountReady"
      data-testid="markdown-editor-transaction-fixture"
      :data-markdown-editor-probe-id="markdownEditorProbeId"
      :dir="markdownCommandDirection"
    >
      <el-markdown-editor
        ref="markdownTransactionEditor"
        v-model="markdownTransactionValue"
        v-bind="markdownPasteGateAttributes"
        :document-identity="{
          epoch: 1,
          id: `markdown-command-${markdownContextualSurface ?? 'default'}`,
        }"
        :default-mode="markdownEditorDefaultMode"
        :disabled="markdownPasteGate === 'disabled'"
        :locale-text="markdownCommandLocaleText"
        :interaction-profile="markdownEditorInteractionProfile"
        :min-rows="6"
        :mobile-layout="markdownCommandMobileLayout"
        :show-actions="false"
        :show-mode-switcher="
          markdownLanguageToolsFixture || markdownEditorModeMatrixFixture
        "
        :status-density="markdownCommandStatusDensity"
        :surfaces="
          markdownCommandSurfacesFixture
            ? {
                commandPalette: true,
                selectionToolbar: true,
                slashMenu: true,
              }
            : undefined
        "
        data-markdown-input-authority="transaction-store"
        @history-change="markdownTransactionHistory = $event"
        @selection-change="markdownTransactionSelection = $event"
        @transaction="recordMarkdownTransaction"
        @upload-image="recordMarkdownAttachmentBatch"
      />
      <div
        v-if="!markdownEditorTableEvidenceFixture"
        aria-label="Markdown transaction controls"
      >
        <button
          v-if="markdownCommandSurfacesFixture"
          type="button"
          data-testid="markdown-open-command-palette"
          @click="markdownTransactionEditor?.openCommandPalette()"
        >
          Open command palette
        </button>
        <button
          type="button"
          data-testid="markdown-programmatic"
          @click="insertMarkdownFixture"
        >
          Programmatic insert
        </button>
        <button
          type="button"
          data-testid="markdown-placeholder"
          @click="insertMarkdownPlaceholder"
        >
          Insert placeholder
        </button>
        <button
          type="button"
          data-testid="markdown-replace-placeholder"
          @click="replaceMarkdownPlaceholder"
        >
          Replace placeholder
        </button>
        <button
          type="button"
          data-testid="markdown-stale-replacement"
          @click="dispatchStaleMarkdownReplacement"
        >
          Dispatch stale replacement
        </button>
        <button
          type="button"
          data-testid="markdown-undo"
          @click="markdownTransactionEditor?.undo()"
        >
          Undo
        </button>
        <button
          type="button"
          data-testid="markdown-redo"
          @click="markdownTransactionEditor?.redo()"
        >
          Redo
        </button>
        <button
          type="button"
          data-testid="markdown-external-reset"
          @click="markdownTransactionValue = '外部重置😀éאב'"
        >
          External reset
        </button>
        <button
          type="button"
          data-testid="markdown-large-document"
          @click="loadLargeMarkdownDocument"
        >
          Load 100k document
        </button>
        <button
          type="button"
          data-testid="markdown-attachment-progress"
          :disabled="!markdownAttachmentBatch"
          @click="progressMarkdownAttachmentFixture"
        >
          Attachment progress
        </button>
        <button
          type="button"
          data-testid="markdown-attachment-resolve"
          :disabled="!markdownAttachmentBatch"
          @click="resolveMarkdownAttachmentFixture"
        >
          Resolve attachment
        </button>
        <button
          type="button"
          data-testid="markdown-load-figure"
          @click="loadMarkdownFigureFixture"
        >
          Load image figure
        </button>
      </div>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-value"
      >
        {{ markdownTransactionValue.length }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-revision"
      >
        {{ markdownTransactionRevision }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-history"
      >
        {{ JSON.stringify(markdownTransactionHistory) }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-last-transaction"
      >
        {{ JSON.stringify(markdownLastTransaction) }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-selection"
      >
        {{ JSON.stringify(markdownTransactionSelection) }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-attachment-batch"
      >
        {{ JSON.stringify(markdownAttachmentBatchSnapshot) }}
      </output>
    </section>

    <section
      v-if="markdownSearchEmbedFixture"
      data-testid="markdown-search-embed-fixture"
      v-bind="{
        'data-document-epoch': String(markdownSearchEmbedEpoch),
      }"
    >
      <div aria-label="Markdown search and embed fixture controls">
        <button
          v-for="mode in markdownSearchEmbedModes"
          :key="mode"
          type="button"
          :data-testid="`markdown-search-embed-mode-${mode}`"
          @click="markdownSearchEmbedMode = mode"
        >
          {{ mode }}
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-open-find"
          @click="markdownSearchEmbedEditor?.openSearch(false)"
        >
          Open find
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-open-replace"
          @click="markdownSearchEmbedEditor?.openSearch(true)"
        >
          Open replace
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-switch-document"
          @click="switchMarkdownSearchEmbedDocument"
        >
          Switch document
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-resolve-failure"
          @click="markdownSearchEmbedResolveFailure = true"
        >
          Resolve failed embed on retry
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-load-performance"
          @click="loadMarkdownSearchPerformanceFixture"
        >
          Load 100k / 10000 matches
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-reset"
          @click="resetMarkdownSearchEmbedFixture"
        >
          Reset fixture
        </button>
      </div>
      <el-markdown-editor
        :key="`markdown-search-embed-${markdownSearchEmbedEpoch}`"
        ref="markdownSearchEmbedEditor"
        v-model="markdownSearchEmbedValue"
        :embed-provider="markdownSearchEmbedProvider"
        :interaction-profile="
          markdownSearchEmbedTouch ? 'touch' : 'keyboard'
        "
        :min-rows="10"
        :mode="markdownSearchEmbedMode"
        :show-actions="false"
        v-bind="{ 'data-testid': 'markdown-search-embed-editor' }"
        @embed-open-source="
          (target, mode) =>
            (markdownSearchEmbedLastOpen = `${target}:${mode}`)
        "
        @embed-retry="
          (target, mode) =>
            (markdownSearchEmbedLastRetry = `${target}:${mode}`)
        "
        @history-change="markdownSearchEmbedHistory = $event"
        @selection-change="markdownSearchEmbedSelection = $event"
      />
      <output data-testid="markdown-search-embed-value">
        {{ markdownSearchEmbedValue }}
      </output>
      <output data-testid="markdown-search-embed-mode">
        {{ markdownSearchEmbedMode }}
      </output>
      <output data-testid="markdown-search-embed-request">
        {{ JSON.stringify(markdownSearchEmbedLastRequest) }}
      </output>
      <output data-testid="markdown-search-embed-open">
        {{ markdownSearchEmbedLastOpen }}
      </output>
      <output data-testid="markdown-search-embed-retry">
        {{ markdownSearchEmbedLastRetry }}
      </output>
      <output data-testid="markdown-search-embed-history">
        {{ JSON.stringify(markdownSearchEmbedHistory) }}
      </output>
      <output data-testid="markdown-search-embed-selection">
        {{ JSON.stringify(markdownSearchEmbedSelection) }}
      </output>
    </section>

    <section
      v-if="markdownWritingAidsFixture"
      :dir="markdownWritingAidsDirection"
      data-testid="markdown-writing-aids-fixture"
    >
      <div
        data-testid="markdown-writing-aids-nested-scroll"
        style="max-height: 38rem; overflow: auto"
      >
        <el-markdown-editor
          ref="markdownWritingAidsEditor"
          v-model="markdownWritingAidsValue"
          editor-profile="prose"
          :mode="markdownWritingAidsMode"
          :min-rows="12"
          :show-actions="false"
          :show-mode-switcher="false"
          :writing-aids="markdownWritingAidsOptions"
        />
      </div>
      <button
        type="button"
        data-testid="markdown-reveal-details"
        @click="revealMarkdownDetails"
      >
        Reveal details
      </button>
      <button
        type="button"
        data-testid="markdown-reveal-virtual"
        @click="revealVirtualMarkdownDetails"
      >
        Reveal virtual details
      </button>
      <button
        type="button"
        data-testid="markdown-reveal-missing"
        @click="revealMissingMarkdownHeading"
      >
        Reveal missing heading
      </button>
      <button
        v-for="mode in markdownWritingAidsModes"
        :key="mode"
        type="button"
        :data-testid="`markdown-mode-${mode}`"
        @click="markdownWritingAidsMode = mode"
      >
        {{ mode }}
      </button>
      <output data-testid="markdown-reveal-status">{{
        markdownRevealStatus
      }}</output>
    </section>

    <div v-if="!markdownEditorTableEvidenceFixture" class="audit-grid">
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
          <el-checkbox-button label="A">推送到首页</el-checkbox-button>
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
            发布前检查摘要
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

      <AuditCard name="ElCollectionToolbar" :state="auditState">
        <ElCollectionToolbar ariaLabel="Collection controls" density="compact">
          <template #primary>
            <el-input
              :model-value="activeText"
              placeholder="Search"
              data-audit-focus
              data-audit-target
            />
          </template>
          <template #filters>
            <ElFilterGroup label="State" density="compact">
              <ElSegmentedControl
                :model-value="active ? 'open' : 'all'"
                :items="collectionStateItems"
                ariaLabel="Filter state"
                density="compact"
              />
            </ElFilterGroup>
          </template>
          <template #actions>
            <el-button data-audit-active data-audit-target>Refresh</el-button>
          </template>
        </ElCollectionToolbar>
        <ElCollectionSummary
          title="Results"
          :total="12"
          :visible="active ? 3 : 12"
          :state="active ? 'Filtered' : ''"
          density="compact"
        />
        <ElPaginationBar ariaLabel="Results pagination" density="compact">
          <template #summary>Page 1 of 4</template>
          <template #pagination>
            <el-pagination small layout="prev, pager, next" :total="40" />
          </template>
        </ElPaginationBar>
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
          <el-descriptions-item label="文章状态">
            等待复核
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
              <el-dropdown-item :divided="active">
                导出 Markdown
              </el-dropdown-item>
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

      <AuditCard name="ElMetricList" :state="auditState">
        <div class="audit-metric-primitives">
          <ElKpiGroup :density="compact ? 'compact' : 'default'">
            <ElMetricList :density="compact ? 'compact' : 'default'">
              <ElMetricItem
                label="Metric Alpha"
                primary="P75 22ms"
                secondary="Avg 23ms"
                meta="58 samples"
                :density="compact ? 'compact' : 'default'"
              />
              <ElMetricItem
                label="Metric Beta"
                primary="99.4%"
                secondary="Target 99%"
                meta="12 checks"
                :density="compact ? 'compact' : 'default'"
              />
            </ElMetricList>

            <ElKeyValueGrid :density="compact ? 'compact' : 'default'">
              <ElKeyValueItem label="State" value="Ready" tone="success" />
              <ElKeyValueItem label="Queue" value="0 / 0" monospace />
            </ElKeyValueGrid>
          </ElKpiGroup>

          <ElDistributionList :density="compact ? 'compact' : 'default'">
            <ElDistributionBarRow
              rank="1"
              label="Segment Alpha"
              value="245"
              :ratio="1"
              :density="compact ? 'compact' : 'default'"
            />
            <ElDistributionBarRow
              rank="2"
              label="Segment Beta"
              value="106"
              :ratio="0.43"
              :density="compact ? 'compact' : 'default'"
            />
          </ElDistributionList>

          <ElStatusSummary
            label="Generic status"
            status="Stable"
            updated-at="2026-06-14 20:30"
            tone="success"
            :density="compact ? 'compact' : 'default'"
          >
            <template #detail>Product-owned detail copy.</template>
            <template #actions>
              <el-button size="small">Inspect</el-button>
            </template>
          </ElStatusSummary>

          <ElDiagnosticsList :density="compact ? 'compact' : 'default'">
            <ElDiagnosticsItem
              title="diagnostic.event"
              message="Recent event summary."
              meta="warning - 17:48:11 - 3 times"
              detail="diagnostic-node:runCheck:sample-0001"
              tone="warning"
              :density="compact ? 'compact' : 'default'"
            >
              <template #actions>
                <ElCopyableDetail
                  value="diagnostic-node:runCheck:sample-0001"
                  label="Copy detail"
                  inline
                >
                  <template #button>
                    <span data-audit-focus data-audit-target data-audit-active>
                      Copy
                    </span>
                  </template>
                </ElCopyableDetail>
              </template>
            </ElDiagnosticsItem>
          </ElDiagnosticsList>
        </div>
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
                title="关于评论权限的讨论"
                preview="长摘要内容仍然需要留在列表列宽内"
                meta="09:00"
                selected
                :unread-count="active ? 3 : 1"
              />
              <ElConversationListItem
                title="下周封面图评审"
                preview="第二条工作流摘要保持安全换行"
                meta="10:30"
              />
            </ElConversationList>
          </template>
          <template #detail>
            <ElThreadPanel title="评论权限讨论">
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
          :model-value="active ? 'private' : ''"
          placeholder="选择发布范围"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option label="公开" value="public" />
          <el-option label="仅自己可见" value="private" />
        </el-select>
      </AuditCard>

      <AuditCard name="ElOptionGroup" :state="auditState">
        <el-select
          :model-value="active ? 'homepage' : ''"
          placeholder="选择推荐策略"
          :teleported="false"
          data-audit-focus
          data-audit-target
          data-audit-active
        >
          <el-option-group label="内容分发">
            <el-option label="推送到首页" value="homepage" />
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

      <AuditCard name="ElTaskPageHeader" :state="auditState">
        <ElTaskPageHeader
          title="Review release evidence"
          description="Confirm the final production checks before publishing."
          :density="active ? 'compact' : 'default'"
        >
          <template #actions>
            <el-button data-audit-focus data-audit-target>
              Open evidence
            </el-button>
          </template>
        </ElTaskPageHeader>
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

      <AuditCard name="ElPerceptionChallenge" :state="auditState">
        <div class="audit-perception-stack">
          <ElPerceptionChallenge
            v-for="challenge in perceptionChallenges"
            :key="challenge.challengeId"
            :challenge="challenge"
            :state="active ? 'submitting' : 'ready'"
            title="Challenge review"
            eyebrow="Signal"
            :disabled="auditState === 'interaction'"
            data-audit-active
          />
        </div>
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

      <AuditCard name="ElSectionNav" :state="auditState">
        <div class="audit-settings-primitives">
          <ElSectionNav
            ariaLabel="Settings audit sections"
            :density="compact ? 'compact' : 'default'"
          >
            <a
              class="el-section-nav__link is-current"
              href="#audit-overview"
              aria-current="location"
              data-audit-focus
              data-audit-target
              data-audit-active
            >
              Overview
            </a>
            <a class="el-section-nav__link" href="#audit-resources">
              Resources
            </a>
            <a
              class="el-section-nav__link is-disabled"
              aria-disabled="true"
              tabindex="-1"
            >
              Disabled
            </a>
          </ElSectionNav>

          <ElSettingsSection
            title="Generic settings"
            description="Reusable layout for copy supplied by the product."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <template #actions>
              <el-button size="small">Update</el-button>
            </template>

            <ElSectionHeader
              title="Standalone header"
              description="Header primitive without an eyebrow."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            />

            <ElFormSection
              title="Form group"
              description="Labels and inputs remain owned by the form."
              title-tag="h4"
              :density="compact ? 'compact' : 'default'"
            >
              <label class="audit-settings-field">
                Label
                <input :value="activeText" />
              </label>
            </ElFormSection>

            <ElResourceList :density="compact ? 'compact' : 'default'">
              <ElResourceListItem
                title="Resource Alpha"
                description="Updated recently"
                :density="compact ? 'compact' : 'default'"
              >
                <template #badge>
                  <el-tag size="small" type="info">Ready</el-tag>
                </template>
                <ElMetadataRow :density="compact ? 'compact' : 'default'">
                  <ElMetadataItem label="Created" value="2026-01-01" />
                  <ElMetadataItem label="Fingerprint" monospace />
                </ElMetadataRow>
                <template #actions>
                  <ElInlineActions ariaLabel="Resource actions">
                    <el-button text size="small">Edit</el-button>
                  </ElInlineActions>
                </template>
              </ElResourceListItem>
              <ElResourceListItem title="Empty resource group">
                <ElEmptyState
                  size="inline"
                  title="No resources"
                  description="Add product-owned copy here."
                />
              </ElResourceListItem>
            </ElResourceList>
          </ElSettingsSection>

          <ElDangerZone
            title="Risk area"
            description="Use explicit text in addition to color."
            title-tag="h3"
            :density="compact ? 'compact' : 'default'"
          >
            <ElRiskNotice title="Review" role="note">
              Confirm consequences before continuing.
            </ElRiskNotice>
            <ElDestructiveActionPanel title="Destructive action">
              <template #description>
                Product copy explains the outcome and recovery path.
              </template>
              <template #actions>
                <el-button type="danger" size="small">Continue</el-button>
              </template>
            </ElDestructiveActionPanel>
            <ElTypedConfirmField
              :model-value="active ? 'CONFIRM' : 'CONF'"
              phrase="CONFIRM"
              label="Confirmation phrase"
              description="Type the exact phrase to continue."
            />
          </ElDangerZone>
        </div>
      </AuditCard>

      <AuditCard name="ElSiteHeader" :state="auditState">
        <ElSiteHeader
          :sticky="false"
          max-width="100%"
          ariaLabel="Audit site header"
        >
          <template #brand>
            <a href="#audit-brand" data-audit-focus>FsusUI</a>
          </template>
          <template #desktop-nav>
            <a href="#audit-docs">Docs</a>
            <a href="#audit-components">Components</a>
          </template>
          <template #desktop-actions>
            <el-button size="small" data-audit-target data-audit-active>
              Action
            </el-button>
          </template>
          <template #mobile-primary-actions>
            <el-button size="small">Menu</el-button>
          </template>
        </ElSiteHeader>
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
          :model-value="active ? 'cover-review' : ''"
          :options="selectV2Options"
          placeholder="选择工作流"
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
          <el-step title="撰写" description="整理正文" />
          <el-step title="复核" description="检查权限" />
          <el-step title="发布" description="同步公开页" />
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
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">Drop a file here or <em>browse</em></div>
          <p data-upload-help>PNG/JPG, max 10 MB</p>
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
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import {
  MARKDOWN_PROJECTION_WORKER_REQUEST,
  createMarkdownEditorProjection,
  isMarkdownProjectionWorkerResult,
  markdownEditorProjectionsEquivalent,
  type MarkdownEditorProjectionResult,
  type MarkdownProjectionWorkerRequest,
} from '../../wasm/markdown-runtime'
import {
  ElCollectionSummary,
  ElCollectionToolbar,
  ElConversationContextBar,
  ElConversationList,
  ElConversationListItem,
  ElCopyableDetail,
  ElDangerZone,
  ElDiagnosticsItem,
  ElDiagnosticsList,
  ElDestructiveActionPanel,
  ElDistributionBarRow,
  ElDistributionList,
  ElEmptyState,
  ElFilterGroup,
  ElFormSection,
  ElInboxLayout,
  ElInlineActions,
  ElKeyValueGrid,
  ElKeyValueItem,
  ElKpiGroup,
  ElMessageBox,
  ElMetadataItem,
  ElMetadataRow,
  ElMessageBubble,
  ElMessageTimeline,
  ElMetricItem,
  ElMetricList,
  ElPaginationBar,
  ElPerceptionChallenge,
  ElReplyComposerShell,
  ElResourceList,
  ElResourceListItem,
  ElRiskNotice,
  ElSegmentedControl,
  ElSectionHeader,
  ElSectionNav,
  ElSettingsSection,
  ElSiteHeader,
  ElStatusSummary,
  ElTaskPageHeader,
  ElThreadPanel,
  ElTypedConfirmField,
} from '../../element-plus'
import type {
  MarkdownEmbedProvider,
  MarkdownEmbedRequest,
  MarkdownAttachmentBatchIntent,
  MarkdownEditorDispatchResult,
  MarkdownEditorHistoryState,
  MarkdownEditorInstance,
  MarkdownEditorLocaleTextOverride,
  MarkdownEditorMode,
  MarkdownEditorSelectionEvent,
  MarkdownEditorTransactionEvent,
} from '../../element-plus'
import AuditCard from './AuditCard.vue'
import {
  auditComponentNames,
  auditStateNames,
  type UiAuditState,
} from './ui-audit-manifest'

const { ArrowDown, ArrowLeft, ArrowRight, Search, UploadFilled } = Icons

const markdownProjectionSource = ref(
  '![初始 alt](/old.png "old title")\n::caption[说明 😀 RTL אב]',
)
const markdownProjectionFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownProjection') === '1'
const summarizeMarkdownProjection = (
  projection: MarkdownEditorProjectionResult,
) =>
  Object.freeze({
    identity: projection.identity,
    kinds: projection.nodes.map((node) => node.kind),
    nodes: projection.nodes
      .filter((node) => node.kind === 'image' || node.kind === 'caption')
      .map((node) => ({
        blockIdentity: node.blockIdentity,
        kind: node.kind,
        normalizedContentRanges: node.normalizedContentRanges,
        normalizedMarkerRanges: node.normalizedMarkerRanges,
        normalizedRange: node.normalizedRange,
        presentation: node.presentation,
        rawContentRanges: node.rawContentRanges,
        rawMarkerRanges: node.rawMarkerRanges,
        rawRange: node.rawRange,
        status: node.status,
      })),
  })
const markdownProjectionMain = markdownProjectionFixture
  ? createMarkdownEditorProjection(markdownProjectionSource.value)
  : null
const markdownProjectionMainSummary = markdownProjectionMain
  ? summarizeMarkdownProjection(markdownProjectionMain)
  : null
const markdownProjectionWorkerSummary = ref<
  | (ReturnType<typeof summarizeMarkdownProjection> & {
      readonly equivalent: boolean
    })
  | { readonly error: string }
  | { readonly status: 'pending' }
>({ status: 'pending' })
let markdownProjectionWorker: Worker | null = null

if (markdownProjectionFixture && markdownProjectionMain) {
  const documentIdentity = Object.freeze({
    epoch: 1,
    id: 'built-demo-projection',
  })
  const request: MarkdownProjectionWorkerRequest = {
    type: MARKDOWN_PROJECTION_WORKER_REQUEST,
    taskId: 'built-demo-projection:1',
    revision: 1,
    documentIdentity,
    source: markdownProjectionSource.value,
    plan: {
      taskId: 'built-demo-projection:1',
      revision: 1,
      documentIdentity,
      expanded: true,
      reason: 'expanded-unsafe',
      invalidatedRanges: [],
      invalidatedNodeIds: [],
      retainedNodeIds: [],
    },
    previous: {
      documentIdentity,
      normalizedSource: '',
      nodes: [],
    },
  }
  markdownProjectionWorker = new Worker(
    new URL('../../wasm/markdown-projection.worker.ts', import.meta.url),
    { type: 'module' },
  )
  markdownProjectionWorker.addEventListener('message', ({ data }) => {
    if (!isMarkdownProjectionWorkerResult(data)) {
      markdownProjectionWorkerSummary.value = {
        error: 'invalid projection worker result',
      }
      return
    }
    markdownProjectionWorkerSummary.value = {
      ...summarizeMarkdownProjection(data.projection),
      equivalent: markdownEditorProjectionsEquivalent(
        markdownProjectionMain,
        data.projection,
      ),
    }
  })
  markdownProjectionWorker.addEventListener('error', ({ message }) => {
    markdownProjectionWorkerSummary.value = {
      error: message || 'projection worker failed',
    }
  })
  markdownProjectionWorker.postMessage(request)
}

onUnmounted(() => {
  markdownProjectionWorker?.terminate()
})

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

const markdownEditorTransactionFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorTransaction',
  ) === '1'
const markdownLanguageToolsFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownLanguageTools') ===
    '1'
const markdownWritingAidsFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownWritingAids') === '1'
const markdownWritingAidsCombo =
  typeof window === 'undefined'
    ? 'both'
    : new URLSearchParams(window.location.search).get(
        'markdownWritingAidsCombo',
      ) ?? 'both'
const markdownWritingAidsOptions = {
  focus:
    markdownWritingAidsCombo === 'focus' || markdownWritingAidsCombo === 'both',
  typewriter:
    markdownWritingAidsCombo === 'typewriter' ||
    markdownWritingAidsCombo === 'both',
}
const markdownEditorImeFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownEditorIme') === '1'
const markdownEditorTableFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownEditorTable') === '1'
const markdownEditorTableEvidenceFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorTableEvidence',
  ) === '1'
const markdownEditorTableMatrixFixture =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(
        'markdownEditorTableMatrix',
      )
    : null
const markdownEditorModeMatrixFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownEditorModeMatrix') ===
    '1'
const markdownEditorRequestedMode =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownEditorMode')
    : null
const markdownTableMatrix = (rows: number, columns: number) => {
  const header = Array.from(
    { length: columns },
    (_, column) => `Column ${column + 1}`,
  )
  const separator = Array.from({ length: columns }, () => '---')
  const body = Array.from({ length: rows }, (_, row) =>
    Array.from(
      { length: columns },
      (_, column) => `r${row + 1}c${column + 1}`,
    ),
  )
  return [header, separator, ...body]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n')
}
const defaultMarkdownTable = [
  '| Project | Owner | Status |',
  '| --- | --- | --- |',
  '| Documentation migration | Editorial systems | In review |',
  '| Runtime projection | Platform team | Ready |',
].join('\n')
const markdownEditorTableValue =
  markdownEditorTableMatrixFixture === '20x50'
    ? markdownTableMatrix(50, 20)
    : markdownEditorTableMatrixFixture === '1x1'
      ? markdownTableMatrix(1, 1)
      : markdownEditorTableMatrixFixture === 'large'
        ? [
            ...Array.from(
              { length: 500 },
              (_, index) => `Paragraph before table ${index + 1}.`,
            ),
            '',
            defaultMarkdownTable,
            '',
            ...Array.from(
              { length: 500 },
              (_, index) => `Paragraph after table ${index + 1}.`,
            ),
          ].join('\n')
        : defaultMarkdownTable
const markdownSearchEmbedFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownSearchEmbed') ===
    '1'
const markdownSearchEmbedTouch =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownSearchEmbedTouch',
  ) === '1'
const markdownCommandSurfacesFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownCommandSurfaces') ===
    '1'
const markdownContextualSurface =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownContextual')
    : null
const markdownCommandLocale =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownLocale')
    : null
const markdownCommandDirection =
  markdownCommandLocale === 'ar' || markdownCommandLocale === 'he'
    ? 'rtl'
    : 'ltr'
const markdownCommandStatusDensity =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownStatus') ===
    'detailed'
    ? 'detailed'
    : typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('markdownStatus') ===
          'none'
      ? 'none'
      : 'minimal'
const markdownCommandMobileLayout =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownMobile') ===
    'compact'
    ? 'compact'
    : 'standard'
const markdownCommandLocaleText = computed<
  MarkdownEditorLocaleTextOverride | undefined
>(() => {
  if (!markdownCommandLocale) return undefined
  const prefix =
    markdownCommandLocale === 'long'
      ? 'A deliberately extended localization fixture that preserves every semantic label'
      : markdownCommandLocale.toUpperCase()
  const label = (value: string) => `${prefix} ${value}`
  return {
    commandGroups: {
      block: label('block'),
      format: label('format'),
      insert: label('insert'),
    },
    commandPalette: {
      empty: label('empty'),
      results: (count: number) => label(`${count} results`),
      searchPlaceholder: label('search commands'),
      title: label('command palette'),
    },
    commands: {
      bold: label('bold'),
      code: label('code'),
      heading: label('heading'),
      image: label('image'),
      italic: label('italic'),
      link: label('link'),
      quote: label('quote'),
    },
    contextual: {
      anchorId: label('anchor ID'),
      apply: label('apply'),
      cancel: label('cancel'),
      copy: label('copy'),
      destination: label('destination'),
      editAnchor: label('edit anchor'),
      editLink: label('edit link'),
      invalidAnchor: label('invalid anchor'),
      insertAnchor: label('insert anchor'),
      label: label('label'),
      open: label('open'),
      removeAnchor: label('remove anchor'),
      removeLink: label('remove link'),
      sourceReveal: label('reveal source'),
      title: label('title'),
      unsafeUrl: label('unsafe URL'),
    },
    editorAria: label('Markdown editor'),
    metrics: {
      bytes: label('bytes'),
      characters: label('characters'),
      column: label('column'),
      line: label('line'),
      lines: label('lines'),
      selected: label('selected'),
      words: label('words'),
    },
    states: {
      disabled: label('disabled'),
      empty: label('empty'),
      loading: label('loading'),
      readonly: label('readonly'),
    },
    overflow: label('format tools'),
    overflowAria: (count: number) => label(`${count} format tools`),
    pasteAsMarkdown: {
      title: label('paste as Markdown'),
    },
    surfaces: {
      commandPending: label('command pending'),
      commandRejected: label('command rejected'),
      selectionToolbar: label('selection toolbar'),
      slashMenu: label('slash menu'),
    },
    textarea: {
      live: label('live editor'),
      source: label('source editor'),
    },
  }
})
const markdownEditorInteractionProfile =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorInteractionProfile',
  ) === 'keyboard'
    ? ('keyboard' as const)
    : undefined
const markdownPasteGate =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownPasteGate')
    : null
const markdownEditorDefaultMode =
  markdownPasteGate === 'preview-only'
    ? 'preview'
    : markdownEditorRequestedMode === 'live' ||
        markdownEditorRequestedMode === 'split' ||
        markdownEditorRequestedMode === 'preview'
      ? markdownEditorRequestedMode
      : 'source'
const markdownPasteGateAttributes = computed(() =>
  markdownPasteGate === 'readonly' ? { readonly: true } : {},
)
const markdownEditorDelayMount =
  typeof window !== 'undefined'
    ? Number(
        new URLSearchParams(window.location.search).get(
          'markdownEditorDelayMount',
        ) ?? 0,
      )
    : 0
const markdownEditorMountReady = ref(markdownEditorDelayMount === 0)
const markdownEditorProbeKey = 'fsus-markdown-editor-probe-id'
const createMarkdownEditorProbeId = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `markdown-editor-probe-${Math.random().toString(36).slice(2)}`
const markdownEditorProbeId = (() => {
  try {
    const existing = window.sessionStorage.getItem(markdownEditorProbeKey)
    if (existing) return existing
    const created = createMarkdownEditorProbeId()
    window.sessionStorage.setItem(markdownEditorProbeKey, created)
    return created
  } catch {
    return createMarkdownEditorProbeId()
  }
})()
if (markdownEditorDelayMount > 0) {
  window.setTimeout(() => {
    markdownEditorMountReady.value = true
  }, markdownEditorDelayMount)
}
const markdownTransactionEditor = ref<MarkdownEditorInstance>()
const markdownWritingAidsEditor = ref<MarkdownEditorInstance>()
const markdownWritingAidsModes = ['source', 'live', 'split', 'preview'] as const
const markdownWritingAidsMode = ref<'source' | 'live' | 'split' | 'preview'>(
  'source',
)
const markdownWritingAidsDirection =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownDirection') === 'rtl'
    ? 'rtl'
    : 'ltr'
const markdownWritingAidsHeadingCount =
  typeof window === 'undefined'
    ? 0
    : Math.min(
        10_000,
        Math.max(
          0,
          Number(
            new URLSearchParams(window.location.search).get(
              'markdownHeadingCount',
            ) ?? 0,
          ),
        ),
      )
const markdownWritingAidsValue = ref(
  [
    '# Writing session',
    ...Array.from(
      { length: markdownWritingAidsHeadingCount },
      (_, index) => `## Section ${index + 1}`,
    ),
    ...Array.from(
      { length: 18 },
      (_, index) =>
        `Paragraph ${index + 1} keeps the document realistic and scrollable.`,
    ),
    '::embed[target="details" mode="block"]',
    'The selected section remains readable while surrounding blocks stay present.',
  ].join('\n\n'),
)
const markdownRevealStatus = ref('idle')
const markdownWritingAidsMarker = '::embed[target="details" mode="block"]'
const revealMarkdownDetails = () => {
  const start = markdownWritingAidsValue.value.indexOf(
    markdownWritingAidsMarker,
  )
  const status =
    markdownWritingAidsEditor.value?.revealSourceRange({
      start,
      end: start + markdownWritingAidsMarker.length,
    }) ?? 'missing-method'
  markdownRevealStatus.value = `${start}:${status}`
}
const revealVirtualMarkdownDetails = () => {
  const start = markdownWritingAidsValue.value.indexOf(
    markdownWritingAidsMarker,
  )
  const documentId =
    document
      .querySelector(
        '[data-testid="markdown-writing-aids-fixture"] [data-markdown-instance]',
      )
      ?.getAttribute('data-markdown-instance') ?? 'missing-document'
  const nodeId = 'fixture:virtual:details'
  const status =
    markdownWritingAidsEditor.value?.revealHeading(nodeId, {
      virtualTarget: {
        anchorId: nodeId,
        documentIdentity: { id: documentId, epoch: 0 },
        identity: documentId,
        range: {
          start,
          end: start + markdownWritingAidsMarker.length,
        },
        virtual: true,
      },
    }) ?? 'missing-method'
  markdownRevealStatus.value = `virtual:${status}`
}
const revealMissingMarkdownHeading = () => {
  const status =
    markdownWritingAidsEditor.value?.revealHeading('fixture:missing:heading') ??
    'missing-method'
  markdownRevealStatus.value = `missing:${status}`
}
const markdownTransactionValue = ref(
  markdownEditorImeFixture
    ? ''
    : markdownEditorTableFixture
      ? markdownEditorTableValue
      : markdownContextualSurface === 'link'
        ? '[Docs](https://old.test "Title")'
        : markdownContextualSurface === 'anchor'
          ? 'Paragraph ^intro'
          : markdownCommandSurfacesFixture
            ? '/bol'
            : 'A😀éאב\n- 列表',
)
const markdownTransactionHistory = ref<MarkdownEditorHistoryState>({
  canRedo: false,
  canUndo: false,
  redoDepth: 0,
  retainedUnits: 0,
  undoDepth: 0,
})
const markdownLastTransaction = ref<MarkdownEditorTransactionEvent | null>(null)
const markdownTransactionSelection = ref<MarkdownEditorSelectionEvent | null>(
  null,
)
const markdownAttachmentBatch = ref<MarkdownAttachmentBatchIntent | null>(null)
const markdownAttachmentBatchSnapshot = computed(() => {
  const batch = markdownAttachmentBatch.value
  if (!batch) return null
  return {
    anchor: batch.anchor,
    batchId: batch.batchId,
    items: batch.items.map(
      ({ byteLength, itemId, kind, mimeType, name, order }) => ({
        byteLength,
        itemId,
        kind,
        mimeType,
        name,
        order,
      }),
    ),
    revision: batch.revision,
    sourceKind: batch.sourceKind,
  }
})
const markdownTransactionRevision = computed(
  () => markdownLastTransaction.value?.revision ?? 0,
)
let markdownPlaceholderRevision: number | undefined

const recordMarkdownTransaction = (event: MarkdownEditorTransactionEvent) => {
  markdownLastTransaction.value = event
}

const recordMarkdownAttachmentBatch = (
  batch: MarkdownAttachmentBatchIntent,
) => {
  markdownAttachmentBatch.value = batch
}

const progressMarkdownAttachmentFixture = () => {
  const batch = markdownAttachmentBatch.value
  const item = batch?.items[0]
  if (!batch || !item) return
  markdownTransactionEditor.value?.applyAttachmentResult({
    batchId: batch.batchId,
    itemId: item.itemId,
    ratio: 0.5,
    status: 'progress',
  })
}

const resolveMarkdownAttachmentFixture = () => {
  const batch = markdownAttachmentBatch.value
  const item = batch?.items[0]
  if (!batch || !item) return
  markdownTransactionEditor.value?.applyAttachmentResult({
    batchId: batch.batchId,
    documentIdentity: batch.documentIdentity,
    itemId: item.itemId,
    payload: {
      alt: 'Resolved attachment',
      href: '/fixtures/resolved-attachment.png',
      markdownKind: 'image',
      mimeType: item.mimeType,
      name: item.name,
    },
    revision: batch.revision,
    status: 'resolved',
  })
}

const loadMarkdownFigureFixture = () => {
  markdownTransactionValue.value =
    '![初始 alt](/old.png "old title")\n::caption[说明 😀 RTL אב]'
}

const insertMarkdownFixture = () => {
  markdownTransactionEditor.value?.insertMarkdownAtCursor('【程序插入】', {
    metadata: { fixture: 'programmatic' },
  })
}

const insertMarkdownPlaceholder = () => {
  const from = markdownTransactionValue.value.length
  const result = markdownTransactionEditor.value?.dispatchTransaction({
    changes: [{ from, insert: '![uploading]', to: from }],
    history: 'separate',
    metadata: { fixture: 'placeholder' },
    origin: 'programmatic',
    selection: { end: from + 12, start: from + 12 },
  }) as MarkdownEditorDispatchResult | undefined
  if (result?.accepted) markdownPlaceholderRevision = result.revision
}

const replaceMarkdownPlaceholder = () => {
  const index = markdownTransactionValue.value.indexOf('![uploading]')
  if (index < 0 || markdownPlaceholderRevision === undefined) return
  const replacement = '![完成](asset.png)'
  markdownTransactionEditor.value?.dispatchTransaction({
    changes: [
      {
        from: index,
        insert: replacement,
        to: index + '![uploading]'.length,
      },
    ],
    expectedRevision: markdownPlaceholderRevision,
    history: 'separate',
    metadata: { fixture: 'async-replacement' },
    origin: 'programmatic',
    selection: {
      direction: 'none',
      end: index + replacement.length,
      start: index + replacement.length,
    },
  })
}

const dispatchStaleMarkdownReplacement = () => {
  markdownTransactionEditor.value?.dispatchTransaction({
    changes: [{ from: 0, insert: 'STALE', to: 0 }],
    expectedRevision: markdownPlaceholderRevision ?? 0,
    history: 'separate',
    metadata: { fixture: 'stale-replacement' },
    origin: 'programmatic',
    selection: { direction: 'none', end: 5, start: 5 },
  })
}

const loadLargeMarkdownDocument = () => {
  markdownTransactionValue.value = '界'.repeat(100_000)
}

const markdownSearchEmbedModes = [
  'source',
  'live',
  'split',
  'preview',
] as const satisfies readonly MarkdownEditorMode[]
const markdownSearchEmbedInitialValue = [
  '# Search and embed review',
  '',
  'alpha café 😀 אב alpha',
  '',
  '::embed[target="safe-doc" mode="article"]',
  '',
  '::embed[target="missing-doc" mode="heading"]',
  '',
  '::embed[target="forbidden-doc" mode="block"]',
  '',
  '::embed[target="cycle-doc" mode="article"]',
  '',
  '::embed[target="depth-doc" mode="heading"]',
  '',
  '::embed[target="mismatch-doc" mode="block"]',
  '',
  '::embed[target="pending-doc" mode="block"]',
  '',
  '::embed[target="stale-doc" mode="article"]',
  '',
  'Trailing alpha content.',
].join('\n')
const markdownSearchEmbedEditor = ref<MarkdownEditorInstance>()
const markdownSearchEmbedValue = ref(markdownSearchEmbedInitialValue)
const markdownSearchEmbedMode = ref<MarkdownEditorMode>('source')
const markdownSearchEmbedEpoch = ref(1)
const markdownSearchEmbedResolveFailure = ref(false)
const markdownSearchEmbedLastRequest = ref<MarkdownEmbedRequest | null>(null)
const markdownSearchEmbedLastOpen = ref('')
const markdownSearchEmbedLastRetry = ref('')
const markdownSearchEmbedHistory = ref<MarkdownEditorHistoryState>({
  canRedo: false,
  canUndo: false,
  redoDepth: 0,
  retainedUnits: 0,
  undoDepth: 0,
})
const markdownSearchEmbedSelection = ref<MarkdownEditorSelectionEvent | null>(
  null,
)
const markdownSearchEmbedProvider: MarkdownEmbedProvider = async (request) => {
  markdownSearchEmbedLastRequest.value = request
  const localFailureStatus = {
    'cycle-doc': 'cycle',
    'depth-doc': 'depth-exceeded',
    'forbidden-doc': 'forbidden',
    'mismatch-doc': 'mode-mismatch',
  } as const
  const failureStatus =
    localFailureStatus[request.target as keyof typeof localFailureStatus]
  if (failureStatus) {
    return Object.freeze({
      ...request,
      status: failureStatus,
    })
  }
  if (request.target === 'pending-doc') {
    return Object.freeze({
      ...request,
      status: 'pending' as const,
    })
  }
  if (request.target === 'stale-doc') {
    return Object.freeze({
      ...request,
      excerpt: 'This stale payload must not render.',
      revision: request.revision + 1,
      status: 'resolved' as const,
      title: 'Stale payload',
    })
  }
  if (
    request.target === 'missing-doc' &&
    !markdownSearchEmbedResolveFailure.value
  ) {
    return Object.freeze({
      ...request,
      status: 'missing' as const,
    })
  }
  return Object.freeze({
    ...request,
    excerpt:
      request.target === 'missing-doc'
        ? 'Recovered heading after an explicit retry.'
        : 'Resolved excerpt with <strong>literal provider markup</strong> and a long line that verifies wrapping without a nested scroll surface.',
    status: 'resolved' as const,
    title:
      request.target === 'missing-doc'
        ? 'Recovered heading'
        : 'Safe consumer document',
  })
}
const switchMarkdownSearchEmbedDocument = () => {
  markdownSearchEmbedEpoch.value += 1
  markdownSearchEmbedLastRequest.value = null
  markdownSearchEmbedLastOpen.value = ''
  markdownSearchEmbedLastRetry.value = ''
}
const loadMarkdownSearchPerformanceFixture = () => {
  const exactMatches = 'hit '.repeat(10_000)
  markdownSearchEmbedValue.value = `${exactMatches}${'界'.repeat(
    Math.max(0, 100_000 - exactMatches.length),
  )}`
}
const resetMarkdownSearchEmbedFixture = () => {
  markdownSearchEmbedValue.value = markdownSearchEmbedInitialValue
  markdownSearchEmbedMode.value = 'source'
  markdownSearchEmbedResolveFailure.value = false
  markdownSearchEmbedLastOpen.value = ''
  markdownSearchEmbedLastRetry.value = ''
  markdownSearchEmbedEpoch.value += 1
}

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
const auditRootDataAttributes = computed(
  () =>
    ({
      'data-audit-ready': 'true',
      'data-audit-state': auditState.value,
    }) satisfies Record<`data-${string}`, string>,
)
const safeAreaDataAttributes = {
  lab: { 'data-safe-area-lab': '' },
  openOverlay: { 'data-safe-area-open': 'overlay' },
  openDialog: { 'data-safe-area-open': 'dialog' },
  openDialogFullscreen: { 'data-safe-area-open': 'dialog-fullscreen' },
  openMessageBox: { 'data-safe-area-open': 'message-box' },
  openDrawerLtr: { 'data-safe-area-open': 'drawer-ltr' },
  openDrawerRtl: { 'data-safe-area-open': 'drawer-rtl' },
  openDrawerTtb: { 'data-safe-area-open': 'drawer-ttb' },
  openDrawerBtt: { 'data-safe-area-open': 'drawer-btt' },
  openImageViewer: { 'data-safe-area-open': 'image-viewer' },
  actionOverlayClose: { 'data-safe-area-action': 'overlay-close' },
  actionDialogCancel: { 'data-safe-area-action': 'dialog-cancel' },
  actionDialogConfirm: { 'data-safe-area-action': 'dialog-confirm' },
  actionDrawerCancel: { 'data-safe-area-action': 'drawer-cancel' },
  actionDrawerConfirm: { 'data-safe-area-action': 'drawer-confirm' },
} satisfies Record<string, Record<`data-${string}`, string>>
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
const perceptionChallenges = computed(() => [
  {
    challengeId: 'audit-perception-text-task',
    kind: 'text-task' as const,
    prompt: props.boundary ? boundaryText : 'Read the prompt and respond.',
    description: active.value
      ? 'Text answer is submitting.'
      : 'Text task is ready for review.',
  },
  {
    challengeId: 'audit-perception-localization',
    kind: 'localization' as const,
    prompt: props.boundary ? boundaryText : 'Select the marked region.',
    description: active.value
      ? 'Localization answer is submitting.'
      : 'Localization task is ready for review.',
    gridWidth: 120,
    gridHeight: 64,
    renderPayload: {
      kind: 'image-url' as const,
      src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2264%22 viewBox=%220 0 120 64%22%3E%3Crect width=%22120%22 height=%2264%22 fill=%22%23f4f4f5%22/%3E%3Ccircle cx=%2278%22 cy=%2232%22 r=%2210%22 fill=%22%232a599c%22/%3E%3C/svg%3E',
      width: 120,
      height: 64,
      alt: 'Localization target',
    },
  },
  {
    challengeId: 'audit-perception-micro-interaction',
    kind: 'micro-interaction' as const,
    prompt: props.boundary ? boundaryText : 'Confirm the interaction.',
    description: active.value
      ? 'Micro-interaction answer is submitting.'
      : 'Micro-interaction task is ready for review.',
    microInteractionEnabled: true,
  },
])
const collectionStateItems = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
]
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

type SafeDrawerDirection = 'ltr' | 'rtl' | 'ttb' | 'btt'
const safeOverlayVisible = ref(false)
const safeDialogVisible = ref(false)
const safeDialogFullscreen = ref(false)
const safeDrawerVisible = ref(false)
const safeDrawerDirection = ref<SafeDrawerDirection>('rtl')
const safeImageViewerVisible = ref(false)
const safeAreaLongParagraphCount = 20
const safeImageViewerUrls = computed(() => [imageData.value, imageData.value])

const openSafeDialog = (fullscreen: boolean) => {
  safeDialogFullscreen.value = fullscreen
  safeDialogVisible.value = true
}

const openSafeDrawer = (direction: SafeDrawerDirection) => {
  safeDrawerDirection.value = direction
  safeDrawerVisible.value = true
}

const openSafeMessageBox = () => {
  const message = Array.from(
    { length: safeAreaLongParagraphCount },
    (_, index) =>
      `Safe-area MessageBox paragraph ${index + 1}. Short viewports must scroll to reach confirm/cancel.`,
  ).join('\n\n')

  void ElMessageBox.confirm(message, 'Safe-area MessageBox', {
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    distinguishCancelAndClose: true,
    closeOnClickModal: false,
    customClass: 'audit-safe-area-message-box',
  }).catch(() => undefined)
}

const resetSafeAreaSurfaces = () => {
  safeOverlayVisible.value = false
  safeDialogVisible.value = false
  safeDialogFullscreen.value = false
  safeDrawerVisible.value = false
  safeImageViewerVisible.value = false
  ElMessageBox.close()
}

watch(auditState, () => {
  transitionVisible.value = false
  dialogVisible.value = false
  drawerVisible.value = false
  imageViewerVisible.value = false
  resetSafeAreaSurfaces()
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
const selectV2BaseOptions = [
  ['draft-review', '草稿评审'],
  ['cover-review', '封面图复核'],
  ['publish-schedule', '发布排期'],
  ['comment-permission', '评论权限'],
  ['archive-policy', '归档策略'],
  ['homepage-feature', '首页推荐'],
] as const
const selectV2Options = computed(() => {
  if (!props.boundary) {
    return selectV2BaseOptions.map(([value, label]) => ({ value, label }))
  }

  return Array.from({ length: 24 }, (_, idx) => {
    const [value, label] = selectV2BaseOptions[idx % selectV2BaseOptions.length]
    return {
      value: idx === 1 ? 'cover-review' : `${value}-${idx + 1}`,
      label: `${label} - ${boundaryText}`,
    }
  })
})
const transferLabels = [
  '同步成员权限',
  '发布前校对',
  '更新封面图',
  '复核评论设置',
  '写入审计记录',
  '刷新搜索索引',
  '生成分享摘要',
  '同步首页推荐',
  '校验附件大小',
  '通知协作者',
  '归档过期草稿',
  '检查外链状态',
  '更新标签分组',
  '预热公开缓存',
  '记录发布说明',
  '检查摘要长度',
  '更新发布时间',
  '生成回滚说明',
]
const transferData = computed(() =>
  transferLabels.slice(0, props.boundary ? 18 : 6).map((label, idx) => ({
    key: idx + 1,
    label: props.boundary ? `${label} - ${boundaryText}` : label,
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
