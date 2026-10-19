"""Courier gear tiers 1-4 as SKINNED shells that hug the skinned courier body (E04-AC10, E13-AC08).

Rebuild (Blender headless, both survivors, three LODs):
  python3 tools/blender/run.py assets/acc.courier-gear/build.py -- --out public/assets/models

How it fits: the courier skin GLB (public/assets/models/char.courier-<sex>.skin[.low].glb) is imported in its rest pose.
Every gear piece is a patch of rays cast from a limb/torso/head axis onto the body (BVH); the outer surface sits a few
millimetres to ~1.6 cm above the hit and the rim walls dive 4 mm into the body, so there is no gap at rest. Every gear
vertex copies the skin weights of the nearest body vertices, so the gear deforms with the body in every pose (no rigid
parenting, nothing floats). All pieces are one mesh sorted by tier; CharacterView draws it with a draw range per tier
(1 extra draw call, the body's own vertex-colour material). Output per sex: acc.courier-gear.<sex>.tiers.glb (LOD0, fitted
to the high body), ...tiers.low.glb (LOD1) and ...tiers.lod2.glb (LOD2, silhouette only).
Coordinates are Blender's (Z up, +X forward, left = +Y); the glb export converts to glTF.
"""
import sys, math, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key) + 1] if key in ARGS else default
OUT = Path(arg('--out', str(HERE)))
ONLY = arg('--variant')
LODS = [int(arg('--lod'))] if arg('--lod') else [0, 1, 2]
palette = json.loads((REPO / 'src/assets/palette.json').read_text())

def lin(token, k=1.0):
    h = palette[token] if token in palette else token
    c = [int(h.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(min(1, k * (v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4)) for v in c) + (1,)

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def rounded(x, p=4):
    """1 in the middle of 0..1, falling to 0 at both ends with a squared-off shoulder."""
    return math.sqrt(clamp(1 - abs(2 * x - 1) ** p))

class Body:
    def __init__(self, path):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
        self.rig = bpy.data.objects['courierRig']; self.obj = bpy.data.objects['courierSkin']
        for o in list(bpy.data.objects):
            if o not in (self.rig, self.obj): bpy.data.objects.remove(o, do_unlink=True)
        me = self.obj.data
        self.bones = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in self.rig.data.bones}
        self.bvh = BVHTree.FromObject(self.obj, bpy.context.evaluated_depsgraph_get())
        # the same without the rigid backpack so back/torso rays reach the clothes
        bm = bmesh.new(); bm.from_mesh(me)
        deform = bm.verts.layers.deform.verify(); pack = self.obj.vertex_groups['backpackSocket'].index
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v[deform].get(pack, 0) > .5 and v.co.x < -.08], context='VERTS')
        self.bvh_nopack = BVHTree.FromBMesh(bm)
        bm.faces.ensure_lookup_table(); layer = bm.loops.layers.color.active
        self.nopack_teal = [self.is_teal(sum((l[layer] for l in f.loops), Vector((0, 0, 0, 0))) / len(f.loops)) for f in bm.faces]
        bm.free()
        cols = me.color_attributes[0].data
        self.teal = [self.is_teal(sum((Vector(cols[li].color) for li in poly.loop_indices), Vector((0, 0, 0, 0))) / len(poly.loop_indices)) for poly in me.polygons]
        self.kd = KDTree(len(me.vertices))
        for v in me.vertices: self.kd.insert(v.co, v.index)
        self.kd.balance()
        self.colors = me.color_attributes[0]
        self.names = [g.name for g in self.obj.vertex_groups]
        self.me = me
    @staticmethod
    def is_teal(c):
        return c[0] < .35 and c[1] > c[0] * 1.5 and c[1] > c[2] * .85
    def weights_at(self, p, n=3):
        acc = {}
        for co, idx, dist in self.kd.find_n(p, n):
            w = 1 / (dist + 1e-4)
            for g in self.me.vertices[idx].groups:
                acc[g.group] = acc.get(g.group, 0) + g.weight * w
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1
        return [(self.names[g], w / s) for g, w in top]

