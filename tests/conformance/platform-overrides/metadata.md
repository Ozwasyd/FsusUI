# Platform Override Metadata Gate

Every registered platform difference must include:

- id
- affected component
- affected contract id
- affected platform
- reason
- user-visible impact
- visual threshold
- behavior expectation
- allowed deviation
- test policy
- owner
- review date
- linked issue or PR

The conformance gate checks this metadata before platform-specific differences
can be treated as accepted variance.
