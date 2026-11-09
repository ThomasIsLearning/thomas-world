#!/usr/bin/env bash
# Install Thomas' World (God's Eye View) on the Pi 5 as a Docker service.
#   cd ~/thomas-world && ./thomas-world/install.sh
# Re-running is safe: it rebuilds and restarts.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ME="$(id -un)"
if [ "$(id -u)" -eq 0 ]; then echo "Run as your normal user, not with sudo." >&2; exit 1; fi

echo "1/5 docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
fi
if ! id -nG "${ME}" | grep -qw docker; then
  sudo usermod -aG docker "${ME}"
  echo "   added ${ME} to the docker group (takes effect at next login; this run uses sudo)"
fi
DOCKER="docker"; docker ps >/dev/null 2>&1 || DOCKER="sudo docker"

echo "2/5 keys file"
touch "${REPO_DIR}/.env"; chmod 600 "${REPO_DIR}/.env"
grep -q '^GEV_KEY_SETUP_TRUSTED_PEERS=' "${REPO_DIR}/.env" || echo 'GEV_KEY_SETUP_TRUSTED_PEERS=none' >> "${REPO_DIR}/.env"

echo "3/5 build + start (first build takes a while on a Pi)"
cd "${REPO_DIR}"
env UID="$(id -u)" GID="$(id -g)" ${DOCKER} compose up -d --build

echo "4/5 control command + boot service"
sudo install -m 755 "${REPO_DIR}/thomas-world/thomas-world.sh" /usr/local/bin/thomas-world
sed "s|%REPO%|${REPO_DIR}|g; s|%USER%|${ME}|g" "${REPO_DIR}/thomas-world/thomas-world.service" | sudo tee /etc/systemd/system/thomas-world.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable thomas-world.service >/dev/null

echo "5/5 waiting for the app"
for _ in $(seq 1 60); do
  if curl -fsS -m 2 -o /dev/null http://127.0.0.1:4173/; then echo "Thomas' World is up: http://127.0.0.1:4173/"; exit 0; fi
  sleep 2
done
echo "Not answering yet; check with: thomas-world logs" >&2
