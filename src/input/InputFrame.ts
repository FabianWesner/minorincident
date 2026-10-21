/** World-ground vectors use X/Z (metres), matching the simulation's coordinate system. */
export interface Vec2 { x: number; z: number }
export interface Button { down: boolean; held: boolean; up: boolean }
export type Scheme = 'mouse-only' | 'mouse-keyboard' | 'keyboard' | 'touch';
/** One logical frame per fixed tick. Pulses may have both down and up in the same tick. */
export interface InputFrame {
  /** Local vehicle axes from WASD; walking continues to use screen-relative move. */
  drive?: { throttle: number; steer: number };
  /** Touch/keyboard vehicle brake. */
  brake?: boolean;
  /** Rear-wheel handbrake; RIGHT (K / touch RIGHT) while driving. */
  handbrake?: boolean;
  /** Explicit pointer commands; absent means keep the current command. */
  moveTarget?: Vec2;
  /** Mouse LMB fires the active carried action; Shift locks feet for the swing. */
  mouseAttack?: boolean;
  /** Space attacks the currently selected carried weapon, independent of its rack. */
  activeAttack?: boolean;
  attackInPlace?: boolean;
  /** RMB/Q cycle the carried actions across racks, deduplicating unarmed. */
  selectorActive?: boolean;
  attackTarget?: { id: number; side: 'LEFT' | 'RIGHT' };
  /** Cancel any pending destination or target attack. */
  cancelMove?: boolean;
  /** Ground LMB is movement, not a LEFT attack. */
  pointerGround?: boolean;
  /** Held target press stops firing if that command loses its target. */
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
  /** Resolved click navigation requests the bounded locomotion response. */
  navigation?: boolean;
  move: Vec2;
  /** Hold-to-walk modifier (keyboard C/Alt, Alt+click, light touch stick); running is the default. */
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
  pause: boolean;
}
export const emptyInput = (): InputFrame => ({
  move: { x: 0, z: 0 }, aim: null, aimSource: null,
  left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false },
  selector: 0, interact: false, pause: false,
});
