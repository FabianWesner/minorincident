"""Five-row aluminium sports bleachers; +X faces the field, Z up, metres."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette
from sslib.ao import bake_all
parser = argparse.ArgumentParser()
for name in ('render', 'glb'): parser.add_argument('--' + name)
parser.add_argument('--view', default='ref', choices=['ref','game','front','side','rear'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials = {t: palette.mat(t) for t in ('silver','hairSilver','denim','brass')}
for t, m in materials.items():
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value=.65 if t != 'denim' else .45
    bsdf.inputs['Roughness'].default_value=.38
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['asset_id']='kit.bleachers'; root['category']='building'
parts=[]
def box(name, loc, size, token='silver', bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object; obj.name=name; obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(materials[token])
    if bevel:
        mod=obj.modifiers.new('rounded aluminium edges','BEVEL');mod.width=bevel;mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(obj);return obj

def beam(name, start, end, width=.07, token='hairSilver'):
    delta=Vector(end)-Vector(start)
    obj=box(name,(Vector(start)+Vector(end))/2,(width,width,delta.length),token,.008)
    obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return obj

def bolt(loc, axis='X'):
    rotation=(0,math.pi/2,0) if axis=='X' else (math.pi/2,0,0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.021,depth=.014,location=loc,rotation=rotation)
    obj=bpy.context.object;obj.name='hex fastener';obj.data.materials.append(materials['brass']);parts.append(obj)
# 5.8 m wide, 3.35 m deep. Bench fronts face +X.
rows=[(1.36-i*.65,.48+i*.36) for i in range(5)]
for i,(x,z) in enumerate(rows):
    # Two extrusions with an actual 8 mm drainage seam, rather than surface stripes.
    for dx in [-.119,.119]:box('seat extrusion',(x+dx,0,z),(.23,5.8,.095),'silver',.014)
    for y in [-2.9,2.9]:
        box('seat end cap',(x,y,z),(.476,.036,.10),'hairSilver',.007)
        bolt((x+.245,y,z))
    box('centre seat retaining plate',(x+.252,0,z),(.028,.16,.074),'hairSilver',.006)
    bolt((x+.278,0,z))
    # A lower, wider footboard immediately in front of every elevated bench.
    if i:
        for dx in [-.10,.10]:box('footboard extrusion',(x+.36+dx,0,z-.265),(.192,5.7,.07),'silver',.009)
    for y in [-2.65,0,2.65]:
        box('seat saddle',(x,y,z-.092),(.53,.16,.09),'denim',.012)
        box('vertical support',(x,y,(z-.14+.10)/2),(.095,.095,z-.24),'hairSilver',.012)
        box('frame joint',(x,y,.24),(.16,.17,.15),'hairSilver',.009)
        bolt((x+.089,y,.24))
        beam('seat cantilever',(x+.22,y,z-.16),(x-.17,y,z-.16),.09)
# Three continuous base runners and feet, with diagonal undercarriage trusses.
for y in [-2.65,0,2.65]:
    box('base runner',(0,y,.16),(3.55,.105,.12),'denim',.014)
    for x in [1.5,-1.5]:box('ground shoe',(x,y,.045),(.24,.24,.09),'hairSilver',.012)
    for i in range(4):
        x,z=rows[i];nx,nz=rows[i+1]
        beam('rising stringer',(x+.1,y,z-.20),(nx-.15,y,nz-.20),.095)
    beam('rear diagonal',(1.25,y,.25),(-1.35,y,1.66),.065)
for x in [1.36,-1.24]:beam('cross tie',(x,-2.7,.23),(x,2.7,.23),.09,'denim')
# Side guards: sloping handrail and spaced vertical balusters.
for y in [-3.02,3.02]:
    for x,z in [(1.62,1.40),(-1.53,2.99)]:
        box('guard foot',(x,y,.045),(.23,.23,.09),'hairSilver',.012)
        beam('guard end post',(x,y,.09),(x,y,z),.105)
    beam('side handrail',(1.67,y,1.44),(-1.56,y,3.04),.115,'silver')
    beam('side lower rail',(1.63,y,.17),(-1.53,y,.17),.08)
    for j in range(1,10):
        x=1.62-j*3.15/10; top=1.44+(1.62-x)*1.60/3.23
        beam('side baluster',(x,y,.23),(x,y,top-.06),.048)
    for x,z in rows:
        box('side row bracket',(x,y,z-.15),(.19,.135,.13),'hairSilver',.008)
        bolt((x,y+(.076 if y>0 else -.076),z-.15),'Y')
    beam('side diagonal A',(.9,y,.24),(-.35,y,1.08),.06)
    beam('side diagonal B',(-1.40,y,.24),(-.35,y,1.08),.06)
# Rear fall protection, no solid backing: open silhouette matches reference.
beam('rear handrail',(-1.53,-3.03,3.04),(-1.53,3.03,3.04),.115,'silver')
beam('rear lower guard',(-1.53,-3.02,1.76),(-1.53,3.02,1.76),.075)
for j in range(17):
    y=-2.83+j*5.66/16
    beam('rear baluster',(-1.53,y,1.79),(-1.53,y,2.98),.05)
for y in [-3.02,0,3.02]:
    if y==0:beam('rear central post',(-1.53,y,.10),(-1.53,y,3.04),.095)
    box('handrail splice',(-1.53,y,3.04),(.13,.17,.13),'hairSilver',.009)
    bolt((-1.456,y,3.04))
# Merge static geometry by material; bleachers have no movable joints.
meshes=[]
buckets={token:[o for o in parts if o.data.materials[0]==mat] for token,mat in materials.items()}
for token, subset in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in subset:o.select_set(True)
    bpy.context.view_layer.objects.active=subset[0];bpy.ops.object.join()
    obj=subset[0];obj.name='frame_'+token;obj.parent=root;meshes.append(obj)
bake_all(meshes,samples=32)
for obj in meshes:obj.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in meshes)
(HERE/'metrics.json').write_text(json.dumps({'triangles':triangles,'draw_calls':len(meshes),'materials':[m.name for m in materials.values()]},indent=2))
if args.glb:
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in meshes:o.select_set(True)
    def export(path):
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    export(args.glb)
    # Regenerate both lower density versions from this build, retaining guard silhouettes.
    for level,ratio in [(1,.55),(2,.30)]:
        mods=[]
        for o in meshes:
            m=o.modifiers.new('LOD simplification','DECIMATE');m.ratio=ratio;mods.append((o,m))
        export(HERE/f'model.lod{level}.glb')
        for o,m in mods:o.modifiers.remove(m)
if args.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.world.color=(.20,.20,.20)
    materials['uiDark']=palette.mat('uiDark')
    box('studio floor',(0,0,-.065),(200,200,.1),'uiDark',0)
    for loc,power,size,color in [((5,-4,9),1400,7,(1,.80,.63)),((-5,-2,6),1050,6,(.68,.74,1)),((-2,7,8),1700,5,(1,.69,.44))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color
        o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,1.4))
    cam.location={'ref':(9,11,8),'game':(10,-10,13),'front':(12,0,4),'side':(0,-12,4),'rear':(-10,8,6)}[args.view]
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=13.0 if args.view=='game' else 11.5;scene.camera=cam
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=args.render
    bpy.ops.render.render(write_still=True)
    if args.view=='ref':
        cam.location=(10,-10,13);cam.data.ortho_scale=13.0
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x=960;scene.render.resolution_y=540;scene.cycles.samples=24
        scene.render.filepath=str(Path(args.render).with_name(Path(args.render).name.replace('ref','game') if 'ref' in Path(args.render).name else 'game.png'))
        bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(meshes),'draw calls')
