# q249 pilot 2 — awaiting PO review

Only `npc.civilian-man-a` has revised anatomy. **Mass rollout is stopped.** Pilot 1 was rejected; its images remain in `../pilot/` for history. The original shared adult-m files and every other figure's manifest/bakes are unchanged from `4698e5aa0`.

## Review sheets (rendered and visually inspected)

- [Studio: front / three-quarter / side, before | after](studio-sheet.png). Heroine at left, same actual game units and identical orthographic camera; no height normalization or shoulder widening.
- [Scene Lab: high, game zoom 1.5 and 3 m close, idle / walk +12 / walk +24 ticks](game-sheet.png). Full PNGs are adjacent. Zoom panels are native pixel crops; close panels are reduced to 50% only in the sheet. Both fixtures explicitly retain authored hair, without a generated hat obscuring the head. L1 ambient leaves remain visible in both versions.

## Measured ratios

| Figure | Head / height, before → after | Head width / shoulders, before → after | Legs / height, before → after |
| --- | --- | --- | --- |
| Heroine (unchanged) | 0.2725 → 0.2725 | 0.8719 → 0.8719 | 0.4275 → 0.4275 |
| lod0 (high + low) | 0.2922 → 0.2461 | 1.1381 → 0.8967 | 0.4156 → 0.4431 |
| lod1 (high + low) | 0.2936 → 0.2461 | 1.1677 → 0.9141 | 0.4156 → 0.4439 |
| lod2 (high + low) | 0.2969 → 0.2461 | 1.1721 → 0.9028 | 0.4156 → 0.4460 |

All three ratios are within ±10% of the heroine on the source and all three high/low LODs. [Exact per-file receipts](ratios.json); [scope and topology audit](audit.json).

### Corrected anatomical measurement

Pilot 1's head joint cut through the chin/beard, and its narrow shoulder slice sampled the neck/inner sleeves above the actual shirt shoulders. Its reported man-a width ratio **1.8427** was therefore wrong. The corrected shoulder envelope includes torso/upper-arm vertices from the arm pivots down 10% of original standing height, and up 1.7%; that world-space band is frozen across before/after. The complete head begins 5 mm below its lowest head-owned chin/beard vertex. Width uses the skull above the head joint; hair accessories, eyes and hidden stump caps do not set the skin width. Legs are ground-to-hip; height is the standing mesh's ground-to-crown envelope.

For comparison, retaining the **old head-joint height** definition gives heroine **0.2440**, man-a **0.2631 → 0.2210**. The complete below-chin definition used in the table gives heroine **0.2725**, man-a **0.2922 → 0.2461**. This is a disclosed measurement correction, not a body adjustment.

## Geometry and hand prop

- Complete head, including beard/hair/eyes, scales uniformly in XYZ by **0.787926** about the neck pivot at **y=1.273980 m**, 5 mm below the original lowest chin/beard vertex. Only the narrow neck connection tapers. Front, three-quarter and side views show no torn beard flap.
- Body scale **1.000000**; shoulder width **0.571488 m → 0.571488 m**. Body and limb joint positions, hip height and foot positions are unchanged. Crown height falls **1.8000 m → 1.6884 m** solely because the head shrinks; the body is not stretched or raised to compensate. Outside head/neck/hands, maximum mesh displacement is **0.000000150 m** (float serialization).
- Hands scale **0.75** around the original wrists with existing skin weights; the wrist seam blends through its weights. Mug body remains the accepted **10 cm tall / 8 cm diameter** size and follows the hand. Its coffee surface now sits on the resized rim rather than above it; mug size was not changed for pilot 2.
- Dedicated pilot source and six public GLBs avoid changing the shared `npc.civilian-adult-m` alias. Existing source/high/LOD meshes are edited offline; healthy/infected/corpse animation bakes are regenerated through `skinCrowdBakes`. No new inference, geometry, per-frame anatomy transform, or shader variant is introduced.
- Topology and vertex attribute counts are unchanged: LOD0 **5460**, LOD1 **2303**, LOD2 **913** triangles including hidden stump caps/eyes. The heroine SHA-256 is pinned in `ratios.json`.

## Validation

The before/after Scene Lab receipts each cover 144 frames. Both have **0 console errors**, **0 held-prop intersections**, **0.3 cm maximum foot sliding**, **0 cm sinking**, and **0 missed in-view frames**; the walking samples use the production `npc-walk` animation. No new arm/body intersection is visible compared with the baseline. The source's angular forearm shading remains visible in both versions.

QA command results are recorded in [qa.md](qa.md). The full-cast rollout, lineup/readability gate at zoom 1, L1 depot/bench acceptance, cap/sitter fixes, full infected/corpse visual review and load comparison and all-cast ratio table remain pending the PO pilot decision. Do not treat this pilot as completion of q249.

## Reproduce

```sh
npx tsx tools/q249/build-pilot.ts
npx tsx tools/q249/audit-pilot.ts
SCENE_PORT=3349 sh tools/e2e-lock.sh npx tsx tools/q249/pilot-capture.ts after docs/reports/q249/pilot-2
python3 tools/q249/pilot-sheets.py
```

Before game captures use the baseline `4698e5aa0` in a single temporary baseline copy, with only the opt-in `accessories: ['none']` fixture semantics copied over. The original GLB used by the studio is saved in `input/`. The baseline copy is removed after capture. No branch was pushed or published.
