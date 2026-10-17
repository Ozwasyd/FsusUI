# TableV2 rendered fixture fonts

The two sealed TableV2 PNGs render byte-for-byte with these Noto Sans 2.004
regular and bold faces. The fixture selects this asset directory explicitly so
installed fonts and the shared test application's default font do not determine
text metrics or move the table regions. This does not change the production
component's font choice or the sealed PNG comparison.

The files are unmodified upstream hinted static instances from
[notofonts/noto-fonts commit c58682b28b18fd5d3755f4371635f862870c1531](https://github.com/notofonts/noto-fonts/commit/c58682b28b18fd5d3755f4371635f862870c1531),
under `hinted/ttf/NotoSans/`. Their SHA-256 hashes are:

| File | SHA-256 |
| --- | --- |
| `NotoSans-Regular.ttf` | `89c3c497f618fdaa0b2d1e98fef93582f28c71debd2c4a8cdf41f190ced2909d` |
| `NotoSans-Bold.ttf` | `e83493c945848ecd4a9ad0f6d19164541a0d3e23a9c952304a00a46e00272ac5` |

The upstream SIL Open Font License is included in `OFL.txt`. Font metadata
also identifies Copyright 2015 Google LLC and the same OFL 1.1 license.
Keep these faces isolated from the existing optional Google Sans collection.

Ordinary captures are retained in
`TestResults/visual-evidence/issue-285-table-v2/`, or the directory selected by
`FSUS_AVALONIA_VISUAL_EVIDENCE_ROOT`, before the unchanged sealed-byte assertion.
`FSUSUI_UPDATE_VISUAL_ARTIFACTS` is not needed to inspect a failure.
