import { type ElSlider } from '@ozwasyd/element-plus'
import type { SliderInstance } from '@ozwasyd/element-plus'
import type { useSlide } from '@ozwasyd/element-plus/es/components/slider/src/composables/use-slide'
declare const instance: SliderInstance
declare const slide: ReturnType<typeof useSlide>
const invalidValue: InstanceType<typeof ElSlider>['$props'] = {
  modelValue: '12',
}
const invalidSize: SliderInstance['$props'] = { inputSize: 'huge' }
const invalidPlacement: SliderInstance['$props'] = { placement: 'middle' }
const invalidFormatter: SliderInstance['$props'] = {
  formatValueText: (value: string) => value,
}
instance.onSliderClick(new KeyboardEvent('keydown'))
instance.$emit('change', '12')
instance.$emit('not-a-slider-event', 12)
slide.firstButton.value = 12
slide.firstButton.value?.setPosition('50')
slide.firstButton.value?.onKeyDown(new MouseEvent('click'))
slide.setSecondValue(undefined)
slide.setFirstValue('40')
slide.onSliderWrapperPrevent(new MouseEvent('mousemove'))
const invalidReturn: number = slide.emitChange()
const invalidClickReturn: Promise<void> = instance.onSliderClick(
  new MouseEvent('click'),
)
const invalidDragging: string | undefined = slide.firstButton.value?.dragging
void [
  invalidValue,
  invalidSize,
  invalidPlacement,
  invalidFormatter,
  invalidReturn,
  invalidClickReturn,
  invalidDragging,
]
