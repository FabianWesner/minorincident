# E20 fresh visual review — 2026-10-10

Source: headless Metal Chromium, current main 4970fa9e, seed 1 real-input route. This is a Codex visual inspection, not an Opus review. Lighting checks belong to E25. Audited frames are preserved under `audit-reviewed/` with SHA-256 hashes in `manifest.json`.

| Frame | Checklist / result | Score | Finding |
| --- | --- | --- | --- |
| l2-station-calm.png | A: organized help, intact station, distinct firefighters and truck | 8/10 | PASS |
| l2-doors-open.png + l2-doors-open-5s.png | A/E: trapped people become a dense fleeing crowd; infected arrive from doors | 7/10 | PASS; crowd silhouettes overlap (P2) |
| l2-collapse.png | A/D/E: bodies, fleeing people and firefighters communicate a failed rescue; foreground courier recognizable | 7/10 | PASS |
| l2-streets-w1.png | A: wounded street, emergency truck, blood, intact facades | 7/10 | PASS scene; D fails for capture: courier behind truck, not identifiable in one second (P1 framing) |
| l2-bridge-checkpoint.png | A/E: visible officers, vehicles, barrier and civilians convey organized control | 8/10 | PASS; people pile at fence (P2) |
| All frames | G: harder, higher light than L1; shadow-length comparison | Deferred | E25 owns lighting and corresponding AC16/AC19 portion |

Verdict: PARTIAL. Scene beats meet seven; the streets capture's player readability prevents the whole checklist D from passing. Capturing the arrival frame before leaving the truck is not evidence that the courier is readable during street play. No scene/lighting code changed in this lane.
