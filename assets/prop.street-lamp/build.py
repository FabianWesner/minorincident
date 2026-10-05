"""Deterministic Victorian lamp. Metres, +X forward, ground at Z=0."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser()
p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref')
p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,hexcolor,emission=0):
 c=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.48;n.inputs['Metallic'].default_value=.25
 if emission:n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=emission
 return m
bronze=material('pal_woodWarm','513b37');glow=material('emi_windowGlow','ffc773',1.5)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.street-lamp'
def mesh(name,verts,faces,mat,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 if bevel:
  b=o.modifiers.new('cast edge radius','BEVEL');b.width=bevel;b.segments=3;bpy.ops.object.modifier_apply(modifier=b.name)
  n=o.modifiers.new('weighted cast normals','WEIGHTED_NORMAL');n.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=n.name)
 o.select_set(False);return o
# Square sections use true half-width; octagonal sections use circumradius.
def profile(name,sections,n=4,mat=bronze,bevel=.009):
 vs=[]
 for z,r in sections:
  for i in range(n):
   t=2*math.pi*i/n+math.pi/4 if n==4 else 2*math.pi*i/n+math.pi/8
   s=math.sqrt(2) if n==4 else 1
   vs.append((s*r*math.cos(t),s*r*math.sin(t),z))
 fs=[tuple(range(n-1,-1,-1)),tuple(range((len(sections)-1)*n,len(sections)*n))]
 fs += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(sections)-1) for i in range(n)]
 return mesh(name,vs,fs,mat,bevel)
profile('square footing',[(0,.30),(.18,.285),(.22,.235)])
profile('plinth slope',[(.22,.235),(.46,.18)])
profile('plinth collar',[(.45,.205),(.50,.205),(.515,.175)])
profile('tapered pedestal',[(.51,.17),(.96,.145)],8)
profile('pedestal crown',[(.95,.175),(1.005,.175),(1.025,.145)],8)
profile('neck',[(1.02,.12),(1.10,.12)],8)
profile('shaft bottom collar',[(1.09,.14),(1.15,.14),(1.17,.105)],8)
profile('long faceted shaft',[(1.15,.103),(2.53,.081)],8)
profile('shaft capital',[(2.51,.12),(2.57,.12),(2.59,.083)],8)
profile('turned ornament',[(2.58,.075),(2.62,.075),(2.70,.10),(2.76,.072),(2.81,.067)],8)
profile('lantern cup',[(2.81,.08),(2.84,.13),(2.92,.205)])
profile('lower lantern rim',[(2.92,.22),(2.97,.22)])
# Pane body is narrower than the open corner frame by 14 mm, never coplanar.
lantern=profile('lantern',[(2.966,.183),(3.43,.257)],4,glow,.003)
for sx in [-1,1]:
 for sy in [-1,1]:
  vs=[]
  for z,r in [(2.967,.205),(3.45,.283)]:
   vs.extend([(sx*(r+dx),sy*(r+dy),z) for dx,dy in [(-.023,-.023),(.023,-.023),(.023,.023),(-.023,.023)]])
  mesh('corner stile',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],bronze,.006)
profile('upper frame',[(3.43,.283),(3.47,.283)])
profile('wide roof eave',[(3.47,.32),(3.505,.32)])
profile('pyramid canopy',[(3.505,.31),(3.64,.155)])
profile('roof shoulder',[(3.64,.155),(3.665,.155)])
profile('roof chimney',[(3.663,.095),(3.74,.095)])
profile('finial collar',[(3.74,.115),(3.768,.115)])
profile('finial stem',[(3.766,.055),(3.805,.055)])
profile('pointed finial',[(3.805,.058),(3.865,.001)],4,bronze,.002)
# Merge static cast metal by material, retaining the independently switchable lamp.
for mat in [bronze]:
 obs=[o for o in bpy.data.objects if o.type=='MESH' and o.data.materials[0]==mat]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='body';obs[0].parent=root
lantern.parent=root;bpy.context.scene.cursor.location=(0,0,2.965);bpy.ops.object.select_all(action='DESELECT');lantern.select_set(True);bpy.context.view_layer.objects.active=lantern;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
light=bpy.data.objects.new('light:lantern',None);bpy.context.collection.objects.link(light);light.parent=root;light.location=(0,0,3.18)
light['ss_light']=json.dumps(dict(type='point',color='light_sodium',intensity=3.5,range=7,pool=True,beam='none',flare=True,reflect=True,shadow='hero',heroPriority=1,flicker='none',animation=None,powerGroup='self',breakable=True,emissiveNodes=['lantern'],tiers='all'))
col=bpy.data.objects.new('col:post',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,1.91);col['collider']=json.dumps({'type':'cuboid','size':[.60,.60,3.865]})
# Bake deterministic ambient occlusion into the glTF vertex-color attribute.
for o in [o for o in bpy.data.objects if o.type=='MESH']:
 ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
 o.data.color_attributes.active_color=ao
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in [o for o in bpy.data.objects if o.type=='MESH']:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='AO')
bpy.context.scene.unit_settings.system='METRIC'
meshes=[o for o in bpy.data.objects if o.type=='MESH'];triangles=0
for o in meshes:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
stats={'triangles':triangles,'draw_calls':sum(len(o.data.materials) for o in meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials})}
Path(__file__).with_name('build-stats.json').write_text(json.dumps(stats,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.world.color=(.17,.17,.17)
 stage=material('stage','302b35');bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(stage);bpy.context.object.location.z=-.012
 def area(loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
 area((3,-4,6),650,(1,.69,.40),4);area((-3,-1,5),450,(.61,.65,1),4);area((1,3,4),700,(1,.47,.18),3)
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,1.92));az=math.radians(45);el=math.radians(36 if a.view=='game' else 15)
 if a.view=='front':az=0
 if a.view=='side':az=math.pi/2
 if a.view=='rear':az=math.pi
 cam.location=target+Vector((math.cos(az)*math.cos(el),-math.sin(az)*math.cos(el),math.sin(el)))*10;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.9 if a.view=='game' else 7.7;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',json.dumps(stats))
