<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import {
  ElCollapseTransition,
  ElConfigProvider,
  ElImageViewer,
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification,
  ElOverlay,
  ElPopper,
  ElPopperArrow,
  ElPopperContent,
  ElPopperTrigger,
} from 'element-plus'
import { FixedSizeList } from '@element-plus/components/virtual-list'
import {
  ArrowLeft,
  Plus,
  Search,
  UploadFilled,
} from '@element-plus/icons-vue'

const sections = [
  { id: 'overview', label: '概览' },
  { id: 'entry', label: '输入' },
  { id: 'data', label: '数据展示' },
  { id: 'navigation', label: '导航与反馈' },
  { id: 'advanced', label: '高级能力' },
]

const keyword = ref('')
const cityOptions = ['上海', '北京', '深圳', '杭州', '广州', '成都']
const querySearch = (query: string, callback: (items: Array<{ value: string }>) => void) => {
  const result = cityOptions
    .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
    .map((value) => ({ value }))
  callback(result)
}

const makeSvg = (label: string, background: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"><rect width="480" height="280" rx="32" fill="${background}" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="36" fill="#ffffff">${label}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const galleryUrls = [
  makeSvg('FsusUI Hero', '#050505'),
  makeSvg('Glass Surface', '#27272a'),
  makeSvg('Mobile Layout', '#71717a'),
]

const badgeValue = ref(12)
const checkTagChecked = ref(true)
const sliderValue = ref(36)
const rateValue = ref(4.5)
const switchValue = ref(true)
const inputNumberValue = ref(8)
const selectValue = ref('studio')
const selectV2Value = ref('hangzhou')
const radioValue = ref('a')
const checkboxValue = ref(['设计系统', '移动优先'])
const timeSelectValue = ref('10:00')
const activeTab = ref('summary')
const currentPage = ref(2)
const activeCollapse = ref(['1'])
const dialogVisible = ref(false)
const drawerVisible = ref(false)
const overlayVisible = ref(false)
const imageViewerVisible = ref(false)
const transitionVisible = ref(true)
const infiniteCount = ref(20)
const directiveLoading = ref(true)
const rawPopperVisible = ref(false)
const colorValue = ref('#050505')
const cascaderValue = ref<string[]>(['guide', 'token'])
const cascaderPanelValue = ref<string[]>(['component', 'button'])
const timeValue = ref(new Date())
const timeRangeValue = ref([new Date(), new Date(Date.now() + 1000 * 60 * 45)])
const dateValue = ref(new Date())
const dateRangeValue = ref([
  new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  new Date(),
])
const countdownTarget = ref(Date.now() + 1000 * 60 * 60 * 6)
const treeSelectValue = ref('visual')
const uploadLog = ref('尚未上传文件')
const carouselIndex = ref(0)

const formModel = reactive({
  project: 'FsusUI Demo',
  owner: 'Design Ops',
  stage: 'beta',
  agree: true,
})

const selectV2Options = [
  { label: 'Hangzhou', value: 'hangzhou' },
  { label: 'Shanghai', value: 'shanghai' },
  { label: 'Tokyo', value: 'tokyo' },
  { label: 'Berlin', value: 'berlin' },
]

const cascaderOptions = [
  {
    value: 'guide',
    label: '设计规范',
    children: [
      { value: 'token', label: 'Token 系统' },
      { value: 'motion', label: '动效策略' },
    ],
  },
  {
    value: 'component',
    label: '组件层',
    children: [
      { value: 'button', label: 'Button' },
      { value: 'overlay', label: 'Overlay' },
    ],
  },
]

const transferData = Array.from({ length: 8 }, (_, index) => ({
  key: index + 1,
  label: `资源 ${index + 1}`,
  disabled: index === 5,
}))
const transferValue = ref([2, 4])

const treeData = [
  {
    id: 'foundation',
    value: 'foundation',
    label: '基础层',
    children: [
      { id: 'visual', value: 'visual', label: '视觉 Token' },
      { id: 'motion', value: 'motion', label: '动效模式' },
    ],
  },
  {
    id: 'patterns',
    value: 'patterns',
    label: '模式层',
    children: [
      { id: 'mobile', value: 'mobile', label: '移动端布局' },
      { id: 'desktop', value: 'desktop', label: '桌面端布局' },
    ],
  },
]

const treeV2Props = {
  value: 'value',
  label: 'label',
  children: 'children',
}

const menuIndex = ref('1-1')

