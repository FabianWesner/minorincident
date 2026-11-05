#!/bin/sh
# An opaque entry gives each eight-minute L10 slice its own functional browser
# reservation. e2e-lock still enforces the machine-wide capacity and 600s cap.
exec "$1" --import tsx/esm tools/qa/accept/browser-worker.ts "$2"
