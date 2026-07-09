# Public Preview Secret And History Scan

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`
Candidate commit: this file's containing commit

## Scope

The scan covered the current tracked tree and Git history blob contents for
token-like secrets, private keys, private GitHub image attachments, and local
machine paths.

No dedicated scanner such as `gitleaks`, `trufflehog`, or `detect-secrets` was
available in the local environment, so the scan used Git plumbing plus strict
regular expressions.

## Current Tree Token Scan

```bash
git grep -nE '(_authToken[[:space:]]*=[[:space:]]*[A-Za-z0-9._-]{8,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY)' -- .
```

Result:

```text
current-tree-secret-scan-exit=1
```

Exit `1` means no matches.

## History Blob Token Scan

```bash
git rev-list --objects --all \
  | awk '{print $1}' \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize)' \
  | awk '$1=="blob" && $3 < 5000000 {print $2}' \
  | git cat-file --batch \
  | rg -n --pcre2 '(_authToken\s*=\s*[A-Za-z0-9._-]{8,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY)'
```

Result:

```text
history-blob-secret-scan-exit=1
```

Exit `1` means no matches. Blobs larger than 5 MiB were skipped to avoid
expanding binary package artifacts and visual snapshots into the token scanner.

## False Positive Review

A slower `git log -S _authToken=` scan surfaced commit `ece6d4e707` because
`docs/guide/installation.md` documents this placeholder:

```ini
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

This is not a secret. It is a documented environment-variable placeholder.

## Private Attachment And Local Path Scan

```bash
git grep -nE '(private-user-images\.githubusercontent\.com|user-images\.githubusercontent\.com|/home/[A-Za-z0-9._-]+/|C:\\Users\\)' -- .
```

Result:

```text
private-asset-path-strict-scan-exit=1
```

Exit `1` means no matches.

An additional broader scan found `file://` strings only in
`vue/packages/wasm/runtime/emscripten.ts`, where they are runtime URL handling
logic for local WASM files, not hard-coded local machine paths.
