import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';
import { cureRecordingText } from '../../../src/data/megaPresentation';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { installMegaPursuit } from '../../../src/sim/ai/MegaPursuit';
import type { GameEvent } from '../../../src/sim/world/types';

test('T-E32-13-schedule @E32-AC13 sim-time roar/impact, steps <60m, checkpoint timing and death', async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadScenario('mega-course', 10); w.combat!.damage.god = true;
    const p = installMegaPursuit(w, { introduceTick: null, resident: () => false });
    p.introduce({ x: -250, z: 0 });
    const cues: Extract<GameEvent, { type: 'mega.cue' }>[] = [];
    w.events.on('mega.cue', e => { if (e.type === 'mega.cue') cues.push(e); });
    for (let tick = 0; tick < 7200; tick++) { p.entity()!.transform.x = -250; w.update(); }
    const roars = cues.filter(c => c.kind === 'roar'); expect(roars.length).toBeGreaterThan(3);
    for (let i = 1; i < roars.length; i++) expect(roars[i].tick - roars[i-1].tick).toBeGreaterThanOrEqual(1200);
    for (let i = 1; i < roars.length; i++) expect(roars[i].tick - roars[i-1].tick).toBeLessThanOrEqual(2100);
    expect(cues.filter(c => c.kind === 'impact').length).toBe(roars.length);
    expect(cues.every(c => c.band === 'distant' && !('position' in c))).toBe(true);
    for (const [distance, band] of [[250,'distant'],[200,'approaching'],[120,'approaching'],[80,'approaching'],[79.9,'near'],[40,'near']] as const) {
      p.entity()!.transform.x = -distance; expect(p.band()).toBe(band); expect(p.distance()).toBeCloseTo(distance);
    }
    p.entity()!.transform.x = -250;
    const saved = p.snapshot(); w.tick += 100; p.restore(saved);
    expect(p.state.audio!.next).toBe(saved.audio!.next + 100);
    p.entity()!.transform.x = -40; p.state.audio!.step = w.tick;
    w.update(); expect(cues.at(-1)).toMatchObject({ kind: 'step', band: 'near' });
    const steps = cues.filter(c=>c.kind==='step').length;
    for(let i=0;i<49;i++)w.update();
    expect(p.state.mode).toBe('coarse');expect(p.entity()!.locomotion!.vx).toBe(0);
    expect(cues.filter(c=>c.kind==='step').length).toBeGreaterThan(steps);
    p.entity()!.transform.x = -60; p.state.audio!.step = w.tick; const n = cues.length; w.update(); expect(cues.length).toBe(n);
    p.entity()!.health.current = 0; p.entity()!.infected!.recoverAt = -1; w.update();
    expect(p.band()).toBe(null); const deadCount = cues.length;
    for (let i=0;i<2200;i++) w.update(); expect(cues.length).toBe(deadCount);
  } finally { w.dispose(); }
});

test('T-E32-15-terminal @E32-AC15 existing radio action shows all research facts for 14 seconds without audio', async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadScenario('mission-sandbox'); const def=missionSandbox('custom'); def.onStart=[{kind:'radio',id:'L10.research'}];
    const events: GameEvent[]=[];w.events.on('dialogue.line',e=>events.push(e));
    const mission=w.loadMission(def);mission.begin();
    expect(mission.state.subtitle).toMatchObject({text:cureRecordingText,until:w.tick+840});
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({type:'dialogue.line',id:'L10.research'});
    for(let i=0;i<839;i++)w.update();expect(mission.state.subtitle?.text).toBe(cureRecordingText);
    w.update();expect(mission.state.subtitle).toBe(null);
  } finally {w.dispose();}
});
