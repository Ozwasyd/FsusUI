export type MarkdownRuntimeErrorCode = 'invariant' | 'protocol' | 'infra'

export class MarkdownRuntimeError extends Error {
  readonly code: MarkdownRuntimeErrorCode

  constructor(code: MarkdownRuntimeErrorCode, message: string) {
    super(message)
    this.name = 'MarkdownRuntimeError'
    this.code = code
  }
}
