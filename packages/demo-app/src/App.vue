<script setup lang="ts">
import Layout from './Layout.vue'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { AutocompleteData } from '../../components/autocomplete'
import type { UploadProgressEvent, UploadRequestOptions } from '../../components/upload'
import {
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification,
  ElOverlay,
  ElPopperArrow,
  ElPopperContent,
  ElPopperTrigger,
} from '../../element-plus'
import {
  ArrowLeft,
  Plus,
  Search,
  UploadFilled,
} from '@element-plus/icons-vue'
import { demoComponents } from './demo-components'
import {
  autocompleteDemoAttrs,
  cascaderOptions,
  cityOptions,
  defaultFormModel,
  feedbackCopy,
  gallerySlides,
  galleryUrls,
  rawPopperContentAttrs,
  selectV2Options,
  tableData,
  tableV2Columns,
  tableV2Data,
  timelineItems,
  transferData,
  treeData,
  treeV2Props,
} from './demo-data'
import type { FeedbackTone } from './demo-data'

import type {
  CascaderValue,
  CheckboxGroupValueType,
  CollapseModelValue,
  TabPaneName,
  TransferKey,
} from '../../element-plus'

const {
  FixedSizeList,
  ElAffix,
  ElAlert,
  ElAside,
  ElAutocomplete,
  ElAvatar,
  ElBacktop,
  ElBadge,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElCalendar,
  ElCard,
  ElCarousel,
  ElCarouselItem,
  ElCascader,
  ElCascaderPanel,
  ElCheckbox,
  ElCheckboxGroup,
  ElCheckTag,
  ElCol,
  ElCollapse,
  ElCollapseItem,
  ElCollapseTransition,
  ElColorPicker,
  ElConfigProvider,
  ElContainer,
  ElCountdown,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElFooter,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElImage,
  ElImageViewer,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElMenuItemGroup,
  ElOption,
  ElPageHeader,
  ElPagination,
  ElPopconfirm,
  ElPopover,
  ElPopper,
  ElProgress,
  ElRadio,
  ElRadioGroup,
  ElRate,
  ElResult,
  ElRow,
  ElScrollbar,
  ElSelect,
  ElSelectV2,
  ElSlider,
  ElSkeleton,
  ElSpace,
  ElStatistic,
  ElStep,
  ElSteps,
  ElSubMenu,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTableV2,
  ElTabs,
  ElTag,
  ElText,
  ElTimePicker,
  ElTimeSelect,
  ElTimeline,
  ElTimelineItem,
  ElTooltip,
  ElTransfer,
  ElTree,
  ElTreeSelect,
  ElTreeV2,
  ElUpload,
  ElWatermark,
} = demoComponents

const keyword = ref('')
const querySearch = (query: string, callback: (items: Array<{ value: string }>) => void) => {
  const result = cityOptions
    .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
    .map((value) => ({ value }))
  callback(result)
}

const badgeValue = ref(12)
const checkTagChecked = ref(true)
const sliderValue = ref<number | number[]>(36)
const rateValue = ref(4.5)
const switchValue = ref<boolean | string | number>(true)
const inputNumberValue = ref<number | undefined>(8)
const selectValue = ref('studio')
const selectV2Value = ref('hangzhou')
const radioValue = ref<boolean | string | number>('a')
const checkboxValue = ref<CheckboxGroupValueType>(['设计系统', '移动优先'])
const timeSelectValue = ref<string | undefined>('10:00')
const activeTab = ref<TabPaneName>('summary')
const currentPage = ref(2)
const activeCollapse = ref<CollapseModelValue>(['1'])
const dialogVisible = ref(false)
const drawerVisible = ref(false)
const overlayVisible = ref(false)
const imageViewerVisible = ref(false)
const transitionVisible = ref(true)
const infiniteCount = ref(20)
const directiveLoading = ref(true)
const rawPopperVisible = ref(false)
const rawPopperTriggerRef = ref<HTMLElement>()
const rawPopperContentRef = ref<{
  updatePopper: (shouldUpdateZIndex?: boolean) => void
  popperContentRef?: HTMLElement | { value?: HTMLElement | null } | null
} | null>(null)
const colorValue = ref<string | null>('#050505')
const cascaderValue = ref<CascaderValue>(['guide', 'token'])
const cascaderPanelValue = ref<CascaderValue>(['component', 'button'])
const timeValue = ref(new Date())
const timeRangeValue = ref<[Date, Date]>([
  new Date(),
  new Date(Date.now() + 1000 * 60 * 45),
])
const dateValue = ref(new Date())
const dateRangeValue = ref<[Date, Date]>([
  new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  new Date(),
])
const countdownTarget = ref(Date.now() + 1000 * 60 * 60 * 6)
const treeSelectValue = ref('visual')
const uploadLog = ref('尚未上传文件')
const carouselIndex = ref(0)
const timeoutHandles = new Set<number>()
const activeLoadingInstances = new Set<{ close: () => void }>()

