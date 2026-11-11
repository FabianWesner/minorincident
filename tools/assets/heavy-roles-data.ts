import type { Role } from './heavy-roles';

/** Role recipes for tools/assets/heavy-roles.ts. Coordinates are in the base figure's rest frame (+X front, +Y up, +Z lateral). */
export const roles: Record<string, Role> = {
  // Brute: the construction-worker infected blown up to a broad, heavy build (x1.3, shoulders and arms much thicker),
  // torn safety-orange vest, rubble growths on both shoulders, reflective bands, oversized fists.
  'inf.brute': {
    id: 'inf.brute', base: 'inf.common-worker', scale: 1.28,
    deform: {
      torso: { sx: 1.45, sy: 1.08, sz: 1.55 }, hip: { sx: 1.3, sy: 1, sz: 1.35 }, head: { sx: .92, sy: .92, sz: .92 },
      armL: { perp: 1.7 }, armR: { perp: 1.7 }, foreArmL: { perp: 1.8 }, foreArmR: { perp: 1.8 }, handL: { sx: 1.9, sy: 1.9, sz: 1.9 }, handR: { sx: 1.9, sy: 1.9, sz: 1.9 },
      legL: { perp: 1.4 }, legR: { perp: 1.4 }, shinL: { perp: 1.35 }, shinR: { perp: 1.35 },
    },
    recolour: [{ parts: ['torso', 'armL', 'armR', 'foreArmL', 'foreArmR'], colour: '#d0561c' }, { parts: ['hip', 'legL', 'legR', 'shinL', 'shinR'], colour: '#3b3a35' }],
    pieces: [
      { joint: 'armL', rel: true, shape: 'sphere', centre: [.45,.85,.85], size: [1.3,.9,.55], colour: '#6d655c' },
      { joint: 'armR', rel: true, shape: 'sphere', centre: [.45,.85,.15], size: [1.3,.9,.55], colour: '#6d655c' },
      { joint: 'torso', rel: true, shape: 'box', centre: [.9,.55,.38], size: [.07,.6,.05], colour: '#e3cc3c', lod: 1 },
      { joint: 'torso', rel: true, shape: 'box', centre: [.9,.55,.62], size: [.07,.6,.05], colour: '#e3cc3c', lod: 1 },
      { joint: 'torso', rel: true, shape: 'cyl', centre: [.85,.08,.5], size: [.1,.12,.5], colour: '#2b2824' },
      { joint: 'torso', rel: true, shape: 'cone', centre: [.12,.88,.3], size: [.16,.3,.16], colour: '#d9d2c2', rot: [0, 0, Math.PI / 2], seg: 5, lod: 1 },
      { joint: 'torso', rel: true, shape: 'cone', centre: [.12,.8,.7], size: [.16,.3,.16], colour: '#d9d2c2', rot: [0, 0, Math.PI / 2], seg: 5, lod: 1 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.2,.9,.5], size: [.45,.4,.75], colour: '#6d655c', lod: 1 },
    ],
    budget: { triangles: 6600, lod1: 2700, lod2: 1000 },
  },
  // Armored: soldier/riot plating, full helmet with dark visor, pauldrons, forearm bracers, shin plates.
  'inf.armored-football': {
    id: 'inf.armored-football', base: 'inf.common-worker', scale: 1.1,
    deform: { torso: { sx: 1.15, sy: 1, sz: 1.2 }, armL: { perp: 1.25 }, armR: { perp: 1.25 }, legL: { perp: 1.15 }, legR: { perp: 1.15 } },
    recolour: [{ parts: ['torso', 'armL', 'armR', 'foreArmL', 'foreArmR'], colour: '#4a5440' }, { parts: ['hip', 'legL', 'legR', 'shinL', 'shinR'], colour: '#33362c' }],
    pieces: [
      { joint: 'head', rel: true, shape: 'sphere', centre: [.45,.7,.5], size: [1.08,.72,1.1], colour: '#58626a', seg: 10 },
      { joint: 'head', rel: true, shape: 'box', centre: [.88,.58,.5], size: [.2,.12,.8], colour: '#16191c' },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.82,.62,.5], size: [.34,.64,.82], colour: '#343a3f', seg: 10 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.85,.62,.5], size: [.35,.55,.7], colour: '#6e7880', seg: 10 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.12,.62,.5], size: [.3,.55,.65], colour: '#6e7880', seg: 8, lod: 1 },
      { joint: 'torso', rel: true, shape: 'cyl', centre: [.5,.12,.5], size: [1.04,.12,1.04], colour: '#3a3f44', lod: 1 },
      { joint: 'armL', rel: true, shape: 'sphere', centre: [.5,.88,.85], size: [1.0,.62,.45], colour: '#6e7880' },
      { joint: 'armR', rel: true, shape: 'sphere', centre: [.5,.88,.15], size: [1.0,.62,.45], colour: '#6e7880' },
      { joint: 'shinL', rel: true, shape: 'sphere', centre: [.95,.8,.5], size: [.4,.3,.8], colour: '#6e7880', lod: 1 },
      { joint: 'shinR', rel: true, shape: 'sphere', centre: [.95,.8,.5], size: [.4,.3,.8], colour: '#6e7880', lod: 1 },
    ],
    budget: { triangles: 6800, lod1: 2700, lod2: 1050 },
  },
  // Butcher: the apron cook scaled up into a hulking meat-cutter: bloody butcher's apron over the grill apron, chef's
  // cap, huge fists, a cleaver in the right hand.
  'inf.butcher': {
    id: 'inf.butcher', base: 'inf.bbq-dad', scale: 1.32, drop: ['bbq_spatula', 'apron_text_decal'],
    deform: { torso: { sx: 1.12, sy: 1.05, sz: 1.18 }, armL: { perp: 1.3 }, armR: { perp: 1.3 }, foreArmL: { perp: 1.3 }, foreArmR: { perp: 1.3 }, handL: { sx: 1.5, sy: 1.5, sz: 1.5 }, handR: { sx: 1.5, sy: 1.5, sz: 1.5 } },
    recolour: [{ parts: ['hip', 'legL', 'legR', 'shinL', 'shinR'], colour: '#5a3a2a' }],
    pieces: [
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.97,.62,.35], size: [.12,.35,.3], colour: '#8a1414', seg: 6 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.97,.35,.7], size: [.12,.3,.28], colour: '#8a1414', seg: 6, lod: 1 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.97,.2,.4], size: [.12,.2,.3], colour: '#a82020', seg: 6, lod: 1 },
      { joint: 'head', rel: true, shape: 'cyl', centre: [.45,.9,.5], size: [.95,.3,.95], colour: '#e6e0d2', seg: 10 },
      { joint: 'head', rel: true, shape: 'cyl', centre: [.45,1.06,.5], size: [1.1,.12,1.1], colour: '#e6e0d2', seg: 10, lod: 1 },
      { joint: 'handR', rel: true, shape: 'box', centre: [1.1,.5,.5], size: [1.7,.4,.5], colour: '#3b2a1e' },
      { joint: 'handR', rel: true, shape: 'box', centre: [2.2,.4,.5], size: [1.5,1.1,.2], colour: '#9aa2a8' },
      { joint: 'handR', rel: true, shape: 'box', centre: [2.9,.2,.5], size: [.5,.3,.3], colour: '#8a1414', lod: 1 },
    ],
    budget: { triangles: 6200, lod1: 2600, lod2: 2600 },
  },
  // Screamer: the thin nurse stretched, pale hospital gown, jaw hanging wide open on a dark cavity, long arms.
  'inf.screamer': {
    id: 'inf.screamer', base: 'inf.nurse', scale: 1.16, tolerance: .25,
    deform: { torso: { sx: .88, sy: 1.08, sz: .84 }, armL: { perp: .8, axial: 1.15 }, armR: { perp: .8, axial: 1.15 }, foreArmL: { perp: .8, axial: 1.2 }, foreArmR: { perp: .8, axial: 1.2 }, legL: { perp: .85 }, legR: { perp: .85 } },
    jaw: { drop: .075, forward: .01, mouthDy: -.07, widthDz: .12 },
    recolour: [{ parts: ['torso', 'armL', 'armR', 'foreArmL', 'foreArmR'], colour: '#d6d1c3' }, { parts: ['hip', 'legL', 'legR', 'shinL', 'shinR'], colour: '#cfcabc' }],
    pieces: [
      { joint: 'head', rel: true, shape: 'sphere', centre: [.68,.2,.5], size: [.45,.4,.55], colour: '#2a080b', seg: 8 },
      { joint: 'head', rel: true, shape: 'cone', centre: [.8,.36,.4], size: [.1,.12,.1], colour: '#ece6d6', rot: [Math.PI, 0, 0], seg: 4, lod: 1 },
      { joint: 'head', rel: true, shape: 'cone', centre: [.8,.36,.6], size: [.1,.12,.1], colour: '#ece6d6', rot: [Math.PI, 0, 0], seg: 4, lod: 1 },
    ],
    budget: { triangles: 6300, lod1: 2600, lod2: 900 },
  },
  // Bloated: the bathrobe neighbour with a hugely swollen belly, boils and pustules in sick yellow-green.
  'inf.bloated': {
    id: 'inf.bloated', base: 'inf.cashier', scale: 1.18, tolerance: .35,
    deform: { armL: { perp: 1.25 }, armR: { perp: 1.25 }, legL: { perp: 1.2 }, legR: { perp: 1.2 } },
    bulge: { relativeToHip: true, centre: [-.06, .12, 0], radius: .62, amount: .27, joints: ['torso', 'hip'] },
    recolour: [{ parts: ['torso', 'armL', 'armR', 'foreArmL', 'foreArmR'], colour: '#a8a36a' }, { parts: ['hip', 'legL', 'legR', 'shinL', 'shinR'], colour: '#6b6a55' }],
    pieces: [
      { joint: 'torso', rel: true, shape: 'sphere', centre: [1.0,.5,.35], size: [.24,.2,.24], colour: '#b9c35a', seg: 6 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [1.0,.3,.7], size: [.2,.17,.2], colour: '#8c5a78', seg: 6 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.95,.72,.6], size: [.18,.15,.18], colour: '#b9c35a', seg: 6 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.9,.12,.25], size: [.2,.16,.2], colour: '#8c5a78', seg: 6, lod: 1 },
      { joint: 'torso', rel: true, shape: 'sphere', centre: [.15,.6,.3], size: [.22,.18,.22], colour: '#b9c35a', seg: 6, lod: 1 },
      { joint: 'armR', rel: true, shape: 'sphere', centre: [.5,.5,.5], size: [.5,.5,.4], colour: '#b9c35a', seg: 5, lod: 1 },
    ],
    budget: { triangles: 6800, lod1: 2900, lod2: 2900 },
  },
};
