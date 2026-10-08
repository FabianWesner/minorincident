"""Burned, broken standing frontages (brick, diner; house via burned_ruins.py), explicit 1500/600/200 tiers.

Masonry is built from real prisms: jagged collapsed parapets, open window holes with a dark
interior, charred lintels with a soot gradient, tattered slat awnings and rubble on the pavement.
"""
import json
import math
import random
from pathlib import Path
import bpy
import bmesh
from .rescue_assets import Scene, finish
from . import palette, export

FRONT = .04   # wall front face (x); the wall is .44 thick behind it
BACK = -.40
REMAP = {}   # per-asset palette folding keeps every tier within 8 materials


def prism(s, name, profile, x0, x1, token):
    """Extrude a (y,z) polygon between x0 (back) and x1 (front)."""
    n = len(profile)
    vs = [(x1, y, z) for y, z in profile] + [(x0, y, z) for y, z in profile]
    fs = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    fs += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    obj = s.mesh(name, vs, fs, REMAP.get(token, token))
    bm = bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
    return obj


def cube(s, name, pos, size, token, rot=(0, 0, 0)):
    o = s.box(name, pos, size, REMAP.get(token, token))
    for m in list(o.modifiers): o.modifiers.remove(m)
    o.rotation_euler = rot
    return o


def stair(y0, y1, heights, zlow):
    """Broken top edge: equal-width columns; a (left,right) tuple makes a diagonal break."""
    w = (y1 - y0) / len(heights)
    pts = [(y0, zlow)]
    for i, h in enumerate(heights):
        ya, yb = y0 + i * w, y0 + (i + 1) * w
        pts += [(ya, h[0]), (yb, h[1])] if isinstance(h, tuple) else [(ya, h), (yb, h)]
    pts.append((y1, zlow))
    return pts


def flat(heights, lod):
    return [(h[0] + h[1]) / 2 if isinstance(h, tuple) and lod else h for h in heights]


