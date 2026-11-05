"""Shared stages of the courier skin builders (assets/char.courier-{female,male}-skin/build.py, run inside Blender).

Each builder keeps its own anatomy (source joints, coordinate frame, body masks, arm/leg/bag regions, colours); everything
that is the same for both couriers lives here: the welded surface, base-texture colour sampling, the limb/spine weight
blend, vertex groups, moving the skeleton onto the joints, the narrow-stance rest pose, smooth normals, the debug and
pose-test renders and the GLB export.
"""
import bpy, sys, math, json, colorsys
from pathlib import Path
import numpy as np
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key) + 1] if key in ARGS else default

def smooth(x):
    t = np.clip(x, 0, 1); return t * t * (3 - 2 * t)

def seg_param(p, a, b):
    d = b - a; L2 = d @ d; u = np.clip(((p - a) @ d) / L2, 0, 1)
    return u, np.linalg.norm(p - (a + u[:, None] * d), axis=1)

def hats(t, centers):
    out = {}
    t = np.asarray(t)
    for i, (c, bone) in enumerate(centers):
        w = np.zeros_like(t)
        if i == 0: w = np.where(t <= c, 1., w)
        if i == len(centers) - 1: w = np.where(t >= c, 1., w)
        if i > 0:
            a = centers[i - 1][0]; u = smooth((t - a) / (c - a)); w = np.where((t > a) & (t <= c), u, w)
        if i < len(centers) - 1:
            b = centers[i + 1][0]; u = smooth((t - c) / (b - c)); w = np.where((t > c) & (t < b), 1 - u, w)
        out[bone] = out.get(bone, 0) + w
    return out

def base_texture(body):
    """(image, RGB pixels) of the body's base-colour texture."""
    img = None
    for m in body.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image: img = n.image
    return img, (np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)[..., :3] if img else None)

class Surface:
    """The body welded over its UV duplicates: welded points WP, vertex -> welded index `inverse`, neighbours `nbr`."""
    def __init__(self, body, P):
        key = np.round(P / 1e-5).astype(np.int64)
        _, self.weld, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
        self.inverse = inverse.reshape(-1); self.NW = NW = len(self.weld); self.WP = P[self.weld]
        edges = set()
        for poly in body.data.polygons:
            vs = [int(self.inverse[i]) for i in poly.vertices]
            for a, b in zip(vs, vs[1:] + vs[:1]):
                if a != b: edges.add((min(a, b), max(a, b)))
        self.nbr = [[] for _ in range(NW)]
        for a, b in edges: self.nbr[a].append(b); self.nbr[b].append(a)
        # components (report only)
        seen = np.full(NW, -1); self.comps = []
        for s0 in range(NW):
            if seen[s0] >= 0: continue
            stack = [s0]; seen[s0] = len(self.comps); n = 0
            while stack:
                i = stack.pop(); n += 1
                for j in self.nbr[i]:
                    if seen[j] < 0: seen[j] = len(self.comps); stack.append(j)
            self.comps.append(n)
        print('WELD', len(P), '->', NW, 'components', sorted(self.comps, reverse=True)[:8])

    def lap(self, f, iterations, rate=.5, fixed=None):
        f = f.copy()
        for _ in range(iterations):
            g = np.array([f[n].mean(axis=0) if n else f[i] for i, n in enumerate(self.nbr)])
            f = (1 - rate) * f + rate * g
            if fixed is not None: f[fixed[0]] = fixed[1]
        return f

    def chain(self, pts):
        """(arc length of the closest point, distance) on polyline pts, extrapolated at both ends."""
        WP = self.WP
        best_d = np.full(len(WP), 1e9); best_t = np.zeros(len(WP)); acc = 0
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            d = b - a; L = np.linalg.norm(d); u = ((WP - a) @ d) / (L * L)
            if i > 0: u = np.maximum(0, u)
            if i < len(pts) - 2: u = np.minimum(1, u)
            q = a + np.clip(u, 0, 1)[:, None] * d; dist = np.linalg.norm(WP - q, axis=1)
            better = dist < best_d; best_d[better] = dist[better]; best_t[better] = acc + u[better] * L
            acc += L
        return best_t, best_d

    def flood(self, seeds, allowed):
        """Mask of the `allowed` points connected to `seeds` along the surface."""
        inside = np.zeros(self.NW, bool); inside[seeds] = True; stack = list(seeds)
        while stack:
            i = stack.pop()
            for j in self.nbr[i]:
                if not inside[j] and allowed[j]: inside[j] = True; stack.append(j)
        return inside

    def colours(self, body, P, tex):
        """Per welded point: mean base-texture colour WC, textured-corner count cnt, hsv HSV and hue in degrees."""
        uvl = body.data.uv_layers.active
        vcol = np.zeros((len(P), 3)); has_tex = np.zeros(len(P), bool)
        for poly in body.data.polygons:
            mat = body.data.materials[poly.material_index]
            if not mat or 'repair' in mat.name: continue
            for li, vi in zip(poly.loop_indices, poly.vertices):
                u, v = uvl.data[li].uv
                x = int((u % 1) * (tex.shape[1] - 1)); y = int((v % 1) * (tex.shape[0] - 1))
                vcol[vi] = tex[y, x]; has_tex[vi] = True
        WC = np.zeros((self.NW, 3)); cnt = np.zeros(self.NW)
        np.add.at(WC, self.inverse, vcol); np.add.at(cnt, self.inverse, has_tex)
        WC = WC / np.maximum(cnt, 1)[:, None]
        HSV = np.array([colorsys.rgb_to_hsv(*c) for c in WC])
        return WC, cnt, HSV, HSV[:, 0] * 360