const tableData = [
  { date: '2026-04-06', name: '视觉一致性', address: '设计评审中' },
  { date: '2026-04-07', name: '交互焦点环', address: '验收通过' },
  { date: '2026-04-08', name: '骨架屏过渡', address: '联调中' },
]

const tableV2Columns = [
  { key: 'name', dataKey: 'name', title: '组件', width: 180 },
  { key: 'status', dataKey: 'status', title: '状态', width: 120 },
  { key: 'owner', dataKey: 'owner', title: '负责人', width: 140 },
]

const tableV2Data = [
  { id: 1, name: 'Button', status: 'Ready', owner: 'UI' },
  { id: 2, name: 'Dialog', status: 'Review', owner: 'UX' },
  { id: 3, name: 'Table', status: 'Demo', owner: 'FE' },
  { id: 4, name: 'Tree', status: 'Demo', owner: 'FE' },
  { id: 5, name: 'Upload', status: 'Mocked', owner: 'FE' },
]

const timelineItems = [
  { timestamp: '09:00', label: '主题 Token 初始化' },
  { timestamp: '11:30', label: '移动端断点整理' },
  { timestamp: '15:00', label: '交互与焦点审查' },
]

const virtualRows = computed(() =>
  Array.from({ length: 120 }, (_, index) => `虚拟列表第 ${index + 1} 项`)
)

const infiniteRows = computed(() =>
  Array.from({ length: infiniteCount.value }, (_, index) => `无限滚动内容 ${index + 1}`)
)

const showSelectFeedback = (value: string) => {
  ElMessage.success(`已选择 ${value}`)
}

