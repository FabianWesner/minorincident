"""Mega Alpha rebuilt from the approved concept drafts (M1 siege brute, M2 ember furnace, M3 ashen crown).
Headless: python3 tools/blender/run.py assets/inf.mega-alpha/build.py --glb assets/inf.mega-alpha/model.glb [--variant ember|ashen]
Clean low-poly closed solids (no voxel union; tools/blender/lowpoly.py) on the frozen rig tools/blender/rigs/mega-alpha.json:
the same node names, hierarchy and identity rest rotations as inf.alpha, so the Alpha clips retarget unchanged. Like the
Alpha it derives its joint layout from the worker rig ('inf.common-worker/build.py'), now stored explicitly.
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
import lowpoly
from lowpoly import Kit, frame
parser = argparse.ArgumentParser()
parser.add_argument('--glb')
parser.add_argument('--variant', default='base')
parser.add_argument('--preview')
parser.add_argument('--views', default='front,side,back,game')
parser.add_argument('--lod', type=int, default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
PALETTE = json.loads((ROOT / 'src/assets/palette.json').read_text())
RIG = json.loads((ROOT / 'tools/blender/rigs/mega-alpha.json').read_text())
J = {k: Vector(v['world']) for k, v in RIG['nodes'].items()}
bpy.ops.wm.read_factory_settings(use_empty=True)
kit = Kit(PALETTE)
TARGETS = (9000, 2700, 1300)
# M1 siege brute (base), M2 ember furnace (turnout coat over dark skin, ember seams, tusks), M3 ashen crown (pale mantle, horns)
LOOKS = {
    'base': dict(skin='vest', shade='vestTrim', cloth='uiDark', bone='bone', coat=None, mantle=None, horns=False, tusks=False, seams='eye'),
    'ember': dict(skin='leather', shade='uiDark', cloth='uiDark', bone='bone', coat='orange', mantle=None, horns=False, tusks=True, seams='eye'),
    'ashen': dict(skin='purple', shade='uiDark', cloth='uiDark', bone='bone', coat=None, mantle='lavenderLight', horns=True, tusks=False, seams='eye'),
}
L = LOOKS['base' if args.variant == 'base' else args.variant]
H = J['hip']
head_rel = J['head'] - H
LEAN = math.atan2(head_rel.x, head_rel.z)
T = frame(H, LEAN)
HEAD_PITCH = .22
HF = frame(J['head'] + Vector((0, 0, -.02)), HEAD_PITCH)
I = Matrix.Identity(4)


def lerp(a, b, t):
    return Vector(a).lerp(Vector(b), t)


def build():
    k = kit
    skin, shade, cloth, bone, seams = L['skin'], L['shade'], L['cloth'], L['bone'], L['seams']
    # ---- pelvis and torn trousers -----------------------------------------------------------------------------------
    k.xf = I
    k.blob('pelvis', 'hip', cloth, (.03, 0, 1.06), (.30, .42, .26), sub=3, jitter=.06)
    k.blob('seat', 'hip', cloth, (-.18, 0, 1.03), (.24, .38, .24), sub=2, jitter=.06)
    k.block('belt', 'hip', shade, (.05, 0, 1.18), (.62, .78, .08), taper=(.97, .97), lodmax=1)
    k.block('buckle', 'hip', bone, (.36, 0, 1.18), (.05, .16, .08), lodmax=0)
    # ---- torso in the leaning spine frame ---------------------------------------------------------------------------
    k.xf = T
    k.loft('abdomen', 'torso', skin, [((.04, 0, .12), (.32, .26)), ((.04, 0, .30), (.38, .30)), ((.03, 0, .46), (.46, .32))], N=10, jitter=.05)
    k.loft('chest', 'torso', skin, [((.02, 0, .40), (.48, .34)), ((-.02, 0, .58), (.64, .38)), ((-.08, 0, .76), (.64, .36)), ((-.12, 0, .92), (.42, .26))], N=10, jitter=.05)
    k.blob('hump', 'torso', shade, (-.25, 0, .70), (.46, .58, .36), sub=3, jitter=.07)
    k.blob('neckmass', 'torso', skin, (-.02, 0, .98), (.30, .34, .20), sub=2, jitter=.06)
    # torn black straps across the chest and a ragged waist band
    k.loft('strapL', 'torso', cloth, [((.30, .50, .86), (.07, .05)), ((.40, .24, .62), (.07, .05)), ((.40, -.12, .40), (.07, .05)), ((.30, -.40, .16), (.07, .05))], N=6, jitter=.03, lodmax=1)
    k.loft('strapR', 'torso', cloth, [((.30, -.50, .86), (.07, .05)), ((.40, -.24, .62), (.07, .05)), ((.40, .12, .40), (.07, .05)), ((.30, .40, .16), (.07, .05))], N=6, jitter=.03, lodmax=1)
    for s in (1, -1):
        for i in range(3):
            y = s * (.12 + .15 * i)
            k.flap('rag%d_%d' % (s, i), 'torso', cloth, [(.34, y, .20), (.36, y + s * .16, .20), (.36, y + s * .12, -.08 - .04 * i), (.35, y + s * .03, .02)], .06, (1, 0, .1), lodmax=1)
    # glowing ember seams across the chest and the back (red emissive) over blood scars
    for i, (y, z, a) in enumerate([(-.26, .70, .45), (-.06, .60, -.35), (.14, .68, .4), (.30, .52, -.4), (-.20, .42, -.3)]):
        k.blob('scar%d' % i, 'torso', 'blood', (.36, y, z), (.03, .05, .17), rot=(a, 0, 0), sub=1, jitter=0.04, lodmax=1)
        k.blob('seam%d' % i, 'torso', seams, (.385, y, z), (.018, .028, .13), rot=(a, 0, 0), sub=1, jitter=0, lodmax=1)
    for i, (y, z, a) in enumerate([(-.30, .86, .3), (.0, .96, 0), (.30, .84, -.3)]):
        k.blob('back_seam%d' % i, 'torso', seams, (-.66, y, z), (.025, .04, .2), rot=(a, 0, 0), sub=1, jitter=0, lodmax=1)
    # spine ridge: bone spikes riding the hump from the lower back over to the neck
    for i in range(7):
        a = math.radians(200 - i * 20)
        c = Vector((-.25 + .46 * math.cos(a), 0, .70 + .36 * math.sin(a)))
        n = Vector((math.cos(a) / .46, 0, math.sin(a) / .36)).normalized()
        size = .20 + .12 * math.sin(math.pi * i / 6)
        k.cone('ridge%d' % i, 'torso', bone, c - n * .06, n, .085, size, N=5, tip=.06, lodmax=2 if i % 2 == 0 else 1)
    # ---- head: recessed skull face between the shoulders -----------------------------------------------------------
    k.xf = HF
    k.loft('neck', 'head', skin, [((-.06, 0, -.15), (.26, .24)), ((-.03, 0, .10), (.24, .22)), ((.0, 0, .24), (.2, .18))], N=8)
    k.blob('skull', 'head', bone, (.04, 0, .37), (.25, .23, .24), sub=3, jitter=.05)
    k.block('jaw', 'head', bone, (.12, 0, .14), (.21, .27, .15), taper=(1.2, 1.3))
    k.block('brow', 'head', shade, (.15, 0, .49), (.12, .46, .09))
    for s in (1, -1):
        k.blob('socket%d' % s, 'head', cloth, (.20, s * .095, .41), (.055, .08, .065), sub=1, jitter=.04, lodmax=1)
        k.blob('eye%d' % s, 'head', 'eye', (.235, s * .095, .41), (.04, .07, .055), sub=1, jitter=0, keep=True)
        k.blob('cheek%d' % s, 'head', bone, (.16, s * .13, .27), (.08, .07, .07), sub=1, jitter=.06, lodmax=1)
    k.block('mouth', 'head', cloth, (.235, 0, .205), (.06, .22, .09), lodmax=1)
    for i in range(5):
        k.block('tooth%d' % i, 'head', bone, (.262, (i - 2) * .036, .235), (.022, .026, .04), taper=(.8, .8), lodmax=0)
    # ---- arms: siege shoulders, black wristbands, clenched fists ---------------------------------------------------
    k.xf = I
    for s, S in ((1, 'L'), (-1, 'R')):
        sh, el, wr = J['arm' + S], J['foreArm' + S], J['hand' + S]
        k.blob('shoulder' + S, 'arm' + S, skin, sh + Vector((-.04, s * .03, .06)), (.37, .35, .33), sub=3, jitter=.06)
        k.blob('pauldron' + S, 'arm' + S, shade, sh + Vector((-.08, s * .06, .20)), (.34, .30, .18), sub=2, jitter=.10, lodmax=1)
        k.loft('upper' + S, 'arm' + S, skin, [(sh + Vector((.03, s * .04, 0)), (.30, .28)), (lerp(sh, el, .5), (.27, .25)), (el, (.21, .20))], N=8)
        k.blob('elbow' + S, 'foreArm' + S, skin, el, (.21, .21, .21), sub=1, jitter=.05, lodmax=1)
        k.loft('fore' + S, 'foreArm' + S, skin, [(el, (.21, .20)), (lerp(el, wr, .5), (.20, .18)), (wr, (.16, .15))], N=8)
        k.loft('band' + S, 'foreArm' + S, cloth, [(lerp(el, wr, .12), (.235, .22)), (lerp(el, wr, .42), (.225, .21))], N=8, jitter=.04, lodmax=1)
        k.blob('fist' + S, 'hand' + S, skin, wr + Vector((.06, s * .0, -.12)), (.20, .17, .20), sub=3, jitter=.06)
        for i in range(4):
            y = wr.y + s * (-.075 + .05 * i)
            k.blob('knuckle%s%d' % (S, i), 'hand' + S, shade, Vector((wr.x + .21, y, wr.z - .07)), (.07, .055, .06), sub=1, jitter=.08, lodmax=1)
            k.blob('fing%s%d' % (S, i), 'hand' + S, skin, Vector((wr.x + .14, y, wr.z - .27)), (.08, .06, .09), sub=1, jitter=.08, lodmax=2)
        k.blob('thumb' + S, 'hand' + S, skin, wr + Vector((.20, s * -.09, -.10)), (.09, .06, .07), sub=1, jitter=.08, lodmax=1)
        # legs and boots
        hp, kn, an = J['leg' + S], J['shin' + S], J['foot' + S]
        k.loft('thigh' + S, 'leg' + S, cloth, [(hp + Vector((0, 0, .04)), (.30, .29)), (lerp(hp, kn, .5), (.27, .26)), (kn, (.22, .21))], N=8, jitter=.05)
        k.blob('knee' + S, 'shin' + S, cloth, kn, (.22, .21, .21), sub=1, jitter=.06, lodmax=1)
        k.loft('calf' + S, 'shin' + S, cloth, [(kn, (.22, .21)), (lerp(kn, an, .5), (.19, .18)), (an + Vector((0, 0, .02)), (.17, .16))], N=8, jitter=.05)
        k.block('sole' + S, 'foot' + S, shade, (an.x + .13, an.y, .06), (.74, .38, .12), taper=(.94, .95))
        k.block('boot' + S, 'foot' + S, cloth, (an.x + .10, an.y, .22), (.66, .35, .24), taper=(.64, .86), shear=(-.07, 0))
        k.blob('toecap' + S, 'foot' + S, cloth, (an.x + .38, an.y, .15), (.20, .18, .12), sub=2, jitter=.05)
        k.loft('bootcol' + S, 'foot' + S, cloth, [(an + Vector((0, 0, -.05)), (.19, .18)), (an + Vector((0, 0, .10)), (.18, .17))], N=8, lodmax=1)
    # ---- look-specific hardware -------------------------------------------------------------------------------------
    sh_l, sh_r = J['armL'], J['armR']
    if L['coat']:
        # M2: a torn orange turnout coat slung off both shoulders, reflective bands
        for s, S in ((1, 'L'), (-1, 'R')):
            sh = J['arm' + S]
            k.blob('coat_collar' + S, 'arm' + S, L['coat'], sh + Vector((-.10, s * .05, .22)), (.36, .30, .22), sub=2, jitter=.08)
            k.flap('coat_flap' + S, 'arm' + S, L['coat'], [sh + Vector((.10, s * .10, .20)), sh + Vector((.12, s * .48, .12)), sh + Vector((.14, s * .45, -.34)), sh + Vector((.12, s * .12, -.30))], .07, (1, 0, 0), lodmax=1)
            k.flap('coat_band' + S, 'arm' + S, 'bone', [sh + Vector((.12, s * .14, -.06)), sh + Vector((.135, s * .46, -.08)), sh + Vector((.135, s * .46, -.16)), sh + Vector((.12, s * .14, -.14))], .05, (1, 0, 0), lodmax=1)
    if L['mantle']:
        # M3: a pale shard mantle over both shoulders
        for s, S in ((1, 'L'), (-1, 'R')):
            sh = J['arm' + S]
            for i, (d, r) in enumerate([((-.06, s * .10, .42), (.14, .14, .26)), ((.04, s * .30, .34), (.13, .13, .22)), ((-.16, s * .22, .30), (.12, .12, .20)), ((.10, s * .45, .18), (.10, .10, .17))]):
                k.cone('shard%s%d' % (S, i), 'arm' + S, L['mantle'], sh + Vector((d[0], d[1], d[2] - .30)), (d[0] * 1.5, s * .5 + d[1], 1.0), r[0], r[2] + .10, N=5, tip=.05, lodmax=2 if i < 2 else 1)
    k.xf = HF
    if L['horns']:
        for s in (1, -1):
            k.cone('horn%d' % s, 'head', bone, (-.02, s * .20, .52), (-.35, s * 1.0, .45), .075, .46, N=5, tip=.05)
    if L['tusks']:
        for s in (1, -1):
            k.cone('tusk%d' % s, 'head', bone, (.22, s * .12, .17), (.35, s * .15, 1.0), .05, .26, N=5, tip=.06)
            k.blob('crown%d' % s, 'head', L['shade'], (-.12, s * .17, .58), (.12, .08, .08), sub=1, jitter=.1, lodmax=1)
    k.xf = I


build()
CAPS = [
    ('head', 'torso', J['head'] + Vector((0, 0, .05)), (.5, 0, 1), .26, .26, .06),
    ('armL', 'torso', J['armL'] + Vector((0, .06, 0)), (0, 1, 0), .24, .24, .06),
    ('armR', 'torso', J['armR'] + Vector((0, -.06, 0)), (0, 1, 0), .24, .24, .06),
    ('foreArmL', 'armL', J['foreArmL'], J['foreArmL'] - J['armL'], .18, .18, .06),
    ('foreArmR', 'armR', J['foreArmR'], J['foreArmR'] - J['armR'], .18, .18, .06),
    ('legL', 'hip', J['legL'], (0, 0, 1), .26, .26, .06),
    ('legR', 'hip', J['legR'], (0, 0, 1), .26, .26, .06),
]
if args.glb:
    stats, nodes = lowpoly.export_lods(kit, RIG, CAPS, TARGETS, args.glb)
    out = Path(args.glb).resolve().parent
    (out / 'build-stats.json').write_text(json.dumps({'variant': args.variant, 'lods': stats}, indent=1) + '\n')
    print('STATS', [(s['triangles'], s['bodyTriangles'], s['fileKB'], s['dimensions'], s['allClosed']) for s in stats])
elif args.preview:
    import preview
    nodes = lowpoly.make_rig(RIG)
    joined, tris = lowpoly.realise(kit, args.lod, TARGETS[args.lod], None)
    for o in joined.values():
        lowpoly.attach(o, nodes[o.name.split('__')[0]])
    print('TRIS', args.lod, tris)
    preview.render_sheet(args.preview, views=args.views.split(','), target=(.35, 0, 1.2), scale=3.0)
