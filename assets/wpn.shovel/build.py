"""Garden shovel: deterministic geometry, palette scalars, no textures."""
import argparse,json,math,random,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ('render','glb'):p.add_argument('--'+k)
p.add_argument('--view',default='ref')
for k,v in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+k,type=int,default=v)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
colors=json.loads((HERE.parents[1]/'src/assets/palette.json').read_text())
def mat(token,metal=0,rough=.6):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 rgb=[int(colors[token][i:i+2],16)/255 for i in (1,3,5)]
 rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*rgb,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 return m
wood=mat('woodWarm');grain=mat('hairHighlight');red=mat('survivorRed',.15,.4);steel=mat('hairSilver',.65,.45);edge=mat('silver',.8,.33);dark=mat('asphalt',.65);dirt=mat('leatherShadow');soil=mat('hairCopper')
rng=random.Random(42)
def mesh(name,vs,fs,mats,ids=None):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
 for m in mats:me.materials.append(m)
 if ids:
  for f,i in zip(me.polygons,ids):f.material_index=i
 return o
def bevel(o,w=.005):
 bpy.context.view_layer.objects.active=o;o.select_set(True);mod=o.modifiers.new('soft edges','BEVEL');mod.width=w;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
def rod(name,start,end,r,material,vertices=12):
 mid=(Vector(start)+Vector(end))/2;bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(Vector(end)-Vector(start)).length,location=mid)
 o=bpy.context.object;o.name=name;o.rotation_euler=(Vector(end)-Vector(start)).to_track_quat('Z','Y').to_euler();o.data.materials.append(material);bevel(o,.003);return o
# Wooden shaft, with face-based grain patches rather than overlapping decals.
shaft=rod('shaft',(0,0,.36),(0,0,.96),.026,wood,16)
shaft.data.materials.append(grain)
for f in shaft.data.polygons:
 if f.index%9==0:f.material_index=1
# Blade: concentric elliptical rings produce a shallow cup and a dented rounded point.
N=32;R=6;vs=[(.004,0,.19)];fs=[];ids=[]
outline=[(0,.326),(.075,.326),(.150,.326),(.150,.270),(.143,.200),(.120,.126),(.085,.070),(.043,.029),(0,.016),(-.043,.029),(-.085,.070),(-.120,.126),(-.143,.200),(-.150,.270),(-.150,.326),(-.075,.326)]
for j in range(1,R+1):
 t=j/R
 for i in range(N):
  u=i/2;k=int(u);f=u-k
  oy=outline[k][0]*(1-f)+outline[(k+1)%16][0]*f
  oz=outline[k][1]*(1-f)+outline[(k+1)%16][1]*f
  y=oy*t;z=.19+(oz-.19)*t
  x=.004+.024*t*t+.002*math.sin(i*2.7+j)*t
  vs.append((x,y,z))
for i in range(N):fs.append((0,1+i,1+(i+1)%N));ids.append(0)
for j in range(R-1):
 for i in range(N):
  fs.append((1+j*N+i,1+j*N+(i+1)%N,1+(j+1)*N+(i+1)%N,1+(j+1)*N+i))
  ids.append(1 if j==R-2 and rng.random()<.8 else (2 if rng.random()<.045 else (3 if j>3 and rng.random()<.10 else 0)))
blade=mesh('blade',vs,[tuple(reversed(f)) for f in fs],[steel,edge,dark,dirt],ids)
bpy.context.view_layer.objects.active=blade;blade.select_set(True);mod=blade.modifiers.new('blade thickness','SOLIDIFY');mod.thickness=.009;bpy.ops.object.modifier_apply(modifier=mod.name);blade.select_set(False);bevel(blade,.002)
# Tapered pressed ridge/socket, proud of the cup.
vs=[]
for z,w,x in [(.12,.008,.028),(.26,.030,.045),(.34,.032,.048),(.47,.029,.030)]:
 vs.extend([(x,-w,z),(x+.026,0,z),(x,w,z),(-.015,w,z),(-.015,-w,z)])
fs=[]
for j in range(3):
 for i in range(5):fs.append((j*5+i,j*5+(i+1)%5,(j+1)*5+(i+1)%5,(j+1)*5+i))
