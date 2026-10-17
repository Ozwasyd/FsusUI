---
'element-plus': patch
---

Keep classic Select's exact tooltip ref contract representable in public
declarations, including its Option and OptionGroup installer extras and the
downstream TimeSelect and Pagination declarations. Runtime JavaScript, events,
slots, exposed methods, exports, and installer extras remain unchanged.

BREAKING: Binding the existing Select `Partial<Options>` annotation to Popper's
`Options` intentionally narrows the public `popperOptions` prop (including the
instance's `$props`) from its previously unresolved permissive type to
`Partial<Options> | undefined`. Invalid values previously accepted by TypeScript,
such as `placement: 123` or `strategy: 'invalid'`, now produce TS2322. Migrate to
Popper values such as `placement: 'bottom-start'` and `strategy: 'fixed'`; valid
partial option objects and omitting the prop remain supported.

Raw original/repaired prop equality fails with TS2344 and is retained as
compatibility evidence. Equality after explicitly binding the original free
`Options` name checks the intended declared contract; it does not establish
unchanged raw public types.
