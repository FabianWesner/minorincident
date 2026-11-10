# r26-l8hitreact: visible hit reaction for L8 arena bosses

PO 2026-11-10: L8 animal bosses take 0.6x damage outside exposed windows and showed no sign of being hit.
Render-only change; no sim, damage, exposed-window, stagger or AI change.

## What changed
- `src/render/vfx/Vfx.ts`: a damaging hit on an `infected.arenaBoss` target starts a boss flash (0.18 s, rest 0.12 s between pulses) instead of the 0.1 s Alpha pulse. Amplitude 0.55 non-exposed, 0.9 exposed (0.3 with flash reduction). Strength is sent to the crowd as `1 + amplitude` (values above 1 mark a boss flash).
- `src/render/CrowdView.ts`: shader adds a warm-white additive lift for the boss marker (same `_state.w` slot, no new attribute, no new draw call, no per-hit allocation); the ordinary 0..1 pulse is unchanged. Cosmetic squash (<= 9 ticks, +5% xz / -6% y) on the instance matrix only; poses, attacks and sim untouched.
- `src/render/HealthBars.ts`: white "chip" segment beside the fill for 0.3 s (12 ticks hold, 6 fade, min 3 px) on every health drop of an arena boss; one extra instanced mesh, hidden (not drawn) when no chip is live.
- Test: `tests/engine/boss-hit-reaction.test.ts`.

## Browser QA needed
Coding lane, no browser was started. The QA lane checks (entry `--entry debug`, each of the six L8 arenas: flamingo flock members, zebras, monkeys incl. the 1.4x leader, lion/lioness, gorilla, elephant), quality low AND high, zoom 1.5 AND 1, WebGL2 AND WebGPU:

1. Non-exposed hit (hit a boss outside its recovery window): the body brightens warm-white for ~0.18 s and squashes slightly (wider/lower, back within ~0.15 s); the health bar gets a white slice (>= 3 px) next to the fill that holds ~0.2 s then fades by 0.3 s. Must be clearly visible at zoom 1 as well as 1.5.
2. Exposed hit (right after the boss's big move/roar while `exposedUntil` is active): same, but the flash is visibly brighter (0.9 vs 0.55) and the bar chip is larger (1.8x damage).
3. Sustained fire (MG/flamethrower): flash re-pulses at most every ~0.12 s, never a permanent white mass; no flicker artefacts on the bar.
4. The boss attack/move set is not interrupted or retimed by a hit (telegraphs, charges, stampede continue).
5. Ordinary Alphas, infected, dogs and zoo animals outside the arenas show the unchanged short pulse and no chip; the L10 Mega bar has no chip.
6. Shader sanity on WebGPU (Tint) and WebGL2: no pipeline errors or console warnings, no black/pink bosses, flash on dark coats (lion, gorilla, elephant) readable, no overexposure on pale flamingos/zebras. With flash reduction on, the flash is weak (0.3) but the bar chip is still visible.
7. Dead boss shows no flash; the chip disappears with the bar.
