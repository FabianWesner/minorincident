# s177 rack and weapons

The HIGH WebGL2 capture [rack-l10.jpg](rack-l10.jpg) uses the production L10 mission handoff, with QA objective completion and teleports to reach the hangar. The fixture enabled Scene Lab's HUD marker, which exempts the game HUD from its scene-isolation stylesheet; no visibility override was applied to the rack. This is a controlled handoff rather than a normal-input playthrough. The mission reported `cure-carried`, ten rack weapons, and no browser errors. The ordered badges read 1 through 9 and 0, followed by the corgi's G button.

The picture shows ten separate dark tiles and the corgi tile in one row. The machete is a diagonal blade; handgun and shotgun have short and long barrel outlines; hunting rifle has a long stock and scope; assault rifle has a magazine; flamethrower has a tank and flame; launcher has a tube; nail gun has a broad body and nail magazine; molotov is a bottle with a flame; pipe bomb is a horizontal cylinder with a fuse; the corgi icon is a pointed-eared dog face. The silhouettes are small at this viewport, especially the guns, so their distinction needs player review.

The headless HIGH and LOW WebGL2 interaction probe (`tools/qa/s177-rack-input.ts`) verified the rendered quality, ten badges, Digit0, Q and Shift+Q wrap, shotgun click, corgi button, G activation after cooldown, and an unchanged selected shotgun. Both runs used a controlled handoff and reported no browser errors.

## Browser QA needed

- Check badge readability in normal gameplay on HIGH and LOW, with at least four weapons in the L10 rack.
- Review number keys, cycling and touch in ordinary gameplay, including vehicle and mounted-gun guards.
- Review the full hangar rack and separate corgi button in ordinary gameplay, including icon legibility and the button's cooldown.
- Verify the pipe-bomb Mega fall, recovery and immunity visually, and review the molotov impact and fire field.

The 135 damage, 4.5 m radius and 0.6 falloff make the molotov 75% of rocket damage at corresponding fractions of their radii. At the same nonzero absolute distance, the different radii produce different falloff factors. Molotov TTK bands use the stationary concept-HP probe at a 2 m centre impact, with infinite charges and throws every 16 ticks; observed times run from 11 ticks for low-HP targets to 139 for the gorilla profile. At code revision a9b84516, typecheck and lint passed; the remote unit suite passed 105 tests with one skipped in 203.7 s (150/150 collection budget).
