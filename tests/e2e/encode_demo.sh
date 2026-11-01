#!/usr/bin/env bash
# Encode the recorded tour (tests/e2e/video/*.webm + meta.json from record_demo_tour.js) into the landing page video.
#   bash tests/e2e/encode_demo.sh [speed]      default speed 1.25
set -euo pipefail
cd "$(dirname "$0")/video"
F=$(python3 -c "import json;print(json.load(open('meta.json'))['file'])")
S=$(python3 -c "import json;print(json.load(open('meta.json'))['start'])")
E=$(python3 -c "import json;print(json.load(open('meta.json'))['end'])")
SP="${1:-1.25}"
OUT=../../../prototype/media
VF="setpts=PTS/${SP},fps=30,scale=1280:720"
ffmpeg -y -v error -ss "$S" -to "$E" -i "$F" -vf "$VF" -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart "$OUT/demo.mp4"
ffmpeg -y -v error -ss "$S" -to "$E" -i "$F" -vf "$VF" -an -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 "$OUT/demo.webm"
ffmpeg -y -v error -ss 2.2 -i "$OUT/demo.mp4" -frames:v 1 -q:v 3 "$OUT/demo-poster.jpg"
ls -la "$OUT"
