#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(
  root,
  process.argv[2] ?? '.tmp/conformance-v2/isolated-mutations.json',
)
const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-v2-mutations-'))
const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')
const run = (command, args, cwd = checkout) =>
  spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  })
const read = (file) => fs.readFileSync(path.join(checkout, file), 'utf8')
const write = (file, value) => {
  const target = path.join(checkout, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, value)
}
const mutateText = (file, from, to) => {
  const before = read(file)
  if (!before.includes(from))
    throw new Error(`${file}: injection locator missing`)
  write(file, before.replace(from, to))
}
const mutateJson = (file, mutation) => {
  const value = JSON.parse(read(file))
  mutation(value)
  write(file, `${JSON.stringify(value, null, 2)}\n`)
}
const reset = () => {
  const result = run('git', ['reset', '--hard', 'HEAD'])
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  run('git', ['clean', '-fd'])
  fs.mkdirSync(path.join(checkout, '.tmp/conformance-v2'), { recursive: true })
  for (const file of [
    'web-a11y/manifest.json',
    'avalonia.json',
    'alignment.json',
  ]) {
    const source = path.join(root, '.tmp/conformance-v2', file)
    if (!fs.existsSync(source))
      throw new Error(`positive artifact missing: ${file}`)
    const target = path.join(checkout, '.tmp/conformance-v2', file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(source, target)
  }
}
const gate = (subcommand, args) => [
  process.execPath,
  ['scripts/conformance-v2-evidence.mjs', subcommand, ...args],
]
const requestedCaseIds = new Set(
  (process.env.FSUSUI_MUTATION_CASES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)

const cases = [
  {
    id: 'vue-semantic-tsx-discovery-mutated',
    file: 'scripts/vue-semantic-baseline.mjs',
    inject: () =>
      mutateText(
        'scripts/vue-semantic-baseline.mjs',
        'else if (/\\.(ts|tsx|vue)$/u.test(entry.name)) {',
        'else if (/\\.(ts|vue)$/u.test(entry.name)) {',
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'fixture TSX widget source identity was not exact',
  },
  {
    id: 'vue-semantic-tsx-options-mutated',
    file: 'scripts/vue-semantic-baseline.mjs',
    inject: () =>
      mutateText(
        'scripts/vue-semantic-baseline.mjs',
        "node.callee.name === 'defineComponent'",
        "node.callee.name === 'defineComponentMutation'",
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'fixture TSX widget emit submit was not extracted',
  },
  {
    id: 'vue-semantic-component-source-mutated',
    file: 'scripts/vue-semantic-baseline.mjs',
    inject: () =>
      mutateText(
        'scripts/vue-semantic-baseline.mjs',
        "['defineComponent', 'defineOptions'].includes(node.callee.name)",
        "['defineOptions'].includes(node.callee.name)",
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'fixture TSX widget source identity was not exact',
  },
  {
    id: 'vue-semantic-nested-spread-mutated',
    file: 'scripts/vue-semantic-baseline.mjs',
    inject: () =>
      mutateText(
        'scripts/vue-semantic-baseline.mjs',
        'const resolvedNode = unwrapExpression(resolved?.node)',
        'const resolvedNode = resolved?.node',
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
  {
    id: 'vue-semantic-member-descriptor-mutated',
    file: 'scripts/vue-semantic-baseline.mjs',
    inject: () =>
      mutateText(
        'scripts/vue-semantic-baseline.mjs',
        "['MemberExpression', 'OptionalMemberExpression'].includes(valueNode.type)",
        "['MissingMemberExpression'].includes(valueNode.type)",
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
  {
    id: 'vue-semantic-imported-runtime-constant-mutated',
    file: 'scripts/vue-semantic-baseline.mjs',
    inject: () =>
      mutateText(
        'scripts/vue-semantic-baseline.mjs',
        "if (node.type === 'Identifier') {\n      const source =",
        "if (node.type === 'MissingIdentifier') {\n      const source =",
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
  {
    id: 'vue-public-alias-mutated',
    file: 'vue/packages/components/collection-primitives/index.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/collection-primitives/index.ts',
        'export const FsusCollectionSummary = ElCollectionSummary.FsusCollectionSummary',
        'export const FsusCollectionSummaryMutation = ElCollectionSummary.FsusCollectionSummary',
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
  {
    id: 'vue-public-enum-mutated',
    file: 'vue/packages/components/table-v2/src/constants.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/table-v2/src/constants.ts',
        "  RIGHT = 'right',",
        "  RIGHT = 'right-mutation',",
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
  {
    id: 'vue-public-sentinel-mutated',
    file: 'vue/packages/components/table-v2/src/private.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/table-v2/src/private.ts',
        "Symbol('placeholder')",
        "Symbol('placeholder-mutation')",
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
  {
    id: 'contract-optional-nullability-mutated',
    file: 'scripts/contract-v2.mjs',
    inject: () =>
      mutateText(
        'scripts/contract-v2.mjs',
        'web.required === false && webNullable === false && avaloniaNullable === true',
        'web.required === true && webNullable === false && avaloniaNullable === true',
      ),
    command: ['pnpm', ['run', 'contract-v2:check']],
    expected: 'contract-v2.json drifted from generated output',
  },
  {
    id: 'avalonia-semantic-nullability-mutated',
    file: 'dotnet/FsusUI.Avalonia.ApiTool/Program.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia.ApiTool/Program.cs',
        'state == NullabilityState.Nullable ||',
        'state == NullabilityState.NotNull ||',
      ),
    command: ['pnpm', ['run', 'avalonia:semantic:check']],
    expected: 'FsusUI.Avalonia.semantic.json drifted',
  },
  {
    id: 'table-v2-input-binding-mutated',
    file: 'scripts/contract-v2.mjs',
    inject: () =>
      mutateText(
        'scripts/contract-v2.mjs',
        "height: { member: 'ViewportHeight' },",
        "height: { member: 'ViewportMissing' },",
      ),
    command: ['pnpm', ['run', 'contract-v2:check']],
    expected: 'contract-v2.json drifted from generated output',
  },
  {
    id: 'table-v2-sort-object-category-mutated',
    file: 'scripts/contract-v2.mjs',
    inject: () =>
      mutateText(
        'scripts/contract-v2.mjs',
        "'FsusUI.Avalonia.Controls.FsusTableV2Sort': 'object',",
        "'FsusUI.Avalonia.Controls.FsusTableV2Sort': 'unknown',",
      ),
    command: ['pnpm', ['run', 'contract-v2:check']],
    expected: 'contract-v2.json drifted from generated output',
  },
  {
    id: 'auto-resizer-web-disabled-width-mutated',
    file: 'vue/packages/components/table-v2/src/composables/use-auto-resize.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/table-v2/src/composables/use-auto-resize.ts',
        'if (!props.disableWidth) width$.value = width - left - right',
        'width$.value = width - left - right',
      ),
    command: [
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vue/vitest.config.ts',
        'vue/packages/components/table-v2/__tests__/auto-resizer.test.tsx',
      ],
    ],
    expected: "to be '0x180'",
  },
  ...[
    [
      'auto-resizer-avalonia-disabled-width-mutated',
      'DisableWidth ? Viewport.Width : viewport.Width',
      'viewport.Width',
    ],
    ['auto-resizer-avalonia-callback-mutated', '    OnResize(next);\n', ''],
    [
      'auto-resizer-avalonia-arrange-mutated',
      '    Resize(finalSize);',
      '    _ = finalSize;',
    ],
  ].map(([id, from, to]) => ({
    id,
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusVirtualizationControls.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusVirtualizationControls.cs',
        from,
        to,
      ),
    command: [
      'dotnet',
      [
        'test',
        'dotnet/FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj',
        '--filter',
        'FullyQualifiedName~AutoResizerObservesArrangedViewportAndHonorsDisabledAxes',
      ],
    ],
    expected: 'Assert.',
  })),
  ...[
    [
      'table-v2-typed-data-mutated',
      'dataRow is not null && column is not null',
      'false && dataRow is not null && column is not null',
      'TableV2BindsTypedRowsFixedColumnsAndRealKeyboardScroll',
    ],
    [
      'table-v2-fixed-column-mutated',
      'entry.column.Fixed != FsusDataTableFixedColumn.None',
      'entry.column.Fixed == FsusDataTableFixedColumn.None',
      'TableV2BindsTypedRowsFixedColumnsAndRealKeyboardScroll',
    ],
    [
      'table-v2-keyboard-mutated',
      'e.Handled = HandleKeyAsync(e.Key).GetAwaiter().GetResult();',
      'e.Handled = false;',
      'TableV2BindsTypedRowsFixedColumnsAndRealKeyboardScroll',
    ],
    [
      'table-v2-scroll-mutated',
      'realizedColumnStartIndex = ResolveStart(scrollLeft, ColumnWidth, EffectiveColumnCount, realizedColumnCount);',
      'realizedColumnStartIndex = 0;',
      'TableV2BindsTypedRowsFixedColumnsAndRealKeyboardScroll',
    ],
    [
      'table-v2-dynamic-height-mutated',
      'rowSizeIndex.Update(rowIndex, previousHeight, nextHeight);',
      'rowSizeIndex.Update(rowIndex, previousHeight, previousHeight);',
      'TableV2MeasuresDynamicRowsAndRaisesRealScrollCallbacks',
    ],
    [
      'table-v2-scroll-callback-mutated',
      'OnScroll?.Invoke(position);',
      '_ = position;',
      'TableV2MeasuresDynamicRowsAndRaisesRealScrollCallbacks',
    ],
    [
      'table-v2-fixed-data-mutated',
      'Enumerable.Range(0, FixedData.Count)',
      'Enumerable.Empty<int>()',
      'TableV2UsesFixedDataGetterAndExpandedRowCallbacks',
    ],
    [
      'table-v2-data-getter-mutated',
      'DataGetter?.Invoke(context) ??',
      'null ??',
      'TableV2UsesFixedDataGetterAndExpandedRowCallbacks',
    ],
    [
      'table-v2-expanded-callback-mutated',
      'OnExpandedRowsChange?.Invoke(ExpandedRowKeys.ToArray());',
      '_ = ExpandedRowKeys.Count;',
      'TableV2UsesFixedDataGetterAndExpandedRowCallbacks',
    ],
    [
      'table-v2-viewport-max-height-mutated',
      'Math.Min(ViewportHeight, ViewportMaxHeight ?? double.PositiveInfinity)',
      'ViewportHeight',
      'TableV2MapsViewportGeometryAndCacheToRealLayout',
    ],
    [
      'table-v2-sort-direction-mutated',
      'FsusSortDirection.Ascending => Data\n        .OrderBy(',
      'FsusSortDirection.Ascending => Data\n        .OrderByDescending(',
      'TableV2SortsTypedRowsAndReportsColumnSort',
    ],
    [
      'table-v2-sort-callback-mutated',
      'OnColumnSort?.Invoke(SortBy);',
      '_ = SortBy;',
      'TableV2SortsTypedRowsAndReportsColumnSort',
    ],
  ].map(([id, from, to, test]) => ({
    id,
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusVirtualizationControls.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusVirtualizationControls.cs',
        from,
        to,
      ),
    command: [
      'dotnet',
      [
        'test',
        'dotnet/FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj',
        '--filter',
        `FullyQualifiedName~${test}`,
      ],
    ],
    expected: 'Assert.',
  })),
  {
    id: 'vue-prop-removed',
    file: 'vue/packages/components/markdown-editor/src/markdown-editor.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/markdown-editor/src/markdown-editor.ts',
        '  documentIdentity: {\n    type: definePropType<MarkdownEditorDocumentIdentity>(Object),\n    default: undefined,\n  },\n',
        '',
      ),
    command: [process.execPath, ['scripts/conformance-v2-vue-public-gate.mjs']],
    expected: 'Vue public props drift',
  },
  {
    id: 'vue-event-modified',
    file: 'vue/packages/components/markdown-editor/src/markdown-editor.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/markdown-editor/src/markdown-editor.ts',
        '  transaction: (event: MarkdownEditorTransactionEvent) =>',
        '  transactionChanged: (event: MarkdownEditorTransactionEvent) =>',
      ),
    command: [process.execPath, ['scripts/conformance-v2-vue-public-gate.mjs']],
    expected: 'Vue public emits drift',
  },
  {
    id: 'vue-method-modified',
    file: 'vue/packages/components/markdown-editor/src/markdown-editor.vue',
    inject: () =>
      mutateText(
        'vue/packages/components/markdown-editor/src/markdown-editor.vue',
        '  dispatchTransaction,\n',
        '  dispatchTransactionRemoved: dispatchTransaction,\n',
      ),
    command: [process.execPath, ['scripts/conformance-v2-vue-public-gate.mjs']],
    expected: 'Vue public exposed drift',
  },
  {
    id: 'check-tag-vue-role-mutated',
    file: 'vue/packages/components/check-tag/src/check-tag.vue',
    inject: () =>
      mutateText(
        'vue/packages/components/check-tag/src/check-tag.vue',
        'role="checkbox"',
        'role="button"',
      ),
    command: [
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vue/vitest.config.ts',
        'vue/packages/components/check-tag/__tests__/check-tag.test.tsx',
      ],
    ],
    expected: 'to match object',
  },
  {
    id: 'check-tag-vue-keyboard-mutated',
    file: 'vue/packages/components/check-tag/src/check-tag.vue',
    inject: () =>
      mutateText(
        'vue/packages/components/check-tag/src/check-tag.vue',
        '@keydown.space.prevent="handleChange"',
        '',
      ),
    command: [
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vue/vitest.config.ts',
        'vue/packages/components/check-tag/__tests__/check-tag.test.tsx',
      ],
    ],
    expected: 'to deeply equal',
  },
  {
    id: 'check-tag-avalonia-name-mutated',
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusCheckTag.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusCheckTag.cs',
        '      change.Property == ContentControl.ContentProperty)',
        '      change.Property == CheckedProperty)',
      ),
    command: [
      'dotnet',
      [
        'test',
        'dotnet/FsusUI.Avalonia.Tests/FsusUI.Avalonia.Tests.csproj',
        '--filter',
        'FullyQualifiedName~FsusCheckTagTests',
      ],
    ],
    expected: 'Assert.Equal() Failure',
  },
  {
    id: 'check-tag-avalonia-keyboard-mutated',
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusCheckTag.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusCheckTag.cs',
        'e.Key is not (Key.Enter or Key.Space)',
        'e.Key is not Key.Escape',
      ),
    command: [
      'dotnet',
      [
        'test',
        'dotnet/FsusUI.Avalonia.Tests/FsusUI.Avalonia.Tests.csproj',
        '--filter',
        'FullyQualifiedName~FsusCheckTagTests',
      ],
    ],
    expected: 'Assert.Equal() Failure',
  },
  {
    id: 'check-tag-avalonia-event-payload-mutated',
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusCheckTag.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusCheckTag.cs',
        'new FsusCheckTagValueChangedEventArgs(old, next)',
        'new FsusCheckTagValueChangedEventArgs(old, old)',
      ),
    command: [
      'dotnet',
      [
        'test',
        'dotnet/FsusUI.Avalonia.Tests/FsusUI.Avalonia.Tests.csproj',
        '--filter',
        'FullyQualifiedName~FsusCheckTagTests',
      ],
    ],
    expected: 'Assert.Equal() Failure',
  },
  ...[
    [
      'check-tag-avalonia-focus-ring-mutated',
      'dotnet/FsusUI.Avalonia.Themes/Themes/Controls/CheckTag.axaml',
      'BorderThickness" Value="2"',
      'BorderThickness" Value="0"',
    ],
    [
      'check-tag-avalonia-default-focus-adorner-mutated',
      'dotnet/FsusUI.Avalonia.Themes/Themes/Controls/CheckTag.axaml',
      '    <Setter Property="FocusAdorner" Value="{x:Null}" />\n',
      '',
    ],
    [
      'check-tag-web-motion-mutated',
      'vue/packages/theme-chalk/src/check-tag.scss',
      'transition-duration: 1ms',
      'transition-duration: 200ms',
    ],
  ].map(([id, file, from, to]) => ({
    id,
    file,
    inject: () => mutateText(file, from, to),
    command:
      id === 'check-tag-avalonia-default-focus-adorner-mutated'
        ? ['pnpm', ['run', 'conformance:v2:avalonia']]
        : id === 'check-tag-avalonia-focus-ring-mutated'
          ? [
              'dotnet',
              [
                'test',
                'dotnet/FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj',
                '--filter',
                'FullyQualifiedName~FsusCheckTagHeadlessTests',
              ],
            ]
          : [
              'pnpm',
              [
                'exec',
                'vitest',
                'run',
                '--config',
                'vue/vitest.config.ts',
                'vue/packages/theme-chalk/__tests__/fsus-theme.test.ts',
                '-t',
                'uses Scholarly Blue state tokens',
              ],
            ],
    expected:
      id === 'check-tag-avalonia-default-focus-adorner-mutated'
        ? 'rendered focus ring pixels did not match'
        : id === 'check-tag-avalonia-focus-ring-mutated'
          ? 'Assert.Equal() Failure'
          : 'expected',
  })),
  ...[
    ['avalonia-property-removed', 'DocumentIdentityProperty'],
    [
      'avalonia-event-removed',
      'public event EventHandler<FsusMarkdownEditorTransactionEventArgs>? Transaction;',
    ],
    [
      'avalonia-method-removed',
      'public FsusMarkdownEditorDispatchResult DispatchTransaction(',
    ],
    [
      'avalonia-default-nullability-modified',
      'FsusMarkdownDocumentIdentity?> DocumentIdentityProperty',
    ],
    [
      'avalonia-unmapped-public-member',
      'public class FsusMarkdownEditor : TemplatedControl\n{',
    ],
  ].map(([id, locator]) => ({
    id,
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusMarkdownEditor.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusMarkdownEditor.cs',
        locator,
        id === 'avalonia-unmapped-public-member'
          ? `${locator}\n  public string UnmappedMutationMember { get; set; } = string.Empty;`
          : `${locator}Mutation`,
      ),
    command: ['pnpm', ['run', 'avalonia:semantic:check']],
    expected:
      id === 'avalonia-property-removed' ||
      id === 'avalonia-default-nullability-modified'
        ? 'DocumentIdentityProperty'
        : id === 'avalonia-event-removed'
          ? 'CS1585'
          : id === 'avalonia-method-removed'
            ? 'CS1003'
            : 'baseline',
  })),
  ...[
    ['runner-skips-click', 'pointer'],
    ['runner-skips-keyboard', 'keyboard'],
    ['runner-skips-input', 'focus-input'],
  ].map(([id, action]) => ({
    id,
    file: '.tmp/conformance-v2/avalonia.json',
    inject: () =>
      mutateJson('.tmp/conformance-v2/avalonia.json', (value) => {
        value.steps = value.steps.filter((step) => step.action !== action)
      }),
    command: gate('compare', [
      '--web',
      '.tmp/conformance-v2/web-a11y/manifest.json',
      '--avalonia',
      '.tmp/conformance-v2/avalonia.json',
      '--out',
      '.tmp/conformance-v2/mutated-comparison.json',
    ]),
    expected: `required-step.${action}`,
  })),
  ...[
    [
      'focus-drift',
      (value) => (value.steps[1].focusTarget = 'button'),
      'steps.operationResults',
    ],
    [
      'selection-direction-drift',
      (value) =>
        (value.steps[1].observation.actual.selection.direction = 'backward'),
      'steps.operationResults',
    ],
    [
      'revision-drift',
      (value) => (value.steps[1].observation.actual.revision += 1),
      'steps.operationResults',
    ],
    [
      'history-drift',
      (value) => (value.steps[1].observation.actual.history.undoDepth += 1),
      'steps.operationResults',
    ],
    [
      'epoch-drift',
      (value) =>
        (value.steps[1].observation.actual.documentIdentity.epoch += 1),
      'steps.operationResults',
    ],
    [
      'role-drift',
      (value) =>
        (value.browserAccessibility.nodes.find(
          (node) =>
            node.role === 'textbox' &&
            /markdown editor source/i.test(node.name ?? ''),
        ).role = 'article'),
      'accessibility.nodes markdown textbox missing',
    ],
    [
      'name-value-state-drift',
      (value) =>
        (value.browserAccessibility.nodes.find(
          (node) => node.role === 'textbox',
        ).name = 'Fixture name'),
      'web.accessibility.nodes markdown textbox missing',
    ],
    [
      'identity-hash-mismatch',
      (value) => (value.identity.contractHash = 'stale'),
      'identity.contractHash',
    ],
    [
      'checkpoint-mismatch',
      (value) => (value.identity.checkpoint = 'other'),
      'identity.checkpoint',
    ],
    [
      'fixture-only-a11y',
      (value) => (value.browserAccessibility.source = 'dom-attributes'),
      'fixture-only',
    ],
  ].map(([id, mutation, expected]) => ({
    id,
    file: '.tmp/conformance-v2/web-a11y/manifest.json',
    inject: () =>
      mutateJson('.tmp/conformance-v2/web-a11y/manifest.json', mutation),
    command: gate('compare', [
      '--web',
      '.tmp/conformance-v2/web-a11y/manifest.json',
      '--avalonia',
      '.tmp/conformance-v2/avalonia.json',
      '--out',
      '.tmp/conformance-v2/mutated-comparison.json',
    ]),
    expected,
  })),
  ...[
    [
      'check-tag-evidence-pointer-mutated',
      (execution) => (execution.steps[2].observation.passed = false),
      'steps[2] failed',
    ],
    [
      'check-tag-evidence-keyboard-mutated',
      (execution) => (execution.steps[6].observation.passed = false),
      'steps[6] failed',
    ],
    [
      'check-tag-evidence-event-payload-mutated',
      (execution) => (execution.events[0].payload = false),
      'web.events.payload mismatch',
    ],
    [
      'check-tag-evidence-role-mutated',
      (execution) => (execution.accessibility.node.role = 'button'),
      'web.a11y.role mismatch',
    ],
    [
      'check-tag-evidence-name-mutated',
      (execution) => (execution.accessibility.node.name = 'Wrong name'),
      'web.a11y.name mismatch',
    ],
    [
      'check-tag-evidence-checked-mutated',
      (execution) => (execution.state.checked = true),
      'web.state.checked mismatch',
    ],
    [
      'check-tag-evidence-focus-mutated',
      (execution) => (execution.state.focus = null),
      'web.state.focus mismatch',
    ],
    [
      'check-tag-evidence-motion-mutated',
      (execution) => (execution.state.motion.active = true),
      'web.motion.active mismatch',
    ],
    [
      'check-tag-evidence-visual-mutated',
      (execution) =>
        (execution.visual.observation.focusIndicatorVisible = false),
      'visual rendered focused artifact missing',
    ],
    [
      'check-tag-evidence-performance-mutated',
      (execution) =>
        (execution.performance.interactionMilliseconds =
          execution.performance.budget.interactionMs + 1),
      'performance budget failed',
    ],
    [
      'check-tag-evidence-memory-mutated',
      (execution) =>
        (execution.performance.memoryObservation.retainedPerItemStateCount = 1),
      'performance budget failed',
    ],
    [
      'check-tag-evidence-retention-mutated',
      (execution) =>
        (execution.performance.memoryObservation.detachedControlCollected = false),
      'performance budget failed',
    ],
    [
      'check-tag-evidence-checkpoint-mutated',
      (execution) => (execution.identity.checkpoint = 'wrong-checkpoint'),
      'steps[0].binding mismatch',
    ],
    [
      'check-tag-evidence-coverage-mutated',
      (execution) =>
        (execution.coverage.executions[
          'scenario.v2.el-check-tag.pointer'
        ].real = false),
      'scenario.scenario.v2.el-check-tag.pointer metadata-only',
    ],
  ].map(([id, mutation, expected]) => ({
    id,
    file: '.tmp/conformance-v2/web-a11y/manifest.json',
    inject: () =>
      mutateJson('.tmp/conformance-v2/web-a11y/manifest.json', (value) =>
        mutation(value.contractExecutions['component-v2.el-check-tag']),
      ),
    command: gate('compare', [
      '--web',
      '.tmp/conformance-v2/web-a11y/manifest.json',
      '--avalonia',
      '.tmp/conformance-v2/avalonia.json',
      '--out',
      '.tmp/conformance-v2/mutated-comparison.json',
    ]),
    expected,
  })),
  ...[
    [
      'required-coverage-missing',
      { requiredMembers: ['selection'], memberScenarios: {}, executions: {} },
      'coverage.member.selection',
    ],
    [
      'metadata-only-counted',
      {
        requiredMembers: ['document'],
        memberScenarios: { document: ['generated'] },
        executions: { generated: { real: false } },
      },
      'metadata-only',
    ],
  ].map(([id, value, expected]) => ({
    id,
    file: '.tmp/conformance-v2/mutation-input.json',
    inject: () =>
      write(
        '.tmp/conformance-v2/mutation-input.json',
        `${JSON.stringify(value)}\n`,
      ),
    command: gate('coverage', [
      '--input',
      '.tmp/conformance-v2/mutation-input.json',
    ]),
    expected,
  })),
  ...[
    ['markdown-write-alias', { modes: ['source', 'write'] }, 'write forbidden'],
    [
      'same-source-document-history',
      {
        documents: [
          { source: 'same', identity: 'a' },
          { source: 'same', identity: 'b' },
        ],
        sharedHistory: true,
      },
      'history isolation',
    ],
    [
      'crlf-normalized-offset',
      { source: 'a\r\nb', offsetSpace: 'normalized' },
      'CRLF',
    ],
    ['dom-source-mapping', { sourceMappingOwner: 'DOM' }, 'used DOM'],
    [
      'synthetic-ime-as-native',
      { nativeIme: { synthetic: true } },
      'is synthetic',
    ],
  ].map(([id, value, expected]) => ({
    id,
    file: '.tmp/conformance-v2/mutation-input.json',
    inject: () =>
      write(
        '.tmp/conformance-v2/mutation-input.json',
        `${JSON.stringify(value)}\n`,
      ),
    command: gate('markdown', [
      '--input',
      '.tmp/conformance-v2/mutation-input.json',
    ]),
    expected,
  })),
  {
    id: 'partial-enters-stable',
    file: '.tmp/conformance-v2/alignment.json',
    inject: () =>
      mutateJson('.tmp/conformance-v2/alignment.json', (value) => {
        const partial = value.statuses.find(
          (entry) => entry.status === 'partial',
        )
        value.stable.push(partial.id)
      }),
    command: gate('readiness', [
      '--alignment',
      '.tmp/conformance-v2/alignment.json',
      '--contract',
      'spec/components/contracts/v2/contract-v2.json',
    ]),
    expected: 'is partial',
  },
  {
    id: 'override-governance-missing',
    file: '.tmp/conformance-v2/mutation-input.json',
    inject: () =>
      write(
        '.tmp/conformance-v2/mutation-input.json',
        `${JSON.stringify({ field: 'state.value', reason: 'platform', owner: 'conformance', testPolicy: 'exact' })}\n`,
      ),
    command: gate('override', [
      '--input',
      '.tmp/conformance-v2/mutation-input.json',
    ]),
    expected: 'reviewPolicy',
  },
]

const selectedCases = requestedCaseIds.size
  ? cases.filter((entry) => requestedCaseIds.has(entry.id))
  : cases
if (selectedCases.length !== (requestedCaseIds.size || cases.length)) {
  const selectedIds = new Set(selectedCases.map((entry) => entry.id))
  const missing = [...requestedCaseIds].filter((id) => !selectedIds.has(id))
  throw new Error(`unknown mutation cases: ${missing.join(', ')}`)
}

try {
  const clone = spawnSync(
    'git',
    ['clone', '--shared', '--no-hardlinks', root, checkout],
    {
      encoding: 'utf8',
    },
  )
  if (clone.status !== 0) throw new Error(clone.stderr || clone.stdout)
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(checkout, 'node_modules'),
  )
  const results = []
  for (const entry of selectedCases) {
    reset()
    entry.inject()
    const diff = run('git', ['diff', '--no-ext-diff', '--', entry.file])
    const [command, args] = entry.command
    const result = run(command, args)
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    const killed = result.status !== 0 && output.includes(entry.expected)
    results.push({
      id: entry.id,
      injectedChange: diff.stdout || `${entry.file} created`,
      expectedGate: `${command} ${args.join(' ')}`,
      actualError: output.trim(),
      exitCode: result.status,
      artifactDigest: sha256(`${diff.stdout}\n${output}`),
      killed,
    })
  }
  const survivors = results.filter((entry) => !entry.killed)
  const receipt = {
    schema: 'fsusui.conformance-isolated-mutations.v2',
    checkout: { kind: 'git-shared-clone', source: root },
    selection: requestedCaseIds.size ? [...requestedCaseIds].sort() : 'all',
    positiveCandidate: run('git', ['rev-parse', 'HEAD']).stdout.trim(),
    verdict: survivors.length === 0 ? 'pass' : 'fail',
    results,
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`)
  if (survivors.length) {
    throw new Error(
      `mutation survivors: ${survivors.map((entry) => entry.id).join(', ')}`,
    )
  }
  console.log(`isolated mutations passed: ${results.length}/${results.length}`)
} finally {
  fs.rmSync(checkout, { recursive: true, force: true })
}
