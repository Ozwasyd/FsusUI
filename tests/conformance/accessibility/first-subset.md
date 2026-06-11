# Accessibility Conformance Notes

The first component subset must preserve native platform accessibility behavior
and add Fsus-specific state semantics only where needed.

Required checks:

- Button: accessible name, disabled state, loading state, keyboard activation
  with Enter and Space.
- Input: accessible name, placeholder fallback, invalid state, readonly state,
  focus order.
- Checkbox: accessible name, checked state, disabled state, keyboard toggle.
- Dialog: accessible name, modal state, focus order, Escape policy, loading
  state announcement where applicable.
- Tabs: tablist semantics, selected state, disabled item state, keyboard arrow
  navigation.
- Menu: menu semantics, selected state, disabled item state, keyboard activation.
- Icon-only button: accessible name required from visible text,
  `aria-label`, or `aria-labelledby`; decorative icons must not duplicate the
  accessible name.

Web uses native semantics and ARIA where required. Avalonia uses native control
automation behavior and wrapper properties that preserve focusability and state
mapping.
