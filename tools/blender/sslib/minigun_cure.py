"""L10 finale props: wpn.minigun-mounted, prop.cure-canister(-pedestal) and the kit.dispersal-* set.

Authored per tier with the shared Army builder (explicit closed solids, no decimation).
+X forward, Z up, metres, ground at Z=0. Spinning parts are their own owner nodes.
"""
import math
from mathutils import Euler, Matrix, Vector

STEEL, DARK, STRUCT, SAFETY, CONCRETE = 'silver', 'uiDark', 'oliveSeam', 'schoolBusYellow', 'sidewalk'


# ------------------------------------------------------------------------------ helpers
def pick(s, a, b, c):
    return (a, b, c)[s.lod]


def obox(s, name, center, axes, half, token, owner='body'):
    """Box with arbitrary orthonormal axes (three vectors) and half extents."""
    c = Vector(center)
    ax = [Vector(a).normalized() * h for a, h in zip(axes, half)]
    verts = [c + ax[0] * x + ax[1] * y + ax[2] * z for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return s.add(name, verts, faces, token, owner)


def ring_x(s, name, x0, x1, r_in, r_out, token, owner='body', center=(0, 0), seg=24):
    """Closed annulus (duct ring) around an axis parallel to X."""
    n = pick(s, seg, max(8, seg // 2), max(6, seg // 3))
    cy, cz = center
    rings = []
    for x, r in ((x0, r_out), (x1, r_out), (x1, r_in), (x0, r_in)):
        rings.append([(x, cy + r * math.cos(i * math.tau / n), cz + r * math.sin(i * math.tau / n)) for i in range(n)])
    verts = [v for ring in rings for v in ring]
    faces = [(j * n + i, j * n + (i + 1) % n, ((j + 1) % 4) * n + (i + 1) % n, ((j + 1) % 4) * n + i)
             for j in range(4) for i in range(n)]
    return s.add(name, verts, faces, token, owner)


def sweep(s, name, pts, r, token, owner='body', seg=16):
    n = pick(s, seg, 10, 6)
    pts = [Vector(p) for p in pts]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
        u = t.cross(ref).normalized()
        w = t.cross(u)
        rings.append([p + r * (math.cos(k * math.tau / n) * u + math.sin(k * math.tau / n) * w) for k in range(n)])
    return s.loft(name, rings, token, owner)


def vessel_x(s, name, x0, x1, R, cy, cz, head, token, owner='body', seg=20):
    """Horizontal pressure vessel with elliptical heads along X."""
    n = pick(s, seg, 12, 8)
    steps = pick(s, 5, 3, 2)
    profile = []
    for k in range(steps):
        phi = math.radians(78 * (steps - k) / steps)
        profile.append((x0 + head * (1 - math.sin(phi)), R * math.cos(phi)))
    head_a = profile
    head_b = [(x1 - (x - x0), r) for x, r in reversed(head_a)]
    rings_def = head_a + head_b
    rings = [[(x, cy + r * math.cos(i * math.tau / n), cz + r * math.sin(i * math.tau / n)) for i in range(n)] for x, r in rings_def]
    return s.loft(name, rings, token, owner)


def sphere(s, name, c, R, token, owner='body', seg=20):
    n = pick(s, seg, 12, 8)
    lats = pick(s, 11, 7, 5)
    rings = []
    for k in range(lats):
        lat = math.radians(-76 + 152 * k / (lats - 1))
        rings.append([(c[0] + R * math.cos(lat) * math.cos(i * math.tau / n), c[1] + R * math.cos(lat) * math.sin(i * math.tau / n),
                       c[2] + R * math.sin(lat)) for i in range(n)])
    return s.loft(name, rings, token, owner)


def railing(s, a, b, h=1.05, token=SAFETY, owner='body', spacing=2.0):
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    d = (b - a).normalized()
    posts = max(2, int(length / spacing) + 1)
    for i in range(posts):
        p = a + d * length * i / (posts - 1)
        s.box('rail post', (p.x, p.y, p.z + h / 2), (.09, .09, h), token, owner, bevel=0)
    mid = (a + b) / 2
    yaw = math.atan2(d.y, d.x)
    s.box('top rail', (mid.x, mid.y, mid.z + h), (length, .07, .07), token, owner, rot=(0, 0, yaw), bevel=0)
    if s.lod == 0:
        s.box('mid rail', (mid.x, mid.y, mid.z + h * .5), (length, .05, .05), token, owner, rot=(0, 0, yaw), bevel=0)


def fixed_physics(s, com_z=1.0):
    s.physics('fixed', 0, 'prop.metal-heavy', False, (0, com_z, 0))


# ------------------------------------------------------------------------------ minigun
def wpn_minigun_mounted(s):
    L = s.lod
    s.owner('body')
    s.owner('pivot', (0, 0, .95))
    s.owner('elevation', (0, 0, 1.38), 'pivot')
    s.owner('barrels', (.30, 0, 1.38), 'elevation')
    s.owner('heatGlow', (.30, 0, 1.38), 'barrels')
    s.ao_floor = .30
    # --- ground, sandbag ring open to the rear (-X) where the gunner stands
    s.frustum('dirt floor', (0, 0, 0), (0, 0, .04), 1.35, None, 'leatherShadow', 'body', seg=20)
    s.box('duckboard', (-.78, 0, .07), (.78, .95, .06), 'woodWarm', 'body', bevel=0)
    if L == 0:
        for sy in (-.28, .28):
            s.box('duckboard slat', (-.78, sy, .105), (.74, .05, .02), 'khakiSeam', 'body', bevel=0)
    rows = pick(s, 3, 3, 1)
    for k in range(rows):
        radius, z = 1.08 - .04 * k, .15 + .255 * k
        off = 18 * (k % 2)
        step = 36 if L < 2 else 45
        for i in range(-5, 6):
            th = off + i * step
            if abs(((th % 360) - 180)) < 52:
                continue
            a = math.radians(th)
            tok = 'khaki' if (i + k) % 3 else 'khakiLight'
            size = (.62, .40, .27) if L < 2 else (.8, .5, .78)
            jit = ((i * 7 + k * 3) % 5 - 2) * .006
            s.box('sandbag', (radius * math.cos(a), radius * math.sin(a), (z + jit) if L < 2 else .39), size, tok, 'body',
                  rot=(0, 0, a + math.pi / 2), bevel=.08 if L == 0 else 0)
    # --- pedestal column
    s.frustum('pedestal base', (0, 0, .04), (0, 0, .30), .34, .24, 'oliveSeam', 'body', seg=12)
    s.frustum('pedestal column', (0, 0, .30), (0, 0, .96), .17, None, DARK, 'body', seg=10)
    if L == 0:
        for a in (0, 120, 240):
            r = math.radians(a)
            s.rod('pedestal brace', (.60 * math.cos(r), .60 * math.sin(r), .05), (.11 * math.cos(r), .11 * math.sin(r), .62), .035, 'oliveSeam', 'body', seg=6)
    # --- pivot (yaw): yoke, shield, ammo box
    s.frustum('turntable', (0, 0, .94), (0, 0, 1.04), .30, None, 'oliveLight', 'pivot', seg=14)
    for sg in (-1, 1):
        s.box('yoke arm', (0, sg * .27, 1.2), (.30, .08, .50), 'olive', 'pivot', bevel=.02)
        s.cyl('trunnion', (0, sg * .33, 1.38), .075, .06, 'brass', 'pivot', axis='Y', seg=10)
    # shield: lower plate plus two angled wings; centre slot is open for barrel travel
    s.box('shield lower', (.80, 0, .88), (.06, 1.24, .32), 'olive', 'pivot', bevel=0)
    for sg in (-1, 1):
        wing = [(sg * .22, 1.04), (sg * .62, 1.04), (sg * .62, 1.52), (sg * .46, 1.76), (sg * .22, 1.76)]
        s.extrude_yz('shield wing', wing, .77, .83, 'olive', 'pivot')
        if L < 2:
            s.extrude_yz('shield slot rim', [(sg * .20, 1.04), (sg * .24, 1.04), (sg * .24, 1.76), (sg * .20, 1.76)], .745, .855, 'oliveSeam', 'pivot')
        if L == 0:
            for z in (.95, 1.25, 1.55):
                s.box('shield rivet', (.845, sg * .52, z), (.03, .05, .05), 'brass', 'pivot', bevel=0)
    s.box('ammo box', (-.10, -.50, 1.0), (.42, .30, .34), 'oliveSeam', 'pivot', bevel=.02)
    if L < 2:
        s.box('ammo lid', (-.10, -.50, 1.2), (.46, .34, .05), 'olive', 'pivot', bevel=0)
    # --- elevation: receiver, motor, feed, spade grips
    s.cyl('barrel housing', (.0, 0, 1.38), .19, .62, 'olive', 'elevation', axis='X', seg=14)
    s.cyl('housing band', (.22, 0, 1.38), .18, .06, DARK, 'elevation', axis='X', seg=14)
    s.box('drive motor', (-.46, 0, 1.38), (.34, .30, .30), 'oliveSeam', 'elevation', bevel=.03)
    s.cyl('feed drum', (-.18, -.30, 1.54), .17, .20, 'olive', 'elevation', axis='Y', seg=12)
    if L < 2:
        s.cyl('drum hub', (-.18, -.41, 1.54), .09, .04, 'brass', 'elevation', axis='Y', seg=8)
    if L == 0:
        s.rod('feed chute', (-.18, -.40, 1.38), (-.06, -.40, 1.0), .05, 'brass', 'elevation', seg=6)
        s.rod('power cable', (-.62, .1, 1.30), (-.50, .55, .98), .02, DARK, 'elevation', seg=5)
    s.box('top sight', (.10, 0, 1.58), (.20, .07, .09), DARK, 'elevation', bevel=0)
    for sg in (-1, 1):
        s.rod('spade grip arm', (-.60, sg * .09, 1.38), (-.80, sg * .17, 1.50), .035, DARK, 'elevation', seg=6)
        s.cyl('spade handle', (-.82, sg * .17, 1.52), .035, .16, 'leather', 'elevation', axis='Z', seg=6)
    s.box('thumb bar', (-.82, 0, 1.58), (.06, .40, .05), DARK, 'elevation', bevel=0)
    # --- barrel cluster (spins about X)
    nb = pick(s, 6, 6, 1)
    seg = pick(s, 8, 5, 8)
    if nb > 1:
        for i in range(nb):
            a = i * math.tau / nb
            y, z = .10 * math.cos(a), 1.38 + .10 * math.sin(a)
            s.frustum('barrel', (.34, y, z), (1.42, y, z), .034, None, DARK, 'barrels', seg=seg)
        for x in (.45, .85, 1.38):
            s.cyl('barrel clamp', (x, 0, 1.38), .17 if x < 1.2 else .155, .05, 'oliveSeam', 'barrels', axis='X', seg=pick(s, 16, 10, 8))
        s.cyl('barrel core', (.9, 0, 1.38), .06, 1.1, DARK, 'barrels', axis='X', seg=6)
    else:
        s.cyl('barrel block', (.88, 0, 1.38), .13, 1.2, DARK, 'barrels', axis='X', seg=8)
        s.cyl('barrel clamp', (1.38, 0, 1.38), .17, .05, 'oliveSeam', 'barrels', axis='X', seg=8)
    # --- heat glow: separate emissive owner; hidden / scaled by the overheating mechanic
    if nb > 1:
        for i in range(nb):
            a = i * math.tau / nb
            y, z = .10 * math.cos(a), 1.38 + .10 * math.sin(a)
            s.frustum('heat sleeve', (.95, y, z), (1.36, y, z), .041, None, 'orange', 'heatGlow', seg=pick(s, 8, 5, 5), emissive=True)
    else:
        s.cyl('heat band', (1.15, 0, 1.38), .15, .22, 'orange', 'heatGlow', axis='X', seg=8, emissive=True)
    fixed_physics(s, 1.0)
    for name, size, pos in (('north', (2.2, .5, .8), (0, 1.08, .4)), ('south', (2.2, .5, .8), (0, -1.08, .4)),
                            ('east', (.5, 2.0, .8), (1.05, 0, .4))):
        s.collider(name, size, pos)
    s.socket('front', (1.5, 0, .5))
    s.socket('muzzle', (1.46, 0, 1.38), 'elevation')
    s.socket('seatAnchor', (-.78, 0, .10))
    s.socket('gunnerSocket', (-.78, 0, .10))
    s.socket('heatGlowSlot', (1.1, 0, 1.38), 'elevation')


# ------------------------------------------------------------------------------ cure canister
def _canister(s, owner='body', straps=True):
    """Pressurised canister: body Z-axis cylinder at the origin column, window facing -X."""
    L = s.lod
    s.frustum('canister body', (0, 0, .10), (0, 0, .56), .15, None, 'silver', owner, seg=16)
    s.frustum('canister dome', (0, 0, .56), (0, 0, .64), .15, .07, 'silver', owner, seg=16)
    s.frustum('canister foot', (0, 0, .10), (0, 0, .0), .15, .11, DARK, owner, seg=12)
    for z in (.17, .49):
        s.cyl('canister band', (0, 0, z), .158, .035, 'backpackTealDark', owner, seg=pick(s, 16, 12, 8))
    s.box('window frame', (-.17, 0, .33), (.04, .15, .34), DARK, owner, bevel=0)
    s.box('agent window', (-.187, 0, .33), (.016, .10, .28), 'tealLight', owner, bevel=0, emissive=True)
    s.cyl('valve stem', (0, 0, .67), .035, .06, 'brass', owner, seg=8)
    if L < 2:
        s.cyl('valve wheel', (0, 0, .715), .075, .02, 'survivorRed', owner, seg=pick(s, 12, 8, 8))
        s.box('valve spout', (-.06, 0, .67), (.10, .04, .04), 'brass', owner, bevel=0)
    if L == 0:
        s.cyl('gauge', (-.17, .10, .52), .035, .03, 'bone', owner, axis='X', seg=10)
        s.rod('hose', (-.05, 0, .68), (-.16, .10, .54), .015, DARK, owner, seg=5)


def prop_cure_canister(s):
    s.owner('body')
    s.ao_floor = .45
    _canister(s)
    # backpack frame on the +X face, shoulder straps and a carry handle
    s.box('back frame', (.19, 0, .33), (.04, .34, .58), 'backpackTealDark', 'body', bevel=0)
    s.box('frame foot', (.17, 0, .06), (.12, .34, .06), 'backpackTealDark', 'body', bevel=0)
    for sg in (-1, 1):
        s.box('strap', (.225, sg * .11, .33), (.025, .06, .60), 'backpackTeal', 'body', bevel=0)
        if s.lod < 2:
            s.box('strap buckle', (.24, sg * .11, .12), (.02, .07, .05), 'brass', 'body', bevel=0)
    if s.lod < 2:
        s.box('top bar', (.17, 0, .64), (.08, .30, .04), 'backpackTealDark', 'body', bevel=0)
    s.physics('light', 6, 'prop.metal-medium', False, (0, .3, 0))
    s.collider('body', (.42, .36, .72), (.0, 0, .36))
    s.socket('backSocket', (.215, 0, .33))
    s.socket('front', (-.3, 0, .33))


def prop_cure_canister_pedestal(s):
    s.owner('body')
    s.ao_floor = .40
    L = s.lod
    s.frustum('plinth', (0, 0, .06), (0, 0, .24), .62, .52, CONCRETE, 'body', seg=8)
    s.cyl('plinth step', (0, 0, .03), .70, .06, STRUCT, 'body', seg=8)
    s.frustum('column', (0, 0, .24), (0, 0, .92), .30, .24, CONCRETE, 'body', seg=8)
    s.frustum('top plate', (0, 0, .92), (0, 0, .98), .40, None, STEEL, 'body', seg=pick(s, 12, 10, 8))
    s.cyl('glow band', (0, 0, .62), .31, .05, 'tealLight', 'body', seg=8, emissive=True)
    if L < 2:
        for a in (0, 120, 240):
            r = math.radians(a)
            s.box('clamp arm', (.19 * math.cos(r), .19 * math.sin(r), 1.18), (.04, .035, .36), DARK, 'body', rot=(0, 0, r), bevel=0)
    with s.frame((0, 0, .98), math.pi):
        _canister(s)
    s.physics('fixed', 0, 'prop.metal-heavy', False, (0, .5, 0))
    s.collider('body', (1.3, 1.3, 1.0), (0, 0, .5))
    s.socket('front', (.9, 0, .5))
    s.socket('pickupSocket', (0, 0, 1.45))


# ------------------------------------------------------------------------------ dispersal kit
PIPE_Z, PIPE_R = 2.4, 1.0


def _flange(s, x, y, z, axis, r=1.22, depth=.2, bolts=True):
    s.cyl('flange', (x, y, z), r, depth, DARK, 'body', axis=axis, seg=pick(s, 20, 12, 8))
    if bolts and s.lod == 0:
        for i in range(12):
            a = i * math.tau / 12
            off = r - .1
            if axis == 'X':
                s.box('bolt', (x, y + off * math.cos(a), z + off * math.sin(a)), (depth + .08, .1, .1), 'brass', 'body', bevel=0)
            else:
                s.box('bolt', (x + off * math.cos(a), y, z + off * math.sin(a)), (.1, depth + .08, .1), 'brass', 'body', bevel=0)


def _saddle(s, x, y, z=PIPE_Z, axis='X'):
    s.box('support', (x, y, (z - PIPE_R + .1) / 2), (1.0, 1.9, z - PIPE_R + .1) if axis == 'X' else (1.9, 1.0, z - PIPE_R + .1), CONCRETE, 'body', bevel=.04)
    s.cyl('clamp band', (x, y, z), PIPE_R + .08, .28, SAFETY, 'body', axis='X' if axis == 'X' else 'Y', seg=pick(s, 20, 12, 8))
    s.box('footing', (x, y, .1), (2.2, 2.6, .2) if axis == 'X' else (2.6, 2.2, .2), STRUCT, 'body', bevel=0)


def kit_dispersal_pipe_straight(s):
    s.owner('body')
    s.ao_floor = .35
    s.frustum('pipe', (-3.95, 0, PIPE_Z), (3.95, 0, PIPE_Z), PIPE_R, None, STEEL, 'body', seg=20)
    for x in (-3.9, 3.9):
        _flange(s, x, 0, PIPE_Z, 'X')
    for x in (-2.0, 2.0):
        _saddle(s, x, 0)
    if s.lod < 2:
        s.cyl('inspection collar', (0, 0, PIPE_Z), PIPE_R + .06, .5, STRUCT, 'body', axis='X', seg=pick(s, 20, 12, 8))
        s.cyl('inspection hatch', (0, 0, PIPE_Z + PIPE_R + .08), .42, .16, DARK, 'body', seg=pick(s, 12, 10, 8))
    fixed_physics(s)
    s.collider('pipe', (8, 2.4, 2.4), (0, 0, PIPE_Z))
    s.socket('portA', (-4, 0, PIPE_Z))
    s.socket('portB', (4, 0, PIPE_Z))
    s.socket('front', (4.2, 0, PIPE_Z))


def kit_dispersal_pipe_elbow(s):
    s.owner('body')
    s.ao_floor = .35
    steps = pick(s, 10, 6, 4)
    c = (-3.0, 3.0)
    pts = [(-3.95, 0, PIPE_Z), (-3, 0, PIPE_Z)]
    for k in range(1, steps):
        a = math.radians(-90 + 90 * k / steps)
        pts.append((c[0] + 3 * math.cos(a), c[1] + 3 * math.sin(a), PIPE_Z))
    pts += [(0, 3, PIPE_Z), (0, 3.95, PIPE_Z)]
    sweep(s, 'elbow pipe', pts, PIPE_R, STEEL, 'body', seg=20)
    _flange(s, -3.9, 0, PIPE_Z, 'X')
    _flange(s, 0, 3.9, PIPE_Z, 'Y')
    _saddle(s, -3.4, 0)
    _saddle(s, 0, 3.4, axis='Y')
    fixed_physics(s)
    s.collider('stub a', (2.0, 2.4, 2.4), (-3.2, 0, PIPE_Z))
    s.collider('stub b', (2.4, 2.0, 2.4), (0, 3.2, PIPE_Z))
    s.collider('arc', (3.2, 3.2, 2.4), (-1.5, 1.5, PIPE_Z))
    s.socket('portA', (-4, 0, PIPE_Z))
    s.socket('portB', (0, 4, PIPE_Z))
    s.socket('front', (1.5, 1.5, PIPE_Z))


def kit_dispersal_pipe_tee(s):
    s.owner('body')
    s.ao_floor = .35
    s.frustum('run', (-3.95, 0, PIPE_Z), (3.95, 0, PIPE_Z), PIPE_R, None, STEEL, 'body', seg=20)
    s.frustum('branch', (0, 0, PIPE_Z), (0, 3.95, PIPE_Z), .85, None, STEEL, 'body', seg=20)
    for x in (-3.9, 3.9):
        _flange(s, x, 0, PIPE_Z, 'X')
    _flange(s, 0, 3.9, PIPE_Z, 'Y', r=1.05)
    _saddle(s, -2.4, 0)
    _saddle(s, 2.4, 0)
    if s.lod < 2:
        s.cyl('junction collar', (0, 0, PIPE_Z), PIPE_R + .12, .6, STRUCT, 'body', axis='X', seg=pick(s, 20, 12, 8))
        s.cyl('valve body', (0, 2.2, PIPE_Z), .95, .5, STRUCT, 'body', axis='Y', seg=pick(s, 16, 10, 8))
    s.cyl('valve stem', (0, 2.2, PIPE_Z + 1.2), .12, 1.4, DARK, 'body', seg=8)
    s.cyl('valve wheel', (0, 2.2, PIPE_Z + 1.95), .6, .12, 'survivorRed', 'body', seg=pick(s, 14, 10, 8))
    fixed_physics(s)
    s.collider('run', (8, 2.4, 2.4), (0, 0, PIPE_Z))
    s.collider('branch', (2.0, 4, 2.4), (0, 2, PIPE_Z))
    s.socket('portA', (-4, 0, PIPE_Z))
    s.socket('portB', (4, 0, PIPE_Z))
    s.socket('portC', (0, 4, PIPE_Z))
    s.socket('front', (4.2, 0, PIPE_Z))


FAN_Z, FAN_R = 5.2, 4.2


def kit_dispersal_fan_housing(s):
    L = s.lod
    s.owner('body')
    s.owner('fanRotor', (0, 0, FAN_Z))
    s.ao_floor = .35
    s.box('plinth', (0, 0, .55), (6.2, 9.4, 1.1), CONCRETE, 'body', bevel=.06)
    s.box('plinth step', (0, 0, .15), (7.2, 10.2, .3), STRUCT, 'body', bevel=0)
    # duct shell and flanges
    ring_x(s, 'duct shell', -1.2, 1.2, 3.85, FAN_R, STEEL, 'body', center=(0, FAN_Z), seg=32)
    for x in (-1.15, 1.15):
        ring_x(s, 'duct flange', x - .15, x + .15, 3.80, FAN_R + .35, DARK, 'body', center=(0, FAN_Z), seg=32)
    ring_x(s, 'safety band', -.35, .35, FAN_R - .02, FAN_R + .12, SAFETY, 'body', center=(0, FAN_Z), seg=32)
    if L == 0:
        for k in range(24):
            a = k * math.tau / 24
            for x in (-1.15, 1.15):
                s.box('flange bolt', (x, (FAN_R + .2) * math.cos(a), FAN_Z + (FAN_R + .2) * math.sin(a)), (.4, .16, .16), 'brass', 'body',
                      rot=(a, 0, 0), bevel=0)
    # cradle feet bolting the ring to the plinth
    for sy in (-1, 1):
        s.box('cradle', (0, sy * 3.0, 1.9), (2.4, .7, 1.6), STRUCT, 'body', rot=(sy * -.35, 0, 0), bevel=.03)
    # motor nacelle on stator vanes, behind the rotor
    s.cyl('motor nacelle', (-1.3, 0, FAN_Z), .85, 1.3, STRUCT, 'body', axis='X', seg=pick(s, 16, 10, 8))
    nv = pick(s, 6, 4, 3)
    for k in range(nv):
        a = k * math.tau / nv + .3
        r = Vector((0, math.cos(a), math.sin(a)))
        t = Vector((0, -math.sin(a), math.cos(a)))
        obox(s, 'stator vane', (-.9, 2.3 * r.y, FAN_Z + 2.3 * r.z), ((1, 0, 0), t, r), (.3, .08, 1.5), STRUCT)
    # guard grille on the front face: concentric rings and spokes
    for rr in (1.6, 2.8):
        ring_x(s, 'guard ring', 1.32, 1.42, rr - .06, rr + .06, DARK, 'body', center=(0, FAN_Z), seg=24)
    ns = 8
    for k in range(ns):
        a = k * math.tau / ns
        r = Vector((0, math.cos(a), math.sin(a)))
        t = Vector((0, -math.sin(a), math.cos(a)))
        obox(s, 'guard spoke', (1.36, 2.4 * r.y, FAN_Z + 2.4 * r.z), ((1, 0, 0), t, r), (.04, .06, 1.9), DARK)
    # rotor: hub, nose cone and pitched blades (spins about X)
    s.cyl('rotor hub', (0, 0, FAN_Z), .72, .9, DARK, 'fanRotor', axis='X', seg=pick(s, 16, 10, 8))
    s.frustum('rotor nose', (.45, 0, FAN_Z), (1.0, 0, FAN_Z), .72, .12, 'oliveSeam', 'fanRotor', seg=pick(s, 16, 10, 8))
    nb = 8
    pitch = math.radians(28)
    for k in range(nb):
        a = k * math.tau / nb
        r = Vector((0, math.cos(a), math.sin(a)))
        t = Vector((0, -math.sin(a), math.cos(a)))
        x = Vector((1, 0, 0))
        chord = t * math.cos(pitch) + x * math.sin(pitch)
        thick = -t * math.sin(pitch) + x * math.cos(pitch)
        obox(s, 'rotor blade', (0, 2.25 * r.y, FAN_Z + 2.25 * r.z), (chord, r, thick), (.55, 1.5, .07), 'orange' if k % 2 == 0 else 'brass', 'fanRotor')
    fixed_physics(s, 2.0)
    s.collider('plinth', (7.2, 10.2, 1.1), (0, 0, .55))
    s.collider('duct', (3.0, 9.0, 8.8), (0, 0, FAN_Z))
    s.socket('portIntake', (-1.8, 0, FAN_Z))
    s.socket('portExhaust', (1.6, 0, FAN_Z))
    s.socket('front', (4.0, 0, FAN_Z))
    s.socket('rotorAxis', (0, 0, FAN_Z), 'fanRotor')


def kit_dispersal_turbine_hall(s):
    L = s.lod
    s.owner('body')
    s.ao_floor = .40
    s.box('slab', (0, -.5, .2), (16.8, 12.2, .4), CONCRETE, 'body', bevel=0)
    # hall block: y from -2 to 5
    s.box('hall base', (0, 1.5, 1.2), (16.2, 7.2, 1.6), STRUCT, 'body', bevel=.03)
    s.box('hall walls', (0, 1.5, 3.7), (16.0, 7.0, 4.6), 'khaki', 'body', bevel=.03)
    s.box('hall cornice', (0, 1.5, 6.15), (16.5, 7.5, .35), 'khakiSeam', 'body', bevel=0)
    s.box('hall roof', (0, 1.5, 6.5), (15.4, 6.6, .5), 'asphalt', 'body', bevel=0)
    s.box('monitor roof', (0, 1.5, 7.9), (12.4, 3.2, 2.3), 'khakiLight', 'body', bevel=.02)
    s.box('monitor cap', (0, 1.5, 9.15), (12.8, 3.6, .3), 'asphalt', 'body', bevel=0)
    for sy in (-1, 1):
        s.box('monitor louvre', (0, 1.5 + sy * 1.62, 7.9), (11.0, .06, 1.2), 'tealLight', 'body', bevel=0, emissive=True)
    npil = pick(s, 5, 3, 2)
    for i in range(npil):
        x = -7.4 + i * 14.8 / max(1, npil - 1)
        for sy in (-1, 1):
            s.box('pilaster', (x, 1.5 + sy * 3.62, 3.7), (.7, .35, 4.8), STRUCT, 'body', bevel=0)
    # end wall: big roller door, framed in hazard yellow
    s.box('door frame', (8.05, 1.5, 2.6), (.12, 5.8, 4.4), SAFETY, 'body', bevel=0)
    s.box('roller door', (8.12, 1.5, 2.45), (.10, 5.0, 4.1), DARK, 'body', bevel=0)
    if L < 2:
        for z in (1.0, 1.9, 2.8, 3.7):
            s.box('door rib', (8.2, 1.5, z), (.06, 5.0, .12), STRUCT, 'body', bevel=0)
    for sx in (-4.5, -1.5, 1.5, 4.5):
        s.box('slit window', (sx, 5.02, 4.4), (1.8, .06, .9), 'windowGlow', 'body', bevel=0, emissive=True)
    # exposed turbine train along the south wall
    for x0 in (-5.5, -1.0, 3.2):
        s.box('cradle block', (x0, -3.9, .9), (1.6, 3.0, 1.0), CONCRETE, 'body', bevel=.03)
    s.cyl('turbine casing', (-1.0, -3.9, 2.6), 1.7, 10.0, STEEL, 'body', axis='X', seg=pick(s, 20, 12, 8))
    for x in (-5.0, -3.0, -1.0, 1.0, 3.0):
        s.cyl('casing flange', (x, -3.9, 2.6), 1.88, .22, DARK, 'body', axis='X', seg=pick(s, 20, 12, 8))
    s.cyl('generator', (6.0, -3.9, 2.6), 2.05, 3.2, 'oliveLight', 'body', axis='X', seg=pick(s, 20, 12, 8))
    s.cyl('generator band', (6.0, -3.9, 2.6), 2.1, .3, SAFETY, 'body', axis='X', seg=pick(s, 20, 12, 8))
    s.frustum('exhaust nozzle', (-6.0, -3.9, 2.6), (-7.0, -3.9, 2.6), 1.7, 1.2, STRUCT, 'body', seg=pick(s, 16, 10, 8))
    # steam line into the hall wall and roof stacks
    s.frustum('steam riser', (-1.0, -3.9, 4.1), (-1.0, -3.9, 5.0), .5, None, STEEL, 'body', seg=pick(s, 12, 8, 8))
    s.frustum('steam crossover', (-1.0, -3.9, 5.0), (-1.0, -1.8, 5.0), .5, None, STEEL, 'body', seg=pick(s, 12, 8, 8))
    for x in (-5.0, 5.0):
        s.frustum('stack', (x, 4.0, 6.7), (x, 4.0, 11.0), .85, .7, STEEL, 'body', seg=pick(s, 16, 10, 8))
        s.cyl('stack band', (x, 4.0, 10.2), .78, .35, SAFETY, 'body', seg=pick(s, 16, 10, 8))
        s.frustum('stack cap', (x, 4.0, 11.0), (x, 4.0, 11.5), .8, .45, DARK, 'body', seg=pick(s, 16, 10, 8))
    fixed_physics(s, 3.0)
    s.collider('hall', (16.2, 7.2, 6.4), (0, 1.5, 3.2))
    s.collider('turbine', (16.0, 4.2, 4.8), (0, -3.9, 2.6))
    s.socket('door', (8.4, 1.5, 0))
    s.socket('steamPort', (-7.0, -3.9, 2.6))
    s.socket('front', (9.0, 1.5, 1.0))


def kit_dispersal_tank_sphere(s):
    L = s.lod
    s.owner('body')
    s.ao_floor = .35
    zc, R = 7.6, 3.6
    sphere(s, 'sphere shell', (0, 0, zc), R, STEEL, 'body', seg=22)
    s.cyl('equator band', (0, 0, zc), R + .08, .35, SAFETY, 'body', seg=pick(s, 22, 14, 8))
    nl = 8
    for k in range(nl):
        a = k * math.tau / nl + math.pi / 8
        top = Vector(((R - .2) * math.cos(a), (R - .2) * math.sin(a), zc))
        foot = Vector((4.05 * math.cos(a), 4.05 * math.sin(a), .0))
        s.rod('leg', foot + Vector((0, 0, .25)), top, .26, STRUCT, 'body', seg=pick(s, 8, 6, 6))
        s.box('footing', (foot.x, foot.y, .15), (1.0, 1.0, .3), CONCRETE, 'body', rot=(0, 0, a), bevel=0)
    if L == 0:
        for k in range(nl):
            a0, a1 = k * math.tau / nl + math.pi / 8, (k + 1) * math.tau / nl + math.pi / 8
            p0 = Vector((3.2 * math.cos(a0), 3.2 * math.sin(a0), 2.0))
            p1 = Vector((2.8 * math.cos(a1), 2.8 * math.sin(a1), 5.8))
            s.rod('leg brace', p0, p1, .07, DARK, 'body', seg=5)
    # top nozzle, relief valve and a ladder up the +X leg
    s.frustum('top nozzle', (0, 0, zc + R - .3), (0, 0, zc + R + .6), .55, None, STRUCT, 'body', seg=pick(s, 12, 8, 6))
    s.cyl('top flange', (0, 0, zc + R + .6), .72, .16, DARK, 'body', seg=pick(s, 14, 10, 8))
    if L < 2:
        s.rod('relief pipe', (1.6, 0, zc + R - .6), (1.6, 0, zc + R + 1.6), .2, SAFETY, 'body', seg=8)
        for sy in (-.22, .22):
            s.rod('ladder rail', (4.4, sy, .3), (3.8, sy, zc + .5), .035, DARK, 'body', seg=5)
    if L == 0:
        for i in range(18):
            t = i / 17
            s.box('ladder rung', (4.4 - 0.6 * t, 0, .3 + t * (zc + .2)), (.05, .5, .05), DARK, 'body', bevel=0)
    # outlet line from the bottom pole to a ground port
    s.frustum('drain pipe', (0, 0, zc - R + .2), (0, 0, .9), .42, None, STEEL, 'body', seg=pick(s, 12, 8, 6))
    s.frustum('outlet pipe', (0, 0, .9), (6.0, 0, .9), .42, None, STEEL, 'body', seg=pick(s, 12, 8, 6))
    s.cyl('outlet flange', (6.0, 0, .9), .6, .16, DARK, 'body', axis='X', seg=pick(s, 12, 8, 6))
    s.cyl('drain valve', (3.0, 0, 1.1), .6, .5, STRUCT, 'body', axis='Z', seg=pick(s, 12, 8, 6))
    fixed_physics(s, 4.0)
    s.collider('legs', (8.4, 8.4, 4.4), (0, 0, 2.2))
    s.collider('sphere', (7.2, 7.2, 7.2), (0, 0, zc))
    s.socket('portOutlet', (6.0, 0, .9))
    s.socket('front', (6.5, 0, .9))


def kit_dispersal_tank_bullet(s):
    L = s.lod
    s.owner('body')
    s.ao_floor = .35
    zc = 3.7
    for sy in (-3.0, 3.0):
        vessel_x(s, 'vessel', -5.0, 5.0, 2.2, sy, zc, 1.1, STEEL, 'body', seg=20)
        for x in (-2.8, 2.8):
            s.box('saddle', (x, sy, 1.6), (1.2, 3.6, 3.2), CONCRETE, 'body', bevel=.03)
        s.cyl('manway', (0, sy, zc + 2.25), .6, .35, DARK, 'body', seg=pick(s, 12, 8, 6))
        s.cyl('hazard ring', (0, sy, zc), 2.28, .3, SAFETY, 'body', axis='X', seg=pick(s, 20, 12, 8))
        if L < 2:
            for x in (-1.6, 1.6):
                s.cyl('hoop', (x, sy, zc), 2.24, .16, DARK, 'body', axis='X', seg=pick(s, 20, 12, 8))
    s.box('footing', (0, 0, .15), (11.5, 10.6, .3), STRUCT, 'body', bevel=0)
    # catwalk bridging both vessels
    s.box('catwalk', (0, 0, 6.2), (10.0, 2.4, .2), 'oliveLight', 'body', bevel=0)
    for sx in (-4.4, 4.4):
        s.box('catwalk leg', (sx, 0, 3.1), (.35, .35, 6.1), STRUCT, 'body', bevel=0)
    railing(s, (-5, -1.2, 6.3), (5, -1.2, 6.3), 1.0, SAFETY, 'body', 2.5)
    railing(s, (-5, 1.2, 6.3), (5, 1.2, 6.3), 1.0, SAFETY, 'body', 2.5)
    # manifold pipe linking both vessels at the +X end
    s.frustum('manifold', (4.2, -3.0, 1.2), (4.2, 3.0, 1.2), .4, None, STEEL, 'body', seg=pick(s, 12, 8, 6))
    s.frustum('outlet', (4.2, 0, 1.2), (6.0, 0, 1.2), .45, None, STEEL, 'body', seg=pick(s, 12, 8, 6))
    s.cyl('outlet flange', (6.0, 0, 1.2), .62, .16, DARK, 'body', axis='X', seg=pick(s, 12, 8, 6))
    for sy in (-3.0, 3.0):
        s.frustum('riser', (4.2, sy, 1.2), (4.2, sy, 2.0), .3, None, STEEL, 'body', seg=pick(s, 10, 8, 6))
    fixed_physics(s, 3.0)
    s.collider('left', (10.4, 4.6, 5.8), (0, -3.0, 2.9))
    s.collider('right', (10.4, 4.6, 5.8), (0, 3.0, 2.9))
    s.socket('portOutlet', (6.0, 0, 1.2))
    s.socket('front', (6.5, 0, 1.2))


def kit_dispersal_filtration_tower(s):
    L = s.lod
    s.owner('body')
    s.ao_floor = .35
    s.frustum('plinth', (0, 0, 0), (0, 0, .8), 4.3, 4.0, CONCRETE, 'body', seg=pick(s, 12, 10, 8))
    stages = [(.8, 6.6, 3.0, STEEL), (6.6, 12.0, 2.7, 'oliveLight'), (12.0, 16.0, 2.35, STEEL)]
    for z0, z1, r, tok in stages:
        s.frustum('stage', (0, 0, z0), (0, 0, z1), r, None, tok, 'body', seg=pick(s, 24, 14, 8))
    s.frustum('top cone', (0, 0, 16.0), (0, 0, 16.9), 2.35, .9, STRUCT, 'body', seg=pick(s, 24, 14, 8))
    s.frustum('vent stack', (0, 0, 16.9), (0, 0, 17.8), .5, None, DARK, 'body', seg=pick(s, 12, 8, 6))
    for z, r in ((6.6, 3.1), (12.0, 2.8), (3.6, 3.06)):
        s.cyl('stage band', (0, 0, z), r + .08, .45, SAFETY, 'body', seg=pick(s, 24, 14, 8))
    # catwalk rings with railings
    for z, r in ((6.7, 3.9), (12.1, 3.5)):
        s.frustum('catwalk deck', (0, 0, z), (0, 0, z + .14), r, None, STRUCT, 'body', seg=pick(s, 24, 14, 8))
        if L < 2:
            n = pick(s, 16, 8, 8)
            for i in range(n):
                a = i * math.tau / n
                s.box('rail post', ((r - .1) * math.cos(a), (r - .1) * math.sin(a), z + .62), (.09, .09, 1.0), SAFETY, 'body', bevel=0)
    # glowing status slits on the middle stage
    for k in range(4):
        a = math.radians(-60 + k * 40)
        s.box('status slit', (2.7 * math.cos(a), 2.7 * math.sin(a), 9.2), (.12, .35, 2.4), 'tealLight', 'body', rot=(0, 0, a), bevel=0, emissive=True)
    # side duct (port) and vertical riser pipe on the -X side
    s.frustum('side duct', (2.8, 0, 3.0), (7.5, 0, 3.0), 1.0, None, STEEL, 'body', seg=pick(s, 16, 10, 8))
    s.cyl('duct flange', (7.5, 0, 3.0), 1.22, .2, DARK, 'body', axis='X', seg=pick(s, 16, 10, 8))
    s.cyl('duct support', (5.5, 0, 1.2), .6, 2.4, CONCRETE, 'body', seg=pick(s, 10, 8, 6))
    s.frustum('riser pipe', (-3.5, 0, .9), (-3.5, 0, 14.5), .45, None, STEEL, 'body', seg=pick(s, 14, 8, 6))
    s.frustum('riser elbow', (-3.5, 0, 14.5), (-2.2, 0, 14.5), .45, None, STEEL, 'body', seg=pick(s, 14, 8, 6))
    if L < 2:
        for z in (3.0, 7.5, 11.5):
            s.box('riser bracket', (-3.1, 0, z), (.9, .25, .2), DARK, 'body', bevel=0)
    # access ladder
    if L < 2:
        for sx in (-.28, .28):
            s.rod('ladder rail', (sx, -3.4, .8), (sx, -3.4, 12.0), .03, DARK, 'body', seg=5)
    if L == 0:
        for i in range(30):
            s.box('ladder rung', (0, -3.4, 1.0 + i * .37), (.5, .05, .05), DARK, 'body', bevel=0)
    fixed_physics(s, 8.0)
    s.collider('tower', (6.4, 6.4, 17.0), (0, 0, 8.5))
    s.collider('duct', (5.0, 2.4, 4.4), (5.5, 0, 2.4))
    s.socket('portDuct', (7.5, 0, 3.0))
    s.socket('front', (8.0, 0, 3.0))


def kit_dispersal_platform(s):
    L = s.lod
    s.owner('body')
    s.ao_floor = .40
    h = 3.0
    s.box('deck', (0, 0, h), (8.0, 4.0, .16), STRUCT, 'body', bevel=0)
    if L == 0:
        for i in range(-7, 8):
            s.box('grating rib', (i * .5, 0, h + .09), (.06, 3.8, .04), DARK, 'body', bevel=0)
    for sx in (-3.6, 3.6):
        for sy in (-1.8, 1.8):
            s.box('column', (sx, sy, h / 2), (.3, .3, h), STEEL, 'body', bevel=0)
            s.box('column footing', (sx, sy, .1), (.8, .8, .2), CONCRETE, 'body', bevel=0)
    for sy in (-1.8, 1.8):
        s.box('beam', (0, sy, h - .25), (8.0, .24, .3), STEEL, 'body', bevel=0)
        s.rod('x brace', (-3.6, sy, .3), (3.6, sy, h - .3), .06, DARK, 'body', seg=5)
        s.rod('x brace', (3.6, sy, .3), (-3.6, sy, h - .3), .06, DARK, 'body', seg=5)
    railing(s, (-4, -2, h + .08), (4, -2, h + .08), 1.05, SAFETY, 'body', 2.0)
    railing(s, (-4, 2, h + .08), (4, 2, h + .08), 1.05, SAFETY, 'body', 2.0)
    railing(s, (-4, -2, h + .08), (-4, 2, h + .08), 1.05, SAFETY, 'body', 2.0)
    # stair run down the +X end, centred on y = 0
    steps = pick(s, 15, 8, 6)
    rise = h / (steps if steps > 1 else 1)
    run = 4.2 / (steps if steps > 1 else 1)
    if steps > 1:
        for i in range(steps):
            s.box('tread', (4.0 + run * (i + .5), 0, h - rise * (i + 1) + .05), (run + .02, 1.3, .1), STRUCT, 'body', bevel=0)
        for sy in (-.7, .7):
            ang = math.atan2(h, 4.2)
            ln = math.hypot(h, 4.2)
            s.box('stringer', (4.0 + 2.1, sy, h / 2 + .1), (ln, .1, .2), STEEL, 'body', rot=(0, ang, 0), bevel=0)
    else:
        ang = math.atan2(h, 4.2)
        ln = math.hypot(h, 4.2)
        s.box('stair ramp', (4.0 + 2.1, 0, h / 2 + .1), (ln, 1.4, .2), STRUCT, 'body', rot=(0, ang, 0), bevel=0)
    for sy in (-.75, .75):
        s.rod('stair rail', (4.0, sy, h + 1.0), (8.2, sy, 1.0), .035, SAFETY, 'body', seg=5)
        s.rod('stair post', (4.0, sy, h), (4.0, sy, h + 1.0), .035, SAFETY, 'body', seg=5)
        s.rod('stair post', (8.2, sy, 0.0), (8.2, sy, 1.0), .035, SAFETY, 'body', seg=5)
    fixed_physics(s)
    s.collider('deck', (8.0, 4.0, .3), (0, 0, h))
    s.socket('stairTop', (4.0, 0, h))
    s.socket('stairBottom', (8.2, 0, 0))
    s.socket('front', (8.6, 0, .5))


def kit_dispersal_console(s):
    L = s.lod
    s.owner('body')
    s.owner('screen', (-.45, 0, 1.55))
    s.ao_floor = .45
    s.box('cabinet', (0, 0, .45), (1.5, 3.2, .9), STRUCT, 'body', bevel=.03)
    s.box('kick plate', (0, 0, .05), (1.6, 3.3, .1), DARK, 'body', bevel=0)
    desk = [(.75, .9), (.75, 1.0), (-.1, 1.22), (-.75, 1.22), (-.75, .9)]
    s.extrude_xz('desk', desk, -1.62, 1.62, 'olive', 'body')
    # progress screen (own owner so the runtime can drive it) and side monitors
    s.box('screen bezel', (-.50, 0, 1.55), (.12, 1.9, .95), DARK, 'body', rot=(0, -.25, 0), bevel=0)
    s.box('progress screen', (-.435, 0, 1.55), (.04, 1.6, .7), 'tealLight', 'screen', rot=(0, -.25, 0), bevel=0, emissive=True)
    for sy in (-1.3, 1.3):
        s.box('side bezel', (-.5, sy, 1.5), (.1, .6, .7), DARK, 'body', rot=(0, -.25, .0), bevel=0)
        s.box('side screen', (-.44, sy, 1.5), (.03, .46, .5), 'windowGlow' if sy < 0 else 'orange', 'body', rot=(0, -.25, 0), bevel=0, emissive=True)
    if L < 2:
        for sy in (-.7, 0, .7):
            s.box('console support', (-.62, sy, 1.2), (.14, .2, .25), DARK, 'body', bevel=0)
    if L == 0:
        cols = ['survivorRed', SAFETY, 'brass', 'bone']
        slope = (1.22 - 1.0) / .85
        for i in range(10):
            x = .25
            s.box('button', (x, -1.2 + i * .27, 1.0 + (.75 - x) * slope + .03), (.1, .12, .05), cols[i % 4], 'body', bevel=0)
        s.box('big handle', (.45, 1.15, 1.0 + .3 * slope + .05), (.1, .2, .1), 'survivorRed', 'body', bevel=0)
    # front cabinet panels (inset grilles) read as machinery from the operator side
    for sy in (-1.05, 0, 1.05):
        s.box('front panel', (.77, sy, .45), (.04, .9, .6), DARK, 'body', bevel=0)
        if L == 0:
            for z in (.28, .38, .48, .58):
                s.box('panel slat', (.8, sy, z), (.03, .78, .04), 'oliveSeam', 'body', bevel=0)
    fixed_physics(s)
    s.collider('body', (1.6, 3.3, 1.3), (0, 0, .65))
    s.collider('screen', (.6, 3.0, 1.0), (-.5, 0, 1.55))
    s.socket('progressScreen', (-.40, 0, 1.55), 'screen')
    s.socket('operator', (1.0, 0, 0))
    s.socket('front', (1.2, 0, .6))
