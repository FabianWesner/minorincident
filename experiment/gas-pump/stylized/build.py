# Identity: red rounded cabinet; cream face; oversized star globe; dark meter; loop hose/nozzle.
# Simplified parts: plinth, cabinet/cap, face/meter, globe disks/star, hose tube, block nozzle.
# Drop: rust, scratches, screws, tiny numbers, labels, fine trim, seams and small gauges.
import bpy, math, argparse, sys, json
from mathutils import Vector
from pathlib import Path
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser(); ap.add_argument('--render'); ap.add_argument('--view',default='ref'); ap.add_argument('--samples',type=int,default=16); ap.add_argument('--width',type=int,default=960); ap.add_argument('--height',type=int,default=540); ap.add_argument('--glb'); ap.add_argument('--blend'); a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(token,h,em=False):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+token); m.diffuse_color=(*[((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4)],1); m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Roughness'].default_value=.78; bs.inputs['Metallic'].default_value=0
 if em: bs.inputs['Emission Color'].default_value=m.diffuse_color; bs.inputs['Emission Strength'].default_value=2
 return m
red=mat('survivorRed','d9363e'); cream=mat('picketWhite','f2e6dc'); dark=mat('uiDark','25222c'); gray=mat('sidewalk','b9a4a0'); glow=mat('windowGlow','ffc773',True)
def finish(o,n,m):
 o.name=n; o.data.materials.append(m); return o
def box(n,loc,size,m,b=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  q=o.modifiers.new('soft corners','BEVEL'); q.width=b; q.segments=1; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=q.name)
 return finish(o,n,m)
def cyl(n,loc,r,d,m,axis='Z',verts=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc,rotation=(0,math.pi/2,0) if axis=='X' else ((math.pi/2,0,0) if axis=='Y' else (0,0,0))); return finish(bpy.context.object,n,m)
box('plinth',(0,0,.10),(.88,1.10,.20),dark,.06)
box('base_red',(0,0,.23),(.77,.97,.14),red,.04)
box('cabinet',(0,0,1.12),(.68,.87,1.72),red,.09)
box('cream_face',(.351,0,1.06),(.07,.69,1.53),cream,.035)
box('top_cap',(0,0,1.99),(.73,.94,.28),red,.10)
box('cap_band',(0,0,1.85),(.75,.96,.075),gray,.015)
box('meter_border',(.403,0,1.48),(.075,.57,.52),gray,.045)
box('meter_panel',(.446,0,1.48),(.035,.47,.41),cream,.025)
box('meter_window',(.470,0,1.57),(.025,.38,.14),dark,.016)
# Three broad cream markers suggest an analogue readout, without illegible tiny digits.
for y in [-.12,0,.12]: box('meter_marker',(.486,y,1.57),(.012,.035,.07),cream,0)
box('lower_readout',(.470,0,1.39),(.025,.26,.085),dark,.012)
cyl('globe_neck',(0,0,2.18),.15,.16,red)
cyl('globe_red_rim',(0,0,2.65),.48,.23,red,'X',16)
for side in [-1,1]:
 cyl('globe_face',(side*.125,0,2.65),.414,.025,cream,'X',16)
 verts=[]
 for i in range(10):
  angle=math.pi/2+i*math.pi/5; r=.325 if i%2==0 else .146; verts.append((side*.148,r*math.cos(angle),2.65+r*math.sin(angle)))
 verts.append((side*.197,0,2.65)); faces=[(10,i,(i+1)%10) for i in range(10)]
 me=bpy.data.meshes.new('star'); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new('star',me); bpy.context.collection.objects.link(o); finish(o,'globe_star',red)
# Faceted hose with a generous hanging loop; 8-sided tube, no ribbing.
path=[(0,-.48,.72),(0,-.55,.48),(0,-.71,.35),(0,-.91,.38),(0,-1.02,.57),(0,-.99,.82),(0,-.87,1.10),(0,-.75,1.38)]
# Catmull-Rom interpolation gives a soft silhouette using only 29 rings.
pts=[]
for i in range(len(path)-1):
 p0=Vector(path[max(0,i-1)]); p1=Vector(path[i]); p2=Vector(path[i+1]); p3=Vector(path[min(len(path)-1,i+2)])
 for j in range(4):
  t=j/4; pts.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
pts.append(Vector(path[-1])); vs=[]; fs=[]
for i,p in enumerate(pts):
 tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized(); u=Vector((1,0,0)); v=tangent.cross(u).normalized()
 for j in range(8): vs.append(p+.064*(u*math.cos(j*math.pi/4)+v*math.sin(j*math.pi/4)))
for i in range(len(pts)-1):
 for j in range(8): fs.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
fs.extend([tuple(reversed(range(8))),tuple((len(pts)-1)*8+j for j in range(8))]); me=bpy.data.meshes.new('hose'); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new('hose',me); bpy.context.collection.objects.link(o); finish(o,'hose',dark)
cyl('nozzle_mount',(0,-.47,1.62),.14,.09,gray,'Y',12)
o=box('nozzle_grip',(0,-.71,1.49),(.15,.15,.33),gray,.025); o.rotation_euler.x=-.24
box('nozzle_head',(0,-.66,1.67),(.19,.24,.15),gray,.025)
box('nozzle_handle',(0,-.57,1.49),(.10,.09,.24),dark,.015)
# Merge all static geometry by material for one draw call per palette colour.
for m in [red,cream,dark,gray,glow]:
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 if not obs: continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name='gas_pump_'+m.name; bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
asset=[o for o in bpy.context.scene.objects if o.type=='MESH']; tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in asset)
(P/'stats.json').write_text(json.dumps({'triangles':tris,'meshes':len(asset),'materials':[m.name for m in [red,cream,dark,gray] ]}))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in asset:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
if a.blend: bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:
 ground=box('stage',(0,0,-.07),(200,200,.12),mat('stage','625869'),0)
 scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
 scene.cycles.device='GPU'
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL'; prefs.get_devices()
  for dev in prefs.devices:dev.use=True
 except:pass
 scene.world.color=(.22,.22,.22)
 def area(n,loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=n; o.data.energy=power; o.data.color=color; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
 area('key',(4,-4,7),700,(1,.80,.61),5); area('fill',(-3,-1,4),450,(.63,.71,1),4); area('rim',(0,4,5),550,(1,.65,.45),3)
 target=Vector((0,-.15,1.5)); bpy.ops.object.camera_add(); cam=bpy.context.object
 if a.view=='game':
  dist=14.5; elev=math.radians(36); cam.location=target+Vector((dist*math.cos(elev)/math.sqrt(2),-dist*math.cos(elev)/math.sqrt(2),dist*math.sin(elev))); cam.data.angle=math.radians(25)
 else: cam.location=(6,-7,4.2); cam.data.type='ORTHO'; cam.data.ortho_scale=6.8
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); scene.camera=cam; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'; scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK triangles',tris)
