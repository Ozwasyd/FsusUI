export const packedMarkdownRuntimeProjectionProbe = (packageName) =>
  [
    `const markdownRuntime = await import('${packageName}/markdown-runtime')`,
    `const source = '![alt](/old.png)\\n::caption[text]'`,
    `const projection = markdownRuntime.createMarkdownEditorProjection(source)`,
    `const image = projection.nodes.find((node) => node.kind === 'image')`,
    `const caption = projection.nodes.find((node) => node.kind === 'caption')`,
    `if (projection.identity.rawSource !== source) throw new Error('Packed Markdown projection source identity drifted')`,
    `if (!image || source.slice(image.rawRange.start, image.rawRange.end) !== '![alt](/old.png)') throw new Error('Packed Markdown projection image range drifted')`,
    `if (!caption || source.slice(caption.rawRange.start, caption.rawRange.end) !== '::caption[text]') throw new Error('Packed Markdown projection caption range drifted')`,
    `console.log('Packed Markdown runtime projection passed from the documented public subpath.')`,
  ].join(';')
