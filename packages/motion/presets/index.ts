import { motionCssVars, motionTokens } from '../tokens'
import { motionPresetNames } from '../types'
import type { MotionPresetDefinition, MotionPresetName } from '../types'

const none = 'translate3d(0, 0, 0)'

export const motionPresets: Record<MotionPresetName, MotionPresetDefinition> = {
  'fade-in': {
    name: 'fade-in',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    from: { opacity: '0' },
    to: { opacity: '1' },
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0' },
  },
  'fade-up': {
    name: 'fade-up',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.decelerate ?? motionTokens.easing.decelerate,
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.sm}, 0)`,
    },
    to: { opacity: '1', transform: none },
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.sm}, 0)`,
    },
  },
  'fade-down': {
    name: 'fade-down',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    from: {
      opacity: '0',
      transform: `translate3d(0, calc(${motionCssVars.distance.sm} * -1), 0)`,
    },
    to: { opacity: '1', transform: none },
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, calc(${motionCssVars.distance.sm} * -1), 0)`,
    },
  },
  'fade-left': {
    name: 'fade-left',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    from: {
      opacity: '0',
      transform: `translate3d(${motionCssVars.distance.sm}, 0, 0)`,
    },
    to: { opacity: '1', transform: none },
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(${motionCssVars.distance.sm}, 0, 0)`,
    },
  },
  'fade-right': {
    name: 'fade-right',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    from: {
      opacity: '0',
      transform: `translate3d(calc(${motionCssVars.distance.sm} * -1), 0, 0)`,
    },
    to: { opacity: '1', transform: none },
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(calc(${motionCssVars.distance.sm} * -1), 0, 0)`,
    },
  },
  'scale-fade': {
    name: 'scale-fade',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    from: { opacity: '0', transform: 'scale(0.96)' },
    to: { opacity: '1', transform: 'scale(1)' },
    leaveFrom: { opacity: '1', transform: 'scale(1)' },
    leaveTo: { opacity: '0', transform: 'scale(0.98)' },
  },
  'slide-left': {
    name: 'slide-left',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    from: { transform: 'translate3d(100%, 0, 0)' },
    to: { transform: none },
    leaveFrom: { transform: none },
    leaveTo: { transform: 'translate3d(100%, 0, 0)' },
  },
  'slide-right': {
    name: 'slide-right',
    duration: motionCssVars.duration.panel,
    easing: motionCssVars.easing.emphasized,
    from: { transform: 'translate3d(-100%, 0, 0)' },
    to: { transform: none },
    leaveFrom: { transform: none },
    leaveTo: { transform: 'translate3d(-100%, 0, 0)' },
  },
  'slide-up': {
    name: 'slide-up',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.emphasized,
    from: { transform: 'translate3d(0, 100%, 0)' },
    to: { transform: none },
    leaveFrom: { transform: none },
    leaveTo: { transform: 'translate3d(0, 100%, 0)' },
  },
  'list-stagger': {
    name: 'list-stagger',
    duration: motionCssVars.duration.base,
    easing: motionCssVars.easing.standard,
    stagger: motionCssVars.stagger.base,
    from: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.sm}, 0)`,
    },
    to: { opacity: '1', transform: none },
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: {
      opacity: '0',
      transform: `translate3d(0, ${motionCssVars.distance.sm}, 0)`,
    },
  },
  'route-fade': {
    name: 'route-fade',
    duration: motionCssVars.duration.route,
    easing: motionCssVars.easing.standard,
    from: { opacity: '0' },
    to: { opacity: '1' },
    leaveFrom: { opacity: '1' },
    leaveTo: { opacity: '0' },
  },
  'card-hover': {
    name: 'card-hover',
    duration: motionCssVars.duration.fast,
    easing: motionCssVars.easing.standard,
    from: { opacity: '0.92', transform: 'translate3d(0, 2px, 0)' },
    to: { opacity: '1', transform: none },
    leaveFrom: { opacity: '1', transform: none },
    leaveTo: { opacity: '0.92', transform: 'translate3d(0, 2px, 0)' },
  },
}

export const isMotionPresetName = (value: unknown): value is MotionPresetName =>
  motionPresetNames.includes(value as MotionPresetName)

export const resolveMotionPresetName = (
  value: unknown,
  fallback: MotionPresetName = 'fade-in',
): MotionPresetName => (isMotionPresetName(value) ? value : fallback)

export const getMotionPreset = (name: unknown): MotionPresetDefinition =>
  motionPresets[resolveMotionPresetName(name)]
