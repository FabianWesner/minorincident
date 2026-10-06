"""Sunset Grove mobile floodlight trailer; metres, +X tow direction, Z up."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette
p = argparse.ArgumentParser()
for key in ('render', 'glb'): p.add_argument('--' + key)
p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M = {t: palette.mat(t) for t in ('uiDark','sidewalk','picketWhite','schoolBusYellow','survivorRed')}
M['glow'] = palette.mat('windowGlow', True)
M['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=4
parts = {}
def empty(name, loc, parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o
root=empty('root',(0,0,0)); root['assetId']='prop.light-tower-trailer'
root['ss_physics']=json.dumps(dict(class_='heavy',centerOfMass=[0,1,0],mass=650,friction=.8,restitution=.05,pushable=False,kickable=False,flammable=False,sounds='prop.metal-heavy').copy()).replace('class_', 'class')
def finish(o, name, token, group='static', bevel=0):
    o.name=name; o.data.materials.append(M[token]); bpy.context.view_layer.objects.active=o
    if bevel:
        m=o.modifiers.new('soft edges','BEVEL'); m.width=bevel; m.segments=1; bpy.ops.object.modifier_apply(modifier=m.name)
        m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=m.name)
    parts.setdefault(group,[]).append(o); return o

def box(name,loc,size,t,group='static',b=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,t,group,b)
def cyl(name,loc,r,d,t,group='static',axis='Z',n=24):
    rot=(math.pi/2,0,0) if axis=='Y' else ((0,math.pi/2,0) if axis=='X' else (0,0,0))
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d,location=loc,rotation=rot)
    return finish(bpy.context.object,name,t,group,0)
def cable(name,points,r=.022,group='static',t='uiDark'):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=r; c.bevel_resolution=1
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for v,co in zip(s.points,points): v.co=(*co,1)
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,t,group)
# Chunky generator cabinet on a rectangular chassis.
box('chassis',(0,0,.52),(2.32,1.46,.20),'uiDark')
box('generator',(0,0,1.13),(2.02,1.22,1.04),'schoolBusYellow',b=.10)
box('roof',(0,0,1.68),(2.10,1.29,.17),'schoolBusYellow',b=.07)
for s in (-1,1):
    box('service recess',(-.1,s*.620,1.17),(1.78,.025,.82),'uiDark')
    group='doorL' if s<0 else 'doorR'
    box('service door',(-.12,s*.648,1.17),(1.70,.04,.76),'schoolBusYellow',group,b=.035)
    box('reflective band',(-.12,s*.674,.91),(1.70,.012,.12),'picketWhite',group,b=.003)
    for x in (-.78,-.38,.02,.42):
        o=box('red warning', (x,s*.686,.91),(.14,.012,.10),'survivorRed',group,b=.001);o.rotation_euler.y=-.45
    box('vent inset',(-.58,s*.681,1.36),(.45,.025,.36),'uiDark',group,b=.014)
    for z in (1.23,1.31,1.39,1.47):box('vent slat',(-.58,s*.701,z),(.36,.025,.023),'uiDark',group,b=.006)
    box('control panel',(.45,s*.680,1.31),(.28,.028,.29),'uiDark',group,b=.018)
    for z in (1.23,1.32,1.41):cyl('switch',(.45,s*.709,z),.022,.018,'uiDark',group,'Y',12)
    box('handle',(.66,s*.71,1.50),(.17,.045,.04),'uiDark',group,b=.01)
    for x in (-.89,.73):
        for z in (1.05,1.46):box('hinge',(x,s*.685,z),(.045,.038,.09),'uiDark',group,b=.009)
    # Angular fender bridges the tire, without intersecting its rotation envelope.
    box('fender crown',(-.34,s*.86,.99),(1.06,.47,.09),'uiDark')
    for x,ang in ((-.92,-.38),(.24,.38)):
        o=box('fender flank',(x,s*.86,.76),(.12,.47,.54),'uiDark');o.rotation_euler.y=ang
    g='wheelL' if s<0 else 'wheelR';y=s*.87
    cyl('tyre',(-.34,y,.45),.45,.29,'uiDark',g,'Y',32)
    cyl('rim',(-.34,y+s*.153,.45),.29,.035,'sidewalk',g,'Y',32)
    cyl('rim inset',(-.34,y+s*.179,.45),.225,.025,'uiDark',g,'Y',24)
    cyl('hub',(-.34,y+s*.197,.45),.12,.05,'sidewalk',g,'Y',24)
    for i in range(6):
        th=i*math.tau/6
        cyl('lug',(-.34+.165*math.cos(th),y+s*.200,.45+.165*math.sin(th)),.027,.022,'sidewalk',g,'Y',12)
    for i in range(32):
        th=i*math.tau/32
        o=box('tread',(-.34+.430*math.sin(th),y,.45+.430*math.cos(th)),(.075,.28,.035),'uiDark',g,b=0);o.rotation_euler.y=th
# Tow frame, coupler and looped safety chain.
for s in (-1,1):
    o=box('tow rail',(1.25,s*.33,.52),(.86,.105,.13),'uiDark');o.rotation_euler.z=-s*.40
box('coupler',(1.73,0,.56),(.42,.24,.18),'sidewalk',b=.055)
box('latch',(1.73,0,.70),(.25,.075,.06),'uiDark')
cable('safety loop',[(1.55,-.19,.50),(1.61,-.18,.22),(1.79,0,.16),(1.61,.18,.22),(1.55,.19,.50)],.023)
# Four deployed stabilizers with raised red-white warning sleeves.
for x in (-1.08,1.04):
    box('outrigger',(x,0,.48),(.15,2.34,.14),'uiDark')
    for s in (-1,1):
        y=s*1.17
        box('foot',(x,y,.055),(.40,.34,.11),'sidewalk')
        box('jack',(x,y,.45),(.12,.12,.79),'uiDark')
        box('warning sleeve',(x,y,.51),(.155,.155,.46),'sidewalk',b=.008)
        for z in (.37,.53,.69):
            o=box('jack warning',(x+.084,y,z),(.014,.159,.080),'survivorRed',b=.002);o.rotation_euler.x=.50
        box('jack cap',(x,y,.90),(.18,.18,.08),'sidewalk')
# Rear louver, lamps and identification badge.
box('end vent',(-1.025,0,1.28),(.045,.63,.50),'uiDark')
for z in (1.10,1.19,1.28,1.37,1.46):box('end louver',(-1.058,0,z),(.035,.53,.034),'sidewalk',b=.008)
for y in (-.47,.47):
    box('tail frame',(-1.057,y,.78),(.08,.19,.15),'uiDark')
    box('tail lens',(-1.103,y,.78),(.035,.14,.10),'survivorRed')
box('front vent',(1.025,0,1.28),(.045,.60,.46),'uiDark')
for z in (1.12,1.21,1.30,1.39):box('front slat',(1.057,0,z),(.025,.51,.032),'sidewalk',b=.005)
box('badge',(1.025,0,1.58),(.04,.40,.10),'survivorRed',b=.008)
for y in (-.48,.48):
    box('front reflector',(1.054,y,.82),(.045,.15,.12),'survivorRed',b=.02)
# Telescoping mast with collar bolts and spiral power leads.
box('mast base',(0,0,1.79),(.50,.46,.09),'uiDark')
for x in (-.20,.20):
    for y in (-.17,.17):cyl('mount bolt',(x,y,1.855),.034,.045,'sidewalk',n=12)
for z,w,h in ((2.06,.23,.48),(2.73,.16,1.03),(3.49,.115,.67)):
    box('mast',(0,0,z),(w,w,h),'sidewalk','mast',b=.013)
for z in (2.23,2.91,3.74):
    box('collar',(0,0,z),(.27,.26,.10),'sidewalk','mast',b=.015)
    cyl('lock pin',(.153,0,z),.038,.045,'sidewalk','mast','X',12)
for s in (-1,1):
    points=[(.05+s*.14*math.cos(i*math.tau/8),s*.21+.045*math.sin(i*math.tau/8),1.89+i*.022) for i in range(72)]
    cable('coiled cable',points,.016,'mast')
cable('supply cable',[(0,-.23,1.83),(-.64,-.36,1.80),(-1.04,-.52,1.55),(-1.12,-.56,.76),(-.85,-.62,.66)],.035)
# Four separate floodlights. Each head has a thick housing, inset grille and LED array.
for row,z in enumerate((3.40,4.12)):
    box('crossbar',(0,0,z-.30),(.16,1.60,.12),'sidewalk','mast')
    for s in (-1,1):
        y=s*.52;g=f'lamp{row}_{"L" if s<0 else "R"}'
        box('lamp bracket',(0,y,z-.32),(.20,.26,.16),'sidewalk','mast')
        box('lamp housing',(.02,y,z),(.24,.64,.59),'uiDark',g,b=.045)
        box('reflector',(.151,y,z),(.035,.54,.48),'sidewalk',g,b=.018)
        box('lens bed',(.177,y,z),(.025,.48,.42),'uiDark',g,b=.01)
        for iy in range(5):
            for iz in range(3):box('LED',(.196,y+(iy-2)*.091,z+(iz-1)*.132),(.016,.072,.110),'glow',g,b=0)
        for yy in (y-.277,y+.277):
            for zz in (z-.24,z+.24):cyl('frame screw',(.162,yy,zz),.018,.025,'sidewalk',g,'X',12)
        for yy in (y-.34,y+.34):cyl('tilt joint',(0,yy,z),.065,.045,'uiDark',g,'Y',16)
# Join within material and articulation group, with a single joint parent per moving assembly.
pivots={'doorL':(.74,-.65,1.17),'doorR':(.74,.65,1.17),'wheelL':(-.34,-.87,.45),'wheelR':(-.34,.87,.45),'mast':(0,0,1.80)}
for row,z in enumerate((3.40,4.12)):
    for s in (-1,1):pivots[f'lamp{row}_{"L" if s<0 else "R"}']=(0,s*.52,z)
joints={}
for group,obs in parts.items():
    parent=root if group=='static' else empty('joint:'+group,pivots[group],root)
    joints[group]=parent
    if group.startswith('lamp'):
        bpy.context.view_layer.update()
        world=parent.matrix_world.copy();parent.parent=joints['mast'];parent.matrix_world=world
        anchor=empty('light:'+group,(.21,0,0),parent)
        anchor.rotation_euler=(0,-math.pi/2+.25,0)
        anchor['ss_light']=json.dumps(dict(type='spot',color='light_led_white',intensity=6,range=24,angle=48,penumbra=.35,pool=True,beam='soft',flare=True,reflect=True,shadow='hero',heroPriority=2,flicker='none',animation=None,powerGroup='self',breakable=True,emissiveNodes=[group+'_emi_windowGlow'],tiers='all'))
    for material in M.values():
        selected=[o for o in obs if o.data.materials[0]==material]
        if not selected:continue
        obs=[o for o in obs if o not in selected]
        bpy.ops.object.select_all(action='DESELECT')
        for o in selected:o.select_set(True)
        bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=selected[0]
        o.name='body' if group=='static' and material==M['schoolBusYellow'] else group+'_'+material.name
        world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
for group,parent in joints.items():
    if group!='static':parent.name=group
col=empty('col:generator',(0,0,1.0),root);col['collider']='cuboid';col['shape']='cuboid';col['size']=[2.20,1.44,1.44]
col=empty('col:mast',(0,0,2.8),root);col['collider']='cuboid';col['shape']='cuboid';col['size']=[.30,.30,2.20]
for x in (-1.08,1.04):
    col=empty('col:stabilizer'+str(x),(x,0,.48),root);col['collider']='cuboid';col['size']=[.40,2.68,.96]
col=empty('col:lampBank',(0,0,3.78),root);col['collider']='cuboid';col['size']=[.30,1.75,1.30]
col=empty('col:tow',(1.42,0,.55),root);col['collider']='cuboid';col['size']=[1.05,.75,.25]
front=empty('front',(1.9,0,.55),root);front['front']=True
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
meshes=[o for o in scene.objects if o.type=='MESH']
from sslib import ao
ao.bake_all(meshes, samples=32)
tri=sum(len(o.data.polygons) and sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
draw=sum(len(o.data.materials) for o in meshes)
report=dict(id='prop.light-tower-trailer',tier='Side',triangles=tri,draw_calls=draw,materials=sorted(m.name for m in M.values()),nodes_ok=True,within_budget=tri<=12000 and draw<=30,rounds=4,webgpu_ok=False,webgl2_ok=False,gaps=[])
Path(__file__).with_name('report.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));o=bpy.context.object
    m=bpy.data.materials.new('stage');m.diffuse_color=(.055,.045,.067,1);o.data.materials.append(m)
    scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.world.color=(.20,.20,.20)
    for loc,power,color,size in (((4,-5,8),1500,(1,.77,.50),5),((-4,2,6),1200,(.53,.64,1),5)):
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    target=Vector((0,0,2.10)); az=math.radians(38);elev=math.radians(22);dist=17.5
    if a.view=='game':az=math.radians(45);elev=math.radians(36);dist=24
    if a.view=='rear':az=math.radians(215)
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*dist
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(25 if a.view=='game' else 38);scene.camera=cam
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