BAND = .06
LEG_BAND = .05  # a short knee transition: a long blend half-rotates the upper shin and reads as a thin, kinked shin at a run

def skin_weights(surf, J, member, above, pony=None):
    """Blend limbs (member shares), the bag socket, the optional ponytail and the spine/neck/clavicle chain into bone
    weights, keep the 4 strongest per point. `above` = how strongly a point near the neck is hair/head. Returns
    (bones, idx, top): sorted bone names and, per welded point, the 4 bone indices and normalised weights."""
    WP = surf.WP; chain = surf.chain
    W = {}
    def add(bone, x):
        W[bone] = W.get(bone, 0) + x
    for s in 'LR':
        for limb, (up_, mid, end) in (('arm', ('arm', 'foreArm', 'hand')), ('leg', ('leg', 'shin', 'foot'))):
            A, B, C = J[up_ + s], J[mid + s], J[end + s]; l1, l2 = np.linalg.norm(B - A), np.linalg.norm(C - B)
            t, _ = chain([A, B, C])
            if limb == 'arm': c = [(min(.35 * l1, l1 - BAND), 'arm' + s), (l1, 'elbow' + s), (l1 + min(BAND, .42 * l2), 'foreArm' + s), (l1 + .65 * l2, 'foreArmTwist' + s), (l1 + l2 + .03, 'hand' + s)]
            else: c = [(min(.35 * l1, l1 - LEG_BAND), 'leg' + s), (l1, 'knee' + s), (l1 + min(LEG_BAND, .45 * l2), 'shin' + s), (l1 + l2 + .01, 'foot' + s)]
            m = member[limb + s]
            for bone, x in hats(t, c).items(): add(bone, m * x)
            if limb == 'leg':
                # shoes: the whole shoe is foot-owned; the toe bends at the ball
                shoe = (WP[:, 2] < J['foot' + s][2] + .015) * m
                for bone in list(W):
                    if bone.endswith(s) and bone in ('leg' + s, 'knee' + s, 'shin' + s): W[bone] = W[bone] * (1 - shoe)
                u = smooth((WP[:, 0] - J['toe' + s][0] + .012) / .024)
                W['foot' + s] = W.get('foot' + s, 0) * (1 - shoe) + shoe * (1 - u)
                add('toe' + s, shoe * u)
    add('backpackSocket', member['bag'])
    if pony is not None:
        # the tail leaves the head over its first 15 %, then rides pony1..3 (the courier's own hats along the chain)
        t = np.clip((WP - pony['tie']) @ pony['d0'], 0, None) / pony['L']
        t = np.maximum(t, np.linalg.norm(WP - pony['tie'], axis=1) / pony['L']) * pony['mask']
        mp = pony['mask'] * smooth(t / .15)
        for bone, x in hats(t, [(0., 'head'), (.17, 'pony1'), (.5, 'pony2'), (.84, 'pony3')]).items():
            if bone != 'head': add(bone, mp * x)
        member['pony'] = mp * (1 - hats(t, [(0., 'head'), (.17, 'pony1'), (.5, 'pony2'), (.84, 'pony3')])['head'])
    rest = np.clip(1 - sum(member.values()), 0, 1)
    SPINE = [(J['hip'][2], 'hip'), (J['torso'][2] + .02, 'torso'), (J['spine'][2], 'spine'), (J['chest'][2], 'chest'), (J['neck'][2], 'neck'), (J['head'][2] + .025, 'head')]
    part = hats(WP[:, 2], SPINE)
    neck_pts = WP[(WP[:, 2] > J['neck'][2] + .01) & (WP[:, 2] < J['head'][2])]
    NECK_R = np.sort(np.hypot(neck_pts[:, 0] - J['neck'][0], neck_pts[:, 1]))[len(neck_pts) // 10] if len(neck_pts) else .05
    print('NECK_RADIUS', round(float(NECK_R), 3))
    radial = np.hypot(WP[:, 0] - J['neck'][0], WP[:, 1] - J['neck'][1])
    lateral = smooth((radial - NECK_R) / .035)
    lateral *= 1 - above  # hair/head above the jaw stays on the head regardless of radius
    for bname in ('neck', 'head'):
        part['chest'] = part['chest'] + part[bname] * lateral; part[bname] = part[bname] * (1 - lateral)
    for s in 'LR':
        _, d = seg_param(WP, J['clavicle' + s], J['arm' + s])
        c = (1 - np.clip((d - .025) / .05, 0, 1)) * np.clip((WP[:, 2] - J['chest'][2]) / .05, 0, 1) * lateral
        take = .75 * c
        for bname in part: part[bname] = part[bname] * (1 - take)
        part['clavicle' + s] = part.get('clavicle' + s, 0) + take
    for bname, x in part.items(): add(bname, rest * x)
    bones = sorted(W)
    Wm = np.stack([W[n] for n in bones], 1)
    # 4 influences, normalised
    idx = np.argsort(-Wm, 1)[:, :4]; top = np.take_along_axis(Wm, idx, 1); top /= top.sum(1, keepdims=True)
    top[top < 1e-3] = 0; top /= top.sum(1, keepdims=True)
    return bones, idx, top

def arm_share(bones, idx, top):
    """Per welded point: the weight share taken by arm/clavicle bones."""
    arm_bones = [i for i, n in enumerate(bones) if n.startswith(('arm', 'foreArm', 'hand', 'elbow', 'clavicle'))]
    share = np.zeros(len(top))
    for k in range(4): share += np.where(np.isin(idx[:, k], arm_bones), top[:, k], 0)
    return share

def write_vertex_groups(body, surf, RIGJ, bones, idx, top):
    for n in RIGJ:
        if n not in body.vertex_groups: body.vertex_groups.new(name=n)
    groups = {n: body.vertex_groups[n] for n in RIGJ}
    for vi in range(len(body.data.vertices)):
        w = surf.inverse[vi]
        for k in range(4):
            if top[w, k] > 0: groups[bones[idx[w, k]]].add([vi], float(top[w, k]), 'REPLACE')

def bind_skeleton(rig, body, J):
    """Move every bone onto its joint, parent the body to the rig; returns the Armature modifier."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for b in eb: b.use_connect = False
    inv = rig.matrix_world.inverted()
    for b in eb:
        tail_off = b.tail - b.head
        b.head = inv @ Vector(J[b.name]); b.tail = b.head + tail_off
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = rig
    mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    return mod

def narrow_stance(rig, body, J, mod, elbow_bend_deg=None):
    """Legs posed in about the hip joint (soles flat, optional soft elbows), applied as the rest pose; returns the new modifier."""
    bpy.ops.object.mode_set(mode='POSE')
    for s, sgn in (('L', 1), ('R', -1)):
        hipj, ank = Vector(J['leg' + s]), Vector(J['foot' + s])
        d = ank - hipj; spread = math.atan2(d.y, -d.z)
        target = sgn * math.radians(6)
        angle = target - spread  # rotate about +X: y' = y cos - z sin
        pb = rig.pose.bones['leg' + s]
        pb.matrix = Matrix.Translation(hipj) @ Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation(-hipj) @ pb.matrix
        bpy.context.view_layer.update()
        pf = rig.pose.bones['foot' + s]; head = pf.head.copy()
        pf.matrix = Matrix.Translation(head) @ Matrix.Rotation(-angle, 4, 'X') @ Matrix.Translation(-head) @ pf.matrix
        bpy.context.view_layer.update()
        print('LEG', s, 'spread', round(math.degrees(spread), 1), '->', round(math.degrees(target), 1))
    if elbow_bend_deg is not None:
        for s in 'LR':
            pf = rig.pose.bones['foreArm' + s]; head = pf.head.copy()
            pf.matrix = Matrix.Translation(head) @ Matrix.Rotation(math.radians(elbow_bend_deg), 4, 'Y') @ Matrix.Translation(-head) @ pf.matrix
            bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.objects.active = body
    with bpy.context.temp_override(object=body, active_object=body):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # back on the floor
    dz = min(v.co.z for v in body.data.vertices)
    for v in body.data.vertices: v.co.z -= dz
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for b in rig.data.edit_bones:
        if b.name != 'root': b.head.z -= dz; b.tail.z -= dz
    bpy.ops.object.mode_set(mode='OBJECT')
    print('FLOOR shift', round(dz, 4))
    mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    return mod

def smooth_normals(body, surf):
    """Custom normals from the welded surface (no seams at UV islands); returns the posed vertices P and welded points WP."""
    me = body.data
    P = np.array([v.co for v in me.vertices]); WP = P[surf.weld]
    N = np.zeros((surf.NW, 3))
    for poly in me.polygons:
        vs = [int(surf.inverse[i]) for i in poly.vertices]
        if len(set(vs)) < 3: continue
        a, b, c = WP[vs[0]], WP[vs[1]], WP[vs[2]]
        n = np.cross(b - a, c - a)
        for w in set(vs): N[w] += n
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    loopN = [Vector(N[surf.inverse[l.vertex_index]]) for l in me.loops]
    for p in me.polygons: p.use_smooth = True
    me.normals_split_custom_set(loopN)
    return P, WP

def debug_renders(scene, me, surf, bones, idx, top, prefix):
    """Ownership colours (dominant bone per vertex) from front/back/side."""
    pal = {}
    rng = np.random.default_rng(3)
    col = me.color_attributes.new('own', 'FLOAT_COLOR', 'POINT')
    for vi in range(len(me.vertices)):
        w = surf.inverse[vi]; bn = bones[idx[w, 0]]
        if bn not in pal: pal[bn] = rng.random(3) * .8 + .2
        c = pal[bn] * top[w, 0] + .15 * (1 - top[w, 0]); col.data[vi].color = (*c, 1)
    sc = scene; sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'
    me.color_attributes.active_color = col
    sc.render.resolution_x = 360; sc.render.resolution_y = 520
    sc.world = bpy.data.worlds.new('w'); sc.world.color = (.25, .25, .28)
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 1.6
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    for name, loc in (('front', (3, 0, .73)), ('back', (-3, 0, .73)), ('side', (0, 3, .73))):
        co.location = loc; d = Vector((0, 0, .73)) - Vector(loc)
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = prefix + f'_{name}.png'; bpy.ops.render.render(write_still=True)
    me.color_attributes.remove(col)

def pose_test_renders(scene, rig, prefix):
    sc = scene; sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sc.render.resolution_x = 360; sc.render.resolution_y = 520
    if not sc.world: sc.world = bpy.data.worlds.new('w')
    sc.world.color = (.25, .25, .28)
    cam = bpy.data.cameras.new('pc'); cam.type = 'ORTHO'; cam.ortho_scale = 1.7
    co = bpy.data.objects.new('pcam', cam); sc.collection.objects.link(co); sc.camera = co
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='POSE')
    PB = rig.pose.bones
    def rot(name, axis, deg):
        pb = PB[name]; pb.rotation_mode = 'XYZ'; e = list(pb.rotation_euler); e['XYZ'.index(axis)] += math.radians(deg); pb.rotation_euler = e
    poses = {
        'reach': [('armL', 'X', -100), ('foreArmL', 'X', -60), ('armR', 'Y', 75), ('chest', 'Z', 20)],
        'stride': [('legL', 'Y', -55), ('shinL', 'Y', 80), ('legR', 'Y', 30), ('shinR', 'Y', 20), ('armL', 'Y', 40), ('armR', 'Y', -40)],
        'kick': [('legR', 'Y', -85), ('shinR', 'Y', 10), ('legL', 'Y', 10), ('torso', 'Y', 15), ('armL', 'X', -30)],
    }
    for pname, ops in poses.items():
        for pb in PB: pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0)
        for op in ops: rot(*op)
        bpy.context.view_layer.update()
        for view, loc in (('front', (3, .2, .73)), ('side', (.4, 3, .73)), ('back', (-3, -.6, .9))):
            co.location = loc; d = Vector((0, 0, .73)) - Vector(loc)
            co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
            sc.render.filepath = prefix + f'_{pname}_{view}.png'; bpy.ops.render.render(write_still=True)
    for pb in PB: pb.rotation_euler = (0, 0, 0)
    bpy.ops.object.mode_set(mode='OBJECT')

def export_skin(stats, here, rig, body, front, vertex_color):
    """Write report.json and, with --glb, the skinned GLB."""
    report = Path(arg('--glb')).resolve().parent if arg('--glb') else here
    (report / 'report.json').write_text(json.dumps(stats, indent=2) + '\n')
    if arg('--glb'):
        out = Path(arg('--glb')).resolve(); out.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in (rig, body, front): o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_yup=True, export_extras=True,
                                  export_cameras=False, export_lights=False, export_animations=False, export_skins=True,
                                  export_influence_nb=4, export_def_bones=False, export_vertex_color=vertex_color, export_normals=True,
                                  export_image_format='AUTO')
        print('GLB OK', out)
