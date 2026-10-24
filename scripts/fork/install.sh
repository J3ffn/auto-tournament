#!/usr/bin/env bash
# Fork (free skin mode): install this CS2 module into a running Auto Tournament
# container, keeping a backup of the module it replaces.
#
#   bash install.sh [container]           install (default container: auto-tournament)
#   bash install.sh [container] --undo    put the official module back
#   bash install.sh [container] --force   install even if the image tag differs
#
# Run it on the machine that runs the container, from the folder this file is in
# (next to the cs2/ folder). The platform must be the version the module was
# built for (see VERSION); pin that image tag in docker-compose.yml.
#
# Each official module it replaces is kept in module-backups/cs2-<version>, so
# --undo puts back the one made for the image that is running.
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

# The platform version: the image tag (sivertio/auto-tournament:3.0.0-beta.216).
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
TAG="${IMAGE##*:}"
[ "$TAG" = "$IMAGE" ] && TAG=""

# A module's version in the container (empty if there is none).
module_version() {
  docker exec "$CONTAINER" sh -c "sed -n 's/.*\"version\": *\"\\([^\"]*\\)\".*/\\1/p' $1/module.json 2>/dev/null | head -1"
}

if [ "$MODE" = "--undo" ]; then
  FROM=""
  if [ -n "$TAG" ] && docker exec "$CONTAINER" test -d "$BACKUPS/cs2-$TAG"; then
    FROM="$BACKUPS/cs2-$TAG"
  elif docker exec "$CONTAINER" test -d "$BACKUPS/cs2" && [ "$(module_version "$BACKUPS/cs2")" = "$TAG" ]; then
    FROM="$BACKUPS/cs2"
  fi
  if [ -z "$FROM" ]; then
    echo "No backup of the official CS2 module for ${TAG:-this image}." >&2
    echo "Backups kept: $(docker exec "$CONTAINER" sh -c "ls $BACKUPS 2>/dev/null | tr '\n' ' '")" >&2
    echo "Pin the image to a version that has one, or reinstall CS2 from Manage > Modules." >&2
    exit 1
  fi
  docker exec "$CONTAINER" sh -c "rm -rf $MODULES/cs2 && cp -a $FROM $MODULES/cs2"
  echo "The official CS2 module ($(module_version "$MODULES/cs2")) is back. Restarting $CONTAINER..."
  docker restart "$CONTAINER" >/dev/null
  echo "Done."
  exit 0
fi

if [ ! -f "$HERE/cs2/module.json" ]; then
  echo "No cs2/module.json next to this script." >&2
  exit 1
fi
VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HERE/cs2/module.json" | head -1)"
BASE="${VERSION%%.free.*}"

if [ "$TAG" != "$BASE" ] && [ "$MODE" != "--force" ]; then
  echo "This module ($VERSION) is for Auto Tournament $BASE, but $CONTAINER runs '${TAG:-$IMAGE}'." >&2
  echo "Pin the image in your docker-compose.yml first:" >&2
  echo "    image: sivertio/auto-tournament:$BASE" >&2
  echo "then run: docker compose pull && docker compose up -d   (from that folder), and this again." >&2
  echo "(--force installs anyway.)" >&2
  exit 1
fi

if ! docker exec "$CONTAINER" test -f "$MODULES/cs2/module.json"; then
  echo "CS2 is not installed in $CONTAINER ($MODULES/cs2)." >&2
  echo "Install Counter-Strike 2 on the site first (Manage > Modules), then run this again." >&2
  echo "If CS2 was installed before, check that the container uses your original data volume:" >&2
  echo "run docker compose from the folder of your original docker-compose.yml." >&2
  exit 1
fi
CURRENT="$(module_version "$MODULES/cs2")"
echo "Platform:             ${TAG:-$IMAGE}"
echo "Installed CS2 module: $CURRENT"
echo "This one:             $VERSION"

# Keep each official module it replaces, by version (a fork module is not kept).
case "$CURRENT" in
  *.free.*)
    if ! docker exec "$CONTAINER" test -d "$BACKUPS/cs2-$BASE"; then
      echo "Note: no backup of the official CS2 $BASE module, so --undo will not be able to go back."
      echo "(LEIA-ME.md, 'Atualizar a plataforma', shows how to get one.)"
    fi
    ;;
  *)
    docker exec "$CONTAINER" sh -c "mkdir -p $BACKUPS && rm -rf $BACKUPS/cs2-$CURRENT && cp -a $MODULES/cs2 $BACKUPS/cs2-$CURRENT"
    echo "Backed up the official module to $BACKUPS/cs2-$CURRENT."
    ;;
esac

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
