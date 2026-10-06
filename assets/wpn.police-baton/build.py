"""Side-handle polymer nightstick. Deterministic solid geometry, no textures."""
import argparse, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser()
for name in ('render','glb'): p.add_argument('--'+name)
p.add_argument('--view',default='ref')
p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960)
p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['asset_id']='wpn.police-baton'; root['category']='weapon'
m=bpy.data.materials.new('pal_uiDark'); m.use_nodes=True
c=tuple(((v/255+.055)/1.055)**2.4 for v in (37,34,44))+(1,)
m.diffuse_color=c; bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c; bs.inputs['Roughness'].default_value=.48
N=20; Z=.041

def mesh(name,vs,fs):
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.data.materials.append(m); o.parent=root
    return o

def lathe(name,rings,axis='X',offset=-.105):
    vs=[]
    for x,r in rings:
        for i in range(N):
            t=i*2*math.pi/N
            vs.append((x,r*math.cos(t),Z+r*math.sin(t)) if axis=='X' else (offset+r*math.cos(t),-x,Z+r*math.sin(t)))
    fs=[tuple(range(N-1,-1,-1))]
    for j in range(len(rings)-1):
        for i in range(N): fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
    fs.append(tuple((len(rings)-1)*N+i for i in range(N)))
    return mesh(name,vs,fs)
lathe('shaft',[(-.32,.020),(-.317,.028),(-.309,.032),(-.279,.032),(-.273,.027),(-.13,.027),(-.12,.030),(.285,.030),(.304,.028),(.317,.022),(.322,.012),(.324,.001)])
# Thick chamfered ribs rise 4 mm above the grip cores; seams are true recesses.
for i in range(7):
    x=-.272+i*.020
    lathe('mainGripRib',[(x,.027),(x+.003,.032),(x+.014,.032),(x+.017,.027)])
lathe('gripStop',[(-.139,.028),(-.136,.035),(-.124,.035),(-.121,.029)])
lathe('sideHandle',[(.018,.033),(.025,.041),(.042,.041),(.048,.029),(.177,.029),(.184,.036),(.200,.036),(.207,.029),(.210,.020)],'Y')
for i in range(6):
    x=.049+i*.022
    lathe('sideGripRib',[(x,.029),(x+.003,.035),(x+.016,.035),(x+.019,.029)],'Y')
# Eyelet in a vertical plane, attached at the pommel.
bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=8,location=(-.333,0,Z),major_radius=.016,minor_radius=.004,rotation=(math.pi/2,0,0))
e=bpy.context.object; e.name='strapEyelet'; e.data.materials.append(m); e.parent=root
# Flat woven loop represented by a closed, thick ribbon, with a generous open centre.
vs=[]; count=64
for i in range(count):
    t=i*2*math.pi/count
    x=-.421+.083*math.cos(t); y=.041*math.sin(t)
    normal=Vector((math.cos(t)/.083,math.sin(t)/.041,0)).normalized()
    for side,z in [(-1,.008),(1,.008),(1,.019),(-1,.019)]:
        vs.append((x+side*.0055*normal.x,y+side*.0055*normal.y,z))
fs=[]
for i in range(count):
    for j in range(4):fs.append((i*4+j,((i+1)%count)*4+j,((i+1)%count)*4+(j+1)%4,i*4+(j+1)%4))
mesh('wristStrap',vs,fs)
# Join static parts into one draw call, leaving attachment nodes intact.
bpy.ops.object.select_all(action='DESELECT')
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); body=bpy.context.object; body.name='body'; objects=[body]
for name,loc in [('grip',(-.21,0,Z)),('tip',(.324,0,Z))]:
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=root; o.location=loc
# Centre the complete silhouette in X/Y, keeping its lowest point on z=0.
lo=Vector(tuple(min(v.co[i] for v in body.data.vertices) for i in range(3)))
hi=Vector(tuple(max(v.co[i] for v in body.data.vertices) for i in range(3)))
shift=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
for v in body.data.vertices:v.co+=shift
for name in ('grip','tip'):bpy.data.objects[name].location+=shift
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.render.bake.target='VERTEX_COLORS'
c=body.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); body.data.color_attributes.active_color=c
bpy.ops.object.bake(type='AO')
tri=sum(len(f.vertices)-2 for f in body.data.polygons)
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.render:
    scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.045,.065,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    target=Vector((-.075,-.055,Z))+shift
    for name,loc,power,color in [('key',(.5,-1.2,1.8),85,(1,.73,.43)),('fill',(-.8,-.4,.6),35,(.67,.55,1)),('rim',(.5,1,.8),65,(1,.65,.30))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=1.2; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam)
    direction={'ref':(0,-2,2.5),'game':(1.7,-1.7,2.3),'front':(2,0,0),'rear':(-2,0,0),'side':(0,-2,.6)}[a.view]
    cam.location=target+Vector(direction); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    if a.view=='ref': cam.rotation_euler.rotate_axis('Z',math.radians(-43))
    cam.data.type='ORTHO'; cam.data.ortho_scale=1.45 if a.view=='ref' else 1.08; scene.camera=cam
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve()); Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=target+Vector((1.7,-1.7,2.3)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=1.08
        scene.render.resolution_x=960; scene.render.resolution_y=540; scene.cycles.samples=24
        companion='game.png' if Path(a.render).stem=='hero' else Path(a.render).stem.replace('-ref','')+'-game.png'
        scene.render.filepath=str(Path(a.render).resolve().with_name(companion))
        bpy.ops.render.render(write_still=True)
print('OK baton triangles',tri)
