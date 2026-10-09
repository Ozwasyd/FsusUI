import type { Nullable } from '@element-plus/utils';
import type { TableColumnCtx } from './table-column/defaults';
import type { ElTooltipProps } from '@element-plus/components/tooltip';
export type TableOverflowTooltipOptions = Partial<Pick<ElTooltipProps, 'effect' | 'enterable' | 'hideAfter' | 'offset' | 'placement' | 'popperClass' | 'popperOptions' | 'showAfter' | 'showArrow'>>;
export declare const getCell: (event: Event) => HTMLTableCellElement | null;
export declare const orderBy: <T>(array: T[], sortKey: string, reverse: string | number, sortMethod: any, sortBy: string | (string | ((a: T, b: T, array?: T[]) => number))[]) => T[];
export declare const getColumnById: <T>(table: {
    columns: TableColumnCtx<T>[];
}, columnId: string) => null | TableColumnCtx<T>;
export declare const getColumnByKey: <T>(table: {
    columns: TableColumnCtx<T>[];
}, columnKey: string) => TableColumnCtx<T>;
export declare const getColumnByCell: <T>(table: {
    columns: TableColumnCtx<T>[];
}, cell: HTMLElement, namespace: string) => null | TableColumnCtx<T>;
export declare const getRowIdentity: <T>(row: T, rowKey: string | ((row: T) => any)) => string;
export declare const getKeysMap: <T>(array: T[], rowKey: string) => Record<string, {
    row: T;
    index: number;
}>;
export declare function mergeOptions<T, K>(defaults: T, config: K): T & K;
export declare function parseWidth(width: number | string): number | string;
export declare function parseMinWidth(minWidth: number | string): number | string;
export declare function parseHeight(height: number | string): string | number | null;
export declare function compose(...funcs: any[]): any;
export declare function toggleRowStatus<T>(statusArr: T[], row: T, newVal: boolean): boolean;
export declare function walkTreeNode(root: any, cb: any, childrenKey?: string, lazyKey?: string): void;
export declare let removePopper: any;
export declare function createTablePopper(parentNode: HTMLElement | undefined, trigger: HTMLElement, popperContent: string, nextZIndex: () => number, tooltipOptions?: TableOverflowTooltipOptions): Nullable<import("vue").CreateComponentPublicInstanceWithMixins<Readonly<import("vue").ExtractPropTypes<{
    readonly role: {
        readonly type: import("vue").PropType<import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>>;
        readonly required: false;
        readonly validator?: (val: unknown) => boolean;
        readonly default: "tooltip";
        __epPropKey: true;
    };
}>> & Readonly<{}>, {
    props: import("@vue/shared").LooseRequired<Readonly<import("vue").ExtractPropTypes<{
        readonly role: {
            readonly type: import("vue").PropType<import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>>;
            readonly required: false;
            readonly validator?: (val: unknown) => boolean;
            readonly default: "tooltip";
            __epPropKey: true;
        };
    }>> & Readonly<{}> & {}>;
    triggerRef: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
    popperInstanceRef: import("vue").Ref<import("@popperjs/core").Instance | undefined, import("@popperjs/core").Instance | undefined>;
    contentRef: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
    referenceRef: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
    role: import("vue").ComputedRef<import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>>;
    popperProvides: import("@element-plus/components/popper").ElPopperInjectionContext;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, import("vue").PublicProps, {
    readonly role: import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>;
}, true, {}, {}, import("vue").GlobalComponents, import("vue").GlobalDirectives, string, {}, any, import("vue").ComponentProvideOptions, {
    P: {};
    B: {};
    D: {};
    C: {};
    M: {};
    Defaults: {};
}, Readonly<import("vue").ExtractPropTypes<{
    readonly role: {
        readonly type: import("vue").PropType<import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>>;
        readonly required: false;
        readonly validator?: (val: unknown) => boolean;
        readonly default: "tooltip";
        __epPropKey: true;
    };
}>> & Readonly<{}>, {
    props: import("@vue/shared").LooseRequired<Readonly<import("vue").ExtractPropTypes<{
        readonly role: {
            readonly type: import("vue").PropType<import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>>;
            readonly required: false;
            readonly validator?: (val: unknown) => boolean;
            readonly default: "tooltip";
            __epPropKey: true;
        };
    }>> & Readonly<{}> & {}>;
    triggerRef: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
    popperInstanceRef: import("vue").Ref<import("@popperjs/core").Instance | undefined, import("@popperjs/core").Instance | undefined>;
    contentRef: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
    referenceRef: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
    role: import("vue").ComputedRef<import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>>;
    popperProvides: import("@element-plus/components/popper").ElPopperInjectionContext;
}, {}, {}, {}, {
    readonly role: import("@element-plus/utils").EpPropMergeType<StringConstructor, "dialog" | "menu" | "grid" | "group" | "listbox" | "navigation" | "tooltip" | "tree", unknown>;
}>>;
export declare const isFixedColumn: <T>(index: number, fixed: string | boolean, store: any, realColumns?: TableColumnCtx<T>[]) => {
    direction: string;
    start: number;
    after: number;
} | {
    direction?: undefined;
    start?: undefined;
    after?: undefined;
};
export declare const getFixedColumnsClass: <T>(namespace: string, index: number, fixed: string | boolean, store: any, realColumns?: TableColumnCtx<T>[], offset?: number) => string[];
export declare const getFixedColumnOffset: <T>(index: number, fixed: string | boolean, store: any, realColumns?: TableColumnCtx<T>[]) => any;
export declare const ensurePosition: (style: any, key: string) => void;
