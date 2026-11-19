# s177 rack and weapons

The HIGH WebGL2 capture [rack-l10.jpg](rack-l10.jpg) uses the production L10 mission handoff, with QA objective completion and teleports to reach the hangar. The fixture enabled Scene Lab's HUD marker, which exempts the game HUD from its scene-isolation stylesheet; no visibility override was applied to the rack. This is a controlled handoff rather than a normal-input playthrough. The mission reported `cure-carried`, ten rack weapons, and no browser errors. The ordered badges read 1 through 9 and 0, followed by the corgi's G button.

The picture shows ten separate dark tiles and the corgi tile in one row. The machete is a diagonal blade; handgun and shotgun have short and long barrel outlines; hunting rifle has a long stock and scope; assault rifle has a magazine; flamethrower has a tank and flame; launcher has a tube; nail gun has a broad body and nail magazine; molotov is a bottle with a flame; pipe bomb is a horizontal cylinder with a fuse; the corgi icon is a pointed-eared dog face. The silhouettes are small at this viewport, especially the guns, so their distinction needs player review.

The other weapon icons use a red axe head, nailed wooden bat, spade, curved sword, short knife, side-handle baton, compact SMG, segmented grenade, smoking canister, bundled firecrackers, and distinct pistol and machine-gun profiles. A catalog check requires unique icon IDs and rejects text captions on every weapon icon.

The headless HIGH and LOW WebGL2 interaction probe (`tools/qa/s177-rack-input.ts`) verified the rendered quality, ten badges, Digit0, Q and Shift+Q wrap, shotgun click, corgi button, G activation after cooldown, and an unchanged selected shotgun. Both desktop runs and a LOW phone viewport used a controlled handoff and reported no browser errors. The phone run tapped the weapon and corgi controls; all runs also verified that an added eleventh weapon had no badge and remained selectable.

## Browser QA needed

- Check badge readability in normal gameplay on HIGH and LOW, with at least four weapons in the L10 rack.
- Review number keys, cycling and touch in ordinary gameplay, including vehicle and mounted-gun guards.
- Review the full hangar rack and separate corgi button in ordinary gameplay, including icon legibility and the button's cooldown.
- Verify the pipe-bomb Mega fall, recovery and immunity visually, and review the molotov impact and fire field.

The molotov uses 135 damage, a 4.5 m cutoff and the rocket’s 0.6 falloff over its 6 m reference distance; it therefore deals 75% of rocket damage at the same distance inside the molotov radius. Molotov TTK bands use the stationary concept-HP probe at a 2 m centre impact, with infinite charges and throws every 16 ticks; observed times run from 11 ticks for low-HP targets to 139 for the gorilla profile. At merged code revision 3123e980, typecheck and lint passed; the required remote unit suite passed 105 tests with one skipped in 194.9 s (150/150 collection budget). The remote E05 verification command also passed typecheck, lint and the same unit gate in 167.7 s; its epic-specific acceptance tests have been retired.

The requested machete parity is assigned to lane s176 and is not yet merged into main: this worktree retains the current main values (40 damage / 0.4 s for machete, 56 damage / 0.5 s for axe). The separate s176 branch currently uses 45 damage for the machete. Integrate and validate that lane before treating the cross-lane parity statement as complete.
