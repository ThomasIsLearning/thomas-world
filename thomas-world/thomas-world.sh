#!/usr/bin/env bash
# thomas-world status|logs|restart|update|stop|traffic [fix]
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
  traffic)
    # Why is Street Traffic "unavailable"? Checks the key file, the running app,
    # and TomTom itself, without printing the key. `traffic fix` strips the
    # invisible thin spaces / CRs that phone terminals paste into .env.
    ENV_FILE="${REPO_DIR}/.env"
    if [ ! -f "${ENV_FILE}" ]; then echo "no .env yet: echo TOMTOM_API_KEY=yourkey >> ${ENV_FILE}"; exit 1; fi
    bad=$(grep -c $'\xe2\x80\x89\|\r\|\xc2\xa0' "${ENV_FILE}" || true)
    if [ "${2:-}" = "fix" ]; then
      sed -i $'s/\xe2\x80\x89//g; s/\xc2\xa0//g; s/\r$//' "${ENV_FILE}"
      echo "cleaned ${bad} line(s) with hidden characters; restarting"
      compose restart >/dev/null; sleep 8
      bad=0
    fi
    [ "${bad}" = "0" ] || echo "WARNING: ${bad} line(s) in .env contain hidden characters (thin space / CR). Run: bash ~/thomas-world/thomas-world.sh traffic fix"
    key=$(grep -E '^TOMTOM_API_KEY=' "${ENV_FILE}" | tail -1 | cut -d= -f2- | tr -d '[:space:]')
    if [ -z "${key}" ]; then echo "TOMTOM_API_KEY is empty in .env"; exit 1; fi
    echo "key: ${#key} characters, starts ${key:0:3}..."
    echo "app:  $(curl -s -m 5 http://127.0.0.1:4173/api/tomtom/status || echo 'not answering on 4173')"
    code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "https://api.tomtom.com/traffic/map/4/tile/flow/relative/12/1239/1513.pbf?key=${key}")
    case "${code}" in
      200) echo "tomtom: 200 OK, the key works. If the panel still says unavailable, run: bash ~/thomas-world/thomas-world.sh restart" ;;
      403) echo "tomtom: 403 forbidden. The key is wrong, not yet active (new keys take a few minutes), or Traffic API is not enabled on it at https://my.tomtom.com/keys" ;;
      429) echo "tomtom: 429 rate limited. Free allowance used for now" ;;
      000) echo "tomtom: no answer. The Pi cannot reach api.tomtom.com (DNS / internet)" ;;
      *)   echo "tomtom: HTTP ${code}" ;;
    esac
    echo "--- last proxy log lines"
    compose logs --no-color --tail 300 2>/dev/null | grep -i 'tomtom' | tail -5 || true
    ;;
  *) echo "usage: thomas-world status|logs|restart|update|stop|traffic [fix]" >&2; exit 1 ;;
esac
