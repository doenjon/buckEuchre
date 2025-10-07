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
#   ./lightsail-setup.sh -r <repo-url> [-b main] [-u buckeuchre] [-d /opt/buck-euchre]
#
# The repository arguments are optional; if omitted the script just prepares
# the host. Secrets (.env.production) still need to be updated manually.

set -euo pipefail

APP_USER="buckeuchre"
BRANCH="main"
REPO_URL=""
DEST_DIR=""

usage() {
  cat <<'EOF'
Usage: lightsail-setup.sh [options]

Options:
  -r <url>    Git repository URL to clone (optional)
  -b <name>   Branch or tag to checkout (default: main)
  -u <user>   System user that will own the app (default: buckeuchre)
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

  if [[ -f "${app_dir}/.env.production.example" && ! -f "${app_dir}/.env.production" ]]; then
    log "Creating ${app_dir}/.env.production (fill in secrets manually)."
    sudo -u "${APP_USER}" cp "${app_dir}/.env.production.example" "${app_dir}/.env.production"
  fi
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

