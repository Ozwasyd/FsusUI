#!/usr/bin/env python3
"""Read-only reproduction of the observed-file comparison; no producer run."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source_root", type=Path)
parser.add_argument("observation", type=Path)
args = parser.parse_args()
observation = json.loads(args.observation.read_text())
results = []
for expected in observation["inputs"]:
    source = args.source_root / expected["path"]
    data = source.read_bytes() if source.is_file() else None
    actual_hash = hashlib.sha256(data).hexdigest() if data is not None else None
    actual_bytes = len(data) if data is not None else None
    results.append({"path": expected["path"], "expectedSha256": expected["sha256"],
                    "actualSha256": actual_hash, "expectedBytes": expected["bytes"],
                    "actualBytes": actual_bytes,
                    "match": actual_hash == expected["sha256"] and actual_bytes == expected["bytes"]})
mismatches = [entry for entry in results if not entry["match"]]
print(json.dumps({"inputCount": len(results), "matchedCount": len(results) - len(mismatches),
                  "mismatches": mismatches}, indent=2))
raise SystemExit(1 if mismatches else 0)
