"""Deterministic, texture-free fire axe. +X points toward its cutting head."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib import ao, palette
HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
for key in ('render', 'glb'): p.add_argument('--' + key)
p.add_argument('--view', default='ref')
for key, default in [('samples',24), ('width',960), ('height',540)]:
    p.add_argument('--'+key, type=int, default=default)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.render.engine='CYCLES'
def mat(token, metal=0, rough=.48):
    if token != 'stage':
        m=palette.mat(token)
    else:
        m=bpy.data.materials.new('stage'); m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value=(.024,.020,.030,1)
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
    return m
wood=mat('woodWarm'); red=mat('survivorRed',.28,.34)
steel=mat('sidewalk',.55,.38); rubber=mat('uiDark',0,.7)
grain=mat('brick'); tarnish=mat('asphalt',.5)
def mesh(name, vertices, faces, material, bevel=0):
    me=bpy.data.meshes.new(name); me.from_pydata(vertices,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); me.materials.append(material)
    if bevel:
        mod=o.modifiers.new('soft forged edges','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
# Cross sections of the curved oval timber handle; the broad heel hooks downward.
def center(x): return .228+.025*((x+.1)/.65)**2-.045*max(0,(-x-.34)/.2)**2

def sweep(name, xs, material, ry=.026, rz=.032):
    verts=[]; n=16
    for x in xs:
        flare=1+.32*max(0,(-x-.35)/.2)
        for j in range(n):
            t=2*math.pi*j/n; verts.append((x,ry*flare*math.cos(t),center(x)+rz*flare*math.sin(t)))
    faces=[tuple(reversed(range(n))),tuple((len(xs)-1)*n+j for j in range(n))]
    for i in range(len(xs)-1):
        for j in range(n): faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    return mesh(name,verts,faces,material,.002)
sweep('hickory handle',[-.55+i*.94/32 for i in range(33)],wood)
for i in range(6):
    x=-.51+i*.046
    sweep('rubber wrap', [x,x+.003,x+.039,x+.043],rubber,.029,.036)
# A real lanyard hole passes through the handle heel and last rubber wrap.
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.010,depth=.18,location=(-.487,0,center(-.487)),rotation=(math.pi/2,0,0))
cutter=bpy.context.object
for o in list(scene.objects):
    if o.type=='MESH' and o!=cutter and ('handle' in o.name or 'wrap' in o.name):
        mod=o.modifiers.new('lanyard bore','BOOLEAN'); mod.object=cutter; mod.operation='DIFFERENCE'
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
# Head profile: tall rectangular poll, narrowed waist, and flared cutting skirt.
def profile(name, coords, widths, material, bevel):
    v=[(x,s*w,z) for s in (-1,1) for (x,z),w in zip(coords,widths)]
    n=len(coords); f=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    f += [(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    return mesh(name,v,f,material,bevel)
profile('painted axe head',[(.310,.334),(.400,.334),(.435,.171),(.454,.077),(.263,.077),(.324,.185)], [.032]*6,red,.005)
profile('sharpened skirt',[(.263,.077),(.454,.077),(.476,.012),(.380,0),(.372,.012),(.368,0),(.249,.012)], [.032,.032,.006,.004,.004,.004,.006],steel,.0015)
profile('exposed top wedge',[(.325,.334),(.377,.334),(.378,.358),(.334,.361)],[.022]*4,steel,.003)
# Red paint continues onto the neck of the timber.
sweep('painted neck',[.245,.29,.34],red,.027,.033)
# Deliberate longitudinal grain ridges, proud by 3.5 mm of the timber.
for j in range(3):
    xs=[-.20+j*.025+i*(.43-j*.035)/12 for i in range(13)]; theta=math.pi*.16+j*.22
    v=[]
    for i,x in enumerate(xs):
        t=theta+.085*math.sin(i*.65+j)
        width=.008*math.sin(math.pi*(i+.3)/12.6)
        for dt in (-width,width):v.append((x,.0295*math.cos(t+dt),center(x)+.0355*math.sin(t+dt)))
    mesh('wood grain',v,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(12)],grain)
# Irregular paint losses and forged scratches, 3.5 mm proud on both cheeks.
for side in (-1,1):
    for x,z,s in [(.327,.306,.008),(.388,.287,.005),(.335,.188,.004),(.414,.090,.010),(.296,.095,.008),(.344,.083,.007)]:
        points=[(x-s,z),(x-s*.65,z+s*.8),(x-s*.1,z+s*.55),(x+s*.4,z+s*.95),(x+s*.55,z-s*.5),(x,z-s*.7)]
        mesh('paint chip',[(x,side*.0355,z) for x,z in points],[tuple(range(6))],steel)
    for x,z in [(.353,.252),(.327,.137),(.387,.213)]:
        mesh('forged scratch',[(x,side*.0355,z),(x+.002,side*.0355,z+.019),(x+.004,side*.0355,z+.002)],[(0,1,2)],tarnish)
    # Paint tongues interrupt the straight boundary of the exposed cutting skirt.
    for x,w,d in [(.284,.010,.012),(.324,.008,.009),(.390,.009,.018),(.436,.007,.011)]:
        points=[(x-w,.077),(x+w,.077),(x+w*.4,.077-d*.5),(x,.077-d),(x-w*.5,.077-d*.6)]
        verts=[(x,side*(.032-(.077-z)*.4+.0035),z) for x,z in points]
        mesh('ragged paint edge',verts,[tuple(range(5))],red)
# Merge every static piece by material; sockets remain separate empties.
root=bpy.data.objects.new('root',None); scene.collection.objects.link(root); root['asset_id']='wpn.fire-axe'
for m in [wood,red,steel,rubber,grain,tarnish]:
    objs=[o for o in scene.objects if o.type=='MESH' and o.data.materials[0]==m]
    if not objs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name='body' if m==red else m.name; o.parent=root
    o.data.materials.clear(); o.data.materials.append(m)
    for face in o.data.polygons: face.material_index=0
for name,loc in [('grip',(-.37,0,center(-.37))),('tip',(.37,0,.005)),('front',(.47,0,.012))]:
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;o.parent=root
# Center the complete silhouette in X/Y; keep the edge grounded at z=0.
for o in root.children:
    if o.type=='MESH':
        for v in o.data.vertices: v.co.x+=.037
    else: o.location.x+=.037
objs=[o for o in scene.objects if o.type=='MESH']
ao.bake_all(objs, samples=32)
triangles=0
for o in objs:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
report={'id':'wpn.fire-axe','tier':'Side','triangles':triangles,'draw_calls':len(objs),'materials':sorted({m.name for o in objs for m in o.data.materials}),'nodes_ok':all(n in bpy.data.objects for n in ('root','grip','tip','front')),'within_budget':triangles<=6000 and len(objs)<=30}
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
if a.render:
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.14,.14,.14)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.007));bpy.context.object.data.materials.append(mat('stage'))
    target=Vector((0,0,.18))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((0,1,2),150,2,(1,.8,.63)),((1,-1,1),90,1.5,(.64,.72,1)),((-1,-.5,1.4),160,1,(1,.62,.36))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(.35,3,1.1),'game':(2,2,3),'front':(3,0,.9),'side':(0,3,.8),'rear':(-1,-3,1)}
    bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=1.38;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.25
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=views['game'];aim(cam);scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).with_name('game.png' if Path(a.render).name=='hero.png' else Path(a.render).stem+'-game.png').resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
