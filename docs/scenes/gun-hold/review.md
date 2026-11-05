# Gun hold frame review

## Method and scope

The courier uses the same female/male rigs in L1–L6. Both variants, every gun mesh, both cameras and bat/fists in the inactive slot are captured. Campaign handgun and army MG also have maximum cumulative gear; tiers 1–3 are subsets of tier 4. Game framing uses the production 19 m radius, polar 0.30π and azimuth π/4. Close framing uses 6 m at the same angles and includes the entire long barrel. The ground and body checks are independent of camera framing.

Each sheet is read left to right, then top to bottom. The normal timeline has the 23 labelled frames below. The fixture pistol has 24 frames; the unprepared first click has 21. The sheet index records each inspected case separately. Full close frames supplement the small cells for palm, fingers, stock and muzzle inspection. A rigid grip at the dominant palm is checked numerically; the other hand must have no weapon. `gunBodyHits` includes the additional drawn-ground check, with zero slack, as well as the unchanged torso/neck/head capsule checks. This is a stricter gate than the previous firing-only gun check.

There is no player crouch state or authored reload animation. Fixture guns reload through their existing magazine timer; their grip stays stable. Campaign handgun/MG have unlimited ammunition, so there is no ammo-empty auto-switch path. The inventory's common presentation update handles every selection path. The corgi cannot carry a gun. Existing gun-pose browser coverage checks armed officer/soldier/civilian followers standing and walking, plus the rotating army nest; their single gun and muzzle contract remain covered.

## Normal timeline: every cell

These observations apply to each normal sheet in the index. The model-specific notes identify the different barrel/stock shapes. "Empty" always means the left hand contains no prop, including a hidden bat/axe/gun from the other slot.

| Frame | Right hand and grip | Other hand | Barrel and muzzle |
| --- | --- | --- | --- |
| 0 | Idle, palm locked to the grip; arm lowered. | Empty. | Low carry, down and forward; no flash. |
| 10 | Same standing hold, no independent gun roll in the fingers. | Empty. | Same low carry. |
| 20 | Walking begins; grip follows the moving shoulder/arm. | Empty, animated freely. | Down and forward; stock outside the body. |
| 30 | Walking turn, palm still on the grip. | Empty. | Follows the rendered facing; long muzzle clears the road. |
| 40 | Running reversal, lowered arm stays attached. | Empty. | Turns with the actual rendered body rather than the simulation's new heading. |
| 50 | Running carry, no floating gun. | Empty. | Long stock and tube remain outside the torso/head. |
| 60 | Stopping carry, fingers retain their grip. | Empty. | Forward/down, no lingering permanent aim line. |
| 70 | Aim raise in progress, approaching shoulder height. | Empty. | Elevation and heading approach the target smoothly. |
| 80 | Firing/recoil, small reach reduction at the elbow. | Empty. | Forward at the target; live flash/tracer starts at the barrel end when firing. |
| 90 | Held aim between pulses; grip stays rigid. | Empty. | Forward, with cadence/reload-dependent flash visibility. |
| 100 | Turning aim toward the second target; wrist remains on the grip. | Empty. | Heading traverses toward the second target. |
| 110 | Raised aim toward the second target. | Empty. | Barrel follows that target; no stock through the face. |
| 120 | Walking fire, raised arm over the gait. | Empty. | Target direction retained while the feet move. |
| 130 | Walking fire/reload timer, stable palm. | Empty. | Barrel remains directed toward the target. |
| 140 | Walking fire, recoil stays in the arm. | Empty. | Muzzle effects appear at the actual muzzle, when a round fires. |
| 150 | End of walking burst; grip has not shifted. | Empty. | Raised hold; the last effects fade. |
| 160 | Recovery begins, lowering depends on the gun's last shot/cadence. | Empty. | Barrel starts moving down toward carry. |
| 170 | Continued lowering without rotating the gun separately in the palm. | Empty. | Approaches the gun's carry elevation. |
| 180 | Settled low carry. | Empty. | Down/forward; long muzzle above the road. |
| 190 | Standing low carry, fixed grip. | Empty. | No active flash or permanent gun line. |
| 200 | Bat selected: right hand holds only bat. Fists selected: no prop. | Empty. | Gun fully hidden; the cyan melee aim sector is the existing selected-action UI. |
| 210 | Gun selected again, right palm on its grip. | Empty. | Gun returns to low carry; bat disappears. |
| 220 | Settled standing gun hold. | Empty. | Low carry, no detached muzzle or flash. |

