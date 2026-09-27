#!/bin/bash
set -e
cd "$(dirname "$0")/.."
rm -f screenshot-*.png
timeout 180 xvfb-run -a -s "-screen 0 1400x900x24" npx electron ./scripts/screenshot.cjs --no-sandbox 2>&1 | tail -25
echo DONE
ls -la screenshot-*.png 2>&1 | head
