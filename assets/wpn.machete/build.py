"""Sunset Grove machete: metre-scale rigid weapon, blade forward along +X."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion

p = argparse.ArgumentParser()
for flag in ('render', 'glb'): p.add_argument('--'+flag)
p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
root['asset_id'] = 'wpn.machete'
M = {}
for token, h, metal, rough in [('uiDark','25222c',0,.8),('asphalt','5b4f5c',0,.8),('sidewalk','b9a4a0',.65,.42),('picketWhite','f2e6dc',.7,.28),('woodWarm','b0703f',.55,.4),('blood','b3121f',0,.46),('survivorRed','d9363e',0,.42)]:
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    c = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new('pal_'+token); m.diffuse_color=(*c,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*c,1); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough; M[token]=m

def finish(o, name, token, bevel=0):
    o.name=name; o.data.materials.append(M[token]); o.parent=root
    bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=3; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def mesh(name, verts, faces, token):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); return finish(o,name,token)

def box(name, loc, size, token, bevel=.005):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return finish(o,name,token,bevel)

def polygon(name, pts, z, depth, token):
    if token in ('blood','survivorRed'):
        depth=z+depth-.045; z=.045
    n=len(pts); vs=[(x,y,z) for x,y in pts]+[(x,y,z+depth) for x,y in pts]
    return mesh(name,vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],token)

# Long straight spine with a broad curved cutting belly and a swept pointed tip.
outline=[(-.20,-.047),(.12,-.056),(.30,-.064),(.405,-.058),(.465,-.042),(.50,-.014),(.455,.045),(.385,.086),(.29,.090),(.16,.078),(.015,.062),(-.20,.047)]
inner=[(-.196,-.038),(.12,-.047),(.30,-.055),(.402,-.049),(.452,-.033),(.482,-.014),(.446,.035),(.380,.073),(.29,.077),(.16,.065),(.015,.049),(-.196,.034)]
n=len(outline)
verts=[(x,y,.037) for x,y in outline]+[(x,y,.046) for x,y in inner]+[(x,y,.028) for x,y in inner]
mesh('blade polished cutting bevel',verts,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]+[(i,(i+1)%n,(i+1)%n+2*n,i+2*n) for i in range(n)],'picketWhite')
polygon('blade steel',inner,.028,.018,'sidewalk')
# A restrained broad longitudinal grind facet, clear of the cutting edge.
polygon('blade grind facet',[(-.19,.016),(.15,.043),(.29,.053),(.38,.047),(.44,.014),(.29,.063),(.15,.058),(-.19,.031)],.049,.001,'picketWhite')
box('tang',(-.31,0,.036),(.25,.047,.039),'sidewalk')
box('wrapped handle',(-.335,0,.035),(.255,.067,.070),'uiDark',.016)
box('rounded pommel',(-.459,0,.034),(.052,.080,.068),'uiDark',.014)
box('pommel trim',(-.477,0,.034),(.012,.075,.060),'woodWarm',.006)
box('oval guard',(-.205,0,.037),(.030,.123,.054),'sidewalk',.013)
box('guard underside',(-.218,0,.037),(.008,.110,.041),'woodWarm',.004)
# Broad overlapping wrap bands with diagonal ends rather than texture noise.
for i,x in enumerate([-.429,-.382,-.329,-.274]):
    o=box('wrap band',(x,0,.040),(.020,.074,.080),'asphalt',.006); o.rotation_euler.z=-.10
for x,r in [(-.438,.013),(-.278,.007)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=r,depth=.009,location=(x,0,.078))
    finish(bpy.context.object,'copper rivet','woodWarm',.002)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r*.48,depth=.004,location=(x,0,.084))
    finish(bpy.context.object,'rivet inset','asphalt',.001)
# Raised red spatters: deterministic irregular shapes, all >=3mm above steel.
rng=random.Random(28)
polygon('large blood splash',[(.265,.066),(.29,.029),(.32,.039),(.344,.007),(.371,.018),(.379,.044),(.422,.045),(.404,.064),(.368,.077),(.324,.077),(.306,.058)],.054,.0015,'survivorRed')
polygon('blood streak',[(.19,-.037),(.235,-.023),(.276,-.005),(.33,.017),(.34,.030),(.30,.025),(.255,.005),(.225,-.020),(.192,-.028)],.058,.0015,'blood')
droplets=[]
for i in range(90):
    x=rng.uniform(-.175,.442); y=rng.uniform(-.027,.028)
    r=rng.uniform(.002,.008)
    if -.185<x<-.063 or .023<x<.176 or .175<x<.445:continue
    if any(math.hypot(x-dx,y-dy)<r+dr+.003 for dx,dy,dr in droplets):continue
    droplets.append((x,y,r))
    pts=[]
    for j in range(7):
        th=j*math.tau/7; rr=r*rng.uniform(.65,1.3); pts.append((x+rr*math.cos(th),y+rr*math.sin(th)))
    polygon('blood droplets',pts,.054,.0015,'survivorRed' if i%3 else 'blood')
polygon('heel blood stain',[(-.17,.027),(-.155,.01),(-.12,.019),(-.105,-.005),(-.077,.015),(-.083,.047),(-.12,.039),(-.145,.035)],.054,.001,'blood')
polygon('middle blood stain',[(.04,.038),(.08,.015),(.10,.025),(.13,.010),(.145,.046),(.16,.061),(.125,.054),(.10,.065),(.07,.045)],.054,.001,'survivorRed')

# One exported primitive per material, with required melee attachment markers.
for token,m in M.items():
    obs=[o for o in bpy.data.objects if o.type=='MESH' and o.data.materials[0]==m]
    if not obs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name='static_'+token
    ao=obs[0].data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    for c in ao.data:c.color=(1,1,1,1)
for name,loc in [('grip',(-.335,0,.035)),('tip',(.50,-.014,.037))]:
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=root; o.location=loc
bpy.context.scene.unit_settings.system='METRIC'
meshes=[o for o in bpy.data.objects if o.type=='MESH']
# Bake ambient occlusion into the glTF vertex-color attribute.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True); o.data.color_attributes.active_color=o.data.color_attributes['ao']
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO')
for o in meshes:o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in meshes)
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    Path(__file__).with_name('metrics.json').write_text(json.dumps({'triangles':triangles,'draw_calls':len(meshes),'materials':[m.name for m in M.values()]}))
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.world.color=(.08,.08,.08)
    stage=bpy.data.materials.new('stage');stage.diffuse_color=(.045,.037,.055,1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003));bpy.context.object.data.materials.append(stage)
    target=Vector((.015,0,.035))
    for loc,power,color,size in [((.2,-1,1.8),16,(1,.79,.59),1.4),((-.8,.3,1.2),10,(.62,.68,1),1),((.8,.8,1),12,(1,.51,.25),.8)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object
    cam.location=target+Vector((.48,-.85,1.4) if a.view!='game' else (1,-1,1.5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();
    if a.view!='game':cam.rotation_euler=(cam.rotation_euler.to_quaternion() @ Quaternion((0,0,1),math.radians(-65))).to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=1.5 if a.view!='game' else 1.45;scene.camera=cam
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render
    bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles')
