import { expect, test } from 'vitest';
import { PlaytestProgress, type ProgressSample } from '../../tools/playtest/progress';

const sample = (seconds:number, fields:Partial<ProgressSample> = {}):ProgressSample => ({ context:'L6|retreat',text:'Cover the retreat · 12 m',distance:12,player:{x:0,z:15},marker:{x:12,z:15},tick:seconds*60,nowMs:seconds*1000,...fields });

test('#99 following a moving visible ring is progress even when its distance stays 12 m', () => {
  const p=new PlaytestProgress();p.update(sample(0));
  for(let t=1;t<=45;t++) {
    const result=p.update(sample(t,{player:{x:t*2.2,z:15},marker:{x:t*2.2+12,z:15}}));
    expect(result.seconds).toBeLessThan(2);
  }
});

test('#99 a stationary courier cannot gain progress just because the marker moves', () => {
  const p=new PlaytestProgress();p.update(sample(0));
  expect(p.update(sample(31,{marker:{x:80,z:15}})).seconds).toBe(31);
});

test('#99 oscillating player/marker positions cannot hide a 30 second navigation loop', () => {
  const p=new PlaytestProgress();p.update(sample(0));
  p.update(sample(1,{player:{x:3,z:15},marker:{x:15,z:15}}));
  for(let t=2;t<=35;t++) p.update(sample(t,{player:{x:t%2?3:0,z:15},marker:{x:t%2?15:12,z:15}}));
  expect(p.update(sample(36)).seconds).toBeGreaterThan(30);
});

test('#99 visible countdowns progress, while a static zero-distance bring objective stays detectable', () => {
  const p=new PlaytestProgress();p.update(sample(0,{text:'Wait for the breach · 42 s'}));
  expect(p.update(sample(10,{text:'Wait for the breach · 32 s'})).seconds).toBe(0);
  p.update(sample(11,{text:'Bring the injured survivor · 0 m',distance:0}));
  expect(p.update(sample(42,{text:'Bring the injured survivor · 0 m',distance:0})).seconds).toBe(31);
});

test('#99 moving away and back toward a static marker does not beat its previous best distance', () => {
  const p=new PlaytestProgress();p.update(sample(0,{distance:30}));
  p.update(sample(1,{distance:25}));
  p.update(sample(10,{distance:30}));
  expect(p.update(sample(32,{distance:25})).seconds).toBe(31);
});

test('#99 a visible checkpoint reposition starts a fresh movement observation', () => {
  const p=new PlaytestProgress();p.update(sample(0,{player:{x:50,z:15},marker:{x:62,z:15}}));
  p.update(sample(10,{player:{x:72,z:15},marker:{x:84,z:15}}));
  expect(p.update(sample(10.1,{player:{x:2,z:15},marker:{x:14,z:15}})).reason).toBe('view-change');
  for(let t=1;t<=35;t++) expect(p.update(sample(10.1+t,{player:{x:2+t*2.2,z:15},marker:{x:14+t*2.2,z:15}})).seconds).toBeLessThan(2);
});

test('#99 a cached pre-death ring cannot poison progress after the visible player respawns', () => {
  const p=new PlaytestProgress();p.update(sample(0,{player:{x:83,z:15},marker:{x:92.4,z:17.3},distance:9.7}));
  expect(p.update(sample(.1,{player:{x:2.1,z:-.3},marker:{x:92.4,z:17.3},distance:15.8})).reason).toBe('view-change');
  p.update(sample(1,{player:{x:5.5,z:2.6},marker:{x:6,z:15},distance:12.4}));
  p.update(sample(4,{player:{x:6,z:15},marker:{x:6,z:15},distance:0}));
  for(let t=5;t<=45;t++) {
    const x=6+(t-4)*2.2;
    expect(p.update(sample(t,{player:{x,z:15},marker:{x:x+12,z:15},distance:12})).seconds).toBeLessThan(3);
  }
});
