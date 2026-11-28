import { defineComponent, h, ref, type PropType } from 'vue'
import FsusButton from '../button/FsusButton.vue'
import FsusInput from '../input/FsusInput.vue'

export type FsusPerceptionChallengeKind =
  | 'character'
  | 'text-task'
  | 'localization'
  | 'micro-interaction'

export interface FsusPerceptionChallengeAssignment {
  id: string
  kind: FsusPerceptionChallengeKind
  prompt: string
  mediaUrl?: string
  expiresAt?: number
}

export interface FsusPerceptionChallengeSubmitPayload {
  assignmentId: string
  kind: FsusPerceptionChallengeKind
  answer: unknown
}

const defaultAssignment = (
  kind: FsusPerceptionChallengeKind,
): FsusPerceptionChallengeAssignment => ({
  id: '',
  kind,
  prompt: '',
})

export const FsusPerceptionCharacterChallenge = defineComponent({
  name: 'FsusPerceptionCharacterChallenge',
  props: {
    assignment: {
      type: Object as PropType<FsusPerceptionChallengeAssignment>,
      default: () => defaultAssignment('character'),
    },
    disabled: { type: Boolean, default: false },
  },
  emits: ['submit'],
  setup(props, { emit }) {
    const answer = ref('')
    return () => {
      const assignment = props.assignment ?? defaultAssignment('character')
      return h('div', { class: 'fsus-challenge' }, [
        h('p', { class: 'fsus-challenge__prompt' }, assignment.prompt),
        assignment.mediaUrl
          ? h('img', { class: 'fsus-challenge__media', src: assignment.mediaUrl, alt: assignment.prompt })
          : null,
        h(FsusInput, {
          modelValue: answer.value,
          'onUpdate:modelValue': (v: string | number) => (answer.value = String(v)),
          disabled: props.disabled,
        }),
        h(
          FsusButton,
          {
            variant: 'primary',
            disabled: props.disabled || !answer.value.trim(),
            onClick: () =>
              emit('submit', {
                assignmentId: assignment.id,
                kind: 'character',
                answer: answer.value.trim(),
              } satisfies FsusPerceptionChallengeSubmitPayload),
          },
          () => 'Submit',
        ),
      ])
    }
  },
})

export const FsusTextTaskChallenge = defineComponent({
  name: 'FsusTextTaskChallenge',
  props: {
    assignment: { type: Object as PropType<FsusPerceptionChallengeAssignment>, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['submit'],
  setup(props, { emit }) {
    const answer = ref('')
    return () =>
      h('div', { class: 'fsus-challenge' }, [
        h('p', { class: 'fsus-challenge__prompt' }, props.assignment.prompt),
        h(FsusInput, {
          modelValue: answer.value,
          'onUpdate:modelValue': (v: string | number) => (answer.value = String(v)),
          disabled: props.disabled,
        }),
        h(
          FsusButton,
          {
            variant: 'primary',
            disabled: props.disabled || !answer.value.trim(),
            onClick: () =>
              emit('submit', {
                assignmentId: props.assignment.id,
                kind: 'text-task',
                answer: answer.value.trim(),
              } satisfies FsusPerceptionChallengeSubmitPayload),
          },
          () => 'Verify',
        ),
      ])
  },
})

export const FsusLocalizationChallenge = defineComponent({
  name: 'FsusLocalizationChallenge',
  props: {
    assignment: { type: Object as PropType<FsusPerceptionChallengeAssignment>, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['submit'],
  setup(props, { emit }) {
    const point = ref<{ x: number; y: number } | null>(null)
    return () =>
      h('div', { class: 'fsus-challenge' }, [
        h('p', { class: 'fsus-challenge__prompt' }, props.assignment.prompt),
        h(
          'div',
          {
            class: 'fsus-challenge__canvas',
            onClick: (e: MouseEvent) => {
              if (props.disabled) return
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const x = rect.width ? (e.clientX - rect.left) / rect.width : 0.5
              const y = rect.height ? (e.clientY - rect.top) / rect.height : 0.5
              point.value = { x, y }
              emit('submit', {
                assignmentId: props.assignment.id,
                kind: 'localization',
                answer: point.value,
              } satisfies FsusPerceptionChallengeSubmitPayload)
            },
          },
          props.assignment.mediaUrl
            ? [h('img', { class: 'fsus-challenge__media', src: props.assignment.mediaUrl, alt: props.assignment.prompt })]
            : ['Click target region'],
        ),
      ])
  },
})

export const FsusMicroInteractionChallenge = defineComponent({
  name: 'FsusMicroInteractionChallenge',
  props: {
    assignment: { type: Object as PropType<FsusPerceptionChallengeAssignment>, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['submit'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'fsus-challenge' }, [
        h('p', { class: 'fsus-challenge__prompt' }, props.assignment.prompt),
        h(
          FsusButton,
          {
            variant: 'primary',
            disabled: props.disabled,
            onClick: () =>
              emit('submit', {
                assignmentId: props.assignment.id,
                kind: 'micro-interaction',
                answer: { completedAt: Date.now() },
              } satisfies FsusPerceptionChallengeSubmitPayload),
          },
          () => 'Complete',
        ),
      ])
  },
})

export const FsusPerceptionChallenge = defineComponent({
  name: 'FsusPerceptionChallenge',
  props: {
    assignment: { type: Object as PropType<FsusPerceptionChallengeAssignment>, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['submit'],
  setup(props, { emit }) {
    return () => {
      const onSubmit = (payload: FsusPerceptionChallengeSubmitPayload) => emit('submit', payload)
      switch (props.assignment.kind) {
        case 'character':
          return h(FsusPerceptionCharacterChallenge, { assignment: props.assignment, disabled: props.disabled, onSubmit })
        case 'localization':
          return h(FsusLocalizationChallenge, { assignment: props.assignment, disabled: props.disabled, onSubmit })
        case 'micro-interaction':
          return h(FsusMicroInteractionChallenge, { assignment: props.assignment, disabled: props.disabled, onSubmit })
        default:
          return h(FsusTextTaskChallenge, { assignment: props.assignment, disabled: props.disabled, onSubmit })
      }
    }
  },
})
