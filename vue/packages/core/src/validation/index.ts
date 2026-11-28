import { isArray, isFunction, isNil, isNumber, isString } from '../utils'

export type FsusValidationTrigger = 'blur' | 'change' | 'submit'

export interface FsusStandardSchemaIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

export interface FsusStandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: readonly FsusStandardSchemaIssue[] }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: readonly FsusStandardSchemaIssue[] }
        >
  }
}

export interface FsusValidationRule {
  required?: boolean
  message?: string
  trigger?: FsusValidationTrigger | FsusValidationTrigger[]
  min?: number
  max?: number
  len?: number
  pattern?: RegExp
  type?: 'string' | 'number' | 'integer' | 'email' | 'url' | 'array' | 'boolean'
  schema?: FsusStandardSchemaV1
  validator?: (
    value: unknown,
    model: Record<string, unknown>,
  ) => boolean | string | void | Promise<boolean | string | void>
}

export interface FsusFieldValidationResult {
  valid: boolean
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isEmptyValue = (value: unknown): boolean => {
  if (isNil(value)) return true
  if (isString(value)) return value.trim().length === 0
  if (isArray(value)) return value.length === 0
  return false
}

const checkType = (value: unknown, type: NonNullable<FsusValidationRule['type']>): boolean => {
  switch (type) {
    case 'string':
      return isString(value)
    case 'number':
      return isNumber(value) || (isString(value) && value.trim() !== '' && !Number.isNaN(Number(value)))
    case 'integer':
      return Number.isInteger(typeof value === 'string' && value.trim() !== '' ? Number(value) : value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'email':
      return isString(value) && EMAIL_RE.test(value)
    case 'url':
      if (!isString(value)) return false
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
  }
}

export const isStandardSchema = (value: unknown): value is FsusStandardSchemaV1 =>
  Boolean(value && typeof value === 'object' && '~standard' in value)

export const validateRule = async (
  rule: FsusValidationRule,
  value: unknown,
  model: Record<string, unknown> = {},
  fieldLabel = 'Field',
): Promise<FsusFieldValidationResult> => {
  const defaultMsg = rule.message

  if (rule.required && isEmptyValue(value)) {
    return { valid: false, message: defaultMsg ?? `${fieldLabel} is required` }
  }

  if (isEmptyValue(value) && !rule.validator && !rule.schema) {
    return { valid: true, message: '' }
  }

  if (rule.type && !checkType(value, rule.type)) {
    return { valid: false, message: defaultMsg ?? `${fieldLabel} must be a valid ${rule.type}` }
  }

  const measure =
    isString(value) || isArray(value)
      ? value.length
      : isNumber(value)
        ? value
        : undefined

  if (measure !== undefined) {
    if (rule.len !== undefined && measure !== rule.len) {
      return { valid: false, message: defaultMsg ?? `${fieldLabel} length must be ${rule.len}` }
    }
    if (rule.min !== undefined && measure < rule.min) {
      return { valid: false, message: defaultMsg ?? `${fieldLabel} must be at least ${rule.min}` }
    }
    if (rule.max !== undefined && measure > rule.max) {
      return { valid: false, message: defaultMsg ?? `${fieldLabel} must be at most ${rule.max}` }
    }
  }

  if (rule.pattern && isString(value) && !rule.pattern.test(value)) {
    return { valid: false, message: defaultMsg ?? `${fieldLabel} format is invalid` }
  }

  if (rule.schema && isStandardSchema(rule.schema)) {
    const out = await rule.schema['~standard'].validate(value)
    if (out.issues && out.issues.length > 0) {
      return { valid: false, message: defaultMsg ?? out.issues[0]!.message }
    }
  }

  if (isFunction(rule.validator)) {
    try {
      const outcome = await rule.validator(value, model)
      if (outcome === false) {
        return { valid: false, message: defaultMsg ?? `${fieldLabel} is invalid` }
      }
      if (isString(outcome) && outcome.length > 0) {
        return { valid: false, message: outcome }
      }
    } catch (err) {
      return {
        valid: false,
        message: err instanceof Error ? err.message : (defaultMsg ?? `${fieldLabel} is invalid`),
      }
    }
  }

  return { valid: true, message: '' }
}

export const validateRules = async (
  rules: readonly FsusValidationRule[],
  value: unknown,
  model: Record<string, unknown> = {},
  fieldLabel = 'Field',
  trigger?: FsusValidationTrigger,
): Promise<FsusFieldValidationResult> => {
  for (const rule of rules) {
    if (trigger && trigger !== 'submit' && rule.trigger) {
      const triggers = Array.isArray(rule.trigger) ? rule.trigger : [rule.trigger]
      if (!triggers.includes(trigger)) continue
    }
    const res = await validateRule(rule, value, model, fieldLabel)
    if (!res.valid) return res
  }
  return { valid: true, message: '' }
}
