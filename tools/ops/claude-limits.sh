#!/bin/sh
# Claude plan limits as Claude Code itself reports them (headless /usage): session, week, Fable.
cd "${TMPDIR:-/tmp}" && claude -p "/usage" 2>&1 | grep -E "^Current (session|week)"
