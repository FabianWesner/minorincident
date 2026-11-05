"""Burned-out twin of the Sunset Grove Medical Annex (bld.clinic-annex, decay `burned`).

The L1 lab accident blows the annex windows out and burns it; L2 (a few hours later, same town) shows the aftermath.
Built from the integrated base exports (model.glb / model.lod1.glb / model.lod2.glb), never re-modelled, so it reads
as the same building at the game camera: same shell, sign and cross, bollards, paving and fence line, every node,
pivot and collider anchor at its base transform.

Damage (Blender +X front, Z up, metres):
- soot: vertex colours (the base AO layer) darken with height and above every opening; flame-shaped soot plumes
  (explicit overlay polygons, readable on the coarse LOD1/LOD2 walls) climb from the windows and doors;
- glazing blown: every window and door pane becomes a dark void; the lamp and the cross are unlit;
- doors blown: the right leaf hangs open off its hinge, the left is pushed half open;
- awning burned off: the canvas is gone, two charred frame bars sag down;
- roof partly collapsed: a ragged hole over the front-left room with charred joists, a slab sagging into it and a dark
  burned-out interior volume behind every opening;
- debris: plaster/brick rubble heaps under the front window and beside the doors, charred beams, glass shards and
  scorch on the paving; the planting is burned black.

Budgets (asset brief, checked here and by assets:pack): LOD0 <= 100000 triangles, LOD1 <= 15.5 % and LOD2 <= 4.5 %
of LOD0 (pack rule), <= 40 draws per tier.
"""
import json
import math
import random
import re
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

from . import export, palette

SEED = 19111
LIMITS = {0: (100000, 40), 1: (14400, 40), 2: (4200, 40)}
FRONT = 2.56          # front wall plane (glazing at x 2.51..2.64)
SIDE_Y = 3.30         # +Y (delivery) wall plane
REAR = -2.58
NEG_Y = -3.22
# Outer faces of the facade panels (the glazing sits recessed behind them): overlays go just in front of these.
OVERLAY = {FRONT: 2.74, SIDE_Y: 3.56, REAR: -2.68}
TOP = 3.85            # parapet height
# Openings: (axis, plane, centre u, width, bottom, top). axis 0 = wall normal +X/-X (u = y), 1 = +Y/-Y (u = x).
OPENINGS = [
    (0, FRONT, -1.92, 2.07, .8, 2.83),     # big front glazing (the blown window)
    (0, FRONT, .18, 1.82, .29, 2.54),      # double doors
    (1, SIDE_Y, -1.2, .7, 3.27, 3.35),     # high side window (delivery facade)
    (1, SIDE_Y, -1.22, 1.1, 1.11, 2.21),   # delivery hatch
    (0, REAR, -.25, 1.38, 1.57, 2.43),     # rear window
]
# Ragged roof hole over the front-left room (Blender XY polygon).
HOLE = [(.1, -2.55), (.6, -2.75), (1.15, -2.45), (1.65, -2.7), (2.05, -2.1), (1.85, -1.3), (2.1, -.55), (1.4, -.2),
        (.85, -.45), (.4, -.25), (.05, -.8), (-.05, -1.7)]
BROWN = Vector((.40, .36, .34))
BLACK = Vector((.09, .085, .09))


def inside(p, poly):
    x, y = p
    hit = False
    for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
    return hit