## Fixture pistol: every cell

This shares the handgun mesh, but retains the E05 six-round magazine/reload fixture. The ordinary movement states of this mesh are covered by the campaign handgun sheets above.

| Frame | Hands and grip | Muzzle / ammunition |
| --- | --- | --- |
| 0 | Right grip in low carry; left empty. | Down/forward, six rounds, no flash. |
| 10 | Same idle grip; left empty. | No flash. |
| 20 | Aim raising through the arm; left empty. | Elevation blending up, no round yet. |
| 30 | Raised aim; left empty. | Forward at target. |
| 40 | Stable raised grip; left empty. | First fire input is queued, six rounds. |
| 50 | Shooting hold; left empty. | Five rounds; flash/tracer follows muzzle. |
| 60 | Shooting/recoil hold; left empty. | Four rounds. |
| 70 | Between shots, palm fixed; left empty. | Four rounds, aim retained. |
| 80 | Shooting hold; left empty. | Three rounds. |
| 90 | Shooting hold; left empty. | Two rounds. |
| 100 | Between shots, palm fixed; left empty. | Two rounds. |
| 110 | Raised grip, left empty. | One round. |
| 130 | Reload timer, raised grip unchanged; left empty. | Empty magazine, reload ends at tick 176; no new shot. |
| 140 | Reload timer, grip fixed; left empty. | Empty magazine, barrel forward. |
| 150 | Same reload hold; left empty. | Empty magazine, no new flash. |
| 160 | Same reload hold; left empty. | Empty magazine. |
| 170 | Same reload hold; left empty. | Empty magazine, near timer completion. |
| 180 | Firing resumes with the same grip; left empty. | Five rounds after reload/shot; effects at muzzle. |
| 190 | Raised hold after resumed shot; left empty. | Five rounds, no magazine model floating in space. |
| 200 | Recovery from last shot; right grip still fixed; left empty. | Barrel lowers as the recovery weight fades. |
| 210 | Only selected bat, or no prop for fists; left empty. | Pistol fully hidden. |
| 220 | Same selected melee/fists state; left empty. | Pistol remains hidden. |
| 230 | Pistol reselected in right palm; left empty. | Low carry restored. |
| 240 | Stable idle grip; left empty. | Low carry, no flash. |

## Unprepared first click: remaining transition

Frames 0, 2, 4, 6, 8, 10, 12, 14, 16 and 18 show low carry with a fixed right grip, empty left hand and no flash. Frame 20 is the last low-carry frame: the fire plan has been assigned but has not stepped. The full frame-21 shot raises the arm immediately to shoulder height and puts the flash/tracer at the muzzle. Frames 22, 24, 26, 28, 30, 32, 34, 36, 38 and 40 retain the raised grip/recoil recovery, with the other hand empty. The frame-20→21 raise is still a snap: the simulation fires with zero windup. Preparatory aim, held fire and recovery blend; this raw first-click edge is **not claimed fixed**. Removing it while retaining a raised, aligned gun on the shot tick needs a first-shot windup decision.

## Model-specific inspection

| Gun | Inspection focus |
| --- | --- |
| Campaign handgun / fixture pistol | Compact grip stays in the palm while the arm raises; no independently tilted gun passing through the fingers. Empty opposite hand throughout. |
| Army MG | Long barrel uses a higher carry; stock held outside the shoulder. Belt box and barrel move as one rigid gun. Muzzle stays in the close frame and clears the road. |
| Shotgun | Long straight barrel and rear stock remain outside torso/head; no second melee prop. |
| Nail gun | Wide front body remains clear of torso during running reversal; palm is on the authored grip. |
| SMG | Compact stock/body remains outside the shoulder through the aim turn. |
| Hunting rifle | Long barrel uses the higher carry to keep the muzzle above the road while walking. |
| Assault rifle | Rear stock receives shoulder clearance; magazine stays attached to the gun, not a floating reload part. |
| Rocket launcher | Tube uses a higher, wider carry; rear tube stays outside the head and the front muzzle is included in close framing. |

## Validation and limits

