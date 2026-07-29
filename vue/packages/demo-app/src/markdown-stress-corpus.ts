export const MARKDOWN_STRESS_TARGET_SIZE = 500_000

const normalizeMarkdownSource = (input: string) =>
  String(input || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')

export const buildMarkdownStressCorpus = (
  targetSize = MARKDOWN_STRESS_TARGET_SIZE,
) => {
  const normalizedTarget = Math.max(10_000, Math.floor(targetSize))
  const seedBlocks = [
    '\uFEFF# Markdown Stress Corpus',
    '',
    'Intro paragraph with **strong**, *emphasis*, `inline code`, [link](https://example.com/path?q=markdown&x=1), CJK text, and escaped HTML probes.',
    '<script>alert("xss")</script><img src=x onerror=alert(1)>',
    '<details open>raw</details><svg onload=alert(1)>x</svg>',
    '',
    '| Column A | Column B | Column C |',
    '| --- | ---: | :--- |',
    '| short | 42 | text |',
    `| very-long-cell | ${'cell-value-'.repeat(64)} | end |`,
    '',
    '```ts',
    'const value = "<unsafe>& markdown";',
    'console.log(value.repeat(2));',
    '```',
    '',
    '```mermaid',
    'flowchart LR;',
    'A["Alpha Node"] --> B("Beta Branch");',
    'B --> C[Gamma End];',
    '```',
    '',
    'Inline math \\(x_1^2 + \\alpha + \\sqrt{b}\\) and display math:',
    '$$',
    '\\frac{a_1^2 + \\sqrt{b}}{\\alpha + 2}',
    '$$',
  ]

  const parts = [seedBlocks.join('\r\n')]
  let blockIndex = 0

  while (parts.join('\n').length < normalizedTarget) {
    blockIndex += 1
    parts.push(
      [
        '',
        `## Stress Section ${blockIndex}`,
        `Paragraph ${blockIndex} with repeated words ${'longword'.repeat(
          (blockIndex % 7) + 1,
        )} and inline math \\(n_${blockIndex}^2 + \\beta\\).`,
        blockIndex % 5 === 0
          ? [
              '```mermaid',
              'flowchart LR;',
              `N${blockIndex}["Node ${blockIndex}"] --> M${blockIndex}("Next");`,
              '```',
            ].join('\n')
          : '- list item alpha\n- list item beta\n- list item gamma',
        blockIndex % 9 === 0
          ? '$$\n\\sum_{i=1}^{n} \\frac{i^2}{n}\n$$'
          : '| a | b |\n| --- | --- |\n| 1 | 2 |',
        `Escaped html probe ${blockIndex}: <iframe src="javascript:alert(${blockIndex})"></iframe>`,
        `Long url ${blockIndex}: https://example.com/${'segment/'.repeat(
          12,
        )}?q=${blockIndex}&unsafe=%3Cscript%3E`,
      ].join('\n'),
    )
  }

  let corpus = parts.join('\n').slice(0, normalizedTarget + 4096)
  while (normalizeMarkdownSource(corpus).length < normalizedTarget) {
    corpus += `\n\nPadding boundary ${blockIndex}: ${'pad'.repeat(64)}`
    blockIndex += 1
  }

  return corpus
}

export const describeMarkdownStressCorpus = (source: string) => {
  const normalized = normalizeMarkdownSource(source)
  return {
    length: normalized.length,
    lineCount: normalized.split('\n').length,
  }
}
