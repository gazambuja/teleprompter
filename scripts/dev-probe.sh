#!/usr/bin/env bash
# Dev instance with CDP on :9333 and a fake mic that plays $WAV (default: scripts/fixtures/speech-es.wav).
# HEADLESS=1 runs it on a virtual X display so the window doesn't pop up on the desktop.
cd "$(dirname "$0")/.."
WAV="${WAV:-$PWD/scripts/fixtures/speech-es.wav}"
CMD=(npx electron-vite dev --remoteDebuggingPort 9333 --
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream
  "--use-file-for-fake-audio-capture=$WAV")
if [ -n "$HEADLESS" ]; then
  exec env -u WAYLAND_DISPLAY NO_SANDBOX=1 xvfb-run -a -s "-screen 0 1280x1100x24" "${CMD[@]}" --ozone-platform=x11
fi
exec env NO_SANDBOX=1 "${CMD[@]}"
