#! /bin/bash
set -euo pipefail

if [[ "${RELEASE_VERIFY:-0}" != "1" && "${1:-}" != "--strict" ]]; then
  echo "file-check is release-only; pass --strict or RELEASE_VERIFY=1 to compare published tarballs."
  exit 0
fi

CURRENT_PUBLISHED_TARBALL="$(npm view element-plus dist.tarball)"

echo $CURRENT_PUBLISHED_TARBALL

mkdir -p tmp

curl -o ./tmp/latest.tgz $CURRENT_PUBLISHED_TARBALL
tar zxvf ./tmp/latest.tgz -C ./tmp

diff -qr ./tmp/package ./dist/element-plus | grep "Only" | cut -c 8- | sort > ./tmp/diff.txt