class Gear:
    def __init__(self, body, lod):
        self.body, self.lod = body, lod
        self.scale = (1.0, .62, .31)[lod]
        self.verts = []   # (pos, anchor, color)
        self.tris = []    # (a, b, c) vertex ids, in tier order
        self.tier_end = []
        self.tint = 'backpackTealDark'
    def n(self, base, minimum=1): return max(minimum, round(base * self.scale))

    def patch(self, color, rays, thick, rows, cols, closed=False, bvh=None, cell_color=None, shade=.55,
              inset=.004, dilate=1, smooth=2, drop=None, flat_lift=0.0, walls=False, outer=None, tint=None):
        """rays(s, t) -> (origin, dir) for s,t in 0..1 (rows x cols grid); thick(s, t) -> outward offset in metres."""
        bvh = bvh or self.body.bvh
        R = rows + 1; C = cols if closed else cols + 1
        tm = [[0.0] * C for _ in range(R)]
        origin = [[None] * C for _ in range(R)]; dirs = [[None] * C for _ in range(R)]; dist = [[None] * C for _ in range(R)]
        for i in range(R):
            for j in range(C):
                o, d = rays(i / rows, j / cols); origin[i][j], dirs[i][j] = o, d.normalized()
                if outer:   # outside-in: the outermost surface wins (the cap shell floats above the head skin)
                    hit = bvh.ray_cast(o + dirs[i][j] * outer, -dirs[i][j], outer * 2)
                    dist[i][j] = outer - hit[3] if hit[0] is not None else None
                else:
                    hit = bvh.ray_cast(o, dirs[i][j], 2.0)
                    dist[i][j] = hit[3] if hit[0] is not None else None
                if tint:
                    flags = (self.body.nopack_teal if bvh is self.body.bvh_nopack else self.body.teal)
                    tm[i][j] = 1.0 if hit[0] is not None and flags[hit[2]] else 0.0
        valid = [d for row in dist for d in row if d is not None]
        assert valid, 'rays missed the body'
        mean = sum(valid) / len(valid)
        for i in range(R):
            for j in range(C):
                if dist[i][j] is None: dist[i][j] = mean
        def nb(i, j, di, dj):
            jj = (j + dj) % C if closed else j + dj
            ii = i + di
            return (ii, jj) if 0 <= ii < R and 0 <= jj < C else (i, j)
        raw = [row[:] for row in dist]
        for _ in range(dilate):   # clearance above the highest body point nearby
            dist = [[max(dist[a][b] for a, b in [nb(i, j, di, dj) for di in (-1, 0, 1) for dj in (-1, 0, 1)]) for j in range(C)] for i in range(R)]
        for _ in range(smooth):
            dist = [[sum(dist[a][b] for a, b in [nb(i, j, 0, 0), nb(i, j, 1, 0), nb(i, j, -1, 0), nb(i, j, 0, 1), nb(i, j, 0, -1)]) / 5 for j in range(C)] for i in range(R)]
            dist = [[max(dist[i][j], raw[i][j]) for j in range(C)] for i in range(R)]
        ids_out = [[None] * C for _ in range(R)]
        def vid(i, j):
            if ids_out[i][j] is None:
                s, t = i / rows, j / cols
                th = thick(s, t) + flat_lift
                p = origin[i][j] + dirs[i][j] * (dist[i][j] + th)
                anchor = origin[i][j] + dirs[i][j] * raw[i][j]
                self.verts.append([p, anchor, None, th, tm[i][j]]); ids_out[i][j] = len(self.verts) - 1
            return ids_out[i][j]
        ids_in = {}
        def vin(i, j):
            if (i, j) not in ids_in:
                anchor = origin[i][j] + dirs[i][j] * raw[i][j]
                p = origin[i][j] + dirs[i][j] * (raw[i][j] - inset)
                self.verts.append([p, anchor, None, 0.0, 0.0]); ids_in[(i, j)] = len(self.verts) - 1
            return ids_in[(i, j)]
        cols_n = C if closed else cols
        cells = {}
        for i in range(rows):
            for j in range(cols_n):
                if drop and drop(i, j, rows, cols_n): continue
                j2 = (j + 1) % C if closed else j + 1
                cells[(i, j)] = (i, j, j2)
        edge_count = {}
        def edge(a, b):
            k = (min(a, b), max(a, b)); edge_count.setdefault(k, []).append((a, b))
        first = len(self.verts)
        for (i, j), (_, _, j2) in cells.items():
            quad = [(i, j), (i + 1, j), (i + 1, j2), (i, j2)]
            ids = [vid(*q) for q in quad]
            cc = cell_color(i, j, rows, cols_n) if cell_color else color
            for a, b, c in ((0, 1, 2), (0, 2, 3)):
                self.tris.append((ids[a], ids[b], ids[c], cc))
            for k in range(4): edge(quad[k], quad[(k + 1) % 4])
        for k, lst in edge_count.items():
            if len(lst) != 1 or not walls: continue
            (a, b) = lst[0]
            oa, ob = vid(*a), vid(*b); ia, ib = vin(*a), vin(*b)
            cc = color
            self.tris.append((oa, ob, ib, cc)); self.tris.append((oa, ib, ia, cc))
        # shade by distance to the rim (soft edge darkening gives the plates form without extra geometry)
        for (i, j) in list(ids_out_iter(ids_out)):
            s, t = i / rows, j / cols
            e = rounded(s) if closed else rounded(s) * rounded(t)
            self.verts[ids_out[i][j]][2] = 1 - shade * (1 - e) * .5 if shade else 1.0
        return self

    def tier_mark(self): self.tier_end.append(len(self.tris))

