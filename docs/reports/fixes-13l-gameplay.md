# Gameplay QA fixes — Q-136–141 and Q-149

- Q-136: scripted falls bypass ground settling; all 120 fall frames retain the exact hull height and six wheel offsets. [Proof](fixes-13l-gameplay/evidence/Q-136-green.json).
- Q-137: L9 starts the companion seated; zero visible companion frames during 61 real-input drive samples. [Proof](fixes-13l-gameplay/evidence/Q-137-green.json).
- Q-138: E-only interaction pickups cannot be fetched, including a pending fetch restored from state; walking leaves the lamp fixed, E collects it. [Proof](fixes-13l-gameplay/evidence/Q-138-green.json).
- Q-139: merge clearance extends from 46 m to 60 m; the reported stop now drives past x=447 and every road/detour clears the route oracle. [Input proof](fixes-13l-gameplay/evidence/Q-139-green.json).
- Q-140: Sam's ring moves to the visible bus side at z=50; zoom-1.5 pixel visibility rises from 34% to 83%, and click/E rescues Sam. [Proof](fixes-13l-gameplay/evidence/Q-140-green.json).
- Q-141: boarding points to the nearest missing passenger on the minimap and names their distance. [Proof](fixes-13l-gameplay/evidence/Q-141-green.json).
- Q-149: no invulnerability reproduced; real aimed axe, handgun, machine gun and shotgun each take a 60-HP infected at 1.1 m to 0 during the active console hold. [Proof](fixes-13l-gameplay/evidence/Q-149-input.json).
- Validation so far: seven real-input checks, ten focused sim checks, 27 invariant sim checks, smoke (31 browser + six sim), build, typecheck and lint pass; final invariant rendering and remote unit/level results are pending.
