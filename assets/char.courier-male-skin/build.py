"""Male courier skin (char.courier-male, PO 10-25: "Do the same for the male courier, so both picks match"): the TRELLIS.2
male courier (source.glb: imagegen A-pose redraw of assets/char.courier-male/reference.png -> TRELLIS.2 300k/2K
(/Users/wesner/Workspace/trellis-highs/char.courier-male/run1) -> 3D pipeline v2 solidify 6k -> emission bake 1K ->
surface repair -> Lab colour match) bound to the game's male courier skeleton v2 (armature of rig-source.skin.glb = the
previous palette skin, built by build-palette.py). Same route as the heroine (assets/char.courier-female-skin/build.py).

Rebuild:
  Blender -b --python assets/char.courier-male-skin/build.py -- --glb assets/char.courier-male-skin/model.skin.glb
  npx tsx tools/assets/courier-tex-compress.ts assets/char.courier-male-skin/model.skin.glb public/assets/models/char.courier-male.skin.glb
Options: --debug <png prefix> renders an ownership map; --no-leg-pose keeps the source stance.

What it does (+X forward, Z up, +Y = anatomical left, metres):
1. source frame (Blender import: up Z, facing -Y, left +X) -> courier frame, uniform scale to the male height (1.398 m).
   The body is NOT re-proportioned (the redraw already carries the game's head ratio).
2. skeleton = the male courier's own 36-bone armature (same names, hierarchy, helpers, sockets, bind convention, no pony
   bones); every joint is moved onto the new anatomy. The anatomy landmarks (SOURCE_JOINTS) were read off horizontal
   cross-sections of the source (arm/leg loop centres, wrist bands, neck waist, shoe tops).
3. ownership is semantic, computed on the position-welded surface (UV duplicates share one weight row):
   arms = flood fill from the hands along mesh edges inside the arm capsule (never by proximity across the torso gap);
   legs/cargo pants = below the belt, the belt rides the hip, the pants blend to the thighs, never any arm influence;
   shoes = foot (toe at the ball); backpack body = backpackSocket share, chest straps = chest/clavicle; head/cap/hair = head.
   Inside each limb the courier's own eased chain partition (incl. elbow/knee/twist helpers) is used.
4. the legs are posed in to the courier stance (soles kept flat) and that pose is applied as the rest pose.
5. smooth normals from the welded surface (no seams at UV islands); a COLOR_0 copy of the map (semantic hints for the
   tier-gear fit; the game shades the body from the map only).
"""
import bpy, sys, math, json, hashlib
from pathlib import Path
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / 'tools' / 'assets'))
from courier_skin_common import (ARGS, arg, smooth, base_texture, Surface, skin_weights, arm_share, write_vertex_groups,
                                 bind_skeleton, narrow_stance, smooth_normals, debug_renders, pose_test_renders, export_skin)
SOURCE = Path(arg('--source', str(HERE / 'source.glb')))
RIG = HERE / 'rig-source.skin.glb'
HEIGHT = 1.398  # the male courier's manifest height
# Anatomy landmarks of the source, in the source's courier-oriented frame scaled to HEIGHT (floor z = 0, x/y not yet
# centred). Read off horizontal cross-sections of source.glb (arm/leg loop centres, wrist bands, neck waist, shoe tops):
# legs part below z 0.48 (crotch), the belt sits at 0.55-0.60, the arms hang free from 0.47 to 0.74 (hands 0.47-0.57,
# wrist bands at 0.59), the neck is narrowest at 0.995, the shoe tops (sneaker collar) at 0.14.
SOURCE_JOINTS = {
    'hip': (-.020, .002, .575),
    'legL': (-.018, .097, .545), 'shinL': (-.022, .112, .335), 'footL': (-.032, .141, .128),
    # shoulders in line with the spine (x = hip x): the animator's keepTorsoForward reads the shoulder line, and shoulders
    # 2 cm behind the spine tipped his idle head 5 deg forward (run lean 15 deg vs the 8-12 deg gate)
    'clavicleL': (-.020, .045, .905), 'armL': (-.020, .172, .866), 'foreArmL': (-.053, .247, .722), 'handL': (-.014, .314, .592),
    'PalmL': (-.008, .346, .515),
    'head': (-.012, .002, 1.0),
}
for k in list(SOURCE_JOINTS):
    if k.endswith('L'):
        x, y, z = SOURCE_JOINTS[k]; SOURCE_JOINTS[k[:-1] + 'R'] = (x, -y + 2 * SOURCE_JOINTS['hip'][1], z)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
