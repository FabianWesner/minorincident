#!/bin/sh
# Before/after crops of a qa-long-gun scene: sh tools/scenelab/long-gun-compare.sh <before-dir> <after-dir> <out.jpg> [frames...]
# Close frames (orbit cameras) are cropped around the figure; game-camera frames are cropped tighter.
before=$1; after=$2; out=$3; shift 3
tmp=$(mktemp -d)
for f in "$@"; do
  case $f in
    0060|0070|0130|0140|0236|0250) crop=300x380+490+20 ;;
    *) crop=720x620+280+60 ;;
  esac
  magick "$before/shot-$f.png" -crop $crop +repage -resize 360x "$tmp/b$f.png"
  magick "$after/shot-$f.png" -crop $crop +repage -resize 360x "$tmp/a$f.png"
done
cd "$tmp"
magick b*.png +append top.png
magick a*.png +append bottom.png
magick top.png bottom.png -append "$out"
rm -rf "$tmp"
