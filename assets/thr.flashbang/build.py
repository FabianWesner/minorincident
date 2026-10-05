"""Flashbang: faceted perforated canister and separate safety hardware. Metres, +X forward."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
for flag in ('render', 'glb'):
    parser.add_argument('--' + flag)
parser.add_argument('--view', default='ref')
for flag, default in (('samples', 24), ('width', 960), ('height', 540)):
    parser.add_argument('--' + flag, type=int, default=default)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'

def material(token, color, metallic=0):
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgb = [v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    m = bpy.data.materials.new('pal_' + token)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*rgb, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = .43
    return m

pale = material('sidewalk', 'b9a4c0', .3)
dark = material('uiDark', '25222c', .45)
blue = material('policeBlue', '2f6bff', .35)
gold = material('schoolBusYellow', 'f2b630', .65)
steel = material('picketWhite', 'f2e6dc', .7)
materials = [pale, dark, blue, gold, steel]

def finish(obj, mat, bevel=0):
    obj.data.materials.append(mat)
    if bevel:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('edge chamfer', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def mesh(name, vertices, faces, mat, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, mat, bevel)

def profile(name, rings, mat, sides=24):
    vertices = [(r*math.cos(i*math.tau/sides), r*math.sin(i*math.tau/sides), z)
                for z, r in rings for i in range(sides)]
    faces = [(k*sides+i, k*sides+(i+1)%sides, (k+1)*sides+(i+1)%sides, (k+1)*sides+i)
             for k in range(len(rings)-1) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple((len(rings)-1)*sides+i for i in range(sides))]
    return mesh(name, vertices, faces, mat)

def cylinder(name, loc, radius, depth, mat, axis=(0,0,1), sides=16, bevel=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(obj, mat, bevel)

def box(name, loc, size, mat, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)

# Build the perforated sleeve directly: each vent has a square outer patch,
# circular chamfer and deep well. This avoids boolean slivers and keeps topology small.
vertices, faces = [], []
for z in (.090, .162):
    for cell in range(8):
        center = math.tau*cell/8
        base = len(vertices)
        for layer in range(4):
            for j in range(16):
                t = math.tau*j/16
                u, v = math.cos(t), math.sin(t)
                if layer == 0:
                    scale = max(abs(u),abs(v))
                    angle = center + u/scale*math.pi/8
                    height = z + v/scale*.034
                    radius = .068
                else:
                    hole_radius = .023 if layer == 1 else .0205
                    angle = center + u*hole_radius/.068
                    height = z + v*hole_radius
                    radius = (.068, .065, .053)[layer-1]
                vertices.append((radius*math.cos(angle),radius*math.sin(angle),height))
        for layer in range(3):
            for j in range(16):
                faces.append((base+layer*16+j,base+layer*16+(j+1)%16,
                              base+(layer+1)*16+(j+1)%16,base+(layer+1)*16+j))
body = mesh('body',vertices,faces,pale)
# Match bridge vertices exactly to the top/bottom edges of the vent patches.
angles = [cell*math.tau/8 + offset*math.pi/8 for cell in range(8)
          for offset in (-1, -(math.sqrt(2)-1), 0, math.sqrt(2)-1)]
for low,high in ((.033,.056),(.124,.128),(.196,.200)):
    verts = [(.068*math.cos(t),.068*math.sin(t),z) for z in (low,high) for t in angles]
    count = len(angles)
    sides = [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh('sleeve_bridge',verts,sides,pale)
profile('inner_canister',[(.027,.055),(.203,.055)],dark)
# Distinct full-width bands and rims: no overlapping coplanar decoration.
for base in (.0,):
    profile('end_cap',[(base,.061),(base+.004,.069),(base+.017,.071),(base+.020,.069)],dark)
    profile('gold_rim',[(base+.017,.069),(base+.020,.074),(base+.023,.074),(base+.026,.070)],gold)
    profile('blue_band',[(base+.025,.070),(base+.029,.073),(base+.050,.073),(base+.053,.070)],blue)
    profile('band_lip',[(base+.050,.070),(base+.053,.074),(base+.056,.074),(base+.059,.068)],gold)
profile('top_band',[(.200,.068),(.204,.073),(.228,.073),(.231,.070)],blue)
profile('top_lower_rim',[(.197,.068),(.200,.074),(.204,.074),(.207,.070)],gold)
profile('top_upper_rim',[(.228,.070),(.231,.074),(.235,.074),(.238,.068)],gold)
profile('top_cap',[(.236,.068),(.240,.071),(.255,.068),(.261,.055)],dark)
# Upper collar and stepped fuse block.
profile('fuse_collar',[(.261,.047),(.266,.052),(.279,.046),(.282,.039)],dark)
box('fuse_head',(0,0,.305),(.065,.059,.048),dark,.004)
box('fuse_top',(-.006,0,.333),(.077,.065,.013),gold,.002)
cylinder('hinge',(-.032,0,.327),.010,.079,dark,(0,1,0),12,.0015)
for y in (-.043,.043):
    cylinder('hinge_cap',(-.032,y,.327),.009,.008,gold,(0,1,0),12,.001)
cylinder('retaining_pin',(.015,-.037,.319),.007,.019,steel,(0,1,0),12,.001)
# Spoon runs down the +X side; extruded dog-leg outline keeps a strong silhouette.
outline = [(-.036,.342),(.043,.342),(.048,.307),(.080,.267),(.093,.223),(.093,.064),(.080,.060),(.075,.071),(.078,.221),(.064,.255),(.031,.296),(.027,.328),(-.036,.328)]
vertices = [(x,y,z) for y in (-.012,.012) for x,z in outline]
n = len(outline)
faces = [tuple(reversed(range(n))),tuple(range(n,2*n))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
lever = mesh('safetyLever',vertices,faces,dark,.002)
# A warm exposed edge inset into the lever's outer flank.
edge = box('lever_edge',(.095,0,.147),(.007,.028,.165),gold,.002)
bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=8,location=(.077,-.045,.305),major_radius=.043,minor_radius=.0045,rotation=(math.pi/2,0,0))
ring = bpy.context.object
ring.name = 'pullRing'
ring.scale.z = 1.18
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
finish(ring,gold)
ring.data.materials.append(steel)
for poly in ring.data.polygons:
    # Torus minor-segment order: the front-facing inner quarter is pale steel.
    if poly.index % 8 in (2,3):
        poly.material_index = 1
box('ring_eyelet',(.048,-.045,.343),(.017,.014,.021),steel,.002)

root = bpy.data.objects.new('root',None)
bpy.context.collection.objects.link(root)
root['asset_id'] = 'thr.flashbang'
root['ss_physics'] = {'class':'light','mass':.35,'friction':.6,'restitution':.15,'centerOfMass':[0,.17,0],'pushable':True,'kickable':True,'flammable':False}
# Join the lever trim into the animated spoon before setting its hinge origin.
bpy.ops.object.select_all(action='DESELECT')
lever.select_set(True)
edge.select_set(True)
bpy.context.view_layer.objects.active = lever
bpy.ops.object.join()
for obj,pivot in ((lever,(-.032,0,.327)),(ring,(.048,-.045,.343))):
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    obj.parent = root
for mat in materials:
    objects = [o for o in bpy.context.scene.objects if o.type=='MESH' and o not in (lever,ring) and o.data.materials[0]==mat]
    if not objects:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'body' if mat==pale else 'static_'+mat.name
    obj.parent = root
for name,loc in (('grip',(0,0,.12)),('front',(.093,0,.15)),('col:body',(0,0,.17))):
    obj = bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.parent = root
    if name.startswith('col:'):
        obj['collider']='cylinder'
        obj['shape']='cylinder'
        obj['radius']=.074
        obj['halfHeight']=.17

meshes = [o for o in bpy.context.scene.objects if o.type=='MESH']
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.seed = 0
scene.render.bake.target = 'VERTEX_COLORS'
for obj in meshes:
    attr = obj.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
    obj.data.color_attributes.active_color = attr
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='AO')
triangles = sum(len(poly.vertices)-2 for obj in meshes for poly in obj.data.polygons)
draw_calls = sum(len({poly.material_index for poly in obj.data.polygons}) for obj in meshes)
report = dict(id='thr.flashbang',tier='Side',triangles=triangles,draw_calls=draw_calls,materials=[m.name for m in materials],nodes_ok=all(bpy.data.objects.get(n) is not None for n in ('root','body','grip','front','safetyLever','pullRing')),within_budget=triangles<=6000 and draw_calls<=30)
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if args.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(args.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if args.render:
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.world.color = (.13,.13,.13)
    stage = material('stage','2a2730')
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001))
    bpy.context.object.data.materials.append(stage)
    target = Vector((.009,0,.171))
    def aim(obj):
        obj.rotation_euler = (target-obj.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in (((.5,-.5,.8),22,.5,(1,.80,.57)),((-.4,-.2,.5),12,.4,(.62,.65,1)),((.3,.4,.6),26,.4,(1,.65,.3))):
        bpy.ops.object.light_add(type='AREA',location=loc)
        obj=bpy.context.object
        obj.data.energy=power
        obj.data.size=size
        obj.data.color=color
        aim(obj)
    views = {'ref':(.48,-.8,.45),'game':(.6,-.6,.85),'front':(.8,0,.3),'side':(0,-.8,.3),'rear':(-.5,.6,.45)}
    bpy.ops.object.camera_add(location=views[args.view])
    camera=bpy.context.object
    aim(camera)
    if args.view == 'ref':
        camera.rotation_euler.rotate_axis('Z', -.12)
    camera.data.type='ORTHO'
    camera.data.ortho_scale=.65
    scene.camera=camera
    scene.view_settings.view_transform='AgX'
    scene.view_settings.exposure=-.65
    scene.render.resolution_x=args.width
    scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    if args.view == 'ref':
        camera.location = views['game']
        aim(camera)
        scene.cycles.samples = 24
        scene.render.resolution_x = 960
        scene.render.resolution_y = 540
        game_name = 'game.png' if Path(args.render).name == 'hero.png' else Path(args.render).stem.replace('-ref', '-game') + '.png'
        scene.render.filepath = str(HERE/'renders'/game_name)
        bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
