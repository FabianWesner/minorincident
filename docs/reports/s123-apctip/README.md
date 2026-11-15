# s123 — L9 APC tipping correction

Status: **implemented and verified for the requested driving matrix**. Driving bound: **|chassis roll| and |chassis pitch| <20°**. The mandatory scripted outskirts crash remains an authored rollover after driving ends. No deployment, push, or main movement.

## Root cause and correction

Native wheel/contact forces can impart rollover momentum during asymmetric support. The original controller had delayed recovery only after substantial inversion, with no mechanism to arrest an impending tip. A HIGH physical-keyboard road sample with only the new correction disabled reaches **49.15° roll**. First20° breach: tick2757, x−67.56/z−333.24, speed~16.3m/s, upward velocity2.31m/s, diagonal wheel contacts[true,false,false,true]. A separate native corner-cut ablation reaches23.12° after losing all four contacts. Native ramp and30m/s bus-side fixtures independently reproduce large roll/inversion without correction.

The existing chassis implementation is identical between683da8f8 and candidate266ec466. This susceptibility predates batch103; the evidence does not establish dropped terrain residency as the cause. The original s122 tick3255 is not an exact replay: wall-clock keyboard timing differs. The physical-keyboard ablation reproduces the reported class of defect and isolates the corrective torque's effect.

`VehicleBody.stabilizeTilt` applies finite capped restorative impulses about the chassis roll/pitch axes to the player-driven L9 APC. It starts restoring beyond12° and arrests high angular momentum earlier. Per-axis angular-rate change is capped at3rad/s per tick. Smaller ordinary lean remains free. There are no rotation/position writes, infinite damping, or teleport-righting; steering/yaw and suspension retain native physics. The ordinary angular damping is unchanged.

## Current evidence

| Check | Result |
| --- | --- |
| Six full native drives: HIGH/LOW primary road, road detour/corner-cut, countryside/wide off-road | All complete; worst roll10.79°, pitch12.18°; no20° breach |
| Aggressive steering:600ticks alternating full steer, then complete primary road | HIGH12.32° roll/12.06° pitch; LOW9.58°/11.32°; both complete |
| Native kerb, ramp, bus-side and bus-rear contacts | Verified hull/wheel contacts; all stabilized fixtures below15° on both axes |
| Physical keyboard HIGH WebGL2 road, zoom1,120wall seconds | 6738 driving ticks, roll15.19°/pitch10.94°, no breach; bounded unfinished sample, one death |
| Continuous bus asphalt census, six full drives | 44,784 visible native ticks,100% within6m; worst3.479m |
| Aggressive-drive bus census | 13,901 ticks,100% within6m; worst2.369m |
| Full vehicle campaign motion gate | All8 HIGH/LOW cases pass; receipt source hash matches current source |
| Full threat audit | Exit0,330.2s wrapper time,0flags; L9 skilled/passive complete |
| Unchanged remote unit suite | Exit0,146.8s;27files,105passed/1skipped; runner94.130.181.173 |
| Typecheck and lint | Pass |

Contact fixtures retain600ticks with trace samples every10ticks. The floor extends1500m each way so driven vehicles cannot leave it during the sample. All stabilized fixtures settle near upright with negligible angular speed by tick590 and normal suspension compression around0.245m. The physical-keyboard run records up to0.25m suspension deviation. These establish suspension movement and finite settling; they are not a human preference rating.

Personally inspected original-size physical-keyboard captures t2707 (leapers on hull at bridge approach) and t5411 (barricade contact): APC upright in both. Sparse stills do not prove continuous visual perfection. Raw images/logs remain in ignored `test-results/s123-apctip/physical-high/`.

## Reproduction and receipts

`results.json` contains current gate provenance, each drive/tier result, continuous bus census, physical-keyboard torque ablation and corrected sample, and contact traces. It is below200KB. Earlier provisional numerical sections inside JSON are historical; `correctedFullDriveMatrix`, `aggressiveCompletedDrives`, `controlledContacts`, `correctedRuntimeGates`, `currentThreatAudit`, and the two `physicalKeyboard*` entries are the current evidence.

- `L9_QUALITY=high L9_PROGRESS_PATH=primary node --import tsx/esm tools/qa/l9-progress-probe.ts 1 road --check` runs a complete route with the20° driving assertion. `L9_STEER_STRESS=1` adds the steering burst. `L9_DISABLE_TILT=1` is an explicitly diagnostic ablation.
- `node --import tsx/esm tools/qa/apc-tilt-contact.ts` checks contact fixtures and fails on missing contact or a stabilized20° breach.
- `PLAYTEST_APC_TILT=1` enables read-only tick logging in the physical-input playtest harness. `PLAYTEST_APC_DISABLE_TILT=1` explicitly disables only correction for causal comparison.
- Browser runs use the shared headless pool, one browser, ten-minute reservations and ports4983/4984. Full native drives use ordinary inputs; controlled fixture poses are setup-only.

## Browser QA needed

Manual WebGPU and human suspension/steering feel review remain recommended. The completed automated checks cover the requested mechanical bound and regressions; the120-second physical-keyboard sample does not certify level completion, a human fun rating, or an exact replay of the original tick3255 screenshot. The scripted final crash deliberately exceeds the driving bound.
