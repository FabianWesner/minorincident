# bld.apartment-block-a.w5 visual review — 2026-10-08

Reviewed the supplied W5 reference, fresh all-side turntable, matching LOD0/1/2 contact sheet, game-reference-peer comparison at 135 and 190 px, and roof-hidden sheet. Independent orchestrator acceptance remains pending.

The four-storey warm brick silhouette, shop band and projecting balconies match the integrated peer. The broad corner breach reveals multiple slab ends at both 135 and 190 px. LOD2 loses individual brick relief and most balcony rails but keeps the shop band, borders and breach. The reference has more irregular rubble and soot; the surviving back facades are cleaner than its texture-rich damage.

- C recognizable at game distance: PASS — the inherited silhouette and major landmark regions remain clear in every tier.
- C layout and material separation: PASS — inherited doors, trim, shop/clock/bell landmarks and masonry palette are retained.
- C hidden sides: PASS — continuous surviving walls are preserved; far glass remains dark at LOD2.
- C budgets: PASS — measured tiers in report.json stay below 30,000 / 12,000 / 4,000 triangles and eight total asset draws.
- C fictional identity: PASS — no real trademarks were introduced.
- E same place: PASS — every checked anchor matrix delta is zero; footprint IoU stays above 0.9.
- E higher decay visibly worse: PASS — large wall/roof openings, exposed floors/rafters, broken dark panes and dead civic lights distinguish W5 from the integrated peer.
- E varied damage: PASS — breach, glass bites, soot halos, masonry debris and impact chips use authored distance recipes.
- E sunset lighting: deferred to the level lane — these sheets use the existing preview lighting and fog, not the L5 district sunset preset.

Concrete limitations: preview fog softens the 135 px row; small impacts, soot gradients and rubble do not all survive that scale. The silhouette breach carries the damage read. Reference burn texture density and irregular rubble exceed this palette-only twin. No runtime systems or new damage-navigation routes are implemented here.

Evidence: test-results/l5-fairhaven-civic-w5/bld.apartment-block-a.w5/{comparison.png,lod-contact.png,game-reference-peer.png,cutaway.png}. JPG copies were saved to the requested scratchpad/l5-assets folder.
