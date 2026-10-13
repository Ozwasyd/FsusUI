---
'element-plus': patch
---

Stage the pending original atomic retry owner and a separate SFC consumer adapter.
Let the original private owner admit old scope/ledger before File or native attempt
changes, and read the actual File only inside the post-phase dispatch callback.
Preserve original identity/epoch/reentry guards and frozen configuration; do not
infer admission from public counts or synthesize work settlement. Dependency and
consumer review are pending; runtime qualification and complete recovery stay held.
Record the actual native attempt inside the admitted dispatch callback and refuse
guessed-attempt rejection/retirement when that callback was never entered. The
original owner's post-mutation ledger custody repair remains pending.
