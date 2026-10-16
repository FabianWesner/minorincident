# Game-camera review

Final requested core captures use **`7ef492f7f`**, after a fresh build. Both actual backends pass18/18 matrix rows (high/low × zoom1.5/1/.5); all **24** requested zoom1/.5 APC, tank/Alpha and courier/corgi sheets were opened and copied to [captures](captures/). Actor perimeter/feet, projected occlusion and zoom-.5 cropping match the descriptions below. Actual backend/tier and every check are retained in [capture-review-latest.json](evidence/capture-review-latest.json).

The complete refreshed WebGL catalog passes **90/90** in993.84 s on the retained7ef physical/render source. The new dog, bridge, checkpoint and ride high/low zoom-1 sheets were reopened and copied. The committed L2 completion-input policy is unused by these Scene Lab scenes. The refreshed WebGPU catalog also passes **90/90** in934.84 s with one worker after immediate two-unit admission failed. The same eight new-area sheets were reopened at high/low. The two complete refreshed matrices supply all180 rows; older matrices remain explicitly historical.

| Subject | Observed in both tiers/backends | Limits |
| --- | --- | --- |
| Healthy APC surrounded | Attackers gather at sides and bumper; cyan attack wedges extend outside the chassis; headlights illuminate the road and the seated courier remains visible. No attacker visibly settles at the chassis centre. | Far-side bodies are partly hidden. At .5, upper chassis/peripheral heads can cross the frame edge. |
| Alpha beside tank | Alpha starts outside the front track and walks away; its feet/contact boundary remain readable. Zoom 1 shows its full body beside the hull. | Zoom .5 crops the head in early frames and the tank top/cannon. This does not demonstrate full-body close framing. |
| Courier/corgi with eight attackers | Courier cap/head and planted feet remain distinguishable in the central pack. Orange corgi/green pack remain separate to the right, circling and settling. Cyan windups remain readable. Low has less shadow detail with matching silhouettes. | Projected torsos overlap and hide one another. Pixels cannot prove physical circle separation: registry/overlap checks supply that evidence. |

## Additional touched areas

High/low zoom-1 sheets were opened on both backends for Alpha charge, zebra contact, melee windup/knockdown, L2 release, L3 perimeter, L5 Metro, L6 stairs and damaged APC. WebGPU high/low sheets were also opened for the new dog, bridge, checkpoint and ride scenes; the WebGL repair sheets were subsequently opened at high/low on the same four scenes.

- Alpha charge follows its yellow line, knocks the courier beside the tank and stops at the hull; contact silhouettes project over one another.
- Zebra herd travels the marked line, knocks the courier down, then the courier rises. High retains stripes; low uses much simpler unstriped animal meshes. This is an existing LOD presentation limitation, not proof of a physics fault.
- Melee windups face the courier and show cyan wedges; one attacker falls and the remaining bodies retain separate feet where visible.
- L2 release shows residents emerging beside the facade and spreading onto the pavement; low has fewer bodies and simpler windows, retaining the production quality cap.
- L3 perimeter shows the checkpoint crowd outside the defence line, the stationary courier/corgi on the near side and passing soldiers; low remains readable with fewer shadows.
- L5 Metro shows the follower queue at the stair entrance, then the courier moving into the adjacent room; UI reports a snagging survivor and later Wait. This short sheet does not establish full mission progress; the unchanged intruder test covers that.
- L6 stairs show the courier and followers climbing the raised stair and emerging at its top, with feet following the support. Red signal lighting and rail silhouettes remain visible in both tiers.
- Damaged APC emits smoke while attackers gather around its perimeter, retaining the same seating/occlusion limits as the healthy variant.
- Dog approaches/pounces along the marked strike direction and settles beside the courier; repeated cyan/yellow attack telegraphs remain readable.
- Bridge arrivals are mostly hidden by the nearby roof and pink trees; occasional running heads/bodies appear at the road edge. The production camera is retained, but this is weak visual evidence; the actual AI/registry and arrival-count assertions are essential.
- Closed checkpoint shows bodies approaching the gate beside an ambulance while trees hide much of their feet/jamb contact. Collision and closure assertions, rather than these occluded pixels, establish exclusion.
- Ride at zoom 1 keeps the bus framed as it moves through the streets, without the former roof-filling camera jump. At .5 the bus fills/crops the image. Building occlusion masks remain visible. All 17 unchanged backend/tier/cadence jitter checks pass, including four rolling wheels and the .6 px limit.

## Matrix and browser provenance

The refreshed full catalogs pass **90/90 WebGL** (993.84 s) and **90/90 WebGPU** (934.84 s):15 scenes × high/low × zoom1.5/1/.5 per backend. Physical/render code is7ef492f7f; the later L2 completion-input policy is unused by these scenes. Full row/check metadata is in [WebGL](evidence/catalog-final-webgl.json) and [WebGPU](evidence/catalog-final-webgpu.json). The24 requested core sheets and16 new-area high/low sheets were opened; additional earlier-area reviews remain identified by their actual source in the72-record review manifest. Historical04c4/cd43 matrices are kept as earlier evidence. The deploy/smoke results are in [gates.md](gates.md).

Every browser was headless. Browser work used fresh builds and `tools/e2e-lock.sh`, at most two workers, unique ports, and bounded reservations under 20 minutes with gaps between batches. Timing used `tools/perf/quiet-run.sh`. Earlier slot starvation was stopped/reported after the 30-minute fairness limit; later batches attempted immediate admission rather than remaining queued.
