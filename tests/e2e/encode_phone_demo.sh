#!/usr/bin/env bash
# Encode the recorded phone tour (tests/e2e/video-phone/*.webm + meta.json from record_phone_tour.js) into the landing page phone card video.
#   bash tests/e2e/encode_phone_demo.sh [speed]      default speed 1.15
set -euo pipefail
cd "$(dirname "$0")/video-phone"
F=$(python3 -c "import json;print(json.load(open('meta.json'))['file'])")
S=$(python3 -c "import json;print(json.load(open('meta.json'))['start'])")
E=$(python3 -c "import json;print(json.load(open('meta.json'))['end'])")
SP="${1:-1.15}"
OUT=../../../prototype/media
VF="setpts=PTS/${SP},fps=30,scale=390:844"
ffmpeg -y -v error -ss "$S" -to "$E" -i "$F" -vf "$VF" -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart "$OUT/demo-phone.mp4"
ffmpeg -y -v error -ss "$S" -to "$E" -i "$F" -vf "$VF" -an -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -deadline good -cpu-used 4 "$OUT/demo-phone.webm"
ffmpeg -y -v error -ss 1.5 -i "$OUT/demo-phone.mp4" -frames:v 1 -q:v 3 "$OUT/demo-phone-poster.jpg"
ls -la "$OUT"
