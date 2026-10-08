"""prop.hmg-nest (sandbag ring + shielded long-barrel HMG on a tripod) and
prop.tent (chunky pitched field tent). Authored per tier; +X forward, Z up."""
import math
from mathutils import Vector


# ---------------------------------------------------------------------------- tent
def tent(s, owner='body', length=3.6, width=2.8, h0=1.05, ridge=2.40, roof='canvasTan', gable='khakiLight',
         wall='tealLight'):
    """Pitched field tent centred on the current frame; entry on +X."""
    L = s.lod
    W2, X2 = width / 2, length / 2
    s.box('groundsheet', (0, 0, .03), (length + .12, width + .12, .06), 'khakiSeam', owner, bevel=0)
    s.box('tent walls', (0, 0, h0 / 2), (length, width, h0), wall, owner, bevel=.03)
    for gx0, gx1 in ((X2 - .05, X2), (-X2, -X2 + .05)):
        s.extrude_yz('tent gable', [(-W2, h0 - .02), (W2, h0 - .02), (0, ridge - .02)], gx0, gx1, gable, owner)
    rise = ridge - h0
    for sg in (-1, 1):
        a = Vector((sg * W2, h0))
        d = (Vector((0, ridge)) - a).normalized()
        e2, r2 = a - d * .10, Vector((0, ridge)) + d * .05
        centre = (e2 + r2) / 2
        n = Vector((sg * d.y, abs(d.x)))
        centre = centre + n * .03
        s.box('roof panel', (0, centre.x, centre.y), (length + .26, (r2 - e2).length, .06), roof, owner,
              rot=(math.atan2(d.y, d.x), 0, 0), bevel=.02)
        if L < 2:
            s.box('eave trim', (0, e2.x, e2.y + .02), (length + .26, .08, .09), 'khakiSeam', owner, bevel=0)
        if L == 0:
            for x in (-X2 + .75, X2 - .75):
                c = (e2 + r2) / 2 + n * .065
                s.box('roof seam', (x, c.x, c.y), (.06, (r2 - e2).length * .96, .03), 'khakiSeam', owner,
                      rot=(math.atan2(d.y, d.x), 0, 0), bevel=0)
    s.box('ridge cap', (0, 0, ridge + .03), (length + .30, .16, .10), 'khakiSeam', owner, bevel=.03)
    # dark entry with rolled canvas flaps and ties
    door = [(-.58, 0), (.58, 0), (.58, 1.18), (0, 1.78), (-.58, 1.18)]
    s.extrude_yz('entry', door, X2 + .005, X2 + .05, 'uiDark', owner)
    if L < 2:
        for sg in (-1, 1):
            s.tube('entry flap', [(X2 + .08, sg * .63, .05), (X2 + .08, sg * .63, 1.20), (X2 + .08, sg * .05, 1.84)],
                   .055, 'khakiLight', owner, sides=6)
            for z in ((.30, .75) if L == 1 else (.25, .60, .95)):
                s.box('flap tie', (X2 + .11, sg * .66, z), (.04, .08, .12), 'khakiSeam', owner, bevel=0)
            s.box('side window', (.30, sg * (W2 + .012), .64), (.95, .04, .40), 'tealDark', owner, bevel=0)
            s.rod('window flap', (-.20, sg * (W2 + .05), .90), (.80, sg * (W2 + .05), .90), .04, 'khakiLight', owner, seg=6)
            for x in (-X2 + .03, X2 - .03):
                s.rod('corner pole', (x, sg * (W2 + .02), .02), (x, sg * (W2 + .02), h0 + .06), .05, 'woodWarm', owner, seg=6)
        for x in (-1.2, 0, 1.2) if L == 0 else (0,):
            for sg in (-1, 1):
                s.box('wall seam', (x, sg * (W2 + .012), h0 / 2), (.07, .03, h0 - .04), 'tealDark', owner, bevel=0)
        s.box('door mat', (X2 + .07, 0, .03), (.22, 1.0, .05), 'khakiSeam', owner, bevel=.01)
        s.box('rear vent', (-X2 - .01, 0, 1.30), (.04, .50, .26), 'uiDark', owner, bevel=0)
        s.rod('ridge pole', (-X2 - .16, 0, ridge + .08), (X2 + .16, 0, ridge + .08), .035, 'woodWarm', owner, seg=6)


def prop_tent(s):
    s.owner('body')
    # Footprint stays within the 3 x 3 m slot already reserved by the D-PARK / D-CIVIC layouts.
    tent(s, length=2.66, width=2.8, h0=.85, ridge=1.88)
    s.ao_floor = .5
    s.physics('fixed', 0, 'prop.wood-medium', True, (0, .9, 0))
    s.collider('body', (3.0, 2.9, 1.95), (0, 0, .98))
    s.socket('front', (1.6, 0, .5))
    s.socket('entry', (2.0, 0, 0))


