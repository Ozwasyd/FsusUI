export const resolveMarkdownSearchUi = (open: boolean, query: string, hitCount: number) =>
  Object.freeze({
    open,
    query,
    hitCount,
    compact: true,
    card: false,
  })