def ids_out_iter(ids):
    for i, row in enumerate(ids):
        for j, v in enumerate(row):
            if v is not None: yield i, j

def limb_axis(body, pts):
    """Polyline through bone joints; returns f(v) -> (point, up-tangent)."""
    P = [body.bones[a][0] if kind == 'h' else body.bones[a][1] for a, kind in pts]
    segs = [(P[k], P[k + 1], (P[k + 1] - P[k]).length) for k in range(len(P) - 1)]
    total = sum(s[2] for s in segs)
    def f(v):
        d = clamp(v) * total
        for a, b, l in segs:
            if d <= l + 1e-9 or (a, b, l) is segs[-1]:
                u = clamp(d / l); return a.lerp(b, u), (a - b).normalized()
            d -= l
    return f

def radial(axis_up):
    e1 = (Vector((1, 0, 0)) - axis_up * axis_up.x).normalized()
    e2 = axis_up.cross(e1).normalized()
    return e1, e2

def around(axis_f, z_of, a_center, a_half, closed=False):
    """rays(s, t): s along the limb (0 = top), t around it (centre angle a_center deg; 0 = front, 90 = left, 180 = back)."""
    def rays(s, t):
        p, up = axis_f(z_of(s)); e1, e2 = radial(up)
        a = math.radians(a_center + (360 * t if closed else a_half * (2 * t - 1)))
        return p, e1 * math.cos(a) + e2 * math.sin(a)
    return rays

def dome(center, e_az, e_up, e_out, az_half, el0, el1):
    """Spherical patch from a point: s = elevation el0..el1 (deg) from the horizontal plane (e_az, e_out), t = azimuth +-az_half."""
    def rays(s, t):
        el = math.radians(el0 + (el1 - el0) * s); az = math.radians(az_half * (2 * t - 1))
        d = e_out * math.cos(el) * math.cos(az) + e_az * math.cos(el) * math.sin(az) + e_up * math.sin(el)
        return center, d
    return rays

