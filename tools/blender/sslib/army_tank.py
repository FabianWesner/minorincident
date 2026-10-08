"""veh.tank: tracked main battle tank, +X forward, Z up, metres. Owners: body,
turret (yaw), gun (elevation, child of turret), lit lamps. Authored per tier."""
import math
from mathutils import Vector


def star(s, name, center, size, side):
    cx, cy, cz = center
    pts = [(cx, cy, cz)]
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = size if i % 2 == 0 else size * .42
        pts.append((cx + r * math.cos(a), cy, cz + r * math.sin(a)))
    s.add(name, pts, [(0, i + 1, (i + 1) % 10 + 1) for i in range(10)], 'picketWhite', closed=False,
          outward=(0, side, 0))


def ring6(x, w, lo, hi, cham=.28, inset=.30):
    return [(x, -w, lo), (x, w, lo), (x, w, hi - cham), (x, w - inset, hi), (x, -w + inset, hi), (x, -w, hi - cham)]


def recipe(s):
    L = s.lod
    s.owner('body')
    s.owner('turret', (-.25, 0, 1.72))
    s.owner('gun', (1.30, 0, 2.12), 'turret')
    s.owner('lightsFront', (3.3, 0, 1.3))
    s.owner('lightsBrake', (-3.42, 0, .85))
    s.ao_floor = .35

    # ---- hull: closed chamfered armour tub with sloped glacis
    spec = [(-3.40, 1.38, .60, 1.48), (-3.10, 1.62, .58, 1.70), (1.85, 1.62, .58, 1.70),
            (2.85, 1.52, .50, 1.52), (3.55, 1.34, .42, 1.14)]
    s.loft('hull', [ring6(*r) for r in spec], 'olive')
    # raised engine deck with louvres, rear plate grille
    s.box('engine deck', (-2.50, 0, 1.73), (1.35, 1.80, .08), 'oliveLight', bevel=.025)
    if L < 2:
        for i in range(8 if L == 0 else 4):
            x = -3.05 + i * (.14 if L == 0 else .28)
            s.box('deck louvre', (x, 0, 1.79), (.06, 1.55, .05), 'uiDark', bevel=0)
    s.box('rear grille', (-3.43, 0, 1.02), (.06, 1.34, .62), 'oliveSeam', bevel=.02)
    if L < 2:
        for i in range(5 if L == 0 else 3):
            s.box('rear slat', (-3.465, 0, .80 + i * (.11 if L == 0 else .17)), (.03, 1.22, .05), 'uiDark', bevel=0)
    for sgn in (-1, 1):
        s.box('brake lens', (-3.46, sgn * 1.05, .88), (.04, .28, .16), 'sirenRed', 'lightsBrake', bevel=0, emissive=True)
        s.box('tail guard', (-3.43, sgn * 1.05, .88), (.06, .36, .24), 'oliveSeam', bevel=.02)
        if L == 0:
            s.rod('tow hook', (-3.44, sgn * .55, .72), (-3.58, sgn * .55, .72), .045, 'uiDark')
    # glacis: headlamps, driver hatch with periscopes, tow hooks
    for sgn in (-1, 1):
        s.box('lamp guard', (3.20, sgn * 1.00, 1.36), (.20, .42, .28), 'oliveSeam', rot=(0, .5, 0), bevel=.025)
        s.box('headlamp', (3.245, sgn * 1.00, 1.375), (.04, .30, .18), 'windowGlow', 'lightsFront',
              rot=(0, .5, 0), bevel=0, emissive=True)
    s.cyl('driver hatch', (2.15, 0, 1.75), .36, .10, 'oliveSeam', seg=18)
    s.cyl('driver hatch lid', (2.15, 0, 1.81), .30, .05, 'oliveLight', seg=18)
    if L < 2:
        for dy in (-.22, 0, .22):
            s.box('driver periscope', (2.42, dy, 1.78), (.10, .14, .10), 'tealDark', rot=(0, .4, 0), bevel=0)
    if L == 0:
        for sgn in (-1, 1):
            s.rod('front tow hook', (3.58, sgn * .55, .88), (3.72, sgn * .55, .86), .05, 'uiDark')
    s.box('front plate', (3.56, 0, .98), (.10, 2.20, .26), 'oliveSeam', bevel=.03)

    # ---- running gear
    outline = [(-2.65, .06), (2.05, .06), (2.90, .50), (3.30, .98), (3.05, 1.28), (2.50, 1.32),
               (-2.50, 1.32), (-3.15, 1.15), (-3.40, .72), (-3.10, .25)]
    roadx = [-2.25, -1.45, -.65, .15, .95, 1.75]
    pad_step = .36 if L == 0 else .72
    for sgn in (-1, 1):
        yc = sgn * 1.23
        y0, y1 = sorted((yc - .37, yc + .37))
        s.band('track', outline, .10, y0, y1, 'uiDark')
        s.box('track inner wall', (0, sgn * .90, .66), (6.4, .06, 1.2), 'uiDark', bevel=0)
        # cleat pads along the visible lower run, nose slope and tail
        if L < 2:
            pts = [Vector(p) for p in outline]
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                if (a.y + b.y) / 2 > .95:
                    continue
                d = b - a
                count = max(1, int(d.length / pad_step))
                ang = -math.atan2(d.y, d.x)
                nrm = Vector((d.y, -d.x)).normalized()
                for k in range(count):
                    c = a + d * ((k + .5) / count) + nrm * .03
                    s.box('track pad', (c.x, yc, c.y), (d.length / count * .78, .66, .075), 'pantsDark',
                          rot=(0, ang, 0), bevel=0)
        # wheels: dark tyre, olive disc, hub cap
        for x in roadx:
            s.cyl('road wheel tyre', (x, yc, .50), .42, .66, 'uiDark', axis='Y', seg=20)
            s.cyl('road wheel disc', (x, yc + sgn * .02, .50), .32, .70, 'olive', axis='Y', seg=20)
            if L < 2:
                s.cyl('road wheel hub', (x, yc + sgn * .02, .50), .13, .76, 'oliveSeam', axis='Y', seg=12)
        for name, x, z, r in (('sprocket', -2.95, .80, .45), ('idler', 2.88, .80, .42)):
            s.cyl(name + ' tyre', (x, yc, z), r, .60, 'uiDark', axis='Y', seg=20)
            s.cyl(name + ' disc', (x, yc + sgn * .02, z), r - .10, .68, 'olive', axis='Y', seg=20)
            if L < 2:
                s.cyl(name + ' hub', (x, yc + sgn * .02, z), .15, .76, 'oliveSeam', axis='Y', seg=12)
        if L == 0:
            for i in range(14):
                a = i * math.tau / 14
                s.box('sprocket tooth', (-2.95 + .50 * math.cos(a), yc + sgn * .02, .80 + .50 * math.sin(a)),
                      (.12, .62, .10), 'oliveSeam', rot=(0, -a, 0), bevel=0)
        # side skirt panels over the upper track, wheels read beneath
        panels = [-2.08, -1.08, -.08, .92, 1.92]
        if L < 2:
            for x in panels:
                s.box('skirt panel', (x, sgn * 1.70, 1.06), (.94, .09, .92), 'olive', bevel=.025)
            if L == 0:
                for x in panels:
                    s.box('skirt panel inset', (x, sgn * 1.752, 1.06), (.78, .02, .70), 'oliveLight', bevel=0)
            s.box('skirt cap', (-.08, sgn * 1.68, 1.56), (5.05, .20, .06), 'oliveLight', bevel=.02)
            s.box('skirt lower rail', (-.08, sgn * 1.74, .63), (5.05, .05, .05), 'oliveSeam', bevel=0)
        else:
            s.box('skirt', (-.08, sgn * 1.70, 1.06), (5.05, .09, .92), 'olive', bevel=0)
        # mud guards
        s.box('front fender', (3.02, sgn * 1.20, 1.38), (1.20, .90, .07), 'oliveLight', rot=(0, .45, 0), bevel=.02)
        s.box('rear fender', (-3.28, sgn * 1.20, 1.22), (.90, .90, .07), 'oliveLight', rot=(0, -.30, 0), bevel=.02)
        if L < 2:
            star(s, 'unit star', (-.08, sgn * 1.752, 1.06), .26, sgn)

    # ---- turret (owner 'turret'): faceted wedge
    t = [(-1.95, .88, 1.78, 2.12, 2.42), (-1.55, 1.20, 1.78, 2.22, 2.62), (-.25, 1.38, 1.78, 2.20, 2.60),
         (.85, 1.20, 1.78, 2.08, 2.46), (1.40, .62, 1.84, 2.04, 2.22)]
    rings = [[(x, -w, lo), (x, w, lo), (x, w, mid), (x, w * .62, hi), (x, -w * .62, hi), (x, -w, mid)]
             for x, w, lo, mid, hi in t]
    s.loft('turret shell', rings, 'olive', 'turret')
    for sg in (-1, 1):
        s.box('turret cheek armour', (.55, sg * 1.12, 2.30), (.95, .16, .62), 'oliveLight', 'turret',
              rot=(0, 0, -sg * .42), bevel=.03)
    s.box('splash vane', (3.05, 0, 1.56), (.10, 2.30, .34), 'oliveLight', rot=(0, .5, 0), bevel=.02)
    s.cyl('turret ring', (-.25, 0, 1.76), 1.05, .12, 'oliveSeam', 'turret', seg=24)
    s.box('turret bustle', (-2.10, 0, 2.12), (.55, 1.50, .62), 'olive', 'turret', bevel=.04)
    if L < 2:
        s.box('bustle strap', (-2.38, 0, 2.12), (.05, 1.40, .10), 'oliveSeam', 'turret', bevel=0)
    for sgn in (-1, 1):
        s.box('stowage box', (-1.35, sgn * 1.38, 2.12), (.80, .20, .48), 'oliveLight', 'turret', bevel=.03)
        if L == 0:
            for i in range(3):
                s.box('smoke discharger', (.20 + i * .17, sgn * 1.26, 2.20), (.12, .10, .20), 'uiDark', 'turret', bevel=0)
            s.box('stowage strap', (-1.35, sgn * 1.49, 2.12), (.10, .03, .50), 'oliveSeam', 'turret', bevel=0)
    # commander cupola + loader hatch + gunner sight
    s.cyl('cupola', (-.90, .50, 2.70), .34, .24, 'oliveSeam', 'turret', seg=18)
    s.cyl('cupola lid', (-.90, .50, 2.84), .29, .06, 'oliveLight', 'turret', seg=18)
    if L < 2:
        for i in range(6 if L == 0 else 4):
            a = i * math.tau / (6 if L == 0 else 4)
            s.box('cupola vision', (-.90 + .32 * math.cos(a), .50 + .32 * math.sin(a), 2.76), (.08, .10, .09),
                  'tealDark', 'turret', rot=(0, 0, a), bevel=0)
        s.cyl('loader hatch', (-1.30, -.55, 2.66), .30, .10, 'oliveSeam', 'turret', seg=16)
        s.cyl('loader lid', (-1.30, -.55, 2.72), .25, .05, 'oliveLight', 'turret', seg=16)
        s.box('gunner sight', (.70, -.45, 2.58), (.42, .46, .22), 'oliveSeam', 'turret', bevel=.03)
        s.box('sight glass', (.92, -.45, 2.60), (.03, .34, .12), 'tealDark', 'turret', bevel=0)
        s.box('antenna base', (-1.75, -.85, 2.52), (.14, .14, .10), 'uiDark', 'turret', bevel=0)

    s.rod('antenna', (-1.75, -.85, 2.50), (-1.85, -.85, 3.50), .02, 'uiDark', 'turret', seg=5)

    # ---- gun (owner 'gun'): mantlet, sleeve, barrel, fume extractor, muzzle brake
    s.frustum('mantlet', (1.38, 0, 2.12), (1.95, 0, 2.12), .40, .34, 'olive', 'gun', seg=20)
    s.frustum('gun sleeve', (1.90, 0, 2.12), (3.20, 0, 2.12), .17, .15, 'olive', 'gun', seg=16)
    s.frustum('gun barrel', (3.20, 0, 2.12), (5.60, 0, 2.12), .115, None, 'oliveSeam', 'gun', seg=14)
    s.frustum('fume extractor', (3.95, 0, 2.12), (4.55, 0, 2.12), .155, None, 'olive', 'gun', seg=14)
    s.frustum('muzzle brake', (5.45, 0, 2.12), (5.95, 0, 2.12), .15, None, 'uiDark', 'gun', seg=14)
    if L < 2:
        s.frustum('sleeve collar', (2.55, 0, 2.12), (2.70, 0, 2.12), .20, None, 'oliveSeam', 'gun', seg=14)
        s.frustum('barrel collar', (4.80, 0, 2.12), (4.90, 0, 2.12), .15, None, 'oliveLight', 'gun', seg=12)
        s.box('coax mg', (1.85, .46, 2.04), (.55, .09, .09), 'uiDark', 'gun', bevel=0)

    s.physics('heavy', 28000, 'prop.metal-heavy', False, (0, 1.1, 0))
    s.collider('hull', (7.0, 3.5, 2.0), (-.05, 0, 1.0))
    s.socket('front', (3.75, 0, 1.0))
    s.socket('muzzle', (5.96, 0, 2.12), 'gun')
    for sgn, label in ((-1, 'L'), (1, 'R')):
        s.light('head' + label, (3.30, sgn * 1.00, 1.38), {
            'type': 'spot', 'color': 'light_window_warm', 'intensity': 5, 'range': 24, 'angle': 48,
            'penumbra': .35, 'pool': True, 'beam': 'soft', 'flare': True, 'shadow': 'hero', 'heroPriority': 2,
            'emissiveNodes': ['lightsFront_emi_windowGlow']}, (0, -math.pi / 2, 0))
        s.light('brake' + label, (-3.50, sgn * 1.05, .88), {
            'type': 'point', 'color': 'light_siren_red', 'intensity': 2, 'range': 3,
            'emissiveNodes': ['lightsBrake_emi_sirenRed']})
