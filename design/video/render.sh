#!/usr/bin/env bash
# Renders one home page video set into out/: desktop and phone, each as MP4 (H.264) and WebM (VP9),
# plus a JPG poster for each. See README.md for what every setting does and how long it takes.
#
# Usage:   ./render.sh <DesktopCompositionId> <PhoneCompositionId> <name> [posterFrame]
# Example: ./render.sh Test TestPhone test 75
#   -> out/test.mp4  out/test.webm  out/test-poster.jpg
#      out/test-phone.mp4  out/test-phone.webm  out/test-phone-poster.jpg
# Override the quality with H264_CRF=.. VP9_CRF=.. (defaults 18 and 32, lower = sharper and bigger).
# The phone files (2x, about 1.6 times the pixels) can take their own: PHONE_H264_CRF=.. PHONE_VP9_CRF=..
# (default: the same as desktop).
set -euo pipefail
cd "$(dirname "$0")"

DESKTOP=${1:?desktop composition id, e.g. Test}
PHONE=${2:?phone composition id, e.g. TestPhone}
NAME=${3:?output name, e.g. test}
POSTER_FRAME=${4:-0}
H264_CRF=${H264_CRF:-18}
VP9_CRF=${VP9_CRF:-32}
PHONE_H264_CRF=${PHONE_H264_CRF:-$H264_CRF}
PHONE_VP9_CRF=${PHONE_VP9_CRF:-$VP9_CRF}

# The browser is picked in remotion.config.ts (Playwright's headless shell in the Claude sandbox).
mkdir -p out
run() { echo "== npx remotion $*"; npx remotion "$@" --log=error; }

# Desktop: 1280x800, scale 1.
run render "$DESKTOP" "out/$NAME.mp4" --codec=h264 --crf="$H264_CRF" --muted
run render "$DESKTOP" "out/$NAME.webm" --codec=vp9 --crf="$VP9_CRF" --muted
run still "$DESKTOP" "out/$NAME-poster.jpg" --frame="$POSTER_FRAME" --jpeg-quality=90
# Phone: designed at 390x640, drawn at 2x so the files are 780x1280.
run render "$PHONE" "out/$NAME-phone.mp4" --codec=h264 --crf="$PHONE_H264_CRF" --scale=2 --muted
run render "$PHONE" "out/$NAME-phone.webm" --codec=vp9 --crf="$PHONE_VP9_CRF" --scale=2 --muted
run still "$PHONE" "out/$NAME-phone-poster.jpg" --frame="$POSTER_FRAME" --scale=2 --jpeg-quality=90

if command -v ffprobe >/dev/null; then
  for f in "out/$NAME.mp4" "out/$NAME.webm" "out/$NAME-poster.jpg" "out/$NAME-phone.mp4" "out/$NAME-phone.webm" "out/$NAME-phone-poster.jpg"; do
    info=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt -show_entries format=duration -of csv=p=0 "$f" | tr ',\n' '  ')
    printf '%-34s %9s bytes  %s\n' "$f" "$(stat -c %s "$f")" "$info"
  done
fi
