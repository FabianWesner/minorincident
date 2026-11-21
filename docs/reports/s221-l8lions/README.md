# L8 animal fights — s221

The courier and corgi enter each animal enclosure alone. Followers, including the separately controlled soldiers and Hale/Reyes, wait outside the active entry, do not shoot at targets inside, and resume after the enclosure clears. Intended cage waits are excluded from follower-wait measurements. The flamingo flock is fixed; dead birds are not replaced or removed. Lions coordinate a roar and a flank, circle and use cover, telegraph and leap, pin and bite, accept melee/E struggle or companion rescue, recover after a missed or broken leap, swipe twice, and enrage when their partner dies. Lion balance is animal-specific.

## Feel notes

- **Lions:** Watch the pair and the roar, then dodge the crouching pounce. Attack during the recovery; mash melee or E to break a pin.
- **Flamingos:** Leave the dive lane and shoot the bird during its ground recovery. The flock has a fixed total.
- **Zebras:** Avoid the herd's lane and watch for rear kicks. Their dedicated rework remains scheduled for s222.
- **Gorilla:** Interrupt or evade its displays, ground attacks and thrown objects. Its dedicated rework remains scheduled for s222.
- **Monkeys:** Fight the pack without soldiers clearing the cage. Their dedicated rework remains scheduled for s223.
- **Elephant:** Bait the charge into heavy yard objects while the group waits outside. Further polish remains scheduled for s223.

## Audio

Thirty positional cues cover idle, tell, attack, hurt and death for each of six species. The recordings are pitched down and mixed with distortion, echo and a wet layer; the animal bus ducks during dialogue. WebM and AAC sprites together are under 3 MB. The [source research](audio-candidates.md), [license snapshot](../../licenses/audio/s221-animal-voices.json), source recipes and generated audio credits identify the recordings, including the CC-BY gorilla field recording and its modifications. Audible off-screen tells and subjective sound quality still need listening verification.

## Verification

- `npm run typecheck`, lint, the focused L8 boss proof, and the nightly mission-interactions test passed. The two-shard threat merge before the final all-cage exit and flamingo-turn changes passed with zero global acceptance flags ([summary](threat-summary.json)); the full two-shard run must be repeated against the final cage changes.
- A prior full two-shard threat merge at `2cc66c65` passed with zero flags. The skilled L8 bot finished in 403.17 simulated seconds, with 0 deaths, 10 damage and a 4.26% follower-wait upper bound. Subsequent lion changes require a fresh gate.
- The final-source L8-only diagnostic completed in 407.8 simulated seconds, with 0 deaths and 90 damage taken ([receipt](final-l8-diagnostic.json)). It exits with the expected partial-level-selection flag. Its follower-wait upper bound was 4.33%, versus 7.52% on main. The audit also recorded two skilled L8 diagnostic flags for unreachable share and tunnel-breach first-attack time; L8 passive flags were zero, and the global result contained only the partial-selection flag.
- A separate detached checkout of main `97b4c6f71a188714bc07d32a6304f8520754340a` completed the L8 skilled route with 0 deaths in 430 simulated seconds ([receipt](main-l8-baseline.json)). Its L8-only threat diagnostic reports the expected partial-selection flag.
- The prior remote `sh tools/remote/run.sh "$PWD" -- npm test` passed 105 tests with 1 skipped in 205.0 s; the final-source rerun hit the 240 s runner timeout (241.0 s); an unchanged retry was started, but cannot complete within the time box.

## Visual review and limitations

The reviewed [native HIGH WebGL2, zoom 1 sheet](native-diagnostic.jpg) uses a headless fixture, not an uninterrupted playthrough. The lion setup is a static placement (it does not demonstrate autonomous stalking); the tell shows the low lion and warning ring, the next frame shows the airborne leap, and the pin frame shows the courier down with the lion at her feet. For the recovery frame the fixture explicitly calls the pin-release path: the courier stands and the lion remains low; the recovery state lasts 90 ticks, though a distinct physical skid is not clear in the still. The flamingo dive frame shows the bird airborne and the final frame shows it grounded beside a pad during recovery; the fixture repositioned the courier to frame that final image. The fixture releases presentation hit-stop while stepping. These frames do not prove the natural two-lion coordination or every live-game camera angle.

The elephant story handoff remains a risk: Hale is correctly outside the yard, but if delayed far from the entry she may miss the short proximity window for the opening charge story beat. The focused fixture places her outside near the entry; that does not prove every live route reaches the beat.

The removed replacement flight no longer reanimates killed flock members. The encounter waits for any initial infection already in progress before starting; birds newly infected during the fight turn immediately without a collapse/rise. The initial pre-fight transformation can still be visible and the live transition has not yet been visually reviewed.

The final all-cage correction keeps the monkey exit locked until every authored animal is dead, including after the leader dies. Any remaining healthy animal is turned into the fixed encounter rather than letting the gate open around it. The mission-interactions test with the leader regression passed before the final flamingo timing guard was added.
