import { computed, reactive, type ComputedRef } from 'vue'
import type { UiAuditState } from '../ui-audit-manifest'

export interface UseAuditGridDataOptions {
  readonly auditState: ComputedRef<UiAuditState>
  readonly boundary: ComputedRef<boolean>
  readonly theme: ComputedRef<string>
}

export function useAuditGridData(options: UseAuditGridDataOptions) {
  const { auditState, boundary, theme } = options
  const boundaryText =
    'Boundary review text with a deliberately long scholarly label, dense metadata, and no artificial short word fallback'
  const active = computed(() => auditState.value === 'active')
  const activeText = computed(() => {
    if (boundary.value) {
      return active.value
        ? `${boundaryText} - active value with extra density`
        : `${boundaryText} - pending value`
    }

    return active.value ? 'Active value' : ''
  })
  const themeMode = computed(() => (theme.value === 'dark' ? 'dark' : 'light'))
  const markdownAuditContent = computed(() =>
    boundary.value
      ? `# Markdown\n\n${boundaryText}\n\n\`inline-code-boundary-token\` `
          .trim()
      : '# Markdown\n\nCompact rendered content.',
  )
  const markdownEditorAuditContent = computed(() =>
    boundary.value
      ? `## Editor\n\n${boundaryText}\n\n[Audit link](https://example.com)`
      : '## Editor\n\nCompact editable content.',
  )
  const shellNavItems = computed(() => [
    {
      key: 'home',
      label: boundary.value ? `Home ${boundaryText}` : 'Home',
      href: '#home',
    },
    {
      key: 'docs',
      label: boundary.value ? `Docs ${boundaryText}` : 'Docs',
      href: '#docs',
    },
    {
      key: 'api',
      label: boundary.value ? `API ${boundaryText}` : 'API',
      href: '#api',
    },
  ])
  const responsiveCollectionItems = computed(() => [
    {
      name: boundary.value ? `Alpha ${boundaryText}` : 'Alpha',
      state: active.value ? 'Active' : 'Ready',
    },
    {
      name: boundary.value ? `Beta ${boundaryText}` : 'Beta',
      state: 'Review',
    },
  ])
  const perceptionChallenges = computed(() => [
    {
      challengeId: 'audit-perception-text-task',
      kind: 'text-task' as const,
      prompt: boundary.value ? boundaryText : 'Read the prompt and respond.',
      description: active.value
        ? 'Text answer is submitting.'
        : 'Text task is ready for review.',
    },
    {
      challengeId: 'audit-perception-localization',
      kind: 'localization' as const,
      prompt: boundary.value ? boundaryText : 'Select the marked region.',
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
      prompt: boundary.value ? boundaryText : 'Confirm the interaction.',
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
  const cascaderOptions = computed(() => [
    {
      value: 'guide',
      label: boundary.value
        ? 'Guide / extremely long discipline branch'
        : 'Guide',
      children: [
        {
          value: 'docs',
          label: boundary.value
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
    if (!boundary.value) {
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
    transferLabels.slice(0, boundary.value ? 18 : 6).map((label, idx) => ({
      key: idx + 1,
      label: boundary.value ? `${label} - ${boundaryText}` : label,
      disabled: idx === 4,
    })),
  )
  const formModel = reactive({ name: 'FsusUI', region: 'one' })
  const tableData = computed(() => [
    {
      name: boundary.value ? `Alpha ${boundaryText}` : 'Alpha',
      state: boundary.value ? 'Ready with extended lifecycle metadata' : 'Ready',
    },
    {
      name: boundary.value ? `Beta ${boundaryText}` : 'Beta',
      state: active.value ? 'Active' : 'Idle',
    },
  ])
  const tableV2Columns = computed(() => [
    {
      key: 'name',
      dataKey: 'name',
      title: boundary.value ? 'Name / long boundary heading' : 'Name',
      width: boundary.value ? 180 : 140,
    },
    {
      key: 'state',
      dataKey: 'state',
      title: boundary.value ? 'State / dense metadata' : 'State',
      width: boundary.value ? 180 : 120,
    },
  ])
  const tableV2Data = computed(() =>
    Array.from({ length: boundary.value ? 80 : 8 }, (_, id) => ({
      id,
      name: boundary.value ? `Row ${id} ${boundaryText}` : `Row ${id}`,
      state: id % 2 === 0 ? 'Ready' : 'Review',
    })),
  )
  const treeData = computed(() => [
    {
      value: 'level-1',
      label: boundary.value ? `Level one ${boundaryText}` : 'Level one',
      children: [
        {
          value: 'level-1-1',
          label: boundary.value ? `Level two ${boundaryText}` : 'Level two',
          children: [
            {
              value: 'level-1-1-1',
              label: boundary.value
                ? `Level three ${boundaryText}`
                : 'Level three',
            },
          ],
        },
      ],
    },
  ])
  const treeDataV2 = computed(() =>
    Array.from({ length: boundary.value ? 240 : 80 }, (_, id) => ({
      id,
      label: boundary.value ? `Node ${id} ${boundaryText}` : `Node ${id}`,
      children:
        id === 0
          ? [
              {
                id: 1000,
                label: boundary.value
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
      boundary.value
        ? [
            { value: `FsusUI ${boundaryText}` },
            { value: `Element Plus ${boundaryText}` },
          ]
        : [{ value: 'FsusUI' }, { value: 'Element Plus' }],
    )
  }

  return {
    active,
    activeText,
    calendarRange,
    cascaderOptions,
    collectionStateItems,
    countdownValue,
    dateValue,
    dotGray,
    formModel,
    formatCollectionItem,
    imageData,
    markdownAuditContent,
    markdownEditorAuditContent,
    perceptionChallenges,
    querySearch,
    responsiveCollectionItems,
    scholarlyBlue,
    selectV2Options,
    shellNavItems,
    tableData,
    tableV2Columns,
    tableV2Data,
    themeMode,
    transferData,
    treeData,
    treeDataV2,
  }
}

export type AuditGridData = ReturnType<typeof useAuditGridData>
