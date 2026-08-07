# Native CJK IME Acceptance Workflow

> **Role:** Repeatable verification workflow
> **Applies to:** FsusUI MarkdownEditor native input acceptance on Linux/X11
> **Authority:** Procedural. It executes the behavior contracts in `spec/` and the
> MarkdownEditor transaction contract; it cannot redefine them.

The native IME harness proves that real OS-level ibus input reaches the real
`ElMarkdownEditor` textarea in a real Chromium window. It never substitutes
synthetic `compositionstart`/`compositionend` events and never prints a green
receipt when the editor target is absent.

## What it verifies

- **commit**: `nihao` + Space commits 你好 with a composition transaction.
- **cancel**: `Escape` cancels the composition without a history entry.
- **candidate**: `Down` + Space commits the second candidate (你好吗).
- **backspace**: native Backspace emits `deleteContentBackward`.
- **undo/redo**: native `Ctrl+Z` and `Ctrl+Shift+Z` transition history correctly.

Each step records the OS, browser executable and PID, ibus engine and PID,
locale, window/PID, fixture URL, probe identity, document identity, candidate
SHA, the exact injected keys, the DOM event trace, and the final
source/selection/history state.

## Prerequisites

- Linux with a reachable X11 display (the harness fails explicitly otherwise).
- Google Chrome or Chromium at `/usr/bin/google-chrome`,
  `/usr/bin/google-chrome-stable`, `/usr/bin/chromium`, or
  `/usr/bin/chromium-browser` (override with `FSUS_IME_CHROME_PATH`).
- `python3` with `python-xlib` (`import Xlib; import Xlib.ext.xtest`).
- A running ibus daemon with the `libpinyin` engine selected. The engine name
  is checked with `ibus engine` before any browser is launched.
- A built demo (`pnpm run build:demo`); the harness builds it by default.

The harness is intentionally **not** part of the default CI gates because CI
runners do not provide a real CJK IME session.

## Running

```bash
pnpm run test:markdown-editor:ime
```

Reuse an existing demo build and write evidence to a custom directory:

```bash
FSUS_IME_EXTRA_ENV='{"DBUS_SESSION_BUS_ADDRESS":"unix:path=/run/user/1000/bus","XDG_RUNTIME_DIR":"/run/user/1000"}' \
  node ./scripts/native-ime-harness.mjs --skip-build --out /tmp/fsus-ime-evidence
```

On a userland ibus runtime, source the runtime environment first so both the
prerequisite probe and the browser inherit `DBUS_SESSION_BUS_ADDRESS`,
`DISPLAY`, `GTK_IM_MODULE=ibus`, and `XMODIFIERS=@im=ibus`. The browser
environment is the current process environment merged with `FSUS_IME_EXTRA_ENV`
and forced `GTK_IM_MODULE=ibus`/`QT_IM_MODULE=ibus`/`XMODIFIERS=@im=ibus`.

## Options and environment

| Option | Effect |
| --- | --- |
| `--out <dir>` | Evidence output directory (default `.tmp/native-ime-evidence`) |
| `--skip-build` | Reuse the existing demo build (or `FSUS_IME_SKIP_BUILD=1`) |
| `--no-screenshot` | Skip per-step screenshots |
| `--help` | Print usage |

| Environment | Meaning |
| --- | --- |
| `FSUS_IME_DISPLAY` | X11 display (default `DISPLAY`) |
| `FSUS_IME_CHROME_PATH` | Chrome executable override |
| `FSUS_IME_PYTHON` | Python interpreter (default `python3`) |
| `FSUS_IME_REQUIRE_ENGINE` | Expected ibus engine (default `libpinyin`) |
| `FSUS_IME_EDITOR_SELECTOR` | Editor selector inside the fixture (default `[data-testid="markdown-editor-transaction-fixture"] .el-markdown-editor textarea`) |
| `FSUS_IME_EXPECT_WINDOW_CLASS` | Browser window class (default `Google-chrome`) |
| `FSUS_IME_DELAY_MOUNT_MS` | Delay the fixture mount (negative-path testing) |
| `FSUS_IME_MOUNT_TIMEOUT_MS` | Wait for fixture/editor interactivity (default 20000) |
| `FSUS_IME_STEP_TIMEOUT_MS` | Per-step state wait (default 15000) |
| `FSUS_IME_EXTRA_ENV` | JSON object merged into the browser/ibus environment |

## Identity binding

The harness binds, in order:

1. the candidate SHA and branch from `git rev-parse` in the repository;
2. the browser process via `/proc` command lines matching the temporary
   `--user-data-dir` profile (never by window title or timeout);
3. the X11 window by `WM_CLASS` plus `_NET_WM_PID`, with the target point
   verified inside the window geometry;
4. the page identity (`window.__fsusNativeImeDocumentId`) and fixture probe
   identity (`data-markdown-editor-probe-id`, stable per tab session);
5. the real textarea via its bounding box and native XTEST pointer/key input.

If any identity check fails, the harness reports a distinct failure category
instead of guessing.

## Evidence

The output directory contains:

- `manifest.json` — full structured evidence (verdict, SHA, OS, browser, IME,
  locale, window, page, fixture, steps);
- `receipt.txt` — human-readable summary; only written with `verdict: pass`
  after every step passes;
- `steps/<name>.json` — per-step keys, trace, final value/selection/history;
- `screenshots/<name>.png` — per-step screenshots unless disabled;
- `failure.json` — category and message on failure.

## Failure categories

| Exit | Category | Meaning |
| --- | --- | --- |
| 2 | `prerequisite-missing` | Linux/X11, python-xlib, Chrome, or ibus engine missing |
| 3 | `page-not-ready` | Demo preview did not become ready |
| 4 | `target-absent` | Fixture/editor absent, disabled, or late to mount |
| 5 | `window-pid-mismatch` | Window/PID/target mismatch or identity change |
| 6 | `input-not-delivered` | Injected input never reached the page |
| 7 | `composition-not-started` | No real composition events |
| 8 | `assertion-failed` | A step reached the wrong final state |
| 9 | `internal-error` | Harness bug or unknown failure |

## Negative-path self test

```bash
pnpm run test:markdown-editor:ime:self-test
```

The self test reuses an existing demo build and asserts three failures:
delayed mount → `target-absent` (4), wrong editor selector → `target-absent`
(4), wrong expected window class → `window-pid-mismatch` (5). It proves the
harness cannot misreport a missing target as green.

## Platform observations

On Chromium with ibus on Linux, keys consumed by the IME reach the page as
`keydown` events with `key: "Process"` while composition is active. The Down
key used for candidate navigation can surface with `code: "NumpadEnter"` and a
`keyup` carrying `key: "ArrowDown"`; the harness matches the real event shape
instead of assuming a canonical `code`.

## Cleanup

The harness always closes the browser context, kills the preview server, and
removes the temporary Chrome profile in a `finally` block, including on every
failure path. Evidence is written only to `--out`; nothing is written into the
repository.
