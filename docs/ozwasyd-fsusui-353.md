# Avalonia form adapter contract

Issue #353 defines the minimum, strongly typed runtime contract used by
`FsusFormItem` to interact with form controls. The form item depends on this
stable public/internal adapter boundary, never on a source-generator-private
type.

## Adapter operations and results

An adapter exposes typed operations to read the control value, write a value,
reset a value, and apply size. Each operation returns a stable result rather
than relying on an exception or a silent no-op. Results distinguish success
from unsupported capability and a diagnostic error. Diagnostic errors identify
the control/adapter operation and preserve the relevant reason, including a
type mismatch.

The contract has deterministic semantics:

- A nullable value is handled according to the adapter's declared value type;
  it is not inferred from a property name.
- Writing a value whose runtime type is incompatible with the adapter's
  declared type returns a type-mismatch diagnostic result.
- A read-only adapter returns a stable unsupported/read-only result for write
  and reset requests.
- An adapter without reset or size capability returns the stable unsupported
  result for that specific operation.
- An unknown control returns a clear, locatable diagnostic error. It must not
  silently succeed or no-op.

## Third-party controls

Third-party controls participate by explicitly supplying a strongly typed
adapter to `FsusFormItem`. They do not inherit a private adapter type and are
not discovered through runtime scanning. The explicitly supplied adapter owns
the control interaction for that item for its defined lifetime and takes
precedence over any later built-in mapping mechanism.

The contract does not use reflection, `dynamic`, activators, runtime expression
compilation, assembly scanning, or guesses based on names such as
`SelectedValue`, `Value`, `Text`, or `Size`. It also does not introduce a
universal `IFsusFormControl` abstraction.

## Scope and migration

This issue establishes the runtime contract and explicit third-party entry
point only. It does not create a source generator, register or migrate all
built-in controls, create a long-lived built-in switch/registry, or claim AOT
compatibility. Built-in mappings are deferred to the follow-up generator work.

Tests for the contract include mutation fixtures that reject reflection,
`dynamic`, string-property guessing, and silent no-op behavior.