# ---- 1. courier armature (kept), source mesh ----------------------------------------------
bpy.ops.import_scene.gltf(filepath=str(RIG))
rig = bpy.data.objects['courierRig']
for o in list(bpy.data.objects):
    if o is not rig: bpy.data.objects.remove(o, do_unlink=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
imported = [o for o in bpy.data.objects if o not in before]
body = next(o for o in imported if o.type == 'MESH' and len(o.data.vertices) > 1000)
body.data.transform(body.matrix_world)
body.parent = None; body.matrix_world = Matrix.Identity(4)
body.modifiers.clear(); body.vertex_groups.clear()
for o in imported:
    if o is not body: bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)

M3 = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1)))  # facing -Y, left +X  ->  forward +X, left +Y
P0 = np.array([M3 @ v.co for v in body.data.vertices])
zmin, zmax = P0[:, 2].min(), P0[:, 2].max(); S = HEIGHT / (zmax - zmin)
P0 = (P0 - np.array([0, 0, zmin])) * S
OFF = np.array([SOURCE_JOINTS['hip'][0], SOURCE_JOINTS['hip'][1], 0])
P = P0 - OFF
for v, p in zip(body.data.vertices, P): v.co = Vector(p)
RJ = {k: np.array(v) - OFF for k, v in SOURCE_JOINTS.items()}

# ---- welded surface (UV duplicates share a row) -----------------------------------------------
surf = Surface(body, P)
weld, inverse, NW, WP, nbr, comps, lap, chain = surf.weld, surf.inverse, surf.NW, surf.WP, surf.nbr, surf.comps, surf.lap, surf.chain

# vertex colour of the base texture (semantic hints only, combined with regions)
img, tex = base_texture(body)
# The global Lab match turned his teal-green bag, straps and cap back blue-grey (hue ≈ 200°, sat ≈ .17); the approved
# reference is a deep teal-green (hue ≈ 172°). Re-tint only that family in the map: hue -> 172°, saturation x 1.9 (≤ .6).
import colorsys
_px = np.array(img.pixels[:]).reshape(-1, 4)
_mx, _mn = _px[:, :3].max(1), _px[:, :3].min(1); _sat = (_mx - _mn) / np.maximum(_mx, 1e-6)
_h = np.array([colorsys.rgb_to_hsv(*c)[0] for c in _px[:, :3]]) * 360
_fam = (_h > 160) & (_h < 235) & (_sat > .05) & (_mx < .75)
for _i in np.where(_fam)[0]:
    _px[_i, :3] = colorsys.hsv_to_rgb(172 / 360, min(.6, _sat[_i] * 1.9), _mx[_i])
img.pixels[:] = _px.ravel(); img.pack()
print('TEAL retint', int(_fam.sum()), 'of', len(_px))
tex = _px.reshape(img.size[1], img.size[0], 4)[..., :3]
WC, cnt, HSV, hue = surf.colours(body, P, tex)
# cargo pants (khaki), backpack/straps (desaturated teal), belt (dark)
khaki = (hue > 24) & (hue < 40) & (HSV[:, 1] > .45) & (HSV[:, 2] < .85) & (cnt > 0)
teal = (hue > 150) & (hue <= 240) & (HSV[:, 1] > .08) & (HSV[:, 2] < .7) & (cnt > 0)

# ---- 2. joints on the male anatomy ------------------------------------------------------------
def V(a): return np.array(a, float)
J = {}
for s, sgn in (('L', 1), ('R', -1)):
    J['leg' + s] = RJ['leg' + s]; J['shin' + s] = RJ['shin' + s]; J['foot' + s] = RJ['foot' + s]
    J['clavicle' + s] = RJ['clavicle' + s]; J['arm' + s] = RJ['arm' + s]; J['foreArm' + s] = RJ['foreArm' + s]; J['hand' + s] = RJ['hand' + s]
