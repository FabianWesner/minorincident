Z-S2 implements gorilla corpse/prop throw and elephant stampede/trunk swipe (E07-AC05/14/19 subset).
Reuses the shared scheduler, Alpha projectile/charge paths, E26 slots, E09 bodies and pooled bars; L4/L7 files are untouched.
Validation passes: typecheck, lint, build; full unit 842/0; focused AI 236/0; E07 verify 264 functional + 5 timing + 69 browser/0.
Reviewed desktop/phone, +Z, barrier and real-bench captures: readable cues, matching facing/velocity, retained bodies/props; inherited elephant foot slide is documented.
E18 mixed 200/100: sim p95 2.18/0.79 ms; Metal frame p95 6.6/3.8 ms; isolation 26 draws and 324,532/184,904 triangles; CDP heap 195/117 MB.
Evidence: [visual-review.md](visual-review.md), [validation.json](validation.json), [scene-proof.json](scene-proof.json); only the reviewed capture set is retained; no deployment or merge.
