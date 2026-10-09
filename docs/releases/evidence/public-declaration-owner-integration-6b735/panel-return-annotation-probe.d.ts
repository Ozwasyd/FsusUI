import DatePickPanel from './date-picker-com/panel-date-pick.vue';
import DateRangePickPanel from './date-picker-com/panel-date-range.vue';
import MonthRangePickPanel from './date-picker-com/panel-month-range.vue';
import type { IDatePickerType } from './date-picker.type';
export declare const getPanel: (type: IDatePickerType) => typeof DatePickPanel | typeof DateRangePickPanel | typeof MonthRangePickPanel;
