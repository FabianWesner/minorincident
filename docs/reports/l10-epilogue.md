# L10 epilogue and R1 QA findings

## Q-235

The defect source predates batch 29: the survivor cast in `LevelTenEpilogue` dates to `39c200c8f`, and it places six people on a 1.3 m grid. The nav grid quantizes nearby offsets onto the same cells, producing overlaps at both refuge and destination. The courier cutout for frozen corpses was added in `ab3a972bc` (Q-209); cure-affected bodies were not exempt, so bodies inside the courier disc read as cut away. Cure-affected bodies now bypass that mask, and the six survivor routes use separated, nav-resolved slots. Cure release, epilogue and pullout clocks are untouched; `tools/qa/l10-arrival-check.ts` is unchanged.

This is an older issue, not a regression introduced by the narrow-road or Q-233-ID changes. The supplied Q-235 capture was inspected. A paired post-change capture is still needed.

## Q-236

`6ba51eb28` moved the field power line from a 17–21 m roadside setback to 7.5–9.5 m. The generated R1 pole at approximately (553.3, -7.8) consequently sits about 10.5 m from player-start (547, 0), putting its crossarm into the high-z1 start composition. The pole is moved downstream 18 m in the loaded placement and in the layout authoring source. The supplied Q-236 capture was inspected.

R1 evac-tower flood spots were authored at intensity 6 and range 24. Flood-marked towers now use a warm intensity-3.2, range-14 spot, retaining the authored direction and penumbra.

## Verification status

- `npm test`: 106 passed.
- `npm run typecheck`: passed.
- `npm run test:smoke`: blocked before browser tests; browser-pool daemon could not bind its Unix socket (`EPERM`).
- `npm run scene:gate`: blocked before launch by the same sandbox Unix-socket restriction; 48/48 and post-change captures remain unverified.
- `npm run layouts:build -- D-CURE`: likewise blocked at tsx startup by the sandbox Unix-socket restriction. Runtime placement applies the pole move to the current generated layout; the authoring source will carry it into future layout builds.