def build_gear(body, lod, sex):
    g = Gear(body, lod)
    bones = body.bones
    n = g.n
    INSET = .003
    def cush(T, p=2.5, floor=-INSET):
        return lambda s, t: floor + (T - floor) * rounded(s, p) * rounded(t, p)
    def cush_ring(T, p=2.5):
        return lambda s, t: -INSET + (T + INSET) * rounded(s, p)
    def v_of_z(f):
        def conv(z):
            lo, hi = 0.0, 1.0
            for _ in range(30):
                mid = (lo + hi) / 2
                if f(mid)[0].z > z: lo = mid
                else: hi = mid
            return lo
        return conv
    zup = Vector((0, 0, 1))

    # ---- tier 1: knee pads, fingerless gloves ----------------------------------------------------------------------
    for side in 'LR':
        kz = bones['knee' + side][0].z
        leg = limb_axis(body, [('leg' + side, 'h'), ('knee' + side, 'h'), ('shin' + side, 't')]); vz = v_of_z(leg)
        g.patch('uiDark', around(leg, lambda s, kz=kz, vz=vz: vz(kz + .052 - .108 * s), 0, 62),
                cush(.017, 2.2), n(6, 3), n(8, 3))
        if lod < 2: g.patch('silver', around(leg, lambda s, kz=kz, vz=vz: vz(kz + .026 - .052 * s), 0, 34),
                cush(.023, 2.0), n(3, 2), n(4, 2), shade=.4, dilate=2)
    for side in 'LR':
        h, t = bones['hand' + side]; up = (h - t).normalized()
        g.patch('leather', around(lambda v, h=h, t=t, up=up: (h.lerp(t, v), up), lambda s: -.12 + s * .86, 0, 0, closed=True),
                cush_ring(.011), n(4, 2), n(9, 5), closed=True, shade=.5)
    g.tier_mark()

    # ---- tier 2: padded vest ---------------------------------------------------------------------------------------
    z0 = bones['torso'][0].z + .012; z1 = bones['chest'][0].z + .02
    torso = lambda v: (Vector((0, 0, v)), zup)
    cols = n(20, 8); rows = n(6, 3)
    def vest_color(i, j, R, C):
        if j == 0: return 'silver'
        if i == int(R * .66): return 'orange'
        return 'uiDark'
    g.patch('uiDark', around(torso, lambda s: z1 - (z1 - z0) * s, -180 / cols, 0, closed=True),
            cush_ring(.017, 2.2), rows, cols, closed=True, bvh=body.bvh_nopack, cell_color=vest_color, shade=.5, tint=True, dilate=2)
    g.tier_mark()

    # ---- tier 3: shoulder + elbow pads, utility belt ---------------------------------------------------------------
    for side, sg in (('L', 1), ('R', -1)):
        c = bones['arm' + side][0]
        g.patch('tealDark', dome(c, Vector((1, 0, 0)), zup, Vector((0, sg, 0)), 46, 6, 74),
                cush(.020, 2.0, .003), n(5, 3), n(5, 3), shade=.5, dilate=2)
        arm = limb_axis(body, [('arm' + side, 'h'), ('foreArm' + side, 'h'), ('hand' + side, 'h')]); vz = v_of_z(arm)
        ez = bones['foreArm' + side][0].z
        if lod < 2: g.patch('uiDark', around(arm, lambda s, ez=ez, vz=vz: vz(ez + .042 - .084 * s), 135 * sg, 52),
                cush(.019, 2.2, .002), n(4, 3), n(5, 3), dilate=2)
    wz = bones['torso'][0].z
    bcols = n(20, 8)
    g.patch('leather', around(torso, lambda s: wz + .028 - .045 * s, -180 / bcols, 0, closed=True),
            cush_ring(.012, 2.0), n(2, 1), bcols, closed=True, bvh=body.bvh_nopack,
            cell_color=lambda i, j, R, C: 'brass' if j == 0 else 'leather', shade=.5)
    for sg in (1, -1) if lod < 2 else ():
        g.patch('uiDark', around(torso, lambda s: wz - .004 - .06 * s, 62 * sg, 17),
                cush(.026, 2.2), n(3, 2), n(4, 2), bvh=body.bvh_nopack, shade=.5)
    g.tier_mark()

    # ---- tier 4: reinforced cap (crown plate + ribs), forearm guards -----------------------------------------------
    head = bones['head']; hc = Vector((0.0, 0, head[1].z - .03))
    xfwd = Vector((1, 0, 0)); yleft = Vector((0, 1, 0))
    g.patch('uiDark', dome(hc, yleft, zup, xfwd, 60, 28, 104), cush(.017, 1.6, .004), n(7, 3), n(10, 4), shade=.5, outer=.55, dilate=2)
    if lod < 2: g.patch('orange', dome(hc, yleft, zup, xfwd, 9, 38, 100), cush(.032, 1.6, .013), n(7, 3), n(2, 1), shade=.4, outer=.55, dilate=2)
    for side, sg in (('L', 1), ('R', -1)):
        fa = limb_axis(body, [('foreArm' + side, 'h'), ('hand' + side, 'h')]); vz = v_of_z(fa)
        fz = bones['foreArm' + side][0].z
        g.patch('pantsLight', around(fa, lambda s, fz=fz, vz=vz: vz(fz - .02 - .075 * s), 120 * sg if False else (90 * sg), 78),
                cush(.012, 2.2), n(3, 2), n(7, 3),
                cell_color=lambda i, j, R, C: 'uiDark' if i == R - 1 else 'pantsLight', shade=.5)
    g.tier_mark()
    return g

