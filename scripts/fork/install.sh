#!/usr/bin/env bash
# Fork (free skin mode): install this CS2 module into a running Auto Tournament
# container, keeping a backup of the module it replaces.
#
#   bash install.sh [container]          install (default container: auto-tournament)
#   bash install.sh [container] --undo   put the backed-up module back
#
# Run it on the machine that runs the container, from the folder this file is in
# (next to the cs2/ folder). The platform must be the version the module was
# built for (see VERSION); pin that image tag in docker-compose.yml.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${1:-auto-tournament}"
MODE="${2:-}"
MODULES=/app/data/modules
BACKUPS=/app/data/module-backups

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "No container named '$CONTAINER'. Pass its name: bash install.sh <container>" >&2
  echo "(docker ps lists them)" >&2
  exit 1
fi

if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
  echo "The container '$CONTAINER' is not running. Start it first, from the folder with your" >&2
  echo "docker-compose.yml (not this one): docker compose up -d" >&2
  exit 1
fi

if [ "$MODE" = "--undo" ]; then
  if ! docker exec "$CONTAINER" test -d "$BACKUPS/cs2"; then
    echo "No backup in $BACKUPS/cs2: nothing to put back." >&2
    exit 1
  fi
  docker exec "$CONTAINER" sh -c "rm -rf $MODULES/cs2 && cp -a $BACKUPS/cs2 $MODULES/cs2"
  echo "The previous CS2 module is back. Restarting $CONTAINER..."
  docker restart "$CONTAINER" >/dev/null
  echo "Done."
  exit 0
fi

if [ ! -f "$HERE/cs2/module.json" ]; then
  echo "No cs2/module.json next to this script." >&2
  exit 1
fi
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HERE/cs2/module.json" | head -1)"

if ! docker exec "$CONTAINER" test -f "$MODULES/cs2/module.json"; then
  echo "CS2 is not installed in $CONTAINER ($MODULES/cs2)." >&2
  echo "Install Counter-Strike 2 on the site first (Manage > Modules), then run this again." >&2
  echo "If CS2 was installed before, check that the container uses your original data volume:" >&2
  echo "run docker compose from the folder of your original docker-compose.yml." >&2
  exit 1
fi
CURRENT="$(docker exec "$CONTAINER" sh -c "sed -n 's/.*\"version\": *\"\\([^\"]*\\)\".*/\\1/p' $MODULES/cs2/module.json | head -1")"
echo "Installed CS2 module: $CURRENT"
echo "This one:             $VERSION"

# Keep the official module once: a second install does not overwrite that backup.
if docker exec "$CONTAINER" test -d "$BACKUPS/cs2"; then
  echo "A backup is already in $BACKUPS/cs2 (kept)."
else
  docker exec "$CONTAINER" sh -c "mkdir -p $BACKUPS && cp -a $MODULES/cs2 $BACKUPS/cs2"
  echo "Backed up the installed module to $BACKUPS/cs2."
fi

docker exec "$CONTAINER" sh -c "rm -rf $MODULES/cs2.new"
docker cp "$HERE/cs2" "$CONTAINER:$MODULES/cs2.new"
docker exec "$CONTAINER" sh -c "rm -rf $MODULES/cs2 && mv $MODULES/cs2.new $MODULES/cs2"
echo "Installed. Restarting $CONTAINER..."
docker restart "$CONTAINER" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" sh -c "wget -qO- http://localhost:3069/api/skins/status" 2>/dev/null | grep -q '"freeMode"'; then
    echo "Done: CS2 $VERSION is running. Turn free mode on in Manage > Skins."
    exit 0
  fi
  sleep 2
done
echo "The container restarted, but the free-mode API did not answer yet." >&2
echo "Check: docker logs $CONTAINER | grep -i modules" >&2
exit 1
