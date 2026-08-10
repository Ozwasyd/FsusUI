# Avalonia form-generator registration contract

Issue #354 introduces an analyzer-only incremental source generator. A single canonical registration declaration supplies the generator with the information needed to emit strongly typed adapters and a deterministic registry; the runtime package must not depend on the generator assembly.

Generated adapters access resolved Roslyn members directly. They do not construct a string-property table or use runtime `GetProperty` lookups. Registration capability is explicit in the canonical declaration: file names and type suffixes do not imply it, and attribute, JSON, and handwritten switches are not parallel sources of truth.

The registry resolves the most-specific derived type first. Its generated hint names and emitted ordering are deterministic, so a change in input ordering does not change registry semantics. Incremental inputs remain scoped so unrelated source changes do not unconditionally invalidate every generated output.

Invalid registrations fail at compile time with stable diagnostics, including missing members, inaccessible or non-writable members, incompatible member types, static members, indexers, duplicates, inherited-member ambiguity, and unsupported nullability. Internal generator failures are converted to an explicit diagnostic.

The test suite covers deterministic and incremental behavior, package-graph separation from the runtime package, and mutation fixtures that reject reflection-based output, a second handwritten registry, and non-deterministic generation. This issue deliberately does not migrate all built-in registrations or Form runtime behavior.
