# veh.evac-bus visual review, 2026-10-13 (bus-hero lane)

Sheets reviewed (opened and looked at): viewer ring (4 azimuths, LOD0), `qa-sheet` game camera at 135/190 px for LOD0/1/2, close-ups of the rear, the front quarter with the door, the side with the arches; Scene Lab lineup `specs/scenes/catalog/veh-bus-hero.json` (high and low quality, zoom 1.0 and 0.6, before/after) and the L4 gate convoy, the L7 departure and the real L4 convoy ride (`tests/e2e/levels/bus-hero-captures.spec.ts`).

- Base: shaped shell with rounded roof edges and a raked, bevelled front; separate dark window surrounds with transparent glass (far-side pillars and the cabin are visible through it, seats read in lit light and as pale shapes at dusk); blue belt stripe, EVAC lettering and destination sign; bumpers, grille, headlights, tail lights; wheels sit in arches with lips and lug nuts. No flicker line: the old rear (coach face and `rearCabin` face coplanar at x = -4.60) is gone and the validator reports zero coplanar overlaps in all tiers and variants.
- LOD1 (hexagonal wheels, no side lettering) and LOD2 (no interior, simple sign bar) stay readable at the game camera.
- Wrecked and burned keep the silhouette: crumpled front with glass shards, charred open frame with burned seats.
- Known limits: the interior is dark in cast shadow (the roof shades the window band at the game camera); the derived variants are procedural (faceted deformation).
