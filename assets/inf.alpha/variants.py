"""Alpha looks (PO #23), rebuilt 2026-10-22 on the clean low-poly kit (tools/blender/lowpoly.py).

Every look is the same rig, rest pose, scale and animation set as inf.alpha: the same body modelled in the same joint
frames; only palette tokens (palette.json names, no textures) and a few clothing/growth primitives differ. All looks share
the triangle targets (the unit tests allow +10% against the base at every LOD).
base   = concept A1 hunched brute (torn shirt, slate trousers, rose shoulder growth)
worker = concept A2 overgrown worker (hard hat, rubble growth over the shoulder, olive work jacket)
hoodie / suit = the A1 body with the clothing swapped
fire   = the A1 body in a scorched turnout coat with glowing ember seams
`shirt` is the upper garment token, `boots` also colours belt, soles, mouth and hair.
"""
from mathutils import Matrix, Vector

TARGETS = (5600, 2400, 760)
I = Matrix.Identity(4)

VARIANTS = {
    'base': dict(skin='apronSage', shirt='sidewalk', tooth='shirt', pants='pantsDark', boots='shoe', extras='growth', targets=TARGETS),
    'worker': dict(skin='oliveLight', shirt='apronOlive', pants='shoe', boots='shoe', extras='worker', bald=True, targets=TARGETS),
    'hoodie': dict(skin='argyleGrey', shirt='tealDark', pants='pantsDark', boots='shoe', tooth='bone', extras='hoodie', bald=True, targets=TARGETS),
    'fire': dict(skin='leather', shirt='orange', pants='pantsDark', boots='shoe', tooth='bone', extras='fire', bald=True, targets=TARGETS),
    'suit': dict(skin='poloDark', shirt='pants', pants='pants', boots='shoe', tooth='bone', extras='suit', bald=True, targets=TARGETS),
}


def extras(kit, V, J, T, HF, lerp):
    """Look-specific primitives; `T` is the leaning spine frame, `HF` the head frame, `J` the joint world positions."""
    k = kit
    which = V['extras']
    sh = J['armL']
    if which == 'growth':
        # A1: a rose-red growth riding the left (+Y) shoulder
        k.xf = I
        k.blob('growth_a', 'armL', 'blood', sh + Vector((-.02, .02, .20)), (.25, .22, .19), sub=2, jitter=.12)
        k.blob('growth_b', 'armL', 'blood', sh + Vector((.08, .16, .13)), (.15, .14, .13), sub=1, jitter=.12, lodmax=1)
        k.blob('growth_c', 'armL', 'blood', sh + Vector((-.14, -.02, .26)), (.12, .11, .10), sub=1, jitter=.12, lodmax=1)
    elif which == 'worker':
        k.xf = HF
        k.blob('hat_dome', 'head', 'schoolBusYellow', (-.02, 0, .565), (.29, .27, .15), sub=2, jitter=.03)
        k.blob('hat_brim', 'head', 'schoolBusYellow', (.09, 0, .485), (.36, .31, .04), sub=2, jitter=.02)
        k.block('hat_ridge', 'head', 'schoolBusYellow', (-.02, 0, .69), (.30, .07, .05), lodmax=1)
        k.xf = I
        k.blob('rubble_base', 'armL', 'blood', sh + Vector((-.02, .02, .17)), (.30, .27, .19), sub=2, jitter=.10)
        for i, (d, r) in enumerate([((-.04, .03, .30), (.19, .17, .14)), ((.10, .20, .17), (.14, .13, .12)), ((-.18, -.02, .20), (.15, .13, .12)),
                                    ((.07, -.08, .27), (.11, .10, .09)), ((-.10, .20, .26), (.11, .10, .09))]):
            k.blob('rubble%d' % i, 'armL', 'silver', sh + Vector(d), tuple(1.3 * x for x in r), rot=(i * .7, i * .4, i), sub=1, jitter=.18, lodmax=2 if i < 3 else 1)
        k.cone('rebar0', 'armL', 'shoe', sh + Vector((-.08, .0, .40)), (-.4, .1, 1), .02, .28, N=4, tip=.6, lodmax=1)
        k.cone('rebar1', 'armL', 'shoe', sh + Vector((.0, .1, .38)), (.5, .3, 1), .02, .22, N=4, tip=.6, lodmax=1)
        k.xf = T
        k.blob('back_rubble', 'torso', 'silver', (-.30, -.12, .72), (.16, .15, .13), sub=1, jitter=.18, lodmax=1)
    elif which == 'hoodie':
        k.xf = HF
        k.blob('hood', 'head', 'tealDark', (-.07, 0, .45), (.29, .28, .27), sub=2, jitter=.04)
        k.blob('hood_rim', 'head', 'tealDark', (.12, 0, .62), (.17, .27, .08), sub=1, jitter=.04, lodmax=1)
        k.xf = T
        for i, (y, z, l) in enumerate([(-.12, .66, .18), (.06, .74, .22), (.18, .60, .15)]):
            k.cone('spike%d' % i, 'torso', 'bone', (-.30, y, z), (-.7, y * .4, .5), .07, l, N=5, tip=.05, lodmax=2 if i < 2 else 1)
        k.block('pocket', 'torso', 'tealDark', (.31, 0, .24), (.05, .30, .13), lodmax=1)
    elif which == 'fire':
        k.xf = HF
        k.blob('helmet', 'head', 'orange', (-.02, 0, .565), (.29, .27, .15), sub=2, jitter=.03)
        k.block('helmet_brim', 'head', 'orange', (-.22, 0, .46), (.22, .34, .04), taper=(1.2, 1.1), lodmax=1)
        k.block('helmet_crest', 'head', 'orange', (-.02, 0, .69), (.30, .06, .05), lodmax=1)
        k.xf = T
        # glowing ember seams: thin emissive slashes across the chest and the back
        for i, (y, z, a) in enumerate([(-.18, .60, .5), (.0, .52, -.5), (.18, .60, .5)]):
            k.blob('seam%d' % i, 'torso', 'eye', (.30, y, z), (.025, .035, .16), rot=(a, 0, 0), sub=1, jitter=0, lodmax=1)
        k.blob('seam_back', 'torso', 'eye', (-.38, 0, .70), (.03, .04, .22), sub=1, jitter=0, lodmax=1)
        k.xf = I
        for s, S in ((1, 'L'), (-1, 'R')):
            el = J['foreArm' + S]
            k.blob('seam_arm' + S, 'foreArm' + S, 'eye', el + Vector((.07, s * .05, .13)), (.03, .03, .09), sub=1, jitter=0, lodmax=1)
    elif which == 'suit':
        k.xf = T
        k.block('shirt_front', 'torso', 'bone', (.325, 0, .56), (.05, .22, .42), taper=(1, .6))
        k.block('tie', 'torso', 'blood', (.36, 0, .52), (.03, .06, .34), taper=(1, .5))
        for s in (1, -1):
            k.flap('tail%d' % s, 'torso', 'pants', [(-.22, s * .06, .30), (-.24, s * .30, .28), (-.27, s * .30, -.12), (-.25, s * .12, -.2)], .05, (1, 0, 0), lodmax=1)
        k.xf = I
        for s, S in ((1, 'L'), (-1, 'R')):
            k.blob('pad' + S, 'arm' + S, 'pants', J['arm' + S] + Vector((-.02, s * .04, .17)), (.24, .22, .10), sub=2, jitter=.04, lodmax=1)
        k.xf = HF
        k.blob('skull_growth', 'head', 'poloDark', (.0, .07, .62), (.12, .10, .07), sub=1, jitter=.14, lodmax=1)
    k.xf = I