legz = (J['legL'][2] + J['legR'][2]) / 2
J['root'] = V((0, 0, 0)); J['hip'] = V((0, 0, RJ['hip'][2]))
shoulder = (J['armL'][2] + J['armR'][2]) / 2
# Courier spine spacing between hip and neck: torso 17 %, spine 45 %, chest 73 %; the neck joint sits at the base of his
# neck, 8 cm over the shoulder joints (his shoulders slope; the neck is narrowest at 0.995).
neck_z = shoulder + .08
for name, f in (('torso', .17), ('spine', .45), ('chest', .73)):
    J[name] = V((0, 0, J['hip'][2] + f * (neck_z - J['hip'][2])))
J['neck'] = V((0, 0, neck_z))
J['head'] = V((RJ['head'][0], 0, RJ['head'][2]))  # pivot at the skull base, over the narrowest neck section
for s in 'LR':
    J['elbow' + s] = J['foreArm' + s].copy(); J['knee' + s] = J['shin' + s].copy()
    J['foreArmTwist' + s] = J['foreArm' + s] + .55 * (J['hand' + s] - J['foreArm' + s])
# toes at the ball of each shoe
for s, sgn in (('L', 1), ('R', -1)):
    shoe = WP[(WP[:, 2] < .09) & (WP[:, 1] * sgn > .04)]
    x0, x1 = shoe[:, 0].min(), shoe[:, 0].max()
    J['toe' + s] = V((x0 + .66 * (x1 - x0), J['foot' + s][1], shoe[:, 2].min() + .03))
# bag: teal surface behind the back (the small front pouch and the chest straps are not bag)
back = WP[:, 0] < -.09
bag = teal & back & (WP[:, 2] > .55) & (WP[:, 2] < 1.0) & (np.abs(WP[:, 1]) < .2)
bagP = WP[bag]
print('BAG', bag.sum(), bagP.min(0).round(3) if bag.any() else None, bagP.max(0).round(3) if bag.any() else None)
torso_back = WP[(np.abs(WP[:, 1]) < .08) & (WP[:, 2] > J['chest'][2] - .03) & (WP[:, 2] < J['chest'][2] + .03) & ~bag]
J['backpackSocket'] = V((torso_back[:, 0].min() - .01 if len(torso_back) else -.11, 0, J['chest'][2]))
# Sockets keep the courier's hand-relative offsets; eyes/iris keep their offsets from the head (scaled to his skull height).
RIGJ = {b.name: np.array(rig.matrix_world @ b.head_local) for b in rig.data.bones}
for s in 'LR':
    J['weaponSocket' + s] = J['hand' + s] + (RIGJ['weaponSocket' + s] - RIGJ['hand' + s])
headTop = WP[:, 2].max()
for n in ('eyeL', 'irisL', 'eyeR', 'irisR'):
    J[n] = J['head'] + (RIGJ[n] - RIGJ['head']) * np.array([1, 1, (headTop - J['head'][2]) / (HEIGHT - RIGJ['head'][2])])
PONY = None  # his hair is short: no pony bones in the male rig
assert set(J) == set(RIGJ), set(RIGJ) ^ set(J)
for n in sorted(J): print('JOINT', n, J[n].round(3), 'courier', RIGJ[n].round(3))

# ---- 3. semantic ownership on the welded surface ----------------------------------------------
member = {}
waist = None
# arms: flood from the hand through the arm capsule
for s, sgn in (('L', 1), ('R', -1)):
    tip = J['hand' + s] + 1.6 * (RJ['Palm' + s] - J['hand' + s])
    pts = [J['arm' + s], J['foreArm' + s], J['hand' + s], tip]
    t, d = chain(pts)
    l1 = np.linalg.norm(pts[1] - pts[0])
    # his arms are ≈ 5 cm radius (short sleeves ≈ 7 cm at the shoulder)
    radius = np.where(t < l1, .075, .072)  # the wrist bands are chunky (≈ 6.5 cm)
    # his upper arms hang 2-3 cm off the torso flank (flank |y| <= .18 below z .78): the flood never enters the flank
    flank = np.where(WP[:, 2] < .78, .18, np.where(WP[:, 2] < .84, .15, .12))
    allowed = (d < radius) & (t > -.03) & (WP[:, 1] * sgn > flank)
    seeds = np.where(allowed & (t > l1 + .05))[0]
    inside = surf.flood(seeds, allowed)
    # the shoulder end fades into the clavicle/chest over the first 4 cm of the upper arm
    m = inside * smooth((t + .03) / .05)
    member['arm' + s] = m
    print('ARM', s, 'seeds', len(seeds), 'members', int(inside.sum()))
