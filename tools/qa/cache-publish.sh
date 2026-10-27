#!/bin/sh
# Publish a copied build-cache directory only after its required entry exists.
set -eu
source=$1
cache=$2
parent=$(dirname "$cache")
name=$(basename "$cache")
stage="$parent/.${name}.tmp.$$"
trap 'rm -rf "$stage"' EXIT HUP INT TERM
rm -rf "$stage"
if ! cp -cR "$source" "$stage" 2>/dev/null; then
  rm -rf "$stage"
  cp -R "$source" "$stage"
fi
if [ ! -f "$stage/index.html" ]; then echo 'Build cache source has no index.html' >&2; exit 1; fi
: > "$stage/.complete"
rm -rf "$cache"
mv "$stage" "$cache"
trap - EXIT HUP INT TERM