def smooth(a, b, x):
    t = max(0., min(1., (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def char_amount(p, token, owner):
    """0 = untouched, 1 = black char. World position p (Blender metres)."""
    n = noise.noise(p * 1.7) * .5 + noise.noise(p * 5.3) * .18
    if owner == 'interior':
        return .95
    if token.startswith('foliage') or token == 'leatherEdge':
        return min(1., .8 + n * .3)
    if token in ('cardiganRose', 'leather'):
        return 1.
    in_shell = -2.75 <= p.x <= 2.8 and -3.45 <= p.y <= 3.5
    if token in ('schoolBusYellow', 'brass') and not in_shell:
        # Flowers in the burned planters and the bollards by the door: burned black.
        return 1.
    if p.z >= .12 and not in_shell:
        # Planters, bollards, bench and signs out on the lot: scorched, worst in front of the blown front.
        return max(0., min(1., .45 + n + .25 * smooth(2.6, 3.6, p.x)))
    if p.z < .12 and not in_shell:
        # Paving: scorch fans out of the doors and the blown window, light ash elsewhere.
        d = min(Vector((p.x - 2.7, (p.y + 1.9) * .8)).length, Vector((p.x - 2.7, (p.y - .2) * .9)).length)
        return max(.12, .78 * (1 - d / 2.6)) + n * .25
    f = .5 + .45 * smooth(.2, 3.0, p.z) + n * 1.2 + (.2 if p.x > 2.4 else 0)
    if owner == 'roof' or p.z > TOP - .05:
        f = .62 + n
    for axis, plane, u, width, bottom, top in OPENINGS:
        normal_d = abs((p.x if axis == 0 else p.y) - plane)
        if normal_d > .6:
            continue
        du = abs((p.y if axis == 0 else p.x) - u)
        if p.z >= bottom - .2:
            spread = width * .5 + max(0., p.z - top) * .55
            f += .75 * max(0., 1 - du / max(spread, .01)) * (1 - normal_d / .6)
    return max(0., min(1., f))


def multiplier(f):
    a = smooth(0, .5, f)
    m = Vector((1, 1, 1)).lerp(BROWN, a)
    return m.lerp(BLACK, smooth(.42, 1., f))


def token_of(material):
    return re.sub(r'\.\d{3}$', '', material.name).split('_', 1)[-1]


def owner_of(obj):
    o = obj.parent
    while o and o.name not in ('body', 'roof', 'interior', 'root') and not o.name.startswith(('door_', 'window_', 'sign_', 'lamp_')):
        o = o.parent
    return o.name if o else 'root'


def char_colors():
    for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        me, M = obj.data, obj.matrix_world
        if not me.materials or me.materials[0].name.startswith('emi_'):
            continue
        layer = me.color_attributes.get('Color') or me.color_attributes.new('Color', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = layer
        owner = owner_of(obj)
        tokens = [token_of(m) for m in me.materials]
        for poly in me.polygons:
            token = tokens[poly.material_index]
            for li in poly.loop_indices:
                v = me.loops[li].vertex_index
                p = M @ me.vertices[v].co
                c = layer.data[li if layer.domain == 'CORNER' else v].color
                m = multiplier(char_amount(p, token, owner))
                layer.data[li if layer.domain == 'CORNER' else v].color = (c[0] * m.x, c[1] * m.y, c[2] * m.z, c[3])


def swap_material(obj, token):
    mat = palette.mat(token)
    for i in range(len(obj.data.materials)):
        obj.data.materials[i] = mat


def blow_glazing():
    """Every pane is gone (dark void), the lamp is dead, the cross is unlit and sooted."""
    for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        if not obj.data.materials[0].name.startswith('emi_'):
            continue
        owner = owner_of(obj)
        swap_material(obj, 'silver' if owner == 'sign_cross' else 'uiDark')
        layer = obj.data.color_attributes.get('Color')
        if layer:
            for item in layer.data:
                item.color = (.55, .55, .55, 1) if owner == 'sign_cross' else (1, 1, 1, 1)


def burn_foliage(lod):
    """Planting burned black. LOD0: about half the leaf clusters burned away (bare, sparse shrubs), which also keeps the
    hero file inside its 1500 KiB delivery budget; LOD1/LOD2 keep their already coarse authored crowns."""
    rng = random.Random(SEED + 77)
    for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        leaves = set()
        for i, m in enumerate(obj.data.materials):
            t = token_of(m)
            if t.startswith('foliage'):
                obj.data.materials[i] = palette.mat('leatherEdge'); leaves.add(i)
            elif t == 'cardiganRose':
                obj.data.materials[i] = palette.mat('leather'); leaves.add(i)
        if lod or not leaves:
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        seen, doomed = set(), []
        for f in bm.faces:
            if f.index in seen or f.material_index not in leaves:
                continue
            group, stack = [], [f]
            seen.add(f.index)
            while stack:
                g = stack.pop()
                group.append(g)
                for e in g.edges:
                    for n in e.link_faces:
                        if n.index not in seen and n.material_index in leaves:
                            seen.add(n.index); stack.append(n)
            if rng.random() < .5:
                doomed.extend(group)
        bmesh.ops.delete(bm, geom=doomed, context='FACES')
        bm.to_mesh(obj.data)
        bm.free()


def delete_faces(obj, test, refine=None, cuts=7):
    """Deletes faces whose centre passes `test`. `refine(centre)`: large faces near the cut are first split into a
    grid (LOD1/LOD2 roofs are a few big quads), so the hole has the same ragged outline at every tier."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    M = obj.matrix_world
    if refine:
        big = [f for f in bm.faces if f.calc_area() > .35 and refine(M @ f.calc_center_median(), f)]
        if big:
            edges = list({e for f in big for e in f.edges})
            bmesh.ops.subdivide_edges(bm, edges=edges, cuts=cuts, use_grid_fill=True)
    tokens = [token_of(m) for m in me.materials]
    doomed = [f for f in bm.faces if test(M @ f.calc_center_median(), tokens[f.material_index])]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bm.to_mesh(me)
    bm.free()
    return len(doomed)


def objects_under(name):
    root = bpy.data.objects[name]
    return [o for o in root.children_recursive if o.type == 'MESH'] + ([root] if root.type == 'MESH' else [])


def new_mesh(name, verts, faces, token, parent):
    data = bpy.data.meshes.new(name)
    data.from_pydata([tuple(v) for v in verts], [], faces)
    data.materials.append(palette.mat(token))
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = bpy.data.objects[parent]
    obj.matrix_parent_inverse = bpy.data.objects[parent].matrix_world.inverted()
    return obj


class Builder:
    """Collects new world-space triangles per (owner, token) and emits one mesh each."""
    def __init__(self):
        self.parts = {}

    def poly(self, owner, token, points):
        verts, faces = self.parts.setdefault((owner, token), ([], []))
        start = len(verts)
        verts.extend(Vector(p) for p in points)
        faces.append(tuple(range(start, start + len(points))))

    def box(self, owner, token, center, size, yaw=0., tilt=0., roll=0.):
        R = Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Rotation(roll, 4, 'X')
        sx, sy, sz = (s / 2 for s in size)
        corners = [Vector(center) + (R @ Vector((x, y, z, 0))).to_3d() for z in (-sz, sz) for y in (-sy, sy) for x in (-sx, sx)]
        verts, faces = self.parts.setdefault((owner, token), ([], []))
        s = len(verts)
        verts.extend(corners)
        for f in [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]:
            faces.append(tuple(s + i for i in f))

    def chunk(self, owner, token, center, radius, rng, flat=.7):
        """Low irregular rubble lump: a squashed, jittered octahedron (8 triangles)."""
        c = Vector(center)
        r = [radius * (.75 + rng.random() * .5) for _ in range(6)]
        pts = [c + Vector((r[0], 0, 0)), c + Vector((-r[1], 0, 0)), c + Vector((0, r[2], 0)), c + Vector((0, -r[3], 0)),
               c + Vector((0, 0, r[4] * flat)), c + Vector((0, 0, -r[5] * flat * .3))]
        rot = Matrix.Rotation(rng.random() * math.tau, 3, 'Z')
        pts = [c + rot @ (p - c) for p in pts]
        verts, faces = self.parts.setdefault((owner, token), ([], []))
        s = len(verts)
        verts.extend(pts)
        for f in [(4, 0, 2), (4, 2, 1), (4, 1, 3), (4, 3, 0), (5, 2, 0), (5, 1, 2), (5, 3, 1), (5, 0, 3)]:
            faces.append(tuple(s + i for i in f))

    def emit(self):
        """One merged mesh per owner joined into that owner's base mesh: added damage costs no extra draw."""
        made = {}
        for (owner, token), (verts, faces) in sorted(self.parts.items()):
            obj = new_mesh(f'burned_{owner}_{token}', verts, faces, token, owner)
            layer = obj.data.color_attributes.new('Color', 'BYTE_COLOR', 'CORNER')
            for item in layer.data:
                item.color = (1, 1, 1, 1)
            made.setdefault(owner, []).append(obj)
        for owner, objects in made.items():
            base = max((o for o in bpy.data.objects[owner].children if o.type == 'MESH' and not o.name.startswith('burned_')), key=lambda o: len(o.data.polygons), default=None)
            if base is None:
                continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects + [base]:
                o.select_set(True)
            bpy.context.view_layer.objects.active = base
            bpy.ops.object.join()


def dedupe_slots():
    """Material swaps leave repeated slots (three foliage tokens -> one); collapse them so each token is one draw."""
    for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        me = obj.data
        unique, remap = [], []
        for m in me.materials:
            if m not in unique:
                unique.append(m)
            remap.append(unique.index(m))
        if len(unique) == len(me.materials):
            continue
        indices = [remap[p.material_index] for p in me.polygons]
        me.materials.clear()
        for m in unique:
            me.materials.append(m)
        for p, i in zip(me.polygons, indices):
            p.material_index = i


def wall_point(axis, plane, u, z, out):
    """Point on a wall: axis 0 = X-normal wall (u along Y), 1 = Y-normal wall (u along X); out = offset off the wall."""
    sign = 1 if plane > 0 else -1
    plane = OVERLAY.get(plane, plane)
    return (plane + sign * out, u, z) if axis == 0 else (u, plane + sign * out, z)


def plume(b, axis, plane, u, width, top, height, rng, lod, token='uiDark', out=.016):
    """Flame-tongue soot plume rising from the top of an opening (concave outline split into a fan from its base)."""
    tongues = 3 if lod == 2 else 5
    base = [(-width * .55, top - .12), (width * .55, top - .12)]
    crest = []
    for i in range(tongues + 1):
        t = i / tongues
        x = -width * .62 + t * width * 1.24
        crest.append((x, top + height * (.45 + .55 * rng.random()) * (1 - abs(t - .5) * .7)))
        if i < tongues:
            crest.append((x + width * 1.24 / tongues * .5, top + height * (.2 + .2 * rng.random())))
    outline = [base[1]] + list(reversed(crest)) + [base[0]]
    # Fan around the base midpoint keeps every triangle convex enough for any rasteriser.
    mid = (0., top - .12)
    pts = [Vector(wall_point(axis, plane, u + mid[0], mid[1], out))] + [Vector(wall_point(axis, plane, u + x, z, out)) for x, z in outline]
    for i in range(1, len(pts) - 1):
        tri = [pts[0], pts[i], pts[i + 1]]
        normal = (tri[1] - tri[0]).cross(tri[2] - tri[0])
        outward = Vector((1 if plane > 0 else -1, 0, 0)) if axis == 0 else Vector((0, 1 if plane > 0 else -1, 0))
        if normal.dot(outward) < 0:
            tri = [tri[0], tri[2], tri[1]]
        b.poly('body', token, tri)


def scorch(b, center, radius, rng, sides, token, z=.014):
    c = Vector(center)
    pts = [c + Vector((math.cos(a) * radius * (.65 + .5 * rng.random()), math.sin(a) * radius * (.6 + .5 * rng.random()), z))
           for a in [i * math.tau / sides for i in range(sides)]]
    for i in range(sides):
        b.poly('body', token, [Vector((c.x, c.y, z)), pts[i], pts[(i + 1) % sides]])


def damage(lod):
    rng = random.Random(SEED + lod)
    b = Builder()
    # Doors: the right leaf hangs open off its hinge, the left one is half open.
    right, left = bpy.data.objects['door_main_right'], bpy.data.objects['door_main']
    right.rotation_mode = left.rotation_mode = 'XYZ'
    right.matrix_world = Matrix.Translation(right.matrix_world.translation) @ Matrix.Rotation(math.radians(96), 4, 'Z') @ Matrix.Rotation(math.radians(7), 4, 'X') @ Matrix.Translation(-right.matrix_world.translation) @ right.matrix_world
    left.matrix_world = Matrix.Translation(left.matrix_world.translation) @ Matrix.Rotation(math.radians(-38), 4, 'Z') @ Matrix.Translation(-left.matrix_world.translation) @ left.matrix_world
    bpy.context.view_layer.update()
    # Awning burned off: canvas faces over the doors go, two charred frame bars sag.
    for obj in objects_under('body'):
        delete_faces(obj, lambda c, t: t in ('backpackTeal', 'tealDark') and c.x > 2.62 and 2.35 < c.z < 3.0 and -1.15 < c.y < 1.45)
    for y in (-.86, 1.18):
        b.box('body', 'uiDark', (3.02, y, 2.52), (.95, .05, .05), tilt=math.radians(24))
    if lod < 2:
        b.box('body', 'uiDark', (3.4, .16, 2.33), (.05, 2.0, .05), roll=math.radians(4))
        b.poly('body', 'tealDark', [Vector((3.38, -.3, 2.32)), Vector((3.38, .55, 2.30)), Vector((3.44, .3, 1.75))])
    # Roof: ragged hole over the front-left room, joists, a slab sagging in, burned-out volume below.
    for obj in objects_under('roof'):
        M = obj.matrix_world

        def near_cut(c, f, M=M):
            pts = [M @ v.co for v in f.verts]
            return c.z > 3.5 and min(p.x for p in pts) < 2.95 and max(p.x for p in pts) > -.1 and min(p.y for p in pts) < -.15 and max(p.y for p in pts) > -3.5
        delete_faces(obj, lambda c, t: c.z > 3.5 and inside((c.x, c.y), HOLE), near_cut if lod else None, 7 if lod == 1 else 4)
    # A slab of the broken parapet tipped onto the rubble heap below the window.
    b.box('body', 'sidewalk', (3.05, -2.75, .32), (.5, .75, .14), tilt=math.radians(28), yaw=math.radians(12))
    b.box('interior', 'uiDark', (0, 0, 1.9), (4.9, 6.25, 3.2))
    for i, (y0, y1, drop) in enumerate([(-2.5, -.3, .0), (-2.6, -.6, .55), (-2.4, -.4, 1.1)]):
        if lod == 2 and i == 1:
            continue
        x = -.25 + i * .75
        length = abs(y1 - y0)
        b.box('roof', 'leather' if i % 2 else 'uiDark', (x, (y0 + y1) / 2, 3.72 - drop * .5), (.12, length, .14), roll=math.atan2(drop, length) * (1 if i % 2 else -1))
    b.box('roof', 'asphalt', (1.25, -1.45, 3.25), (1.15, 1.25, .1), tilt=math.radians(-34), roll=math.radians(9))
    if lod == 0:
        b.box('roof', 'leather', (1.75, -1.1, 3.05), (.1, 1.4, .12), tilt=math.radians(-48))
    # Soot plumes climbing out of every opening, plus a brown halo on the big front ones.
    for axis, plane, u, width, bottom, top in OPENINGS:
        if plane == REAR and lod == 2:
            continue
        height = min(TOP + .08, top + 1.6) - top
        if height > .25:
            plume(b, axis, plane, u, width * 1.5, top, height + .15, rng, lod, 'asphalt', .012)
        plume(b, axis, plane, u, width, top, max(.2, height), rng, lod, 'uiDark', .018)
    # Soot along the parapet crown on the two camera-facing walls: one band with a ragged lower edge.
    for axis, plane, span in ((0, FRONT, (-3.15, 3.15)), (1, SIDE_Y, (-2.5, 2.5))):
        steps = 6 if lod == 2 else 12
        outward = Vector((1, 0, 0)) if axis == 0 else Vector((0, 1, 0))
        edge = [TOP - .3 - rng.random() * .5 for _ in range(steps + 1)]
        for i in range(steps):
            u0 = span[0] + (span[1] - span[0]) * i / steps
            u1 = span[0] + (span[1] - span[0]) * (i + 1) / steps
            quad = [Vector(wall_point(axis, plane, u0, TOP - .03, .02)), Vector(wall_point(axis, plane, u0, edge[i], .02)),
                    Vector(wall_point(axis, plane, u1, edge[i + 1], .02)), Vector(wall_point(axis, plane, u1, TOP - .03, .02))]
            if (quad[1] - quad[0]).cross(quad[2] - quad[0]).dot(outward) < 0:
                quad.reverse()
            b.poly('body', 'uiDark', quad)
    # Scorch on the paving out of the doors and the window (two layers).
    scorch(b, (3.25, -1.6, 0), 1.25, rng, 9 if lod < 2 else 6, 'asphalt', .012)
    scorch(b, (3.15, -1.75, 0), .7, rng, 8 if lod < 2 else 5, 'uiDark', .016)
    scorch(b, (3.3, .35, 0), .85, rng, 8 if lod < 2 else 5, 'asphalt', .013)
    # Rubble heaps: under the blown window and beside the doors (plaster, brick, char).
    heaps = [((2.95, -2.05, .1), 1.05, 14), ((2.9, 1.25, .08), .55, 7)]
    for (cx, cy, cz), spread, count in heaps:
        n = count if lod == 0 else count // 2 if lod == 1 else 3
        for k in range(n):
            a = rng.random() * math.tau
            r = spread * math.sqrt(rng.random())
            p = (cx + math.cos(a) * r * .55, cy + math.sin(a) * r, cz)
            size = (.32 - .18 * r / spread) * (1.25 if lod == 2 else 1)
            b.chunk('body', ['sidewalk', 'uiDark', 'brick', 'asphalt'][k % 4], (p[0], p[1], .05 + size * .25), size, rng)
    # Charred beams: one across the heap, one leaning by the doors, one on the paving.
    b.box('body', 'leather', (3.1, -1.7, .18), (.12, 1.7, .13), yaw=math.radians(18), roll=math.radians(8))
    if lod < 2:
        b.box('body', 'uiDark', (2.82, 1.42, .75), (.1, .1, 1.6), tilt=math.radians(-22))
        b.box('body', 'leather', (3.55, -.4, .07), (1.3, .1, .1), yaw=math.radians(-35))
    # Glass shards on the paving (near tiers only).
    if lod < 2:
        for k in range(26 if lod == 0 else 10):
            a = rng.random() * math.pi - math.pi / 2
            r = .4 + rng.random() * 1.9
            c = Vector((min(4.15, 2.75 + math.cos(a) * r * .7), -1.9 + math.sin(a) * r * 1.3 if k % 2 else .2 + math.sin(a) * r, .02))
            s = .07 + rng.random() * .08
            t = rng.random() * math.tau
            b.poly('body', 'silver', [c + Vector((math.cos(t) * s, math.sin(t) * s, 0)), c + Vector((math.cos(t + 2.2) * s, math.sin(t + 2.2) * s, 0)), c + Vector((math.cos(t + 4.1) * s * .6, math.sin(t + 4.1) * s * .6, 0))])
    b.emit()


def lights_off():
    for obj in bpy.context.scene.objects:
        if 'ss_light' in obj:
            light = json.loads(obj['ss_light']) if isinstance(obj['ss_light'], str) else dict(obj['ss_light'])
            light['intensity'] = 0
            light['emissiveNodes'] = []
            obj['ss_light'] = json.dumps(light)


def triangles(root):
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    for o in meshes:
        o.data.calc_loop_triangles()
    return sum(len(o.data.loop_triangles) for o in meshes), sum(len(o.data.materials) for o in meshes)


def build(directory, output=None, only_tier=None):
    directory = Path(directory).resolve()
    stats = {}
    for lod in ([only_tier] if only_tier is not None else (0, 1, 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source = directory / ('model.glb' if lod == 0 else f'model.lod{lod}.glb')
        bpy.ops.import_scene.gltf(filepath=str(source))
        bpy.context.view_layer.update()
        root = bpy.data.objects['root']
        root['decay'] = 'burned'
        burn_foliage(lod)
        blow_glazing()
        damage(lod)
        bpy.context.view_layer.update()
        char_colors()
        dedupe_slots()
        lights_off()
        count, draws = triangles(root)
        limit, max_draws = LIMITS[lod]
        if count > limit or draws > max_draws:
            raise ValueError(f'bld.clinic-annex.burned LOD{lod}: {count} triangles / {draws} draws (limit {limit} / {max_draws})')
        path = directory / ('model.burned.glb' if lod == 0 else f'model.burned.lod{lod}.glb')
        export.glb(root, path)
        stats[f'lod{lod}'] = {'triangles': count, 'drawCalls': draws, 'bytes': path.stat().st_size, 'source': source.name}
    (directory / 'burned-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    if output:
        import shutil
        lod = only_tier or 0
        made = directory / ('model.burned.glb' if lod == 0 else f'model.burned.lod{lod}.glb')
        if Path(output).resolve() != made:
            shutil.copyfile(made, output)
    print('OK burned clinic', json.dumps(stats))