const openServiceLoading = () => {
  const instance = ElLoading.service({
    lock: false,
    text: '正在模拟骨架优先加载...',
    background: 'rgba(255,255,255,0.72)',
  })
  window.setTimeout(() => {
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

const openNotification = () => {
  ElNotification({
    title: '验收提醒',
    message: '当前 demo 服务已就绪，可继续在手机端复核。',
    type: 'success',
  })
}

const loadMore = () => {
  if (infiniteCount.value >= 40) return
  infiniteCount.value += 5
}

const toggleDirectiveLoading = () => {
  directiveLoading.value = true
  window.setTimeout(() => {
    directiveLoading.value = false
  }, 900)
}

const mockUpload = (options: UploadRequestOptions) => {
  uploadLog.value = `开始上传 ${options.file.name}`
  options.onProgress({ percent: 40 })
  return new Promise((resolve) => {
    window.setTimeout(() => {
      options.onProgress({ percent: 100 })
      options.onSuccess({ ok: true, name: options.file.name })
      uploadLog.value = `上传成功：${options.file.name}`
      resolve(true)
    }, 900)
  })
}

const handleRawPopperEnter = () => {
  rawPopperVisible.value = true
}

const handleRawPopperLeave = () => {
  rawPopperVisible.value = false
}
</script>

<template>
  <a
    class="skip-demo-link"
    href="#main-content"
  >跳到主要内容</a>

  <div class="demo-shell">
    <header class="demo-header">
      <div class="demo-brand">
        <div class="demo-kicker">
          FsusUI Component Demo
        </div>
        <div class="demo-title">
          Monochrome Review
        </div>
        <p class="demo-subtitle">
          这是一个独立的 Vite 验收项目，用于集中检查组件库在桌面端与手机端的视觉一致性、骨架优先加载与焦点无障碍表现。
        </p>
      </div>
      <nav
        class="demo-nav"
        aria-label="页面分区导航"
      >
        <a
          v-for="section in sections"
          :key="section.id"
          :href="`#${section.id}`"
        >{{ section.label }}</a>
      </nav>
    </header>

    <main
      id="main-content"
      class="demo-main"
    >
      <section
        id="overview"
        class="section"
      >
        <div class="section-head">
          <span class="section-label">Overview</span>
          <h2 class="section-title">
            基础预览与品牌入口
          </h2>
          <p class="section-desc">
            聚合展示品牌视觉、基础导航、跳转、毛玻璃与徽标组件，便于快速判断整体气质。
          </p>
        </div>

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
            <el-alert
              title="当前为验收环境"
              type="info"
              :closable="false"
            />
            <div class="stack">
              <el-badge :value="badgeValue">
                <el-button>通知中心</el-button>
              </el-badge>
              <el-avatar :size="44">
                FS
              </el-avatar>
              <el-avatar
                :size="44"
                :src="galleryUrls[1]"
              />
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
                <el-container>
                  <el-header style="background:#050505;color:#fff;display:flex;align-items:center;">
                    FsusUI
                  </el-header>
                  <el-container>
                    <el-aside
                      width="72px"
                      style="background:#fafafa;padding:12px;"
                    >
                      Aside
                    </el-aside>
                    <el-main style="min-height:120px;">
                      Main
                    </el-main>
                  </el-container>
                  <el-footer style="background:#fafafa;">
                    Footer
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
                <el-carousel
                  height="180px"
                  indicator-position="outside"
                  @change="carouselIndex = $event"
                >
                  <el-carousel-item
                    v-for="(url, index) in galleryUrls"
                    :key="url"
                  >
                    <el-card
                      shadow="never"
                      style="height:100%;border:none;display:grid;place-items:center;background:transparent;"
                    >
                      <el-image
                        :src="url"
                        fit="cover"
                        style="width:100%;height:140px;border-radius:18px;"
                      />
                      <el-text>轮播 {{ index + 1 }} / {{ galleryUrls.length }}</el-text>
                    </el-card>
                  </el-carousel-item>
                </el-carousel>
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
                  placeholder="搜索城市或标签"
                  @select="(item) => showSelectFeedback(item.value)"
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
              <el-color-picker v-model="colorValue" />
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
            <el-descriptions
              :column="2"
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
              icon="success"
              title="验收通过"
              sub-title="交互和视觉都已进入复核阶段"
            />
            <el-empty description="空状态也保持留白与节奏" />
          </article>

          <article class="demo-card wide">
            <h3>Table / TableV2</h3>
            <p>普通表格与虚拟表格并列验证。</p>
            <el-table
              :data="tableData"
              style="width:100%;margin-bottom:12px;"
            >
              <el-table-column
                prop="date"
                label="日期"
                width="120"
              />
              <el-table-column
                prop="name"
                label="模块"
              />
              <el-table-column
                prop="address"
                label="状态"
              />
            </el-table>
            <el-table-v2
              :columns="tableV2Columns"
              :data="tableV2Data"
              :width="520"
              :height="220"
            />
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
            <el-skeleton
              animated
              :rows="4"
            />
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
            <div class="stack column">
              <el-tree
                :data="treeData"
                node-key="id"
                default-expand-all
              />
              <el-tree-select
                v-model="treeSelectValue"
                :data="treeData"
                node-key="value"
                default-expand-all
              />
              <el-tree-v2
                :data="treeData"
                :height="220"
                :props="treeV2Props"
                :item-size="36"
              />
            </div>
          </article>

          <article class="demo-card full">
            <h3>Scrollbar / VirtualList / InfiniteScroll</h3>
            <p>滚动相关组件统一放在一起，直接检查长内容在手机端的表现。</p>
            <div
              class="demo-grid"
              style="grid-template-columns:repeat(3,minmax(0,1fr));"
            >
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
              <div class="muted-box">
                <FixedSizeList
                  :height="220"
                  :width="320"
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
                class="scroll-list"
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
            >
              <p>对话框使用半透明背景和模糊效果。</p>
            </el-dialog>
            <el-drawer
              v-model="drawerVisible"
              title="Drawer 示例"
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
              <el-button @click="ElMessage.success('消息已发送')">
                Message
              </el-button>
              <el-button @click="openNotification">
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
              class="muted-box"
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
            <el-collapse v-model="activeCollapse">
              <el-collapse-item
                title="折叠项目 A"
                name="1"
              >
                内容 A
              </el-collapse-item>
              <el-collapse-item
                title="折叠项目 B"
                name="2"
              >
                内容 B
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
                :src="galleryUrls[0]"
                fit="cover"
                style="width:120px;height:80px;border-radius:14px;"
              />
              <el-button @click="imageViewerVisible = true">
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
            <ElPopper>
              <ElPopperTrigger
                :open="rawPopperVisible"
                :on-mouseenter="handleRawPopperEnter"
                :on-mouseleave="handleRawPopperLeave"
              >
                <el-button plain>
                  原始 Popper
                </el-button>
              </ElPopperTrigger>
              <ElPopperContent
                :visible="rawPopperVisible"
                placement="bottom"
                effect="light"
              >
                <div
                  class="low-level-popper"
                  @mouseenter="handleRawPopperEnter"
                  @mouseleave="handleRawPopperLeave"
                >
                  原始 Popper 组合已生效。
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
            <el-card shadow="never">
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
                icon="info"
                title="结构化混排"
                sub-title="卡片、统计、进度和结果组件可共同出现。"
              />
            </el-card>
          </article>
        </div>
      </section>

      <div
        class="page-spacer"
        aria-hidden="true"
      />
    </main>
  </div>
</template>
