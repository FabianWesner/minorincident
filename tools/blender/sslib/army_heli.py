"""veh.helicopter-military: Sunset Grove rescue helicopter derivative in military
olive with an open port-side door and a swivelling door gun. +X nose, Z up.
Owners: body, mainRotor, tailRotor, doorGun, lightsFront, lightsBrake.
"""
import math
from mathutils import Vector

PROFILE = [(-1.85, .03, 1.85, .10), (-1.65, .65, 1.75, .78), (-1.3, .88, 1.73, 1.02), (-.75, .94, 1.73, 1.08),
           (0, 1.0, 1.72, 1.12), (.65, .98, 1.71, 1.10), (1.15, .9, 1.65, 1.04), (1.6, .77, 1.51, .86),
           (2.0, .61, 1.37, .67), (2.35, .40, 1.28, .48), (2.58, .18, 1.26, .30), (2.68, .025, 1.25, .11)]
TAIL = [(-1.45, .39, 2.10, .35), (-2.0, .33, 2.18, .32), (-3.0, .25, 2.35, .25), (-4.2, .17, 2.53, .18),
        (-5.65, .11, 2.65, .12)]
DOOR_X = (-.50, .55)
DENT = .20


def section(x):
    for a, b in zip(PROFILE, PROFILE[1:]):
        if a[0] <= x <= b[0]:
            f = (x - a[0]) / (b[0] - a[0])
            return [a[j] * (1 - f) + b[j] * f for j in (1, 2, 3)]
    return PROFILE[0][1:] if x < PROFILE[0][0] else PROFILE[-1][1:]


def surf(x, t, proud=0.0, dent=0.0):
    w, z, h = section(x)
    st, ct = math.sin(t), math.cos(t)
    y = w * math.copysign(abs(st) ** .72, st)
    zz = z + h * math.copysign(abs(ct) ** .82, ct)
    return (x, y + proud * st - math.copysign(dent, st), zz + proud * ct)


