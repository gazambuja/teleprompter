#!/usr/bin/env bash
# One-time install of the Teleprompter landing on this server. Run with sudo.
# Only touches: /var/www/teleprompter and /etc/nginx/sites-{available,enabled}/teleprompter.sandboxlabs.uk.conf
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NAME=teleprompter.sandboxlabs.uk.conf
WEBROOT=/var/www/teleprompter
OWNER="${SUDO_USER:-gustavo}"

[ "$(id -u)" -eq 0 ] || { echo "run with sudo"; exit 1; }
[ -e /etc/nginx/sites-available/$NAME ] && { echo "/etc/nginx/sites-available/$NAME already exists — aborting"; exit 1; }

mkdir -p "$WEBROOT"
cp -r "$HERE/site/." "$WEBROOT/"
chown -R "$OWNER":www-data "$WEBROOT"   # so future deploys (rsync) need no sudo
chmod -R u=rwX,g=rX,o=rX "$WEBROOT"

cp "$HERE/$NAME" /etc/nginx/sites-available/$NAME
ln -s /etc/nginx/sites-available/$NAME /etc/nginx/sites-enabled/$NAME

if nginx -t; then
  systemctl reload nginx
  echo "OK — site live on http://teleprompter.sandboxlabs.uk (once DNS resolves)."
  echo "Next: sudo certbot --nginx -d teleprompter.sandboxlabs.uk"
else
  echo "nginx -t failed — rolling back"
  rm -f /etc/nginx/sites-enabled/$NAME /etc/nginx/sites-available/$NAME
  exit 1
fi
