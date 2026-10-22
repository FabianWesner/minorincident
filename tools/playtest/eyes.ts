/**
 * What the playtest driver "sees" each decision, gathered in one page round trip.
 *
 * Player-visible (allowed every decision): HUD objective text, tracker distance, the on-screen objective
 * ring/arrow (DOM marker position), prompts, the mission panel button, health, and bodies that are on
 * screen (the player sees them). Mission state is read only for the phase / step id (what the HUD already
 * tells the player) so the log can name steps; it is never used to find a trigger.
 * Ground-truth state used to locate the player when lost goes through `locate()` and is always logged.
 */
export interface Body { id: number; x: number; z: number; hp: number; max: number; d: number; kind: string; drawn: boolean; screen: { x: number; y: number }; aim: { x: number; y: number }; moving: boolean; speed: number; yaw: number; vx: number; vz: number; corpse: boolean; state?: string; attacking?: boolean }
export interface Eyes {
  tick: number; level: string | null; phase: string | null; step: string | null; checkpoint: string | null; completed: number;
  objective: string; tracker: string; distance: number | null;
  marker: { visible: boolean; offscreen: boolean; x: number; y: number; anchor: string | null } | null;
  panel: { visible: boolean; heading: string; button: string | null };
  menu: string | null; loading: boolean; prompt: string; subtitle: string;
  player: { x: number; y: number; z: number; hp: number; max: number; riding: boolean; weapons: string[]; current: string | null } | null;
  driving: { id: number; x: number; z: number; yaw: number } | null;
  enemies: Body[]; allies: Body[];
  view: { w: number; h: number };
}

export function visibleGroupTarget(level: string | null, player: { x: number; z: number }, allies: { x: number; z: number; hp: number; drawn: boolean; corpse: boolean; kind?: string }[], leash = 8, step?: string | null): { x: number; z: number } | null {
  if (level !== 'L7' && !(level === 'L6' && (step === 'retreat' || step === 'exit'))) return null;
  const group = allies.filter(a => a.drawn && a.hp > 0 && !a.corpse && a.kind !== 'companion');
  if (!group.length) return null;
  const centre = group.reduce((p, a) => ({ x: p.x + a.x / group.length, z: p.z + a.z / group.length }), { x: 0, z: 0 });
  return Math.hypot(player.x - centre.x, player.z - centre.z) > leash ? centre : null;
}