arms = member['armL'] + member['armR']
# straps ride the chest/clavicle, not the arm
member['armL'] *= 1 - .8 * teal; member['armR'] *= 1 - .8 * teal
# legs: below the waistband; waistband -> hip, lower pants -> thighs; never on the arm/hand surface
pants = khaki & (WP[:, 2] > .18) & (WP[:, 2] < .64) & (np.abs(WP[:, 1]) < .22) & (arms < .5)
waist = np.percentile(WP[pants, 2], 98) if pants.any() else legz + .08
crotch = np.percentile(WP[pants & (np.abs(WP[:, 1]) < .02), 2], 10) if (pants & (np.abs(WP[:, 1]) < .02)).any() else legz - .06
print('PANTS z pct', np.percentile(WP[pants, 2], [5, 25, 50, 75, 90, 95, 98]).round(3), 'front', np.percentile(WP[pants & (WP[:, 0] > 0) & (np.abs(WP[:, 1]) < .05), 2], [90, 98]).round(3))
print('PANTS', int(pants.sum()), 'waist', round(float(waist), 3), 'crotch', round(float(crotch), 3), 'khaki', int(khaki.sum()), 'teal', int(teal.sum()))
# the upper 40 % of the pants (waistband, belly front) rides the hip only; the thighs take over towards the crotch
leg_top = crotch + .6 * (waist - crotch)
leg_all = smooth((leg_top - WP[:, 2]) / (leg_top - crotch)) * (1 - np.clip(arms, 0, 1))
# hands and fingers hang beside the thighs (|y| > 0.2): whatever the arm flood missed there is hand, never leg
hands = {}
for s, sgn in (('L', 1), ('R', -1)):
    tip = J['hand' + s] + 1.6 * (RJ['Palm' + s] - J['hand' + s])
    _, dh = chain([J['foreArm' + s], J['hand' + s], tip])
    _, dl = chain([J['leg' + s], J['shin' + s], J['foot' + s]])
    # below his wrist band nothing but the hand reaches past |y| .22 (the pants stop at .18)
    hand = (WP[:, 1] * sgn > .22) & (WP[:, 2] < J['hand' + s][2] - .015) & (WP[:, 2] > .3) & (dh < .12)
    leg_all[hand] = 0; member['arm' + s] = np.maximum(member['arm' + s], hand.astype(float)); hands[s] = hand
    print('HAND fix', s, int(hand.sum()))
side = smooth(WP[:, 1] / .07 + .5)  # a wider crotch blend: the bat lunge spreads his legs (8.6x at .04)
member['legL'] = leg_all * side; member['legR'] = leg_all * (1 - side)
# the bag is fused to the back: it bends with the back it rests on (spine hats below) and only its outer body takes a
# share of the socket's pendulum, fading to zero at the contact face (no seam between bag and shirt)
depth = bagP[:, 0].max() - WP[:, 0] if bag.any() else np.zeros(NW)
bag_socket = .35 * smooth((depth - .02) / .08) * bag
member['bag'] = bag_socket
# continuity: relax membership along the welded surface (not across gaps), re-pinning hard cores
names = ['armL', 'armR', 'legL', 'legR', 'bag']
F = np.stack([member[n] for n in names], 1)
core = (F.max(1) > .999) & (np.array([len(n) for n in nbr]) > 0)
F = lap(F, 6, .5)
# the hands stay whole hand after the relax (a partial share left the spine/hip rest on his fingers: 5x stretch in swings)
for i, s in enumerate('LR'): F[hands[s]] = np.eye(5)[i]
F[pants] *= np.array([0, 0, 1, 1, 0])  # pants never take any arm or bag share
# smoothing must not carry the thighs onto the belly: no leg share above the waistband (the run tore the shirt front)
F[:, 2:4] *= smooth((leg_top + .02 - WP[:, 2]) / .03)[:, None]
F = np.clip(F, 0, 1); tot = F.sum(1); F[tot > 1] /= tot[tot > 1, None]
member = {n: F[:, i] for i, n in enumerate(names)}

