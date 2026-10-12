"""The twelve crowd accessories (6 hats, 6 hair pieces); see accessories.py for the contract."""
import math
from mathutils import Vector
from . import accessories as A
from .accessories import C, Piece, shell, lathe, bill, ball, tube, env_point, export_set

HAT, HAIR = 'pants', 'hairWhite'   # mid-grey / light neutral bases for per-instance tinting


def table(points):
    """Piecewise-linear lookup on |azimuth| (0 front .. pi back)."""
    def edge(u):
        a = abs((u + math.pi) % (2 * math.pi) - math.pi)
        for (x0, z0), (x1, z1) in zip(points, points[1:]):
            if a <= x1:
                return z0 + (z1 - z0) * (a - x0) / (x1 - x0)
        return points[-1][1]
    return edge


def pick(lod, a, b):
    return a if lod == 0 else b


def cap(lod):
    """Baseball cap: six panels (seam grooves, flat facets), top button, curved forward bill."""
    p = Piece(flat=True)
    cols, rows = pick(lod, 12, 8), pick(lod, 4, 3)
    shell(p, cols, rows, 0, 2 * math.pi, lambda u: 1.262 + .05 * math.cos(u), infl=.022, closed=True, seam=(2, .02))
    bill(p, 0, .62, 1.325, .09, .02, .022, cols=pick(lod, 3, 2))
    ball(p, (C.x, 0, C.z + A.R[2] + .022 + .006), .024, pick(lod, 5, 4), 2, .8)
    return p, C


def beanie(lod):
    p = Piece()
    cols, rows = pick(lod, 12, 8), pick(lod, 4, 3)
    shell(p, cols, rows, 0, 2 * math.pi, table([(0, 1.285), (.9, 1.25), (1.4, 1.165), (2.6, 1.15), (math.pi, 1.15)]), infl=.036, closed=True)
    ball(p, (C.x, 0, C.z + A.R[2] + .03 + .02), .05, pick(lod, 6, 4), pick(lod, 3, 2), .9)
    return p, C


def sun_hat(lod):
    p = Piece()
    n = pick(lod, 10, 6)
    profile = [(.40, 1.225), (.33, 1.252), (.265, 1.262), (.27, 1.34), (.245, 1.43), (0, 1.462)]
    lathe(p, profile, n, sx=.9, sy=1.0)
    return p, C


def hard_hat(lod):
    p = Piece()
    cols, rows = pick(lod, 10, 7), pick(lod, 3, 2)
    shell(p, cols, rows, 0, 2 * math.pi, lambda u: 1.268 + .012 * math.cos(u), infl=.04, closed=True)
    bill(p, 0, .7, 1.28, .07, .015, .04, cols=pick(lod, 3, 2))
    path = [env_point(0, .8, (.04,) * 3), env_point(0, 1.38, (.055,) * 3), env_point(math.pi, 1.38, (.055,) * 3), env_point(math.pi, .8, (.04,) * 3)]
    tube(p, path, [.016] * 4, pick(lod, 4, 3))
    return p, C


def flat_cap(lod):
    p = Piece()
    cols, rows = pick(lod, 12, 8), pick(lod, 3, 2)
    centre = Vector((-.012, 0, 1.275))
    shell(p, cols, rows, 0, 2 * math.pi, lambda u: 1.248 + .03 * math.cos(u), infl=.026, closed=True,
          centre=centre, radii=(.205, .225, .15))
    bill(p, 0, .95, 1.282, .11, .03, .026, cols=pick(lod, 4, 2))
    return p, centre


def bucket(lod):
    p = Piece()
    n = pick(lod, 10, 6)
    profile = [(.34, 1.205), (.295, 1.236), (.262, 1.252), (.27, 1.34), (.25, 1.43), (0, 1.46)]
    lathe(p, profile, n, sx=.9, sy=1.0)
    return p, C


CROP_EDGE = table([(0, 1.34), (.75, 1.34), (1.3, 1.24), (2.2, 1.205), (math.pi, 1.17)])


def crop_shell(p, lod, infl=.014, **kw):
    cols, rows = pick(lod, 12, 8), pick(lod, 3, 2)
    return shell(p, cols, rows, 0, 2 * math.pi, CROP_EDGE, infl=infl, closed=True, **kw)


def crop(lod):
    p = Piece()
    crop_shell(p, lod)
    return p, C


def ponytail(lod):
    p = Piece()
    crop_shell(p, lod)
    path = [(-.235, 0, 1.31), (-.31, 0, 1.22), (-.33, 0, 1.09), (-.30, 0, .99)]
    tube(p, path, [.05, .052, .045, 0], pick(lod, 5, 4))
    return p, C


def bun(lod):
    p = Piece()
    crop_shell(p, lod, infl=.022)
    ball(p, (-.12, 0, pick(lod, 1.5, 1.455)), pick(lod, .105, .118), pick(lod, 7, 5), pick(lod, 4, 3))
    return p, C


def afro(lod):
    p = Piece(flat=True)
    cols, rows = pick(lod, 12, 8), pick(lod, 5, 3)
    shell(p, cols, rows, 0, 2 * math.pi, table([(0, 1.35), (.8, 1.35), (1.3, 1.215), (math.pi, 1.17)]), infl=.065, closed=True, bump=.10)
    return p, C


def side_part(lod):
    p = Piece()

    def edge(u):
        base = CROP_EDGE(u)
        if abs(u) < 1.0 and u > 0:                    # fringe swept over the +Y brow
            return base - .06 * math.sin(math.pi * min(1.0, u / .9) * .5 + .15) * (1 - abs(u) / 1.1)
        return base
    cols, rows = pick(lod, 12, 8), pick(lod, 3, 2)
    shell(p, cols, rows, 0, 2 * math.pi, edge, infl=.016, closed=True)
    path = [env_point(-.35, .9, (.02,) * 3), env_point(-.35, 1.25, (.03,) * 3), env_point(-.5, 1.45, (.03,) * 3)]
    tube(p, path, [.014, .014, .01], 3)
    return p, C


def long_straight(lod):
    p = Piece()
    cols, rows = pick(lod, 12, 8), pick(lod, 5, 3)
    shell(p, cols, rows, 0, 2 * math.pi, table([(0, 1.335), (.78, 1.335), (1.2, 1.12), (2.2, 1.03), (math.pi, 1.0)]), infl=.05, closed=True, low_taper=.97)
    return p, C


BUILDERS = {
    'acc.hat-baseball-cap': (HAT, cap), 'acc.hat-beanie': (HAT, beanie), 'acc.hat-sun-hat': (HAT, sun_hat),
    'acc.hat-hard-hat': (HAT, hard_hat), 'acc.hat-flat-cap': (HAT, flat_cap), 'acc.hat-bucket-hat': (HAT, bucket),
    'acc.hair-short-crop': (HAIR, crop), 'acc.hair-ponytail': (HAIR, ponytail), 'acc.hair-bun': (HAIR, bun),
    'acc.hair-afro': (HAIR, afro), 'acc.hair-side-part': (HAIR, side_part), 'acc.hair-long-straight': (HAIR, long_straight),
}


def build(asset_id, here):
    token, fn = BUILDERS[asset_id]
    return export_set(asset_id, here, fn, token)
