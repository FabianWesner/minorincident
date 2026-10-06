"""Soda pickup: spun metal can, raised rabbit label, texture-free palette geometry."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for f in ['render','glb']:p.add_argument('--'+f)
p.add_argument('--view',default='ref')
p.add_argument('--lod',type=int,choices=[0,1,2],default=0)
for f,d in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+f,type=int,default=d)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SEGMENTS=[20,12,8][a.lod]
LABEL_SEGMENTS=[12,8,6][a.lod]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
def material(token,h,metal=0):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c]
 s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=.38
 return m
red=material('survivorRed','d9363e');silver=material('sidewalk','b9a4a0',.72);cream=material('picketWhite','f2e6dc');dark=material('uiDark','25222c');pink=material('infectedSkin','c9a39a');nose=material('blood','b3121f')
materials=[red,silver,cream,dark,pink,nose]
def mesh(name,v,f,m):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(m);return o
def lathe(name,rings,m,n=None):
 n=n or SEGMENTS
 v=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for z,r in rings for i in range(n)]
 f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
 f += [tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))]
 return mesh(name,v,f,m)
lathe('painted_shell',[(.009,.036),(.020,.0455),(.151,.0455),(.161,.0405),(.174,.035)],red)
lathe('bottom_chime',[(0,.034),(.003,.038),(.012,.042),(.018,.043)],silver)
lathe('shoulder',[(.161,.0435),(.164,.042),(.169,.0385),(.174,.0375)],silver)
lathe('rolled_top',[(.172,.037),(.177,.040),(.180,.040),(.182,.0385),(.182,.036),(.176,.035)],silver)
lathe('lid',[(.175,.035),(.1765,.035)],silver)
# Label outlines are mapped to the cylindrical face, >=3 mm proud of paint.
def mapped(u,z,depth):
 t=u/.0455;return ((.0455+depth)*math.cos(t),(.0455+depth)*math.sin(t),z)
def patch(name,outline,m,depth=.0032):
 # Concentric tessellation follows the cylinder instead of forming a cone.
 center=(sum(u for u,z in outline)/len(outline),sum(z for u,z in outline)/len(outline));n=len(outline);rings=2 if name=='rabbit_face' else 1
 v=[mapped(*center,depth)]
 for j in range(1,rings+1):
  t=j/rings
  v.extend(mapped(center[0]+(u-center[0])*t,center[1]+(z-center[1])*t,depth) for u,z in outline)
 f=[(0,i+1,(i+1)%n+1) for i in range(n)]
 for j in range(rings-1):
  b=1+j*n;c=b+n
  f.extend((b+i,b+(i+1)%n,c+(i+1)%n,c+i) for i in range(n))
 b=1+(rings-1)*n;c=len(v);v.extend(mapped(u,z,depth-.001) for u,z in outline)
 f.extend((b+i,c+i,c+(i+1)%n,b+(i+1)%n) for i in range(n))
 return mesh(name,v,f,m)
def oval(name,u,z,rx,rz,m,depth=.0032,angle=0,n=None):
 n=n or LABEL_SEGMENTS
 c,s=math.cos(angle),math.sin(angle)
 return patch(name,[(u+rx*math.cos(t)*c-rz*math.sin(t)*s,z+rx*math.cos(t)*s+rz*math.sin(t)*c) for t in [i*math.tau/n for i in range(n)]],m,depth)
oval('earL',-.015,.127,.006,.020,cream,angle=.28)
oval('earR',.015,.127,.006,.020,cream,angle=-.28)
oval('innerL',-.016,.132,.0029,.010,pink,.0064,angle=.28)
oval('innerR',.016,.132,.0029,.010,pink,.0064,angle=-.28)
oval('rabbit_face',0,.094,.026,.025,cream,.0065,n=SEGMENTS)
for u in [-.010,.010]:oval('eye',u,.098,.0035,.005,dark,.0097,n=LABEL_SEGMENTS)
for u in [-.016,.016]:oval('cheek',u,.089,.0032,.0023,pink,.0097,n=LABEL_SEGMENTS)
oval('nose',0,.089,.003,.002,nose,.0098,n=LABEL_SEGMENTS)
def stroke(name,pts,r,m):
 # Geometry-only tube: round stroke, mapped around the label.
 v=[];n=4
 for u,z in pts:
  for i in range(n):
   t=i*math.tau/n;v.append(mapped(u+r*math.cos(t),z+r*math.sin(t),.0098+r*math.sin(t)))
 f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(pts)-1) for i in range(n)]
 return mesh(name,v,f,m)
stroke('mouthstem',[(0,.088),(0,.085)],.00065,nose)
for side in [-1,1]:stroke('smile',[(side*(.003+.003*math.cos(t)),.085-.002*math.sin(t)) for t in [i*math.pi/5 for i in range(6)]],.00065,nose)
# Extruded lettering warped onto the cylinder; raised clear of the paint.
bpy.ops.object.text_add();o=bpy.context.object;o.name='SODA';o.data.body='SODA';o.data.align_x='CENTER';o.data.size=.023;o.data.space_character=1.13;o.data.extrude=.0006;o.data.resolution_u=2 if a.lod==0 else 1
bpy.ops.object.convert(target='MESH')
for v in o.data.vertices:
 u,z,d=v.co.x,v.co.y,v.co.z;v.co=mapped(u,z*1.3+.032,.0035+d)
o.data.materials.append(cream)
# Recessed scored opening and raised oval pull-tab, with a genuine central hole.
bpy.ops.mesh.primitive_uv_sphere_add(segments=SEGMENTS,ring_count=4,location=(.016,0,.1772));o=bpy.context.object;o.name='opening';o.scale=(.011,.008,.0007);o.data.materials.append(dark)
bpy.ops.mesh.primitive_torus_add(major_segments=SEGMENTS,minor_segments=4,major_radius=.009,minor_radius=.0018,location=(-.005,0,.1805));o=bpy.context.object;o.name='tab';o.scale.x=1.35;o.data.materials.append(silver)
lathe('rivet',[(.1765,.002),(.179,.002),(.180,.0015)],silver,8)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='pick.soda'
root['ss_physics']={'class':'light','mass':.35,'friction':.5,'restitution':.15,'centerOfMass':[0,.09,0],'pushable':True,'kickable':True,'flammable':False}
col=bpy.data.objects.new('col:body',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,.091);col['collider']='cylinder';col['shape']='cylinder';col['radius']=.0455;col['halfHeight']=.091
# Pickup is carried/consumed as a whole; no animated subparts.
for m in materials:
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='body' if m==red else 'static_'+m.name;o.parent=root
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
 attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='AO')
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='pick.soda',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in materials],nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','body']),within_budget=triangles<=2500 and len(meshes)<=6)
(HERE/('geometry.json' if a.lod==0 else f'geometry.lod{a.lod}.json')).write_text(json.dumps(report,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
 scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.13,.13,.13)
 floor=material('stage','2a2730');bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor);bpy.context.object.location.z=-.001
 target=Vector((0,0,.09))
 def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((.4,-.5,.7),16,.4,(1,.8,.65)),((-.4,-.1,.4),8,.3,(.65,.72,1)),((.2,.4,.5),20,.3,(1,.62,.3))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
 views={'ref':(.65,-.20,.39),'game':(.5,-.5,.70),'front':(.7,0,.12),'side':(0,-.7,.2),'rear':(-.5,.5,.35)}
 bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=.43;scene.camera=o
 scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.8;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
 scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
 if a.view=='ref':
  scene.camera.location=views['game'];aim(scene.camera);scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
  scene.render.filepath=str(Path(a.render).with_name(Path(a.render).name.replace('ref','game') if 'ref' in Path(a.render).name else 'game.png').resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
