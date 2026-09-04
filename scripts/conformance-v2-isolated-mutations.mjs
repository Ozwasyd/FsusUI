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
const requestedCaseIds = new Set(process.argv.slice(3))
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
    'comparison.json',
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
const prepareAvaloniaSemanticCheck = () => {
  const result = run('dotnet', [
    'restore',
    'dotnet/FsusUI.Avalonia.ApiTool/FsusUI.Avalonia.ApiTool.csproj',
    '--force-evaluate',
  ])
  if (result.status !== 0)
    throw new Error(
      `Avalonia semantic mutation restore failed: ${result.stderr || result.stdout}`,
    )
}

const cases = [
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
    id: 'root-command-vue-baseline-drift',
    file: 'vue/packages/components/markdown-editor/src/markdown-editor.ts',
    inject: () =>
      mutateText(
        'vue/packages/components/markdown-editor/src/markdown-editor.ts',
        '  documentIdentity: {\n    type: definePropType<MarkdownEditorDocumentIdentity>(Object),\n    default: undefined,\n  },\n',
        '',
      ),
    command: ['pnpm', ['run', 'conformance:v2']],
    expected: '[conformance-v2] FAIL baseline:web exit=1',
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
    id: 'vue-slot-modified',
    file: 'vue/packages/components/select-v2/src/select.vue',
    inject: () =>
      mutateText(
        'vue/packages/components/select-v2/src/select.vue',
        '<slot name="empty">',
        '<slot name="empty-mutated">',
      ),
    command: ['pnpm', ['run', 'avalonia:baseline:check']],
    expected: 'Avalonia Vue public API baseline is stale',
  },
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
      'public partial class FsusMarkdownEditor : TemplatedControl\n{',
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
    prepare: prepareAvaloniaSemanticCheck,
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
  {
    id: 'root-command-avalonia-baseline-drift',
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusMarkdownEditor.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusMarkdownEditor.cs',
        'public partial class FsusMarkdownEditor : TemplatedControl\n{',
        'public partial class FsusMarkdownEditor : TemplatedControl\n{\n  public string RootCommandMutationMember { get; set; } = string.Empty;',
      ),
    command: ['pnpm', ['run', 'conformance:v2']],
    prepare: prepareAvaloniaSemanticCheck,
    expected: '[conformance-v2] FAIL baseline:avalonia exit=1',
  },
  {
    id: 'avalonia-content-property-removed',
    file: 'dotnet/FsusUI.Avalonia/Controls/FsusActivityRailShell.cs',
    inject: () =>
      mutateText(
        'dotnet/FsusUI.Avalonia/Controls/FsusActivityRailShell.cs',
        '  [Content]\n  public object? MainContent',
        '  public object? MainContent',
      ),
    command: ['pnpm', ['run', 'avalonia:semantic:check']],
    prepare: prepareAvaloniaSemanticCheck,
    expected: 'content property',
  },
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
  {
    id: 'execution-record-source-forged',
    file: '.tmp/conformance-v2/web-a11y/manifest.json',
    inject: () =>
      mutateJson('.tmp/conformance-v2/web-a11y/manifest.json', (value) => {
        value.executionCoverage.records[0].source.name = 'markdown.not-observed'
      }),
    command: gate('compare', [
      '--web',
      '.tmp/conformance-v2/web-a11y/manifest.json',
      '--avalonia',
      '.tmp/conformance-v2/avalonia.json',
      '--out',
      '.tmp/conformance-v2/mutated-comparison.json',
    ]),
    expected: 'source event not observed',
  },
  ...[
    [
      'execution-ledger-member-deleted',
      (value) => value.executionCoverage.records.splice(0, 1),
      'executionCoverage.outputHash invalid',
    ],
    [
      'execution-ledger-identity-forged',
      (value) => (value.executionCoverage.identity.candidate = 'forged'),
      'executionCoverage.identity mismatch',
    ],
    [
      'execution-ledger-metadata-only',
      (value) => (value.executionCoverage.real = false),
      'executionCoverage metadata-only',
    ],
  ].map(([id, mutation, expected]) => ({
    id,
    file: '.tmp/conformance-v2/comparison.json',
    inject: () => mutateJson('.tmp/conformance-v2/comparison.json', mutation),
    command: gate('derive', [
      '--contract',
      'spec/components/contracts/v2/contract-v2.json',
      '--comparison',
      '.tmp/conformance-v2/comparison.json',
      '--candidate',
      'git',
      '--out',
      '.tmp/conformance-v2/mutated-alignment.json',
      '--gaps',
      '.tmp/conformance-v2/mutated-gaps.json',
    ]),
    expected,
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
            /^markdown\s*源码\s*编辑区$/iu.test(node.name ?? ''),
        ).role = 'article'),
      'accessibility.nodes markdown textbox missing',
    ],
    [
      'name-value-state-drift',
      (value) =>
        (value.browserAccessibility.nodes.find(
          (node) =>
            node.role === 'textbox' &&
            /^markdown\s*源码\s*编辑区$/iu.test(node.name ?? ''),
        ).name = 'Fixture name'),
      'web.accessibility.nodes markdown textbox missing',
    ],
    [
      'identity-hash-mismatch',
      (value) => (value.identity.contractHash = 'stale'),
      'executionCoverage.identity mismatch',
    ],
    [
      'checkpoint-mismatch',
      (value) => (value.identity.checkpoint = 'other'),
      'executionCoverage.identity mismatch',
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
const selectedCases =
  requestedCaseIds.size === 0
    ? cases
    : cases.filter((entry) => requestedCaseIds.has(entry.id))
for (const requestedCaseId of requestedCaseIds) {
  if (!selectedCases.some((entry) => entry.id === requestedCaseId)) {
    throw new Error(`unknown isolated mutation ${requestedCaseId}`)
  }
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
    entry.prepare?.()
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
