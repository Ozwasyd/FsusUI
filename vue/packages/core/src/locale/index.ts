import { deepMerge } from '../utils'

export interface FsusLocale {
  name: string
  common: {
    confirm: string
    cancel: string
    close: string
    clear: string
    reset: string
    search: string
    loading: string
    empty: string
    noMatch: string
    more: string
    back: string
    copy: string
    copied: string
    selectPlaceholder: string
    inputPlaceholder: string
  }
  pagination: {
    total: string
    perPage: string
    goto: string
    prev: string
    next: string
  }
  datePicker: {
    selectDate: string
    selectTime: string
    selectMonth: string
    selectYear: string
    selectWeek: string
    startDate: string
    endDate: string
    today: string
    now: string
    week: string
    yearLabel: string
    prevYear: string
    nextYear: string
    prevMonth: string
    nextMonth: string
  }
  table: {
    empty: string
    filterConfirm: string
    filterReset: string
    selectAll: string
    sortAsc: string
    sortDesc: string
    sumText: string
  }
  select: {
    create: string
  }
  upload: {
    dropHint: string
    browse: string
    remove: string
    retry: string
  }
  transfer: {
    sourceTitle: string
    targetTitle: string
    noData: string
    filterPlaceholder: string
  }
  colorPicker: {
    confirm: string
    clear: string
  }
  image: {
    loadError: string
    preview: string
    zoomIn: string
    zoomOut: string
    rotateLeft: string
    rotateRight: string
    resetScale: string
  }
  dialog: {
    closeLabel: string
  }
}

export const zhCN: FsusLocale = {
  name: 'zh-CN',
  common: {
    confirm: '确定',
    cancel: '取消',
    close: '关闭',
    clear: '清空',
    reset: '重置',
    search: '搜索',
    loading: '加载中…',
    empty: '暂无数据',
    noMatch: '无匹配结果',
    more: '更多',
    back: '返回',
    copy: '复制',
    copied: '已复制',
    selectPlaceholder: '请选择',
    inputPlaceholder: '请输入',
  },
  pagination: {
    total: '共 {total} 条',
    perPage: '{size} 条/页',
    goto: '跳至',
    prev: '上一页',
    next: '下一页',
  },
  datePicker: {
    selectDate: '选择日期',
    selectTime: '选择时间',
    selectMonth: '选择月份',
    selectYear: '选择年份',
    selectWeek: '选择周',
    startDate: '开始日期',
    endDate: '结束日期',
    today: '今天',
    now: '此刻',
    week: '周',
    yearLabel: '{year} 年',
    prevYear: '上一年',
    nextYear: '下一年',
    prevMonth: '上个月',
    nextMonth: '下个月',
  },
  table: {
    empty: '暂无数据',
    filterConfirm: '筛选',
    filterReset: '重置',
    selectAll: '全选',
    sortAsc: '升序',
    sortDesc: '降序',
    sumText: '合计',
  },
  select: {
    create: '创建 “{value}”',
  },
  upload: {
    dropHint: '拖拽文件到此处，或点击上传',
    browse: '选择文件',
    remove: '移除',
    retry: '重试',
  },
  transfer: {
    sourceTitle: '可选列表',
    targetTitle: '已选列表',
    noData: '暂无数据',
    filterPlaceholder: '搜索选项',
  },
  colorPicker: {
    confirm: '确定',
    clear: '清空',
  },
  image: {
    loadError: '图片加载失败',
    preview: '预览图片',
    zoomIn: '放大',
    zoomOut: '缩小',
    rotateLeft: '向左旋转',
    rotateRight: '向右旋转',
    resetScale: '还原比例',
  },
  dialog: {
    closeLabel: '关闭对话框',
  },
}

export const en: FsusLocale = {
  name: 'en',
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    clear: 'Clear',
    reset: 'Reset',
    search: 'Search',
    loading: 'Loading…',
    empty: 'No data',
    noMatch: 'No matching results',
    more: 'More',
    back: 'Back',
    copy: 'Copy',
    copied: 'Copied',
    selectPlaceholder: 'Select',
    inputPlaceholder: 'Enter value',
  },
  pagination: {
    total: '{total} items',
    perPage: '{size} / page',
    goto: 'Go to',
    prev: 'Previous',
    next: 'Next',
  },
  datePicker: {
    selectDate: 'Select date',
    selectTime: 'Select time',
    selectMonth: 'Select month',
    selectYear: 'Select year',
    selectWeek: 'Select week',
    startDate: 'Start date',
    endDate: 'End date',
    today: 'Today',
    now: 'Now',
    week: 'Wk',
    yearLabel: '{year}',
    prevYear: 'Previous year',
    nextYear: 'Next year',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
  },
  table: {
    empty: 'No data',
    filterConfirm: 'Apply',
    filterReset: 'Reset',
    selectAll: 'Select all',
    sortAsc: 'Sort ascending',
    sortDesc: 'Sort descending',
    sumText: 'Total',
  },
  select: {
    create: 'Create "{value}"',
  },
  upload: {
    dropHint: 'Drop files here or click to upload',
    browse: 'Choose files',
    remove: 'Remove',
    retry: 'Retry',
  },
  transfer: {
    sourceTitle: 'Available',
    targetTitle: 'Selected',
    noData: 'No items',
    filterPlaceholder: 'Filter items',
  },
  colorPicker: {
    confirm: 'OK',
    clear: 'Clear',
  },
  image: {
    loadError: 'Failed to load image',
    preview: 'Preview image',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    rotateLeft: 'Rotate left',
    rotateRight: 'Rotate right',
    resetScale: 'Reset zoom',
  },
  dialog: {
    closeLabel: 'Close dialog',
  },
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, any> ? DeepPartial<T[K]> : T[K]
}

export const defineFsusLocale = (
  overrides: DeepPartial<FsusLocale> & { name: string },
  base: FsusLocale = en,
): FsusLocale => deepMerge(base as Record<string, any>, overrides) as FsusLocale

export const formatLocaleText = (
  template: string,
  params?: Record<string, string | number>,
): string => {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  )
}
