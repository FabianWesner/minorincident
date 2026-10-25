#!/bin/sh
# Zero-manual cast/<id> to compressed, validated production LODs and manifest registration.
set -eu
cd "$(dirname "$0")/../.."
exec node --import tsx tools/assets/skin-crowd-build.ts "${1:?Usage: skin-crowd-build.sh <cast/id>}"
