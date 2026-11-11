"""r36-lion: big-cat body for the L8 lion and lioness, built headless in Blender.

Run: python3 tools/blender/run.py assets/amb.lion/build_cat.py -- --out <dir> [--preview <dir>]
Writes <out>/cat.<species>.lod<N>.json (positions, normals, swatch id + gradient t per vertex, skin joints and weights)
for tools/assets/build-l8-cats.ts, which assembles the skinned GLBs on the SHIPPED rig (same joints, same bind pose).

World frame = the game rig frame (+X forward, +Y up, Z lateral), metres, before assetScale. Joint positions are the
rest-pose joint world positions of the shipped amb.lion rig; every part is bound to them by chain weights.
Blender is used for the vertex normals, triangulation and the preview renders (Workbench, vertex colours).
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--preview')
ap.add_argument('--species', default='lion,lioness')
ap.add_argument('--lods', default='0,1,2')
args = ap.parse_args(argv)

# ---- rig (shipped rest pose; R = +z side, L = -z side) -------------------------------------------------------------
J = {
    'hip': (-.453, .593, 0), 'torso': (.023, .663, 0), 'neck': (.359, .773, 0), 'head': (.468, .843, 0), 'jaw': (.625, .71, 0),
    'tail': (-.656, .695, 0),
    'armR': (.336, .671, .207), 'foreArmR': (.39, .382, .25), 'handR': (.57, .148, .273),
    'armL': (.336, .671, -.207), 'foreArmL': (.39, .382, -.25), 'handL': (.508, .148, -.273),
    'legR': (-.508, .609, .172), 'shinR': (-.383, .367, .234), 'footR': (-.593, .101, .258),
    'legL': (-.508, .609, -.172), 'shinL': (-.383, .367, -.234), 'footL': (-.593, .101, -.258),
}

def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def length(a): return math.sqrt(dot(a, a))
def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
def norm(a):
    n = length(a)
    return (a[0] / n, a[1] / n, a[2] / n) if n > 1e-9 else (0, 1, 0)
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def clamp01(v): return max(0.0, min(1.0, v))

def chain_weights(p, chain, band):
    """Linear-skin weights along a joint chain: a ramp of +-band metres centred on every joint after the first."""
    pts = [J[n] for n in chain]
    cum = [0.0]
    for i in range(1, len(pts)): cum.append(cum[-1] + length(sub(pts[i], pts[i - 1])))
    # project onto the polyline
    best = (1e9, 0.0)
    for i in range(len(pts) - 1):
        d = sub(pts[i + 1], pts[i]); L = max(1e-9, length(d))
        t = max(0.0, min(1.0, dot(sub(p, pts[i]), d) / (L * L)))
        q = add(pts[i], mul(d, t))
        dist = length(sub(p, q))
        if dist < best[0]: best = (dist, cum[i] + t * L)
    s = best[1]
    # the first/last segments extend freely beyond the chain ends
    d0 = sub(pts[1], pts[0]); L0 = length(d0)
    if dot(sub(p, pts[0]), d0) < 0: s = dot(sub(p, pts[0]), d0) / L0
    dl = sub(pts[-1], pts[-2]); Ll = length(dl)
    if dot(sub(p, pts[-1]), dl) > 0: s = cum[-1] + dot(sub(p, pts[-1]), dl) / Ll
    w = {n: 0.0 for n in chain}
    owner = 0
    for i in range(1, len(chain)):
        if s >= cum[i]: owner = i
    # find ramp
    w[chain[owner]] = 1.0
    for i in range(1, len(chain)):
        if abs(s - cum[i]) < band:
            f = .5 + .5 * (s - cum[i]) / band
            w = {n: 0.0 for n in chain}
            w[chain[i]] = f; w[chain[i - 1]] = 1 - f
            break
    return [(n, v) for n, v in w.items() if v > 1e-4]

# ---- mesh kit -------------------------------------------------------------------------------------------------------
class Mesh:
    def __init__(self): self.P = []; self.F = []; self.S = []; self.T = []; self.B = []

M = Mesh()

def emit(verts, faces, swatch, bind, smooth_t=None):
    """verts: points; faces: index tuples; swatch: name or fn(p, n)->(name, t); bind: fn(p)->[(joint, w)]"""
    base = len(M.P)
    for v in verts:
        M.P.append(v)
        M.S.append(swatch if isinstance(swatch, tuple) or isinstance(swatch, str) else swatch)
        M.B.append(bind(v))
    for f in faces: M.F.append(tuple(base + i for i in f))
    return base

def ellipsoid(c, r, seg, ring, swatch, bind, tfun=None, axes=None, squash=None):
    """UV sphere with radii r=(rx,ry,rz) centred at c; optional rotation axes (3 unit vectors for x,y,z)."""
    ax = axes or ((1, 0, 0), (0, 1, 0), (0, 0, 1))
    verts = [add(c, mul(ax[1], r[1]))]
    for j in range(1, ring):
        phi = math.pi * j / ring
        for i in range(seg):
            th = math.tau * i / seg
            lx = math.sin(phi) * math.cos(th) * r[0]; ly = math.cos(phi) * r[1]; lz = math.sin(phi) * math.sin(th) * r[2]
            verts.append(add(c, add(add(mul(ax[0], lx), mul(ax[1], ly)), mul(ax[2], lz))))
    verts.append(add(c, mul(ax[1], -r[1])))
    faces = []
    for i in range(seg): faces.append((0, 1 + (i + 1) % seg, 1 + i))
    for j in range(ring - 2):
        for i in range(seg):
            a = 1 + j * seg + i; b = 1 + j * seg + (i + 1) % seg
            faces.append((a, b, b + seg)); faces.append((a, b + seg, a + seg))
    last = len(verts) - 1
    for i in range(seg): faces.append((last, 1 + (ring - 2) * seg + i, 1 + (ring - 2) * seg + (i + 1) % seg))
    emit(verts, faces, swatch, bind)

def loft(rings, n, swatch, bind, caps=(True, True), phase=0.0):
    """rings: list of (centre, u_axis_vec, w_axis_vec) already scaled; n sides."""
    verts = []; faces = []
    for (c, u, w) in rings:
        for i in range(n):
            t = math.tau * (i + phase) / n
            verts.append(add(c, add(mul(u, math.cos(t)), mul(w, math.sin(t)))))
    for j in range(len(rings) - 1):
        for i in range(n):
            a = j * n + i; b = j * n + (i + 1) % n
            faces.append((a, a + n, b)); faces.append((b, a + n, b + n))
    if caps[0]:
        c0 = len(verts); verts.append(rings[0][0])
        for i in range(n): faces.append((c0, (i + 1) % n, i))
    if caps[1]:
        c1 = len(verts); verts.append(rings[-1][0]); o = (len(rings) - 1) * n
        for i in range(n): faces.append((c1, o + i, o + (i + 1) % n))
    emit(verts, faces, swatch, bind)

def tube(points, radii, n, swatch, bind, caps=(True, True), flat_y=1.0):
    rings = []
    for k, p in enumerate(points):
        d = norm(sub(points[min(k + 1, len(points) - 1)], points[max(k - 1, 0)]))
        ref = (0, 0, 1) if abs(d[2]) < .9 else (0, 1, 0)
        u = norm(cross(d, ref)); w = norm(cross(d, u))
        r = radii[k]
        rx, ry = (r, r) if not isinstance(r, tuple) else r
        rings.append((p, mul(u, rx), mul(w, ry)))
    loft(rings, n, swatch, bind, caps)

def smooth_ring(p0, p1, k):  # catmull-less simple lerp helper
    return lerp(p0, p1, k)

# ---- palettes (swatch = horizontal gradient strip; t in 0..1 picks the colour along it) ---------------------------------
def hexc(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
PAL = {
    False: {  # healthy
        'coat': ['#ead3a0', '#d2a062', '#b57a3c'], 'cream': ['#f0dfb8', '#e4c994'], 'mane': ['#5a3319', '#8c5428', '#bd8240'],
        'dark': ['#2b1c18', '#3a2824'], 'tooth': ['#f6f0e2', '#e9dfc9'], 'tuft': ['#3b2415', '#5d3a20'], 'ear': ['#5b3a22', '#7a5230'],
        'pad': ['#3d2c30', '#4a3438'], 'wound': ['#d2a062', '#d2a062'], 'earIn': ['#d8b48a', '#c99a74'],
    },
    True: {  # infected: same tan coat, redder mane, wounds
        'coat': ['#e2c796', '#c99458', '#a46b34'], 'cream': ['#e6d2aa', '#d8bb8a'], 'mane': ['#552618', '#8a4522', '#b66e32'],
        'dark': ['#2a1a17', '#3a2523'], 'tooth': ['#f3ecd8', '#e6dcc2'], 'tuft': ['#3a2014', '#6a3220'], 'ear': ['#5a3220', '#7a4a2c'],
        'pad': ['#3d2a2e', '#4a3236'], 'wound': ['#8a1f1f', '#c23a2a'], 'earIn': ['#d4a982', '#c08a68'],
    },
}
SWATCHES = ['coat', 'cream', 'mane', 'dark', 'tooth', 'tuft', 'ear', 'pad', 'wound', 'earIn']

# ---- cat model ---------------------------------------------------------------------------------------------------------
def build(species, lod):
    M.__init__()
    lion = species == 'lion'
    # resolution per lod
    sides = [10, 7, 5][lod]; seg = [12, 8, 6][lod]; rng = [8, 6, 4][lod]
    body_div = [3, 2, 1][lod]  # extra rings between body profile rings
    detail = lod == 0

    def b_chain(chain, band): return lambda p: chain_weights(p, chain, band)
    def b_one(j): return lambda p: [(j, 1.0)]
    B_barrel = b_chain(['hip', 'torso'], .30)
    B_neck = b_chain(['torso', 'neck', 'head'], .09)
    B_head = b_one('head'); B_jaw = b_one('jaw')
    B_tail = b_chain(['hip', 'tail'], .06)

    # ---- barrel / chest / rump
    prof = [  # x, cy, ry, rz
        (-.70, .70, .12, .10), (-.63, .70, .19, .15), (-.46, .70, .245, .185), (-.22, .665, .205, .165),
        (.04, .65, .25, .19), (.26, .655, .30, .215), (.42, .70, .28, .20), (.52, .75, .19, .14),
    ]
    rings = []
    for k in range(len(prof) - 1):
        for s in range(body_div):
            f = s / body_div
            a, b = prof[k], prof[k + 1]
            x, cy, ry, rz = [a[i] + (b[i] - a[i]) * f for i in range(4)]
            rings.append(((x, cy, 0), (0, ry, 0), (0, 0, rz)))
    a = prof[-1]; rings.append(((a[0], a[1], 0), (0, a[2], 0), (0, 0, a[3])))
    def sw_body(p, nrm):
        return ('coat', clamp01(.52 + .5 * nrm[1]))
    loft(rings, sides + 4, sw_body, B_barrel)

    # ---- neck (the lioness's visible neck; under the mane on the lion)
    tube([(.40, .735, 0), (.50, .785, 0), (.585, .815, 0)], [.15, .13, .115], sides, ('coat', .5), B_neck, caps=(False, False))

    # ---- head
    hc = (.595, .81, 0)
    k = 1.12 if lion else 1.03
    ellipsoid(hc, (.15 * k, .135 * k, .125 * k), seg + 2, rng + 2, ('coat', .45), B_head)
    mz = (.73, .765, 0)
    ellipsoid(mz, (.125 * k * (1 if lion else 1.12), .075 * k * (1 if lion else .92), .09 * k * (1 if lion else .9)), seg, rng, ('cream', .35), B_head)           # muzzle
    ellipsoid((.86, .795, 0), (.04, .033, .05), seg - 2 if seg > 6 else 5, max(3, rng - 2), ('dark', .1), B_head)  # nose
    ellipsoid((.755, .70, 0), (.1 * k, .042, .07 * k), seg, max(3, rng - 2), ('cream', .5), B_jaw)  # chin / lower jaw
    if lod < 2:
        ellipsoid((.75, .735, 0), (.085, .012, .06), 6, 3, ('dark', .4), B_head)           # mouth line
    for s in (-1, 1):
        ellipsoid((.52, .945, s * .10), (.052, .06, .034), 6, 4, ('ear', .3), B_head)   # ears
        if lod < 2: ellipsoid((.535, .94, s * .102), (.03, .038, .022), 5, 3, ('earIn', .4), B_head)
        ellipsoid((.685, .862, s * .072), (.05, .026, .045), 6, 3, ('coat', .1), B_head)  # brows
    if lod == 0:
        for s in (-1, 1):
            ellipsoid((.82, .735, s * .055), (.013, .033, .013), 5, 3, ('tooth', .1), B_head, axes=((1, 0, 0), (0, -1, 0), (0, 0, 1)))
            ellipsoid((.81, .715, s * .05), (.012, .028, .012), 5, 3, ('tooth', .1), B_jaw)
    # ---- mane (lion): a hood from the withers around the head, face left free, hanging as a bib under the chin
    if lion:
        n_m = [28, 16, 10][lod]
        stages = [  # t along neck->face axis, centre, up, down, side
            (.12, .74, .12, .17, .18), (.22, .755, .20, .27, .26), (.32, .775, .25, .34, .32), (.43, .79, .27, .36, .33),
            (.52, .80, .26, .32, .31), (.60, .81, .23, .27, .27), (.655, .815, .20, .22, .21),
        ]
        mr = []
        for (x, cy, up, down, side) in stages:
            mr.append((x, cy, up, down, side))
        verts = []; faces = []
        for (x, cy, up, down, side) in mr:
            for i in range(n_m):
                t = math.tau * i / n_m
                tooth = 1.0 + (.2 if (i % 2) else 0.0) + (.08 if x < .5 and i % 4 == 1 else 0)
                ct, st = math.cos(t), math.sin(t)
                vy = (up if st >= 0 else down) * st * tooth
                verts.append((x - .02 * abs(st) * (x > .5 and 1 or 0), cy + vy, side * ct * tooth))
        for j in range(len(mr) - 1):
            for i in range(n_m):
                a = j * n_m + i; b = j * n_m + (i + 1) % n_m
                faces.append((a, a + n_m, b)); faces.append((b, a + n_m, b + n_m))
        # close the back
        c0 = len(verts); verts.append((mr[0][0] - .03, mr[0][1] + .01, 0))
        for i in range(n_m): faces.append((c0, (i + 1) % n_m, i))
        def sw_mane(p, nrm):
            # lighter tips toward the rim and the lower hang, dark in the roots toward the shoulders
            return ('mane', clamp01((p[0] - .14) / .55 * .5 + (.3 if (p[1] < .6) else 0) + (.25 if math.hypot(p[1] - .8, p[2]) > .3 else 0)))
        emit(verts, faces, sw_mane, b_chain(['neck', 'head'], .12))
        # chest ruff: lower hang of the mane between the forelegs
        if lod < 2:
            ellipsoid((.40, .55, 0), (.15, .15, .15), seg, max(4, rng - 1), ('mane', .25), B_neck)
    else:
        if lod < 2:
            ellipsoid((.46, .70, 0), (.13, .12, .13), seg, rng, ('cream', .6), B_neck)   # lioness: plain chest

    # ---- legs
    def leg_front(side, name):
        sh, el, wr = J['arm' + side], J['foreArm' + side], J['hand' + side]
        chain = ['arm' + side, 'foreArm' + side, 'hand' + side]
        B = b_chain(chain, .07)
        tube([add(sh, (0, .02, 0)), lerp(sh, el, .5), el, lerp(el, wr, .5), (wr[0] + .02, .085, wr[2])],
             [.12, .105, .085, .078, .07], sides, ('coat', .42), B, caps=(False, False))
        # paw
        ellipsoid((wr[0] + .04, .058, wr[2] * .97), (.115, .06, .08), seg, max(3, rng - 1), ('cream', .4), b_one('hand' + side))
        if lod == 0:
            for dz in (-.035, 0, .035):
                ellipsoid((wr[0] + .125, .035, wr[2] * .97 + dz), (.03, .028, .03), 6, 3, ('cream', .5), b_one('hand' + side))
    def leg_rear(side):
        hp, kn, an = J['leg' + side], J['shin' + side], J['foot' + side]
        chain = ['leg' + side, 'shin' + side, 'foot' + side]
        B = b_chain(chain, .07)
        zs = 1 if side == 'R' else -1
        ellipsoid((-.53, .555, zs * .19), (.2, .235, .115), seg, rng, ('coat', .45), b_chain(['leg' + side, 'shin' + side], .12))  # haunch
        tube([lerp(hp, kn, .25), kn, lerp(kn, an, .5), an, (an[0] + .01, .045, an[2])],
             [.115, .08, .07, .062, .058], sides, ('coat', .35), B, caps=(False, False))
        ellipsoid((an[0] + .06, .052, an[2]), (.11, .052, .07), seg, max(3, rng - 1), ('cream', .4), b_one('foot' + side))
    for s in ('R', 'L'): leg_front(s, s)
    for s in ('R', 'L'): leg_rear(s)

    # ---- tail
    tp = [(-.66, .70, 0), (-.80, .67, 0), (-.97, .56, 0), (-1.10, .45, 0), (-1.20, .47, 0), (-1.26, .57, 0)]
    tube(tp, [.048, .044, .04, .037, .035, .034], max(4, sides - 2), ('coat', .3), B_tail, caps=(False, True))
    ellipsoid((-1.285, .65, 0), (.065, .115, .065), seg, max(4, rng - 1), ('tuft', .5), b_one('tail'), axes=((1, 0, 0), (0, 1, 0), (0, 0, 1)))

    # ---- wounds (infected palette only; healthy 'wound' swatch is the coat colour, so the patches vanish)
    if lod < 2:
        for (x, y, z, rx, ry) in [(-.05, .70, .19, .08, .07), (-.40, .72, -.185, .07, .06), (.25, .72, .20, .06, .08)]:
            for sgn in (1,):
                zz = z
                ellipsoid((x, y, zz), (rx, ry, .018), 7, 4, ('wound', .5), B_barrel, axes=((1, 0, 0), (0, 1, 0), (0, 0, 1)))
    # eye anchors on the skull surface (the shipped skin_eyes quads are re-seated here by build-l8-cats.ts)
    rx, ry, rz = .15 * k, .135 * k, .125 * k
    ex, ey = .69, hc[1] + .06
    dx, dy = (ex - hc[0]) / rx, (ey - hc[1]) / ry
    ez = rz * math.sqrt(max(.05, 1 - dx * dx - dy * dy))
    M.eyes = []
    for sgn in (1, -1):
        n = norm(((ex - hc[0]) / rx ** 2, (ey - hc[1]) / ry ** 2, sgn * ez / rz ** 2))
        M.eyes.append({'p': [ex, ey, sgn * ez], 'n': list(n)})
    return M

# ---- export + preview ---------------------------------------------------------------------------------------------------
def to_blender(mesh, name):
    me = bpy.data.meshes.new(name)
    # glTF (x, y up, z) -> Blender (x, -z, y)
    verts = [(p[0], -p[2], p[1]) for p in mesh.P]
    me.from_pydata(verts, [], [tuple(f) for f in mesh.F])
    me.update()
    return me

def export_json(species, lod, mesh, out):
    me = to_blender(mesh, f'{species}{lod}')
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    # smooth vertex normals from face-weighted accumulation (positions shared inside a part)
    me.calc_normals() if hasattr(me, 'calc_normals') else None
    obj = bpy.data.objects.new(f'{species}{lod}', me); bpy.context.collection.objects.link(obj)
    N = []
    for v in me.vertices:
        n = v.normal
        N.append([n.x, n.z, -n.y])  # back to glTF frame
    tris = []
    for poly in me.polygons: tris.extend(poly.vertices)
    # orientation: Blender winding outward in Blender frame; glTF conversion is a proper rotation (+90deg about X), keep
    sw, tt = [], []
    for i, s_ in enumerate(mesh.S):
        if callable(s_): nm, t = s_(mesh.P[i], N[i])
        elif isinstance(s_, tuple): nm, t = s_
        else: nm, t = s_, .5
        sw.append(nm); tt.append(round(t, 4))
    data = {
        'species': species, 'lod': lod,
        'P': [[round(p[0], 5), round(p[1], 5), round(p[2], 5)] for p in mesh.P],
        'N': [[round(c, 4) for c in n] for n in N],
        'S': sw, 'T': tt, 'B': mesh.B, 'I': tris, 'eyes': mesh.eyes,
    }
    data['palette'] = {str(infected).lower(): {k: PAL[infected][k] for k in SWATCHES} for infected in (False, True)}
    Path(out).mkdir(parents=True, exist_ok=True)
    Path(out, f'cat.{species}.lod{lod}.json').write_text(json.dumps(data))
    print('OK', species, 'lod', lod, 'tris', len(tris) // 3, 'verts', len(mesh.P))
    return obj, me, data

def vertex_colours(obj, me, data, infected):
    layer = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    pal = PAL[infected]
    for i, v in enumerate(me.vertices):
        stops = [hexc(c) for c in pal[data['S'][i]]]
        t = data['T'][i] * (len(stops) - 1); k = min(int(t), len(stops) - 2); f = t - k
        c = [stops[k][j] + (stops[k + 1][j] - stops[k][j]) * f for j in range(3)]
        lin = [x ** 2.2 for x in c]
        layer.data[i].color = (*lin, 1)

def preview(objs, out, tag):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.show_cavity = False
    scene.render.resolution_x = 900; scene.render.resolution_y = 450
    scene.world = bpy.data.worlds.new('w'); scene.world.color = (.2, .2, .24)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.collection.objects.link(cam); scene.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.9
    views = {'side': ((0, -6, .75), 'side'), 'front34': ((4.2, -4.4, 3.2), 'iso'), 'game': ((-3.6, -3.6, 3.4), 'game')}
    for name, (loc, _) in views.items():
        cam.location = loc
        tgt = Vector((-.1, 0, .6)); d = tgt - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(Path(out) / f'{tag}-{name}.png')
        bpy.ops.render.render(write_still=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
for species in args.species.split(','):
    objs = []
    for lod in map(int, args.lods.split(',')):
        mesh = build(species, lod)
        obj, me, data = export_json(species, lod, mesh, args.out)
        if args.preview and lod == 0:
            vertex_colours(obj, me, data, True)
            # preview in glTF-frame is rotated: the Blender object already uses Z-up
            preview([obj], args.preview, f'{species}')
            bpy.data.objects.remove(obj)
        elif True:
            bpy.data.objects.remove(obj)
print('DONE')
