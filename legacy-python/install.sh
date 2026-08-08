#!/usr/bin/env bash
# Installs break-reminder as a systemd user service so it starts with your session.
# Usage: ./install.sh [work_minutes] [break_minutes] [corner]
set -euo pipefail

WORK="${1:-60}"
BREAK="${2:-5}"
POSITION="${3:-top-right}"

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/break_reminder.py"
BIN="$HOME/.local/bin/break-reminder"
UNIT="$HOME/.config/systemd/user/break-reminder.service"

mkdir -p "$(dirname "$BIN")" "$(dirname "$UNIT")"
install -m 755 "$SRC" "$BIN"

cat > "$UNIT" <<EOF
[Unit]
Description=Minimal work/break reminder
PartOf=graphical-session.target
After=graphical-session.target

[Service]
Type=simple
Environment=GDK_BACKEND=x11
ExecStart=$BIN --work $WORK --break $BREAK --position $POSITION
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical-session.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now break-reminder.service

echo
echo "Installed: $BIN"
echo "Service:   $UNIT"
echo "Schedule:  ${WORK} min work -> ${BREAK} min break, card in ${POSITION}"
echo
systemctl --user --no-pager --lines=0 status break-reminder.service || true
