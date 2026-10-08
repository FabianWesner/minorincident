"""decay.rubble-pile: a low heap of blast/fire debris (plaster and brick lumps, broken wall slabs, charred beams).

First used by the L1 -> L2 continuity (the blown-out Medical Annex forecourt). Footprint about 2.4 x 1.4 m, 0.85 m high,
+X front, Z up. Solid closed primitives at every tier; LODs drop small lumps and beam splinters, never thin the heap.
Budgets: LOD0 <= 1500, LOD1 <= 600, LOD2 <= 200 triangles.
"""
import math
import random
from pathlib import Path
import json
from mathutils import Matrix, Vector
import bpy
from .rescue_assets import Scene, finish

SEED = 4417
LIMITS = (1500, 600, 200)


def lump(s, name, center, radius, token, rng, flat=.62):
    c = Vector(center)
    r = [radius * (.75 + rng.random() * .5) for _ in range(6)]
    pts = [Vector((r[0], 0, 0)), Vector((-r[1], 0, 0)), Vector((0, r[2], 0)), Vector((0, -r[3], 0)), Vector((0, 0, r[4] * flat)), Vector((0, 0, -r[5] * flat * .35))]
    rot = Matrix.Rotation(rng.random() * math.tau, 3, 'Z') @ Matrix.Rotation((rng.random() - .5) * .6, 3, 'X')
    vs = [tuple(c + rot @ p) for p in pts]
    fs = [(4, 0, 2), (4, 2, 1), (4, 1, 3), (4, 3, 0), (5, 2, 0), (5, 1, 2), (5, 3, 1), (5, 0, 3)]
    return s.mesh(name, vs, fs, token)


def slab(s, name, center, size, yaw, tilt, token):
    obj = s.box(name, center, size, token)
    obj.rotation_euler = (tilt, 0, yaw)
    return obj


def recipe(s):
    L, rng = s.lod, random.Random(SEED)
    # Core mound: a few large lumps so the silhouette is a heap at every distance.
    core = [((-.35, 0, .22), .62, 'pantsCargo'), ((.45, .1, .2), .55, 'asphalt'), ((-.05, -.25, .34), .5, 'uiDark'),
            ((.9, -.3, .14), .38, 'argyleGrey'), ((-.95, .25, .13), .4, 'brick')]
    for i, (c, r, t) in enumerate(core):
        lump(s, f'core{i}', c, r, t, rng)
    # Broken wall slabs (plaster with a sooted face) leaning on the mound.
    slab(s, 'slabA', (-.2, .32, .32), (1.0, .07, .55), math.radians(14), math.radians(-38), 'pantsCargo')
    slab(s, 'slabB', (.55, -.38, .26), (.75, .06, .45), math.radians(-24), math.radians(46), 'asphalt')
    if L < 2:
        slab(s, 'slabC', (-.85, -.35, .12), (.6, .05, .32), math.radians(60), math.radians(70), 'uiDark')
    # Charred beams across the heap.
    s.beam('beamA', (-1.15, -.2, .08), (.85, .42, .55), .1, 'leather')
    s.beam('beamB', (1.15, -.45, .06), (-.1, .28, .5), .09, 'uiDark')
    if L == 0:
        s.beam('beamSplinter', (.2, .5, .3), (.55, .62, .05), .045, 'leather')
        s.beam('rebar', (-.6, -.5, .05), (-.1, -.15, .55), .018, 'asphalt')
    # End lumps fix the footprint at every tier (LOD bounds must match LOD0 within 10 %).
    lump(s, 'endW', (-1.28, .12, .07), .17, 'brick', random.Random(SEED + 1), .7)
    lump(s, 'endE', (1.3, -.18, .06), .16, 'argyleGrey', random.Random(SEED + 2), .7)
    lump(s, 'endN', (.1, .66, .05), .13, 'uiDark', random.Random(SEED + 3), .7)
    lump(s, 'endS', (-.2, -.68, .05), .13, 'asphalt', random.Random(SEED + 4), .7)
    # Scattered small lumps (brick, plaster, char) around the foot.
    count = (18, 8, 0)[L]
    for k in range(count):
        a = rng.random() * math.tau
        r = .7 + rng.random() * .35
        c = (math.cos(a) * r * 1.15, math.sin(a) * r * .62, .06)
        lump(s, f'bit{k}', c, .08 + rng.random() * .09, ['brick', 'argyleGrey', 'uiDark', 'asphalt'][k % 4], rng, .7)
    s.physics('fixed', 0, wood=True)


def build_rubble(directory):
    directory = Path(directory)
    stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s = Scene('decay.rubble-pile', lod)
        recipe(s)
        out = directory / ('model' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb')
        stats['lod' + str(lod)] = finish(s, out)
        if stats['lod' + str(lod)]['triangles'] > LIMITS[lod]:
            raise ValueError(f"decay.rubble-pile LOD{lod}: {stats['lod' + str(lod)]['triangles']} triangles > {LIMITS[lod]}")
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print('OK rubble', json.dumps(stats))
    return stats
