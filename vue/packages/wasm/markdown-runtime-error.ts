export type MarkdownRuntimeErrorCode = 'invariant' | 'protocol' | 'infra'

export class MarkdownRuntimeError extends Error {
  constructor(
    public readonly code: MarkdownRuntimeErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'MarkdownRuntimeError'
  }
}
