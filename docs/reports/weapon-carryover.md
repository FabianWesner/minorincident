# Weapon carryover — PO Q-158

- Selected action persists through L1→L10 and menu Continue; rack index, side and HUD agree. Missing weapons fall back by keys 9→1 with a reason logged; L9 scripted loss retains the axe.
- Optional validated save field preserves old saves; ammo/charges retain campaign rules. Applied-campaign guards prevent outgoing-world capture during Continue/New Game.
- [Red-first evidence](weapon-carryover/red-baseline.txt): 22 baseline failures plus settings, new-campaign and resume-payload regressions. Final progression suite: 78 passed, covering all nine boundaries, fallback and Continue.
- [Physical-input audit](weapon-carryover/real-input-audit.json): L3 finished holding key-4 handgun; L4 handover and normal Continue retain it through disembarkation with matching HUD. [Handover](weapon-carryover/L4-handgun-handover.jpg) / [Continue](weapon-carryover/L4-handgun-continue.jpg).
- Green: [remote](weapon-carryover/remote-green.txt) 2,531 passed / 9 existing skips; [E13](weapon-carryover/E13-summary.json) typecheck, lint, build, 54 simulation + 40 browser checks / 1 existing skip; [smoke](weapon-carryover/smoke-browser-summary.json) 6 simulation + 31 browser checks. All ran on source commit 08e67ba4f.
- Existing validation repairs: novice L4 bot moves while firing during escape (4 deaths→0); yard-gate fixture approaches perpendicular to its hinge; assertions preserved. No specs/protected references changed, no deploy/merge. Waiting for the 58-minute remote run exceeded the two-hour window.
