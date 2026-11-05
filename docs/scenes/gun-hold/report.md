1. Gun-hold changes committed on lane/gun-hold; no merge or deployment. Acceptance remains incomplete.
2. Only the selected weapon is visible; keys, wheel, pickup, initial loadout, checkpoint restore and timer reload are covered.
3. Fixed palm grip, low carry, aim/turn/recovery blending and arm recoil; muzzle flash/tracer remains at the barrel end.
4. Reviewed 92 Scene Lab sheets: both L1–L6 courier rigs, nine gun IDs, bat/fists, game/close cameras and maximum handgun/MG gear; see [frame review](review.md).
5. Zero gun/body/ground hits and grip/visibility violations in every capture; body tolerances unchanged, ground check added with zero slack.
6. Typecheck, lint and build pass; remote unit 500/500; headless Metal browser 20/20, including 11 smoke tests (captures contain summaries).
7. Full remote L3: 11/20 pass; nine simulation failures; three reproduced on exact starting commit 96dc52d0 (see baseline evidence).
8. Unprepared first-click raise still snaps because the simulation fires with zero windup; a raised, blended first shot needs a firing-windup change.
