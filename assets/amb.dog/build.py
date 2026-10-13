"""Generic medium dog (shepherd/lab mix): closed anatomical sweeps, palette coats, authored distance tiers.
Headless: python3 tools/blender/run.py assets/amb.dog/build.py --glb assets/amb.dog/model.glb --lod 0 [--coat base|black|cream]
The infected wrapper (assets/inf.dog/build.py) calls this exact builder with infection enabled: patchy fur, exposed
ribs, fangs, red eyes and a lower stance on the same rig. No decimation: every tier is authored from the same parameters.
Same node contract as the zoo animals (armL/foreArmL/handL + legFL/pawFL aliases for the forelegs, legL/shinL/footL +
legBL/pawBL for the hind legs), so the shared quadruped gait/paw solvers and the crowd clip atlas apply unchanged.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PALETTE = json.loads((HERE.parents[1] / 'src/assets/palette.json').read_text())
# main coat, saddle/ear/tail colour, light underside/socks (palette tokens only).
COATS = {'base': ('woodWarm', 'leather', 'canvasTan'),
         'black': ('navy', 'uiDark', 'khaki'),
         'cream': ('canvasTan', 'khakiLight', 'picketWhite')}


def build_dog(lod=0, infected=False, coat='base'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    parts, meshes = {}, []
    main, saddle, under = COATS[coat]
    if infected:
        tokens = [main, 'infectedSkin', 'blood', 'bone', 'uiDark', 'infectedEye']
        roles = {'main': 0, 'saddle': 0, 'under': 1, 'skin': 1, 'blood': 2, 'bone': 3, 'dark': 4, 'eye': 5}
    else:
        tokens = [main, saddle, under, 'uiDark']
        roles = {'main': 0, 'saddle': 1, 'under': 2, 'dark': 3, 'eye': 3}
    materials = []
    for i, token in enumerate(tokens):
        emissive = infected and token == 'infectedEye'
        m = bpy.data.materials.new(('emi_' if emissive else 'pal_') + token)
        m.use_nodes = True
        rgb = [int(PALETTE[token][j:j+2], 16)/255 for j in (1, 3, 5)]
        rgba = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb] + [1]
        m.diffuse_color = rgba
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = .78
        if emissive:
            bsdf.inputs['Emission Color'].default_value = rgba
            bsdf.inputs['Emission Strength'].default_value = 3
        materials.append(m)

    # Infection: a lower, hunched stance (heights scale about the ground) and the head carried low and forward.
    st = .86 if infected else 1.0
    head_off = Vector((.06, 0, -.075)) if infected else Vector((0, 0, 0))

    def G(p):
        p = Vector(p)
        return Vector((p.x, p.y, p.z*st))

    def H(p, k=1.0):
        return G(p) + head_off*k

    def node(name, pos, parent=None):
        o = bpy.data.objects.new(name, None)
        scene.collection.objects.link(o)
        o.location = pos
        if parent:
            bpy.context.view_layer.update()
            o.parent = parts[parent]
            o.matrix_parent_inverse = o.parent.matrix_world.inverted()
        parts[name] = o
        return o

    def mesh(name, verts, faces, owner, colors):
        data = bpy.data.meshes.new(name)
        data.from_pydata(verts, [], faces)
        data.update()
        o = bpy.data.objects.new(name, data)
        scene.collection.objects.link(o)
        for m in materials:
            data.materials.append(m)
        ao = data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
        data.color_attributes.active_color = ao
        for face, color in zip(data.polygons, colors):
            face.material_index = color
            face.use_smooth = True
            for loop in face.loop_indices:
                # Deterministic soft underside occlusion, no texture.
                z = data.vertices[data.loops[loop].vertex_index].co.z
                value = .82 + .18*min(1, max(0, z/.8))
                ao.data[loop].color = (value, value, value, 1)
        bpy.context.view_layer.update()
        o.parent = parts[owner]
        o.matrix_parent_inverse = o.parent.matrix_world.inverted()
        meshes.append(o)
        return o

    def sweep(name, rings, sides, owner, paint=None, solid='main'):
        """Closed rings along a centreline: rings are (position, vertical radius, lateral radius).
        paint(j, i, up) returns a role for the face between sides i and i+1 of ring segment j (up = cos of the face angle)."""
        verts, faces, colors = [], [], []
        for j, (pos, a, b) in enumerate(rings):
            p = Vector(pos)
            direction = Vector(rings[min(j+1, len(rings)-1)][0]) - Vector(rings[max(0, j-1)][0])
            direction.normalize()
            u = direction.cross(Vector((0, 1, 0)))
            if u.length < .1:
                u = direction.cross(Vector((1, 0, 0)))
            u = u.normalized()
            v = direction.cross(u).normalized()
            for i in range(sides):
                t = i*math.tau/sides
                verts.append(p + a*math.cos(t)*u + b*math.sin(t)*v)
        for j in range(len(rings)-1):
            for i in range(sides):
                faces.append((j*sides+i, j*sides+(i+1)%sides, (j+1)*sides+(i+1)%sides, (j+1)*sides+i))
                up = math.cos((i+.5)*math.tau/sides)
                colors.append(roles[paint(j, i, up) if paint else solid])
        # Fan caps keep every surface watertight at every LOD.
        for j, reverse in [(0, True), (len(rings)-1, False)]:
            center = len(verts)
            verts.append(Vector(rings[j][0]))
            for i in range(sides):
                face = (center, j*sides+i, j*sides+(i+1)%sides)
                faces.append(tuple(reversed(face)) if reverse else face)
                colors.append(roles[solid])
        return mesh(name, verts, faces, owner, colors)

    def oval(name, pos, size, owner, role='main', segments=None, rings=None):
        n = segments or [12, 8, 5][lod]
        r = rings or [7, 4, 3][lod]
        verts = [Vector((pos[0], pos[1], pos[2]+size[2]))]
        for j in range(1, r):
            t = math.pi*j/r
            for i in range(n):
                u = math.tau*i/n
                verts.append(Vector((pos[0]+size[0]*math.sin(t)*math.cos(u), pos[1]+size[1]*math.sin(t)*math.sin(u), pos[2]+size[2]*math.cos(t))))
        verts.append(Vector((pos[0], pos[1], pos[2]-size[2])))
        bottom = len(verts)-1
        faces = [(0, 1+i, 1+(i+1)%n) for i in range(n)]
        for j in range(r-2):
            for i in range(n):
                a = 1+j*n+i
                b = 1+j*n+(i+1)%n
                faces.append((a, a+n, b+n, b))
        faces += [(bottom, 1+(r-2)*n+(i+1)%n, 1+(r-2)*n+i) for i in range(n)]
        return mesh(name, verts, faces, owner, [roles[role]]*len(faces))

    def island(j, i, k, name):
        """Deterministic ragged islands (infection): True for a handful of faces per surface."""
        return (j*7 + i*13 + k*5 + len(name)*3) % 17 in (0, 1)

    # ---- rig (healthy proportions; infection lowers the stance through G) -------------------------------------
    node('root', (0, 0, 0))
    # Whole-leg translation in the shared paw solver would detach the articulated legs (zoo animals opt out).
    parts['root']['ss_preserveAnimalJoints'] = True
    node('hip', G((-.34, 0, .52)), 'root')
    node('torso', G((0, 0, .56)), 'hip')
    node('body', G((0, 0, .56)), 'torso')
    node('neck', H((.30, 0, .62), .4), 'body')
    node('head', H((.46, 0, .74)), 'neck')
    node('jaw', H((.64, 0, .66)), 'head')
    node('tail', G((-.46, 0, .60)), 'body')
    node('packSocket', G((-.02, 0, .76)), 'body')
    node('backpackSocket', G((-.02, 0, .76)), 'torso')
    node('front', H((.80, 0, .70)), 'head')

    # Barrel: deep chest, tucked loin; infected ribcage is narrower (starved).
    n, sides = [(24, 12), (13, 8), (7, 6)][lod]
    lean = .90 if infected else 1.0
    rings = []
    for j in range(n):
        t = j/(n-1)
        x = -.46 + .82*t
        shape = math.sin(math.pi*(.05+.90*t))**.55
        chest = 1 + .22*math.exp(-((t-.72)/.2)**2) - .16*math.exp(-((t-.25)/.16)**2)
        rings.append((G((x, 0, .57 + .012*math.cos(t*math.tau))), .165*shape*chest*st, .142*shape*chest*lean))

    def barrel_paint(j, i, up):
        t = j/(n-1)
        if infected:
            # Bare, mottled skin over the belly and ragged islands along the flanks; two open wounds.
            if up < -.35:
                return 'skin'
            if island(j, i, 1, 'barrel'):
                return 'blood' if (j, i) in {(n//2, 2), (n//3, sides-3), (n//2+2, 3), (n-4, 1)} else 'skin'
            return 'main'
        if up > .35 and .22 < t < .86:
            return 'saddle'
        if up < -.45 or (t > .78 and up < -.1):
            return 'under'
        return 'main'
    sweep('barrel', rings, sides, 'body', barrel_paint)
    # Neck: strong, sloped.
    n, sides = [(10, 10), (6, 7), (3, 6)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        rings.append((H((.26+.20*t, 0, .60+.17*t), .4+.6*t), (.125-.045*t)*st**.4, .115-.04*t))
    sweep('neck_skin', rings, sides, 'neck', lambda j, i, up: ('skin' if infected and up < -.2 else 'under' if up < -.55 else 'saddle' if up > .5 else 'main'))
    # Skull and muzzle.
    n, sides = [(8, 10), (5, 7), (3, 6)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        shape = .78+.22*math.sin(math.pi*t)
        rings.append((H((.38+.22*t, 0, .775-.035*t)), (.112-.014*t)*shape, (.106-.012*t)*shape))
    sweep('skull', rings, sides, 'head', lambda j, i, up: 'skin' if infected and island(j, i, 3, 'skull') else 'main')
    n, sides = [(7, 9), (4, 6), (3, 5)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        rings.append((H((.58+.20*t, 0, .735-.04*t)), .068-.022*t, .076-.024*t))
    sweep('muzzle', rings, sides, 'head', lambda j, i, up: 'under' if up < -.2 else 'main')
    oval('nose', H((.795, 0, .700)), (.026, .032, .024), 'head', 'dark')
    oval('lower_jaw', H((.665, 0, .645)), (.098, .042, .020), 'jaw', 'under')
    for side, sign in [('L', 1), ('R', -1)]:
        eye_size = (.030, .017, .026) if infected else (.018, .011, .016)
        oval('eye'+side, H((.645, sign*.068, .785)), eye_size, 'head', 'eye')
        # Shepherd ears: erect, tapered, tipped slightly outward; infected ears are torn and pulled back.
        n_e, sides_e = [(6, 7), (4, 5), (3, 4)][lod]
        ear = []
        for j in range(n_e):
            t = j/(n_e-1)
            bulge = math.sin(math.pi*(.10+.82*t))
            base = Vector((.44-.03*t, sign*(.060+.050*t), .85+.15*t))
            if infected:
                base += Vector((-.07*t, sign*.03*t, -.06*t))
            ear.append((H(base), .052*bulge, .030*bulge))
        sweep('ear'+side, ear, sides_e, 'head', lambda j, i, up: 'blood' if infected and j == 0 and side == 'R' else 'saddle')
        # Legs.
        shoulder = (.26, sign*.120, .50)
        elbow = (.275, sign*.125, .30)
        paw_f = (.30, sign*.125, .07)
        hip_p = (-.32, sign*.120, .50)
        knee = (-.20, sign*.140, .31)
        hock = (-.38, sign*.140, .20)
        paw_b = (-.36, sign*.140, .065)
        for name, pos, parent in [('arm'+side, shoulder, 'torso'), ('legF'+side, shoulder, 'arm'+side), ('foreArm'+side, elbow, 'legF'+side), ('hand'+side, paw_f, 'foreArm'+side), ('pawF'+side, paw_f, 'hand'+side),
                                  ('leg'+side, hip_p, 'hip'), ('legB'+side, hip_p, 'leg'+side), ('shin'+side, knee, 'legB'+side), ('foot'+side, paw_b, 'shin'+side), ('pawB'+side, paw_b, 'foot'+side)]:
            node(name, G(pos) if not name.startswith(('arm', 'legF')) else G(pos), parent)
        n_u, sides_u = [(6, 9), (3, 6), (2, 5)][lod]
        for prefix, a, b, owner, w0, w1 in [('front', shoulder, elbow, 'legF'+side, .078, .052), ('rear', hip_p, knee, 'legB'+side, .108, .056)]:
            sweep(prefix+'_upper'+side, [(G(Vector(a).lerp(Vector(b), j/(n_u-1))), (w0+(w1-w0)*j/(n_u-1))*st**.3, w0+(w1-w0)*j/(n_u-1)) for j in range(n_u)], sides_u, owner,
                  lambda j, i, up: 'skin' if infected and island(j, i, 5, prefix+side) else 'main')
        n_l, sides_l = [(7, 8), (4, 6), (3, 5)][lod]
        for prefix, points, owner in [('front', [elbow, (.285, sign*.128, .17), paw_f], 'foreArm'+side), ('rear', [knee, hock, paw_b], 'shin'+side)]:
            rings = []
            for j in range(n_l):
                t = j/(n_l-1)*2
                k = min(1, int(t))
                p = Vector(points[k]).lerp(Vector(points[k+1]), t-k)
                rings.append((G(p), .046-.012*j/(n_l-1), .042-.010*j/(n_l-1)))
            sweep(prefix+'_cannon'+side, rings, sides_l, owner,
                  lambda j, i, up: 'blood' if infected and prefix == 'front' and side == 'R' and j == 2 else 'main')
        for p, owner in [(paw_f, 'pawF'+side), (paw_b, 'pawB'+side)]:
            oval('paw_'+owner, G((p[0]+.028, p[1], .04)), (.062, .048, .040*st**.3), owner, 'under')
    # Tail: raised curve for the healthy dog, drooped and bare for the infected one.
    n, sides = [(9, 7), (5, 6), (3, 4)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        if infected:
            pos = (-.46 - .30*t, .02*math.sin(t*math.pi), .58 - .20*t)
        else:
            pos = (-.46 - .26*t - .08*t*t, .0, .60 + .10*math.sin(t*math.pi*.9) - .08*t)
        rings.append((G(pos), .048-.030*t, .048-.030*t))
    sweep('tail_curve', rings, sides, 'tail', lambda j, i, up: 'skin' if infected and j > n//2 else 'saddle' if j < n-2 else 'under')
    if infected:
        # Exposed ribs: bone arcs riding just outside the starved ribcage, both flanks.
        n_r, sides_r = [(6, 5), (4, 4), (3, 3)][lod]
        rib_count = [6, 4, 3][lod]
        for sign in (1, -1):
            for k in range(rib_count):
                x = .20 - k*(.46/max(1, rib_count-1))*.8 - .02
                rings = []
                for j in range(n_r):
                    ang = math.radians(35 + 110*j/(n_r-1))
                    rings.append((G((x, sign*(.142*.90*1.07)*math.sin(ang)*1.0, .57 + .165*1.07*math.cos(ang) - .02)), .011, .011))
                sweep('rib%s%d' % ('L' if sign > 0 else 'R', k), rings, sides_r, 'body', solid='bone')
        # Fangs: two upper pairs on the muzzle and one lower pair, bared.
        for k, (x, y, z, owner, down) in enumerate([(.755, .036, .700, 'head', -1), (.755, -.036, .700, 'head', -1), (.70, .052, .690, 'head', -1), (.70, -.052, .690, 'head', -1), (.735, .028, .648, 'jaw', 1), (.735, -.028, .648, 'jaw', 1)]):
            rings = [(H((x, y, z)), .010, .010), (H((x+.004, y, z+down*.020)), .007, .007), (H((x+.008, y, z+down*.040)), .0015, .0015)]
            sweep('fang%d' % k, rings, 4, owner, solid='bone')
    # Caps are shared by healthy/infected rigs, hidden until infection + dismemberment.
    for joint in ['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']:
        p = parts[joint].matrix_world.translation
        cap = oval('stump_'+joint, p, (.04, .04, .014), parts[joint].parent.name, 'blood' if infected else 'main', segments=4, rings=2)
        cap['hidden'] = True
        cap['detached_joint'] = joint
    # Merge static attachments per owner, retaining exactly the named rigid joints.
    groups = {}
    for o in meshes:
        if not o.name.startswith('stump_'):
            groups.setdefault(o.parent.name, []).append(o)
    for owner, group in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1:
            bpy.ops.object.join()
        group[0].name = owner+'__surface'
    scene['derivedFrom'] = 'amb.dog' if infected else 'dog base'
    scene['authoredLod'] = lod
    scene['coat'] = coat
    bpy.context.view_layer.update()
    return parts


def author_poses(parts):
    """Named shared-rig clips: a rotary gallop and the lunge-bite attack (idle/run reuse the shared quadruped atlas)."""
    scene = bpy.context.scene
    scene.render.fps = 60
    gallop = list(range(0, 25, 4))
    lunge = [0, 14, 26, 32, 40, 60]
    legs = ['legFL', 'legFR', 'legBL', 'legBR']
    for clip, frames in [('dog-gallop', gallop), ('dog-lunge-bite', lunge)]:
        for name in ['hip', 'body', 'head', 'jaw', 'tail'] + legs:
            joint = parts[name]
            rest = joint.location.copy()
            for frame in frames:
                angle = 0.0
                shift = 0.0
                if clip == 'dog-gallop':
                    phase = frame/24*math.tau
                    if name in ('legFL', 'legFR'):
                        angle = .72*math.sin(phase - (0 if name == 'legFL' else .55))
                    elif name in ('legBL', 'legBR'):
                        angle = -.66*math.sin(phase - 2.4 - (0 if name == 'legBL' else .5))
                    elif name == 'body':
                        angle = .07*math.sin(phase - .8)
                    elif name == 'head':
                        angle = -.05*math.sin(phase - .4)
                    elif name == 'tail':
                        angle = .10*math.sin(phase)
                else:
                    if name.startswith('legB'):
                        angle = {14: .50, 26: -.78, 32: -.30}.get(frame, 0)      # gather, then drive the hind legs under
                    elif name.startswith('legF'):
                        angle = {14: .30, 26: -.95, 32: -.55}.get(frame, 0)      # reach forward at the strike
                    elif name == 'body':
                        angle = {14: -.12, 26: .16, 32: .12}.get(frame, 0)
                    elif name == 'head':
                        angle = {14: -.20, 26: .38, 32: .30}.get(frame, 0)
                    elif name == 'jaw':
                        angle = {26: .62, 32: .02, 40: .0}.get(frame, 0)
                    elif name == 'hip':
                        shift = {14: -.05, 26: .16, 32: .12, 40: .04}.get(frame, 0)
                joint.rotation_euler = (0, angle, 0)
                joint.location = rest + Vector((shift, 0, 0))
                joint.keyframe_insert(data_path='rotation_euler', frame=frame)
                if name == 'hip':
                    joint.keyframe_insert(data_path='location', frame=frame)
            action = joint.animation_data.action
            action.name = clip+'__'+name
            track = joint.animation_data.nla_tracks.new()
            track.name = clip
            track.strips.new(clip, 0, action)
            joint.animation_data.action = None
            joint.rotation_euler = (0, 0, 0)
            joint.location = rest
    scene.frame_set(0)


def export_dog(output, lod=0, infected=False, coat='base'):
    parts = build_dog(lod, infected, coat)
    author_poses(parts)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_apply=True, export_extras=True, export_cameras=False, export_lights=False, export_vertex_color='ACTIVE', export_all_vertex_colors=True, export_animation_mode='NLA_TRACKS')


if __name__ in ('__main__', '<run_path>'):
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb', required=True)
    parser.add_argument('--quality', default='high')
    parser.add_argument('--lod', type=int, choices=[0, 1, 2], default=0)
    parser.add_argument('--coat', choices=sorted(COATS), default='base')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    export_dog(args.glb, args.lod, coat=args.coat)
