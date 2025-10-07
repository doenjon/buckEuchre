#!/usr/bin/env bash

# Buck Euchre Lightsail Bootstrap Script
# --------------------------------------
# Automates provisioning of an Ubuntu 24 Lightsail instance for the
# Buck Euchre production stack. The script:
#   * Installs Docker Engine + Compose plugin
#   * Configures a basic UFW firewall (22/80/443)
#   * Creates an application user with Docker permissions
#   * Optionally clones the application repository
#
# Usage (run as root):
#   ./lightsail-setup.sh -r <repo-url> [-b main] [-u ubuntu] [-d /opt/buck-euchre]
#
# The repository arguments are optional; if omitted the script just prepares
# the host. When a repo is cloned the script will create .env.production with
# freshly generated credentials.

set -euo pipefail

APP_USER="ubuntu"
BRANCH="main"
REPO_URL=""
DEST_DIR=""

usage() {
  cat <<'EOF'
Usage: lightsail-setup.sh [options]

Options:
  -r <url>    Git repository URL to clone (optional)
  -b <name>   Branch or tag to checkout (default: main)
  -u <user>   System user that will own the app (default: ubuntu)
  -d <path>   Destination directory for the repo (default: /home/<user>/buck-euchre)
  -h          Show this help
EOF
}

while getopts "r:b:u:d:h" opt; do
  case "${opt}" in
    r) REPO_URL="${OPTARG}" ;;
    b) BRANCH="${OPTARG}" ;;
    u) APP_USER="${OPTARG}" ;;
    d) DEST_DIR="${OPTARG}" ;;
    h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

ensure_packages() {
  log "Updating APT cache and installing base packages..."
  apt-get update -y
  apt-get install -y ca-certificates curl git gnupg lsb-release ufw
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed; skipping."
    return
  fi

  log "Installing Docker Engine and Compose plugin..."

  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    log "UFW not installed; skipping firewall configuration."
    return
  fi

  log "Configuring UFW firewall rules (22, 80, 443)..."
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null

  if ! ufw status | grep -q "Status: active"; then
    ufw --force enable
  fi
}

ensure_user() {
  if id -u "${APP_USER}" >/dev/null 2>&1; then
    log "User ${APP_USER} already exists."
  else
    log "Creating application user ${APP_USER}..."
    useradd -m -s /bin/bash "${APP_USER}"
  fi

  usermod -aG docker "${APP_USER}"
}

clone_repo() {
  [[ -z "${REPO_URL}" ]] && return

  local app_dir
  if [[ -n "${DEST_DIR}" ]]; then
    app_dir="${DEST_DIR}"
  else
    app_dir="/home/${APP_USER}/buck-euchre"
  fi

  mkdir -p "${app_dir}"
  chown -R "${APP_USER}:${APP_USER}" "${app_dir}"

  if [[ -d "${app_dir}/.git" ]]; then
    log "Repository already present at ${app_dir}; pulling latest ${BRANCH}..."
    sudo -u "${APP_USER}" git -C "${app_dir}" fetch --all --tags
    sudo -u "${APP_USER}" git -C "${app_dir}" checkout "${BRANCH}"
    sudo -u "${APP_USER}" git -C "${app_dir}" pull --ff-only origin "${BRANCH}"
  else
    log "Cloning ${REPO_URL} into ${app_dir}..."
    sudo -u "${APP_USER}" git clone --branch "${BRANCH}" "${REPO_URL}" "${app_dir}"
  fi

  if [[ -f "${app_dir}/.env.production" ]]; then
    log "${app_dir}/.env.production already exists; leaving as-is."
    return
  fi

  if [[ ! -f "${app_dir}/.env.production.example" ]]; then
    log "Warning: ${app_dir}/.env.production.example not found. Skipping env generation." >&2
    return
  fi

  log "Generating ${app_dir}/.env.production with random credentials..."

  local postgres_password jwt_secret
  postgres_password="$(python3 - <<'PY'
import secrets
import string
alphabet = string.ascii_letters + string.digits + '-_'
print(''.join(secrets.choice(alphabet) for _ in range(48)))
PY
)"

  jwt_secret="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"

  local env_file
  env_file="${app_dir}/.env.production"

  sudo -u "${APP_USER}" tee "${env_file}" >/dev/null <<EOF
POSTGRES_DB=buckeuchre
POSTGRES_USER=buckeuchre
POSTGRES_PASSWORD=${postgres_password}

JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=24h

DATABASE_URL=postgresql://buckeuchre:${postgres_password}@postgres:5432/buckeuchre?sslmode=prefer

CORS_ORIGIN=https://yourdomain.com

LOG_LEVEL=info
WS_HEARTBEAT_INTERVAL=30000
WS_GRACE_PERIOD=30000

HTTP_PORT=80
HTTPS_PORT=443
EOF

  chown "${APP_USER}:${APP_USER}" "${env_file}"
  chmod 600 "${env_file}"

  local dot_env="${app_dir}/.env"
  if [[ ! -e "${dot_env}" ]]; then
    sudo -u "${APP_USER}" cp "${env_file}" "${dot_env}"
    chown "${APP_USER}:${APP_USER}" "${dot_env}"
    chmod 600 "${dot_env}"
    log "Created ${dot_env} for docker compose environment."
  else
    log "${dot_env} already exists; leaving as-is."
  fi

  log "Created ${env_file}. Update CORS_ORIGIN and review settings before launch."
}

post_install_summary() {
  cat <<EOF

============================================================
Lightsail setup complete.

- User '${APP_USER}' added to the docker group.
- Docker Engine and Compose plugin installed.
- Firewall allows SSH, HTTP, and HTTPS.
EOF

  if [[ -n "${REPO_URL}" ]]; then
    local app_dir
    if [[ -n "${DEST_DIR}" ]]; then
      app_dir="${DEST_DIR}"
    else
      app_dir="/home/${APP_USER}/buck-euchre"
    fi

    cat <<EOF
- Repository cloned into: ${app_dir}
- Update ${app_dir}/.env.production with production secrets.
- Switch to the app user and run ./production-start.sh when ready:
    sudo su - ${APP_USER}
    cd ${app_dir}
    ./production-start.sh
EOF
  else
    cat <<'EOF'
- Clone the repository and configure .env.production before starting services.
EOF
  fi

  cat <<'EOF'

Remember to reopen your shell (or run `newgrp docker`) so the docker group
membership is applied to existing sessions.
============================================================
EOF
}

ensure_packages
install_docker
configure_firewall
ensure_user
clone_repo
post_install_summary
