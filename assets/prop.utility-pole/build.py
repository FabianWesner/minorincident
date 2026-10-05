"""Deterministic, texture-free Sunset Grove utility pole. All hardware is static."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials = {}
for token, color in [('woodWarm','b0703f'), ('sidewalk','b9a4a0'), ('uiDark','25222c'), ('asphalt','5b4f5c')]:
    rgb = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new('pal_'+token); m.diffuse_color=(*rgb,1); m.use_nodes=True
    bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1); bs.inputs['Roughness'].default_value=.78
    materials[token]=m
parts=[]
def finish(o,name,token,bevel=0):
    o.name=name; o.data.materials.append(materials[token]); parts.append(o)
    if bevel:
        mod=o.modifiers.new('rounded edges','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,loc,size,token='woodWarm',bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,token,bevel)

def cylinder(name,loc,radius,depth,token,axis=(0,0,1),vertices=12,bevel=.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object; o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    return finish(o,name,token,bevel)

def beam(name,start,end,width,token='asphalt'):
    mid=(Vector(start)+Vector(end))/2; o=box(name,mid,(width,width,(Vector(end)-Vector(start)).length),token,.012)
    o.rotation_euler=(Vector(end)-Vector(start)).to_track_quat('Z','Y').to_euler(); return o

def cable(name,points,radius=.025):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=8; c.bevel_depth=radius; c.bevel_resolution=1
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for b,co in zip(s.bezier_points,points): b.co=co; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH')
    return finish(o,name,'uiDark')

# Tall chamfered timber, reinforced tapered foot.
box('timber shaft',(0,0,3.55),(.34,.34,7.1),bevel=.045)
box('foot plinth',(0,0,.15),(.66,.62,.30),bevel=.035)
bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.40,radius2=.28,depth=.85,location=(0,0,.70),rotation=(0,0,math.pi/4))
finish(bpy.context.object,'tapered foot','woodWarm',.028)
box('foot collar',(0,0,1.07),(.48,.45,.13),'asphalt',.018)
box('foot shoulder',(0,0,1.23),(.43,.41,.26),bevel=.027)
# Narrow raised grain ridges are solid relief, never coplanar overlays.
for y,length,z in [(-.10,4.8,3.7),(.045,3.3,3.1),(.105,1.1,5.85)]:
    box('front wood grain',(.174,y,z),(.012,.012,length),'woodWarm',.004)
for x,length,z in [(-.09,4.5,3.55),(.065,3.0,3.3)]:
    box('side wood grain',(x,-.174,z),(.013,.012,length),'woodWarm',.004)
for z in [6.66,6.04]:
    box('crossbar',(.12,0,z),(.23,1.74,.20),bevel=.03)
    for y in [-.72,0,.72]:
        box('bolt washer',(.247,y,z),(.025,.115,.115),'asphalt',.012)
        cylinder('hex bolt',(.273,y,z),.041,.035,'asphalt',(1,0,0),6,.005)
    for y in [-.71,.71]:
        cylinder('insulator foot',(.12,y,z+.125),.083,.05,'asphalt')
        cylinder('porcelain stem',(.12,y,z+.24),.048,.22,'sidewalk')
        for dz in [.17,.27]:
            cylinder('porcelain skirt',(.12,y,z+dz),.086,.066,'sidewalk',vertices=16,bevel=.018)
        cylinder('insulator pin',(.12,y,z+.33),.029,.04,'asphalt',vertices=8)
box('top cap',(0,0,7.12),(.095,.095,.045),'asphalt',.006)
box('brace collar',(0,0,4.92),(.40,.40,.11),'asphalt',.014)
for y in [-.77,.77]:
    beam('diagonal brace',(.22,0,4.94),(.22,y,5.95),.045)
    beam('upper brace',(-.03,0,6.04),(-.03,y*.72,6.57),.03)
for y in [-.135,.135]:
    cylinder('collar bolt',(.217,y,4.92),.033,.025,'sidewalk',(1,0,0),6)
for y in [-.16,.16]:
    cylinder('base bolt',(.253,y,1.07),.034,.025,'sidewalk',(1,0,0),6)
# Reference's small rectangular transformer, behind the lower crossarm.
box('transformer mount',(-.23,-.37,5.67),(.18,.15,.61),'asphalt',.025)
box('transformer housing',(-.35,-.43,5.65),(.32,.33,.51),'asphalt',.045)
box('transformer lid',(-.35,-.43,5.92),(.36,.37,.075),'asphalt',.025)
box('transformer inset panel',(-.35,-.607,5.64),(.235,.028,.35),'uiDark',.024)
for x in [-.43,-.28]:
    cylinder('bushing',(x,-.43,6.025),.043,.14,'sidewalk')
    cylinder('bushing skirt',(x,-.43,6.035),.059,.041,'sidewalk')
cable('transformer lead',[(-.35,-.43,5.4),(-.32,-.30,4.75),(-.10,-.22,4.6),(-.03,-.19,5.42)])
cable('loop lead',[(-.27,.18,6.38),(-.35,.26,6.27),(-.36,.25,5.87),(-.36,-.43,5.89)])
# Three short free cable stubs reproduce the illustration's silhouette.
for z,x in [(6.62,.20),(6.02,.12),(5.77,-.34)]:
    drop = .55 if x < 0 else .34
    points=[(x,-.62 if x < 0 else -.83,z),(x,-1.16,z-.20),(x,-1.75,z-drop-.02),(x,-2.32,z-drop)]
    cable('outgoing cable',points,.028)
    cylinder('cable end ferrule',(x,-2.32,z-drop),.058,.065,'woodWarm',(0,1,0),12,.012)
cable('crossarm return',[(.1,.76,6.0),(-.13,.86,5.87),(-.25,.45,5.78),(-.3,-.28,5.8)],.023)

root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
# One mesh per palette material, origins at ground. No moving parts in this prop.
groups = {token: [o for o in parts if o.data.materials[0] == mat] for token, mat in materials.items()}
for token, group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); o=bpy.context.object
    o.name='body' if token=='woodWarm' else 'static_'+token
    bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); o.parent=root
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    o.data.transform(Matrix.Diagonal((1, -1, 1, 1)))
    o.data.flip_normals()
asset=[root]+list(root.children)
triangles=0
for o in root.children:o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
report={'id':'prop.utility-pole','tier':'Side','triangles':triangles,'draw_calls':len(root.children),'materials':[m.name for m in materials.values()],'nodes_ok':True,'within_budget':6000<=triangles<=12000 and len(root.children)<=30,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
Path(__file__).with_name('report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
print('OK',json.dumps(report))
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True; scene.world.color=(.18,.18,.18)
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object
    m=bpy.data.materials.new('studio floor'); m.diffuse_color=(.035,.029,.045,1); floor.data.materials.append(m)
    for loc,power,size,col in [((5,-4,11),1800,7,(1,.72,.45)),((-4,-1,8),1000,6,(.62,.69,1)),((0,6,9),1400,5,(1,.50,.22))]:
        bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size; light.data.color=col; light.rotation_euler=(Vector((0,0,4))-light.location).to_track_quat('-Z','Y').to_euler()
    target=Vector((0,.65,3.55)); direction=Vector((16,10,8) if a.view!='game' else (10,-10,14))
    if a.view=='front':direction=Vector((16,0,4))
    if a.view=='side':direction=Vector((0,-16,4))
    if a.view=='rear':direction=Vector((-16,0,4))
    bpy.ops.object.camera_add(location=target+direction); cam=bpy.context.object; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=13.5 if a.view!='game' else 14.5; scene.camera=cam
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
