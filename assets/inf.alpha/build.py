"""Alpha rebuilt from the approved concept drafts (A1 hunched brute, A2 overgrown worker; docs/reports/alpha-concepts).
Headless: python3 tools/blender/run.py assets/inf.alpha/build.py --glb assets/inf.alpha/model.glb [--variant worker]
Clean low-poly closed solids (no voxel union): tools/blender/lowpoly.py. The rig (joint names, hierarchy, world positions,
identity rest rotations) is frozen from the shipped asset in tools/blender/rigs/alpha.json, so every animation clip, health
bar anchor and stump cap keeps working. The Alpha used to derive from 'inf.common-worker/build.py' (the worker's rig); the
joint layout is still that rig, now stored explicitly.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

P = Path(__file__).resolve().parent
ROOT = P.parents[1]
sys.path.insert(0, str(ROOT / 'tools/blender'))
sys.path.insert(0, str(P))
import lowpoly
from lowpoly import Kit, aim, frame
parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--variant', default='base')
parser.add_argument('--preview')
parser.add_argument('--views', default='front,side,back,game')
parser.add_argument('--lod', type=int, default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
from variants import VARIANTS, extras
V = VARIANTS[args.variant]
PALETTE = json.loads((ROOT / 'src/assets/palette.json').read_text())
RIG = json.loads((ROOT / 'tools/blender/rigs/alpha.json').read_text())
J = {k: Vector(v['world']) for k, v in RIG['nodes'].items()}   # joint world positions
bpy.ops.wm.read_factory_settings(use_empty=True)
kit = Kit(PALETTE)
H = J['hip']
LEAN = .328                      # the torso lurch baked into the rig (spine from hip to head joint)
HEAD_PITCH = .18
HF = frame(J['head'] + Vector((0, 0, -.035)), HEAD_PITCH)   # head frame (skull sits slightly lower: height class 1.40x worker)
T = frame(H, LEAN)               # spine-local frame: origin at the hip joint, z along the spine, x forward


def lerp(a, b, t):
    return Vector(a).lerp(Vector(b), t)


def build():
    skin, shirt, pants, boots, hair = V['skin'], V['shirt'], V['pants'], V['boots'], V['boots']
    dark, tooth = boots, V.get('tooth', shirt)
    k = kit
    # ---- pelvis (owner hip) -----------------------------------------------------------------------------------------
    k.xf = Matrix.Identity(4)
    k.blob('pelvis', 'hip', pants, (.03, 0, .96), (.25, .35, .22), sub=3, jitter=.05)
    k.blob('seat', 'hip', pants, (-.16, 0, .93), (.20, .31, .20), sub=2, jitter=.05)
    k.block('belt', 'hip', dark, (.04, 0, 1.06), (.52, .66, .07), taper=(.97, .97), lodmax=1)
    k.block('buckle', 'hip', tooth, (.30, 0, 1.06), (.04, .12, .06), lodmax=0)
    # ---- torso (owner torso), authored in the leaning spine frame ---------------------------------------------------
    k.xf = T
    ab = [((.03, 0, .12), (.27, .22)), ((.03, 0, .30), (.30, .25)), ((.02, 0, .46), (.35, .27))]
    k.loft('abdomen', 'torso', shirt, ab, N=10, jitter=.04)
    chest = [((.02, 0, .40), (.37, .28)), ((.0, 0, .56), (.47, .32)), ((-.04, 0, .74), (.47, .29)), ((-.07, 0, .88), (.32, .22))]
    k.loft('chest', 'torso', shirt, chest, N=8, jitter=.04)
    k.blob('hump', 'torso', shirt, (-.19, 0, .70), (.37, .43, .27), sub=3, jitter=.06)
    k.blob('trapezius', 'torso', skin, (-.04, 0, .90), (.26, .26, .17), sub=2, jitter=.05)
    # torn open shirt: a wedge of skin chest with the wound, flanked by collar flaps
    k.blob('chest_skin', 'torso', skin, (.29, 0, .60), (.10, .20, .26), sub=2, jitter=.05)
    k.blob('chest_wound', 'torso', 'blood', (.33, -.02, .56), (.06, .11, .14), sub=1, jitter=.05)
    k.blob('chest_glow', 'torso', 'eye', (.375, -.02, .56), (.022, .045, .10), sub=1, jitter=0, keep=True)
    for s in (1, -1):
        k.flap('collar%d' % s, 'torso', shirt, [(.31, s * .07, .90), (.35, s * .30, .80), (.34, s * .22, .50), (.34, s * .12, .62)],
               .045, (.5, 0, .1), lodmax=1)
        for i in range(3):
            y = s * (.08 + .11 * i)
            k.flap('hem%d_%d' % (s, i), 'torso', shirt, [(.25, y, .20), (.27, y + s * .13, .20), (.27, y + s * .10, .0 - .035 * i), (.26, y + s * .03, .06)],
                   .05, (1, 0, .12), lodmax=1)
    # skin patches bursting through the shirt at the belly and back
    k.blob('belly_skin', 'torso', skin, (.26, .10, .22), (.10, .13, .12), sub=1, jitter=.06, lodmax=1)
    # ---- head (owner head) ------------------------------------------------------------------------------------------
    k.xf = HF
    k.loft('neck', 'head', skin, [((-.03, 0, -.10), (.19, .17)), ((.0, 0, .12), (.18, .16)), ((.03, 0, .24), (.17, .15))], N=8)
    k.blob('skull', 'head', skin, (.03, 0, .42), (.25, .235, .25), sub=3, jitter=.05)
    k.block('jaw', 'head', skin, (.11, 0, .17), (.21, .27, .17), taper=(1.25, 1.35), lodmax=2)
    k.block('brow', 'head', skin, (.14, 0, .505), (.11, .43, .075))
    k.blob('nose', 'head', skin, (.255, 0, .35), (.06, .05, .075), sub=1, jitter=.05, lodmax=1)
    for s in (1, -1):
        k.blob('cheek%d' % s, 'head', skin, (.17, s * .125, .30), (.085, .08, .075), sub=1, jitter=.06, lodmax=1)
        k.blob('socket%d' % s, 'head', dark, (.215, s * .09, .435), (.05, .075, .06), sub=1, jitter=.04, lodmax=1)
        k.blob('eye%d' % s, 'head', 'eye', (.245, s * .09, .435), (.035, .065, .048), sub=1, jitter=0, keep=True)
        k.blob('ear%d' % s, 'head', skin, (-.02, s * .205, .40), (.05, .03, .075), sub=1, jitter=.05, lodmax=0)
        k.blob('bruise%d' % s, 'head', 'blood', (.20, s * .13, .27), (.03, .04, .035), sub=1, jitter=.1, lodmax=0)
    k.block('mouth', 'head', dark, (.225, 0, .235), (.06, .21, .085), lodmax=1)
    k.block('lip', 'head', 'blood', (.215, 0, .165), (.07, .19, .04), lodmax=0)
    for i in range(5):
        y = (i - 2) * .036
        k.block('tooth_u%d' % i, 'head', tooth, (.245, y, .268), (.022, .026, .035 + (.012 if i % 2 == 0 else 0)), taper=(.8, .8), lodmax=0)
    for i in range(4):
        k.block('tooth_l%d' % i, 'head', tooth, (.24, (i - 1.5) * .04, .205), (.02, .028, .028), taper=(.8, .8), lodmax=0)
    if not V.get('bald'):
      k.blob('hair', 'head', hair, (-.09, 0, .56), (.245, .235, .125), sub=2, jitter=.07)
    for i, (x, y, z, d) in enumerate([] if V.get('bald') else [(.10, .10, .64, (.5, .3, .8)), (.0, -.12, .66, (-.2, -.6, .8)), (-.14, .02, .62, (-.8, .1, .5))]):
        k.cone('tuft%d' % i, 'head', hair, (x, y, z - .06), d, .05, .09, N=5, lodmax=0)
    # ---- arms and legs ----------------------------------------------------------------------------------------------
    k.xf = Matrix.Identity(4)
    for s, S in ((1, 'L'), (-1, 'R')):
        sh, el, wr = J['arm' + S], J['foreArm' + S], J['hand' + S]
        # upper arm: deltoid ball, bicep loft, elbow ball
        k.blob('deltoid' + S, 'arm' + S, skin, sh + Vector((-.02, s * .03, .05)), (.25, .24, .23), sub=3, jitter=.05)
        mid = lerp(sh, el, .5)
        k.loft('upper' + S, 'arm' + S, skin, [(sh + Vector((.02, s * .03, 0)), (.20, .19)), (mid, (.185, .17)), (el, (.14, .135))], N=8)
        k.loft('sleeve' + S, 'arm' + S, shirt, [(sh + Vector((.01, s * .02, .03)), (.225, .215)), (lerp(sh, el, .38), (.215, .20)), (lerp(sh, el, .62), (.20, .185))], N=8, jitter=.04)
        k.blob('elbow' + S, 'foreArm' + S, skin, el, (.145, .145, .145), sub=1, jitter=.05, lodmax=1)
        k.loft('fore' + S, 'foreArm' + S, skin, [(el, (.14, .135)), (lerp(el, wr, .5), (.13, .12)), (wr, (.105, .10))], N=8)
        # claw hand hanging from the wrist
        pc = wr + Vector((.05, s * .04, -.10))
        k.blob('palm' + S, 'hand' + S, skin, pc, (.125, .105, .15), sub=3, jitter=.06)
        k.blob('wrist' + S, 'hand' + S, skin, wr, (.115, .11, .105), sub=1, jitter=.05, lodmax=1)
        for i in range(4):
            y = wr.y + s * (-.035 + .05 * i)
            b = Vector((wr.x + .10, y, wr.z - .20))
            len_ = (.07, .09, .075, .06)[i]
            k.loft('finger%s%d' % (S, i), 'hand' + S, skin, [(b, (.048, .042)), (b + Vector((.06, 0, -.07 - len_ * .3)), (.042, .037)), (b + Vector((.17, 0, -.12 - len_)), (.03, .026))], N=5, jitter=.04, ref=Vector((0, 1, 0)), lodmax=2)
            k.cone('claw%s%d' % (S, i), 'hand' + S, tooth, b + Vector((.17, 0, -.12 - len_)), (.6, 0, -.8), .02, .06, N=4, tip=.1, lodmax=0)
        k.loft('thumb' + S, 'hand' + S, skin, [(wr + Vector((.13, s * -.05, -.05)), (.045, .04)), (wr + Vector((.2, s * -.03, -.12)), (.035, .032)), (wr + Vector((.24, s * -.01, -.19)), (.022, .02))], N=5, lodmax=1)
        # legs
        hp, kn, an = J['leg' + S], J['shin' + S], J['foot' + S]
        k.loft('thigh' + S, 'leg' + S, pants, [(hp + Vector((0, 0, .03)), (.24, .23)), (lerp(hp, kn, .5), (.22, .21)), (kn, (.175, .17))], N=8, jitter=.04)
        k.blob('knee' + S, 'shin' + S, pants, kn, (.16, .15, .15), sub=1, jitter=.05, lodmax=1)
        k.loft('calf' + S, 'shin' + S, pants, [(kn, (.175, .17)), (lerp(kn, an, .5), (.15, .145)), (an + Vector((0, 0, .02)), (.135, .13))], N=8, jitter=.04)
        k.blob('knee_wound' + S, 'shin' + S, 'blood', kn + Vector((.13, 0, .02)), (.05, .08, .06), sub=1, jitter=.08, lodmax=0)
        # boots
        k.block('sole' + S, 'foot' + S, dark, (an.x + .11, an.y, .05), (.62, .31, .10), taper=(.93, .95), jitter=.0)
        k.block('boot' + S, 'foot' + S, boots, (an.x + .09, an.y, .19), (.55, .29, .20), taper=(.62, .86), shear=(-.07, 0))
        k.blob('toecap' + S, 'foot' + S, boots, (an.x + .33, an.y, .13), (.17, .15, .10), sub=2, jitter=.05)
        k.loft('collar' + S, 'foot' + S, boots, [(an + Vector((0, 0, -.04)), (.145, .14)), (an + Vector((0, 0, .08)), (.14, .135))], N=8, lodmax=1)
    extras(kit, V, J, T, HF, lerp)
    k.xf = Matrix.Identity(4)


build()
CAPS = [
    ('head', 'torso', J['head'] + Vector((0, 0, .05)), (.3, 0, 1), .2, .2, .05),
    ('armL', 'torso', J['armL'] + Vector((0, .05, 0)), (0, 1, 0), .16, .16, .05),
    ('armR', 'torso', J['armR'] + Vector((0, -.05, 0)), (0, 1, 0), .16, .16, .05),
    ('foreArmL', 'armL', J['foreArmL'], J['foreArmL'] - J['armL'], .12, .12, .05),
    ('foreArmR', 'armR', J['foreArmR'], J['foreArmR'] - J['armR'], .12, .12, .05),
    ('legL', 'hip', J['legL'] + Vector((0, .0, -.0)), (0, 0, 1), .17, .17, .05),
    ('legR', 'hip', J['legR'] + Vector((0, .0, -.0)), (0, 0, 1), .17, .17, .05),
]
if args.glb:
    stats, nodes = lowpoly.export_lods(kit, RIG, CAPS, V['targets'], args.glb)
    out = Path(args.glb).resolve().parent
    (out / 'build-stats.json').write_text(json.dumps({'variant': args.variant, 'lods': stats}, indent=1) + '\n')
    print('STATS', [(s['triangles'], s['bodyTriangles'], s['fileKB'], s['dimensions'], s['allClosed']) for s in stats])
elif args.preview:
    import preview
    nodes = lowpoly.make_rig(RIG)
    joined, tris = lowpoly.realise(kit, args.lod, V['targets'][args.lod], None)
    for o in joined.values():
        lowpoly.attach(o, nodes[o.name.split('__')[0]])
    print('TRIS', args.lod, tris)
    preview.render_sheet(args.preview, views=args.views.split(','))
