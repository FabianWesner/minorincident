"""kit.market-doors: one glazed double door with its frame, for Grove Market's front and loading doorways (L2 beat 7).

PO 10-15 "L2: FFs open the doors, but there is no visible door": the market showed flat wall panels where the doors
should be. Blender Z up, +X is the outside (the side the leaves swing to), the wall plane is x=0, the clear opening is
2.6 m wide (Blender Y -1.3..1.3) and 2.9 m high. The two leaves are separate hinge owners (marketLeafL at Blender y +1.2,
marketLeafR at y -1.2); the view swings them about their hinge's +Y (glTF), left +, right -, up to 100 degrees outward.
No collider: the sim's own door walls (LevelTwoRescue 'door-front' / 'door-loading') close and open the doorway.
"""

FRAME, GLASS, DARK = 'picketWhite', 'denimLight', 'uiDark'
HINGE = 1.19         # hinge line, from the doorway centre
LEAF_W = 1.18        # hinge to the centre gap
LEAF_H = 2.68        # leaf bottom 0.08 above the floor, top 0.04 under the head


def leaf(s, name, side):
    """side +1 for the leaf hinged at +Y (swings with +yaw), -1 for the one hinged at -Y."""
    hinge = s.joint(name, (0, side * HINGE, .08))
    toward = -side   # the leaf extends from its hinge towards the doorway centre

    def part(label, along, z, size, token, d=2):
        return s.box(name + label, (0, toward * along, z), size, token, parent=hinge, bevel=0, d=d)
    part('StileHinge', .045, LEAF_H / 2, (.07, .09, LEAF_H), FRAME)
    part('StileFree', LEAF_W - .045, LEAF_H / 2, (.07, .09, LEAF_H), FRAME)
    part('RailTop', LEAF_W / 2, LEAF_H - .06, (.07, LEAF_W - .18, .12), FRAME)
    part('KickPlate', LEAF_W / 2, .22, (.07, LEAF_W - .18, .44), FRAME)
    if s.lod <= 1:
        part('RailMid', LEAF_W / 2, 1.12, (.07, LEAF_W - .18, .08), FRAME)
        part('GlassUp', LEAF_W / 2, 1.88, (.03, LEAF_W - .2, 1.4), GLASS)
        part('GlassLow', LEAF_W / 2, .78, (.03, LEAF_W - .2, .56), GLASS)
        # Push bar on the outside face at the free edge, on two stand-offs.
        s.box(name + 'PushBar', (.1, toward * (LEAF_W - .3), 1.0), (.04, .5, .04), FRAME, parent=hinge, bevel=0)
        for dy in (-.2, .2):
            s.box(name + 'PushStand', (.0675, toward * (LEAF_W - .3 + dy), 1.0), (.065, .03, .03), FRAME, parent=hinge, bevel=0)
    else:
        part('GlassTall', LEAF_W / 2, 1.5, (.03, LEAF_W - .2, 2.0), GLASS)
    return hinge


def market_doors(s):
    for side in (-1, 1):
        s.box('jamb', (0, side * (1.3 - .05), 1.44), (.24, .1, 2.82), FRAME)
    s.box('head', (0, 0, 2.85), (.22, 2.5, .1), FRAME)
    s.box('threshold', (0, 0, .03), (.34, 2.5, .06), DARK)
    leaf(s, 'marketLeafL', 1)
    leaf(s, 'marketLeafR', -1)
    s.physics()
