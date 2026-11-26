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


    <AuditMarkdownFixtures />

    <div v-if="!markdownEditorTableEvidenceFixture" class="audit-grid">
      <AuditGridCoreCards :audit-state="auditState" :data="gridData" />
      <AuditGridLayoutAndInputCards
        :audit-state="auditState"
        :compact="compact"
        :data="gridData"
      />
      <AuditGridDataAndFeedbackCards
        :audit-state="auditState"
        :boundary="boundary"
        :compact="compact"
        :data="gridData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from '../../element-plus'
import {
  auditComponentNames,
  auditStateNames,
  type UiAuditState,
} from './ui-audit-manifest'
import AuditGridCoreCards from './audit-fixtures/AuditGridCoreCards.vue'
import AuditGridDataAndFeedbackCards from './audit-fixtures/AuditGridDataAndFeedbackCards.vue'
import AuditGridLayoutAndInputCards from './audit-fixtures/AuditGridLayoutAndInputCards.vue'
import AuditMarkdownFixtures from './audit-fixtures/AuditMarkdownFixtures.vue'
import { useAuditGridData } from './audit-fixtures/use-audit-grid-data'

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

const markdownEditorTableEvidenceFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorTableEvidence',
  ) === '1'

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

const gridData = useAuditGridData({
  auditState,
  boundary: computed(() => props.boundary),
  theme: computed(() => props.theme),
})

type SafeDrawerDirection = 'ltr' | 'rtl' | 'ttb' | 'btt'
const safeOverlayVisible = ref(false)
const safeDialogVisible = ref(false)
const safeDialogFullscreen = ref(false)
const safeDrawerVisible = ref(false)
const safeDrawerDirection = ref<SafeDrawerDirection>('rtl')
const safeImageViewerVisible = ref(false)
const safeAreaLongParagraphCount = 20
const safeImageViewerUrls = computed(() => [
  gridData.imageData.value,
  gridData.imageData.value,
])

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
  resetSafeAreaSurfaces()
})
</script>