above = smooth((WP[:, 2] - (J['head'][2] - .005)) / .035)  # his jaw and sideburns start right at the skull-base pivot
# his curly hair hangs over the nape down to the collar: brown hair above the neck joint is head, never chest
# (it tore 11x between head and chest in the bat swings)
hair = (hue > 5) & (hue < 30) & (HSV[:, 1] > .4) & (HSV[:, 2] < .65) & (cnt > 0) & (WP[:, 2] > J['neck'][2] + .02) & (WP[:, 0] < J['head'][0])
above = np.maximum(above, lap(hair[:, None].astype(float), 2)[:, 0])
print('HAIR nape', int(hair.sum()))
bones, idx, top = skin_weights(surf, J, member, above, PONY)
arm_sh = arm_share(bones, idx, top)
print('PANTS max arm/clavicle share', round(float(arm_sh[pants].max()), 4) if pants.any() else None)
stats = {'pantsVertices': int(pants.sum()), 'pantsMaxArmShare': float(arm_sh[pants].max()) if pants.any() else 0}

write_vertex_groups(body, surf, RIGJ, bones, idx, top)

# ---- skeleton onto the male joints ------------------------------------------------------------
mod = bind_skeleton(rig, body, J)

# ---- 4. narrow stance: legs posed in about the hip joint, soles flat; applied as rest --------
if '--no-leg-pose' not in ARGS:
    # no extra elbow bend: the redraw already hangs his forearms ≈ 15° forward of the upper arms (the courier rest bend)
    mod = narrow_stance(rig, body, J, mod)

# ---- 5. smooth normals from the welded surface ------------------------------------------------
me = body.data
P, WP = smooth_normals(body, surf)

body.name = 'courierSkin'; rig.name = 'courierRig'
body['asset_id'] = 'char.courier-male'; body['skinned'] = True; body['skeleton'] = 2
# COLOR_0 = the map's colour per corner (sRGB): semantic hints for the tier-gear ray fit (acc.courier-gear/build.py reads the
# body's first colour attribute); the game shades the body from the map only (Materials.fromTexture).
attr = me.color_attributes.new('Color', 'BYTE_COLOR', 'CORNER')
uvl = me.uv_layers.active
for li, loop in enumerate(me.loops):
    u, v = uvl.data[li].uv
    c = tex[int((v % 1) * (tex.shape[0] - 1)), int((u % 1) * (tex.shape[1] - 1))]
    attr.data[li].color_srgb = (float(c[0]), float(c[1]), float(c[2]), 1.)
for m in me.materials:
    if m: m.name = 'tex_baseColor'
front = bpy.data.objects.new('front', None); scene.collection.objects.link(front); front.location = (float(WP[:, 0].max()), 0, .728)
me.calc_loop_triangles()
stats.update({'id': 'char.courier-male.skin', 'skeleton': 2, 'triangles': len(me.loop_triangles), 'vertices': len(me.vertices), 'weldedVertices': int(NW),
              'bones': len(rig.data.bones), 'scale': float(S), 'height': float(P[:, 2].max() - P[:, 2].min()),
              'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'components': sorted(comps, reverse=True)[:6],
              'joints': {n: [round(float(x), 4) for x in J[n]] for n in sorted(J)}})
print('SKIN OK', json.dumps({k: v for k, v in stats.items() if k != 'joints'}))

if arg('--debug'):
    debug_renders(scene, me, surf, bones, idx, top, arg('--debug'))

if arg('--pose-test'):
    pose_test_renders(scene, rig, arg('--pose-test'))

export_skin(stats, HERE, rig, body, front, 'ACTIVE')
