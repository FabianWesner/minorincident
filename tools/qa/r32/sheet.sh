#!/bin/sh
# r32-animalmoves: dense contact sheet from a Scene Lab video (the in-run --sheet closes the pooled context).
#   sh tools/qa/r32/sheet.sh <video.webm> <out.jpg> <start s> <seconds> <fps> [cols=6] [width=320]
set -eu
video=$1; out=$2; start=$3; dur=$4; fps=$5; cols=${6:-6}; width=${7:-320}
frames=$(awk "BEGIN { print int($dur * $fps + .5) }")
rows=$(( (frames + cols - 1) / cols ))
ffmpeg -v error -y -ss "$start" -t "$dur" -i "$video" -vf "fps=$fps,scale=$width:-1,tile=${cols}x${rows}" -frames:v 1 -q:v 4 "$out"
