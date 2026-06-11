# Platform Overrides

Platform differences are allowed only when they are explicit and testable.

Each override entry must include:

- `id`
- affected spec domain
- affected platform
- reason
- user-visible impact
- token or contract fallback
- conformance test expectation
- owner
- review date

Override entries must not become a private second design system. If the same
override is needed repeatedly, promote the behavior back into the neutral spec.