The report preserves the final counts and links to gate evidence. L3 is not green: the full remote run fails nine simulation criteria (T-E21-02, 04, 08–13, bots). The exact starting commit reproduces handgun balance, lane density and pressure-spawn failures. No simulation/balance code or specification criteria were changed. See [full L3 failures](captures/l3-failures.txt) and [baseline comparison](captures/l3-baseline-summary.json).

## Inspected sheet index

All 92 sheets below were inspected cell by cell. The tables above describe every labelled cell. Each case has zero clipping and grip/visibility violations; numeric detail is in [matrix evidence](captures/matrix-summary.json). Rocket frame 190 retains the actual explosion haze, which partially obscures the courier; frames 180/210/220 show the same carry unobscured. Effects were left enabled.

| Inspected case | Frame table | Gun body/ground hits | Maximum grip error | Other hand |
| --- | --- | --- | --- | --- |
| [female-handgun-bat-game](captures/gun-hold-female-handgun-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-bat-game-tier4](captures/gun-hold-female-handgun-bat-game-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-bat-close](captures/gun-hold-female-handgun-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-bat-close-tier4](captures/gun-hold-female-handgun-bat-close-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-fists-game](captures/gun-hold-female-handgun-fists-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-fists-game-tier4](captures/gun-hold-female-handgun-fists-game-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-fists-close](captures/gun-hold-female-handgun-fists-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-handgun-fists-close-tier4](captures/gun-hold-female-handgun-fists-close-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-pistol-bat-game](captures/gun-hold-female-pistol-bat-game.jpg) | Fixture pistol | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-pistol-bat-close](captures/gun-hold-female-pistol-bat-close.jpg) | Fixture pistol | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-pistol-fists-game](captures/gun-hold-female-pistol-fists-game.jpg) | Fixture pistol | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-pistol-fists-close](captures/gun-hold-female-pistol-fists-close.jpg) | Fixture pistol | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-army-mg-bat-game](captures/gun-hold-female-army-mg-bat-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-bat-game-tier4](captures/gun-hold-female-army-mg-bat-game-tier4.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-bat-close](captures/gun-hold-female-army-mg-bat-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-bat-close-tier4](captures/gun-hold-female-army-mg-bat-close-tier4.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-fists-game](captures/gun-hold-female-army-mg-fists-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-fists-game-tier4](captures/gun-hold-female-army-mg-fists-game-tier4.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-fists-close](captures/gun-hold-female-army-mg-fists-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-army-mg-fists-close-tier4](captures/gun-hold-female-army-mg-fists-close-tier4.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-shotgun-bat-game](captures/gun-hold-female-shotgun-bat-game.jpg) | Normal | 0 | 1.2e-16 m | Empty while gun selected. |
| [female-shotgun-bat-close](captures/gun-hold-female-shotgun-bat-close.jpg) | Normal | 0 | 1.2e-16 m | Empty while gun selected. |
| [female-shotgun-fists-game](captures/gun-hold-female-shotgun-fists-game.jpg) | Normal | 0 | 1.2e-16 m | Empty while gun selected. |
| [female-shotgun-fists-close](captures/gun-hold-female-shotgun-fists-close.jpg) | Normal | 0 | 1.2e-16 m | Empty while gun selected. |
| [female-nail-gun-bat-game](captures/gun-hold-female-nail-gun-bat-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-nail-gun-bat-close](captures/gun-hold-female-nail-gun-bat-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-nail-gun-fists-game](captures/gun-hold-female-nail-gun-fists-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-nail-gun-fists-close](captures/gun-hold-female-nail-gun-fists-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [female-smg-bat-game](captures/gun-hold-female-smg-bat-game.jpg) | Normal | 0 | 1.6e-16 m | Empty while gun selected. |
| [female-smg-bat-close](captures/gun-hold-female-smg-bat-close.jpg) | Normal | 0 | 1.6e-16 m | Empty while gun selected. |
| [female-smg-fists-game](captures/gun-hold-female-smg-fists-game.jpg) | Normal | 0 | 1.6e-16 m | Empty while gun selected. |
| [female-smg-fists-close](captures/gun-hold-female-smg-fists-close.jpg) | Normal | 0 | 1.6e-16 m | Empty while gun selected. |
| [female-hunting-rifle-bat-game](captures/gun-hold-female-hunting-rifle-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-hunting-rifle-bat-close](captures/gun-hold-female-hunting-rifle-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-hunting-rifle-fists-game](captures/gun-hold-female-hunting-rifle-fists-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-hunting-rifle-fists-close](captures/gun-hold-female-hunting-rifle-fists-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-assault-rifle-bat-game](captures/gun-hold-female-assault-rifle-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-assault-rifle-bat-close](captures/gun-hold-female-assault-rifle-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-assault-rifle-fists-game](captures/gun-hold-female-assault-rifle-fists-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-assault-rifle-fists-close](captures/gun-hold-female-assault-rifle-fists-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-rocket-launcher-bat-game](captures/gun-hold-female-rocket-launcher-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-rocket-launcher-bat-close](captures/gun-hold-female-rocket-launcher-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-rocket-launcher-fists-game](captures/gun-hold-female-rocket-launcher-fists-game.jpg) | Normal | 0 | 5.6e-17 m | Empty while gun selected. |
| [female-rocket-launcher-fists-close](captures/gun-hold-female-rocket-launcher-fists-close.jpg) | Normal | 0 | 5.6e-17 m | Empty while gun selected. |
| [male-handgun-bat-game](captures/gun-hold-male-handgun-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-bat-game-tier4](captures/gun-hold-male-handgun-bat-game-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-bat-close](captures/gun-hold-male-handgun-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-bat-close-tier4](captures/gun-hold-male-handgun-bat-close-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-fists-game](captures/gun-hold-male-handgun-fists-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-fists-game-tier4](captures/gun-hold-male-handgun-fists-game-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-fists-close](captures/gun-hold-male-handgun-fists-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-handgun-fists-close-tier4](captures/gun-hold-male-handgun-fists-close-tier4.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-pistol-bat-game](captures/gun-hold-male-pistol-bat-game.jpg) | Fixture pistol | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-pistol-bat-close](captures/gun-hold-male-pistol-bat-close.jpg) | Fixture pistol | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-pistol-fists-game](captures/gun-hold-male-pistol-fists-game.jpg) | Fixture pistol | 0 | 6.2e-17 m | Empty while gun selected. |
| [male-pistol-fists-close](captures/gun-hold-male-pistol-fists-close.jpg) | Fixture pistol | 0 | 6.2e-17 m | Empty while gun selected. |
| [male-army-mg-bat-game](captures/gun-hold-male-army-mg-bat-game.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-bat-game-tier4](captures/gun-hold-male-army-mg-bat-game-tier4.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-bat-close](captures/gun-hold-male-army-mg-bat-close.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-bat-close-tier4](captures/gun-hold-male-army-mg-bat-close-tier4.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-fists-game](captures/gun-hold-male-army-mg-fists-game.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-fists-game-tier4](captures/gun-hold-male-army-mg-fists-game-tier4.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-fists-close](captures/gun-hold-male-army-mg-fists-close.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-army-mg-fists-close-tier4](captures/gun-hold-male-army-mg-fists-close-tier4.jpg) | Normal | 0 | 2.3e-16 m | Empty while gun selected. |
| [male-shotgun-bat-game](captures/gun-hold-male-shotgun-bat-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-shotgun-bat-close](captures/gun-hold-male-shotgun-bat-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-shotgun-fists-game](captures/gun-hold-male-shotgun-fists-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-shotgun-fists-close](captures/gun-hold-male-shotgun-fists-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-nail-gun-bat-game](captures/gun-hold-male-nail-gun-bat-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-nail-gun-bat-close](captures/gun-hold-male-nail-gun-bat-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-nail-gun-fists-game](captures/gun-hold-male-nail-gun-fists-game.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-nail-gun-fists-close](captures/gun-hold-male-nail-gun-fists-close.jpg) | Normal | 0 | 2.2e-16 m | Empty while gun selected. |
| [male-smg-bat-game](captures/gun-hold-male-smg-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-smg-bat-close](captures/gun-hold-male-smg-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-smg-fists-game](captures/gun-hold-male-smg-fists-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-smg-fists-close](captures/gun-hold-male-smg-fists-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-hunting-rifle-bat-game](captures/gun-hold-male-hunting-rifle-bat-game.jpg) | Normal | 0 | 6.2e-17 m | Empty while gun selected. |
| [male-hunting-rifle-bat-close](captures/gun-hold-male-hunting-rifle-bat-close.jpg) | Normal | 0 | 6.2e-17 m | Empty while gun selected. |
| [male-hunting-rifle-fists-game](captures/gun-hold-male-hunting-rifle-fists-game.jpg) | Normal | 0 | 6.2e-17 m | Empty while gun selected. |
| [male-hunting-rifle-fists-close](captures/gun-hold-male-hunting-rifle-fists-close.jpg) | Normal | 0 | 6.2e-17 m | Empty while gun selected. |
| [male-assault-rifle-bat-game](captures/gun-hold-male-assault-rifle-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-assault-rifle-bat-close](captures/gun-hold-male-assault-rifle-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-assault-rifle-fists-game](captures/gun-hold-male-assault-rifle-fists-game.jpg) | Normal | 0 | 5.6e-17 m | Empty while gun selected. |
| [male-assault-rifle-fists-close](captures/gun-hold-male-assault-rifle-fists-close.jpg) | Normal | 0 | 5.6e-17 m | Empty while gun selected. |
| [male-rocket-launcher-bat-game](captures/gun-hold-male-rocket-launcher-bat-game.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-rocket-launcher-bat-close](captures/gun-hold-male-rocket-launcher-bat-close.jpg) | Normal | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-rocket-launcher-fists-game](captures/gun-hold-male-rocket-launcher-fists-game.jpg) | Normal | 0 | 5.6e-17 m | Empty while gun selected. |
| [male-rocket-launcher-fists-close](captures/gun-hold-male-rocket-launcher-fists-close.jpg) | Normal | 0 | 5.6e-17 m | Empty while gun selected. |
| [female-unprepared-game](captures/gun-hold-female-unprepared-game.jpg) | Unprepared (snap at 20→21) | 0 | 1.1e-16 m | Empty while gun selected. |
| [female-unprepared-close](captures/gun-hold-female-unprepared-close.jpg) | Unprepared (snap at 20→21) | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-unprepared-game](captures/gun-hold-male-unprepared-game.jpg) | Unprepared (snap at 20→21) | 0 | 1.1e-16 m | Empty while gun selected. |
| [male-unprepared-close](captures/gun-hold-male-unprepared-close.jpg) | Unprepared (snap at 20→21) | 0 | 1.1e-16 m | Empty while gun selected. |

