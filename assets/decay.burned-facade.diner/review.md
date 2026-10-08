# decay.burned-facade.diner — lane visual review

Delivery verdict: ready for the orchestrator's independent asset QA. Status is
integrated, not final. Reviewed the reference, all sides, matching LOD0/1/2 and
FOV25° / azimuth45° / polar0.30π captures with the model roughly 107–131 px high.

- PASS — recognizable at game distance: Red striped awning, crowned red fascia, dark glazing and standing piers give the diner section its identity; LOD2 drops small lettering/stripes.
- PASS — main layout: original building/section proportions, entrance and roof
  silhouette survive every authored tier.
- PASS — material separation: warm shared palette, dark damaged glazing and pale
  frame/board regions remain readable; static batching retains root/body semantics.
- PASS — other sides: conservative standing walls and service details; no collapse
  or rubble added to W2/W3.
- PASS — budgets: all three measured tiers are below the row's triangle cap and
  total draw count is at most eight, including independently controlled owners.
- PASS — fictional signage; no new textures, real logos or trademarks.

Evidence: `test-results/l3-commerce-shop-damage/decay.burned-facade.diner/comparison.png`,
`lod-contact.png`, `game-camera.png` and the accompanying JSON records.

Concrete compromises: distance tiers omit seams, small lettering and fittings.
The section is shallow and less irregular than its reference. The distant tier
retains the standing frontage and awning but simplifies jagged glazing and trim.

The standard coverage guard fails the genuinely narrow side profiles (~6–7%); the all-side sheet is saved and the 3/4 game-size and authored LOD captures pass. The section is simpler and shallower than the reference at the 200-triangle distant cap.
