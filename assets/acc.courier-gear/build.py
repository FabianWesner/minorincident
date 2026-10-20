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
DEBUG = '--debug' in ARGS
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
        self.nopack_teal = [False] * len(bm.faces)
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
    def weights_at(self, p, n=3, remap=None):
        acc = {}
        for co, idx, dist in self.kd.find_n(p, n):
            w = 1 / (dist + 1e-4)
            for g in self.me.vertices[idx].groups:
                acc[g.group] = acc.get(g.group, 0) + g.weight * w
        # secondary bones (hair, eyes, held-item sockets, pack) must not drive gear: fold them into their structural parent
        fold = {'pony1': 'head', 'pony2': 'head', 'pony3': 'head', 'eyeL': 'head', 'eyeR': 'head', 'irisL': 'head', 'irisR': 'head',
                'backpackSocket': 'chest', 'weaponSocketL': 'handL', 'weaponSocketR': 'handR'}
        merged = {}
        for g, w in acc.items():
            name = fold.get(self.names[g], self.names[g])
            if remap: name = remap.get(name, name)
            merged[name] = merged.get(name, 0) + w
        top = sorted(merged.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1
        return [(name, w / s) for name, w in top]

class Gear:
    def __init__(self, body, lod):
        self.body, self.lod = body, lod
        self.scale = (1.0, .62, .31)[lod]
        self.verts = []   # (pos, anchor, color)
        self.tris = []    # (a, b, c) vertex ids, in tier order
        self.tier_end = []
        self.tint = 'backpackTealDark'
        self.log = []; self.spans = []
    def n(self, base, minimum=1): return max(minimum, round(base * self.scale))

    def patch(self, color, rays, thick, rows, cols, closed=False, bvh=None, cell_color=None, shade=.55,
              inset=.004, dilate=0, smooth=1, drop=None, flat_lift=0.0, walls=True, outer=None, tint=None, median=False, remap=None, rim=None, rim_top=True, rim_sides=True):
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
        if median:   # narrow bumps (the cross-body strap stands 4 cm off the tee) must not lift the whole plate: clip to the local median + 8 mm
            def med(i, j):
                v = sorted(dist[a][b] for a, b in [nb(i, j, di, dj) for di in (-1, 0, 1) for dj in (-1, 0, 1)])
                return v[len(v) // 2]
            dist = [[min(dist[i][j], med(i, j) + .008) for j in range(C)] for i in range(R)]
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
                self.verts.append([p, anchor, None, th, tm[i][j], remap, 0]); ids_out[i][j] = len(self.verts) - 1
            return ids_out[i][j]
        ids_in = {}
        def vin(i, j):
            if (i, j) not in ids_in:
                anchor = origin[i][j] + dirs[i][j] * raw[i][j]
                p = origin[i][j] + dirs[i][j] * (raw[i][j] - inset)
                self.verts.append([p, anchor, None, 0.0, 0.0, remap, 1]); ids_in[(i, j)] = len(self.verts) - 1
            return ids_in[(i, j)]
        cols_n = C if closed else cols
        cells = {}
        for i in range(rows):
            for j in range(cols_n):
                if drop and drop(i, j, rows, cols_n): continue
                j2 = (j + 1) % C if closed else j + 1
                cells[(i, j)] = (i, j, j2)
        edge_count = {}
        def edge(a, b, center):
            k = (min(a, b), max(a, b)); edge_count.setdefault(k, []).append((a, b, center))
        first = len(self.verts)
        self.log.append(color)
        for (i, j), (_, _, j2) in cells.items():
            quad = [(i, j), (i + 1, j), (i + 1, j2), (i, j2)]
            ids = [vid(*q) for q in quad]
            cc = cell_color(i, j, rows, cols_n) if cell_color else color
            if rim and (i == 0 or (rim_top and i == rows - 1) or (rim_sides and not closed and (j == 0 or j == cols_n - 1))): cc = rim
            center = sum((self.verts[x][0] for x in ids), Vector((0, 0, 0))) / 4
            if DEBUG and color == 'pantsDark' and outer: print('CELL', i, j, cc)
            for a, b, c in ((0, 1, 2), (0, 2, 3)):
                pa, pb, pc = (self.verts[ids[k]][0] for k in (a, b, c))
                # outward-facing winding (the material is single sided): the face normal must point along the ray direction
                if (pb - pa).cross(pc - pa).dot(dirs[i][j]) < 0: b, c = c, b
                self.tris.append((ids[a], ids[b], ids[c], cc))
            for k in range(4): edge(quad[k], quad[(k + 1) % 4], center)
        for k, lst in edge_count.items():
            if len(lst) != 1 or not walls: continue
            (a, b, center) = lst[0]
            oa, ob = vid(*a), vid(*b); ia, ib = vin(*a), vin(*b)
            cc = rim or color
            pa, pb, pi_ = self.verts[oa][0], self.verts[ob][0], self.verts[ib][0]
            flip = (pb - pa).cross(pi_ - pa).dot((pa + pb) / 2 - center) < 0
            t1, t2 = ((oa, ob, ib), (oa, ib, ia)) if not flip else ((oa, ib, ob), (oa, ia, ib))
            self.tris.append((*t1, cc)); self.tris.append((*t2, cc))
        # shade by distance to the rim (soft edge darkening gives the plates form without extra geometry)
        for (i, j) in list(ids_out_iter(ids_out)):
            s, t = i / rows, j / cols
            e = rounded(s) if closed else rounded(s) * rounded(t)
            self.verts[ids_out[i][j]][2] = 1 - shade * (1 - e) * .5 if shade else 1.0
        self.spans.append((first, len(self.verts)))
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
    zup = Vector((0, 0, 1))
    def smooth01(x):
        x = clamp(x); return x * x * (3 - 2 * x)
    def pad(T, lip=.5, soft=.8):
        """Raised pad: a lip of lip*T at the rim, rising to T over `soft` of the way in (a visible bulge, not a decal)."""
        return lambda s, t: T * (lip + (1 - lip) * smooth01(min(math.sin(math.pi * s), math.sin(math.pi * t)) / soft))
    def v_of_z(f):
        def conv(z):
            lo, hi = 0.0, 1.0
            for _ in range(30):
                mid = (lo + hi) / 2
                if f(mid)[0].z > z: lo = mid
                else: hi = mid
            return lo
        return conv
    def only(allowed, fallback):
        """A plate follows only its own limb's bones (never the other side, never the torso): everything else folds into `fallback`."""
        return {name: fallback for name in body.names if name not in allowed}
    ARMS = {'armL': 'chest', 'armR': 'chest', 'elbowL': 'chest', 'elbowR': 'chest', 'clavicleL': 'chest', 'clavicleR': 'chest', 'foreArmL': 'chest', 'foreArmR': 'chest'}
    STEEL, DARK, TRIM = 'pantsDark', 'uiDark', 'silver'

    # ---- tier 1: knee pads (bulged cap with a silver rim), fingerless gloves -----------------------------------------
    for side in 'LR':
        kz = bones['knee' + side][0].z
        leg = limb_axis(body, [('leg' + side, 'h'), ('knee' + side, 'h'), ('shin' + side, 't')]); vz = v_of_z(leg)
        g.patch(STEEL, around(leg, lambda s, kz=kz, vz=vz: vz(kz + .058 - .12 * s), 0, 66),
                pad(.026, .45), n(4, 2), n(5, 3), rim=TRIM, remap=only({'leg' + side, 'knee' + side, 'shin' + side, 'hip'}, 'leg' + side))
    for side in 'LR' if lod < 2 else '':
        h, t = bones['hand' + side]; up = (h - t).normalized()
        g.patch('leather', around(lambda v, h=h, t=t, up=up: (h.lerp(t, v), up), lambda s: -.12 + s * .86, 0, 0, closed=True),
                lambda s, t_: .014 * (.6 + .4 * math.sin(math.pi * s)), n(3, 2), n(8, 5), closed=True, rim='gloveKhaki',
                remap=only({'foreArm' + side, 'foreArmTwist' + side, 'hand' + side, 'elbow' + side}, 'hand' + side))
    g.tier_mark()

    # ---- tier 2: quilted padded vest (olive, collar, ridges, armholes) ------------------------------------------------
    z0 = bones['torso'][0].z + .012; z1 = bones['chest'][0].z + .035
    torso = lambda v: (Vector((0, 0, v)), zup)
    cols = n(16, 6); rows = n(6, 2)
    def vest_thick(s, t):
        r = round(s * rows)
        if r == 0: return .036                       # raised collar
        if r == rows: return .024                    # hem
        return .032 if r % 2 else .022               # quilted ridges
    def vest_color(i, j, R, C):
        if i == 0: return 'oliveLight'               # collar
        if i == R - 1: return 'oliveSeam'            # hem
        if j == 0: return 'brass'                    # zip
        return 'olive' if i % 2 else 'oliveSeam'
    g.patch('olive', around(torso, lambda s: z1 - (z1 - z0) * s, -180 / cols, 0, closed=True), vest_thick, rows, cols, closed=True,
            bvh=body.bvh_nopack, cell_color=vest_color, median=True, shade=.4,
            drop=lambda i, j, R, C: 1 <= i < R * .85 and min(abs(360 * j / C - 90), abs(360 * j / C - 270)) <= 40)   # armholes
    g.tier_mark()

    # ---- tier 3: shoulder + elbow pads, utility belt ----------------------------------------------------------------
    for side, sg in (('L', 1), ('R', -1)):
        c = bones['arm' + side][0]
        g.patch(STEEL, dome(c, Vector((1, 0, 0)), zup, Vector((0, sg, 0)), 50, 4, 78), pad(.032, .45), n(4, 3), n(5, 3), rim='orange',
                remap=only({'arm' + side, 'clavicle' + side, 'chest'}, 'arm' + side))
        arm = limb_axis(body, [('arm' + side, 'h'), ('foreArm' + side, 'h'), ('hand' + side, 'h')]); vz = v_of_z(arm)
        ez = bones['foreArm' + side][0].z
        if lod < 1: g.patch(STEEL, around(arm, lambda s, ez=ez, vz=vz: vz(ez + .046 - .092 * s), 135 * sg, 56), pad(.026, .45), n(3, 2), n(4, 3), rim=TRIM,
                remap=only({'arm' + side, 'elbow' + side, 'foreArm' + side, 'foreArmTwist' + side}, 'arm' + side))
    wz = bones['torso'][0].z
    bcols = n(16, 8)
    if lod < 1: g.patch('leather', around(torso, lambda s: wz + .02 - .03 * s, -180 / bcols, 0, closed=True), lambda s, t: .02, 1, bcols, closed=True,
            bvh=body.bvh_nopack, cell_color=lambda i, j, R, C: 'brass' if j == 0 else 'leather', median=True, shade=.5)
    g.tier_mark()

    # ---- tier 4: helmet shell over the cap (dark grey dome, orange stripe, orange lip), forearm guards -------------------
    head = bones['head']; hc = Vector((0.0, 0, head[1].z - .03))
    xfwd = Vector((1, 0, 0)); yleft = Vector((0, 1, 0))
    helmet_cols = n(12, 4)
    g.patch(STEEL, dome(hc, yleft, zup, xfwd, 150, 38, 90), lambda s, t: .034 * (.45 + .55 * smooth01(s / .35)) * (.7 + .3 * smooth01(math.sin(math.pi * t) / .5)),
            n(5, 3), helmet_cols, outer=.6, rim='schoolBusYellow', rim_top=False, rim_sides=False, remap=only({'head', 'neck'}, 'head'),
            cell_color=lambda i, j, R, C: 'schoolBusYellow' if abs(j - (C - 1) / 2) < .6 and i > 0 else STEEL)
    for side, sg in (('L', 1), ('R', -1)) if lod < 1 else ():
        fa = limb_axis(body, [('foreArm' + side, 'h'), ('hand' + side, 'h')]); vz = v_of_z(fa)
        fz = bones['foreArm' + side][0].z
        g.patch(STEEL, around(fa, lambda s, fz=fz, vz=vz: vz(fz - .022 - .08 * s), 90 * sg, 76), pad(.022, .55), n(2, 2), n(5, 3), rim=TRIM,
                remap=only({'foreArm' + side, 'foreArmTwist' + side, 'elbow' + side, 'hand' + side}, 'foreArm' + side))
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
    # Skin weights: Blender Data Transfer (vertex groups, nearest face interpolated) from the body mesh, evaluated at each vertex's
    # anchor on the body surface, so the weights are the body's own blend at that spot (no single-vertex picks across joint seams).
    tmp_me = bpy.data.meshes.new('anchors'); tmp_me.from_pydata([v[1] for v in verts], [], []); tmp_me.update()
    tmp = bpy.data.objects.new('anchors', tmp_me); bpy.context.scene.collection.objects.link(tmp)
    for name in body.names: tmp.vertex_groups.new(name=name)
    mod = tmp.modifiers.new('xfer', 'DATA_TRANSFER')
    mod.object = body.obj; mod.use_vert_data = True; mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'POLYINTERP_NEAREST'; mod.layers_vgroup_select_src = 'ALL'; mod.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = tmp
    with bpy.context.temp_override(object=tmp, active_object=tmp):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    fold = {'pony1': 'head', 'pony2': 'head', 'pony3': 'head', 'eyeL': 'head', 'eyeR': 'head', 'irisL': 'head', 'irisR': 'head',
            'backpackSocket': 'chest', 'weaponSocketL': 'handL', 'weaponSocketR': 'handR'}
    inner = me.attributes.new('_inner', 'FLOAT', 'POINT')   # 1 on the skin-side vertices (shell rim on the skin): the Scene Lab guard measures only these
    for vi, v in enumerate(verts): inner.data[vi].value = float(v[6])
    groups = {}
    for vi, v in enumerate(tmp.data.vertices):
        merged = {}
        for ge in v.groups:
            name = tmp.vertex_groups[ge.group].name; name = fold.get(name, name)
            rm = verts[vi][5]
            if rm: name = rm.get(name, name)
            merged[name] = merged.get(name, 0) + ge.weight
        top = sorted(merged.items(), key=lambda kv: -kv[1])[:4]
        total = sum(w for _, w in top) or 1
        if not top: top = [('chest', 1.0)]; total = 1.0
        for name, w in top: groups.setdefault(name, []).append((vi, w / total))
    bpy.data.objects.remove(tmp, do_unlink=True)
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
                              export_skins=True, export_influence_nb=4, export_def_bones=False, export_vertex_color='ACTIVE', export_attributes=True)
    print('GEAR_OUTER_CM', [(c, round(max([v[3] for v in verts[a:b] if not v[6]] or [0]) * 100, 2)) for c, (a, b) in zip(g.log, g.spans)])
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
