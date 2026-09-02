<template>
  <div
    id="markdown-editor-chrome-visual"
    class="demo-section chrome-visual-section"
    data-testid="section-markdown-editor-chrome"
  >
    <h2>Markdown Editor Chrome</h2>
    <article class="chrome-visual-doc" data-testid="chrome-visual-doc">
      <h1 data-testid="chrome-visual-title">FsusUI 2.4 发布说明</h1>
      <p class="chrome-visual-meta">
        编辑器 chrome 变体验收样张 · {{ chrome }} / {{ mode }}
      </p>
      <el-markdown-editor
        v-model="docSource"
        :chrome="chrome"
        :default-mode="mode"
        :disabled="disabled"
        :loading="loading"
        :min-rows="6"
        :placeholder="placeholder"
        :readonly="readonly"
        :show-mode-switcher="showModeSwitcher"
        :status-density="statusDensity"
        :surfaces="{ toolbar: toolbarVisible }"
        :toolbar-density="toolbarDensity"
      >
        <template
          v-if="useStatusSlot"
          #status="{ metrics, state: slotState, capability }"
        >
          <span data-testid="chrome-visual-status-slot">
            {{ metrics.graphemeCount }} 字 · {{ metrics.wordCount }} 词 · {{ slotState
            }}{{
              capability.length ? ` · ${capability.join(' / ')}` : ''
            }}{{ slotState }}
          </span>
        </template>
      </el-markdown-editor>
      <section class="chrome-visual-context">
        <h2>变更摘要</h2>
        <p>
          本页把同一个编辑器实例嵌入真实文档版式，用于验收 framed、embedded、
          minimal 三种 chrome 在 source、live、split、preview 四个 mode 下的
          geometry、focus、语义与可访问性表现。
        </p>
      </section>
    </article>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const SHORT_DOCUMENT = [
  '# FsusUI 2.4 发布说明',
  '',
  '- 统一事务模型：value、selection、history 全部走单一 transaction store。',
  '- Live 模式：语法 marker reveal 与 caret/scroll 稳定性达标。',
  '- Avalonia 端：FsusMarkdownEditor 共享同一 source 事务合同。',
  '',
  '> 兼容 Element Plus 公共 API，主题 token 保持 `--el-*` 优先。',
  '',
].join('\n')

const CHANGELOG_ENTRIES = [
  '统一 command registry 与 async lifecycle，toolbar、键盘、selection 表面共享同一 snapshot。',
  '帧调度权威：layout read 收敛到 measure 阶段，write 收敛到 mutate 阶段，杜绝同帧读写回环。',
  '粘贴审阅：HTML 转 Markdown 提供结构化 diff 与逐类确认。',
  '表格编辑：结构化行列操作保持 undo/redo 粒度与 selection 方向。',
  '搜索高亮：跨模式 reveal 与导航优先级规则确定。',
  '附件媒体：source/live 双表面 atomic 呈现与可访问总验收。',
  '语言工具：原生 web language session 接入编辑器投影。',
  '锚点语法：`^anchor-id` 唯一性、fragment 映射与安全矩阵收口。',
]

const LONG_DOCUMENT = [
  '# FsusUI 2.4 变更日志',
  '',
  '本页为长文档验收样张，用于验证滚动容器、虚拟窗口与异步高度变化下的',
  'chrome 变体稳定性。以下条目按里程碑分组，内容为真实发布说明。',
  '',
  ...CHANGELOG_ENTRIES.flatMap((entry, index) => [
    `## 里程碑 ${Math.floor(index / 2) + 1}`,
    '',
    `- ${entry}`,
    '- 证据：focused unit、Playwright interaction、视觉与 a11y 矩阵。',
    '',
    '```ts',
    `const milestone = ${JSON.stringify(`m-${index + 1}`)} // verified on candidate`,
    '```',
    '',
  ]),
].join('\n')

type ChromeVariant = 'framed' | 'embedded' | 'minimal'
type ModeVariant = 'source' | 'live' | 'split' | 'preview'

const params = new URLSearchParams(window.location.search)
const chrome = computed<ChromeVariant>(() => {
  const value = params.get('chrome') ?? 'framed'
  return (['framed', 'embedded', 'minimal'] as const).includes(
    value as ChromeVariant,
  )
    ? (value as ChromeVariant)
    : 'framed'
})
const mode = computed<ModeVariant>(() => {
  const value = params.get('mode') ?? 'source'
  return (['source', 'live', 'split', 'preview'] as const).includes(
    value as ModeVariant,
  )
    ? (value as ModeVariant)
    : 'source'
})
const state = computed(() => params.get('state') ?? 'default')
const statusDensity = computed(() => {
  if (params.get('status') === 'hidden') return 'none' as const
  if (params.get('status') === 'detailed') return 'detailed' as const
  return 'minimal' as const
})
const toolbarDensity = computed(() =>
  params.get('toolbar') === 'compact'
    ? ('minimal' as const)
    : ('standard' as const),
)
const showModeSwitcher = computed(() => params.get('mode-switcher') !== 'off')
const toolbarVisible = computed(() => params.get('toolbar') !== 'off')
const useStatusSlot = computed(() => params.get('slot') === 'status')
const disabled = computed(() => state.value === 'disabled')
const loading = computed(() => state.value === 'loading')
const readonly = computed(() => state.value === 'readonly')
const placeholder = computed(() =>
  state.value === 'empty' ? '开始撰写你的发布说明…' : undefined,
)

const docSource = computed({
  get: () => {
    if (state.value === 'empty') return ''
    if (state.value === 'long') return LONG_DOCUMENT
    return SHORT_DOCUMENT
  },
  set: () => {
    // The visual fixture renders a static sample document; edits are not
    // persisted so every matrix cell starts from the same candidate state.
  },
})
</script>

<style scoped>
.chrome-visual-doc {
  margin: 0 auto;
  max-width: 880px;
  padding: 0 16px 48px;
}

.chrome-visual-meta {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.chrome-visual-context {
  margin-top: 24px;
}
</style>
