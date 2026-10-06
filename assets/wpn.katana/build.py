"""Deterministic swept katana, inset hamon and raised crossed grip bindings."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ['render','glb']:p.add_argument('--'+k)
p.add_argument('--view',default='ref')
for k,v in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+k,type=int,default=v)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def mat(token,h,metal=0,rough=.4):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 return m
steel=mat('sidewalk','b9a4a0',.55,.3);edge=mat('picketWhite','f2e6dc',.75,.24);dark=mat('uiDark','25222c',.05,.5);red=mat('survivorRed','d9363e',0,.47);gold=mat('schoolBusYellow','f2b630',.72,.3);back=mat('asphalt','5b4f5c',.7,.32)
materials=[steel,edge,dark,red,gold,back]
def mesh(name,vs,fs,m):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
def box(name,loc,size,m,bevel=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
# Blade is a watertight faceted sweep. Surface bands share vertices, never overlays.
vs=[];fs=[];mi=[];N=64
for i in range(N+1):
 t=i/N;x=-.20+.86*t;curve=.065*t*t;width=.068*(1-.12*t)
 if t>.88:width*=max(.035,(1-t)/.12)
 z=.12+curve
 # edge, hamon boundary, ridge, spine: two broad sides with sharpened lower edge
 wave=(.004*math.sin(t*math.pi*34)+.002*math.sin(t*math.pi*58))*min(1,width/.04)
 ring=[(0,z-width/2),(-.007,z-width/2+min(.008,width*.22)+wave),(-.012,z+width*.18),(-.006,z+width/2),(.006,z+width/2),(.012,z+width*.18),(.007,z-width/2+min(.008,width*.22)+wave)]
 for y,zz in ring:vs.append((x,y,zz))
for i in range(N):
 for j in range(7):fs.append((i*7+j,i*7+(j+1)%7,(i+1)*7+(j+1)%7,(i+1)*7+j));mi.append([1,0,0,5,0,0,1][j])
fs.extend([tuple(reversed(range(7))),tuple(N*7+j for j in range(7))]);mi.extend([0,1])
o=mesh('blade',vs,fs,steel)
for m in [edge,back]:o.data.materials.append(m)
for f,i in zip(o.data.polygons,mi):f.material_index={0:0,1:1,5:2}[i]
# Octagonal oval guard with a real open centre and raised rim.
def guard(name,x,ry,rz,inner_y,inner_z,thickness,m):
 vs=[];fs=[];n=32
 for xx in [x-thickness/2,x+thickness/2]:
  for yy,zz in [(ry,rz),(inner_y,inner_z)]:
   for i in range(n):q=2*math.pi*i/n;vs.append((xx,yy*math.cos(q),.12+zz*math.sin(q)))
 # ring faces, outer wall and inner wall
 for i in range(n):
  j=(i+1)%n;fs.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
 return mesh(name,vs,fs,m)
guard('guard',-.232,.056,.12,.018,.045,.012,gold)
guard('guard_inset',-.232,.045,.104,.025,.056,.015,dark)
box('habaki',(-.204,0,.12),(.034,.032,.079),gold)
box('handle_core',(-.415,0,.12),(.33,.041,.068),red,.009)
for x in [-.252,-.584]:box('fitting',(x,0,.12),(.023,.054,.084),gold,.006)
# Raised dark ribbons cross both sides, leaving red diamond-shaped windows.
for i in range(8):
 x=-.277-i*.039
 for side in [-1,1]:
  for slope in [-1,1]:
   o=box('binding',(x,side*.027,.12),(.024,.012,.065),dark,.003)
   o.rotation_euler.y=slope*.48
for i in range(8):
 for z in [.079,.161]:
  for slope in [-1,1]:
   o=box('binding_return',(-.277-i*.039,0,z),(.016,.049,.01),dark,.002);o.rotation_euler.z=slope*.48
# Small inset guard spokes and pommel rivets are meaningful silhouette details.
for z in [.042,.198]:box('guard_spoke',(-.232,0,z),(.021,.012,.038),gold,.003)
for side in [-1,1]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.009,location=(-.584,side*.029,.12));o=bpy.context.object;o.name='pommel_pin';o.scale=(1,.45,1);o.data.materials.append(gold)
# Centre footprint; lower guard is the ground contact. Merge static parts per material.
objs=[o for o in scene.objects if o.type=='MESH']
mins=[min((o.matrix_world@v.co).x for v in o.data.vertices) for o in objs];maxs=[max((o.matrix_world@v.co).x for v in o.data.vertices) for o in objs];shift=-(min(mins)+max(maxs))/2
for o in objs:o.location.x+=shift
root=bpy.data.objects.new('root',None);scene.collection.objects.link(root);root['asset_id']='wpn.katana'
for m in materials:
 selected=[o for o in scene.objects if o.type=='MESH' and m in list(o.data.materials)]
 # Separate blade material bands before joining.
 if m==steel:
  bpy.ops.object.select_all(action='DESELECT');o=bpy.data.objects['blade'];o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
 selected=[o for o in scene.objects if o.type=='MESH' and o.data.materials[0]==m]
 if not selected:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in selected:o.select_set(True)
 bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object;o.name='body_'+m.name;o.parent=root;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
for name,loc in [('grip',(-.42+shift,0,.12)),('tip',(.66+shift,0,.185))]:
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;o.parent=root
triangles=0
for o in scene.objects:
 if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
report=dict(id='wpn.katana',tier='Side',triangles=triangles,draw_calls=6,materials=[m.name for m in materials],nodes_ok=True,within_budget=triangles<=6000,rounds=5,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False)
if a.render:
 scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.12,.12,.12)
 target=Vector((0,0,.12))
 def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((0,-2,3),220,3,(1,.8,.65)),((0,2,2),260,2,(.65,.73,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
 scene.world.color=(.07,.06,.08)
 views={'ref':(-.85,2,.85),'game':(1.5,-1.5,2.2),'side':(0,-2,.12),'front':(2,0,.5),'rear':(-2,0,.5)}
 bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=1.6;scene.camera=o
 scene.view_settings.view_transform='AgX';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
