"""Nail bat with faceted wood, seven grip wraps, and blunt radial nails.
All markings are solid relief, merged by palette; no textures or decals.
"""
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
root['asset_id']='wpn.nail-bat'; root['category']='weapon'

def mat(token,h):
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
    m.diffuse_color=c; bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c; bs.inputs['Roughness'].default_value=.78
    return m
wood=mat('woodWarm','b0703f'); dark=mat('uiDark','25222c'); grain=mat('brick','a8483a')
metal=mat('asphalt','5b4f5c'); metal.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.65
metal.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.48
N=16; Z=.15
profile=[(-.50,.026),(-.495,.043),(-.485,.047),(-.462,.047),(-.451,.036),(-.447,.022),(-.16,.032),(-.10,.037),(0,.046),(.14,.059),(.30,.071),(.43,.076),(.47,.073),(.488,.061),(.50,.040),(.504,.012)]

def lathe(name, rings, material):
    vs=[(x,math.cos(i*2*math.pi/N)*r,Z+math.sin(i*2*math.pi/N)*r) for x,r in rings for i in range(N)]
    fs=[tuple(range(N-1,-1,-1))]
    for j in range(len(rings)-1):
        for i in range(N): fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
    fs.append(tuple((len(rings)-1)*N+i for i in range(N)))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vs,[],fs); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); o.data.materials.append(material); o.parent=root
    return o
lathe('body',profile,wood)
# Tape sections have chamfered edges and recessed wood seams, like the reference.
for i in range(7):
    x=-.443+i*.040
    r=.028+(i/6)*.007
    lathe('tape',[(x,r-.003),(x+.003,r),(x+.031,r),(x+.036,r-.003)],dark)

def radius(x):
    for (u,r),(v,s) in zip(profile,profile[1:]):
        if u<=x<=v: return r+(s-r)*(x-u)/(v-u)
    return .03
# Closed diamond-shaped relief grain. Faces clear the underlying facets by 3 mm.
def mark(x,theta,length,width,material):
    ring=[]
    for dx,dt in [(-length/2,0),(-length*.18,-width),(length*.22,-width*.35),(length/2,0),(length*.1,width),(-length*.25,width*.4)]:
        xx=x+dx; t=theta+dt; rr=radius(xx)+.0032
        ring.append((xx,math.cos(t)*rr,Z+math.sin(t)*rr))
    count=len(ring)
    vs=ring+[(xx,y*.90,Z+(z-Z)*.90) for xx,y,z in ring]
    fs=[tuple(range(count)),tuple(range(2*count-1,count-1,-1))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    fs=[tuple(reversed(f)) for f in fs]  # outward normals on the cylindrical relief
    me=bpy.data.meshes.new('grain'); me.from_pydata(vs,[],fs); me.update()
    o=bpy.data.objects.new('grain',me); bpy.context.collection.objects.link(o); o.data.materials.append(material); o.parent=root
for t in [0,.8,1.7,2.6,3.4,4.3,5.2]:
    for j in range(2):
        mark(-.015+j*.25+.035*math.sin(t*3+j),t+.22*math.sin(t+j),.18+.035*j,.055,grain)
for x,t in [(.36,5.2),(.18,4.9),(-.02,5.4),(.26,1.4),(.08,.4),(-.10,5.2),(-.085,4.3)]: mark(x,t,.032,.14,dark)
# Radial nails: dark embedded collars, steel shafts, chamfered circular heads.
def nail_part(name, origin, direction, rings, material, sides=8):
    d=Vector(direction).normalized()
    u=d.cross(Vector((1,0,0))).normalized(); v=d.cross(u)
    verts=[Vector(origin)+d*h+r*(u*math.cos(i*2*math.pi/sides)+v*math.sin(i*2*math.pi/sides)) for h,r in rings for i in range(sides)]
    faces=[tuple(range(sides-1,-1,-1))]
    for j in range(len(rings)-1):
        for i in range(sides): faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.parent=root; o.data.materials.append(material)
for row,x in enumerate([-.035,.065,.17,.275,.38,.46]):
    for k in range(5):
        t=k*2*math.pi/5+row*.43
        origin=(x,math.cos(t)*(radius(x)-.004),Z+math.sin(t)*(radius(x)-.004))
        direction=(.12*math.sin(row+k),math.cos(t),math.sin(t))
        length=.052+.014*((row+k)%3)
        nail_part('nailCollar',origin,direction,[(0,.014),(.006,.017),(.011,.014)],dark)
        nail_part('nailShaft',origin,direction,[(.006,.007),(length,.007)],metal)
        nail_part('nailHead',origin,direction,[(length-.003,.012),(length,.016),(length+.010,.016),(length+.013,.012)],metal)
# Merge every static part by material, preserving melee attachment nodes.
objects=[]
for m in (wood,dark,grain,metal):
    group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join()
    o=group[0]; o.name={'pal_woodWarm':'body','pal_uiDark':'gripTape','pal_brick':'woodGrain','pal_asphalt':'nails'}[m.name]; objects.append(o)
# Ground the entire rigid weapon, including downward-facing nails.
low=min(v.co.z for o in objects for v in o.data.vertices)
for o in objects:
    for vertex in o.data.vertices: vertex.co.z-=low
Z-=low
for name,x in [('grip',-.30),('tip',.504)]:
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=root; o.location=(x,0,Z)
# AO is stored as vertex colors for the runtime palette material.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.render.bake.target='VERTEX_COLORS'
for o in objects:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    c=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=c
    bpy.ops.object.bake(type='AO')
tri=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.render:
    scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.045,.065,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    target=Vector((0,0,Z))
    for name,loc,power,color in [('key',(.5,-1.2,1.8),85,(1,.73,.43)),('fill',(-.8,-.4,.6),35,(.67,.55,1)),('rim',(.5,1,.8),65,(1,.65,.30))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=1.2; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam)
    direction={'ref':(0,-2,1.5),'game':(1.7,-1.7,2.3),'front':(2,0,0),'rear':(-2,0,0),'side':(0,-2,.6)}[a.view]
    cam.location=target+Vector(direction); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    if a.view=='ref': cam.rotation_euler.rotate_axis('Z',math.radians(-57))
    cam.data.type='ORTHO'; cam.data.ortho_scale=1.95 if a.view=='ref' else 1.3; scene.camera=cam
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve()); Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=target+Vector((1.7,-1.7,2.3)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=1.3
        scene.render.resolution_x=960; scene.render.resolution_y=540; scene.cycles.samples=24
        companion='game.png' if Path(a.render).stem=='hero' else Path(a.render).stem.replace('-ref','')+'-game.png'
        scene.render.filepath=str(Path(a.render).resolve().with_name(companion))
        bpy.ops.render.render(write_still=True)
print('OK bat triangles',tri)
