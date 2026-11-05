"""Deterministic twelve-facet cone; closed cap, molded foot, raised reflective sleeve."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
ASSET = {'id': 'prop.traffic-cone', 'category': 'prop'}

def material(token, color, roughness):
    m = bpy.data.materials.new('pal_' + token)
    m.use_nodes = True
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in rgb]
    m.diffuse_color = (*linear, 1)
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return m

def profile_mesh(name, profile, mat, subdivisions=8):
    # Subdivide each flat panel without rounding away the reference's twelve facets.
    verts, faces = [], []
    n = 12 * subdivisions
    for z, r in profile:
        for i in range(n):
            facet, t = divmod(i, subdivisions)
            t /= subdivisions
            a, b = facet * math.tau / 12, (facet + 1) * math.tau / 12
            verts.append((r * ((1-t)*math.cos(a)+t*math.cos(b)),
                          r * ((1-t)*math.sin(a)+t*math.sin(b)), z))
    for j in range(len(profile)-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    faces += [tuple(reversed(range(n))), tuple((len(profile)-1)*n+i for i in range(n))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj

def empty(name, parent, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj

def build():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    orange = material('schoolBusYellow', 'ff6614', .65)
    white = material('picketWhite', 'f2e6dc', .58)
    root = empty('root', None)
    root['asset_id'] = ASSET['id']
    root['ss_physics'] = {'class': 'light', 'mass': 3.5, 'friction': .75,
        'restitution': .18, 'centerOfMass': [0, .13, 0], 'pushable': True,
        'kickable': True, 'barricadeValue': .1, 'barricadeHP': 25,
        'vaultable': True, 'flammable': False, 'explosive': None,
        'sounds': 'prop.plastic-light'}
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, .033))
    base = bpy.context.object
    base.name = 'base'
    base.dimensions = (.48, .48, .066)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    base.data.materials.append(orange)
    bevel = base.modifiers.new('molded rounded edges', 'BEVEL')
    bevel.width, bevel.segments = .010, 4
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normal = base.modifiers.new('weighted corner normals', 'WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=normal.name)
    foot = profile_mesh('molded foot', [(.062,.163),(.068,.17),(.089,.17),(.10,.158)], orange)
    def radius(z):
        return .155 + (z-.099) * (.041-.155) / (.638-.099)
    profile = [(.095,.151),(.099,.155)]
    profile += [(z, radius(z)) for z in [.105+i*(.638-.105)/22 for i in range(23)]]
    profile += [(.644,.037),(.646,.033)]
    shell = profile_mesh('cone', profile, orange)
    # Raised by 4 mm normal to each panel; sleeve ends have solid orange-free lips.
    band_profile = [(.294, radius(.294)+.0042),(.297, radius(.297)+.0046)]
    band_profile += [(z, radius(z)+.0046) for z in [.300+i*.177/7 for i in range(8)]]
    band_profile += [(.480,radius(.480)+.0042)]
    band = profile_mesh('reflectiveBand', band_profile, white)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in (base, foot, shell):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = shell
    bpy.ops.object.join()
    shell.name = 'body'
    bpy.context.scene.cursor.location = (0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    for obj in (shell, band):
        obj.parent = root
    for name, loc, size in [('base',(0,0,.033),(.48,.066,.48)),
                             ('cone',(0,0,.356),(.31,.58,.31))]:
        col = empty('col:'+name, root, loc)
        col['collider'] = 'cuboid'
        col['shape'] = 'cuboid'
        col['size'] = list(size)
    # Deterministic Cycles AO bake, exported as a vertex color attribute.
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.seed = 0
    scene.render.bake.target = 'VERTEX_COLORS'
    for obj in (shell,band):
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        attr = obj.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
        obj.data.color_attributes.active_color = attr
        bpy.ops.object.bake(type='AO')
    return root, (shell, band)

def render(args):
    scene = bpy.context.scene
    floor = material('asphalt', '2a2730', .9)
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.data.materials.append(floor)
    bpy.context.object.location.z = -.001
    target = Vector((0,0,.31))
    views = {'ref':(1.5,-1.5,1.05), 'game':(1.5,-1.5,2.3),
             'front':(2,0,.65), 'rear':(-2,0,.65), 'side':(0,-2,.65)}
    bpy.ops.object.camera_add(location=views[args.view])
    camera = bpy.context.object
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.55 if args.view != 'game' else 1.6
    scene.camera = camera
    for loc, power, size, color in [((-1,-2,3),70,2,(1,.82,.66)),
                                   ((2,0,2),50,1.8,(1,.90,.75)),
                                   ((-1,2,2),65,2,(.85,.90,1))]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.size, lamp.data.color = power,size,color
        lamp.rotation_euler = (target-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene.world.color = (.08,.08,.08)
    scene.cycles.samples = args.samples
    scene.render.resolution_x, scene.render.resolution_y = args.width,args.height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = args.render
    Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--render')
    parser.add_argument('--view', choices=['ref','game','front','side','rear'], default='ref')
    parser.add_argument('--samples',type=int,default=24)
    parser.add_argument('--width',type=int,default=960)
    parser.add_argument('--height',type=int,default=540)
    parser.add_argument('--glb')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    root, meshes = build()
    if args.glb:
        bpy.ops.export_scene.gltf(filepath=args.glb,export_format='GLB',export_apply=True,
            export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    for obj in meshes:
        obj.data.calc_loop_triangles()
    stats = {'triangles':sum(len(o.data.loop_triangles) for o in meshes),
             'draw_calls':2,'materials':[o.data.materials[0].name for o in meshes]}
    (OUT/'build-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    if args.render:
        render(args)
    print('OK',json.dumps(stats))

if __name__ == '__main__':
    main()