# ---------------------------------------------------------------------------- hmg nest
def prop_hmg_nest(s):
    L = s.lod
    s.owner('body')
    s.owner('gun', (0, 0, 1.06))
    s.ao_floor = .30
    s.frustum('dirt floor', (0, 0, 0), (0, 0, .04), 1.30, None, 'leatherShadow', 'body', seg=20)
    # staggered sandbag ring with a rear opening for the crew
    if L < 2:
        step = 36
        for k in range(3):
            radius, z = 1.02 - .05 * k, .15 + .255 * k
            off = 18 * (k % 2)
            for i in range(-4, 5):
                theta = off + i * step
                if abs(((theta - 180 + 180) % 360) - 180) < 50:
                    continue
                a = math.radians(theta)
                tok = 'khaki' if (i + k) % 3 else 'khakiLight'
                s.box('sandbag', (radius * math.cos(a), radius * math.sin(a), z), (.62, .40, .27), tok,
                      'body', rot=(0, 0, a + math.pi / 2), bevel=.08)
    else:
        for i in range(-3, 4):
            a = math.radians(i * 45)
            if abs(i * 45) > 135:
                continue
            s.box('sandbag wall', (1.0 * math.cos(a), 1.0 * math.sin(a), .26), (.80, .50, .52), 'khaki', 'body',
                  rot=(0, 0, a + math.pi / 2), bevel=0)
    # tripod and mount
    if L < 2:
        for ang in (0, 140, -140):
            a = math.radians(ang)
            s.rod('tripod leg', (0, 0, 1.0), (.62 * math.cos(a), .62 * math.sin(a), .045), .035, 'oliveSeam', 'body', seg=6)
    if L < 2:
        s.rod('mount column', (0, 0, .50), (0, 0, 1.04), .055, 'uiDark', 'body', seg=8)

    # gun (owner gun): cradle, receiver, long barrel, shield, ammo box
    if L < 2:
        s.box('cradle', (.02, 0, 1.09), (.34, .26, .10), 'oliveSeam', 'gun', bevel=.02)
    s.box('receiver', (.06, 0, 1.21), (.70, .20, .24), 'olive', 'gun', bevel=.03)
    s.frustum('barrel', (.36, 0, 1.21), (1.55, 0, 1.21), .04, None, 'uiDark', 'gun', seg=8)
    if L < 2:
        s.frustum('barrel jacket', (.30, 0, 1.21), (.86, 0, 1.21), .066, None, 'oliveSeam', 'gun', seg=8)
    s.frustum('muzzle brake', (1.45, 0, 1.21), (1.62, 0, 1.21), .066, None, 'uiDark', 'gun', seg=8)
    ears = [(-.44, .98), (.44, .98), (.44, 1.50), (.28, 1.64), (.15, 1.64), (.12, 1.48), (-.12, 1.48),
            (-.15, 1.64), (-.28, 1.64), (-.44, 1.50)]
    s.extrude_yz('shield', ears if L < 2 else [(-.44, .98), (.44, .98), (.44, 1.58), (-.44, 1.58)], .58, .64, 'olive', 'gun')
    if L < 2:
        s.box('ammo box', (.02, -.38, 1.04), (.26, .34, .30), 'olive', 'gun', bevel=.025)
    if L == 0:
        s.box('ammo belt', (.06, -.17, 1.19), (.05, .22, .05), 'brass', 'gun', bevel=0)
        s.box('feed cover', (.10, 0, 1.33), (.26, .13, .05), 'oliveLight', 'gun', bevel=0)
        s.box('top sight', (.22, 0, 1.37), (.07, .05, .08), 'uiDark', 'gun', bevel=0)
        for sg in (-1, 1):
            s.rod('rear grip', (-.20, sg * .09, 1.22), (-.40, sg * .11, 1.33), .03, 'uiDark', 'gun', seg=5)
    s.physics('fixed', 0, 'prop.metal-heavy', False, (0, .5, 0))
    for name, size, pos in (('north', (2.0, .46, .8), (0, 1.02, .4)), ('south', (2.0, .46, .8), (0, -1.02, .4)),
                            ('east', (.46, 1.8, .8), (1.0, 0, .4))):
        s.collider(name, size, pos)
    s.socket('front', (1.3, 0, .5))
    s.socket('muzzle', (1.63, 0, 1.21), 'gun')
    s.socket('gunnerSocket', (-.45, 0, .04))
