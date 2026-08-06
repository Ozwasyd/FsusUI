import { inject, markRaw, provide, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from '../../element-plus'
import * as Icons from '@element-plus/icons-vue'

import type { InjectionKey } from 'vue'

export const { Search, ArrowLeft, ArrowRight, ArrowDown, Edit, Share } = Icons

const readCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  )
}

export const createDemoState = () => {
  const radio = ref<string | number | boolean>('1')
  const checkbox = ref<any>(true)
  const checkboxGroup = ref<any[]>(['A'])
  const input = ref('')
  const inputNumber = ref<any>(1)
  const select = ref('')
  const selectV2Options = [
    '草稿评审',
    '封面图复核',
    '发布排期',
    '评论权限',
    '归档策略',
    '首页推荐',
    '搜索收录',
    '成员协作',
    '审计记录',
    '站点通知',
  ].map((label, idx) => ({
    value: `workflow-${idx + 1}`,
    label,
  }))
  const cascaderOptions = [
    {
      value: 'guide',
      label: 'Guide',
      children: [{ value: 'disciplines', label: 'Disciplines' }],
    },
  ]
  const switchValue = ref<any>(true)
  const slider = ref<any>(50)
  const time = ref()
  const timeSelect = ref('')
  const date = ref(new Date())
  const dateRange = ref<[Date, Date]>([new Date(), new Date()])
  const rate = ref(3.5)
  const color = ref(readCssVar('--fsus-scholarly-blue', '#2a599c'))
  const transferValue = ref<any[]>([])
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
  ]
  const transferData = transferLabels.map((label, idx) => ({
    key: idx,
    label,
    disabled: idx % 4 === 0,
  }))
  const formModel = reactive({ name: '', region: '' })

  const tableData = [
    {
      date: '2016-05-03',
      name: 'Tom',
      author: '青砚',
      status: '已发布',
      category: '研究笔记',
      views: 12840,
      identifier: 'research-note-2016-05-03-long-identifier',
      address: 'No. 189, Grove St, Los Angeles',
    },
    {
      date: '2016-05-02',
      name: 'John',
      author: 'Lin',
      status: '草稿',
      category: '随笔',
      views: 320,
      identifier: 'draft-2016-05-02',
      address: 'No. 189, Grove St, Los Angeles',
    },
  ]
  const tableV2Columns = [
    { key: 'name', dataKey: 'name', title: 'Name', width: 150 },
    { key: 'id', dataKey: 'id', title: 'ID', width: 100 },
  ]
  const tableV2Data = Array.from({ length: 10 }).map((_, id) => ({
    id: `id-${id}`,
    name: `Tom-${id}`,
  }))
  const treeData = [
    {
      value: 'level-1',
      label: 'Level one 1',
      children: [
        {
          value: 'level-1-1',
          label: 'Level two 1-1',
          children: [{ value: 'level-1-1-1', label: 'Level three 1-1-1' }],
        },
      ],
    },
  ]
  const treeDataV2 = Array.from({ length: 100 }).map((_, id) => ({
    id,
    label: `Node ${id}`,
  }))
  const treeSelectValue = ref('level-1')
  const checkTag = ref(true)

  const countdownValue = ref(Date.now() + 1000 * 60 * 60 * 24 * 2)
  const circleUrl =
    'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
  const squareUrl =
    'https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png'

  const activeTab = ref<any>('first')
  const activeCollapse = ref<any>(['1'])
  const showTransition = ref(true)
  const showImageViewer = ref(false)
  const dialogVisible = ref(false)
  const longTitleDialogVisible = ref(false)
  const drawerVisible = ref(false)
  const overlayVisible = ref(false)

  const infiniteCount = ref(5)
  const loadInfinite = () => {
    if (infiniteCount.value < 10) infiniteCount.value += 1
  }

  const querySearch = (_queryString: string, cb: (items: any[]) => void) => {
    cb([{ value: 'vue' }, { value: 'element' }])
  }
  const showMessage = () => ElMessage('This is a message.')
  const showMessageBox = () =>
    ElMessageBox.alert(
      'This is a message',
      'Title long close-clearance title Confirmation title must clear the close hit target',
    )
  const showNotification = () =>
    ElNotification({
      title: 'Notification',
      message: 'This is a notification',
    })
  const goBack = () => ElMessage.info('Back')

  return {
    activeCollapse,
    activeTab,
    allIcons: markRaw(Icons),
    cascaderOptions,
    checkbox,
    checkboxGroup,
    checkTag,
    circleUrl,
    color,
    countdownValue,
    date,
    dateRange,
    dialogVisible,
    longTitleDialogVisible,
    drawerVisible,
    formModel,
    goBack,
    infiniteCount,
    input,
    inputNumber,
    loadInfinite,
    overlayVisible,
    querySearch,
    radio,
    rate,
    select,
    selectV2Options,
    showImageViewer,
    showMessage,
    showMessageBox,
    showNotification,
    showTransition,
    slider,
    squareUrl,
    switchValue,
    tableData,
    tableV2Columns,
    tableV2Data,
    time,
    timeSelect,
    transferData,
    transferValue,
    treeData,
    treeDataV2,
    treeSelectValue,
  }
}

export type DemoState = ReturnType<typeof createDemoState>

const demoStateKey: InjectionKey<DemoState> = Symbol('demoState')

export const provideDemoState = (state: DemoState) => {
  provide(demoStateKey, state)
}

export const useDemoState = () => {
  const state = inject(demoStateKey)
  if (!state) {
    throw new Error('demo state was not provided')
  }
  return state
}
