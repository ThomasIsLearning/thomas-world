#!/usr/bin/env bash
# thomas-world status|logs|restart|update|stop
set -euo pipefail
REPO_DIR="${THOMAS_WORLD_DIR:-${HOME}/thomas-world}"
cd "${REPO_DIR}"
DOCKER="docker"; docker ps >/dev/null 2>&1 || DOCKER="sudo docker"
compose() { env UID="$(id -u)" GID="$(id -g)" ${DOCKER} compose "$@"; }
case "${1:-status}" in
  status)  compose ps; compose logs --tail 15 ;;
  logs)    compose logs -f --tail 100 ;;
  restart) compose restart ;;
  stop)    compose down ;;
  update)  git pull --ff-only; compose down -v; compose up -d --build; echo "updated: $(git log --oneline -1)" ;;
  *) echo "usage: thomas-world status|logs|restart|update|stop" >&2; exit 1 ;;
esac
