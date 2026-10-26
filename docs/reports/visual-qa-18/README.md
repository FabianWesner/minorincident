# Visual QA 18: lane/l1-all-new @ 11bc961ff (L1 with all v2 figures) vs PROD 0009f107d

**Verdict: NO-GO.** I found no P1 (the player, the corgi and the vehicles are fine) and no perf regression. It is still a NO-GO because the new figures look clearly worse than PROD at the PO's settings. **The hats on the v2 civilians are oversized, faceted and pulled down over the eyes.** They also tip forward into flat discs on turned infected. One sun hat floats above the glasses as a flat plate. This is the class of the PO's P1-108/P1-115 hat findings, and it shows on every street in L1, L2 and L3 (01, 02, 04, 05, 07). On PROD the same figures show their eyes and glasses.

| Level | Glitches | Stunning |
|---|---|---|
| L1 | Q-187, Q-188, Q-189 (hats, infected faces); depot, lab and corgi fine | 6/10 (PROD 7) |
| L2 entry | Q-187 on bench sitters; Q-190 firefighter helmets | 6/10 |
| L3 entry | Q-187 (giant pale disc hat on an infected); the survivor group moved normally | 6/10 |

## Gates
- **Unflagged WebGPU pipeline smoke** (`tests/e2e/webgpu-pipelines.spec.ts`): 4/4 pass, no flag, low and high.
- **`qa:invariants`**: sim 28/28 (remote, 216 s). Render 12/12, including the L1–L10 load-vs-PROD cases.
- **L1 cold loads, worst of 3** (WebGPU low, 10 s of real movement after each card): 1878 ms vs PROD 2528 ms, so ≤ PROD + 10 % and ≤ 6 s. The worst post-card frame was 66.7 ms (PROD 33.3 ms). [cold-loads.json](cold-loads.json)
- **Gameplay frames over 200 ms in the real-input playtests:** none. The only long frames were loading frames (playMs 0).

## Play
- **Female courier, real input, WebGPU low, zoom 1.5, fresh save:** L1 → L2 → L3 finished (219/113/212 s) with 0 issues. The L3 survivor group did not stall.
- **Male courier, zoom 1, fresh save:** L1 and L2 finished. One P2 driver stall at the L2 fence (known Q-186).
- **Progressed save:** `qa:ab` L1–L3, 24/24 stops measured, 20 over threshold. The changed pixels are all figures, as expected (09–11).
- **Matched close-ups:** the same seed, checkpoint and bot ticks on PROD and the candidate (01–03).
- **Fine and equal to or better than PROD:**
  - The depot clerk walks back and the door closes (10).
  - The lab tech signs and returns (09).
  - The corgi trots and sits, and its collar, tongue, tail and detailed pack all show (03, 08).
  - Firefighter arrival, dogs and the walkers.
  - Corpses read as bodies.
  - Clothing on the new bodies is richer.
- **Not checked by me:** the infected-dog bite close-up, and corgi seating in the bus and APC. The lane's gates/corgi-transport.json covers the seating.

## Findings (ready to paste)
- **Q-187 (P2, NO-GO blocker, regression vs PROD, P1-108 class):**
  - What: hats on the v2 civilians (man-a/b, woman-a/b, elderly, live and infected) are ~1.3–1.5× head width, faceted and seated down over the eyes. On infected, the hunch tips them forward into brown or green discs in front of the face (01, 02, 04, 05, 07).
  - Where: `CrowdAccessories.authoredOrRetargeted` (skinned path). It retargets each hat to the TRELLIS skull, whose bounds include the hair volume. The width cap of 1.15–1.4 and the 0.2 rad brim tilt do not keep the eyes visible.
  - Fix: fit the hats to the PROD head size per model and keep the eyes visible from the game camera. Gate it on the A/B with live and turned peds at zoom 1.5.
- **Q-188 (P2):** woman-b's sun hat is a flat pale faceted plate, ~2× head width, hovering above her glasses (01, top row; also the seated wearer in 11). On PROD she wears no hat at that stop.
- **Q-189 (P2):** the infected tint on v2 faces turns into a mosaic of triangle patches, and the eyes no longer read. PROD's infected show tinted skin and pink eyes (02).
- **Q-190 (P2):** the new firefighter helmet covers the whole head. From the game camera (behind and above), its back reads as a jack-o'-lantern, with two yellow reflectors as "eyes" (06; the lane's own 06-npc.firefighter-alive.jpg, back view). L2 shows six of them at once.
- **Q-191 (P3):** the depot clerk's apron back is a smudged red and teal blotch, where the old model had a striped shirt and straps (lane sheet 02). It does not show at zoom 1.

Captures 01–11 are in this folder. Raw runs are under test-results/vqa18 and test-results/playtest/vqa18-* (git-ignored).