const formModel = reactive({ ...defaultFormModel })
const transferValue = ref<TransferKey[]>([2, 4])

const menuIndex = ref('1-1')

const virtualRows = computed(() =>
  Array.from({ length: 120 }, (_, index) => `虚拟列表第 ${index + 1} 项`)
)

const infiniteRows = computed(() =>
  Array.from({ length: infiniteCount.value }, (_, index) => `无限滚动内容 ${index + 1}`)
)

const scheduleTimeout = (callback: () => void, delay: number) => {
  const timerId = window.setTimeout(() => {
    timeoutHandles.delete(timerId)
    callback()
  }, delay)

  timeoutHandles.add(timerId)
  return timerId
}

const resolveElement = (candidate: unknown) => {
  if (candidate instanceof HTMLElement) {
    return candidate
  }

  if (candidate && typeof candidate === 'object' && 'value' in candidate) {
    const maybeRef = candidate as { value?: unknown }
    return maybeRef.value instanceof HTMLElement ? maybeRef.value : null
  }

  return null
}

const scrollFocusedElementIntoView = (event: FocusEvent) => {
  const target = event.target
  if (target instanceof HTMLElement) {
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })
  }
}

const showSelectFeedback = (value: string) => {
  ElMessage.success(`已选择 ${value}`)
}

const handleAutocompleteSelect = (item: AutocompleteData[number]) => {
  showSelectFeedback(String(item.value ?? ''))
}

const openServiceLoading = () => {
  const instance = ElLoading.service({
    lock: false,
    text: '正在模拟骨架优先加载...',
    background: 'rgba(255,255,255,0.72)',
  })
  activeLoadingInstances.add(instance)
  scheduleTimeout(() => {
    activeLoadingInstances.delete(instance)
    instance.close()
  }, 1200)
}

const openMessageBox = async () => {
  try {
    await ElMessageBox.confirm('确认展示 MessageBox 示例？', '全局确认框')
    ElMessage.success('已确认')
  } catch {
    ElMessage.info('已取消')
  }
}

const openGlobalMessage = (tone: FeedbackTone) => {
  ElMessage({
    type: tone,
    message: feedbackCopy[tone].message,
    showClose: true,
    grouping: true,
  })
}

const openNotification = (tone: FeedbackTone = 'success') => {
  ElNotification({
    title: feedbackCopy[tone].title,
    message: feedbackCopy[tone].notification,
    type: tone,
  })
}

const loadMore = () => {
  if (infiniteCount.value >= 40) return
  infiniteCount.value += 5
}

const toggleDirectiveLoading = () => {
  directiveLoading.value = true
  scheduleTimeout(() => {
    directiveLoading.value = false
  }, 900)
}

const createUploadProgressEvent = (percent: number) => {
  return { percent } as UploadProgressEvent
}

const mockUpload = (options: UploadRequestOptions) => {
  uploadLog.value = `开始上传 ${options.file.name}`
  options.onProgress(createUploadProgressEvent(40))
  return new Promise((resolve) => {
    scheduleTimeout(() => {
      options.onProgress(createUploadProgressEvent(100))
      options.onSuccess({ ok: true, name: options.file.name })
      uploadLog.value = `上传成功：${options.file.name}`
      resolve(true)
    }, 900)
  })
}

const updateRawPopperPosition = () => {
  rawPopperContentRef.value?.updatePopper()
}

const closeRawPopper = () => {
  rawPopperVisible.value = false
}

const toggleRawPopper = async (event?: Event) => {
  event?.preventDefault()
  rawPopperVisible.value = !rawPopperVisible.value

  if (rawPopperVisible.value) {
    await nextTick()
    updateRawPopperPosition()
  }
}

const handleRawPopperKeydown = (event: Event) => {
  if (!(event instanceof KeyboardEvent)) {
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    void toggleRawPopper(event)
    return
  }

  if (event.key === 'Escape') {
    closeRawPopper()
  }
}

const handleRawPopperPointerdown = (event: PointerEvent) => {
  if (!rawPopperVisible.value) return

  const target = event.target
  if (!(target instanceof Node)) return

  const contentEl = resolveElement(rawPopperContentRef.value?.popperContentRef)

  if (
    rawPopperTriggerRef.value?.contains(target)
    || contentEl?.contains(target)
  ) {
    return
  }

  closeRawPopper()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleRawPopperPointerdown)
})

onUnmounted(() => {
  for (const timerId of timeoutHandles) {
    window.clearTimeout(timerId)
  }
  timeoutHandles.clear()

  for (const instance of activeLoadingInstances) {
    instance.close()
  }
  activeLoadingInstances.clear()

  document.removeEventListener('pointerdown', handleRawPopperPointerdown)
})
</script>

