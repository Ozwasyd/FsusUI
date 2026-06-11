# Security Policy

Do not report vulnerabilities in public GitHub issues, pull requests,
discussions, demo examples, or screenshots.

## Supported Versions

| Package / branch                               | Security support                                        |
| ---------------------------------------------- | ------------------------------------------------------- |
| `main`                                         | Supported for public-preview security triage.           |
| `@ozwasyd/element-plus@1.5.x`                  | Supported once published as the public-preview package. |
| Older private commits or unpublished artifacts | Best-effort only.                                       |

Public preview does not provide a production SLA, but security reports for the
current package line and `main` branch are reviewed before public disclosure.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting when available:

https://github.com/Ozwasyd/FsusUI/security/advisories/new

If private reporting is unavailable, contact the repository owner directly
through a private channel before sharing details publicly.

## In Scope

Reports may cover:

- XSS, DOM injection, unsafe HTML handling, or Markdown renderer bypasses.
- Mermaid, KaTeX, Shiki, code highlighting, or feature activation injection.
- SVG or icon injection issues in `packages/icons-svg` or generated icon
  components.
- WASM artifact loading, fallback, integrity, or generated runtime issues.
- Package publishing, dependency confusion, provenance, registry, or tarball
  content problems.
- Build or demo content that exposes private data, tokens, internal paths, or
  private registry configuration.

## What To Include

- Affected package, component, or workflow.
- A minimal private reproduction.
- Impact and expected attack scenario.
- Affected versions or commit range if known.
- Whether the issue involves package publishing, docs examples, demo content,
  WASM, Markdown rendering, dependency behavior, or browser runtime behavior.

## Out Of Scope

The following are usually out of scope unless they demonstrate a concrete
security impact:

- Generic dependency freshness reports without an exploit path.
- Self-XSS that requires pasting code into a trusted developer console.
- Denial-of-service reports requiring unrealistic local-only input sizes.
- Missing security headers on local demo or preview servers.
- Browser extensions, local malware, or compromised developer machines.
- Publicly documented preview limitations with no exploit path.

## Response Expectations

- Maintainers acknowledge valid private reports when available.
- Maintainers may ask for a smaller private reproduction or affected version
  range.
- Confirmed vulnerabilities are fixed privately when possible, then disclosed
  through a coordinated advisory or release note.
- Public proof-of-concept details should wait until maintainers confirm the
  disclosure plan.

## Public Issue Routing

Public issue templates intentionally route vulnerability reports here. Security
fixes should avoid public proof-of-concept details until a maintainer confirms
the disclosure plan.
