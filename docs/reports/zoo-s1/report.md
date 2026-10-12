Z-S1 implements lion pounce/pin and flank plus gorilla chest-beat roar and ground pound (E07-AC05/19 subset).
The existing scheduler, charge sweep, radial damage, roar convergence, pin/rescue and pooled health bars supply the behavior; no L4 files changed.
Checks pass: typecheck, lint, build; full unit 828/0 failures; focused AI 77/0; E07 verify 236 functional + 5 timing + 64 browser checks/0.
Reviewed all four desktop/phone scenes: readable markers and bars, matching facing/velocity, no invisible actors or prop clipping; inherited lion paw sink is 1.2 cm.
E18: mixed 200/100 sim p95 1.28/0.54 ms; render 26/26 draws and 326,146/185,309 triangles, with 200/100 actors drawn.
Retained before/after screenshots, boundary/cooldown/restore tests and visual observations: [visual-review.md](visual-review.md); results: [validation.json](validation.json).