<template>
  <el-config-provider size="large">
    <Layout title="FsusUI Minimalist Refactor">
      <div class="demo-catalog">
        <header class="demo-catalog-header">
          <h1>Visual Consistency Refactoring</h1>
          <p class="lead">The Intellectual Minimalist (FsusUI 2026)</p>
          <div class="meta-info">
            <span>Theme: <code>Swiss Graphic Design / Ivy Style</code></span>
            <span>Tokens: <code>Paper White & Ink Black</code></span>
          </div>
        </header>

        <main class="demo-content-grid">
          <section id="components" class="demo-section">
            <h2 class="section-title">Core Atoms</h2>
            
            <div class="demo-grid">
              <article class="demo-card wide">
                <h3>Affix / Backtop / Button</h3>
                <p>吸顶入口、回到顶部与主按钮对焦点环做集中检查。</p>
                <div class="stack">
              <el-affix :offset="84">
                <el-button
                  type="primary"
                  @click="ElMessage('Affix 已触发')"
                >
                  固定主操作
                </el-button>
              </el-affix>
              <el-button plain>
                <el-icon><Plus /></el-icon>
                新建版块
              </el-button>
              <el-button text>
                文本按钮
              </el-button>
            </div>
            <el-backtop
              :right="20"
              :bottom="20"
            />
          </article>

          <article class="demo-card">
            <h3>Alert / Badge / Avatar</h3>
            <p>用于检查信息提示层级与灰阶视觉。</p>
            <div class="semantic-alert-stack alert-cluster">
              <el-alert
                class="neutral-alert"
                title="当前为验收环境"
                description="保持单色基调的同时，用图标、标题和强调边界区分状态。"
                type="info"
                :closable="false"
                show-icon
              />
              <el-alert
                class="neutral-alert"
                title="移动端命中区已提高"
                description="按钮、输入框与层级节点会统一向 44px 左右的可点按尺寸靠拢。"
                type="success"
                :closable="false"
                show-icon
              />
              <el-alert
                class="neutral-alert"
                title="表格需要横向滚动复核"
                description="小屏保留表格结构，不做卡片化重构，重点检查滚动与标题可读性。"
                type="warning"
                :closable="false"
                show-icon
              />
            </div>
            <div class="identity-stack">
              <el-badge
                class="monochrome-badge"
                :value="badgeValue"
              >
                <el-button
                  plain
                  class="surface-button"
                >
                  通知中心
                </el-button>
              </el-badge>
              <div class="avatar-stack">
                <el-avatar
                  class="profile-avatar"
                  :size="48"
                >
                  FS
                </el-avatar>
                <el-avatar
                  class="profile-avatar"
                  :size="48"
                  :src="galleryUrls[1]"
                />
              </div>
            </div>
          </article>

          <article class="demo-card">
            <h3>Breadcrumb / Link / PageHeader</h3>
            <p>微文案、层级路径与返回交互。</p>
            <el-breadcrumb separator="/">
              <el-breadcrumb-item>FsusUI</el-breadcrumb-item>
              <el-breadcrumb-item>Demo</el-breadcrumb-item>
              <el-breadcrumb-item>Review</el-breadcrumb-item>
            </el-breadcrumb>
            <el-page-header
              title="设计验收"
              content="统一入口与微排版检查"
              @back="ElMessage('已触发返回事件')"
            />
            <el-link
              type="primary"
              href="#advanced"
            >
              跳转到高级能力
            </el-link>
          </article>

          <article class="demo-card">
            <h3>Container / Header / Aside / Main / Footer</h3>
            <p>检查布局骨架在小尺寸下是否仍有阅读呼吸感。</p>
            <div class="demo-phone-frame">
              <div class="demo-phone-screen">
                <el-container class="container-showcase">
                  <el-header class="container-showcase__header">
                    <div>
                      <div class="container-showcase__kicker">
                        workspace
                      </div>
                      <strong>FsusUI</strong>
                    </div>
                  </el-header>
                  <el-container class="container-showcase__body">
                    <el-aside
                      width="92px"
                      class="container-showcase__aside"
                    >
                      <span>Aside</span>
                      <small>Navigation</small>
                    </el-aside>
                    <el-main class="container-showcase__main">
                      <div class="container-showcase__panel">
                        <div class="container-showcase__kicker">
                          content
                        </div>
                        <strong>Main</strong>
                        <p>字重、字距与灰阶层次统一回到同一设计系统。</p>
                      </div>
                    </el-main>
                  </el-container>
                  <el-footer class="container-showcase__footer">
                    <span>Footer</span>
                    <small>Meta</small>
                  </el-footer>
                </el-container>
              </div>
            </div>
          </article>

          <article class="demo-card">
            <h3>ConfigProvider / Icon / Text</h3>
            <p>基础配置、图标和排版文本统一展示。</p>
            <ElConfigProvider>
              <div class="stack">
                <el-icon :size="20">
                  <Search />
                </el-icon>
                <el-text type="info">
                  Google Sans + Zinc 字体层级
                </el-text>
                <el-text line-clamp="2">
                  这段文字用于检查截断、灰阶字色与移动端布局是否保持克制的阅读宽度。
                </el-text>
              </div>
            </ElConfigProvider>
          </article>

          <article class="demo-card wide">
            <h3>Watermark / Card / Carousel / Image</h3>
            <p>大面积展示品牌水印、图片与轮播，便于查看毛玻璃与边界处理。</p>
            <el-watermark content="FsusUI">
              <div class="hero-watermark">
                <div class="hero-watermark-grid">
                  <div class="hero-carousel-shell">
                    <el-carousel
                      class="hero-carousel"
                      height="260px"
                      arrow="always"
                      @change="carouselIndex = $event"
                    >
                      <el-carousel-item
                        v-for="slide in gallerySlides"
                        :key="slide.url"
                      >
                        <div class="hero-slide">
                          <div class="hero-slide-copy">
                            <span class="demo-kicker">{{ slide.tag }}</span>
                            <strong>{{ slide.title }}</strong>
                            <p>{{ slide.summary }}</p>
                          </div>
                          <el-image
                            :src="slide.url"
                            fit="cover"
                            class="hero-slide-image"
                          />
                        </div>
                      </el-carousel-item>
                    </el-carousel>
                    <div class="hero-carousel-meta">
                      <span class="demo-kicker">Slide {{ carouselIndex + 1 }} / {{ gallerySlides.length }}</span>
                      <p>Watermark、Carousel 与 Image 分层布局，避免被内层 Card 和容器高度裁切。</p>
                    </div>
                  </div>

                  <el-card
                    shadow="never"
                    class="hero-preview-card"
                  >
                    <div class="hero-preview-head">
                      <span class="demo-kicker">Preview Card</span>
                      <span class="hero-index">0{{ carouselIndex + 1 }}</span>
                    </div>
                    <el-image
                      :src="gallerySlides[carouselIndex].url"
                      fit="cover"
                      class="hero-preview-image"
                    />
                    <p>{{ gallerySlides[carouselIndex].summary }}</p>
                  </el-card>
                </div>
              </div>
            </el-watermark>
          </article>
        </div>
      </section>

      <section
        id="entry"
        class="section"
      >
        <div class="section-head">
          <span class="section-label">Entry</span>
          <h2 class="section-title">
            输入与筛选组件
          </h2>
          <p class="section-desc">
            这一组负责表单、筛选、选择器与时间日期输入，重点看键盘焦点环和移动端间距。
          </p>
        </div>

        <div class="demo-grid">
          <article class="demo-card wide">
            <h3>Form / Input / Autocomplete / InputNumber</h3>
            <p>表单区验证输入、补全与数值输入的连贯性。</p>
            <el-form
              :model="formModel"
              label-width="88px"
            >
              <el-form-item label="项目名">
                <el-input
                  v-model="formModel.project"
                  :prefix-icon="Search"
                  placeholder="输入项目名"
                />
              </el-form-item>
              <el-form-item label="负责人">
                <el-autocomplete
                  v-model="keyword"
                  :fetch-suggestions="querySearch"
                  v-bind="autocompleteDemoAttrs"
                  @select="handleAutocompleteSelect"
                />
              </el-form-item>
              <el-form-item label="数量">
                <el-input-number
                  v-model="inputNumberValue"
                  :min="1"
                  :max="20"
                />
              </el-form-item>
            </el-form>
          </article>

          <article class="demo-card">
            <h3>Checkbox / Radio / Switch / CheckTag</h3>
            <p>对焦点、禁用态和文案间距做快速检查。</p>
            <el-checkbox-group v-model="checkboxValue">
              <el-checkbox label="设计系统" />
              <el-checkbox label="移动优先" />
              <el-checkbox label="A11y" />
            </el-checkbox-group>
            <el-radio-group v-model="radioValue">
              <el-radio label="a">
                方案 A
              </el-radio>
              <el-radio label="b">
                方案 B
              </el-radio>
            </el-radio-group>
            <div class="stack">
              <el-switch
                v-model="switchValue"
                active-text="启用"
                inactive-text="关闭"
              />
              <el-check-tag v-model:checked="checkTagChecked">
                视觉锁定
              </el-check-tag>
            </div>
          </article>

          <article class="demo-card">
            <h3>Select / SelectV2 / Cascader</h3>
            <p>标准选择器、虚拟选择器与级联选择一起检验。</p>
            <el-select
              v-model="selectValue"
              placeholder="选择团队"
              style="width:100%;"
            >
              <el-option
                label="Studio"
                value="studio"
              />
              <el-option
                label="Platform"
                value="platform"
              />
            </el-select>
            <el-select-v2
              v-model="selectV2Value"
              :options="selectV2Options"
              placeholder="选择城市"
              style="width:100%;"
            />
            <el-cascader
              v-model="cascaderValue"
              :options="cascaderOptions"
              style="width:100%;"
            />
          </article>

          <article class="demo-card">
            <h3>CascaderPanel / ColorPicker / Slider</h3>
            <p>面板式级联、颜色选择与连续数值控制。</p>
            <el-cascader-panel
              v-model="cascaderPanelValue"
              :options="cascaderOptions"
            />
            <div class="stack">
              <el-color-picker
                :model-value="colorValue ?? undefined"
                @update:model-value="colorValue = $event"
              />
              <el-slider
                v-model="sliderValue"
                :max="100"
              />
            </div>
          </article>

          <article class="demo-card wide">
            <h3>DatePicker / TimePicker / TimeSelect</h3>
            <p>时间类组件在桌面与手机端的触控命中区域需要一致。</p>
            <div class="stack column">
              <el-date-picker
                v-model="dateValue"
                type="date"
                placeholder="选择日期"
              />
              <el-date-picker
                v-model="dateRangeValue"
                type="daterange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
              />
              <el-time-picker
                v-model="timeValue"
                placeholder="选择时间"
              />
              <el-time-picker
                v-model="timeRangeValue"
                is-range
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
              />
              <el-time-select
                v-model="timeSelectValue"
                start="09:00"
                end="18:00"
                step="00:30"
                placeholder="固定时段"
              />
            </div>
          </article>

          <article class="demo-card">
            <h3>Rate / Transfer / Upload</h3>
            <p>评分、穿梭框与上传使用最小可运行示例。</p>
            <el-rate
              v-model="rateValue"
              allow-half
            />
            <el-transfer
              v-model="transferValue"
              :data="transferData"
              filterable
            />
            <el-upload
              drag
              action="#"
              :http-request="mockUpload"
              :show-file-list="true"
            >
              <el-icon :size="28">
                <UploadFilled />
              </el-icon>
              <div>拖拽文件或点击上传</div>
            </el-upload>
            <el-text type="info">
              {{ uploadLog }}
            </el-text>
          </article>
        </div>
      </section>

      <section
        id="data"
        class="section"
      >
        <div class="section-head">
          <span class="section-label">Data</span>
          <h2 class="section-title">
            数据展示与结构化阅读
          </h2>
          <p class="section-desc">
            以卡片、表格、树、统计和骨架态为主，用于检查阅读节奏、层级与异步占位。
          </p>
        </div>

        <div class="demo-grid">
          <article class="demo-card">
            <h3>Calendar / Statistic / Countdown</h3>
            <p>用于检查强信息密度组件的视觉秩序。</p>
            <el-calendar />
            <div class="stack">
              <el-statistic
                title="通过率"
                :value="96.2"
                suffix="%"
              />
              <el-countdown
                title="发布倒计时"
                :value="countdownTarget"
                format="HH:mm:ss"
              />
            </div>
          </article>

          <article class="demo-card">
            <h3>Descriptions / Result / Empty</h3>
            <p>说明性组件与结果页组件。</p>
            <div class="semantic-data-stack">
              <el-descriptions
                class="monochrome-descriptions"
                :column="1"
                border
              >
                <el-descriptions-item label="主题">
                  极简黑白灰
                </el-descriptions-item>
                <el-descriptions-item label="主强调">
                  Brand Black
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                  Ready
                </el-descriptions-item>
                <el-descriptions-item label="适配">
                  Mobile
                </el-descriptions-item>
              </el-descriptions>
              <el-result
                class="monochrome-result"
                icon="success"
                title="验收通过"
                sub-title="交互和视觉都已进入复核阶段"
              >
                <template #icon>
                  <div
                    class="result-orbit"
                    aria-hidden="true"
                  />
                </template>
                <template #extra>
                  <el-button
                    plain
                    class="surface-button"
                  >
                    查看验收报告
                  </el-button>
                </template>
              </el-result>
              <el-empty
                class="monochrome-empty"
                description="空状态也保持留白与节奏"
              >
                <template #image>
                  <div
                    class="empty-wireframe"
                    aria-hidden="true"
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </template>
                <el-button
                  plain
                  class="surface-button"
                >
                  添加首个模块
                </el-button>
              </el-empty>
            </div>
          </article>

          <article class="demo-card wide">
            <h3>Table / TableV2</h3>
            <p>普通表格与虚拟表格并列验证。</p>
            <div class="table-scroll-shell">
              <el-table
                :data="tableData"
                class="table-review"
                style="min-width:560px;margin-bottom:12px;"
              >
                <el-table-column
                  prop="date"
                  label="日期"
                  width="140"
                />
                <el-table-column
                  prop="name"
                  label="模块"
                  min-width="180"
                />
                <el-table-column
                  prop="address"
                  label="状态"
                  min-width="180"
                />
              </el-table>
            </div>
            <div class="table-scroll-shell">
              <el-table-v2
                :columns="tableV2Columns"
                :data="tableV2Data"
                :width="680"
                :height="220"
              />
            </div>
          </article>

          <article class="demo-card">
            <h3>Progress / Tag / Text</h3>
            <p>信息强弱、标签大写与线性进度。</p>
            <el-progress :percentage="72" />
            <div class="stack">
              <el-tag>review</el-tag>
              <el-tag type="success">
                ready
              </el-tag>
              <el-tag type="info">
                mobile
              </el-tag>
            </div>
            <el-text
              type="info"
              truncated
            >
              标签与正文采用不同的字距策略，便于形成层次。
            </el-text>
          </article>

          <article class="demo-card">
            <h3>Skeleton / Divider / Space</h3>
            <p>重点确认骨架脉冲替代传统 spinner。</p>
            <div class="skeleton-preview">
              <el-skeleton
                animated
                :rows="4"
              />
            </div>
            <el-divider content-position="left">
              分割线
            </el-divider>
            <el-space wrap>
              <el-button size="small">
                按钮一
              </el-button>
              <el-button size="small">
                按钮二
              </el-button>
              <el-button size="small">
                按钮三
              </el-button>
            </el-space>
          </article>

          <article class="demo-card wide">
            <h3>Tree / TreeSelect / TreeV2</h3>
            <p>树形结构同时覆盖传统树、树选择器和虚拟树。</p>
            <div class="stack column tree-stack">
              <el-tree
                :data="treeData"
                node-key="id"
              />
              <el-tree-select
                v-model="treeSelectValue"
                :data="treeData"
                node-key="value"
              />
              <el-tree-v2
                :data="treeData"
                :height="220"
                :props="treeV2Props"
                :item-size="44"
              />
            </div>
          </article>

          <article class="demo-card full">
            <h3>Scrollbar / VirtualList / InfiniteScroll</h3>
            <p>滚动相关组件统一放在一起，直接检查长内容在手机端的表现。</p>
            <div class="scroll-cluster">
              <div class="muted-box">
                <el-scrollbar height="220px">
                  <p
                    v-for="line in 16"
                    :key="line"
                  >
                    滚动条内容第 {{ line }} 行
                  </p>
                </el-scrollbar>
              </div>
              <div class="muted-box virtual-shell">
                <FixedSizeList
                  :height="220"
                  width="100%"
                  :total="virtualRows.length"
                  :item-size="44"
                >
                  <template #default="{ index, style }">
                    <div
                      class="virtual-item"
                      :style="style"
                    >
                      {{ virtualRows[index] }}
                    </div>
                  </template>
                </FixedSizeList>
              </div>
              <ul
                v-infinite-scroll="loadMore"
                class="scroll-list infinite-shell"
              >
                <li
                  v-for="item in infiniteRows"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section
        id="navigation"
        class="section"
      >
        <div class="section-head">
          <span class="section-label">Navigation</span>
          <h2 class="section-title">
            导航、悬浮与反馈
          </h2>
          <p class="section-desc">
            这里集中检查菜单、气泡、提示与全局消息能力，确保悬浮层都能稳定工作。
          </p>
        </div>

        <div class="demo-grid">
          <article class="demo-card">
            <h3>Menu / Tabs / Steps</h3>
            <p>主导航与流程导航。</p>
            <el-menu
              :default-active="menuIndex"
              class="muted-box"
            >
              <el-sub-menu index="1">
                <template #title>
                  组件
                </template>
                <el-menu-item
                  index="1-1"
                  @click="menuIndex = '1-1'"
                >
                  基础组件
                </el-menu-item>
                <el-menu-item
                  index="1-2"
                  @click="menuIndex = '1-2'"
                >
                  数据组件
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item-group title="文档">
                <el-menu-item index="2-1">
                  设计规范
                </el-menu-item>
              </el-menu-item-group>
            </el-menu>
            <el-tabs v-model="activeTab">
              <el-tab-pane
                label="Summary"
                name="summary"
              >
                总览 Tab
              </el-tab-pane>
              <el-tab-pane
                label="Mobile"
                name="mobile"
              >
                移动端 Tab
              </el-tab-pane>
            </el-tabs>
            <el-steps
              :active="2"
              finish-status="success"
            >
              <el-step title="定义规范" />
              <el-step title="实现页面" />
              <el-step title="手机验收" />
            </el-steps>
          </article>

          <article class="demo-card">
            <h3>Dropdown / Tooltip / Popover / Popconfirm</h3>
            <p>悬浮层与轻提示联动展示。</p>
            <div class="stack">
              <el-dropdown>
                <el-button>
                  更多操作
                  <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>复制链接</el-dropdown-item>
                    <el-dropdown-item>导出设计稿</el-dropdown-item>
                    <el-dropdown-item divided>
                      归档
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip content="平滑的玻璃拟物提示层">
                <el-button plain>
                  Tooltip
                </el-button>
              </el-tooltip>
              <el-popover
                placement="bottom"
                title="Popover"
                width="220"
                trigger="click"
                content="这里展示更长的说明内容。"
              >
                <template #reference>
                  <el-button plain>
                    Popover
                  </el-button>
                </template>
              </el-popover>
              <el-popconfirm
                title="确认执行删除？"
                @confirm="ElMessage.success('已确认')"
              >
                <template #reference>
                  <el-button
                    type="danger"
                    plain
                  >
                    Popconfirm
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </article>

          <article class="demo-card">
            <h3>Timeline / Pagination / Divider</h3>
            <p>线性进度与分页导航。</p>
            <el-timeline>
              <el-timeline-item
                v-for="item in timelineItems"
                :key="item.timestamp"
                :timestamp="item.timestamp"
              >
                {{ item.label }}
              </el-timeline-item>
            </el-timeline>
            <el-pagination
              v-model:current-page="currentPage"
              layout="prev, pager, next"
              :total="80"
            />
            <el-divider>导航结束</el-divider>
          </article>

          <article class="demo-card wide">
            <h3>Dialog / Drawer / Overlay</h3>
            <p>模态体系使用统一毛玻璃风格，便于检查蒙层和对齐。</p>
            <div class="stack">
              <el-button
                type="primary"
                @click="dialogVisible = true"
              >
                打开 Dialog
              </el-button>
              <el-button @click="drawerVisible = true">
                打开 Drawer
              </el-button>
              <el-button
                plain
                @click="overlayVisible = true"
              >
                打开 Overlay
              </el-button>
            </div>
            <el-dialog
              v-model="dialogVisible"
              title="Dialog 示例"
              destroy-on-close
              close-on-click-modal
              close-on-press-escape
            >
              <p>对话框使用半透明背景和模糊效果。</p>
            </el-dialog>
            <el-drawer
              v-model="drawerVisible"
              title="Drawer 示例"
              destroy-on-close
              close-on-click-modal
              close-on-press-escape
            >
              <p>抽屉也用于检查悬浮层的阅读节奏。</p>
            </el-drawer>
            <div class="overlay-demo">
              <div class="overlay-panel">
                点击按钮后会显示底层 Overlay。
              </div>
              <ElOverlay
                v-if="overlayVisible"
                :mask="true"
                :z-index="40"
                @click="overlayVisible = false"
              >
                <div
                  class="overlay-panel"
                  style="top:20px;bottom:auto;"
                >
                  Overlay 已打开，点击任意位置关闭。
                </div>
              </ElOverlay>
            </div>
          </article>

          <article class="demo-card wide">
            <h3>Message / Notification / MessageBox / Loading</h3>
            <p>全局 API 统一从这里触发，便于验收交互链路。</p>
            <div class="stack">
              <el-button @click="openGlobalMessage('success')">
                Success Message
              </el-button>
              <el-button
                plain
                @click="openGlobalMessage('warning')"
              >
                Warning Message
              </el-button>
              <el-button
                type="danger"
                plain
                @click="openGlobalMessage('error')"
              >
                Error Message
              </el-button>
              <el-button @click="openNotification('info')">
                Notification
              </el-button>
              <el-button @click="openMessageBox">
                MessageBox
              </el-button>
              <el-button @click="openServiceLoading">
                Loading Service
              </el-button>
            </div>
            <div
              v-loading="directiveLoading"
              :class="['muted-box', 'loading-demo-box', { 'is-busy': directiveLoading }]"
            >
              <p>这是 `v-loading` 指令示例区域。</p>
              <el-button
                size="small"
                @click="toggleDirectiveLoading"
              >
                重新加载
              </el-button>
            </div>
          </article>
        </div>
      </section>

      <section
        id="advanced"
        class="section"
      >
        <div class="section-head">
          <span class="section-label">Advanced</span>
          <h2 class="section-title">
            高级与底层能力
          </h2>
          <p class="section-desc">
            包含低层组合组件和少见能力，确保 demo 不是只覆盖高频控件。
          </p>
        </div>

        <div class="demo-grid">
          <article class="demo-card">
            <h3>Collapse / CollapseTransition</h3>
            <p>一个标准折叠组件，一个底层过渡组件。</p>
            <el-collapse
              v-model="activeCollapse"
              class="collapse-review"
            >
              <el-collapse-item name="1">
                <template #title>
                  <span class="collapse-item-title">折叠项目 A</span>
                </template>
                <div class="collapse-item-copy">
                  内容 A
                </div>
              </el-collapse-item>
              <el-collapse-item name="2">
                <template #title>
                  <span class="collapse-item-title">折叠项目 B</span>
                </template>
                <div class="collapse-item-copy">
                  内容 B
                </div>
              </el-collapse-item>
            </el-collapse>
            <el-button
              size="small"
              @click="transitionVisible = !transitionVisible"
            >
              切换过渡面板
            </el-button>
            <ElCollapseTransition>
              <div
                v-show="transitionVisible"
                class="muted-box"
              >
                这是底层 CollapseTransition 示例。
              </div>
            </ElCollapseTransition>
          </article>

          <article class="demo-card">
            <h3>ImageViewer / Image</h3>
            <p>大图预览能力。</p>
            <div class="stack">
              <el-image
                class="inline-image-preview"
                :src="galleryUrls[0]"
                fit="cover"
              />
              <el-button
                plain
                class="surface-button"
                @click="imageViewerVisible = true"
              >
                打开 ImageViewer
              </el-button>
            </div>
            <ElImageViewer
              v-if="imageViewerVisible"
              :url-list="galleryUrls"
              @close="imageViewerVisible = false"
            />
          </article>

          <article class="demo-card">
            <h3>Popover Low-level Popper</h3>
            <p>直接组合 Popper Trigger / Content / Arrow，验证低层导出。</p>
            <ElPopper role="dialog">
              <ElPopperTrigger
                id="raw-popper-panel"
                :open="rawPopperVisible"
                :on-click="toggleRawPopper"
                :on-keydown="handleRawPopperKeydown"
              >
                <button
                  ref="rawPopperTriggerRef"
                  type="button"
                  class="raw-popper-button"
                  :aria-expanded="rawPopperVisible"
                  aria-controls="raw-popper-panel"
                  @focus="scrollFocusedElementIntoView"
                >
                  原始 Popper
                </button>
              </ElPopperTrigger>
              <ElPopperContent
                ref="rawPopperContentRef"
                v-bind="rawPopperContentAttrs"
                :visible="rawPopperVisible"
                :reference-el="rawPopperTriggerRef || undefined"
                :trigger-target-el="rawPopperTriggerRef || undefined"
                placement="bottom-start"
                :offset="10"
                strategy="fixed"
                effect="light"
                popper-class="low-level-popper-surface"
              >
                <div
                  class="low-level-popper"
                >
                  <div class="demo-kicker">
                    low-level popper
                  </div>
                  <strong>定位已锁定到触发按钮左侧起点。</strong>
                  <p>点击按钮可打开或关闭，点击卡片外区域会自动收起。</p>
                  <ElPopperArrow />
                </div>
              </ElPopperContent>
            </ElPopper>
          </article>

          <article class="demo-card">
            <h3>Row / Col / Space</h3>
            <p>栅格与水平留白。</p>
            <el-row :gutter="12">
              <el-col :span="12">
                <div class="muted-box">
                  Col 12
                </div>
              </el-col>
              <el-col :span="12">
                <div class="muted-box">
                  Col 12
                </div>
              </el-col>
            </el-row>
            <el-space wrap>
              <el-tag type="success">
                Grid
              </el-tag>
              <el-tag type="info">
                Spacing
              </el-tag>
              <el-tag>Mobile</el-tag>
            </el-space>
          </article>

          <article class="demo-card wide">
            <h3>Card / Statistic / Progress / Result 组合面板</h3>
            <p>用于检查同一块画面里的多组件混排能力。</p>
            <el-card
              shadow="never"
              class="metric-panel"
            >
              <div
                class="stack"
                style="justify-content:space-between;align-items:flex-start;"
              >
                <div>
                  <div class="demo-kicker">
                    Release Health
                  </div>
                  <div
                    class="demo-title"
                    style="font-size:42px;"
                  >
                    87
                  </div>
                </div>
                <el-progress
                  type="circle"
                  :percentage="87"
                  :width="92"
                />
              </div>
              <el-result
                class="monochrome-result compact-result"
                icon="info"
                title="结构化混排"
                sub-title="卡片、统计、进度和结果组件可共同出现。"
              >
                <template #icon>
                  <div
                    class="result-orbit result-orbit--compact"
                    aria-hidden="true"
                  />
                </template>
              </el-result>
            </el-card>
          </article>
            </div>
          </section>
        </main>
      </div>
    </Layout>
  </el-config-provider>
</template>
