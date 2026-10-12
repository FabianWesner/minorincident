"""L8 zoo service-tunnel mouth: a closed masonry bunker with a steel double door.

The tunnel network the military failed to secure surfaces here. Seen from outside it is a locked service
building; the interior is an L-shaped dark vestibule (partition wall behind the door, passage to the +Y side,
tunnel chamber at the back), so nothing inside is visible from the apron even with both leaves open.
Blender frame: +X forward (door side), Z up, Y lateral; the footprint is centred on the origin (the layout
collider is the manifest AABB), door plane x = 3.1. The paved apron is placed by the district layout, not here.
Door leaves are the animated joints `door_main` / `door_main_right` (same contract as bld.clinic-annex).
"""
from . import sockets, colliders

BRICK, STONE, DARK, HAZARD = 'brick', 'sidewalk', 'uiDark', 'schoolBusYellow'
X0, X1 = -3.1, 3.1         # back wall outer face .. door plane (front wall outer face)
HALF = 2.6                 # half width
H = 3.4                    # wall height
APERTURE = .9              # half width of the door opening
DOOR_TOP = 2.5


def tunnel_mouth(s):
    s.physics('fixed', 0, False, 'prop.stone-heavy')
    # Interior floor and the sill (top just above the district paving so the edges never z-fight).
    s.box('floor', ((X0 + X1) / 2, 0, .06), (X1 - X0, 2 * HALF, .12), DARK, bevel=0)
    s.box('threshold', (X1 - .1, 0, .09), (.5, 2 * APERTURE, .06), STONE, bevel=0)
    # Masonry shell: front piers + lintel around the 1.8 m opening, side/back walls, flat roof with a drip overhang.
    for sign in (-1, 1):
        lo, hi = (APERTURE, HALF) if sign > 0 else (-HALF, -APERTURE)
        s.box('front pier', (X1 - .2, (lo + hi) / 2, H / 2 + .06), (.4, hi - lo, H), BRICK)
        s.box('side wall', ((X0 + X1 - .4) / 2, sign * (HALF - .2), H / 2 + .06), (X1 - X0 - .4, .4, H), BRICK)
    s.box('lintel', (X1 - .2, 0, (DOOR_TOP + H) / 2 + .06), (.4, 2 * APERTURE, H - DOOR_TOP), BRICK)
    s.box('back wall', (X0 + .2, 0, H / 2 + .06), (.4, 2 * HALF - .8, H), BRICK)
    s.box('roof', ((X0 + X1) / 2, 0, H + .2), (X1 - X0 + .4, 2 * HALF + .4, .3), STONE)
    s.box('roof curb', ((X0 + X1) / 2, 0, H + .42), (X1 - X0 + .1, 2 * HALF + .1, .14), BRICK, d=1)
    # Interior: partition facing the door leaves a 1.3 m passage on the +Y side to the tunnel chamber at the back.
    s.box('partition', (X0 + 3.4, -.85, H / 2 + .06), (.4, 2.9, H), DARK, d=1)
    s.box('chamber arch', (X0 + .45, 1.0, 1.35), (.12, 1.7, 2.5), DARK, d=1)
    # Roof vent (kept at every tier so the silhouette and envelope never change).
    s.box('roof vent', (X0 + 2.2, 1.2, H + .85), (1.1, .9, .7), STONE)
    s.box('vent cap', (X0 + 2.2, 1.2, H + 1.28), (1.3, 1.1, .16), DARK)
    # Masonry detailing: stone plinth band, cornice under the roof, cable conduit.
    for sign in (-1, 1):
        s.box('plinth side', ((X0 + X1 - .4) / 2, sign * (HALF + .04), .36), (X1 - X0 - .4, .1, .5), STONE, d=1)
        lo, hi = (APERTURE, HALF) if sign > 0 else (-HALF, -APERTURE)
        s.box('plinth front', (X1 + .04, (lo + hi) / 2, .36), (.1, hi - lo, .5), STONE, d=1)
        s.box('cornice side', ((X0 + X1 - .4) / 2, sign * (HALF + .05), H - .12), (X1 - X0 - .4, .14, .24), STONE, d=1)
        # Hazard stripes either side of the door.
        s.box('hazard stripe', (X1 + .03, sign * (APERTURE + .17), 1.3), (.06, .24, DOOR_TOP - .12), HAZARD, bevel=0, d=1)
    s.box('cornice front', (X1 + .05, 0, H - .12), (.14, 2 * HALF + .1, .24), STONE, d=1)
    s.tube('conduit', (X1 + .1, HALF - .45, 1.7), .06, 3.2, DARK, d=1)
    # Service sign above the door.
    s.box('sign plate', (X1 + .04, 0, DOOR_TOP + .5), (.06, 1.7, .5), HAZARD, bevel=0, d=1)
    s.text('SERVICE', (X1 + .085, 0, DOOR_TOP + .5), .3, DARK, d=1)
    # Steel double door: two leaves on hinge joints, outward-opening (same pivots/contract as the clinic annex doors).
    for name, sign in (('door_main', -1), ('door_main_right', 1)):
        hinge = s.joint(name, (X1 - .05, sign * APERTURE, .12))
        s.box(name + ' leaf', (0, -sign * (APERTURE / 2 - .01), (DOOR_TOP - .12) / 2), (.07, APERTURE - .02, DOOR_TOP - .13), DARK, parent=hinge, bevel=0)
    # Anchors (glTF frame via the exporter): where the infected stand behind the door, the tunnel chamber, the door sill.
    sockets.empty('outletInside', (X1 - 1.15, 0, .12), s.root)
    sockets.empty('outletTunnel', (X0 + 1.3, 1.45, .12), s.root)
    sockets.empty('outletThreshold', (X1, 0, .12), s.root)
    colliders.cuboid('hull', (X1 - X0 + .4, 2 * HALF + .4, H + .4), ((X0 + X1) / 2, 0, (H + .4) / 2), s.root)