## Full close frames

The compact handgun grip sits in the palm and the visible fingers wrap its lower grip. The raised arm places the barrel forward at shoulder level. The MG stock and launcher tube sit outside the shoulder; their palm is partly occluded by the receiver/tube from this production angle, so the fixed grip is also checked numerically. The MG barrel clears the road and stays fully in frame. Flashes originate at the front muzzle and tracers continue its direction. The first-click frame 20 matches the idle carry, then frame 21 raises immediately: this remains the explicit transition defect.

- [female handgun, frame 0](captures/gun-hold-female-handgun-bat-close-f0000.png)
- [female handgun, frame 74](captures/gun-hold-female-handgun-bat-close-f0074.png)
- [female army-mg, frame 0](captures/gun-hold-female-army-mg-bat-close-f0000.png)
- [female army-mg, frame 74](captures/gun-hold-female-army-mg-bat-close-f0074.png)
- [female rocket-launcher, frame 74](captures/gun-hold-female-rocket-launcher-bat-close-f0074.png)
- [female unprepared, frame 20](captures/gun-hold-female-unprepared-close-f0020.png)
- [female unprepared, frame 21](captures/gun-hold-female-unprepared-close-f0021.png)
- [male handgun, frame 0](captures/gun-hold-male-handgun-bat-close-f0000.png)
- [male handgun, frame 74](captures/gun-hold-male-handgun-bat-close-f0074.png)
- [male army-mg, frame 0](captures/gun-hold-male-army-mg-bat-close-f0000.png)
- [male army-mg, frame 74](captures/gun-hold-male-army-mg-bat-close-f0074.png)
- [male rocket-launcher, frame 74](captures/gun-hold-male-rocket-launcher-bat-close-f0074.png)
- [male unprepared, frame 20](captures/gun-hold-male-unprepared-close-f0020.png)
- [male unprepared, frame 21](captures/gun-hold-male-unprepared-close-f0021.png)
