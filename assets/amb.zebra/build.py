"""Zebra base: closed anatomical sweeps, integral stripes, authored distance tiers.
Headless: python3 tools/blender/run.py assets/amb.zebra/build.py --glb assets/amb.zebra/model.glb --lod 0
The infected wrapper calls this exact builder; no duplicate geometry or decimation.
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


def build_zebra(lod=0, infected=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    parts, meshes = {}, []
    tokens = ['infectedSkin' if infected else 'picketWhite', 'uiDark', 'blood', 'infectedEye']
    materials = []
    for i, token in enumerate(tokens):
        m = bpy.data.materials.new(('emi_' if i == 3 and infected else 'pal_') + token)
        m.use_nodes = True
        rgb = [int(PALETTE[token][j:j+2], 16)/255 for j in (1, 3, 5)]
        rgba = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb] + [1]
        m.diffuse_color = rgba
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = .72
        if i == 3 and infected:
            bsdf.inputs['Emission Color'].default_value = rgba
            bsdf.inputs['Emission Strength'].default_value = 3
        materials.append(m)

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
                # Deterministic soft underside occlusion, no texture or disconnected stripe decals.
                z = data.vertices[data.loops[loop].vertex_index].co.z
                value = .84 + .16 * min(1, max(0, z/1.3))
                ao.data[loop].color = (value, value, value, 1)
        bpy.context.view_layer.update()
        o.parent = parts[owner]
        o.matrix_parent_inverse = o.parent.matrix_world.inverted()
        meshes.append(o)
        return o

    def sweep(name, rings, sides, owner, striped=True, solid=0):
        """Closed rings along an anatomical centreline, with shared surface stripe edges."""
        verts, faces, colors = [], [], []
        for j, (pos, a, b) in enumerate(rings):
            p = Vector(pos)
            direction = Vector(rings[min(j+1, len(rings)-1)][0]) - Vector(rings[max(0, j-1)][0])
            direction.normalize()
            u = direction.cross(Vector((0, 1, 0))).normalized()
            v = direction.cross(u).normalized()
            for i in range(sides):
                t = i*math.tau/sides
                # Slight diagonal/branching stripe borders follow the rounded skin, not flat panels.
                wave = .013*math.sin(t*2+j*.9) if striped else 0
                verts.append(p + a*math.cos(t)*u + b*math.sin(t)*v + direction*wave)
        for j in range(len(rings)-1):
            for i in range(sides):
                faces.append((j*sides+i, j*sides+(i+1)%sides, (j+1)*sides+(i+1)%sides, (j+1)*sides+i))
                color = (j % 2) if striped else solid
                # Ragged integrated infection islands; same topology and rest proportions as the base.
                if infected and striped and name in ('barrel', 'neck_skin', 'head_skin') and j in (len(rings)//3, len(rings)*2//3) and i in (sides//4, sides//4+1):
                    color = 2
                colors.append(color)
        # Fan caps keep every surface watertight at every LOD.
        for j, reverse in [(0, True), (len(rings)-1, False)]:
            center = len(verts)
            verts.append(Vector(rings[j][0]))
            for i in range(sides):
                face = (center, j*sides+i, j*sides+(i+1)%sides)
                faces.append(tuple(reversed(face)) if reverse else face)
                colors.append(solid if not striped else j % 2)
        return mesh(name, verts, faces, owner, colors)

    def oval(name, pos, size, owner, color=0, segments=None, rings=None):
        n = segments or [12, 8, 4][lod]
        r = rings or [7, 4, 2][lod]
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
                a = 1+j*n+i; b = 1+j*n+(i+1)%n
                faces.append((a, a+n, b+n, b))
        faces += [(bottom, 1+(r-2)*n+(i+1)%n, 1+(r-2)*n+i) for i in range(n)]
        return mesh(name, verts, faces, owner, [color]*len(faces))

    node('root', (0, 0, 0))
    # Whole-leg translation in the shared paw solver disconnects long articulated cannon bones.
    parts['root']['ss_preserveAnimalJoints'] = True
    node('hip', (-.64, 0, 1.22), 'root')
    node('torso', (0, 0, 1.30), 'hip')
    node('body', (0, 0, 1.30), 'torso')
    node('neck', (.58, 0, 1.47), 'body')
    node('head', (1.04, 0, 1.98), 'neck')
    node('jaw', (1.26, 0, 1.83), 'head')
    node('tail', (-1.02, 0, 1.41), 'body')
    node('packSocket', (-.15, 0, 1.76), 'body')
    node('backpackSocket', (-.15, 0, 1.76), 'torso')
    node('front', (1.58, 0, 1.82), 'head')
    # Rounded horse barrel: fuller shoulder/rump, tucked abdomen, withers above long legs.
    n, sides = [(34, 16), (22, 10), (10, 6)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        x = -1.03 + 1.88*t
        shape = math.sin(math.pi*(.04+.92*t))**.48
        rings.append(((x, 0, 1.37+.025*math.cos(t*math.tau)), .40*shape, .37*shape))
    sweep('barrel', rings, sides, 'body')
    # Sloping strong zebra neck, never the thin vertical tube of a generic horse placeholder.
    n, sides = [(16, 12), (8, 8), (4, 6)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        rings.append(((.56+.42*t, 0, 1.48+.53*t), .31-.12*t, .28-.12*t))
    sweep('neck_skin', rings, sides, 'neck')
    n, sides = [(17, 12), (9, 8), (5, 6)][lod]
    rings = []
    for j in range(n):
        t = j/(n-1)
        shape = .64+.36*math.sin(math.pi*t)
        rings.append(((.93+.67*t, 0, 2.04-.26*t), (.22-.07*t)*shape, (.20-.025*t)*shape))
    sweep('head_skin', rings, sides, 'head')
    oval('soft_muzzle', (1.55, 0, 1.78), (.17, .16, .135), 'jaw', 2 if infected else 1)
    for side, sign in [('L', 1), ('R', -1)]:
        # Front straight cannon bones; rear hock has the characteristic backward bend.
        shoulder = (.59, sign*.235, 1.43); elbow = (.57, sign*.26, .89); hoof = (.61, sign*.27, .115)
        hip = (-.73, sign*.235, 1.40); knee = (-.51, sign*.26, .88); hock = (-.81, sign*.27, .43); rearhoof = (-.73, sign*.27, .115)
        for name, pos, parent in [('arm'+side, shoulder, 'torso'), ('legF'+side, shoulder, 'arm'+side), ('foreArm'+side, elbow, 'legF'+side), ('hand'+side, hoof, 'foreArm'+side), ('pawF'+side, hoof, 'hand'+side), ('leg'+side, hip, 'hip'), ('legB'+side, hip, 'leg'+side), ('shin'+side, knee, 'legB'+side), ('foot'+side, rearhoof, 'shin'+side), ('pawB'+side, rearhoof, 'foot'+side)]:
            node(name, pos, parent)
        n, sides = [(7, 10), (3, 6), (2, 5)][lod]
        for prefix, a, b, owner in [('front', shoulder, elbow, 'legF'+side), ('rear', hip, knee, 'legB'+side)]:
            sweep(prefix+'_upper'+side, [(Vector(a).lerp(Vector(b), j/(n-1)), .17-.075*j/(n-1), .15-.065*j/(n-1)) for j in range(n)], sides, owner)
        n, sides = [(8, 8), (4, 6), (3, 5)][lod]
        for prefix, points, owner in [('front', [elbow, (.59, sign*.27, .43), hoof], 'foreArm'+side), ('rear', [knee, hock, rearhoof], 'shin'+side)]:
            rings = []
            for j in range(n):
                t = j/(n-1)*2; k = min(1, int(t))
                p = Vector(points[k]).lerp(Vector(points[k+1]), t-k)
                rings.append((p, .077-.018*j/(n-1), .070-.014*j/(n-1)))
            sweep(prefix+'_cannon'+side, rings, sides, owner)
        for p, owner in [(hoof, 'pawF'+side), (rearhoof, 'pawB'+side)]:
            oval('hoof_'+owner, (p[0]+.025, p[1], .105), (.14, .108, .105), owner, 1)
        # Long upright oval ears, white rim and black inner tip on the same closed surface.
        n, sides = [(7, 8), (5, 6), (3, 4)][lod]
        ear = []
        for j in range(n):
            t = j/(n-1)
            bulge = math.sin(math.pi*(.06+.90*t))
            ear.append(((.93-.06*t, sign*(.16+.065*t), 2.12+.31*t), .070*bulge, .053*bulge))
        sweep('ear'+side, ear, sides, 'head')
        oval('eye'+side, (1.145, sign*.187, 2.033), (.051, .025, .043), 'head', 3 if infected else 1)
    # A narrow standing mane follows the nape in volume, not a flat fin.
    n, sides = [(15, 8), (7, 6), (4, 4)][lod]
    sweep('mane', [((.35+.49*j/(n-1), 0, 1.69+.47*j/(n-1)), .10-.052*j/(n-1), .05) for j in range(n)], sides, 'neck', False, 1)
    n, sides = [(10, 8), (6, 6), (4, 4)][lod]
    sweep('tail_rope', [((-1.00-.15*math.sin(j/(n-1)*math.pi/2), .045*math.sin(j/(n-1)*math.pi), 1.42-.74*j/(n-1)), .043-.018*j/(n-1), .043-.018*j/(n-1)) for j in range(n)], sides, 'tail', False, 1)
    oval('tail_tuft', (-1.16, 0, .65), (.065, .073, .17), 'tail', 1)
    # Generic infected limb aliases remain compatible with existing stump/part selection.
    # Caps are shared by healthy/infected rigs, hidden until infection + dismemberment.
    for joint in ['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']:
        p = parts[joint].matrix_world.translation
        cap = oval('stump_'+joint, p, (.06, .06, .018), parts[joint].parent.name, 2, segments=4, rings=2)
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
    scene['derivedFrom'] = 'amb.zebra' if infected else 'zebra normal base'
    scene['authoredLod'] = lod
    bpy.context.view_layer.update()
    return parts


def author_poses(parts):
    """Named shared-rig pose clips for the systems lane; timing/effects remain sim-owned."""
    scene = bpy.context.scene
    scene.render.fps = 60
    for clip, frames in [('zebra-rear-kick', [0, 36, 42, 54, 72]),
                         ('zebra-stampede', [0, 48, 56, 64, 72, 80, 88, 96])]:
        for name in ['body', 'head', 'legFL', 'legFR', 'legBL', 'legBR']:
            joint = parts[name]
            rest = joint.location.copy()
            for frame in frames:
                angle = 0
                if clip == 'zebra-rear-kick':
                    if name.startswith('legB'):
                        angle = {36: -.16, 42: 1.30, 54: .85}.get(frame, 0)
                    elif name == 'head':
                        angle = {36: .12, 42: .22, 54: .10}.get(frame, 0)
                elif frame >= 48 and frame < 96 and name.startswith('leg'):
                    phase = (frame-48)/32*math.tau + (0 if name in ('legFL', 'legBR') else math.pi)
                    angle = .48*math.sin(phase)
                joint.rotation_euler = (0, angle, 0)
                joint.location = rest
                joint.keyframe_insert(data_path='rotation_euler', frame=frame)
            action = joint.animation_data.action
            action.name = clip+'__'+name
            track = joint.animation_data.nla_tracks.new()
            track.name = clip
            track.strips.new(clip, 0, action)
            joint.animation_data.action = None
            joint.rotation_euler = (0, 0, 0)
            joint.location = rest
    scene.frame_set(0)


def export_zebra(output, lod=0, infected=False):
    parts = build_zebra(lod, infected)
    author_poses(parts)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_apply=True, export_extras=True, export_cameras=False, export_lights=False, export_vertex_color='ACTIVE', export_all_vertex_colors=True, export_animation_mode='NLA_TRACKS')


if __name__ in ('__main__', '<run_path>'):
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb', required=True)
    parser.add_argument('--quality', default='high')
    parser.add_argument('--lod', type=int, choices=[0, 1, 2], default=0)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    export_zebra(args.glb, args.lod)