def recipe(asset, lod):
    if asset.endswith('house'):
        from .burned_ruins import house
        return house(Scene(asset, lod))
    s = Scene(asset, lod); s.protected = set(); diner = asset.endswith('diner')
    REMAP.clear()
    REMAP.update({'asphalt': 'leather', 'leatherShadow': 'uiDark', 'survivorRed': 'brick'} if not diner else {'asphalt': 'leather', 'leatherShadow': 'uiDark', 'khakiSeam': 'leather', 'redDark': 'redShadow'})
    rnd = random.Random(11 if diner else 7)
    masonry = 'sidewalk' if diner else 'brick'
    dark = 'leatherShadow' if diner else 'redDark'
    L = lod
    s.box('pavement', (0, 0, .10), (1.25, 4.4, .20), 'sidewalk')
    if L == 0:
        for y in (-1.1, .3, 1.5):
            cube(s, 'slabSeam', (0, y, .205), (1.25, .035, .02), 'asphalt')
    zl, zh = .90, 2.90
    W = [(-1.70, 0.0), (.58, 1.55)]
    prism(s, 'base', [(-2.2, .2), (-2.2, zl), (2.2, zl), (2.2, .2)], BACK, FRONT, masonry if not diner else 'brick')
    # piers beside and between the openings, each with a broken top
    left = [(3.15, 3.55), 3.95, (3.7, 3.3), 3.2] if not diner else [2.9, (3.0, 3.35), 3.05]
    mid = [3.05, (3.3, 3.1), 2.95] if not diner else [3.0, 3.2, 2.95]
    right = [3.3, (3.5, 4.17), 4.17, (4.17, 3.8)] if not diner else [3.1, (3.2, 3.55), 3.2]
    if L == 1: left, right = left[:3], right[:3]
    if L == 2: left, mid, right = [3.5], [3.0], [3.7] if not diner else [3.3]
    prism(s, 'pierL', stair(-2.2, W[0][0], flat(left, L == 2), zl), BACK, FRONT, masonry)
    prism(s, 'pierM', stair(W[0][1], W[1][0], flat(mid, L == 2), zl), BACK, FRONT, masonry)
    prism(s, 'pierR', stair(W[1][1], 2.2, flat(right, L == 2), zl), BACK, FRONT, masonry)
    # header over the openings: collapsed in the middle, tall remnant on the left
    hs = [(3.75, 3.45), 3.6, 3.15, (3.05, 3.4), 3.55, 3.25] if not diner else [3.3, (3.35, 3.1), 3.05, 3.25, (3.2, 3.4), 3.15]
    if L == 1: hs = [hs[0], hs[2], hs[3], hs[4]]
    if L == 2: hs = [hs[0], hs[3]]
    prism(s, 'header', stair(W[0][0], W[1][1], flat(hs, L == 2), zh), BACK, FRONT, masonry)
    # dark interior: the openings are real holes through the wall
    cube(s, 'interior', (BACK + .015, (W[0][0] + W[1][1]) / 2, (zl + zh) / 2), (.03, W[1][1] - W[0][0], zh - zl), 'uiDark')
    for a, b in (W if L < 2 else []):
        cube(s, 'revealSoot', (-.2, (a + b) / 2, zh - .06), (.4, b - a, .12), 'uiDark')
    if L == 0:
        cube(s, 'innerRubble', (-.22, -.9, zl + .15), (.32, .9, .3), 'leather', rot=(0, 0, .2))
        cube(s, 'innerRubble', (-.2, 1.1, zl + .12), (.3, .6, .24), 'redShadow', rot=(0, 0, -.3))
    # charred lintel beams, one with a broken end hanging down
    for a, b in ((W[0][0] - .08, W[0][1] + .1), (W[1][0] - .05, W[1][1] + .08))[:2 if L < 2 else 1]:
        cube(s, 'lintel', (FRONT + .05, (a + b) / 2, zh + .09), (.14, b - a, .18), 'uiDark')
    if L == 0:
        cube(s, 'lintelBroken', (FRONT + .06, -.9, zh - .10), (.1, .7, .1), 'leather', rot=(.35, 0, 0))
    # burnt frame posts, mullion broken off, half a transom and a charred door
    for name, y, w in (('jambL', W[0][0] + .04, .08), ('jambM', W[0][1], .12), ('jambM2', W[1][0], .12), ('jambR', W[1][1] - .04, .08)):
        if L == 2 and name != 'jambM': continue
        cube(s, name, (FRONT + .01, y, (zl + zh) / 2), (.12, w, zh - zl), 'leather')
    if L == 0 or (L == 1 and not diner):
        cube(s, 'mullion', (FRONT - .06, -.85, 1.65), (.1, .1, 1.5), 'leather')
        cube(s, 'mullionStub', (FRONT - .06, -.82, 2.55), (.1, .1, .28), 'leather', rot=(0, .5, .35))
        cube(s, 'transom', (FRONT - .06, -1.28, 1.95), (.09, .85, .08), 'woodWarm')
        cube(s, 'doorPanel', (FRONT - .08, 1.06, 1.35), (.06, .55, 1.0), 'leather')
        cube(s, 'doorRail', (FRONT - .04, 1.06, 1.88), (.08, .88, .09), 'woodWarm', rot=(0, 0, .05))
    # jagged glass teeth rising from the sill and hanging from the head
    for a, b in W:
        if L == 2: break
        count = 3 if L == 0 else 1
        for i in range(count):
            yc = a + (i + .5) * (b - a) / count
            w = (b - a) / count * .42; h = .30 + rnd.random() * .18
            prism(s, 'shardUp', [(yc - w, zl), (yc + w * .2, zl + h), (yc + w, zl)], -.04, 0, 'picketWhite')
            h2 = .28 + rnd.random() * .22
            prism(s, 'shardDown', [(yc - w, zh), (yc - w * .1, zh - h2), (yc + w, zh)], -.04, 0, 'picketWhite')
    # soot tongues licking up the wall, darkest at the opening, fading to leather brown
    def tongue(name, y, w, h, token, inset=0.0):
        prism(s, name, [(y - w, zh), (y - w * .55, zh + h * .55), (y - w * .1, zh + h), (y + w * .35, zh + h * .62), (y + w, zh)],
              FRONT, FRONT + .018 + inset, token)
    for y, w, h in [(-1.35, .30, .50), (-.90, .22, .45), (.75, .22, .45), (1.25, .24, .30)][:4 if L < 2 else 0 if diner else 2]:
        tongue('sootTongue', y, w, h, 'uiDark')
        if L == 0: tongue('sootHalo', y + .03, w * 1.45, h * 1.25, 'leather', inset=-.006)
    if L == 0:
        for a, b in W:
            for yy in (a, b):
                prism(s, 'sootEdge', [(yy - .08, zl), (yy - .10, zh), (yy + .10, zh), (yy + .08, zl + .2)], FRONT, FRONT + .016, 'leather')
        cube(s, 'sillSoot', (FRONT + .006, -.85, zl - .12), (.02, 1.7, .22), 'leather')
        cube(s, 'sillSoot', (FRONT + .006, 1.07, zl - .12), (.02, 1.0, .22), 'leather')
    if diner and L < 2:   # fire-blackened stone: soot band over the openings, charred pier faces
        cube(s, 'sootBand', (FRONT + .008, -.07, zh + .08), (.02, 3.2, .15), 'uiDark')
        cube(s, 'sootBand2', (FRONT + .008, -.4, zh + .22), (.02, 1.9, .12), 'leather')
        cube(s, 'pierChar', (FRONT + .01, -1.95, 1.7), (.02, .42, 1.5), 'uiDark')
        cube(s, 'pierChar2', (FRONT + .01, 1.95, 1.3), (.02, .4, .9), 'leather')
    # scorched crowns on the broken header steps
    if L == 0 or (L == 1 and not diner):
        for y, z, w in ((-.9, 3.53, .5), (-.35, 3.08, .46), (.75, 3.48, .5)):
            cube(s, 'charCrown', (FRONT - .02, y, z), (.1, w, .12), 'uiDark')
    # awning: separate burnt slats, some gone, one hanging
    n = 7 if L == 0 else 5 if L == 1 else 3
    missing = {2, 5} if L == 0 else {2} if L == 1 else set()
    span = 3.9
    cols = ['survivorRed', 'picketWhite'] * 4 if diner else ['uiDark', 'leather', 'uiDark', 'woodWarm', 'leather', 'uiDark', 'leather']
    for i in range(n):
        if i in missing: continue
        yc = -span / 2 + (i + .5) * span / n
        hang = i == n - 2 and L < 2
        cube(s, 'slat', (.36, yc, 2.98 - (.12 if hang else 0)), (.64, span / n * .86, .06), cols[i % len(cols)], rot=(0, .47 + (.3 if hang else 0), 0))
    if L == 0:
        cube(s, 'awningBeam', (.12, 0, 3.02), (.1, 3.95, .12), 'leather')
        cube(s, 'awningRail', (.62, -.2, 2.82), (.06, 3.2, .06), 'leatherShadow')
    # brick face detail (LOD0): mortar courses, tone patches, pale quoins
    if L == 0:
        for i in range(1, 8, 2 if diner else 1):
            z = zl + .27 * i
            for a, b, top in ((-2.2, W[0][0], 3.1), (W[0][1], W[1][0], 3.0), (W[1][1], 2.2, 3.3)):
                if z < top: cube(s, 'brickCourse', (FRONT + .006, (a + b) / 2, z), (.012, b - a, .02), dark)
        for z in (3.0, 3.2, 3.4):
            cube(s, 'brickCourse', (FRONT + .006, 1.0 if z > 3.1 else 0, z), (.012, 2.2 if z > 3.1 else 3.1, .02), dark)
        for i in range(9):
            y = rnd.choice([-2.0, -1.88, -1.0, -.3, .35, 1.8, 2.0, .9, -.6, 1.3, -1.5, .45, 1.65, -.1])
            z = rnd.uniform(.35, 3.2) if abs(y) > 1.65 or abs(y - .35) < .2 else rnd.uniform(3.0, 3.3)
            z = rnd.uniform(.35, .85) if rnd.random() < .5 else z
            cube(s, 'brickTone', (FRONT + .01, y, z), (.02, rnd.uniform(.16, .3), rnd.uniform(.1, .18)), rnd.choice(['redShadow', 'survivorRed', 'brick', 'leatherShadow']))
        for i in range(2 if diner else 5):
            cube(s, 'quoin', (FRONT + .02, -2.14 if i % 2 == 0 else -2.06, .35 + i * .5), (.04, .22 if i % 2 == 0 else .3, .30), 'brick' if diner else 'sidewalk')
    # rubble and fallen pieces on the pavement
    rub = [(.30, -1.9, .22, .16), (.22, -1.5, .30, .14), (.36, -1.0, .26, .12), (.28, .1, .20, .12), (.38, .85, .30, .14), (.18, 1.9, .34, .2), (.38, 1.6, .22, .14), (.1, 2.05, .22, .26)]
    toks = ['brick', 'redShadow', 'sidewalk', 'brick', 'leatherShadow', 'sidewalk', 'brick', 'redDark']
    for i, (x, y, w, h) in enumerate(rub[:8 if L == 0 else 4 if L == 1 else 0]):
        cube(s, 'rubble', (x, y, .2 + h / 2), (w, w * .8, h), toks[i], rot=(rnd.uniform(-.2, .2), rnd.uniform(-.2, .2), rnd.uniform(0, 1.5)))
    if L == 0:
        cube(s, 'fallenBeam', (.35, -.45, .27), (.1, 1.5, .1), 'leather', rot=(0, 0, .35))
        cube(s, 'fallenBeam', (.42, 1.2, .26), (.09, .8, .09), 'uiDark', rot=(0, .12, -.5))
    if False:
        for i in range(3):
            cube(s, 'loose', (rnd.uniform(.05, .5), rnd.uniform(-2, 2), .23), (.1, .14, .06), rnd.choice(['brick', 'redShadow', 'sidewalk']), rot=(0, 0, rnd.uniform(0, 3)))
    if not diner:
        # loose coping blocks and a burnt beam end on the wrecked parapet
        cube(s, 'coping', (-.18, 2.0, 4.17 - .09), (.5, .42, .18), 'sidewalk')
        if L < 2:
            cube(s, 'brokenCoping', (-.16, -1.0, 3.86), (.46, .85, .22), 'sidewalk')
            cube(s, 'beamStub', (-.2, -1.95, 3.8), (.18, .18, .75), 'leather', rot=(0, .5, 0))
        if L == 0:
            cube(s, 'perch1', (-.2, .35, 3.18), (.4, .22, .2), 'brick', rot=(0, 0, .2))
            cube(s, 'perch2', (-.2, -.45, 3.64), (.4, .2, .16), 'sidewalk', rot=(0, 0, -.25))
    else:
        cube(s, 'cornice', (-.10, 0, 3.52), (.64, 4.22, .18), 'sidewalk')
        if L < 2:
            cube(s, 'corniceBreak', (.25, -1.45, 3.48), (.1, .9, .12), 'uiDark')
        if L < 2: cube(s, 'cornerStub', (-.18, -2.0, 3.8), (.4, .36, .55), 'khakiSeam')
        if L < 2: cube(s, 'signPost', (-.04, 1.9, 3.9), (.2, .3, .8), 'leatherShadow')
        sz = 3.84   # sign slab with a broken upper-right corner and soot
        prism(s, 'dinerFascia', [(-1.64, sz - .36), (-1.64, sz + .36), (.95, sz + .36), (1.64, sz + .06), (1.64, sz - .36)], -.16, .08, 'survivorRed')
        if L < 2: cube(s, 'dinerCrown', (-.04, -.3, 4.26), (.24, 1.0, .26), 'survivorRed')
        if L < 2: cube(s, 'signScorch', (.09, 1.05, 3.8), (.035, .7, .55), 'uiDark')
        if L == 0:
            bpy.ops.object.text_add(location=(.113, -.4, 3.84), rotation=(math.pi / 2, 0, math.pi / 2))
            obj = bpy.context.object; obj.data.body = 'DINER'; obj.data.align_x = 'CENTER'; obj.data.align_y = 'CENTER'; obj.data.resolution_u = 1
            bpy.ops.object.convert(target='MESH'); obj = bpy.context.object; obj.name = 'dinerLettering'; obj.parent = s.root
            obj.data.materials.append(palette.mat('picketWhite'))
            xs = [v.co.x for v in obj.data.vertices]; ys = [v.co.y for v in obj.data.vertices]
            for v in obj.data.vertices:
                v.co.x *= 2.0 / (max(xs) - min(xs)); v.co.y *= .30 / (max(ys) - min(ys))
        else:
            cube(s, 'dinerWord', (.10, -.4, 3.84), (.03, 2.0, .3), 'picketWhite')
    s.physics(); return s


def build_set(asset, directory, output=None):
    directory = Path(directory); stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        path = directory / ('model' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb')
        scene = recipe(asset, lod)
        for obj in scene.root.children_recursive:
            if obj.type == 'MESH':
                bm = bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
        stats['lod' + str(lod)] = finish(scene, path)
        for obj in scene.root.children_recursive:
            if obj.type == 'MESH':
                for value in obj.data.color_attributes['ao'].data:
                    shade = max(.65, value.color[0]); value.color = (shade, shade, shade, 1)
        export.glb(scene.root, path)
        if stats['lod' + str(lod)]['triangles'] > (1500, 600, 200)[lod]: raise ValueError(stats)
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    if output:
        import shutil
        if Path(output).resolve() != (directory / 'model.glb').resolve(): shutil.copyfile(directory / 'model.glb', output)
