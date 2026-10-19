#!/usr/bin/env bash
# Fork (free skin mode): build the CS2 module and pack it with its installer.
#
#   bash scripts/fork/build-free-skins.sh <version> [out-dir]
#
# <version> is the platform release it is built on plus a fork suffix, e.g.
# 3.0.0-beta.177.free.1 on tag v3.0.0-beta.177: it sorts above that official
# release and below the next one. Writes <out-dir>/cs2-<version>.tar.gz with
# cs2/ (the module folder), install.sh, LEIA-ME.md and VERSION.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
VERSION="${1:?usage: build-free-skins.sh <version> [out-dir]}"
OUT="${2:-$ROOT/dist-fork}"

if ! node -e "process.exit(require('semver').valid(process.argv[1]) ? 0 : 1)" "$VERSION"; then
  echo "'$VERSION' is not a semver version" >&2
  exit 1
fi

WORK="$(mktemp -d)"
cp package.json "$WORK/package.json.orig"
restore() { cp "$WORK/package.json.orig" package.json; rm -rf "$WORK"; }
trap restore EXIT

# The module takes the root package.json's version (as the release does).
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version=process.argv[1];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')" "$VERSION"

mkdir -p "$WORK/pkg"
node_modules/.bin/tsx scripts/modules/cs2/build.ts "$WORK/pkg/cs2"
BUILT="$(node -p "require('$WORK/pkg/cs2/module.json').version")"
[ "$BUILT" = "$VERSION" ] || { echo "built $BUILT, expected $VERSION" >&2; exit 1; }

cp scripts/fork/install.sh scripts/fork/LEIA-ME.md "$WORK/pkg/"
echo "$VERSION" > "$WORK/pkg/VERSION"
mkdir -p "$OUT"
tar -czf "$OUT/cs2-$VERSION.tar.gz" -C "$WORK/pkg" .
echo "$OUT/cs2-$VERSION.tar.gz"
