#!/usr/bin/env bash
set -euo pipefail
evidence=${1:?Expected a diagnostic output directory}
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
# Build in a fresh directory (not in a product checkout).
cp Decoder.csproj Program.cs global.json "$scratch"/
(
  cd -- "$scratch"
  dotnet build Decoder.csproj --configuration Release --output "$scratch/bin"
)
while IFS= read -r -d '' trace; do
  dotnet exec --fx-version 10.0.15 "$scratch/bin/Decoder.dll" "$trace" > "${trace%.nettrace}.events.jsonl"
done < <(find "$evidence" -type f -name '*.nettrace' -print0 | sort -z)
python3 reduce.py "$evidence"