/** Runs in the page. Keep it self-contained (no closures). */
export function look(): Eyes {
  const a = window.__SS__!;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`);
  const shown = (el: HTMLElement | null) => !!el && !el.hidden && el.offsetParent !== null;
  const m = a.missions.state();
  const active = m ? Object.entries(m.steps).find(([, s]) => s.status === 'active')?.[0] ?? null : null;
  const tracker = q('mission-tracker');
  const objective = q('objective-text');
  const ringPrompt = shown(q('interaction-ring')) ? q('interaction-ring')!.textContent ?? 'ring' : '';
  const trackerPrompt = shown(objective) ? objective!.textContent ?? '' : shown(tracker) ? tracker!.textContent ?? '' : '';
  const markerEl = q('mission-marker');
  const panel = q('mission-panel'), button = q<HTMLButtonElement>('mission-button');
  const menu = [...document.querySelectorAll<HTMLElement>('[data-menu-screen]')].find(el => !el.hidden)?.dataset.menuScreen ?? null;
  const p = a.getEntity(1);
  const view = { w: innerWidth, h: innerHeight };
  const vehicles = p ? a.query({ kind: 'vehicle', within: { x: p.transform.x, z: p.transform.z, r: 6 } }) : [];
  const car = vehicles.find(v => v.vehicle?.driver === 1);
  const enemies: Body[] = [], allies: Body[] = [];
  const figures = new Map(a.crowdFigures().filter(f => f.drawn).map(f => [f.id, f]));
  const rect = document.querySelector('canvas')!.getBoundingClientRect();
  if (p) {
    const near = a.query({ within: { x: p.transform.x, z: p.transform.z, r: 32 } });
    for (const e of near) {
      if (e.id === 1 || e.hidden) continue;
      // L6's community keeps its civilian faction while following the retreat; these are visible human allies too.
      const ally = e.faction === 'survivor' || e.faction === 'escort' || !!e.companion || !!e.escort || m?.id === 'L6' && !!e.civilian && e.faction !== 'infected';
      const enemy = e.faction === 'infected' && !e.emerging && !e.infectionRise;
      if (!ally && !enemy) continue;
      if (enemy && (e.corpse || e.health.current <= 0)) continue;
      if (!a.input.visible(e.transform)) continue;
      const s = a.input.project(e.transform, 'player');
      const joints = figures.get(e.id)?.joints;
      if (enemy && !joints) continue;
      // Aim at the drawn chest, including a lunge or a fall. A fixed offset above the feet misses bodies
      // at different zooms and can become a ground click; only rendered, on-screen enemies are targets.
      let aim = { x: s.x, y: s.y - 18 };
      if (joints?.hip && joints.head) {
        const at = joints.hip.map((v, i) => v + (joints.head[i] - v) * .6), ndc = a.camera.project(at[0], at[1], at[2]);
        aim = { x: rect.left + (ndc[0] + 1) / 2 * rect.width, y: rect.top + (1 - ndc[1]) / 2 * rect.height };
      }
      if (aim.x < 0 || aim.x >= view.w || aim.y < 44 || aim.y >= view.h) continue;
      const b: Body = { id: e.id, x: e.transform.x, z: e.transform.z, hp: e.health.current, max: e.health.max, d: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), kind: e.kind, drawn: figures.has(e.id), screen: s, aim,
        moving: !!e.motion?.moving, speed: e.motion?.speed ?? 0, yaw: e.transform.yaw, vx: e.motion?.velocity.x ?? 0, vz: e.motion?.velocity.z ?? 0, corpse: !!e.corpse,
        state: e.infected?.state ?? e.escort?.state ?? e.companion?.state ?? e.civilian?.state, attacking: /^(windup|swing|dog-lunge-bite|zebra-rear-kick)$/.test(figures.get(e.id)?.clip ?? '') };
      (enemy ? enemies : allies).push(b);
    }
    enemies.sort((l, r) => l.d - r.d);
  }
  const weapons = p?.weapons ? (['LEFT', 'RIGHT'] as const).flatMap(side => p.weapons![side].rack.map(slot => slot.id)) : [];
  const selected = p?.weapons?.[p.weapons.selectedSide];
  const current = selected ? (selected.index === -1 ? selected.unarmed : selected.rack[selected.index])?.id ?? null : null;
  const left = markerEl ? parseFloat(markerEl.style.left) : NaN, top = markerEl ? parseFloat(markerEl.style.top) : NaN;
  return {
    tick: a.tick(), level: m?.id ?? null, phase: m?.phase ?? null, step: active, checkpoint: m?.checkpoint ?? null,
    completed: m ? Object.values(m.steps).filter(s => s.status === 'completed').length : 0,
    objective: q('objective-text')?.textContent ?? '', tracker: shown(tracker) ? tracker!.textContent ?? '' : '',
    distance: tracker?.dataset.distance ? Number(tracker.dataset.distance) : null,
    marker: markerEl && Number.isFinite(left) ? { visible: shown(markerEl), offscreen: markerEl.dataset.offscreen === 'true', x: left, y: top, anchor: markerEl.dataset.anchor ?? null } : null,
    panel: { visible: shown(panel), heading: q('mission-heading')?.textContent ?? '', button: button && shown(button) ? button.textContent : null },
    menu, loading: shown(q('menu-loading')) || shown(q('level-transition')),
    prompt: ringPrompt || (trackerPrompt.includes('Press E or tap the console action') ? trackerPrompt : ''),
    subtitle: shown(q('mission-subtitle')) ? q('mission-subtitle')!.textContent ?? '' : '',
    player: p ? { x: p.transform.x, y: p.transform.y, z: p.transform.z, hp: p.health.current, max: p.health.max, riding: !!p.riding || !!p.passengerOf, weapons, current } : null,
    driving: car ? { id: car.id, x: car.transform.x, z: car.transform.z, yaw: car.transform.yaw } : null,
    enemies, allies, view,
  };
}
