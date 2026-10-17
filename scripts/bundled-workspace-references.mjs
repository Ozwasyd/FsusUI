import ts from 'typescript'

// Inspect literals rather than license comments. Keep non-exact literals in the
// result so unsupported subpaths and computed references still fail the audit.
export function findBundledWorkspaceReferences(content, fileName, names) {
  const source = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
  )
  if (source.parseDiagnostics.length > 0) {
    throw new Error(`Unable to inspect workspace references in ${fileName}.`)
  }

  const references = []
  const visit = (node) => {
    const literal = ts.isStringLiteralLike(node)
    if (
      literal ||
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail
    ) {
      for (const dependencyName of names) {
        if (node.text.includes(dependencyName)) {
          references.push({
            dependencyName,
            value: node.text,
            start: node.getStart(source),
            end: node.end,
            literal,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return references
}

export function rewriteBundledWorkspaceReferences(
  content,
  fileName,
  names,
  resolve,
) {
  let rewritten = content
  let replacementCount = 0
  const references = findBundledWorkspaceReferences(content, fileName, names)
  for (const {
    dependencyName,
    value,
    start,
    end,
    literal,
  } of references.reverse()) {
    if (!literal || value !== dependencyName) continue
    const replacement = resolve(dependencyName)
    const quote = content[start]
    rewritten = `${rewritten.slice(0, start)}${quote}${replacement}${quote}${rewritten.slice(end)}`
    replacementCount += 1
  }
  return { content: rewritten, replacementCount }
}
