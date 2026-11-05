# Identity: yellow rounded bus body; short chunky hood; repeated dark windows;
# two bold black stripes; oversized wheels; red octagonal stop paddle.
# Simplified parts: body/roof/hood, windows, stripes, grille/bumper,
# four wheels with plain hubs, paired warning lamps, headlights, stop paddle.
# Dropped: bolts, hinges, wipers, tread, lug nuts, panel seams, text, fine trim.
import bpy, math, sys, argparse, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--render');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=16);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540);p.add_argument('--glb');p.add_argument('--blend');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def mat(t,h,em=False):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+t);m.diffuse_color=(*tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4)),1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=m.diffuse_color;n.inputs['Roughness'].default_value=.78;n.inputs['Metallic'].default_value=0
 if em:n.inputs['Emission Color'].default_value=m.diffuse_color;n.inputs['Emission Strength'].default_value=3
 M[t]=m;return m
mat('schoolBusYellow','f2b630');mat('uiDark','25222c');mat('glassDark','343448');mat('sidewalk','b9a4a0');mat('picketWhite','f2e6dc');mat('survivorRed','d9363e');mat('windowGlow','ffc773',True);mat('sirenRed','ff2d2d',True)
static=[]
def box(n,loc,size,t,b=0,keep=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[t])
 if b:
  mod=o.modifiers.new('soft toy corners','BEVEL');mod.width=b;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 if not keep:static.append(o)
 return o
def cyl(n,loc,r,depth,t,sides=12,keep=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=n;o.data.materials.append(M[t]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not keep:static.append(o)
 return o
box('body',(-.65,0,1.6),(6.9,2.55,1.3),'schoolBusYellow',.16)
box('upper_cabin',(-.65,0,2.9),(6.9,2.55,1.55),'schoolBusYellow',.19)
box('round_roof',(-.65,0,3.67),(7,2.65,.4),'schoolBusYellow',.19)
box('hood',(3.48,0,1.83),(1.62,2.24,1.02),'schoolBusYellow',.2)
box('front_bumper',(4.35,0,.98),(.3,2.85,.38),'uiDark',.08)
box('rear_bumper',(-4.18,0,.99),(.28,2.8,.33),'uiDark',.06)
# Large window panels and stout yellow mullions.
for side in [-1,1]:
 for i,x in enumerate([-3.46,-2.3,-1.14,.02,1.18]):box('side_window',(x,side*1.284,2.95),(.98,.055,.94),'glassDark',.07)
 for z in [2.25,1.36]:box('black_stripe',(-.65,side*1.287,z),(6.75,.065,.16),'uiDark',.025)
 box('cab_side_window',(2.3,side*1.284,2.96),(.71,.06,.97),'glassDark',.06)
 # Broad fender shoulders read as toy wheel housings.
 for x in [3.15,-2.7]:box('fender',(x,side*1.23,1.33),(1.85,.38,.29),'schoolBusYellow',.12)
for y in [-.64,.64]:box('windshield',(2.822,y,2.98),(.065,1.12,1.02),'glassDark',.075)
box('grille',(4.305,0,1.76),(.06,1.25,.7),'uiDark',.055)
for z in [1.55,1.76,1.97]:box('grille_bar',(4.35,0,z),(.065,1.08,.075),'sidewalk')
for y in [-.91,.91]:box('lightsFront',(4.30,y,1.72),(.11,.35,.42),'windowGlow',.05)
for y in [-1.04,-.69,.69,1.04]:
 o=cyl('warning_lamp',(2.84,y,3.56),.125,.08,'sirenRed');o.rotation_euler=(0,math.pi/2,0)
for y in [-.95,.95]:box('lightsBrake',(-4.12,y,1.68),(.07,.29,.42),'sirenRed',.035)
# Plain solid low-sided tyres; pivots remain at wheel centers.
for x,ax in [(3.1,'front'),(-2.7,'rear')]:
 for sy,side in [(-1,'left'),(1,'right')]:
  w=cyl('wheel_'+ax+'_'+side,(x,sy*1.31,.72),.72,.48,'uiDark',16,True)
  hub=cyl('hub',(x,sy*1.56,.72),.34,.055,'sidewalk',12,True)
  bpy.ops.object.select_all(action='DESELECT');w.select_set(True);hub.select_set(True);bpy.context.view_layer.objects.active=w;bpy.ops.object.join()
# Stop paddle has an octagonal cream edge, red inset, and hinge pivot.
edge=cyl('door_stop_paddle',(.9,-1.47,1.89),.48,.12,'picketWhite',8,True)
face=cyl('stop_face',(.9,-1.54,1.89),.415,.035,'survivorRed',8,True)
bpy.ops.object.select_all(action='DESELECT');edge.select_set(True);face.select_set(True);bpy.context.view_layer.objects.active=edge;bpy.ops.object.join();bpy.context.scene.cursor.location=(1.38,-1.42,1.89);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
# Static geometry joined by palette; animated wheels and stop paddle stay separate.
groups={m:[o for o in static if o.data.materials[0]==m] for m in M.values()}
for m,group in groups.items():
 if group:
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='body' if m==M['schoolBusYellow'] else 'static_'+m.name
assets=[o for o in bpy.context.scene.objects if o.type=='MESH']
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
for o in assets:o.parent=root
for name,loc in [('driverSeat',(2,-.65,2)),('exitL',(2,-1.6,.1)),('exitR',(2,1.6,.1))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in assets)
print('OK triangles',tris,'meshes',len(assets))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Presentation stage is excluded from the GLB.
box('stage',(0,0,-.15),(200,200,.3),'asphalt' if 'asphalt' in M else 'sidewalk')
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.2,.32,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('key',(0,-7,12),1800,7,(1,.82,.59)),('fill',(-6,4,8),1300,8,(.62,.7,1)),('rim',(6,5,10),1800,6,(1,.74,.42))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,1.8));az=math.radians(45 if a.view=='game' else 34);el=math.radians(36 if a.view=='game' else 23);dist=70 if a.view=='game' else 22
cam.location=target+Vector((math.cos(az)*math.cos(el),-math.sin(az)*math.cos(el),math.sin(el)))*dist;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.lens=81.2 if a.view=='game' else 48;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=True
 s.cycles.device='GPU'
except:pass
s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:s.render.filepath=a.render;bpy.ops.render.render(write_still=True)
