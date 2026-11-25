# s238: L2 Engine 3 boarding

Engine 3 keeps its authored roof in place during the ride. The courier walks around the rear and uses the vehicle entry pose; firefighters approach the rear step and board in seat order, followed by the corgi. The truck waits for living riders. At the market, riders exit on the camera-facing side in a stagger and proceed onto the street.

## Captures

[Contact sheet](capture-sheet.jpg) shows HIGH then LOW at zoom 1 and 1.5: approach, five boarding samples, ride, and five arrival samples. Full frames and metadata are generated in `test-results/s238-l2truck/` by `tools/qa/s238-l2truck-capture.ts`. In the latest capture, both tiers reached the ride 234 ticks (3.9 s) after boarding began. The roof remains closed and no seated rig protrudes. The cab door opens during the courier step-in pose and closes for the ride. The images show riders approaching, clearing the rear step, and emerging at arrival; some bunch during the approach. Stills do not prove that every transition is free of popping.

## Validation

- Typecheck and lint passed after the latest product change.
- The existing nightly mission-interactions case passed, including a 15-second delayed rider who remains visible, followed by boarding and departure after release. No test case was added.
- Local default unit suite passed 105/105 tests in 112.5 s; the budget wrapper reports 148/150 cases.
- Threat audit passed after the boarding-gate change, with 0 fail flags in 326.0 s.
- Remote default suite passed for the earlier product revision in 231.6 s (104 passed, 1 skipped). Attempts against the current boarding gate and their unchanged retries exceeded the 240-second budget. Some long-running cases reported failures before the overall timeout prevented final diagnostics. The latest remote run and unchanged retry both exceeded the 240-second budget; the retry reported no assertion failures before timeout. A passing current remote run remains required.

## Open

- Review the full animation, including every rider's transition, for visible popping; the contact sheet alone cannot establish this.
- A permanently sealed boarding path can leave a living rider and truck waiting indefinitely. Temporary delay and recovery are covered by the interaction case; no automatic recovery from a sealed path is implemented.
- Obtain a current remote unit pass.

A denser HIGH review sampled boarding every 10 ticks and exit every 18 ticks after the door-timing fix. The courier crosses around the rear toward the cab, firefighters converge on the rear step in sequence, and riders emerge in order on arrival. Some approach silhouettes overlap; these sampled stills cannot prove absence of a one-frame pop. The current remote suite and unchanged retry again timed out at 245.7 s and 243.4 s respectively, without a reported assertion failure before timeout.

After `3ad2ca95`, the corgi waits for the crew and riders cross the rear sill into the body before hiding. The current remote unit attempt and unchanged retry timed out at 241.1 s and 240.7 s; the retry reported no assertion failures before timeout.

A one-tick boundary capture exposed a remaining pop: the corgi is still visibly outside the rear bumper immediately before it is hidden. Moving the endpoint deeper and fading the companion did not produce a convincing climb, so that experiment was reverted. A proper entry animation and occlusion transition remain required.

Further inspection of the same boundary captures also shows a firefighter fully visible beside the rear wheel immediately before hiding, then absent one tick later (`high/boundary-before-f126-z1.png` and `high/boundary-after-f126-z1.png` in the generated test results). The correction must cover the human riders as well as the corgi; the existing sampled contact sheet misses this transition.
