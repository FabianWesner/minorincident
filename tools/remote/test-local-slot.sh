#!/bin/sh
# Kept as the shell entry point for focused scheduler verification.
D=$(cd "$(dirname "$0")" && pwd)
exec python3 -I "$D/check.py" "$@"
