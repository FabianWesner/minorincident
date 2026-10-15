Base: a110323bc; restore soldier orders and prioritize a moving leader and L3 retreat regrouping over stale firing steps.
Recovery: align L3 sidewalk/turn/ramp packs with the passing line and add final-turn relief; melee and crowd pressure respect elevated floors, with actors and corpses retained.
Hetzner: complete bot 382.17 s (limit 405), newbie 1 death (limit 2); all L3*.test.ts, L4*.test.ts, ally-combat-feel and added regression checks: 128 passed, 2 existing probe skips, zero failures.
Checks: typecheck/lint/fresh build pass; route, ally feel, walk-over pickups, elevated melee and player locomotion pass with unchanged thresholds.
QA: 42/42 WebGL2 and 42/42 WebGPU, high/low and zoom 1.5/1/0.5; inspected game-camera sheets show police shifting/regrouping, retained bodies and successful highway swings; entry frame zero briefly has foreground roof occlusion.
Scope: dedicated deploy fix; Boulevard <=5 and phone <=33.33 ms remain open in the original lane; no deployment or merge.
