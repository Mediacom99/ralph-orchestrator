#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/ralph-orchestrator"
SERVICE_USER="ralph"
BINARY_PATH=""
RALPH_CC_REPO="https://github.com/frankbria/ralph-claude-code.git"

usage() {
  echo "Usage: $0 [--binary <path>]"
  echo ""
  echo "Install Ralph Orchestrator as a systemd service."
  echo ""
  echo "Options:"
  echo "  --binary <path>  Path to pre-built orchestrator binary"
  echo "                   (if omitted, downloads latest release)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --binary) BINARY_PATH="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

# --- Prerequisites ---
echo "==> Checking prerequisites..."

for cmd in git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd is required but not installed."
    exit 1
  fi
done

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "ERROR: Node.js 20+ required (found $(node -v))"
  exit 1
fi

echo "  git: $(git --version)"
echo "  node: $(node -v)"
echo "  npm: $(npm -v)"

# --- Create system user ---
echo "==> Creating system user '$SERVICE_USER'..."
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --create-home --shell /bin/bash "$SERVICE_USER"
  echo "  Created user '$SERVICE_USER'"
else
  echo "  User '$SERVICE_USER' already exists"
fi

# --- Install directory ---
echo "==> Setting up $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/data"

# --- Install binary ---
if [[ -n "$BINARY_PATH" ]]; then
  echo "==> Installing binary from $BINARY_PATH..."
  cp "$BINARY_PATH" "$INSTALL_DIR/orchestrator"
else
  echo "==> Downloading latest release..."
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "ERROR: Unsupported architecture: $ARCH"; exit 1 ;;
  esac
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  DOWNLOAD_URL=$(curl -s https://api.github.com/repos/mediacom99/ralph-orchestrator/releases/latest \
    | grep "browser_download_url.*${OS}.*${ARCH}" \
    | cut -d '"' -f 4 | head -1)
  if [[ -z "$DOWNLOAD_URL" ]]; then
    echo "ERROR: Could not find release for ${OS}/${ARCH}"
    echo "Use --binary <path> to provide a pre-built binary instead."
    exit 1
  fi
  curl -sL "$DOWNLOAD_URL" -o "$INSTALL_DIR/orchestrator"
fi
chmod +x "$INSTALL_DIR/orchestrator"

# --- Install claude-code ---
echo "==> Installing @anthropic-ai/claude-code..."
npm install -g @anthropic-ai/claude-code

# --- Install ralph-claude-code ---
echo "==> Installing ralph-claude-code..."
RALPH_CC_DIR="$INSTALL_DIR/ralph-claude-code"
if [[ -d "$RALPH_CC_DIR" ]]; then
  echo "  Updating existing installation..."
  sudo -u "$SERVICE_USER" git -C "$RALPH_CC_DIR" pull --ff-only
else
  sudo -u "$SERVICE_USER" git clone "$RALPH_CC_REPO" "$RALPH_CC_DIR"
fi
if [[ -f "$RALPH_CC_DIR/install.sh" ]]; then
  sudo -u "$SERVICE_USER" bash "$RALPH_CC_DIR/install.sh"
fi

# --- Environment file ---
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [[ -f "$SCRIPT_DIR/.env.example" ]]; then
    cp "$SCRIPT_DIR/.env.example" "$INSTALL_DIR/.env"
  else
    touch "$INSTALL_DIR/.env"
  fi
  echo "  Created $INSTALL_DIR/.env (edit as needed)"
fi

# --- Permissions ---
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# --- systemd unit ---
echo "==> Installing systemd service..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/ralph-orchestrator.service" /etc/systemd/system/ralph-orchestrator.service
systemctl daemon-reload

echo ""
echo "============================================"
echo "  Installation complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Authenticate Claude (as the ralph user):"
echo "     sudo -u $SERVICE_USER claude login"
echo ""
echo "  2. (Optional) Edit $INSTALL_DIR/.env"
echo ""
echo "  3. Start the service:"
echo "     systemctl enable --now ralph-orchestrator"
echo ""
echo "  4. Check status:"
echo "     systemctl status ralph-orchestrator"
echo "     journalctl -u ralph-orchestrator -f"
echo ""
