"""Courier gear tiers 1-4 as textured, SKINNED garment shells on the textured TRELLIS couriers (E04-AC10, E13-AC08, Q-183).

Rebuild (Blender headless, both survivors, three LODs), then compress:
  python3 tools/blender/run.py assets/acc.courier-gear/build.py -- --out /tmp/gear-raw
  for f in /tmp/gear-raw/*.glb; do npx tsx tools/assets/courier-gear-compress.ts $f public/assets/models/$(basename $f); done

How it fits (Q-183, PO 10-25: "What does she have at her hands? Gloves?"): every piece is cut out of the courier body's own surface
(public/assets/models/char.courier-<sex>.skin.glb). A smooth field per piece (an oval round the knee cap, a plane at the wrist, the
skin's own arm/torso/bag ownership blended in) is cut along its zero line, so the edges are clean curves, not triangle stairs. The cut
patch is lifted along its smoothed normals by the piece thickness (a soft bulge towards the middle) and its rim dives 3 mm into the
body. Each vertex keeps the body's skin weights at its source point on the surface, so the garment deforms exactly like the skin under
it (no rigid parenting, nothing floats). A glove is therefore the hand's own fist, fingers included, one layer thicker.
The pieces are UV-unwrapped together and get one painted texture (leather grain, stitches, quilting, zip, rims, lens glints), drawn
with the body's textured material route (Materials.fromTexture). All pieces are one mesh sorted by tier; CharacterView draws it with
a draw range per tier (1 extra draw call). Output per sex: acc.courier-gear.<sex>.tiers.glb (LOD0), ...tiers.low.glb (LOD1: low
quality tier, decimated) and ...tiers.lod2.glb (LOD2, silhouette only).
Coordinates are Blender's (Z up, +X forward, left = +Y); the glb export converts to glTF.
"""
import sys, math, json, heapq
from pathlib import Path
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key) + 1] if key in ARGS else default
OUT = Path(arg('--out', str(HERE)))
ONLY = arg('--variant')
LODS = [int(arg('--lod'))] if arg('--lod') else [0, 1, 2]
TEX = int(arg('--tex', '512'))
INSET = .003
EDGE = .013   # the cut patch is subdivided to edges of at most this length (the 6k legs are 8-vertex rings)   # the rim dives this far into the skin

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def smooth01(x):
    x = clamp(x); return x * x * (3 - 2 * x)

