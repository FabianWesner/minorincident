"""Reference-matched Sunset Grove nail gun. +X firing direction, metres, Z up."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser()
for f in ('render','glb'): p.add_argument('--'+f)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='wpn.nail-gun'
M={}
for t,h,metal in [('survivorRed','d9363e',0),('blood','b3121f',0),('uiDark','25222c',.25),('asphalt','5b4f5c',.4),('sidewalk','b9a4a0',.65),('picketWhite','f2e6dc',0),('schoolBusYellow','f2b630',.5)]:
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m=bpy.data.materials.new('pal_'+t);m.diffuse_color=(*c,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=.56;M[t]=m

def finish(o,name,t,b=.004):
 o.name=name;o.parent=root;o.data.materials.append(M[t]);bpy.context.view_layer.objects.active=o
 if b:
  mod=o.modifiers.new('edge rounding','BEVEL');mod.width=b;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def box(name,loc,size,t,b=.004):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,t,b)

def profile(name,pts,width,t,b=.004):
 n=len(pts);v=[(x,y,z) for y in (-width/2,width/2) for x,z in pts];f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,t,b)

def cyl(name,loc,r,depth,t,axis='Y',b=.001):
 rot=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0)
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=depth,location=loc,rotation=rot);return finish(bpy.context.object,name,t,b)

def tube(name,pts,r,t):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=r;d.bevel_resolution=1
 s=d.splines.new('POLY');s.points.add(len(pts)-1)
 for q,v in zip(s.points,pts):q.co=(*v,1)
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,t,0)

# Upper motor casing and overlapping protective end caps.
box('motor housing',(-.045,0,.405),(.355,.115,.185),'survivorRed',.016)
for x in [-.225,.143]:box('end armour',(x,0,.405),(.040,.127,.191),'asphalt',.009)
box('rear cap',(-.261,0,.409),(.034,.092,.139),'survivorRed',.008)
for y in [-.033,0,.033]:box('rear cooling slot',(-.280,y,.409),(.009,.012,.092),'uiDark',.003)
box('top channel',(-.042,0,.499),(.285,.039,.009),'blood',.003)
box('top slide',(-.032,0,.508),(.075,.035,.012),'asphalt',.004)
for x in [-.17,.095]:box('top rail clip',(x,0,.505),(.028,.021,.009),'sidewalk',.003)
# Side panels: real depth and a border, lettering is >=3mm proud.
for s in [-1,1]:
 box('panel shadow',(-.043,s*.060,.401),(.281,.009,.126),'blood',.008)
 box('side label plate',(-.043,s*.068,.401),(.263,.010,.108),'survivorRed',.004)
 for x in [-.184,.098]:
  for z in [.338,.465]:
   cyl('screw washer',(x,s*.064,z),.008,.009,'asphalt')
   cyl('screw inset',(x,s*.071,z),.004,.004,'uiDark')
 d=bpy.data.curves.new('NAIL lettering','FONT');d.body='NAIL';d.font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf');d.align_x='CENTER';d.align_y='CENTER';d.size=.118;d.extrude=.002;d.resolution_u=1
 o=bpy.data.objects.new('NAIL lettering',d);bpy.context.collection.objects.link(o);o.location=(-.043,s*.078,.401);o.rotation_euler=(math.pi/2,0,math.pi if s>0 else 0)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');finish(o,'raised NAIL','picketWhite',0)
# Long front magazine, side rails and layered steel feed track.
box('magazine',(.184,0,.232),(.074,.085,.388),'uiDark',.009)
for x in [.141,.228]:box('magazine red rail',(x,0,.218),(.026,.103,.378),'survivorRed',.006)
for s in [-1,1]:
 box('magazine track',(.181,s*.048,.214),(.068,.015,.279),'asphalt',.005)
 box('upper track recess',(.181,s*.058,.265),(.044,.008,.131),'uiDark',.003)
 box('lower track recess',(.181,s*.058,.119),(.044,.008,.077),'uiDark',.003)
 box('track bridge',(.181,s*.065,.182),(.052,.009,.015),'sidewalk',.002)
 box('feed slide',(.181,s*.065,.365),(.056,.023,.103),'asphalt',.005)
 for z in [.330,.397]:cyl('feed bolt',(.181,s*.080,z),.005,.006,'schoolBusYellow')
 cyl('bottom pivot',(.181,s*.063,.063),.011,.009,'sidewalk')
 cyl('pivot core',(.181,s*.070,.063),.006,.005,'uiDark')
profile('contact foot',[(.145,.040),(.163,0),(.205,0),(.232,.040),(.217,.071),(.159,.071)],.114,'asphalt',.006)
box('nose mount',(.239,0,.431),(.055,.079,.093),'uiDark',.007)
box('nose slide',(.276,0,.449),(.074,.055,.042),'asphalt',.005)
cyl('muzzle sleeve',(.314,0,.449),.018,.051,'asphalt','X',.002)
cyl('muzzle rim',(.338,0,.449),.017,.006,'sidewalk','X',.001)
cyl('dark muzzle bore',(.341,0,.449),.011,.004,'uiDark','X',0)
# Open handle silhouette: angled grip, bottom brace and battery shoe.
profile('handle',[(-.185,.317),(-.103,.317),(-.096,.280),(-.124,.241),(-.104,.188),(-.079,.118),(-.161,.100),(-.196,.235)],.075,'survivorRed',.010)
box('trigger mechanism',(-.091,0,.306),(.182,.085,.038),'uiDark',.006)
profile('grip rubber',[(-.178,.236),(-.145,.235),(-.124,.156),(-.130,.127),(-.165,.132)],.083,'uiDark',.009)
for s in [-1,1]:
 for z in [.160,.188,.216]:box('rubber grip ribs',(-.161,s*.045,z),(.037,.010,.007),'asphalt',.002)
 cyl('handle pin',(-.153,s*.043,.267),.008,.007,'sidewalk')
tube('trigger guard',[(-.107,0,.307),(-.080,0,.248),(-.049,0,.232),(-.013,0,.244),(.018,0,.300)],.009,'asphalt')
trigger=tube('trigger',[(-.046,0,.300),(-.036,0,.282),(-.041,0,.259),(-.056,0,.252)],.008,'uiDark')
box('bottom brace',(-.018,0,.091),(.280,.071,.046),'survivorRed',.008)
box('battery red shoulder',(-.152,0,.088),(.139,.113,.065),'survivorRed',.012)
box('battery separator',(-.152,0,.051),(.152,.121,.022),'uiDark',.005)
box('battery shoe',(-.152,0,.031),(.157,.125,.040),'asphalt',.009)
for s in [-1,1]:
 box('belt clip back',(-.152,s*.064,.087),(.057,.014,.062),'asphalt',.004)
 for x in [-.178,-.126]:box('belt clip sides',(x,s*.075,.099),(.010,.012,.052),'sidewalk',.003)
 box('belt clip top',(-.152,s*.075,.124),(.059,.012,.010),'sidewalk',.003)
 box('belt clip lower',(-.152,s*.075,.076),(.059,.012,.010),'sidewalk',.003)
box('safety indicator',(-.08,-.047,.307),(.035,.010,.009),'schoolBusYellow',.002)

# Trigger retains its hinge origin; other geometry batches by material.
trigger['animated']=True
bpy.context.scene.cursor.location=(-.046,0,.300)
bpy.ops.object.select_all(action='DESELECT');trigger.select_set(True);bpy.context.view_layer.objects.active=trigger;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
for token,m in M.items():
 obs=[o for o in bpy.data.objects if o.type=='MESH' and o.data.materials[0]==m and not o.get('animated')]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='body' if token=='survivorRed' else 'static_'+token
 ao=obs[0].data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
 for c in ao.data:c.color=(1,1,1,1)
ao=trigger.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
for c in ao.data:c.color=(1,1,1,1)
for name,loc in [('grip',(-.153,0,.207)),('muzzle',(.345,0,.449))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=root;o.location=loc
 if name=='muzzle':o['front']=True
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.bake.target='VERTEX_COLORS'
meshes=[o for o in bpy.data.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True);o.data.color_attributes.active_color=o.data.color_attributes['ao']
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')
for o in meshes:o.data.calc_loop_triangles()
metrics={'triangles':sum(len(o.data.loop_triangles) for o in meshes),'draw_calls':len(meshes),'materials':[m.name for m in M.values()]}
if a.glb:
 # Centre the exported bounding box on X/Y; keep the review framing fixed.
 bpy.context.view_layer.update()
 points=[o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
 root.location.x=-(min(v.x for v in points)+max(v.x for v in points))/2
 root.location.y=-(min(v.y for v in points)+max(v.y for v in points))/2
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
 Path(__file__).with_name('metrics.json').write_text(json.dumps(metrics))
 root.location=(0,0,0)
if a.render:
 scene.cycles.samples=a.samples;scene.world.color=(.10,.10,.10)
 m=bpy.data.materials.new('stage');m.diffuse_color=(.035,.029,.043,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.035,.029,.043,1)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003));bpy.context.object.data.materials.append(m)
 target=Vector((.025,0,.26))
 for loc,power,color,size in [((.4,-1,1.4),32,(1,.79,.60),1),((-.7,.4,.9),20,(.60,.68,1),1),((.6,.8,.8),25,(1,.51,.25),.8)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object
 views={'ref':(.72,1.6,.82),'game':(1,-1,1.35),'front':(2,0,.1),'rear':(-2,0,.1),'side':(0,-2,.15)}
 cam.location=target+Vector(views[a.view]);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.14;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',json.dumps(metrics))
