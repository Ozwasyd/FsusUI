import ElementPlus, {
  ElSlider,
  sliderProps,
  sliderEmits,
} from '@ozwasyd/element-plus'
import {type ElSlider as SliderNamed} from '@ozwasyd/element-plus/es/components/slider';
import type SliderDefault from '@ozwasyd/element-plus/es/components/slider'
import { type ElSlider as CjsSlider } from '@ozwasyd/element-plus/lib/components/slider'
import type { SliderInstance, SliderProps } from '@ozwasyd/element-plus'
import type { useSlide } from '@ozwasyd/element-plus/es/components/slider/src/composables/use-slide'
import type { SliderButtonInstance } from '@ozwasyd/element-plus/es/components/slider/src/button'
import type {
  App,
  CSSProperties,
  ComputedRef,
  Ref,
  GlobalComponents,
} from 'vue'
import '@ozwasyd/element-plus/global'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Typed<T> = 0 extends 1 & T ? false : true
const namedDefault: Equal<typeof ElSlider, typeof SliderDefault> = true
const namedBarrel: Equal<typeof SliderNamed, typeof SliderDefault> = true
const namedCjs: Equal<typeof CjsSlider, typeof SliderDefault> = true
const globalSlider: Equal<GlobalComponents['ElSlider'], typeof ElSlider> = true
const typedInstance: Typed<SliderInstance> = true
const typedReturn: Typed<ReturnType<typeof useSlide>> = true
const typedButton: Typed<ReturnType<typeof useSlide>['firstButton']['value']> =
  true
const refContract: Equal<
  ReturnType<typeof useSlide>['firstButton'],
  Ref<SliderButtonInstance | undefined>
> = true
const parameters: Equal<Parameters<typeof useSlide>[0], SliderProps> = true
const clickReturn: Equal<
  ReturnType<SliderInstance['onSliderClick']>,
  void
> = true
const clickParameter: Equal<
  Parameters<SliderInstance['onSliderClick']>[0],
  MouseEvent | TouchEvent
> = true

declare const app: App
declare const instance: SliderInstance
declare const slide: ReturnType<typeof useSlide>
app.use(ElementPlus)
app.use(ElSlider)
instance.onSliderClick(new MouseEvent('click'))
instance.onSliderClick(new TouchEvent('touchstart'))
instance.$emit('update:modelValue', 12)
instance.$emit('input', [12, 48])
instance.$emit('change', 48)
const single: typeof instance.$props = {
  modelValue: 12,
  min: 0,
  max: 100,
  step: 2,
  range: false,
  showInput: true,
  inputSize: 'small',
  placement: 'top',
  formatTooltip: (value) => `${value}`,
  formatValueText: (value) => `${value}`,
  marks: { 20: 'Twenty', 80: { style: { color: 'red' }, label: 'Eighty' } },
}
const range: typeof instance.$props = {
  modelValue: [20, 80],
  range: true,
  vertical: true,
  height: '200px',
  onChange: (value) => {
    const result: number | number[] = value
    void result
  },
}
const slots: SliderInstance['$slots'] = instance.$slots
const css: ComputedRef<CSSProperties> = slide.barStyle
const button: Ref<SliderButtonInstance | undefined> = slide.firstButton
slide.firstButton.value = slide.secondButton.value
slide.firstButton.value?.onButtonDown(new MouseEvent('mousedown'))
slide.firstButton.value?.onKeyDown(new KeyboardEvent('keydown'))
const position: Promise<void> | undefined =
  slide.firstButton.value?.setPosition(25)
const hovering: boolean | undefined = slide.firstButton.value?.hovering
const dragging: boolean | undefined = slide.firstButton.value?.dragging
const buttonProps = slide.firstButton.value?.$props
const buttonSlots = slide.firstButton.value?.$slots
slide.firstButton.value?.$emit('update:modelValue', 25)
const positioned: Ref<SliderButtonInstance | undefined> = slide.setPosition(50)
slide.setFirstValue(undefined)
slide.setFirstValue(40)
slide.setSecondValue(60)
slide.setFirstPosition(40)
slide.setSecondPosition(60)
const changed: Promise<void> = slide.emitChange()
const down: Promise<void> = slide.onSliderDown(new TouchEvent('touchstart'))
slide.onSliderWrapperPrevent(new TouchEvent('touchmove'))
slide.elFormItem?.validate('change')
const keys: Equal<
  keyof ReturnType<typeof useSlide>,
  | 'elFormItem'
  | 'slider'
  | 'firstButton'
  | 'secondButton'
  | 'sliderDisabled'
  | 'minValue'
  | 'maxValue'
  | 'runwayStyle'
  | 'barStyle'
  | 'resetSize'
  | 'setPosition'
  | 'emitChange'
  | 'onSliderWrapperPrevent'
  | 'onSliderClick'
  | 'onSliderDown'
  | 'setFirstPosition'
  | 'setFirstValue'
  | 'setSecondPosition'
  | 'setSecondValue'
> = true
void [
  namedDefault,
  namedBarrel,
  namedCjs,
  globalSlider,
  typedInstance,
  typedReturn,
  typedButton,
  refContract,
  parameters,
  clickReturn,
  clickParameter,
  single,
  range,
  slots,
  css,
  button,
  position,
  hovering,
  dragging,
  buttonProps,
  buttonSlots,
  positioned,
  changed,
  down,
  keys,
  sliderProps,
  sliderEmits,
]
