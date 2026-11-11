/** World-ground vectors use X/Z (metres), matching the simulation's coordinate system. */
export interface Vec2 { x: number; z: number }
export interface Button { down: boolean; held: boolean; up: boolean }
export type Scheme = 'mouse-only' | 'mouse-keyboard' | 'keyboard' | 'touch';
/** One logical frame per fixed tick. Pulses may have both down and up in the same tick. */
export interface InputFrame {
  /** Vehicle-relative axes: throttle > 0 = gas, < 0 = brake then reverse; steer > 0 = the vehicle's own left (A), < 0 = right (D). Walking uses screen-relative move. */
  drive?: { throttle: number; steer: number };
  /** Touch/keyboard vehicle brake. */
  brake?: boolean;
  /** Rear-wheel handbrake; RIGHT (Space / K / touch RIGHT) while driving. */
  handbrake?: boolean;
  /** Ignored legacy field retained for decoding historical recordings. */
  moveTarget?: Vec2;
  /** Mouse LMB fires the active carried action. */
  mouseAttack?: boolean;
  /** Space attacks the currently selected carried weapon, independent of its rack. */
  activeAttack?: boolean;
  /** Ignored legacy field retained for decoding historical recordings. */
  attackInPlace?: boolean;
  /** RMB/Q cycle the carried actions across racks, deduplicating unarmed. */
  selectorActive?: boolean;
  /** Ignored legacy field retained for decoding historical recordings. */
  attackTarget?: { id: number; side: 'LEFT' | 'RIGHT' };
  /** Reset keyboard attack facing and the pending attack buffer. */
  cancelMove?: boolean;
  /** Ignored legacy field retained for decoding historical recordings. */
  pointerGround?: boolean;
  /** Ignored legacy field retained for decoding historical recordings. */
  pointerTarget?: boolean;
  /** Fixed campaign weapon shortcut (1–9); missing weapons are ignored. */
  selectedWeaponKey?: number;
  /** Carried-list index for HUD/test/replay commands. */
  selectedActiveSlot?: number;
  /** Direct rack slot choice. Out-of-range slots are ignored. */
  selectedSlot?: { side: 'LEFT' | 'RIGHT'; index: number };
  /** Shift shortcuts address the ordered rack; saved/test commands retain physical indices. */
  orderedSelection?: boolean;
  /** Explicit side for a touch swipe or target attack while approaching. */
  selectorSide?: 'LEFT' | 'RIGHT';
  /** Scripted route navigation requests the bounded locomotion response. */
  navigation?: boolean;
  move: Vec2;
  /** Independent cursor facing with movement-aware strafe/backpedal footwork. Recorded for presentation replay. */
  strafe?: boolean;
  /** Hold-to-walk modifier (keyboard C/Alt or light touch stick); running is the default. */
  walk?: boolean;
  aim: Vec2 | null;
  /** Optional world-ground landing point; direction-only devices throw to max range. */
  aimPoint?: Vec2 | null;
  aimSource: 'pointer' | 'keyboard' | 'touch' | 'assist' | null;
  left: Button;
  right: Button;
  /** -1 = previous, +1 = next rack item; Q/HUD/swipe pulses drain one per tick. */
  selector: -1 | 0 | 1;
  interact: boolean;
  /** Continuous ACTION/E ownership for authored repair cranks; ordinary interaction remains an edge. */
  interactHeld?: boolean;
  pause: boolean;
}
export const emptyInput = (): InputFrame => ({
  move: { x: 0, z: 0 }, aim: null, aimSource: null,
  left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false },
  selector: 0, interact: false, pause: false,
});
