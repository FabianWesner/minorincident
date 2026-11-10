# r31-drivekeys: classic car controls

PO 2026-11-10 (verbatim): "L9 driving is still wrong / w - forward / s - brake / backward / a - turn wheel left / d - turn wheel right".
This replaces the screen-relative keyboard driving of 2026-11-08.

## What changed
- `src/sim/vehicles/Vehicles.ts`: keyboard, mouse-keyboard and touch driving read only `frame.drive` (vehicle-relative). The screen-relative branch (target heading from `frame.move`) is gone. `drive.steer > 0` is the vehicle's own left.
- `src/input/InputSystem.ts`: W/ArrowUp = throttle +1, S/ArrowDown = -1 (physics brakes first, then reverses once stopped), A/ArrowLeft = steer +1 (left), D/ArrowRight = steer -1 (right). Previously D sent +1, which the car physics read as left. Hint line and `GameUI` controls guide now say "W gas, S brake / reverse, A / D steer".
- Touch (chosen, it was screen-relative): while driving, stick Y = throttle/brake (up = gas, down = brake then reverse), stick X = steer, 12 % dead zone. Mouse-only (hold LMB toward cursor) is unchanged. No gamepad adapter exists in the input layer.
- `src/sim/vehicles/Bicycle.ts`: shares `frame.drive`; its steer is negated at the consumer so A turns the bike left, D right (it uses a clockwise heading).
- `src/input/InputFrame.ts`: documented the convention (steer > 0 = vehicle's left).
- `tools/playtest/session.ts`: L9 driver steers by heading error again (A when the goal is to the left of the APC's heading, D for right) instead of projecting a screen lookahead. The generic driver (learned A/D sign) and `VehicleRecovery` (S + A/D) already fit.
- Bots (`LevelNineBot`, `Driver`, Scene Lab plans) already emit vehicle-relative `frame.drive` with + = left; no change needed.

## Per vehicle
All player-driven cars (L9 APC, other cars, fire engine when the player drives it) go through `Vehicles.prePhysics`; the bicycle through `Bicycle.ts`. The L2 truck on its authored route is a driverless autopilot and has no key input. No HUD arrow or onboarding text suggested screen-relative steering (the only arrow is the objective edge arrow); the onboarding "vehicle" lesson is just "Stand by the door to enter".

## Proofs
- `tests/engine/vehicles.test.ts` (folded into the existing handling case): A turns the car to its own left and D to its right at yaw 0, 90, 180, -90 degrees; S at speed brakes first, then reverses; A while reversing swings the nose clockwise like a real car. `tests/engine/input.test.ts` (folded in): key to throttle/steer for WASD and arrows. Both files pass.
- `l9-driving-proof` (low tier): road completed 200 s, hp 100; road `--risky` completed 192 s; countryside completed 209 s; road `--zero` completed 412 s (5 collisionFailures logged by the proof, as a zero-durability run; no immortality).
- `threat-audit --levels L2,L9`: L2 and L9 skilled complete, passive complete. Flags: L2 passive retreat step (<2 landed/min, on foot, no driving) and L8-04 not measured because L8 was not selected. No flags on L9. No baseline report is available in this slim worktree to diff, so the orchestrator should compare against main.

## Browser QA needed
Drive with the keyboard in L9 (APC) and L2 (any car or the fire engine if drivable), close zoom 1.5 and default, high and low:
- Heading north (screen up), south, east, west: W accelerates along the nose; A must swing the nose to the driver's left (screen-left when heading north, screen-right when heading south), D the opposite. Same with arrow keys.
- Hold S at speed: brakes (brake lights), then reverses. Reverse with A: the tail goes left, the nose swings right.
- Boarding/exit with E, horn/boost on LEFT still work; bike (L1/L2 depot) A = left, D = right.
- Check the on-screen hint line while driving.
