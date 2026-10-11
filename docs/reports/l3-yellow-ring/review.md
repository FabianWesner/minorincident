# L3 yellow rings and finale completion — 2026-10-11

## Cause and fix

The police-station ring was the automatic waypoint for the custom `defend` step. Defending has no arrival condition: standing in it did nothing. The step keeps “Help defend the station” in the HUD and now has no waypoint. The light inspection HUD also updates when a step has no waypoint.

The army finale recorded arrival, but waited for boom closure before completing. The boom required every surviving officer beyond the arm and no living body under the arm. A stranded officer or an occupied boom could therefore leave the courier waiting indefinitely. Completion now follows the courier entering the rendezvous ring, after 0.7 s, regardless of squad casualties, separation, turning or boom obstruction. The boom still avoids closing through a living body. The arrival marker disappears immediately.

The army ring moved from x=141.5 to x=149, 7.5 m deeper inside the walls. Its 0.9 m radius is navigable, with a clear route from the resting point x=144. Crossing the barrier leaves L3 running; stepping into the ring completes it. Infected emergence doors inside the compound are excluded. Soldier placement and their covering-fire target remain unchanged, leaving the checkpoint layout to lane `l3-towers`.

## Other-level audit

All objective definitions were reviewed. L1 destination objectives retain their text and markers. L2 keeps the axe ring and truck/checkpoint destinations; the parallel alarm wait and firefighter defence lose misleading standing markers. L4 keeps convoy/quartermaster/hiding destinations, while plaza defence and cellar waiting have no ring. L5 survivor searching has no generic plaza waypoint; survivor/destination cues retain their existing logic. L6 shelter exploration and stopping infected have no waypoint; retreat and exit destinations retain theirs. Every in-range standing interaction now names the action and displays interaction progress in the game HUD.

## Captures reviewed at the game camera

- [Before station](before-station.png): courier beside the kerb with a large yellow ring, arrow and diamond; “Help defend the station · 0 m” implies an arrival action that does not exist.
- [After station](after-station.png): same kerb view; yellow geometry removed, HUD still says “Help defend the station.”
- [Armory interaction](after-armory.png): armory destination ring with “Hold still or press E · Take a handgun from the armory · 3%.”
- [Before army, supplied PROD 3c30b499](before-army-prod.webp): courier inside the ring near the checkpoint boom, police lined up nearby; L3 remains active. This is supplied production evidence, not a locally replayed capture.
- [Rest inside the compound, real Boulevard playthrough](after-compound-rest-blvd.png): courier and corgi behind the checkpoint walls with police nearby, health 100, deeper yellow ring ahead and HUD “Reach the rendezvous ring inside the army checkpoint · 5 m.” The five-second rest has finished and L3 is still active. The Oak rest capture was also inspected; it shows the same open lane and deeper ring, with covering fire across the distant checkpoint.

- [Deeper rendezvous before a click](after-compound-rendezvous.png): courier inside the walls, destination ahead, HUD names the ring at 4 m. The civilian at the boom is part of the obstruction regression fixture.
- [Entry with occupied boom](after-finale-entry.png): courier at the rendezvous, yellow ring/arrow/diamond gone; the turquoise circle is the mouse destination cue. Soldiers remain beside the open road and the army radio responds.
- [L4 handover](after-finale-L4.png): Fairhaven briefing over the evacuation bus, confirming progression rather than a stuck L3 objective.

## Specification correction

E21 beat 8, §5.10 and AC17 previously ended L3 at the zone line. They were corrected only for the explicit PO instruction of 2026-10-11: allow rest inside the army walls, move the ring 5–10 m deeper, then finish independently of squad casualties and boom obstruction. Other acceptance criteria were not relaxed.

## Validation

Focused regression tests failed on the former completion gate for a stalled officer and an occupied boom, then passed with the fix. A dedicated five-second rest test verifies a walkable compound, an active deeper destination marker, no completion until the ring and no active infected inside. Finale cases cover stalled, dead and turning officers and an occupied boom, with exactly one completion event.

Typecheck, lint and production build pass (final build `index-roQzNlCQ.js`). Remote unit suite: **811 pass / 4 fail**, solely `bld.clinic-annex` and `bld.police-station` LOD1/LOD2 static bake equality. Those four failures reproduce on unchanged HEAD. Remote `verify -- E21`: **44 pass / 9 fail**, so the full level gate is **not green**. Failing criteria are AC02 timing (276.78 s vs 225), AC04 infected HP (60 vs 40), AC05 handgun distance (4.21 m vs 6), AC08 turned officer (0 vs 1), AC09 officer knockdown share (0.192 vs 0.6), AC11 forced Oak bot completion, AC12 population (50 vs 12), AC13 pressure emergence (0 vs 1), and AC18 segment checkpoint mismatch. The prior broad run already failed these same nine criteria; the HP mismatch also reproduces directly on unchanged HEAD. Arrival AC17 passes, as do all five new compound/arrival cases. A separate AC17 bot run passes after making the debug bot target the ring centre. Full combat/population tuning and asset rebaking are outside this fix.

Headless full mouse/keyboard playthroughs: **Boulevard passes to L4 with two deaths**, **Oak passes to L4 with one death**, and campaign loadout handover passes. Both routes rest five seconds at x=144, verify no active infected inside, then walk to the ring. See [Boulevard state](real-input-blvd.json) and [Oak state](real-input-oak.json). No god mode, teleport or objective completion cheats are used in these full playthroughs. Commerce fails before the checkpoint after seven deaths; the prior helper run also failed there. The helper now uses the actual weapon-rack bindings to switch to the axe at contact range, correcting its former claim of doing so without any switch. Browser suite total: **3 pass / 1 fail**. This is not an all-routes pass.

Occupied-boom browser regression: **1 pass**. It stages arrival using objective completion, teleport and god-mode fixture controls, keeps a living civilian under the boom, then uses a real canvas mouse click to enter the ring. It verifies `barrierClosedAt` remains zero, marker disappears and L4 briefing opens. This targeted fixture supplements the two full real-input playthroughs; it is not itself a full playthrough. Station/interaction and light inspection tracker browser checks pass separately (**2 pass**).

Simulation smoke: **6 pass** within the remote E21 run. Browser smoke: **25 pass / 1 fail** across Chromium, mobile profiles and WebKit. Failure is `T-E13-05` save/reload in L5: expected LEFT rack `[weapon.bat, weapon.kick, weapon.fists]`, received `[weapon.fire-axe, weapon.bat]`. The saved-loadout assertion is outside this L3 change; it has not been independently reproduced on unchanged HEAD in this lane. Full requested validation is therefore not green. See [validation summary](validation.json). All browser runs use the shared `tools/e2e-lock.sh` slots; Vitest runs on remote runners. No deployment or merge is performed.
