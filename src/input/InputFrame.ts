/** World-ground vectors use X/Z (metres), matching the simulation's coordinate system. */
export interface Vec2 { x: number; z: number }
export interface Button { down: boolean; held: boolean; up: boolean }
export type Scheme = 'mouse-only' | 'mouse-keyboard' | 'keyboard' | 'touch';
/** One logical frame per fixed tick. Pulses may have both down and up in the same tick. */
export interface InputFrame {
  move: Vec2;
  aim: Vec2 | null;
  /** Optional world-ground landing point; direction-only devices throw to max range. */
  aimPoint?: Vec2 | null;
  aimSource: 'pointer' | 'keyboard' | 'touch' | 'assist' | null;
  left: Button;
  right: Button;
  /** -1 = previous, +1 = next rack item; wheel pulses drain one per tick. */
  selector: -1 | 0 | 1;
  interact: boolean;
  pause: boolean;
}
export const emptyInput = (): InputFrame => ({
  move: { x: 0, z: 0 }, aim: null, aimSource: null,
  left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false },
  selector: 0, interact: false, pause: false,
});
