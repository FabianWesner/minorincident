import { expect, test } from 'vitest';
import { canCoverVisibleAllies, fistsRetreatAttack, keepMovingWithFists, prioritizeAllyThreat } from '../../tools/playtest/combat';

test('#99 one or two close infected must not plant the fists courier during the moving retreat', () => {
  expect(keepMovingWithFists('L6', 'retreat', true, 1)).toBe(true);
  expect(keepMovingWithFists('L6', 'exit', true, 2)).toBe(true);
});

test('#99 shelter defence and carried weapons retain their combat decisions', () => {
  expect(keepMovingWithFists('L6', 'shelter', true, 1)).toBe(false);
  expect(keepMovingWithFists('L6', 'stop', true, 3)).toBe(true);
  expect(keepMovingWithFists('L6', 'retreat', false, 3)).toBe(false);
  expect(keepMovingWithFists('L7', 'corridor', true, 3)).toBe(false);
});

test('#99 a close crowd permits the shipped right-hand kick while walking, rather than planting the courier', () => {
  expect(fistsRetreatAttack(1)).toBe('KeyJ');
  expect(fistsRetreatAttack(2)).toBe('KeyJ');
  expect(fistsRetreatAttack(3)).toBe('KeyK');
  expect(fistsRetreatAttack(14)).toBe('KeyK');
});

test('#99 fists movement preserves the existing low-health kite policy', () => {
  expect(keepMovingWithFists('L6','retreat',true,1,.29)).toBe(false);
  expect(keepMovingWithFists('L6','retreat',true,14,.2)).toBe(false);
  expect(keepMovingWithFists('L6','retreat',true,1,.3)).toBe(true);
});

test('#99 the unarmed driver covers visible allies during the shelter fight, then follows the retreat ring', () => {
  const ally = { drawn: true, hp: 20, corpse: false };
  expect(canCoverVisibleAllies('L6','shelter',true,ally)).toBe(true);
  expect(canCoverVisibleAllies('L6','stop',true,ally)).toBe(true);
  expect(canCoverVisibleAllies('L6','retreat',true,ally)).toBe(false);
  expect(canCoverVisibleAllies('L7','corridor',true,ally)).toBe(false);
  expect(canCoverVisibleAllies('L6','retreat',false,ally)).toBe(true);
});

test('#99 fists ally cover requires a visible living actor', () => {
  const ally = { drawn: true, hp: 20, corpse: false };
  expect(canCoverVisibleAllies('L6','shelter',true,{...ally,drawn:false})).toBe(false);
  expect(canCoverVisibleAllies('L6','shelter',true,{...ally,hp:0})).toBe(false);
  expect(canCoverVisibleAllies('L6','shelter',true,{...ally,corpse:true})).toBe(false);
});

test('#99 fists cover the attacked ally before chasing a closer isolated infected', () => {
  const nearby = { id: 1 }, attackingAlly = { id: 2 };
  expect(prioritizeAllyThreat(true,nearby,attackingAlly)).toBe(attackingAlly);
  expect(prioritizeAllyThreat(true,nearby,undefined)).toBe(nearby);
  expect(prioritizeAllyThreat(true,undefined,attackingAlly)).toBe(attackingAlly);
  expect(prioritizeAllyThreat(false,nearby,attackingAlly)).toBe(nearby);
});

test('#99 fists defend visible allies when the retreat HUD asks for rear cover', () => {
  const ally = { drawn: true, hp: 20, corpse: false };
  expect(canCoverVisibleAllies('L6','retreat',true,ally,'The group waits: cover the rear from the infected · 4 m')).toBe(true);
  expect(canCoverVisibleAllies('L6','retreat',true,ally,'Stay with the group · 3 m')).toBe(true);
  expect(canCoverVisibleAllies('L6','retreat',true,{...ally,drawn:false},'Stay with the group · 3 m')).toBe(false);
  expect(canCoverVisibleAllies('L6','retreat',true,ally,'Cover the retreat through the tunnel · 4 m')).toBe(false);
  expect(canCoverVisibleAllies('L7','corridor',true,ally,'Stay with the group · 3 m')).toBe(false);
});

test('#99 fists still cover the visible trailing survivor when the exit HUD asks to stay with the group', () => {
  const ally = { drawn: true, hp: 20, corpse: false };
  expect(canCoverVisibleAllies('L6','exit',true,ally,'Stay with the group · 5 m')).toBe(true);
  expect(canCoverVisibleAllies('L6','exit',true,{...ally,drawn:false},'Stay with the group · 5 m')).toBe(false);
  expect(canCoverVisibleAllies('L6','exit',true,ally,'Bring the survivors into the night · 0/1 out · 15 m')).toBe(false);
});
