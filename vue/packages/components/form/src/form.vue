<template>
  <form :class="formClasses">
    <slot />
  </form>
</template>

<script lang="ts" setup>
import { computed, provide, reactive, toRefs, watch } from 'vue'
import {
  createFsusError,
  debugWarn,
  fsusErr,
  fsusOk,
  isFsusErr,
} from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { useFormSize } from './hooks'
import { formContextKey } from './constants'
import { formEmits, formProps } from './form'
import { filterFields, useFormLabelWidth } from './utils'

import type { ValidateFieldsError } from 'async-validator'
import type { Arrayable } from '@element-plus/utils'
import type {
  FormContext,
  FormItemContext,
  FormValidateCallback,
  FormValidationResult,
} from './types'
import type { FormItemProp } from './form-item'

const COMPONENT_NAME = 'ElForm'
defineOptions({
  name: COMPONENT_NAME,
})
const props = defineProps(formProps)
const emit = defineEmits(formEmits)

const fields: FormItemContext[] = []

const formSize = useFormSize()
const ns = useNamespace('form')
const formClasses = computed(() => {
  const { labelPosition, inline } = props
  return [
    ns.b(),
    // todo: in v2.2.0, we can remove default
    // in fact, remove it doesn't affect the final style
    ns.m(formSize.value || 'default'),
    {
      [ns.m(`label-${labelPosition}`)]: labelPosition,
      [ns.m('inline')]: inline,
    },
  ]
})

const addField: FormContext['addField'] = (field) => {
  fields.push(field)
}

const removeField: FormContext['removeField'] = (field) => {
  if (field.prop) {
    fields.splice(fields.indexOf(field), 1)
  }
}

const resetFields: FormContext['resetFields'] = (properties = []) => {
  if (!props.model) {
    debugWarn(COMPONENT_NAME, 'model is required for resetFields to work.')
    return
  }
  filterFields(fields, properties).forEach((field) => field.resetField())
}

const clearValidate: FormContext['clearValidate'] = (props = []) => {
  filterFields(fields, props).forEach((field) => field.clearValidate())
}

const isValidatable = computed(() => {
  const hasModel = !!props.model
  if (!hasModel) {
    debugWarn(COMPONENT_NAME, 'model is required for validate to work.')
  }
  return hasModel
})

const obtainValidateFields = (props: Arrayable<FormItemProp>) => {
  if (fields.length === 0) return []

  const filteredFields = filterFields(fields, props)
  if (!filteredFields.length) {
    debugWarn(COMPONENT_NAME, 'please pass correct props!')
    return []
  }
  return filteredFields
}

const validate = async (
  callback?: FormValidateCallback
): FormValidationResult => validateField(undefined, callback)

const doValidateField = async (
  props: Arrayable<FormItemProp> = []
): FormValidationResult => {
  if (!isValidatable.value) return fsusOk(false)

  const fields = obtainValidateFields(props)
  if (fields.length === 0) return fsusOk(true)

  let validationErrors: ValidateFieldsError = {}
  for (const field of fields) {
    const fieldResult = await field.validate('')
    if (isFsusErr(fieldResult)) {
      validationErrors = {
        ...validationErrors,
        ...((fieldResult.error.cause ?? {}) as ValidateFieldsError),
      }
    }
  }

  if (Object.keys(validationErrors).length === 0) return fsusOk(true)
  return fsusErr(
    createFsusError('validation', 'form_validation_failed', {
      cause: validationErrors,
    }),
  )
}

const validateField: FormContext['validateField'] = async (
  modelProps = [],
  callback
) => {
  const result = await doValidateField(modelProps)
  if (!isFsusErr(result)) {
    if (result.value === true) {
      callback?.(result.value)
    }
    return result
  }

  const invalidFields = (result.error.cause ?? {}) as ValidateFieldsError
  if (props.scrollToError) {
    scrollToField(Object.keys(invalidFields)[0])
  }
  callback?.(false, invalidFields)
  return result
}

const scrollToField = (prop: FormItemProp) => {
  const field = filterFields(fields, prop)[0]
  if (field) {
    field.$el?.scrollIntoView(props.scrollIntoViewOptions)
  }
}

watch(
  () => props.rules,
  () => {
    if (props.validateOnRuleChange) {
      void validate().then((result) => {
        if (isFsusErr(result)) debugWarn(new Error(result.error.message))
      })
    }
  },
  { deep: true }
)

provide(
  formContextKey,
  reactive({
    ...toRefs(props),
    emit,

    resetFields,
    clearValidate,
    validateField,
    addField,
    removeField,

    ...useFormLabelWidth(),
  })
)

defineExpose({
  /**
   * @description Validate the whole form. Receives a callback or returns `Promise`.
   */
  validate,
  /**
   * @description Validate specified fields.
   */
  validateField,
  /**
   * @description Reset specified fields and remove validation result.
   */
  resetFields,
  /**
   * @description Clear validation message for specified fields.
   */
  clearValidate,
  /**
   * @description Scroll to the specified fields.
   */
  scrollToField,
})
</script>