class Body:
    def __init__(self, path):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
        self.rig = bpy.data.objects['courierRig']; self.obj = bpy.data.objects['courierSkin']
        for o in list(bpy.data.objects):
            if o not in (self.rig, self.obj): bpy.data.objects.remove(o, do_unlink=True)
        self.male = 'courier-male' in Path(path).name
        self.bones = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in self.rig.data.bones}
        self.names = [g.name for g in self.obj.vertex_groups]
        self.bvh = BVHTree.FromObject(self.obj, bpy.context.evaluated_depsgraph_get())
        # welded working copy (UV seams duplicate vertices; the weights of duplicates are equal by construction of the skin build)
        bm = bmesh.new(); bm.from_mesh(self.obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        self.bm = bm; self.deform = bm.verts.layers.deform.active
    def ring(self, j, axis, names, half=.012):
        """Centre of the limb cross-section through joint j (the knee/elbow helper joints sit in front of the 6k surface)."""
        self.deform = self.bm.verts.layers.deform.active
        pts = [v.co for v in self.bm.verts if abs((v.co - j).dot(axis)) < half and self.W(v, names) > .5 and (v.co - j).length < .09]
        return sum(pts, Vector()) / len(pts) if pts else j.copy()
    def W(self, v, names):
        d = v[self.deform]
        return sum(d.get(self.names.index(n), 0) for n in names if n in self.names)

def ray_flags(body, bm, thick):
    """Faces hidden under another layer of the body (inner shirt shells, palm under curled fingers, back under the bag): the outward
    ray hits the body within the gear thickness + 4 mm, or hits a back face (we are inside a shell) within 3 cm."""
    out = set()
    for f in bm.faces:
        c = f.calc_center_median(); n = f.normal
        hit = body.bvh.ray_cast(c + n * .0015, n, .03)
        if hit[0] is None: continue
        if hit[3] < thick + .004 or hit[1].dot(n) > 0: out.add(f.index)
    return out

def cut_piece(body, field, thick, keep='largest', min_share=.15):
    """Copy of the welded body, cut along field == 0, keeping faces with field >= 0. Returns a bmesh (vertices on the skin)."""
    bm = body.bm.copy()
    deform = bm.verts.layers.deform.active; body.deform = deform
    vals = {}
    for v in bm.verts: vals[v] = field(v.co, v, deform)
    # refine near the piece: long edges are split (twice) so the cut line and the bulge are smooth on the coarse limbs
    for _ in range(3):
        near = {v for v in bm.verts if vals[v] > -.03}
        long = [e for e in bm.edges if (e.verts[0] in near or e.verts[1] in near) and e.calc_length() > EDGE]
        if not long: break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        for v in bm.verts:
            if v not in vals: vals[v] = field(v.co, v, deform)
    split = [e for e in bm.edges if (vals[e.verts[0]] > 0) != (vals[e.verts[1]] > 0)]
    newv = []
    for e in split:
        a, b = e.verts; fa, fb = vals[a], vals[b]
        t = clamp(fa / (fa - fb) if fa != fb else .5, .02, .98)
        _, nv = bmesh.utils.edge_split(e, a, t)
        vals[nv] = 0.0; newv.append(nv)
    zero = set(newv)
    for f in list(bm.faces):
        z = [v for v in f.verts if v in zero]
        if len(z) == 2 and not any(e.other_vert(z[0]) is z[1] for e in z[0].link_edges):
            bmesh.ops.connect_verts(bm, verts=z)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    hidden = ray_flags(body, bm, thick)
    drop = [f for f in bm.faces if any(vals.get(v, 0) < -1e-7 for v in f.verts) or all(vals.get(v, 0) <= 1e-7 for v in f.verts) or f.index in hidden]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # components: keep the largest (one glove, one pad) or every big one (vest, belt)
    bm.faces.ensure_lookup_table()
    seen, comps = set(), []
    for f in bm.faces:
        if f in seen: continue
        st, comp = [f], []; seen.add(f)
        while st:
            x = st.pop(); comp.append(x)
            for e in x.edges:
                for y in e.link_faces:
                    if y not in seen: seen.add(y); st.append(y)
        comps.append(comp)
    assert comps, 'empty gear piece'
    area = [sum(f.calc_area() for f in c) for c in comps]; big = max(area)
    kill = [f for c, a in zip(comps, area) if (keep == 'largest' and a < big) or a < big * min_share for f in c]
    if kill: bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # fill pin-holes (dropped hidden triangles inside a piece; the neck, armholes and hem have far more sides)
    holes = [e for e in bm.edges if e.is_boundary]
    if holes:
        res = bmesh.ops.holes_fill(bm, edges=holes, sides=24)
        bmesh.ops.triangulate(bm, faces=res['faces'])
    return bm

def thin_boundary(bm, spacing):
    """The cut line has a vertex at every crossed edge of the refined skin (2-5 mm apart): keep one every `spacing` along each rim
    loop and dissolve the rest, so the decimation can spend the budget on the inside (it never collapses rim vertices)."""
    left = {v for v in bm.verts if v.is_boundary}
    drop = []
    while left:
        start = left.pop(); loop = [start]; cur = start; prev = None
        while True:
            nxt = [e.other_vert(cur) for e in cur.link_edges if e.is_boundary and e.other_vert(cur) is not prev and e.other_vert(cur) in left]
            if not nxt: break
            prev, cur = cur, nxt[0]; left.discard(cur); loop.append(cur)
        acc = 0.0
        for a, b in zip(loop, loop[1:]):
            acc += (b.co - a.co).length
            if acc < spacing and len([e for e in b.link_edges if e.is_boundary]) == 2: drop.append(b)
            else: acc = 0.0
    if drop:
        bmesh.ops.dissolve_verts(bm, verts=drop, use_face_split=False, use_boundary_tear=False)
        bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
    return bm

def decimate(bm, ratio):
    if ratio >= 1: return bm
    me = bpy.data.meshes.new('dec'); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new('dec', me); bpy.context.scene.collection.objects.link(obj)
    mod = obj.modifiers.new('d', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    out = bmesh.new(); out.from_object(obj, dg)
    bpy.data.objects.remove(obj, do_unlink=True); bpy.data.meshes.remove(me)
    bmesh.ops.triangulate(out, faces=out.faces)
    return out

def idx_of(f, idx): return [idx[v] for v in f.verts]

class Gear:
    def __init__(self, body, lod):
        self.body, self.lod = body, lod
        self.verts = []   # dict(p=outer, a=anchor, inner, piece, f, n)
        self.tris = []    # (a, b, c, piece)
        self.tier_end = []; self.pieces = []; self.log = []
    def add(self, kind, field, thick, ramp=.012, keep='largest', budget=100, params=None, rim=.016):
        body = self.body
        bm = cut_piece(body, field, thick, keep)
        surf = BVHTree.FromBMesh(bm)   # the cut patch on the outer skin: anchors snap to it, never to an inner shell
        bm = thin_boundary(bm, rim * (1, 1.5, 2.2)[self.lod])
        bm = decimate(bm, budget * (1, .5, .22)[self.lod] / max(1, len(bm.faces)))
        bm.normal_update()
        pid = len(self.pieces); self.pieces.append((kind, params or {}))
        verts = list(bm.verts); idx = {v: i for i, v in enumerate(verts)}
        anchors = []; fvals = []
        for v in verts:
            loc = surf.find_nearest(v.co)[0] or v.co
            anchors.append(loc.copy()); fvals.append(max(0.0, field(loc, None, None)))
        boundary = [v.is_boundary for v in verts]
        # smoothed normals (three rounds over the 1-ring): a garment, not a copy of every TRELLIS wrinkle
        nrm = [v.normal.copy() for v in verts]
        nb = [[idx[e.other_vert(v)] for e in v.link_edges] for v in verts]
        for _ in range(3):
            nrm = [(nrm[i] * 2 + sum((nrm[j] for j in nb[i]), Vector())).normalized() for i in range(len(verts))]
        lift0 = [thick * (.55 + .45 * smooth01(fvals[i] / ramp)) for i in range(len(verts))]
        out = [anchors[i] + nrm[i] * lift0[i] for i in range(len(verts))]
        tris = [[idx[v] for v in f.verts] for f in bm.faces]
        def smooth(out, iters):
            """Laplacian smoothing of the outer face (rim vertices held), never below 90 % of the planned lift"""
            for _ in range(iters):
                nxt = out[:]
                for i in range(len(verts)):
                    if boundary[i] or not nb[i]: continue
                    q = out[i].lerp(sum((out[j] for j in nb[i]), Vector()) / len(nb[i]), .5)
                    lift = (q - anchors[i]).dot(nrm[i])
                    if lift < lift0[i] * .9: q = q + nrm[i] * (lift0[i] * .9 - lift)
                    nxt[i] = q
                out = nxt
            return out
        def push(out):
            """Never under the skin: sample every face (corners, edge midpoints, centre); where the body surface just under it (a TRELLIS
            fold, a strap, a knuckle; at most 1.2 cm above the garment, so a neighbouring arm never counts) comes closer than half the
            thickness, the face's corners are lifted."""
            for _ in range(4):
                lift = [0.0] * len(verts)
                for t in tris:
                    n = sum((nrm[k] for k in t), Vector()).normalized()
                    P = [out[k] for k in t]
                    for w in ((1, 0, 0), (0, 1, 0), (0, 0, 1), (.5, .5, 0), (0, .5, .5), (.5, 0, .5), (1 / 3, 1 / 3, 1 / 3)):
                        q = P[0] * w[0] + P[1] * w[1] + P[2] * w[2]
                        hit = body.bvh.ray_cast(q + n * .012, -n, .04)
                        if hit[0] is None or hit[1].dot(n) <= 0: continue
                        need = thick * .5 - (q - hit[0]).dot(n)
                        if need > 0:
                            for k, wk in zip(t, w):
                                if wk > 0: lift[k] = max(lift[k], need)
                if not any(lift): break
                out = [out[i] + nrm[i] * lift[i] for i in range(len(verts))]
            return out
        out = push(smooth(out, 6))
        out = push(smooth(out, 3))
        base = len(self.verts)
        for i in range(len(verts)):
            self.verts.append(dict(p=out[i], a=anchors[i], inner=0, piece=pid, f=fvals[i], n=nrm[i]))
        for f, t in zip(bm.faces, tris):
            ids = [base + k for k in t]
            a, b, c = (self.verts[k]['p'] for k in ids)
            if (b - a).cross(c - a).dot(f.normal) < 0: ids[1], ids[2] = ids[2], ids[1]
            self.tris.append((*ids, pid))
        # rim wall: every open edge gets a strip down to a ring 3 mm inside the skin (`_inner` = 1, what the attachment guard measures)
        ring = {}
        for i in range(len(verts)):
            if boundary[i]:
                ring[i] = len(self.verts)
                self.verts.append(dict(p=anchors[i] - nrm[i] * INSET, a=anchors[i], inner=1, piece=pid, f=0.0, n=nrm[i]))
        for e in bm.edges:
            if not e.is_boundary: continue
            i, j = idx[e.verts[0]], idx[e.verts[1]]
            f = e.link_faces[0]; c = f.calc_center_median()
            oi, oj, ii, ij = base + i, base + j, ring[i], ring[j]
            pa, pb, pi_ = self.verts[oi]['p'], self.verts[oj]['p'], self.verts[ij]['p']
            outward = ((pa + pb) / 2 - (sum((self.verts[base + k]['p'] for k in idx_of(f, idx)), Vector()) / 3))
            if (pb - pa).cross(pi_ - pa).dot(outward) < 0: self.tris += [(oi, oj, ij, pid), (oi, ij, ii, pid)]
            else: self.tris += [(oi, ij, oj, pid), (oi, ii, ij, pid)]
        self.log.append((kind, len(self.tris) - len([t for t in self.tris if t[3] != pid])))
        bm.free()
        return self
    def tier_mark(self): self.tier_end.append(len(self.tris))

def build_gear(body, lod):
    g = Gear(body, lod); B = body.bones; male = body.male
    W = body.W
    def own(names, level=.5, k=.06):
        return lambda v: (W(v, names) - level) * k if v is not None else 1.0
    BIG = 1.0
    side_names = lambda s: dict(arm=['arm' + s, 'elbow' + s, 'foreArm' + s, 'foreArmTwist' + s, 'hand' + s, 'weaponSocket' + s],
                                leg=['leg' + s, 'knee' + s, 'shin' + s])
    ARMS = sum((side_names(s)['arm'] for s in 'LR'), [])
    bagW = lambda v: W(v, ['backpackSocket']) if v is not None else 0.0

    # ---- tier 1: knee pads, gloves with a cuff ------------------------------------------------------------------------
    for s, sg in (('L', 1), ('R', -1)):
        kj = B['shin' + s][0]; up = (B['leg' + s][0] - kj).normalized(); dn = (B['foot' + s][0] - kj).normalized()
        a = (dn - up).normalized()                                  # down the leg
        k = body.ring(kj, a, side_names(s)['leg'])
        e1 = (Vector((1, 0, 0)) - a * a.x).normalized(); e2 = a.cross(e1)
        hu, ha = (.055, 62) if not male else (.05, 60)
        legown = own(side_names(s)['leg'])
        def knee(p, v, d, k=k, a=a, e1=e1, e2=e2, hu=hu, ha=ha, legown=legown):
            q = p - k; u = q.dot(a) - .008; r = q - a * q.dot(a)
            ang = math.degrees(math.atan2(r.dot(e2), r.dot(e1)))
            return min(.045 * (1 - math.sqrt((u / hu) ** 2 + (ang / ha) ** 2)), legown(v))
        g.add('kneepad', knee, .012 if not male else .010, ramp=.016, budget=90)
    for s, sg in (('L', 1), ('R', -1)):
        h, t = B['hand' + s]; ah = (t - h).normalized()
        af = (h - B['foreArm' + s][0]).normalized()
        armown = own(side_names(s)['arm'])
        g0 = -.004 if not male else .010                          # glove starts at the wrist (his watch band stays above the cuff)
        def glove(p, v, d, h=h, ah=ah, armown=armown, g0=g0):
            return min((p - h).dot(ah) + g0, armown(v))
        g.add('glove', glove, .0035, ramp=.006, params=dict(side=sg, h=tuple(h), ah=tuple(ah)), budget=160)
        c0, c1 = (-.040, .010) if not male else (-.018, .024)
        def cuff(p, v, d, h=h, af=af, armown=armown, c0=c0, c1=c1):
            u = (p - h).dot(af); return min(u - c0, c1 - u, armown(v))
        g.add('cuff', cuff, .0075 if not male else .0065, ramp=.006, params=dict(side=sg, h=tuple(h), af=tuple(af), c0=c0, c1=c1), budget=60)
    g.tier_mark()

    # ---- tier 2: padded vest (olive, quilted, zip, two pockets) -----------------------------------------------------
    z0 = B['spine'][0].z + .005 if not male else B['torso'][0].z + .03
    nk = B['neck'][0]; cn = nk + Vector((.03, 0, .035)); rn = .088 if not male else .095
    yA = B['armL'][0].y - .006                                   # armholes: a straight cut down the sides, inside the shoulder joint
    TORSO = ['hip', 'torso', 'spine', 'chest', 'clavicleL', 'clavicleR', 'neck', 'backpackSocket']
    def vest(p, v, d):
        if v is None: return min(p.z - z0, (p - cn).length - rn, yA - abs(p.y))
        return min(p.z - z0, (p - cn).length - rn, yA - abs(p.y), (W(v, TORSO) - .55) * .08, (.03 - bagW(v)) * .5, (.35 - W(v, ['head'])) * .1)
    g.add('vest', vest, .010 if not male else .009, ramp=.02, keep='big', params=dict(z0=z0, z1=nk.z), budget=620)
    g.tier_mark()

    # ---- tier 3: shoulder pads, elbow pads, utility belt -------------------------------------------------------------
    for s, sg in (('L', 1), ('R', -1)):
        c = B['arm' + s][0]; out = Vector((0, sg, .6)).normalized(); cc = c + Vector((0, sg * .012, .012))
        def shoulder(p, v, d, c=c, cc=cc, out=out, s=s):
            f = min(.06 - (p - cc).length, (p - c).dot(out) - .004)
            if v is None: return f
            return min(f, (W(v, ['arm' + s, 'clavicle' + s, 'chest', 'elbow' + s]) - .5) * .06, (.03 - bagW(v)) * .5)
        g.add('shoulder', shoulder, .012 if not male else .010, ramp=.016, params=dict(side=sg), budget=70)
    for s, sg in (('L', 1), ('R', -1)) if lod < 2 else ():
        a = (B['hand' + s][0] - B['arm' + s][0]).normalized(); e = body.ring(B['foreArm' + s][0], a, side_names(s)['arm'])
        back = (Vector((-1, 0, 0)) - a * (-a.x)).normalized(); e2 = a.cross(back)
        armown = own(side_names(s)['arm'])
        def elbow(p, v, d, e=e, a=a, back=back, e2=e2, armown=armown):
            q = p - e; u = q.dot(a) + .004; r = q - a * q.dot(a)
            ang = math.degrees(math.atan2(r.dot(e2), r.dot(back)))
            return min(.035 * (1 - math.sqrt((u / .042) ** 2 + (ang / 62) ** 2)), armown(v))
        g.add('elbowpad', elbow, .009 if not male else .008, ramp=.012, budget=45)
    wz = B['torso'][0].z + .004 if not male else B['hip'][0].z - .01
    def belt(p, v, d):
        f = .017 - abs(p.z - wz)
        if v is None: return f
        return min(f, (.4 - W(v, ARMS)) * .06, (.03 - bagW(v)) * .5)
    g.add('belt', belt, .008, ramp=.006, keep='big', params=dict(wz=wz), budget=110)
    g.tier_mark()

    # ---- tier 4: forearm guards, goggles (strap + two lenses) --------------------------------------------------------
    for s, sg in (('L', 1), ('R', -1)) if lod < 2 else ():
        e0 = B['foreArm' + s][0]; h = B['hand' + s][0]; a = (h - e0); L = a.length; a = a.normalized(); e = body.ring(e0, a, side_names(s)['arm'])
        lat = (Vector((0, sg, 0)) - a * (a.y * sg)).normalized(); e2 = a.cross(lat)
        armown = own(side_names(s)['arm'])
        u0, u1 = (.22, .70) if not male else (.22, .62)
        def guard(p, v, d, e=e, a=a, L=L, lat=lat, e2=e2, armown=armown, u0=u0, u1=u1):
            q = p - e; uf = q.dot(a) / L; r = q - a * q.dot(a)
            ang = math.degrees(math.atan2(r.dot(e2), r.dot(lat)))
            return min((uf - u0) * L, (u1 - uf) * L, (80 - abs(ang)) / 80 * .03, armown(v))
        g.add('guard', guard, .007, ramp=.01, params=dict(side=sg, e=tuple(e), a=tuple(a), L=L), budget=60)
    head = B['head']
    capped = male
    if capped: hc = Vector((0.0, 0, head[1].z - .03)); band, lens_el = (31, 39), 63
    else: hc = Vector((head[0].x, 0, B['eyeL'][0].z + .025)); band, lens_el = (16, 24), 34
    PONY = ['pony1', 'pony2', 'pony3']
    def ang_of(p):
        d = (p - hc).normalized()
        return math.degrees(math.asin(clamp(d.z, -1, 1))), math.degrees(math.atan2(d.y, d.x)), (p - hc).length
    def headown(v):
        if v is None: return 1.0
        return min((W(v, ['head']) - .5) * .06, (.05 - W(v, PONY)) * .5)
    bc, bw = (band[0] + band[1]) / 2, (band[1] - band[0]) / 2
    def strap(p, v, d):
        el, az, r = ang_of(p)
        return min(math.radians(bw - abs(el - bc)) * r, math.radians(160 - abs(az)) * r, headown(v))
    g.add('strap', strap, .008 if not male else .010, ramp=.004, params=dict(hc=tuple(hc), bc=bc, bw=bw), budget=90, rim=.014)
    for az0 in (-22, 22):
        cdir = Vector((math.cos(math.radians(lens_el)) * math.cos(math.radians(az0)), math.cos(math.radians(lens_el)) * math.sin(math.radians(az0)), math.sin(math.radians(lens_el))))
        def lens(p, v, d, cdir=cdir):
            q = p - hc; r = q.length; ang = math.degrees(math.acos(clamp(q.normalized().dot(cdir), -1, 1)))
            return min(math.radians(14 - ang) * r, headown(v))
        g.add('lens', lens, .013 if not male else .012, ramp=.008, params=dict(hc=tuple(hc), cdir=tuple(cdir)), budget=40, rim=.009)
    g.tier_mark()
    return g

# ---------------------------------------------------------------------------------------------------------------------------
# Texture: every gear triangle is rasterised into its UV island; each texel knows its rest position, normal, piece and field
# value, and the piece's painter colours it (sRGB). Seams are dilated.
def srgb(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
def mix(a, b, t): t = np.clip(t, 0, 1)[..., None]; return a * (1 - t) + b * t
def band(x, w): return np.clip(1 - np.abs(x) / w, 0, 1)
def hash3(p, s=1.0):
    q = np.floor(p * s); v = np.sin(q[..., 0] * 127.1 + q[..., 1] * 311.7 + q[..., 2] * 74.7) * 43758.5453
    return v - np.floor(v)
def vnoise(p, s):
    """value noise (trilinear) in 0..1"""
    q = p * s; i = np.floor(q); f = q - i; f = f * f * (3 - 2 * f)
    acc = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                acc = acc + w * hash3(i + np.array([dx, dy, dz]), 1.0)
    return acc

def paint(kind, prm, P, N, F, male):
    """P, N: (n,3) rest position / normal; F: (n,) field (metres from the piece edge). Returns (n,3) sRGB."""
    n = len(P); grain = vnoise(P, 260) * .6 + vnoise(P, 90) * .4   # leather/fabric grain
    top = np.clip(N[:, 2], -1, 1)                                     # painted top light, as in the TRELLIS bakes
    def finish(c, edge_dark=.22, edge_w=.006, light=.10, g=.07):
        c = c * (1 + (grain[:, None] - .5) * g * 2)
        c = c * (1 + top[:, None] * light)
        c = c * (1 - edge_dark * np.clip(1 - F / edge_w, 0, 1))[:, None]
        return np.clip(c, 0, 1)
    if kind == 'glove':
        h, ah = np.array(prm['h']), np.array(prm['ah'])
        u = (P - h) @ ah                                              # along the hand (0 at the wrist)
        c = np.tile(srgb('#2d2826'), (n, 1))
        # back-of-hand knuckle panel (lighter, stitched outline): outward/forward-facing side of the fist
        side = np.array([0, prm['side'], 0]); back = N @ (side * .6 + np.array([.8, 0, 0]))
        panel = (back > .25) & (u > .012) & (u < .075)
        c[panel] = srgb('#45403b')
        edge = np.minimum(np.abs(back - .25) * .15, np.minimum(np.abs(u - .012), np.abs(u - .075)))
        stitch = (edge < .0018) & (np.sin(u * 900 + (P @ np.array([0, 0, 1])) * 900) > -.2) & (back > .2) & (u > .009) & (u < .078)
        c[stitch] = srgb('#8c8379')
        return finish(c, edge_dark=.0, light=.16, g=.12)
    if kind == 'cuff':
        h, af = np.array(prm['h']), np.array(prm['af'])
        u = (P - h) @ af; c0, c1 = prm['c0'], prm['c1']
        c = np.tile(srgb('#2f6e6a'), (n, 1))                            # backpack teal: the cuff matches the bag
        strap = np.abs(u - (c0 + c1) / 2) < (c1 - c0) * .22
        c[strap] = srgb('#1d2b2c')                                       # dark velcro strap round the middle
        out = N @ np.array([0, prm['side'], 0])
        tab = strap & (out > .8) & (np.abs(P[:, 0] - np.array(prm['h'])[0]) < .008)
        c[tab] = srgb('#eda04f')                                         # small orange pull tab
        rim = (np.minimum(u - c0, c1 - u) < .0035)
        c[rim] = c[rim] * .62
        return finish(c, edge_dark=.0, light=.12, g=.08)
    if kind in ('kneepad', 'elbowpad'):
        c = np.tile(srgb('#3b3e46'), (n, 1))
        c = mix(c, srgb('#596070'), np.clip((F - .004) / .02, 0, 1) * .6)       # moulded dome catches the light in the middle
        rim = F < .0028
        c[rim] = srgb('#8d93a0')                                                 # light rubber rim
        groove = (np.abs(np.sin(P[:, 2] * 260)) < .12) & (F > .011)
        c[groove] = c[groove] * .7
        return finish(c, edge_dark=.0, light=.14, g=.03)
    if kind == 'vest':
        z0, z1 = prm['z0'], prm['z1']
        c = np.tile(srgb('#6d7050'), (n, 1))
        # quilting: horizontal channels every 3.6 cm, a stitched seam (dark) with a soft puff (light) between
        ph = (P[:, 2] - z0) / .036; fr = ph - np.floor(ph)
        puff = np.sin(fr * math.pi)
        c = c * (.82 + .3 * puff)[:, None]
        seam = (fr < .07) | (fr > .93)
        c[seam] = srgb('#45482f')
        stitch = seam & (np.sin(np.arctan2(P[:, 1], P[:, 0]) * 260) > .1)
        c[stitch] = srgb('#8a8a66')
        front = (P[:, 0] > 0) & (N[:, 0] > .2)
        zip_ = front & (np.abs(P[:, 1]) < .0055)
        c[zip_] = srgb('#2a2a2a')
        teeth = zip_ & (np.abs(P[:, 1]) < .0028) & (np.sin(P[:, 2] * 1500) > 0)
        c[teeth] = srgb('#bbb5ab')
        pull = front & (np.abs(P[:, 1]) < .009) & (np.abs(P[:, 2] - (z1 - .055)) < .011)
        c[pull] = srgb('#d49a57')
        # two lower pockets with a flap line
        for sy in (1, -1):
            py = P[:, 1] * sy
            inside = front & (py > .028) & (py < .085) & (P[:, 2] > z0 + .012) & (P[:, 2] < z0 + .065)
            c[inside] = srgb('#62653f')
            outline = inside & ((py < .031) | (py > .082) | (P[:, 2] < z0 + .015) | (np.abs(P[:, 2] - (z0 + .052)) < .003))
            c[outline] = srgb('#3e4129')
        binding = F < .0035
        c[binding] = srgb('#4a4d32')                                     # bound edge round hem, neck and armholes
        return finish(c, edge_dark=.1, edge_w=.004, light=.12, g=.05)
    if kind == 'shoulder':
        c = np.tile(srgb('#3b3e46'), (n, 1))
        c = mix(c, srgb('#596070'), np.clip((F - .006) / .025, 0, 1) * .5)
        c[F < .0035] = srgb('#eda04f')                                   # tier 3: orange rim
        ridge = (np.abs(np.sin(F * 420)) < .12) & (F > .012)
        c[ridge] = c[ridge] * .72
        return finish(c, edge_dark=.0, light=.14, g=.06)
    if kind == 'belt':
        wz = prm['wz']; dz = P[:, 2] - wz
        c = np.tile(srgb('#5a3b29'), (n, 1))
        edge = np.abs(np.abs(dz) - .012) < .0015
        c[edge & (np.sin(np.arctan2(P[:, 1], P[:, 0]) * 220) > 0)] = srgb('#b08a5e')   # stitched edges
        front = (P[:, 0] > 0) & (N[:, 0] > .4)
        buckle = front & (np.abs(P[:, 1]) < .02) & (np.abs(dz) < .016)
        c[buckle] = srgb('#d49a57')
        hole = buckle & (np.abs(P[:, 1]) < .012) & (np.abs(dz) < .008)
        c[hole] = srgb('#3a2619')
        side = np.abs(P[:, 1]) > .0
        pouch = (np.abs(np.arctan2(P[:, 1], P[:, 0]) - (1.2 if not male else -1.2)) < .28) & (np.abs(dz) < .016)
        c[pouch] = srgb('#6d7050')
        return finish(c, edge_dark=.15, edge_w=.003, light=.10, g=.12)
    if kind == 'guard':
        e, a, L = np.array(prm['e']), np.array(prm['a']), prm['L']
        uf = ((P - e) @ a) / L
        c = np.tile(srgb('#4a4f58'), (n, 1))
        c = mix(c, srgb('#6a7180'), np.clip((F - .004) / .015, 0, 1) * .5)
        ridge = (np.abs(uf - .40) < .012) | (np.abs(uf - .52) < .012)
        c[ridge] = c[ridge] * .68
        c[F < .004] = srgb('#25222c')
        rivet = (F > .004) & (F < .009) & (np.abs(np.sin(uf * 60)) > .97)
        c[rivet] = srgb('#d6d1c8')
        return finish(c, edge_dark=.0, light=.14, g=.06)
    if kind == 'strap':
        hc = np.array(prm['hc']); d = P - hc; el = np.degrees(np.arcsin(np.clip(d[:, 2] / np.linalg.norm(d, axis=1), -1, 1)))
        c = np.tile(srgb('#26252b'), (n, 1))
        weave = np.abs(np.abs(el - prm['bc']) - prm['bw'] * .55) < .5
        c[weave] = srgb('#3c3b44')
        return finish(c, edge_dark=.25, edge_w=.003, light=.10, g=.10)
    if kind == 'lens':
        hc, cd = np.array(prm['hc']), np.array(prm['cdir'])
        q = (P - hc); q = q / np.linalg.norm(q, axis=1)[:, None]
        c = np.tile(srgb('#0a5f6b'), (n, 1))
        c = mix(c, srgb('#33b2bd'), np.clip((q @ np.array([0, 0, 1]) - cd[2]) * 8 + .3, 0, 1) * .5)   # sky reflection on top
        # glint crescent
        up = np.array([0, 0, 1.0]); ref = cd + up * .09
        glint = (np.linalg.norm(q - ref / np.linalg.norm(ref), axis=1) < .05) & (F > .008)
        c[glint] = srgb('#e8fbff')
        c[F < .0025] = srgb('#c9ccd2')                                    # silver frame
        c[(F >= .0025) & (F < .0038)] = srgb('#1c1f24')
        return np.clip(c * (1 + top[:, None] * .06), 0, 1)
    raise ValueError(kind)

PROJ = {'glove': 'cyl', 'cuff': 'cyl', 'vest': 'cyl', 'belt': 'cyl', 'strap': 'cyl'}
def unwrap(g, me):
    """One island per piece: a planar projection (pads, lenses, guards) or a cylinder round the piece axis (gloves, cuffs, vest,
    belt, strap), in metres; the islands are shelf-packed into the unit square at one texel density."""
    P = [v['p'] for v in g.verts]
    by_piece = {}
    for poly, t in zip(me.polygons, g.tris): by_piece.setdefault(t[3], []).append(poly)
    flat = {}
    for pid, polys in by_piece.items():
        kind, prm = g.pieces[pid]
        vids = sorted({vi for p in polys for vi in p.vertices})
        c = sum((P[i] for i in vids), Vector()) / len(vids)
        n = sum((g.verts[i]['n'] for i in vids), Vector()).normalized()
        if PROJ.get(kind) == 'cyl':
            axis = Vector(prm['ah'] if kind == 'glove' else prm['af'] if kind == 'cuff' else (0, 0, 1)).normalized()
            if kind in ('glove', 'cuff'): c = Vector(prm['h'])
            if kind == 'strap': c = Vector(prm['hc'])
            e1 = (Vector((1, 0, 0)) - axis * axis.x).normalized(); e2 = axis.cross(e1)
            r = sum(((P[i] - c) - axis * (P[i] - c).dot(axis)).length for i in vids) / len(vids)
            def uv(q, c=c, axis=axis, e1=e1, e2=e2, r=r):
                d = q - c; return [math.atan2(d.dot(e2), d.dot(e1)) * r, d.dot(axis)]
            for p in polys:
                co = [uv(P[i]) for i in p.vertices]
                us = [x[0] for x in co]
                if max(us) - min(us) > math.pi * r:   # crosses the seam at the back: unwrap the corners on the negative side
                    for x in co:
                        if x[0] < 0: x[0] += 2 * math.pi * r
                flat[p.index] = co
        else:
            e1 = (Vector((0, 0, 1)) - n * n.z); e1 = e1.normalized() if e1.length > .1 else (Vector((1, 0, 0)) - n * n.x).normalized()
            e2 = n.cross(e1)
            for p in polys: flat[p.index] = [[(P[i] - c).dot(e2), (P[i] - c).dot(e1)] for i in p.vertices]
    rects = []
    for pid, polys in by_piece.items():
        us = [x[0] for p in polys for x in flat[p.index]]; vs = [x[1] for p in polys for x in flat[p.index]]
        rects.append((pid, min(us), min(vs), max(us) - min(us), max(vs) - min(vs)))
    def pack(s, place=False):
        x = y = row = 0.0; pad = 4 / TEX; spots = {}
        for pid, u0, v0, w, h in sorted(rects, key=lambda r: -r[4]):
            W, H = w * s + pad, h * s + pad
            if x + W > 1: x, y, row = 0.0, y + row, 0.0
            spots[pid] = (x + pad / 2, y + pad / 2); x += W; row = max(row, H)
        return y + row <= 1, spots
    lo, hi = 1.0, 400.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if pack(mid)[0]: lo = mid
        else: hi = mid
    _, spots = pack(lo)
    rect = {r[0]: r for r in rects}
    layer = me.uv_layers.new(name='UVMap').data
    for p in me.polygons:
        pid = g.tris[p.index][3]; _, u0, v0, _, _ = rect[pid]; ox, oy = spots[pid]
        for li, x in zip(p.loop_indices, flat[p.index]): layer[li].uv = (ox + (x[0] - u0) * lo, oy + (x[1] - v0) * lo)
    print('UV texels per cm', round(lo * TEX / 100, 1))

def bake(g, me, size):
    uv = me.uv_layers.active.data
    tri_uv = np.array([[uv[li].uv[:] for li in p.loop_indices] for p in me.polygons]) * size
    vids = np.array([list(p.vertices) for p in me.polygons])
    P = np.array([v['a'][:] for v in g.verts]); Nn = np.array([v['n'][:] for v in g.verts]); Fv = np.array([v['f'] for v in g.verts])
    piece = np.array([t[3] for t in g.tris])
    buf = np.zeros((size, size, 7), np.float32); pid = -np.ones((size, size), np.int32)
    for t in range(len(vids)):
        A, Bq, C = tri_uv[t]
        x0, y0 = np.floor(np.minimum(np.minimum(A, Bq), C) - 1).astype(int); x1, y1 = np.ceil(np.maximum(np.maximum(A, Bq), C) + 1).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, size - 1), min(y1, size - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        den = (Bq[1] - C[1]) * (A[0] - C[0]) + (C[0] - Bq[0]) * (A[1] - C[1])
        if abs(den) < 1e-12: continue
        w0 = ((Bq[1] - C[1]) * (xs - C[0]) + (C[0] - Bq[0]) * (ys - C[1])) / den
        w1 = ((C[1] - A[1]) * (xs - C[0]) + (A[0] - C[0]) * (ys - C[1])) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -.02) & (w1 >= -.02) & (w2 >= -.02)
        if not m.any(): continue
        W3 = np.stack([w0[m], w1[m], w2[m]], 1)
        a, b, c = vids[t]
        pos = W3 @ P[[a, b, c]]; nn = W3 @ Nn[[a, b, c]]; ff = W3 @ Fv[[a, b, c]]
        yy, xx = (ys[m] - .5).astype(int), (xs[m] - .5).astype(int)
        buf[yy, xx, :3] = pos; buf[yy, xx, 3:6] = nn; buf[yy, xx, 6] = ff; pid[yy, xx] = piece[t]
    img = np.zeros((size, size, 3))
    for k, (kind, prm) in enumerate(g.pieces):
        m = pid == k
        if not m.any(): continue
        N = buf[m][:, 3:6]; N = N / np.maximum(np.linalg.norm(N, axis=1), 1e-6)[:, None]
        img[m] = paint(kind, prm, buf[m][:, :3].astype(np.float64), N, buf[m][:, 6].astype(np.float64), g.body.male)
    # dilate islands into the empty space (mip/bilinear bleed)
    filled = pid >= 0
    for _ in range(8):
        acc = np.zeros_like(img); cnt = np.zeros((size, size))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(img, dy, 0), dx, 1); sf = np.roll(np.roll(filled, dy, 0), dx, 1)
            acc += sh * sf[..., None]; cnt += sf
        grow = (~filled) & (cnt > 0)
        img[grow] = acc[grow] / cnt[grow][:, None]; filled = filled | grow
    img[~filled] = srgb('#3b3e46')
    return img

def finish(g, body, variant, lod, out):
    me = bpy.data.meshes.new('gear'); obj = bpy.data.objects.new('courierGear', me); bpy.context.scene.collection.objects.link(obj)
    verts = g.verts
    # degenerate triangles (coincident corners after decimation, zero-height wall pieces) are dropped by the glTF exporter, which would
    # shift every later tier's draw range: drop them here and recount the tier ends
    keep, ends, k, seen_tris = [], [], 0, set()
    for ti, (a, b, c, pid) in enumerate(g.tris):
        while k < len(g.tier_end) and ti >= g.tier_end[k]: ends.append(len(keep)); k += 1
        pa, pb, pc = verts[a]['p'], verts[b]['p'], verts[c]['p']
        key = tuple(sorted((a, b, c)))
        if key in seen_tris: continue
        seen_tris.add(key)
        if len({a, b, c}) == 3 and min((pa - pb).length, (pb - pc).length, (pc - pa).length) > 1e-4 and (pb - pa).cross(pc - pa).length > 1e-8: keep.append((a, b, c, pid))
    while len(ends) < len(g.tier_end): ends.append(len(keep))
    g.tris, g.tier_end = keep, ends
    me.from_pydata([v['p'] for v in verts], [], [(a, b, c) for a, b, c, _ in g.tris])
    me.update()
    for p in me.polygons: p.use_smooth = True
    assert len(me.polygons) == len(g.tris)
    unwrap(g, me)
    img = bake(g, me, TEX)
    im = bpy.data.images.new('gearTex', TEX, TEX, alpha=False)
    px = np.ones((TEX, TEX, 4), np.float32); px[..., :3] = img
    im.pixels.foreach_set(px.ravel()); im.file_format = 'PNG'
    if '--dump-tex' in ARGS: im.filepath_raw = str(out.with_suffix('.png')); im.save()
    im.pack()
    mat = bpy.data.materials.new('tex_baseColor'); mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 1.0
    node = mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image = im
    mat.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.append(mat)
    # Skin weights: Blender Data Transfer (vertex groups, nearest face interpolated) from the body mesh, evaluated at each vertex's
    # anchor on the body surface, so the weights are the body's own blend at that spot.
    tmp_me = bpy.data.meshes.new('anchors'); tmp_me.from_pydata([v['a'] for v in verts], [], []); tmp_me.update()
    tmp = bpy.data.objects.new('anchors', tmp_me); bpy.context.scene.collection.objects.link(tmp)
    for name in body.names: tmp.vertex_groups.new(name=name)
    mod = tmp.modifiers.new('xfer', 'DATA_TRANSFER')
    mod.object = body.obj; mod.use_vert_data = True; mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'POLYINTERP_NEAREST'; mod.layers_vgroup_select_src = 'ALL'; mod.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = tmp
    with bpy.context.temp_override(object=tmp, active_object=tmp):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    inner = me.attributes.new('_inner', 'FLOAT', 'POINT')   # 1 on the rim vertices (in the skin): the Scene Lab guard measures only these
    for vi, v in enumerate(verts): inner.data[vi].value = float(v['inner'])
    groups = {}
    for vi, v in enumerate(tmp.data.vertices):
        merged = {}
        for ge in v.groups:
            name = tmp.vertex_groups[ge.group].name; merged[name] = merged.get(name, 0) + ge.weight
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
    obj['tierTris'] = json.dumps(g.tier_end)
    obj['lod'] = lod
    obj['asset_id'] = f'acc.courier-gear.{variant}'
    bpy.data.objects.remove(body.obj, do_unlink=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    body.rig.select_set(True); obj.select_set(True)
    bpy.context.view_layer.objects.active = body.rig
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_yup=True, export_extras=True,
                              export_cameras=False, export_lights=False, export_texcoords=True, export_normals=True, export_animations=False,
                              export_skins=True, export_influence_nb=4, export_def_bones=False, export_vertex_color='NONE', export_attributes=True)
    print('GEAR', out.name, 'pieces', g.log, 'tier cumulative tris', g.tier_end, 'verts', len(verts))

BODY_FILE = {0: 'char.courier-{}.skin.glb', 1: 'char.courier-{}.skin.low.glb', 2: 'char.courier-{}.skin.low.glb'}
SUFFIX = {0: '.tiers.glb', 1: '.tiers.low.glb', 2: '.tiers.lod2.glb'}
MODELS = REPO / 'public/assets/models'
if '--body-dir' in ARGS: MODELS = Path(arg('--body-dir'))
for variant in ([ONLY] if ONLY else ['female', 'male']):
    for lod in LODS:
        body = Body(MODELS / BODY_FILE[lod].format(variant))
        gear = build_gear(body, lod)
        finish(gear, body, variant, lod, OUT / f'acc.courier-gear.{variant}{SUFFIX[lod]}')
