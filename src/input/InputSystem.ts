// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/Inputs.js, commit 41046b5.
import type { EntitySnapshot } from '../sim/world/types';
import { Vector3, type Camera } from 'three';
import type { Lifecycle } from '../core/Lifecycle';
import { defaultBindings, type Action } from '../data/bindings';
import { Bindings } from './Bindings';
import { Buttons } from './Buttons';
import { emptyInput, type InputFrame, type Scheme, type Vec2 } from './InputFrame';
import { Recorder } from './Recorder';
import { ClickPick, clickable } from './ClickPick';
import { Keyboard } from './devices/Keyboard';
import { Pointer } from './devices/Pointer';
import { RayCursor } from './devices/RayCursor';
import { Touch } from './devices/Touch';
import { Wheel } from './devices/Wheel';
import { objectiveRingRadius } from '../sim/missions/markerAnchor';

export const walkHintKey = 'minor-incident.walk-hint.v1';
/** Device ownership ends here. sample() runs immediately before every fixed sim tick. */
export class InputSystem implements Lifecycle {
  readonly bindings: Bindings;
  readonly recorder = new Recorder();
  /** Telemetry: sees every frame the sim consumes (call sites: sample()). Must not allocate. */
  tap: ((frame: InputFrame, scheme: Scheme) => void) | null = null;
  /** Telemetry replay: a decoded log supplies each sample's frame and device scheme. */
  feed: { next(): InputFrame | null; scheme: Scheme } | null = null;
  readonly keyboard: Keyboard;
  readonly pointer: Pointer;
  readonly wheel: Wheel;
  readonly cursor: RayCursor;
  readonly picker: ClickPick;
  /** Visible objective rings take precedence over body picks. Supplied before sampling by Game. */
  objectiveRings: readonly { x: number; z: number; y?: number }[] = [];
  readonly touch: Touch;
  private touchFire: 'touch' | 'assist' | null = null;
  readonly frame = emptyInput();
  scheme: Scheme = 'mouse-only';
  private drivingContext = false;
  private mountedGunContext = false;
  /** Mounted fire holds the touch trigger; carried weapons keep release-to-fire. */
  setMountedGun(on: boolean): void { this.mountedGunContext = on; }
  setDriving(on: boolean): void { if (on !== this.drivingContext) { this.drivingContext = on; this.touch.setDriving(on); } }
  private readonly left = new Buttons();
  private readonly right = new Buttons();
  private readonly space = new Buttons();
  private readonly active = new Set<Action>();
  private readonly heldTokens = new Map<string, Action>();
  private readonly selectors: { direction: -1 | 1; side?: 'LEFT' | 'RIGHT'; active?: boolean }[] = [];
  private interact = false;
  private cancelMove = false;
  private pointerTarget = false;
  private pointerGround: false | 'move' = false;
  private readonly clicks: { x: number; y: number; shift: boolean }[] = [];
  private selectedActiveSlot: number | undefined;
  private selectedSlot: { side: 'LEFT' | 'RIGHT'; index: number } | undefined;
  cycle(side: 'LEFT' | 'RIGHT'): void { this.selectors.push({ direction: 1, side }); }
  private pause = false;
  private injected: InputFrame | null = null;
  private readonly direction = new Vector3();
  private readonly screen: Vec2 = { x: 0, z: 0 };
  private readonly aim: Vec2 = { x: 1, z: 0 };
  private aimAngle = 0;
  private manualAim = false;
  private arrowStart = 0;
  private arrowTarget = 0;
  private releasing = false;
  private readonly hint = document.createElement('output');
  private readonly controls = document.createElement('details');
  private readonly message = document.createElement('output');
  /** One-time "hold to walk" hint (E19 §5.5): after ~2 s of running, shown for 5 s, once per profile. */
  private readonly walkHint = document.createElement('output');
  private walkHintTicks = 0;
  private walkHintDone = false;
  /** `controlAzimuth`: the gameplay camera's fixed azimuth. Movement keys and sticks stay on it while a story preset or cinematic
   * frames the scene from another side (P0 10-20: the L5 station view looked south, so a held W walked the courier back out). */
  constructor(private readonly canvas: HTMLElement, private readonly camera: Camera, private readonly zoom: (delta: number) => void = () => {}, private readonly controlAzimuth?: () => number) {
    let storage: Storage | undefined;
    try { storage = localStorage; } catch { /* Defaults work with storage disabled. */ }
    this.bindings = new Bindings(storage);
    this.cursor = new RayCursor(camera, canvas); this.picker = new ClickPick(camera, canvas);
    this.keyboard = new Keyboard(window, this.key);
    this.pointer = new Pointer(canvas, window, this.mouseActivity, this.token);
    this.wheel = new Wheel(canvas, (direction) => { this.mouseActivity(); this.zoom(direction * .14); });
    this.touch = new Touch(canvas, () => { this.pointer.valid = false; this.cancelMove = true; this.pointerGround = false; this.setScheme('touch'); }, (action, direction, side) => {
      if (action === 'selector') { this.selectors.push({ direction: 1, side }); }
      else if (action === 'interact') this.interact = true;
      else if (action === 'pause') this.pause = true;
      else {
        if (direction) { this.aimAngle = this.screenAngle(direction.x, direction.z); }
        this.touchFire = direction ? 'touch' : 'assist';
        (action === 'left' ? this.left : this.right).pulse();
      }
    }, this.zoom);
  }
  init(): void {
    this.keyboard.init(); this.pointer.init(); this.wheel.init(); this.touch.init();
    window.addEventListener('blur', this.release); window.addEventListener('pagehide', this.release);
    document.addEventListener('visibilitychange', this.visibility);
    this.hint.dataset.inputHint = ''; this.hint.setAttribute('role', 'note'); this.hint.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 32px);box-sizing:border-box;color:white;background:#182333;padding:8px;font:14px sans-serif;pointer-events:none;z-index:21';
    this.controls.dataset.inputControls = '';
    this.controls.style.cssText = 'position:fixed;top:54px;left:12px;background:#182333;color:white;padding:8px;font:14px sans-serif;max-width:260px';
    document.body.classList.toggle('debug-tools', new URLSearchParams(location.search).has('debug'));
    this.controls.dataset.inputControls = '';
    this.controls.hidden = !new URLSearchParams(location.search).has('debug');
    this.controls.innerHTML = '<summary>Controls</summary><form><label>Action <select name="action"></select></label><label>Key code <input name="code" placeholder="KeyZ" required></label><button>Bind</button></form>';
    const select = this.controls.querySelector('select')!;
    for (const action of Object.keys(defaultBindings)) { const option = document.createElement('option'); option.value = action; option.textContent = action; select.append(option); }
    this.message.setAttribute('role', 'status'); this.controls.append(this.message);
    this.controls.querySelector('form')!.addEventListener('submit', this.submit);
    this.walkHint.dataset.testid = 'walk-hint'; this.walkHint.setAttribute('role', 'note'); this.walkHint.hidden = true;
    this.walkHint.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);color:white;background:#182333e6;padding:8px 14px;border-radius:10px;font:600 15px system-ui,sans-serif;pointer-events:none;z-index:5';
    // Automated browsers keep their reference screenshots clean unless a test opts in ('force').
    try { const state = localStorage.getItem(walkHintKey); this.walkHintDone = state === '1' || (navigator.webdriver && state !== 'force'); } catch { /* Shown once per session without storage. */ }
    document.body.append(this.hint, this.controls, this.walkHint); this.setScheme(this.scheme);
  }
  private readonly submit = (event: Event): void => {
    event.preventDefault(); const form = this.controls.querySelector('form')!;
    const data = new FormData(form); this.rebind(data.get('action') as Action, String(data.get('code')));
  };
  rebind(action: Action, code: string): { ok: boolean; message: string } {
    const result = this.bindings.rebind(action, code);
    if (result.ok) this.release(); this.message.textContent = result.message; return result;
  }
  private setScheme(scheme: Scheme): void {
    if (scheme === this.scheme && this.hint.textContent) return;
    this.touch.pauseElement.hidden = scheme !== 'touch';
    this.touch.element.hidden = scheme !== 'touch'; this.touch.element.style.display = scheme === 'touch' ? 'grid' : 'none';
    this.scheme = scheme; this.hint.dataset.scheme = scheme;
    this.hint.textContent = {
      'mouse-only': 'Click to move · LMB attack · hold LMB to walk · Shift+LMB attack in place · RMB / Q cycle · 1/2/3 · wheel zoom · middle-click ACTION',
      'mouse-keyboard': 'WASD + cursor · LMB attack · Shift+LMB attack in place · RMB / Q cycle · 1/2/3 · wheel zoom · F / E',
      keyboard: 'WASD · J / K aim assist · 1/2/3 · Shift+1/2/3 · Q · F / E',
      touch: 'Stick to move · LEFT / RIGHT · swipe up to switch · pinch zoom · ACTION',
    }[scheme];
  }
  private readonly mouseActivity = (): void => {
    this.setScheme(this.moving() ? 'mouse-keyboard' : 'mouse-only');
  };
  /** Explicit HUD/device action, shared by pointer buttons and the keyboard/touch frame. */
  interactOnce(): void { this.interact = true; }
  private moving(): boolean { return this.active.has('moveUp') || this.active.has('moveDown') || this.active.has('moveLeft') || this.active.has('moveRight'); }
  private readonly key = (code: string, held: boolean): void => {
    if (code === 'ShiftLeft' || code === 'ShiftRight') return;
    if (held && /^Digit[123]$/.test(code)) {
      const index = Number(code.slice(-1)) - 1;
      if (this.pointer.valid && !this.shift()) this.selectedActiveSlot = index;
      else this.selectedSlot = { side: this.shift() ? 'RIGHT' : 'LEFT', index };
      this.setScheme(this.pointer.valid ? 'mouse-keyboard' : 'keyboard'); return;
    }
    const action = held ? this.bindings.action(code) : this.heldTokens.get(code);
    if (held && action) {
      if (action.startsWith('aim')) { this.pointer.valid = false; this.manualAim = true; }
      if (action.startsWith('move')) this.manualAim = false;
      this.setScheme(action.startsWith('aim') || this.scheme === 'touch' ? 'keyboard' : this.pointer.valid ? 'mouse-keyboard' : 'keyboard');
      if (action.startsWith('aim') && !this.aiming()) this.arrowStart = performance.now();
    }
    // Short arrow taps snap before releasing the key, preserving combined diagonals.
    if (!held && action?.startsWith('aim') && !this.releasing && performance.now() - this.arrowStart < 150) this.aimAngle = this.arrowTarget;
    this.token(code, held);
    if (held && this.aiming()) this.arrowTarget = this.screenAngle(this.axis('aimRight', 'aimLeft'), this.axis('aimDown', 'aimUp'));
  };
  private readonly token = (code: string, held: boolean): void => {
    const action = held ? this.bindings.action(code) : this.heldTokens.get(code);
    if (!action) return;
    if (held && code === 'Mouse0') this.clicks.push({ x: this.pointer.x, y: this.pointer.y, shift: this.shiftForMouse() });
    else if (held && code === 'Mouse2') { this.selectors.push({ direction: 1, active: true }); this.heldTokens.set(code, action); return; }
    else if (held && (action.startsWith('move') || action === 'left' || action === 'right' || action === 'interact')) { this.cancelMove = true; if (!action.startsWith('move')) this.pointerGround = false; }
    if (held) this.heldTokens.set(code, action); else this.heldTokens.delete(code);
    if (code === 'Space' && action === 'left') this.space.set(code, held);
    if (action === 'left') this.left.set(code, held);
    else if (action === 'right') this.right.set(code, held);
    else if (held && action === 'selector') { this.selectors.push({ direction: 1, active: this.scheme.startsWith('mouse') }); }
    else if (held && action === 'interact') this.interact = true;
    else if (held && action === 'pause') this.pause = true;
    if (held) this.active.add(action);
    else if (![...this.heldTokens.values()].includes(action)) this.active.delete(action);
  };
  private shift(): boolean { return this.keyboard.pressed.has('ShiftLeft') || this.keyboard.pressed.has('ShiftRight'); }
  /** Attack-in-place needs Shift held *now*: the mouse event's own flag wins over a possibly stale key state (a missed
   * Shift keyup otherwise turned every later click into a swing; PO, after respawn). */
  private shiftForMouse(): boolean { return this.pointer.shift && this.shift(); }
  private axis(positive: Action, negative: Action): number { return Number(this.active.has(positive)) - Number(this.active.has(negative)); }
  private aiming(): boolean { return this.active.has('aimUp') || this.active.has('aimDown') || this.active.has('aimLeft') || this.active.has('aimRight'); }
  /** Camera azimuth projected onto ground; pitch does not distort movement. */
  private screenVector(x: number, y: number, out: Vec2): void {
    let forwardX: number, forwardZ: number;
    if (this.controlAzimuth) { const azimuth = this.controlAzimuth(); forwardX = -Math.sin(azimuth); forwardZ = -Math.cos(azimuth); }
    else { this.camera.getWorldDirection(this.direction); const length = Math.hypot(this.direction.x, this.direction.z) || 1; forwardX = this.direction.x / length; forwardZ = this.direction.z / length; }
    out.x = -forwardZ * x - forwardX * y; out.z = forwardX * x - forwardZ * y;
  }
  private screenAngle(x: number, y: number): number { this.screenVector(x, y, this.screen); return Math.atan2(this.screen.z, this.screen.x); }
  /** Frame and math scratch objects are reused; no device polling or scene-mesh raycasts. */
  private readonly cursorPoint = { x: 0, z: 0 };
  private readonly driving = { throttle: 0, steer: 0 };
  sample(player: Vec2, dt = 1 / 60, targets: Iterable<EntitySnapshot> = []): InputFrame {
    if (this.feed) return this.feed.next() ?? this.frameNeutral();
    if (this.recorder.playing) return this.recorder.next() ?? this.frameNeutral();
    if (this.injected) { this.recorder.capture(this.injected); this.tap?.(this.injected, this.scheme); return this.injected; }
    const frame = this.frame;
    frame.move.x = 0; frame.move.z = 0; frame.aim = null; frame.aimSource = null; delete frame.walk; if (this.active.has('walk')) frame.walk = true; delete frame.aimPoint; delete frame.moveTarget; delete frame.attackTarget; delete frame.pointerGround; delete frame.selectorSide; delete frame.selectedSlot; delete frame.orderedSelection; delete frame.selectedActiveSlot; delete frame.pointerTarget; delete frame.mouseAttack; delete frame.activeAttack; delete frame.attackInPlace; delete frame.selectorActive;
    frame.cancelMove = this.cancelMove; this.cancelMove = false;
    const x = this.axis('moveRight', 'moveLeft'), y = this.axis('moveDown', 'moveUp');
    const driveX = this.drivingContext && this.aiming() ? this.axis('aimRight', 'aimLeft') : x;
    const driveY = this.drivingContext && this.aiming() ? this.axis('aimDown', 'aimUp') : y;
    this.driving.throttle = driveY ? -driveY : 0; this.driving.steer = driveX; if (this.scheme === 'keyboard' || this.scheme === 'mouse-keyboard') frame.drive = this.driving; else delete frame.drive; frame.brake = false;
    if (this.scheme === 'keyboard' || this.scheme === 'mouse-keyboard') {
      this.screenVector(x, y, frame.move); const length = Math.hypot(frame.move.x, frame.move.z);
      if (length > 1) { frame.move.x /= length; frame.move.z /= length; }
    }
    if ((this.scheme === 'mouse-only' || this.scheme === 'mouse-keyboard') && this.pointer.valid) {
      const point = this.cursor.project(this.pointer.x, this.pointer.y);
      if (point) {
        frame.aimPoint = this.cursorPoint; this.cursorPoint.x = point.x; this.cursorPoint.z = point.z;
        const dx = point.x - player.x, dz = point.z - player.z, distance = Math.hypot(dx, dz);
        if (distance > 1e-6) {
          this.aim.x = dx / distance; this.aim.z = dz / distance;
          this.aimAngle = Math.atan2(dz, dx); frame.aim = this.aim; frame.aimSource = 'pointer';
        }
      }
    } else if (this.scheme === 'keyboard') {
      if (this.aiming()) {
        const ax = this.axis('aimRight', 'aimLeft'), ay = this.axis('aimDown', 'aimUp');
        if (ax || ay) this.arrowTarget = this.screenAngle(ax, ay);
        const delta = Math.atan2(Math.sin(this.arrowTarget - this.aimAngle), Math.cos(this.arrowTarget - this.aimAngle));
        this.aimAngle += Math.sign(delta) * Math.min(Math.abs(delta), Math.PI * 2 * dt);
      }
      if (this.manualAim) { this.aim.x = Math.cos(this.aimAngle); this.aim.z = Math.sin(this.aimAngle); frame.aim = this.aim; frame.aimSource = 'keyboard'; }
      else frame.aimSource = 'assist';
    }
    if (this.scheme === 'touch') {
      // Light push walks, beyond half deflection runs (E19 §5.5): the stick picks a gait, not a speed.
      const deflection = Math.hypot(this.touch.stick.move.x, this.touch.stick.move.z);
      this.screenVector(this.touch.stick.move.x, this.touch.stick.move.z, frame.move);
      const length = Math.hypot(frame.move.x, frame.move.z);
      if (deflection > .08 && length > 0) { frame.move.x /= length; frame.move.z /= length; if (deflection < .5) frame.walk = true; }
      else { frame.move.x = 0; frame.move.z = 0; }
      if (this.touch.aiming) this.aimAngle = this.screenAngle(this.touch.aim.x, this.touch.aim.z);
      this.aim.x = Math.cos(this.aimAngle); this.aim.z = Math.sin(this.aimAngle);
      frame.aim = this.aim; frame.aimSource = this.touchFire ?? 'touch'; this.touchFire = null;
    }
    frame.left = this.left.sample(); frame.right = this.right.sample();
    const space = this.space.sample();
    if (space.down || space.held || space.up) frame.activeAttack = true;
    const candidates = this.clicks.length ? Array.from(targets) : null;
    for (const click of this.clicks) {
      const point = this.cursor.project(click.x, click.y);
      if (!point) continue;
      frame.cancelMove = true;
      frame.mouseAttack = true;
      if (click.shift) { frame.attackInPlace = true; this.pointerGround = false; this.pointerTarget = false; continue; }
      if (this.drivingContext) continue;
      const objective = this.objectiveRings.find(ring => {
        const hit = this.cursor.project(click.x, click.y, (ring.y ?? 0) + .08);
        return !!hit && Math.hypot(hit.x - ring.x, hit.z - ring.z) <= objectiveRingRadius;
      });
      this.cursor.project(click.x, click.y);
      const picked = objective ? null : this.picker.pick(click.x, click.y, candidates!) ?? this.magnet(player, point, candidates!);
      if (picked) { frame.attackTarget = { id: picked.id, side: 'LEFT' }; this.pointerGround = false; this.pointerTarget = true; frame.pointerTarget = true; }
      else { frame.moveTarget = { x: objective?.x ?? point.x, z: objective?.z ?? point.z }; this.pointerGround = 'move'; this.pointerTarget = false; }
    }
    this.clicks.length = 0;
    if (this.pointer.isHeld(0)) {
      frame.mouseAttack = true;
      if (this.pointerTarget) frame.pointerTarget = true;
      if (this.shiftForMouse() && !this.drivingContext) {
        frame.attackInPlace = true; frame.cancelMove = true;
        delete frame.moveTarget; delete frame.attackTarget; delete frame.pointerTarget; this.pointerGround = false; this.pointerTarget = false;
      }
    }
    if (this.pointerGround && !this.drivingContext) {
      frame.pointerGround = true;
      if (this.pointerGround === 'move' && frame.left.held && frame.aimPoint && !this.moving()) frame.moveTarget = { ...frame.aimPoint };
    }
    if ((this.drivingContext || this.mountedGunContext) && this.scheme === 'touch') {
      if (this.touch.holdingLeft) frame.left.held = true;
      frame.right.held = this.touch.holdingRight;
    }
    if (this.selectedActiveSlot !== undefined) { frame.selectedActiveSlot = this.selectedActiveSlot; this.selectedActiveSlot = undefined; }
    if (this.selectedSlot) { frame.selectedSlot = this.selectedSlot; frame.orderedSelection = true; this.selectedSlot = undefined; }
    const selection = this.selectors.shift();
    frame.selector = selection?.direction ?? 0;
    if (selection?.side) frame.selectorSide = selection.side;
    if (selection?.active) frame.selectorActive = true; frame.interact = this.interact; frame.pause = this.pause;
    this.interact = false; this.pause = false; this.updateWalkHint(frame); this.recorder.capture(frame); this.tap?.(frame, this.scheme); return frame;
  }
  /** Current melee reach of the active weapon (metres), supplied by the game; null outside combat. */
  reach: (() => number | null) | null = null;
  /** Melee magnet (combat proposal 1.2 B): a click that misses every body but lands just past an infected the courier
   * can already reach, within 35 degrees of it, attacks that one instead of walking into it. A cone toward the
   * cursor, not a radius, so clicking away from a crowd still walks. Melee reach only (guns keep plain picks). */
  private magnet(player: Vec2, point: Vec2, targets: readonly EntitySnapshot[]): EntitySnapshot | null {
    const reach = this.reach?.();
    if (!reach || reach > 3) return null;
    const cx = point.x - player.x, cz = point.z - player.z, click = Math.hypot(cx, cz);
    if (click > reach + 2 || click < 1e-3) return null;
    let best: EntitySnapshot | null = null, nearest = Infinity;
    for (const target of targets) {
      if (!clickable(target) || target.health.current <= 0) continue;
      // Assist a near miss at the feet; clear ground elsewhere in the cone remains a move order.
      // Otherwise a short escape click can attack an infected metres beyond the clicked point.
      if (Math.hypot(target.transform.x - point.x, target.transform.z - point.z) > (target.combat?.radius ?? .4) + .3) continue;
      const dx = target.transform.x - player.x, dz = target.transform.z - player.z, distance = Math.hypot(dx, dz);
      if (distance > reach + .3 || distance < 1e-3 || (dx * cx + dz * cz) / (distance * click) < Math.cos(35 * Math.PI / 180)) continue;
      if (distance < nearest) { best = target; nearest = distance; }
    }
    return best;
  }
  private updateWalkHint(frame: InputFrame): void {
    if (this.walkHintDone) return;
    const moving = Math.hypot(frame.move.x, frame.move.z) > .1 || !!frame.moveTarget || !!frame.pointerGround;
    if (this.walkHint.hidden) {
      this.walkHintTicks = moving ? this.walkHintTicks + 1 : this.walkHintTicks;
      if (this.walkHintTicks < 120) return;
      const key = this.bindings.keyLabel('walk') || 'C';
      this.walkHint.textContent = this.scheme === 'touch' ? 'Push the stick lightly to walk' : this.scheme === 'mouse-only' ? 'Hold Alt while clicking to walk' : `Hold ${key} or Alt to walk`;
      this.walkHint.hidden = false; this.walkHintTicks = 0;
      try { localStorage.setItem(walkHintKey, '1'); } catch { /* Storage disabled. */ }
    } else if (++this.walkHintTicks >= 300 || frame.walk) { this.walkHint.hidden = true; this.walkHintDone = true; }
  }
  private frameNeutral(): InputFrame {
    const frame = this.frame; frame.move.x = 0; frame.move.z = 0; frame.aim = null; frame.aimSource = null; delete frame.walk; delete frame.aimPoint; delete frame.drive; delete frame.brake; delete frame.moveTarget; delete frame.attackTarget; delete frame.cancelMove; delete frame.pointerGround; delete frame.selectorSide; delete frame.selectedSlot; delete frame.orderedSelection; delete frame.selectedActiveSlot; delete frame.pointerTarget; delete frame.mouseAttack; delete frame.activeAttack; delete frame.attackInPlace; delete frame.selectorActive;
    frame.left.down = frame.left.held = frame.left.up = false; frame.right.down = frame.right.held = frame.right.up = false;
    frame.selector = 0; frame.interact = false; frame.pause = false; return frame;
  }
  /** Logical injection persists until clear(), preserving the E01 harness contract. */
  inject(patch: Partial<InputFrame>): void { this.injected = { ...(this.injected ?? emptyInput()), ...structuredClone(patch) }; }
  clear(): void { this.injected = null; this.reset(true); }
  private readonly visibility = (): void => { if (document.hidden) this.release(); };
  readonly release = (): void => {
    this.releasing = true; this.keyboard.release(); this.pointer.release(); this.releasing = false;
    this.touch.release(); this.wheel.reset(); this.touchFire = null; this.left.release(); this.right.release(); this.space.release(); this.active.clear(); this.heldTokens.clear();
    this.clicks.length = 0; this.cancelMove = true; this.pointerGround = false; this.selectedSlot = undefined; this.selectedActiveSlot = undefined;
    this.pointerTarget = false; this.selectors.length = 0; this.interact = false; this.pause = false;
  };
  update(): void { /* Input is sampled in the fixed input phase, not the render update. */ }
  reset(preserveRelease = false): void { this.setDriving(false); this.setMountedGun(false); this.release(); this.left.reset(preserveRelease); this.right.reset(preserveRelease); this.space.reset(preserveRelease); this.injected = null; this.recorder.reset(); this.aimAngle = 0; this.manualAim = false; this.setScheme(navigator.maxTouchPoints > 0 ? 'touch' : 'mouse-only'); this.frameNeutral(); }
  dispose(): void {
    this.reset(); this.keyboard.dispose(); this.pointer.dispose(); this.wheel.dispose(); this.touch.dispose();
    window.removeEventListener('blur', this.release); window.removeEventListener('pagehide', this.release); document.removeEventListener('visibilitychange', this.visibility);
    document.body.classList.remove('debug-tools');
    this.controls.querySelector('form')?.removeEventListener('submit', this.submit); this.controls.remove(); this.hint.remove(); this.walkHint.remove();
  }
}