fs.extend([(4,3,2,1,0),(15,16,17,18,19)])
socket=mesh('pressed_socket',vs,fs,[dark,steel]);bevel(socket,.003)
rod('socket_rivet',(.058,0,.442),(.067,0,.442),.011,edge)
# Red D-frame; open centre, wooden crossbar, four steel fasteners.
rod('grip_collar',(0,0,.91),(0,0,.985),.036,red)
for s in [-1,1]:
 points=[(0,s*.018,.96),(0,s*.089,1.015),(0,s*.111,1.09),(0,s*.104,1.17)]
 for i in range(3):
  start,end=points[i:i+2];v=Vector(end)-Vector(start)
  bpy.ops.mesh.primitive_cube_add(size=1,location=(Vector(start)+Vector(end))/2);o=bpy.context.object;o.name='D_frame';o.dimensions=(.042,.037,v.length+.012);o.rotation_euler=v.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(red);bevel(o,.008)
 rod('grip_pin',(.026,s*.101,1.15),(.034,s*.101,1.15),.010,edge)
# Face-integrated paint chips have no coplanar overlay.
for o in list(scene.objects):
 if o.type=='MESH' and o.name.startswith(('D_frame','grip_collar')):
  o.data.materials.append(edge);o.data.materials.append(dark)
  for f in o.data.polygons:
   if f.area<.00025 and rng.random()<.15:f.material_index=rng.choice([1,2])
rod('wood_crossbar',(0,-.090,1.15),(0,.090,1.15),.028,wood,12)
# Raised wood grain follows the shaft: all slivers clear the shaft by 3mm.
for i in range(16):
 angle=rng.choice([-.7,0,.7,1.2]);z=rng.uniform(.50,.86);length=rng.uniform(.025,.075)
 x=.029*math.cos(angle);y=.029*math.sin(angle)
 rod('wood_grain',(x,y,z),(x,y,z+length),.0017,grain,4)
# Small angular soil clods: deliberately sparse, concentrated at the point.
for i in range(23):
 k=rng.randrange(4,12);t=rng.uniform(.76,.94)
 y=outline[k][0]*t;z=.19+(outline[k][1]-.19)*t;x=.011+.024*t*t
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rng.uniform(.003,.011),location=(x,y,z));o=bpy.context.object;o.name='soil_clod';o.scale=(.5,1,.75);o.data.materials.append(dirt if i%3 else soil)
# Merge all static pieces by material; sockets remain named empties.
bpy.ops.object.select_all(action='DESELECT')
objects=[o for o in scene.objects if o.type=='MESH']
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=blade;bpy.ops.object.join();body=bpy.context.object;body.name='body'
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='wpn.shovel';body.parent=root
for name,loc in [('grip',(0,0,.76)),('tip',(.028,0,.016))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
# Exactly grounded, with centred footprint.
coords=[body.matrix_world@v.co for v in body.data.vertices]
shift=Vector((-(min(v.x for v in coords)+max(v.x for v in coords))/2,-(min(v.y for v in coords)+max(v.y for v in coords))/2,-min(v.z for v in coords)))
body.location+=shift
for name in ['grip','tip']:bpy.data.objects[name].location+=shift
# Collapse bevel remnants shorter than one micrometre before export.
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.dissolve_degenerate(bm,dist=1e-6,edges=list(bm.edges))
bm.to_mesh(body.data);bm.free();body.data.update()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=42
attr=body.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');body.data.color_attributes.active_color=attr
scene.render.bake.target='VERTEX_COLORS';bpy.ops.object.bake(type='AO')
body.data.calc_loop_triangles();tris=len(body.data.loop_triangles)
assert all(t.area>1e-12 for t in body.data.loop_triangles), 'Degenerate triangle'
assert tris<=6000, 'Weapon triangle budget exceeded'
used=sorted({body.data.materials[f.material_index].name for f in body.data.polygons})
report=dict(id='wpn.shovel',tier='Side',triangles=tris,draw_calls=len(used),materials=used,nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','grip','tip']),within_budget=tris<=6000 and len(used)<=30,rounds=4,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
if a.render:
 scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.14,.14,.14)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));floor=bpy.context.object;floor.data.materials.append(mat('uiDark'))
 target=Vector((0,0,.59))
 def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((2,-2,3),240,2,(1,.79,.58)),((1,2,2),110,2,(.65,.73,1)),((-1,1,2),210,1,(1,.5,.22))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
 views={'ref':(3,-1.5,1.6),'game':(2,-2,3),'front':(3,0,.65),'side':(0,-3,.65),'rear':(-3,1,1.4)}
 bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=2.15;scene.camera=cam
 if a.view=='ref':cam.rotation_euler.rotate_axis('Z',math.radians(28))
 scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.35
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
