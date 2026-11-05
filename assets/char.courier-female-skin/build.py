"""Female courier skin (char.courier-female, PO 10-24: replaces the palette body directly): the TRELLIS.2 heroine body
(3D pipeline experiments/heroine-garment-preview-1k-v2/heroine/raw.glb: 6,002 tris, 1K base colour, arm patches)
bound to the game's courier skeleton v2 (armature of rig-source.skin.glb = the previous palette skin, built by build-palette.py).

Rebuild:
  Blender -b --python assets/char.courier-female-skin/build.py -- --source <raw.glb> --glb assets/char.courier-female-skin/model.skin.glb
  npx tsx tools/assets/courier-tex-compress.ts   (writes public/assets/models/char.courier-female.skin.glb and .skin.low.glb)
Options: --debug <png prefix> renders an ownership map; --no-leg-pose keeps the source stance.

What it does (+X forward, Z up, +Y = anatomical left, metres):
1. heroine frame (up -Y, forward -Z, left +X) -> courier frame, uniform scale to the courier height (1.455 m), hip centred.
   The body is NOT re-proportioned: the approved design (PO 9/10) keeps its own head/limb proportions.
2. skeleton = the courier's own 39-bone armature (same names, hierarchy, helpers, sockets, bind convention); every joint is
   moved onto the heroine's anatomy (as the male courier has its own joint positions under the same clips).
3. ownership is semantic, computed on the position-welded surface (UV duplicates share one weight row):
   arms = flood fill from the hands along mesh edges inside the arm capsule (never by proximity across the torso gap);
   legs/shorts = below the waistband, the waistband rides the hip, shorts blend to the thighs, never any arm influence;
   shoes = foot (toe at the ball); backpack body = backpackSocket, straps = chest/clavicle; head/hair = head.
   Inside each limb the courier's own eased chain partition (incl. elbow/knee/twist helpers) is used.
4. the legs are posed in to the courier's narrow stance (soles kept flat) and that pose is applied as the rest pose.
5. smooth normals from the welded surface (no seams at UV islands).
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
SOURCE = Path(arg('--source', '/Users/wesner/Workspace/minorincident_3dpipeline/experiments/heroine-garment-preview-1k-v2/heroine/raw.glb'))
RIG = HERE / 'rig-source.skin.glb'
HEIGHT = 1.438  # source height; the narrow-stance pose lifts the figure ~1.7 cm, so the built body stands 1.455 m (the manifest height)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
# ---- 1. courier armature (kept), heroine mesh ---------------------------------------------
bpy.ops.import_scene.gltf(filepath=str(RIG))
rig = bpy.data.objects['courierRig']
for o in list(bpy.data.objects):
    if o is not rig: bpy.data.objects.remove(o, do_unlink=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
imported = [o for o in bpy.data.objects if o not in before]
body = next(o for o in imported if o.type == 'MESH' and len(o.data.vertices) > 1000)
research = next(o for o in imported if o.type == 'ARMATURE')
RJ = {b.name: research.matrix_world @ b.head_local for b in research.data.bones}
body.parent = None; body.matrix_world = Matrix.Identity(4)
body.modifiers.clear(); body.vertex_groups.clear()
for o in imported:
    if o is not body: bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)

M3 = Matrix(((0, 0, -1), (1, 0, 0), (0, -1, 0)))
P0 = np.array([M3 @ v.co for v in body.data.vertices])
zmin, zmax = P0[:, 2].min(), P0[:, 2].max(); S = HEIGHT / (zmax - zmin)
hipR = M3 @ RJ['hip']
OFF = np.array([hipR.x, hipR.y, zmin])
P = (P0 - OFF) * S
for v, p in zip(body.data.vertices, P): v.co = Vector(p)
RJ = {k: (np.array(M3 @ v) - OFF) * S for k, v in RJ.items()}

# ---- welded surface (UV duplicates share a row) -----------------------------------------------
surf = Surface(body, P)
weld, inverse, NW, WP, nbr, comps, lap, chain = surf.weld, surf.inverse, surf.NW, surf.WP, surf.nbr, surf.comps, surf.lap, surf.chain

# vertex colour of the base texture (semantic hints only, combined with regions)
img, tex = base_texture(body)
WC, cnt, HSV, hue = surf.colours(body, P, tex)
denim = (hue > 200) & (hue < 250) & (HSV[:, 1] > .2) & (cnt > 0)
teal = (hue > 150) & (hue <= 200) & (HSV[:, 1] > .15) & (cnt > 0)

# ---- 2. joints on the heroine anatomy ---------------------------------------------------------
def V(a): return np.array(a, float)
J = {}
for s, sgn in (('L', 1), ('R', -1)):
    J['leg' + s] = RJ['leg' + s]; J['shin' + s] = RJ['shin' + s]; J['foot' + s] = RJ['foot' + s]
    J['clavicle' + s] = RJ['clavicle' + s]; J['arm' + s] = RJ['arm' + s]; J['foreArm' + s] = RJ['foreArm' + s]; J['hand' + s] = RJ['hand' + s]
legz = (J['legL'][2] + J['legR'][2]) / 2
J['root'] = V((0, 0, 0)); J['hip'] = V((0, 0, legz + .045))
shoulder = (J['armL'][2] + J['armR'][2]) / 2
# Courier spine spacing between hip and neck (0.62 .. 0.929): torso 17 %, spine 45 %, chest 73 %; neck at the shoulders.
neck_z = shoulder + .01
for name, f in (('torso', .17), ('spine', .45), ('chest', .73)):
    J[name] = V((0, 0, J['hip'][2] + f * (neck_z - J['hip'][2])))
J['neck'] = V((0, 0, neck_z))
J['head'] = V((RJ['head'][0] + .01, 0, RJ['head'][2] - .02))  # pivot over the skull base (her head sits slightly forward of the neck)
for s in 'LR':
    J['elbow' + s] = J['foreArm' + s].copy(); J['knee' + s] = J['shin' + s].copy()
    J['foreArmTwist' + s] = J['foreArm' + s] + .55 * (J['hand' + s] - J['foreArm' + s])
# toes at the ball of each shoe
for s, sgn in (('L', 1), ('R', -1)):
    shoe = WP[(WP[:, 2] < .09) & (WP[:, 1] * sgn > .04)]
    x0, x1 = shoe[:, 0].min(), shoe[:, 0].max()
    J['toe' + s] = V((x0 + .66 * (x1 - x0), J['foot' + s][1], shoe[:, 2].min() + .03))
# bag: teal surface behind the back
back = WP[:, 0] < -.06
bag = teal & back & (WP[:, 2] > .55) & (WP[:, 2] < 1.0) & (np.abs(WP[:, 1]) < .2)
bagP = WP[bag]
print('BAG', bag.sum(), bagP.min(0).round(3) if bag.any() else None, bagP.max(0).round(3) if bag.any() else None)
torso_back = WP[(np.abs(WP[:, 1]) < .08) & (WP[:, 2] > J['chest'][2] - .03) & (WP[:, 2] < J['chest'][2] + .03) & ~bag]
J['backpackSocket'] = V((torso_back[:, 0].min() - .01 if len(torso_back) else -.11, 0, J['chest'][2]))
# Sockets keep the courier's hand-relative offsets; eyes/iris/pony keep their offsets from the head.
RIGJ = {b.name: np.array(rig.matrix_world @ b.head_local) for b in rig.data.bones}
for s in 'LR':
    J['weaponSocket' + s] = J['hand' + s] + (RIGJ['weaponSocket' + s] - RIGJ['hand' + s])
headTop = WP[:, 2].max()
for n in ('eyeL', 'irisL', 'eyeR', 'irisR', 'pony1', 'pony2', 'pony3'):
    J[n] = J['head'] + (RIGJ[n] - RIGJ['head']) * np.array([1, 1, (headTop - J['head'][2]) / (1.455 - RIGJ['head'][2])])
# ponytail: from the red hair tie at the back of the crown out to the tip, flood-filled along the mesh beyond the tie
red = ((hue < 15) | (hue > 345)) & (HSV[:, 1] > .45) & (cnt > 0)
tie_sel = red & (WP[:, 2] > J['head'][2] + .15) & (WP[:, 0] < J['head'][0] + .02)
PONY = None
if tie_sel.sum() >= 4:
    tie = WP[tie_sel].mean(0); hc = np.array([J['head'][0], 0, J['head'][2] + .15])
    d0 = (tie - hc) / np.linalg.norm(tie - hc)
    beyond = ((WP - tie) @ d0 > .01) & ~tie_sel
    far = np.where(beyond)[0][np.argmax(np.linalg.norm(WP[beyond] - tie, axis=1))]
    pony = surf.flood([far], beyond)
    dist = np.linalg.norm(WP - tie, axis=1); L = dist[pony].max()
    cents = [WP[pony & (dist > L * a) & (dist <= L * b)].mean(0) for a, b in ((.25, .42), (.58, .75), (.9, 1.01))]
    J['pony1'] = tie; J['pony2'] = cents[0]; J['pony3'] = cents[1]
    PONY = dict(mask=pony, tie=tie, d0=d0, L=L, tip=cents[2])
    print('PONY', int(pony.sum()), 'tie', tie.round(3), 'L', round(float(L), 3), 'joints', [c.round(3).tolist() for c in cents])
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
    # the heroine's arms are thin (≈ 3.5 cm radius): a tight capsule keeps the front/back chest beside the armpit out
    radius = np.where(t < l1, .05, .05)
    allowed = (d < radius) & (t > -.03) & (WP[:, 1] * sgn > .1)
    seeds = np.where(allowed & (t > l1 + .05))[0]
    inside = surf.flood(seeds, allowed)
    # the shoulder end fades into the clavicle/chest over the first 4 cm of the upper arm
    m = inside * smooth((t + .03) / .05)
    member['arm' + s] = m
    print('ARM', s, 'seeds', len(seeds), 'members', int(inside.sum()))
arms = member['armL'] + member['armR']
# straps ride the chest/clavicle, not the arm
member['armL'] *= 1 - .8 * teal; member['armR'] *= 1 - .8 * teal
# legs: below the waistband; waistband -> hip, lower shorts -> thighs; never on the arm/hand surface
shorts = denim & (WP[:, 2] > .35) & (WP[:, 2] < .8) & (np.abs(WP[:, 1]) < .22) & (arms < .5)
waist = np.percentile(WP[shorts, 2], 98) if shorts.any() else legz + .08
crotch = np.percentile(WP[shorts & (np.abs(WP[:, 1]) < .02), 2], 10) if (shorts & (np.abs(WP[:, 1]) < .02)).any() else legz - .06
print('SHORTS z pct', np.percentile(WP[shorts, 2], [5, 25, 50, 75, 90, 95, 98]).round(3), 'front', np.percentile(WP[shorts & (WP[:, 0] > 0) & (np.abs(WP[:, 1]) < .05), 2], [90, 98]).round(3))
print('SHORTS', int(shorts.sum()), 'waist', round(float(waist), 3), 'crotch', round(float(crotch), 3), 'denim', int(denim.sum()), 'teal', int(teal.sum()))
# the upper 40 % of the shorts (waistband, belly front) rides the hip only; the thighs take over towards the crotch
leg_top = crotch + .6 * (waist - crotch)
leg_all = smooth((leg_top - WP[:, 2]) / (leg_top - crotch)) * (1 - np.clip(arms, 0, 1))
# hands and fingers hang beside the thighs (|y| > 0.2): whatever the arm flood missed there is hand, never leg
for s, sgn in (('L', 1), ('R', -1)):
    tip = J['hand' + s] + 1.6 * (RJ['Palm' + s] - J['hand' + s])
    _, dh = chain([J['foreArm' + s], J['hand' + s], tip])
    _, dl = chain([J['leg' + s], J['shin' + s], J['foot' + s]])
    hand = (WP[:, 1] * sgn > .2) & (dh < .07) & (dh < dl) & (WP[:, 2] > J['shin' + s][2])
    leg_all[hand] = 0; member['arm' + s] = np.maximum(member['arm' + s], hand.astype(float))
    print('HAND fix', s, int(hand.sum()))
side = smooth(WP[:, 1] / .04 + .5)
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
F[shorts] *= np.array([0, 0, 1, 1, 0])  # shorts never take any arm or bag share
# smoothing must not carry the thighs onto the belly: no leg share above the waistband (the run tore the shirt front)
F[:, 2:4] *= smooth((leg_top + .02 - WP[:, 2]) / .03)[:, None]
F = np.clip(F, 0, 1); tot = F.sum(1); F[tot > 1] /= tot[tot > 1, None]
member = {n: F[:, i] for i, n in enumerate(names)}

above = smooth((WP[:, 2] - (J['head'][2] + .03)) / .04)  # hair/head above the jaw stays on the head
bones, idx, top = skin_weights(surf, J, member, above, PONY)
arm_sh = arm_share(bones, idx, top)
print('SHORTS max arm/clavicle share', round(float(arm_sh[shorts].max()), 4) if shorts.any() else None)
stats = {'shortsVertices': int(shorts.sum()), 'shortsMaxArmShare': float(arm_sh[shorts].max()) if shorts.any() else 0}

write_vertex_groups(body, surf, RIGJ, bones, idx, top)

# ---- skeleton onto the heroine joints ---------------------------------------------------------
mod = bind_skeleton(rig, body, J)

# ---- 4. narrow stance: legs posed in about the hip joint, soles flat; applied as rest --------
if '--no-leg-pose' not in ARGS:
    # soft elbows: the source hangs her arms almost straight (≈ 9° in idle); the courier rest carries a slight bend
    mod = narrow_stance(rig, body, J, mod, elbow_bend_deg=-7)

# ---- 5. smooth normals from the welded surface ------------------------------------------------
me = body.data
P, WP = smooth_normals(body, surf)

body.name = 'courierSkin'; rig.name = 'courierRig'
body['asset_id'] = 'char.courier-female'; body['skinned'] = True; body['skeleton'] = 2
# arm-repair caps: their research vertex gradient reads as light patches in game light. Re-tint each cap vertex with the
# base-colour texture of the nearest textured surface (sRGB, as the texture is sampled), so the caps match the skin around them.
patch_loops = [(li, vi) for poly in me.polygons if me.materials[poly.material_index] and 'repair' in me.materials[poly.material_index].name
               for li, vi in zip(poly.loop_indices, poly.vertices)]
if patch_loops and 'Color' in me.color_attributes:
    textured = np.where(cnt > 0)[0]
    Pt = WP[textured]
    attr = me.color_attributes['Color']
    for li, vi in patch_loops:
        d = np.linalg.norm(Pt - WP[inverse[vi]], axis=1); near = textured[np.argsort(d)[:8]]
        c = WC[near].mean(0)
        attr.data[li].color_srgb = (float(c[0]), float(c[1]), float(c[2]), 1.)
    stats['repairCapLoops'] = len(patch_loops)
for m in me.materials:
    if m and 'repair' not in m.name: m.name = 'tex_baseColor'
    elif m: m.name = 'tex_vertexColor'
front = bpy.data.objects.new('front', None); scene.collection.objects.link(front); front.location = (float(WP[:, 0].max()), 0, .728)
me.calc_loop_triangles()
stats.update({'id': 'char.courier-female.skin', 'skeleton': 2, 'triangles': len(me.loop_triangles), 'vertices': len(me.vertices), 'weldedVertices': int(NW),
              'bones': len(rig.data.bones), 'scale': float(S), 'height': float(P[:, 2].max() - P[:, 2].min()),
              'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'components': sorted(comps, reverse=True)[:6],
              'joints': {n: [round(float(x), 4) for x in J[n]] for n in sorted(J)}})
print('SKIN OK', json.dumps({k: v for k, v in stats.items() if k != 'joints'}))

if arg('--debug'):
    debug_renders(scene, me, surf, bones, idx, top, arg('--debug'))

if arg('--pose-test'):
    pose_test_renders(scene, rig, arg('--pose-test'))

export_skin(stats, HERE, rig, body, front, 'MATERIAL')