def finish(g, body, variant, lod, out):
    me = bpy.data.meshes.new('gear'); obj = bpy.data.objects.new('courierGear', me); bpy.context.scene.collection.objects.link(obj)
    verts = g.verts
    me.from_pydata([v[0] for v in verts], [], [(a, b, c) for a, b, c, _ in g.tris])
    me.update()
    for p in me.polygons: p.use_smooth = True
    attr = me.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
    for pi, p in enumerate(me.polygons):
        base = g.tris[pi][3]
        for li, vi in zip(p.loop_indices, p.vertices):
            k = verts[vi][2] if verts[vi][2] is not None else 1.0
            c = lin(base, k) if isinstance(base, str) else base
            m = verts[vi][4]
            if m:
                t = lin(g.tint, k); c = tuple(c[x] * (1 - m) + t[x] * m for x in range(4))
            attr.data[li].color = c
    groups = {}
    for vi, v in enumerate(verts):
        for name, w in body.weights_at(v[1]):
            groups.setdefault(name, []).append((vi, w))
    for name, lst in groups.items():
        vg = obj.vertex_groups.new(name=name)
        for vi, w in lst: vg.add([vi], w, 'REPLACE')
    obj.parent = body.rig
    mod = obj.modifiers.new('Armature', 'ARMATURE'); mod.object = body.rig
    tier_tris = [e for e in g.tier_end]
    obj['tierTris'] = json.dumps(tier_tris)
    obj['lod'] = lod
    obj['asset_id'] = f'acc.courier-gear.{variant}'
    bpy.data.objects.remove(body.obj, do_unlink=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    body.rig.select_set(True); obj.select_set(True)
    bpy.context.view_layer.objects.active = body.rig
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_yup=True, export_extras=True,
                              export_cameras=False, export_lights=False, export_texcoords=False, export_animations=False,
                              export_skins=True, export_influence_nb=4, export_def_bones=False, export_vertex_color='ACTIVE')
    print('GEAR', out.name, 'tier cumulative tris', tier_tris, 'verts', len(verts))

BODY_FILE = {0: 'char.courier-{}.skin.glb', 1: 'char.courier-{}.skin.low.glb', 2: 'char.courier-{}.skin.low.glb'}  # the low quality tier draws the low body
SUFFIX = {0: '.tiers.glb', 1: '.tiers.low.glb', 2: '.tiers.lod2.glb'}
MODELS = REPO / 'public/assets/models'
if '--body-dir' in ARGS: MODELS = Path(arg('--body-dir'))
for variant in ([ONLY] if ONLY else ['female', 'male']):
    for lod in LODS:
        # each LOD is fitted to the body it is drawn on (the low body is a separate remesh with a different surface)
        body = Body(MODELS / BODY_FILE[lod].format(variant))
        gear = build_gear(body, lod, variant)
        finish(gear, body, variant, lod, OUT / f'acc.courier-gear.{variant}{SUFFIX[lod]}')