def recipe(s):
    L = s.lod
    s.owner('body')
    s.owner('mainRotor', (-.30, 0, 3.99))
    s.owner('tailRotor', (-5.59, .25, 2.72))
    s.owner('doorGun', (0.0, .95, 1.38))
    s.owner('doorGunR', (0.0, -.95, 1.38))
    s.ao_floor = .30
    s.owner('lightsFront', (2.30, 0, .72))
    s.owner('lightsBrake', (-5.97, 0, 4.24))

    # ---- fuselage: superellipse sections with a real recessed port door
    n = [40, 24, 12][L]
    xs = [p[0] for p in PROFILE]
    if L == 0:
        xs += [(a[0] + b[0]) / 2 for a, b in zip(PROFILE, PROFILE[1:])]
    if L < 2:
        xs += [DOOR_X[0] - .03, DOOR_X[0], DOOR_X[1], DOOR_X[1] + .03]
    xs = sorted(set(round(x, 4) for x in xs))
    rings = []
    for x in xs:
        ring = []
        for k in range(n):
            t = math.tau * k / n
            deg = math.degrees(t)
            dent = DENT if (L < 2 and DOOR_X[0] <= x <= DOOR_X[1] and (57 <= deg <= 123 or 237 <= deg <= 303)) else 0
            ring.append(surf(x, t, 0, dent))
        rings.append(ring)
    s.loft('fuselage', rings, 'olive')

    def patch(name, x0, x1, t0, t1, token, proud=.02, nx=8, nt=6, dent=0.0):
        if L:
            nx, nt = max(2, nx // (2 if L == 1 else 4)), max(2, nt // (2 if L == 1 else 3))
        tm, xm = (t0 + t1) / 2, (x0 + x1) / 2
        direction = Vector(surf(xm, tm, 1)) - Vector(surf(xm, tm, 0))
        s.patch(name, lambda u, v: surf(x0 + (x1 - x0) * u, t0 + (t1 - t0) * v, proud, dent), nx, nt, token,
                outward=direction)

    # nose: lighter belly, windscreen with seals, centre pillar
    patch('nose belly', 1.9, 2.67, math.radians(110), math.radians(250), 'oliveSeam', .04, 8, 10)
    for sg in (-1, 1):
        patch('windscreen seal', .84, 2.38, sg * .07, sg * .84, 'oliveSeam', .045, 8, 6)
        patch('cockpit glazing', .89, 2.34, sg * .10, sg * .80, 'tealDark', .075, 8, 6)
        # pilot / co-pilot door seams and windows
        patch('pilot door frame', .55, 1.5, sg * .92, sg * 2.11, 'oliveLight', .035, 4, 4)
        patch('pilot door window', .68, 1.40, sg * 1.05, sg * 1.60, 'tealDark', .06, 4, 4)
        # rear cabin windows
        for i, (a, b) in enumerate(((-1.52, -1.10), (-1.0, -.62))):
            patch('cabin window', a, b, sg * 1.05, sg * 1.62, 'tealDark', .05, 3, 3)
    patch('windscreen pillar', .84, 1.83, -.063, .063, 'olive', .09, 6, 2)
    # both sliding doors are removed: recessed cabin openings with dark interiors
    for sg in (-1, 1):
        patch('open door interior', DOOR_X[0] + .03, DOOR_X[1] - .03, sg * math.radians(66), sg * math.radians(114),
              'oliveSeam', .012, 6, 5, DENT)
    # door frame rails and rail extension (sliding door removed)
    for sg in (-1, 1):
        for deg in (60, 120):
            pt = surf(0, sg * math.radians(deg), .06)
            s.rod('door rail', (DOOR_X[0] - .05, pt[1] + sg * .02, pt[2]), (DOOR_X[1] + .95, pt[1] + sg * .02, pt[2]),
                  .03, 'oliveSeam')
        s.box('cabin bench', (-.32, sg * .78, .98), (.78, .26, .12), 'khaki', bevel=.03)
        s.box('bench cushion back', (-.32, sg * .70, 1.22), (.78, .10, .42), 'khakiSeam', bevel=.03)
        s.box('ammo crate', (.28, sg * .86, .80), (.30, .22, .20), 'oliveSeam', bevel=.02)

    # engine deck, turbine cowlings, exhausts, rotor mast
    s.box('engine deck', (-.48, 0, 2.95), (2.25, 1.30, .42), 'oliveLight', bevel=.20)
    s.extrude_xz('transmission roof', [(-1.2, 2.93), (-.85, 3.40), (.32, 3.43), (.75, 3.12)], -.5, .5, 'olive')
    for sg in (-1, 1):
        s.box('turbine cowling', (-.72, sg * .55, 3.03), (1.86, .66, .60), 'olive', bevel=.16)
        s.cyl('exhaust', (-1.62, sg * .56, 3.05), .23, .36, 'uiDark', axis='X', seg=14)
        if L < 2:
            s.box('intake bezel', (.27, sg * .70, 3.10), (.47, .04, .24), 'oliveSeam', bevel=.04)
        if L == 0:
            for i in range(6):
                s.box('intake louvre', (.10 + i * .07, sg * .73, 3.10), (.03, .035, .17), 'uiDark', bevel=0)
            for i in range(6):
                s.box('turbine vent', (-.95 + i * .09, sg * .90, 3.08), (.025, .03, .22), 'uiDark', bevel=0)
            for x in (-1.2, -.55, .1):
                s.box('service seam', (x, sg * .81, 2.94), (.014, .014, .23), 'oliveSeam', bevel=0)
    s.cyl('mast', (-.30, 0, 3.72), .115, .50, 'uiDark', seg=12)
    s.cyl('mast flange', (-.30, 0, 3.52), .21, .10, 'oliveSeam', seg=14)
    if L < 2:
        s.rod('roof aerial', (-1.12, .30, 3.16), (-1.18, .30, 3.59), .012, 'uiDark', seg=4)

    # ---- tail boom, fin, stabilizer
    m = [16, 10, 6][L]
    tail_rings = [[(x, w * math.sin(math.tau * k / m), z + h * math.cos(math.tau * k / m)) for k in range(m)]
                  for x, w, z, h in TAIL]
    s.loft('tail boom', tail_rings, 'olive')
    s.extrude_xz('tail fin', [(-5.34, 2.48), (-5.47, 1.63), (-5.93, 1.71), (-5.75, 2.67), (-6.24, 4.15),
                              (-5.71, 4.19), (-5.16, 2.77)], -.075, .075, 'olive')
    s.box('stabilizer', (-5.38, 0, 2.59), (.55, 1.83, .095), 'olive', bevel=.04)
    if L < 2:
        s.box('fin cap', (-5.97, 0, 4.14), (.55, .17, .08), 'oliveLight', bevel=0)
        s.box('stabilizer edge', (-5.08, 0, 2.60), (.065, 1.70, .045), 'oliveSeam', bevel=0)
    s.box('tail beacon', (-5.99, 0, 4.24), (.12, .10, .14), 'sirenRed', 'lightsBrake', bevel=0, emissive=True)
    s.cyl('tail gearbox', (-5.59, .16, 2.72), .20, .30, 'oliveSeam', axis='Y', seg=12)

    # ---- main rotor (owner mainRotor): 4 blades, hub, spindles, olive tips
    c = Vector((-.30, 0, 4.01))
    s.cyl('main hub', (-.30, 0, 3.99), .30, .24, 'uiDark', 'mainRotor', seg=14)
    s.cyl('hub cap', (-.30, 0, 4.13), .22, .08, 'oliveSeam', 'mainRotor', seg=12)
    for k in range(4):
        ang = math.radians(22) + k * math.pi / 2
        u = Vector((math.cos(ang), math.sin(ang), 0))
        v = Vector((-u.y, u.x, 0))

        def rp(r, w=0.0, z=0.0, u=u, v=v):
            return tuple(c + u * r + v * w + Vector((0, 0, z)))
        pts = [rp(.73, -.12, -.025), rp(4.98, -.24, -.055), rp(5.13, .08, -.055), rp(.74, .11, -.025)]
        verts = pts + [tuple(Vector(q) + Vector((0, 0, .045))) for q in pts]
        s.add('rotor blade', verts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
              'uiDark', 'mainRotor')
        s.box('blade tip', rp(4.85, -.05, .02), (.55, .32, .06), 'oliveLight', 'mainRotor', rot=(0, 0, ang), bevel=0)
        if L < 2:
            s.rod('rotor spindle', rp(.16), rp(.78), .075, 'oliveSeam', 'mainRotor', seg=6)
    # tail rotor (owner tailRotor)
    c2 = Vector((-5.59, .41, 2.72))
    s.cyl('tail rotor hub', (-5.59, .38, 2.72), .16, .17, 'oliveSeam', 'tailRotor', axis='Y', seg=10)
    for k in range(4):
        t = .45 + k * math.pi / 2
        u = Vector((math.sin(t), 0, math.cos(t)))
        v = Vector((math.cos(t), 0, -math.sin(t)))
        pts = [tuple(c2 + u * r + v * w) for r, w in [(.12, -.07), (.94, -.12), (1.04, .12), (.19, .09)]]
        verts = [(x, y - .025, z) for x, y, z in pts] + [(x, y + .025, z) for x, y, z in pts]
        s.add('tail paddle', verts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
              'uiDark', 'tailRotor')
        if True:
            s.box('tail tip', tuple(c2 + u * .97), (.20, .065, .16), 'oliveLight', 'tailRotor', rot=(0, t, 0), bevel=0)

    # ---- skids and struts
    for sg in (-1, 1):
        skid = [(-1.68, sg * 1.30, .29), (-1.58, sg * 1.30, .16), (-1.43, sg * 1.30, .085), (-1.21, sg * 1.30, .07),
                (1.77, sg * 1.30, .07), (1.97, sg * 1.30, .12), (2.13, sg * 1.30, .27)]
        if L == 2:
            skid = [skid[0], skid[3], skid[4], skid[6]]
        s.tube('landing skid', skid, .07, 'oliveSeam', sides=6)
        for x in (-1.03, 1.15):
            strut = [(x, sg * .70, .94), (x, sg * .90, .76), (x, sg * 1.06, .54), (x, sg * 1.23, .23), (x, sg * 1.30, .13)]
            if L == 2:
                strut = [strut[0], strut[-1]]
            s.tube('landing strut', strut, .075, 'oliveSeam', sides=6)
            if L < 2:
                s.box('skid saddle', (x, sg * 1.30, .14), (.28, .22, .12), 'uiDark', bevel=.03)

    # ---- searchlight (lit lens) and housing
    s.cyl('searchlight housing', (2.29, 0, .72), .205, .34, 'uiDark', axis='X', seg=14)
    s.cyl('searchlight rim', (2.48, 0, .72), .209, .055, 'oliveSeam', axis='X', seg=14)
    s.cyl('searchlight lens', (2.513, 0, .72), .167, .018, 'windowGlow', 'lightsFront', axis='X', seg=14, emissive=True)
    s.rod('searchlight bracket', (2.15, 0, 1.02), (2.15, 0, .70), .055, 'uiDark', seg=6)

    # ---- door guns on pintles (owners doorGun port / doorGunR starboard, swivel about Z)
    for sg, own in ((1, 'doorGun'), (-1, 'doorGunR')):
        y = sg * .95
        s.rod('gun post', (-.05, sg * .70, .66), (-.05, y, 1.26), .045, 'uiDark', seg=6)
        s.box('gun yoke', (0, y, 1.31), (.22, .20, .10), 'oliveSeam', own, bevel=.02)
        s.box('gun receiver', (.16, y, 1.40), (.56, .15, .17), 'uiDark', own, bevel=.02)
        s.frustum('gun barrel', (.42, y, 1.40), (1.36, y, 1.40), .035, None, 'uiDark', own, seg=8)
        s.frustum('gun jacket', (.40, y, 1.40), (.86, y, 1.40), .058, None, 'oliveSeam', own, seg=8)
        s.frustum('muzzle brake', (1.30, y, 1.40), (1.42, y, 1.40), .052, None, 'uiDark', own, seg=8)
        s.box('gun shield', (.50, y, 1.50), (.04, .46, .36), 'olive', own, bevel=0)
        s.box('ammo box', (.02, sg * .76, 1.32), (.20, .20, .22), 'khaki', own, bevel=.02)
        if L < 2:
            for g in (-1, 1):
                s.rod('gun grip', (-.14, y + g * .08, 1.40), (-.28, y + g * .10, 1.50), .02, 'uiDark', own, seg=5)
            s.box('gun sight', (.20, y, 1.52), (.07, .05, .08), 'uiDark', own, bevel=0)

    # ---- physics, sockets, colliders, lights
    s.physics('heavy', 2400, 'prop.metal-heavy', True, (0, 1.8, 0))
    s.collider('cabin', (4.8, 2.0, 2.3), (.33, 0, 1.68))
    s.collider('tail', (4.0, .52, .52), (-3.8, 0, 2.42))
    s.socket('front', (2.70, 0, 1.25))
    s.socket('muzzle', (1.43, .95, 1.40), 'doorGun')
    s.socket('muzzleR', (1.43, -.95, 1.40), 'doorGunR')
    for name, loc in {'driverSeat': (1.0, .4, 1.5), 'exitL': (.1, 1.6, 0), 'exitR': (.1, -1.6, 0)}.items():
        s.socket(name, loc)
    s.light('searchlight', (2.53, 0, .72), {
        'type': 'spot', 'color': 'light_window_warm', 'intensity': 6, 'range': 24, 'angle': 42, 'penumbra': .4,
        'pool': True, 'beam': 'strong', 'flare': True, 'shadow': 'hero', 'heroPriority': 2,
        'emissiveNodes': ['lightsFront_emi_windowGlow']},
        tuple(Vector((1, 0, -.55)).to_track_quat('-Z', 'Y').to_euler()))
    s.light('beacon', (-5.99, 0, 4.24), {
        'type': 'point', 'color': 'light_siren_red', 'intensity': 2, 'range': 3,
        'emissiveNodes': ['lightsBrake_emi_sirenRed']})
