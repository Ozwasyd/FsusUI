const svgFontFamily = [
  'Google Sans',
  'Noto Sans SC',
  'Noto Sans TC',
  'Noto Sans JP',
  'ui-sans-serif',
  'system-ui',
  'sans-serif',
].join(', ')

const makeSvg = (label: string, background: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"><rect width="480" height="280" rx="32" fill="${background}" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="${svgFontFamily}" font-size="36" fill="#ffffff">${label}</text></svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const sections = [
  { id: 'overview', label: '概览' },
  { id: 'entry', label: '输入' },
  { id: 'data', label: '数据展示' },
  { id: 'navigation', label: '导航与反馈' },
  { id: 'advanced', label: '高级能力' },
]

export const cityOptions = ['上海', '北京', '深圳', '杭州', '广州', '成都']

export const galleryUrls = [
  makeSvg('FsusUI Hero', '#050505'),
  makeSvg('Glass Surface', '#27272a'),
  makeSvg('Mobile Layout', '#71717a'),
]

export const gallerySlides = [
  {
    tag: 'Hero',
    title: 'Brand Surface',
    summary: '用极深品牌黑建立主视觉重心，同时保留可读的留白和灰阶层次。',
    url: galleryUrls[0],
  },
  {
    tag: 'Glass',
    title: 'Glass Layer',
    summary: '毛玻璃卡面只承担层级，不再抢占视觉注意力。',
    url: galleryUrls[1],
  },
  {
    tag: 'Mobile',
    title: 'Mobile Rhythm',
    summary: '在窄屏下压缩信息密度，避免任何横向裁切和误触。',
    url: galleryUrls[2],
  },
]

export const autocompleteDemoAttrs: Record<string, unknown> = {
  placeholder: '搜索城市或标签',
}

export const rawPopperContentAttrs = {
  ariaLabel: '原始 Popper 示例',
} as const

export const defaultFormModel = {
  project: 'FsusUI Demo',
  owner: 'Design Ops',
  stage: 'beta',
  agree: true,
}

export const selectV2Options = [
  { label: 'Hangzhou', value: 'hangzhou' },
  { label: 'Shanghai', value: 'shanghai' },
  { label: 'Tokyo', value: 'tokyo' },
  { label: 'Berlin', value: 'berlin' },
]

export const cascaderOptions = [
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

export const transferData = Array.from({ length: 8 }, (_, index) => ({
  key: index + 1,
  label: `资源 ${index + 1}`,
  disabled: index === 5,
}))

export const treeData = [
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

export const treeV2Props = {
  value: 'value',
  label: 'label',
  children: 'children',
}

export const tableData = [
  { date: '2026-04-06', name: '视觉一致性', address: '设计评审中' },
  { date: '2026-04-07', name: '交互焦点环', address: '验收通过' },
  { date: '2026-04-08', name: '骨架屏过渡', address: '联调中' },
]

export const tableV2Columns = [
  { key: 'name', dataKey: 'name', title: '组件', width: 180 },
  { key: 'status', dataKey: 'status', title: '状态', width: 120 },
  { key: 'owner', dataKey: 'owner', title: '负责人', width: 140 },
]

export const tableV2Data = [
  { id: 1, name: 'Button', status: 'Ready', owner: 'UI' },
  { id: 2, name: 'Dialog', status: 'Review', owner: 'UX' },
  { id: 3, name: 'Table', status: 'Demo', owner: 'FE' },
  { id: 4, name: 'Tree', status: 'Demo', owner: 'FE' },
  { id: 5, name: 'Upload', status: 'Mocked', owner: 'FE' },
]

export type FeedbackTone = 'success' | 'warning' | 'error' | 'info'

export const feedbackCopy: Record<
  FeedbackTone,
  { title: string, message: string, notification: string }
> = {
  success: {
    title: '已通过视觉复核',
    message: '骨架过渡与交互反馈已完成联调。',
    notification: '当前 demo 服务已就绪，可以继续做桌面端与手机端复核。',
  },
  warning: {
    title: '移动端仍需复核',
    message: '请检查触控命中区与横向滚动是否稳定。',
    notification: '有少量高密度组件仍建议在窄屏下进行手动复测。',
  },
  error: {
    title: '发现验收阻塞',
    message: '请优先处理焦点环、弹层关闭与表格布局异常。',
    notification: '全局交互存在阻塞项，建议暂停提测并先修复关键反馈。',
  },
  info: {
    title: '等待二次确认',
    message: '当前变更已提交到验收态，等待产品和设计复看。',
    notification: '本轮视觉与交互更新已经落地，可以继续补充跨端细节检查。',
  },
}

export const timelineItems = [
  { timestamp: '09:00', label: '主题 Token 初始化' },
  { timestamp: '11:30', label: '移动端断点整理' },
  { timestamp: '15:00', label: '交互与焦点审查' },
]