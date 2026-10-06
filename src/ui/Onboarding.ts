// Pattern from folio-2025 InputFlag.js / World/Intro.js (Bruno Simon, MIT, 41046b5):
// persistent prompt identity and active input-mode glyphs. Completion uses sim events.
import type { Bindings } from '../input/Bindings';
import type { InputFrame, Scheme } from '../input/InputFrame';
import type { SimWorld } from '../sim/world/SimWorld';
import type { GameEvent } from '../sim/world/types';
import { node, text } from './dom';
export const onboardingKey = 'minor-incident.onboarding.v1';
const lessons = ['move', 'evade', 'interact', 'pickup', 'attack', 'selector', 'second-side', 'vehicle'] as const;
type Lesson = typeof lessons[number];
const descriptions: Record<Lesson, string> = { move: 'Move toward your objective', evade: 'Keep moving to evade infected', interact: 'Stand in the ring to interact', pickup: 'Walk over the weapon to pick it up', attack: 'Use your left action', selector: 'Cycle the selected rack', 'second-side': 'Use your other side', vehicle: 'Stand by the door to enter' };
export class Onboarding {
  readonly element = node('div', 'onboarding-prompt');
  private readonly seen = new Set<Lesson>();
  private readonly completed = new Set<Lesson>();
  private current: Lesson | null = null;
  private storage: Storage | undefined;
  private x = 0;
  private z = 0;
  private startTick = 0;
  private readonly stops: (() => void)[] = [];
  constructor(private readonly world: SimWorld, private readonly bindings: Bindings) {
    this.element.className = 'onboarding hud-panel'; this.element.hidden = true; this.element.setAttribute('role', 'status');
    try { this.storage = localStorage; const saved: unknown = JSON.parse(localStorage.getItem(onboardingKey) ?? '[]'); if (Array.isArray(saved)) for (const value of saved) if (lessons.includes(value)) this.seen.add(value); } catch { /* Fresh session if storage is unavailable. */ }
  }
  clear(): void { for (const stop of this.stops) stop(); this.stops.length = 0; this.current = null; this.element.hidden = true; }
  reset(): void {
    this.clear();
    this.current = null; this.completed.clear(); this.element.hidden = true;
    const player = this.world.entities.get(1); this.x = player?.transform.x ?? 0; this.z = player?.transform.z ?? 0; this.startTick = this.world.tick;
    for (const type of ['interact.completed', 'pickup.collected', 'combat.attack', 'loadout.switched', 'vehicle.entered'] as const) this.stops.push(this.world.events.on(type, this.event, 20));
  }
  private readonly event = (event: GameEvent): void => {
    if (event.type === 'interact.completed') this.completed.add('interact');
    if (event.type === 'pickup.collected') this.completed.add('pickup');
    if (event.type === 'combat.attack' && event.sourceId === 1) { this.completed.add('attack'); if (event.side === 'RIGHT') this.completed.add('second-side'); }
    if (event.type === 'loadout.switched') this.completed.add('selector');
    if (event.type === 'vehicle.entered') this.completed.add('vehicle');
  };
  observe(frame: InputFrame): void {
    const player = this.world.entities.get(1); if (!player) return;
    if (Math.hypot(player.transform.x - this.x, player.transform.z - this.z) > 1) this.completed.add('move');
    if (this.current === 'evade' && this.world.tick - this.startTick > 60 && Math.hypot(frame.move.x, frame.move.z) > .1) this.completed.add('evade');
  }
  private glyph(lesson: Lesson, scheme: Scheme): string {
    if (scheme === 'touch') return lesson === 'move' || lesson === 'evade' ? '◉ Stick' : ['attack', 'second-side'].includes(lesson) ? lesson === 'attack' ? '☝ LEFT' : '☝ RIGHT' : lesson === 'selector' ? 'Swipe up LEFT / RIGHT' : 'ACTION / Stand';
    if (scheme === 'mouse-only' || scheme === 'mouse-keyboard') return lesson === 'move' || lesson === 'evade' ? scheme === 'mouse-only' ? 'Click to move' : 'WASD / Click to move' : lesson === 'attack' ? 'LMB on infected to attack' : lesson === 'second-side' ? 'RMB on infected to attack' : lesson === 'selector' ? 'Q / click slot' : 'Stand / F / MMB';
    return lesson === 'move' || lesson === 'evade' ? this.bindings.keyLabel('moveUp') + this.bindings.keyLabel('moveLeft') + this.bindings.keyLabel('moveDown') + this.bindings.keyLabel('moveRight') : this.bindings.keyLabel(lesson === 'attack' ? 'left' : lesson === 'second-side' ? 'right' : lesson === 'selector' ? 'selector' : 'interact');
  }
  update(scheme: Scheme, playing: boolean): void {
    const level = this.world.missions?.def.id ?? this.world.scenario;
    if (!playing || !level || !/^L[1-6]$/.test(level)) { this.element.hidden = true; return; }
    if (this.world.missions?.def.slice) {
      const mission=this.world.missions, player=this.world.entities.get(1)!;
      if(player.health.current<=0){this.element.hidden=false;this.element.dataset.action='respawn';text(this.element,`You died · Returning to ${mission.state.checkpoint ? mission.state.checkpoint === 'escape' ? 'the diner' : 'the hardware store' : 'the morning'}…`);return;}
      const frame=this.world.inputFrame;
      if(!player.weapons&&(frame.left.down||frame.left.held||frame.right.down||frame.right.held)&&!frame.pointerGround && this.world.tick - this.startTick < 180){this.element.hidden=false;text(this.element,'Run! Find something better at the hardware store.');return;}
      if(mission.state.steps.melee.status==='completed') { this.completed.add('pickup');this.completed.add('interact'); }
      if(this.current==='evade'&&mission.state.steps.escape.status==='completed')this.completed.add('evade');
    }
    if (this.current && this.completed.has(this.current)) { this.current = null; this.startTick = this.world.tick; }
    if (!this.current) {
      const first = level === 'L1' ? 0 : level === 'L2' ? 5 : 7, last = level === 'L1' ? this.world.missions?.def.slice ? 7 : 5 : level === 'L2' ? 7 : 8;
      for (let i = first; i < last; i++) {
        const lesson = lessons[i]; if (this.seen.has(lesson) || this.completed.has(lesson)) continue;
        const player = this.world.entities.get(1)!;
        if (lesson === 'evade') {
          let nearby = false; for (const entity of this.world.entities.iterate()) if (entity.faction === 'infected' && entity.health.current > 0 && Math.hypot(entity.transform.x - player.transform.x, entity.transform.z - player.transform.z) < 12) { nearby = true; break; }
          if (!nearby) break;
        }
        if (lesson === 'interact' && this.world.interactables?.activeId == null && this.world.missions?.def.steps.find(s => this.world.missions!.state.steps[s.id].status === 'active')?.type !== 'interact') break;
        if (lesson === 'pickup') {
          let nearby = false; for (const entity of this.world.entities.iterate()) if (entity.pickup && Math.hypot(entity.transform.x - player.transform.x, entity.transform.z - player.transform.z) < 8) { nearby = true; break; }
          if (!nearby) break;
        }
        if (this.world.missions?.def.slice && lesson === 'selector') { this.completed.add('selector'); continue; }
        if (this.world.missions?.def.slice && ['attack','second-side'].includes(lesson) && !player.weapons) break;
        if (lesson === 'vehicle' && this.world.vehicles?.cars.size === 0) break;
        this.current = lesson; this.seen.add(lesson); this.startTick = this.world.tick;
        try { this.storage?.setItem(onboardingKey, JSON.stringify([...this.seen])); } catch { /* Once per session when storage is disabled. */ }
        break;
      }
    }
    this.element.hidden = !this.current || this.world.tick - this.startTick >= 180;
    if (!this.current) return;
    this.element.dataset.action = this.current; this.element.dataset.scheme = scheme;
    text(this.element, `${this.glyph(this.current, scheme)} · ${descriptions[this.current]}`);
  }
  dispose(): void { this.clear(); this.element.remove(); }
}
