import { afterEach, expect, test, vi } from 'vitest';
import { look } from '../../tools/playtest/eyes';

afterEach(() => vi.unstubAllGlobals());

function renderedEnemy(clip: string, simulationAttacking: boolean) {
  const player = { id: 1, kind: 'player', transform: { x: 0, y: 0, z: 0, yaw: 0 }, health: { current: 100, max: 100 } };
  const enemy = { id: 2, kind: 'infected', faction: 'infected', transform: { x: 1, y: 0, z: 0, yaw: 0 }, health: { current: 60, max: 60 }, combat: { attacking: simulationAttacking } };
  vi.stubGlobal('innerWidth',1280); vi.stubGlobal('innerHeight',720);
  vi.stubGlobal('document', {
    querySelector: (selector: string) => selector === 'canvas' ? { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) } : null,
    querySelectorAll: () => [],
  });
  vi.stubGlobal('window',{ __SS__: {
    tick: () => 10,
    missions: { state: () => ({ id: 'L6', phase: 'playing', steps: { retreat: { status: 'active' } } }) },
    getEntity: () => player,
    query: (filter: { kind?: string }) => filter.kind === 'vehicle' ? [] : [player,enemy],
    crowdFigures: () => [{ id: 2, drawn: true, clip, joints: { hip: [1,0,0], head: [1,1,0] } }],
    input: { visible: () => true, project: () => ({ x: 640, y: 360 }) },
    camera: { project: () => [0,0,0] },
  } });
  return look().enemies[0];
}

test('#99 ally-cover attack observation follows the submitted swing even when the simulation flag is off', () => {
  expect(renderedEnemy('swing',false).attacking).toBe(true);
});

test('#99 an idle rendered figure supplies no attack observation even when the simulation flag is on', () => {
  expect(renderedEnemy('shamble',true).attacking).toBe(false);
});
