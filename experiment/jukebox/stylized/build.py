# Identity: rounded upright cabinet; amber/red neon arch and pillars; record display;
# broad song selector; U-shaped speaker surround; chunky diamond speaker grille.
# Simplified parts: extruded arch cabinet, plinth, arch bands, pillars and collars,
# half-round dark display with one record, eight selector tiles, U band, four grille bars.
# Dropped: lettering, fine song lists, coin slots, bolts, chrome filigree, record grooves.
import bpy, math, argparse, sys, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--render');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=16);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540);p.add_argument('--glb');p.add_argument('--blend');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def mat(t,h,em=False):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+t);m.diffuse_color=(*[((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4)],1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=m.diffuse_color;b.inputs['Roughness'].default_value=.78;b.inputs['Metallic'].default_value=0
 if em:b.inputs['Emission Color'].default_value=m.diffuse_color;b.inputs['Emission Strength'].default_value=2.5
 M[m.name]=m;return m
wood=mat('woodWarm','b0703f');red=mat('survivorRed','d9363e');dark=mat('uiDark','25222c');cream=mat('picketWhite','f2e6dc');yellow=mat('schoolBusYellow','f2b630');glow=mat('windowGlow','ffc773',True);neon=mat('sirenRed','ff2d2d',True)
def mesh(name,verts,faces,m):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(m);return ob
def profile(name,pts,x0,x1,m):
 n=len(pts);v=[(x,y,z) for x in (x0,x1) for y,z in pts];f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,v,f,m)
def box(name,loc,size,m,bev=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bev:
  md=o.modifiers.new('soft edges','BEVEL');md.width=bev;md.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=md.name)
 return o
def arc(name,r,w,zc,x,m,bottom=False):
 pts=[]
 for i in range(13):
  t=math.pi*i/12;pts.append((r*math.cos(t),zc+(-1 if bottom else 1)*r*math.sin(t)))
 for i in range(12,-1,-1):
  t=math.pi*i/12;pts.append(((r-w)*math.cos(t),zc+(-1 if bottom else 1)*(r-w)*math.sin(t)))
 return profile(name,pts,x,x+.06,m)
def disk(name,y,z,r,x,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=.035,location=(x,y,z),rotation=(0,math.pi/2,0));o=bpy.context.object;o.name=name;o.data.materials.append(m)
# 1.25 m wide, 0.66 deep, 1.9 m tall toy cabinet.
pts=[(-.62,.07),(.62,.07),(.62,1.27)]+[(.62*math.cos(math.pi*i/12),1.27+.62*math.sin(math.pi*i/12)) for i in range(1,13)]
profile('body',pts,-.34,.27,wood)
box('foot',(0,0,.09),(.75,1.38,.18),dark,.045)
# Warm flat front recess.
pts=[(-.49,.2),(.49,.2),(.49,1.27)]+[(.49*math.cos(math.pi*i/12),1.27+.49*math.sin(math.pi*i/12)) for i in range(1,13)]
profile('front',pts,.275,.30,dark)
arc('red_arch',.61,.15,1.27,.31,neon);arc('amber_arch',.565,.085,1.27,.38,glow)
for y in [-.535,.535]:
 box('red_pillar',(.345,y,.87),(.13,.16,.81),neon)
 box('amber_pillar',(.422,y,.87),(.06,.09,.81),glow,.018)
 box('lower_column',(.34,y,.33),(.18,.21,.39),red)
 for z in [.18,.49,1.27]:box('collar',(.39,y,z),(.22,.24,.1),cream,.023)
# Large half-circle record window.
pts=[(-.385,1.3),(.385,1.3)]+[(.385*math.cos(math.pi*i/12),1.3+.385*math.sin(math.pi*i/12)) for i in range(1,13)]
profile('record_window',pts,.313,.335,dark)
arc('display_rim',.4,.035,1.3,.37,cream)
disk('record',0,1.415,.17,.385,dark);disk('record_label',0,1.415,.072,.41,yellow)
# Oversized crest, six broad song tiles and three red selection buttons.
profile('crest',[(-.10,1.76),(-.075,1.92),(0,1.99),(.075,1.92),(.10,1.76)],.38,.46,red)
box('selector_frame',(.36,0,1.12),(.13,.83,.27),cream)
box('selector_panel',(.437,0,1.12),(.035,.76,.21),dark)
for y in [-.28,-.15,.15,.28]:
 for z in [1.065,1.175]:box('song_tile',(.46,y,z),(.035,.105,.073),wood)
for z in [1.04,1.12,1.2]:box('button',(.49,0,z),(.06,.08,.055),neon)
# Speaker with bold U surround, no fine mesh.
arc('speaker_U_red',.38,.115,.61,.34,neon,True);arc('speaker_U_amber',.34,.07,.61,.41,glow,True)
for y in [-.305,.305]:box('speaker_upright',(.42,y,.755),(.065,.07,.29),glow)
box('speaker',(.35,0,.66),(.07,.45,.46),yellow)
def bar(y1,z1,y2,z2):
 mid=Vector((.414,(y1+y2)/2,(z1+z2)/2));d=Vector((0,y2-y1,z2-z1));o=box('grille',mid,(.055,.045,d.length),cream);o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','X')
for sign in [-1,1]:
 bar(-.20,.48,.20,.85) if sign==1 else bar(-.20,.85,.20,.48)
bar(-.20,.66,0,.88);bar(0,.44,.20,.66)
disk('speaker_badge',0,.61,.085,.46,red)
# Merge all static components by material, keeping one draw call per palette entry.
for m in M.values():
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='jukebox_'+m.name
assets=[o for o in bpy.context.scene.objects if o.type=='MESH']
tris=0
for o in assets:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
print('OK triangles',tris,'meshes',len(assets))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in assets:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Stage excluded from exported asset.
box('stage',(0,0,-.07),(200,200,.1),mat('stage','756776'))
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.18,.28,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
for loc,power,size,color in [((4,-4,7),650,4,(1,.79,.57)),((-3,-1,4),400,5,(.65,.72,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,.97))
if a.view=='game':dist=11;el=math.radians(36);az=math.radians(45)
else:dist=9.2;el=math.radians(18);az=math.radians(28)
cam.location=target+Vector((dist*math.cos(el)*math.cos(az),-dist*math.cos(el)*math.sin(az),dist*math.sin(el)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.angle=math.radians(25);bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:s.render.filepath=a.render;bpy.ops.render.render(write_still=True)
