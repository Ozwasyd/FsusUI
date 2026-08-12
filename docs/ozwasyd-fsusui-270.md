# Markdown editor command contract

Markdown editor commands are registered once and consumed by every surface. A
command has a stable `key`, `label`, optional `description`, `group`, controlled
icon token, shortcut, and presentation targets. `when(context)` determines
whether a surface presents the command; `enabled(context)` determines whether it
can run. Surfaces must not maintain their own command lists or reinterpret these
decisions.

Commands receive only the public command context: document identity and epoch,
revision, selection, mode, read-only state, the syntax/node/range projection,
an abort signal, and the FsusUI transaction dispatcher. Syntax facts—including
source, marker, content ranges, and node identity—come from the editor
projection. A command must not parse Markdown, inspect rendered DOM, access a
textarea/editor instance, or retain raw selection offsets.

`run(context)` may synchronously return a controlled result or return one
asynchronously. Results describe an FsusUI transaction, intent, or controlled
side effect; they never mutate DOM, textarea value, or an editor implementation
directly. Consumers render returned errors with their own feedback component;
commands do not display toasts themselves.

## Async lifecycle

The shared command state progresses from `idle` to
`pending(document, revision, anchor)`, then to `resolved-current`, `rejected`,
`aborted`, or `stale`. While pending, a key is normally not submitted again
unless that command explicitly allows concurrency. On an edit or selection
change, the dispatcher rebases the registered anchor through the position map.
If the anchor is fully deleted, the result is `stale`/`deleted` and is never
placed beside surviving text. A document identity or epoch change cancels every
pending command, even when the new source text is identical. Results that arrive
after cancellation or staleness are ignored.

The registry shares a command's key, label, shortcut, visibility, enabled state,
pending state, and result across source, live, split, preview, toolbar,
keyboard, palette, slash, and selection presentations. Presentation changes how
the command is shown, not what it does. Registry construction detects shortcut
conflicts explicitly; array order cannot silently choose a winner.

## Consumer command examples

### Link selection

A consumer can register a generic `insert-link` command that is visible for a
text selection and enabled only when the syntax projection permits inline
content. Its `run` returns a transaction intent using the supplied selection and
dispatcher. The command knows neither the active surface nor any product
specific route.

### Attachment chooser

A consumer can register `insert-attachment` with a controlled icon token and an
async provider. It starts with the context signal and records the document,
revision, and anchor supplied by FsusUI. When the provider resolves, the result
is dispatched only after the shared position map confirms a current anchor;
aborted, deleted, and stale outcomes produce no document mutation.

### Async picker

A consumer may register a generic `insert-reference` command backed by an async
picker service. The same pending and error result is available to every
presentation. The consuming application may render an error panel, inline
message, or notification after receiving that result, while the command remains
independent of any application-specific content model.

