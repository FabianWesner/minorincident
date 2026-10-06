"""Courier long-john cargo bicycle; deterministic metres, +X forward, Z up.
Rebuild: python3 experiment/tools/blender_run.py ../assets/veh.courier-bike assets/veh.courier-bike/build.py -- --glb assets/veh.courier-bike/model.glb
Review: same command with --render assets/veh.courier-bike/renders/hero.png --width 1600 --height 900 --samples 96
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'veh.courier-bike', 'category': 'vehicle'}
p = argparse.ArgumentParser()
p.add_argument('--glb'); p.add_argument('--render'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24); p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

def build(level=0):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    mats = {t: palette.mat(t) for t in ['orange','backpackTeal','uiDark','asphalt','silver','picketWhite','redDark']}
    mats['lamp'] = palette.mat('windowGlow', emissive=True)
    for token, m in mats.items():
        m.use_backface_culling = True
        bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Roughness'].default_value = .52
        if token == 'silver': bs.inputs['Metallic'].default_value = .65
    parts=[]; groups=[]
    n = [24,8,8][level]; tube_n=[8,4,4][level]
    def empty(name, loc=(0,0,0), parent=None):
        o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
        if parent: o.parent=parent
        return o
    root=empty('root'); root['asset_id']=ASSET['id']; root['forward']='+X'
    root['ss_physics']=json.dumps({'class':'light','mass':38,'friction':.75,'restitution':.1,'pushable':True,'kickable':False,'vaultable':False,'flammable':False,'sounds':'prop.metal-light'})
    body=empty('body',parent=root); groups.append(body)
    def group(name,loc):
        o=empty(name,loc,root); groups.append(o); return o
    front=group('wheelF',(1.035,0,.335)); rear=group('wheelR',(-.94,0,.405))
    seat=group('seat',(-.58,0,1.115)); basket=group('basket',(.43,0,.37))
    handle=group('handlebar',(-.015,0,1.17)); lamps=group('lightsFront',(1.10,0,.78))
    def finish(o,name,token,parent,bevel=0):
        o.name=name; o.data.materials.append(mats[token])
        if bevel and level==0:
            mod=o.modifiers.new('soft edge','BEVEL'); mod.width=bevel; mod.segments=2 if name in ['cargo side','cargo end','cargo lid','saddle'] else 1
            bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
        parts.append(o); return o
    def box(name,loc,size,token='orange',parent=body,bevel=.012):
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        return finish(o,name,token,parent,min(bevel,min(size)*.3))
    def tube(name,start,end,r,token='orange',parent=body,verts=None):
        s,e=Vector(start),Vector(end)
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts or tube_n,radius=r,depth=(e-s).length,location=(s+e)/2)
        o=bpy.context.object; o.rotation_euler=(e-s).to_track_quat('Z','Y').to_euler()
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        return finish(o,name,token,parent)
    def ring(name,loc,r,minor,token,parent,arc=None):
        # Closed toroidal ribbon including end caps for mudguards.
        count=n if arc is None else max(4,n//2)
        cross=[6,3,3][level]; start,end=(0,math.tau) if arc is None else arc
        vertices=[]; faces=[]
        for i in range(count+1):
            ang=start+(end-start)*i/count
            for j in range(cross):
                theta=math.tau*j/cross
                radius=r+minor*math.cos(theta)
                vertices.append((loc[0]+radius*math.cos(ang),loc[1]+minor*math.sin(theta),loc[2]+radius*math.sin(ang)))
        for i in range(count):
            for j in range(cross):
                k=i*cross+j; k2=i*cross+(j+1)%cross
                faces.append((k,k2,k2+cross,k+cross))
        if arc:
            faces += [tuple(reversed(range(cross))),tuple(count*cross+j for j in range(cross))]
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],faces); mesh.update()
        o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
        bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
        return finish(o,name,token,parent)
    if level==2:
        # Explicit distant silhouette: closed cargo block and intact eight-sided wheels.
        box('cargo silhouette',(.43,0,.62),(1.08,.69,.52),'orange',basket,0)
        for side in [-1,1]:
            y=side*.349
            verts=[(-.005,y,.44),(.87,y,.44),(.87,y,.81),(-.005,y,.81)]
            mesh=bpy.data.meshes.new('teal distant panel'); mesh.from_pydata(verts,[],[(0,1,2,3) if side<0 else (3,2,1,0)]); mesh.update()
            o=bpy.data.objects.new('teal distant panel',mesh); bpy.context.collection.objects.link(o); finish(o,'teal distant panel','backpackTeal',basket)
        for name,start,end,r in [
            ('spine',(-.47,0,.30),(.94,0,.30),.04),
            ('seat tube',(-.47,0,.30),(-.58,0,1.10),.035),
            ('down tube',(-.47,0,.30),(-.04,0,1.16),.038),
            ('fork',(1.035,0,.335),(.85,0,.95),.032),
            ('rear stay',(-.47,0,.30),(-.94,0,.405),.032)]:
            tube(name,start,end,r)
        box('saddle',(-.58,0,1.115),(.32,.24,.09),'uiDark',seat,0)
        tube('handlebar',(-.11,-.335,1.17),(-.11,.335,1.17),.027,'uiDark',handle)
        box('rack',(-.99,0,.88),(.43,.32,.026),'uiDark',bevel=0)
        tube('stand',(-.10,0,.32),(-.19,.25,.016),.018,'uiDark')
        tube('lamp',(1.06,0,.78),(1.13,0,.78),.058,'uiDark',lamps,4)
        tube('lamp face',(1.134,0,.78),(1.142,0,.78),.046,'lamp',lamps,4)
        for parent,r in [(front,.335),(rear,.405)]:
            x,_,z=parent.location
            ring('tire',(x,0,z),r-.038,.038,'uiDark',parent)
            # A closed flat annular rim, front and back, with single-sided materials.
            verts=[]; faces=[]
            for side in [-1,1]:
                base=len(verts)
                for radius in [r-.088,r-.062]:
                    verts +=[(x+radius*math.cos(i*math.tau/8),side*.018,z+radius*math.sin(i*math.tau/8)) for i in range(8)]
                for i in range(8):
                    j=(i+1)%8; f=(base+i,base+j,base+8+j,base+8+i)
                    faces.append(f if side>0 else tuple(reversed(f)))
            mesh=bpy.data.meshes.new('distant rim'); mesh.from_pydata(verts,[],faces); mesh.update()
            o=bpy.data.objects.new('distant rim',mesh); bpy.context.collection.objects.link(o); finish(o,'distant rim','silver',parent)
            tube('hub',(x,-.05,z),(x,.05,z),.035,'silver',parent,4)
            tube('spoke cross',(x,0,z-r+.078),(x,0,z+r-.078),.008,'silver',parent,4)
    else:
        # Open-frame cargo cycle: box sits ahead of rider, ahead of crank.
        crank=(-.47,0,.30); steering=(.93,0,.76)
        tube('low cargo spine',(-.47,0,.30),(.91,0,.30),.041)
        tube('seat tube',crank,(-.66,0,1.04),.037)
        tube('down tube',crank,(-.075,0,.98),.039)
        tube('head tube',(-.08,0,.85),(-.01,0,1.065),.043)
        for s in [-1,1]:
            tube('chain stay',(-.47,s*.05,.30),(-.94,s*.085,.405),.023)
            tube('seat stay',(-.66,s*.035,.95),(-.94,s*.085,.405),.022)
            tube('cargo support',(.02,s*.24,.34),(.86,s*.24,.34),.024)
            tube('cargo crossbar',(.03,-.27,.34),(.03,.27,.34),.018)
            tube('front fork',(1.035,s*.075,.335),(.92,s*.09,.79),.026)
        tube('fork crown',(.92,-.10,.78),(.92,.10,.78),.035)
        tube('steerer',(.92,0,.72),(.85,0,.95),.028)
        # Steering linkage below box, tube handlebar, grips, levers and cables.
        tube('steering rod',(-.11,-.12,.32),(.98,-.12,.36),.013,'silver')
        tube('stem',(-.01,0,1.065),(-.045,0,1.16),.025,'silver',handle)
        for s in [-1,1]:
            tube('bar',(-.045,0,1.16),(-.11,s*.22,1.18),.018,'silver',handle)
            tube('grip',(-.11,s*.22,1.18),(-.15,s*.335,1.17),.024,'uiDark',handle)
            if level<2:
                tube('brake lever',(-.095,s*.22,1.15),(-.02,s*.30,1.145),.008,'silver',handle)
                tube('brake cable',(-.09,s*.17,1.15),(.04,s*.12,1.02),.005,'uiDark',handle)
        # Lidded orange cargo tub and independently raised teal side panels.
        box('cargo floor',(.43,0,.37),(1.02,.68,.085),'orange',basket,.025)
        for s in [-1,1]:
            box('cargo side',(.43,s*.325,.62),(1.04,.055,.46),'orange',basket,.026)
            box('inner lining',(.43,s*.288,.62),(.95,.012,.36),'uiDark',basket,.005)
            box('teal side inset',(.43,s*.358,.62),(.87,.018,.37),'backpackTeal',basket,.018)
            tube('top rim',(-.10,s*.325,.865),(.96,s*.325,.865),.025,'orange',basket)
            if level==0:
                for x in [-.025,.885]:
                    tube('panel rivet',(x,s*.369,.46),(x,s*.379,.46),.011,'silver',basket,8)
        for x in [-.095,.955]:
            box('cargo end',(x,0,.62),(.055,.66,.46),'orange',basket,.018)
            box('end interior',(x+(.035 if x<0 else -.035),0,.62),(.012,.57,.35),'uiDark',basket,.002)
            tube('end top rail',(x,-.325,.865),(x,.325,.865),.025,'orange',basket)
        box('tub interior floor',(.43,0,.422),(.94,.58,.013),'asphalt',basket,.003)
        box('cargo lid',(.43,0,.866),(.96,.58,.043),'orange',basket,.018)
        for x in [-.025,.885]:
            box('lid latch',(x,0,.907),(.032,.10,.035),'uiDark',basket,.008)
        for s in [-1,1]:
            y=s*.371
            verts=[(.855,y,.435),(.855,y,.805),(.49,y,.805),(.74,y,.435)]
            mesh=bpy.data.meshes.new('diagonal courier panel'); mesh.from_pydata(verts,[],[(0,1,2,3) if s<0 else (3,2,1,0)]); mesh.update()
            o=bpy.data.objects.new('diagonal courier panel',mesh); bpy.context.collection.objects.link(o); finish(o,'diagonal courier panel','orange',basket)
        # Fictional courier wing mark and text, ≥3mm clear of panel, opposite side mirrored.
        if level<2:
            for s in [-1,1]:
                for i in range(3):
                    stripe=box('courier wing',(.67-i*.045,s*.373,.56+i*.060),(.21-i*.035,.008,.027),'picketWhite',basket,.002)
                    stripe.rotation_euler.y=-.20
                if level==0:
                    y=s*.380
                    verts=[(.65,y,.735),(.56,y,.735),(.57,y,.82),(.67,y,.78),(.63,y,.775)]
                    mesh=bpy.data.meshes.new('wing arrow'); mesh.from_pydata(verts,[],[(4,3,2,1,0) if s<0 else (0,1,2,3,4)]); mesh.update()
                    o=bpy.data.objects.new('wing arrow',mesh); bpy.context.collection.objects.link(o); finish(o,'wing arrow','picketWhite',basket)
                    for word,z in [('Sunset Grove',.65),('Courier',.55)]:
                        curve=bpy.data.curves.new('courier lettering','FONT'); curve.body=word; curve.size=.070; curve.align_x='CENTER'; curve.extrude=0; curve.resolution_u=2
                        o=bpy.data.objects.new('courier lettering',curve); bpy.context.collection.objects.link(o); o.location=(.28,s*.374,z)
                        o.rotation_euler=(math.pi/2,0,math.pi if s>0 else 0)
                        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH')
                        finish(bpy.context.object,'courier lettering','picketWhite',basket)
        # Saddle, post and rear luggage rack.
        tube('seat post',(-.66,0,.98),(-.58,0,1.10),.024,'silver')
        box('saddle',(-.58,0,1.115),(.32,.24,.09),'uiDark',seat,.040)
        box('saddle underside',(-.60,0,1.075),(.20,.16,.025),'asphalt',seat,.01)
        for s in [-1,1]:
            tube('rack side',(-1.20,s*.16,.88),(-.77,s*.16,.88),.018,'uiDark')
            tube('rack strut',(-1.12,s*.16,.88),(-.94,s*.11,.43),.012,'silver')
            tube('rack brace',(-.77,s*.16,.88),(-.94,s*.11,.43),.012,'uiDark')
        for x in [-1.20,-1.07,-.94,-.81]: tube('rack rung',(x,-.16,.88),(x,.16,.88),.013,'uiDark')
        box('rear reflector',(-1.225,0,.84),(.025,.13,.045),'redDark')
        # Wheels: real open centres, stepped sidewalls, twin rim hoops, tangential spokes.
        for parent,r in [(front,.335),(rear,.405)]:
            x,y,z=parent.location
            ring('tire',(x,0,z),r-.038,.038,'uiDark',parent)
            if level==0:
                for i in range(32):
                    t=math.tau*i/32
                    block=box('tread',(x+(r-.004)*math.cos(t),0,z+(r-.004)*math.sin(t)),(.038,.076,.008),'asphalt',parent,0)
                    block.rotation_euler.y=math.pi/2-t
            for s in [-1,1]:
                ring('sidewall',(x,s*.025,z),r-.038,.009,'asphalt',parent)
                ring('rim',(x,s*.020,z),r-.074,.012,'silver',parent)
            tube('hub',(x,-.070,z),(x,.070,z),.035,'silver',parent)
            count=[16,4,3][level]
            for i in range(count):
                t=math.tau*i/count
                s=1 if i%2 else -1
                tube('spoke',(x+.027*math.cos(t+.7),s*.038,z+.027*math.sin(t+.7)),(x+(r-.075)*math.cos(t),s*.020,z+(r-.075)*math.sin(t)),[.0055,.008,.010][level],'silver',parent,verts=4)
            if level==0:
                ring('brake disc',(x,-.077,z),.087,.009,'silver',parent)
                box('caliper',(x+.080,-.084,z+.06),(.07,.05,.07),'uiDark')
            ring('mudguard',(x,0,z),r+.029,.019,'orange',body,(.18,math.pi-.18))
            if level<2:
                tube('mudguard stay',(x-.20,-.065,z+.26),(x,-.065,z),.009,'silver')
        # Crank, chain guard, pedal platforms and deployment stand.
        tube('bottom bracket',(-.47,-.08,.30),(-.47,.08,.30),.072,'uiDark')
        ring('chainring',(-.47,-.087,.30),.083,.012,'silver',body)
        box('chain guard',(-.72,-.105,.35),(.51,.032,.11),'orange',bevel=.045)
        for s in [-1,1]:
            tube('crank arm',(-.47,s*.09,.30),(-.47+s*.08,s*.13,.22),.015,'silver')
            box('pedal',(-.47+s*.08,s*.18,.22),(.12,.11,.035),'uiDark',bevel=.009)
            tube('center stand',(-.10,s*.11,.32),(-.19,s*.25,.016),.014,'uiDark')
            tube('stand foot',(-.25,s*.25,.015),(-.14,s*.25,.015),.015,'uiDark')
        # Headlamp and blank miniature courier computer plate.
        tube('lamp housing',(1.06,0,.78),(1.13,0,.78),.058,'uiDark',parent=lamps,verts=n)
        tube('lamp lens',(1.134,0,.78),(1.142,0,.78),.046,'lamp',parent=lamps,verts=n)
        box('front plate',(1.02,0,.93),(.09,.22,.065),'uiDark',bevel=.012)
        box('plate face',(1.071,0,.93),(.012,.17,.04),'backpackTeal',bevel=.005)
    empty('driverSeat',(-.58,0,1.18),root); empty('exitL',(-.50,.56,0),root); empty('exitR',(-.50,-.56,0),root)
    empty('front',(1.15,0,.78),root)
    col=empty('col:body',(0,0,.59),root); col['collider']='cuboid'; col['size']=[2.7,.70,1.18]
    light=empty('light:headlamp',(1.15,0,.78),root); light.rotation_euler=Vector((1,0,-.15)).to_track_quat('-Z','Y').to_euler()
    light['ss_light']=json.dumps({'type':'spot','color':'light_led_white','intensity':2,'range':8,'angle':45,'penumbra':.4,'pool':True,'beam':'none','flare':True,'reflect':False,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':['lightsFront'],'tiers':'all'})
    if level==1:
        # Remove hidden/cosmetic components, keeping all retained surfaces closed.
        omitted={'sidewall','inner lining','end interior','tub interior floor','brake cable','plate face','lid latch','saddle underside'}
        for o in list(parts):
            if o.name.split('.')[0] in omitted:
                parts.remove(o); bpy.data.objects.remove(o,do_unlink=True)
    joined=[]
    for parent in groups:
        for m in mats.values():
            batch=[o for o in parts if o.parent==parent and o.data.materials[0]==m]
            if not batch: continue
            parts[:]=[o for o in parts if o not in batch]
            bpy.ops.object.select_all(action='DESELECT')
            for o in batch:o.select_set(True)
            bpy.context.view_layer.objects.active=batch[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=parent.name+'_'+m.name
            mod=o.modifiers.new('triangles','TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=mod.name)
            bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-10],context='FACES'); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
            joined.append(o)
    return joined

if a.glb:
    destination=Path(a.glb).resolve(); destination.parent.mkdir(parents=True,exist_ok=True)
    counts={}
    for level in range(3):
        meshes=build(level); ao.bake_all(meshes,samples=32 if level==0 else 8)
        counts[f'lod{level}']=sum(len(o.data.polygons) for o in meshes)
        raw=destination.with_name('raw'+('' if level==0 else f'.lod{level}')+'.glb')
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_texcoords=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
    print('BUILD OK',json.dumps(counts))
    subprocess.run(['node','--import','tsx',str(HERE/'pack.ts'),str(destination)],cwd=ROOT,check=True)

if a.render:
    meshes=build(0)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; ao.bake_all(meshes,samples=16)
    floor=bpy.data.materials.new('studio'); floor.use_nodes=True; floor.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.022,.019,.028,1); floor.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018)); bpy.context.object.data.materials.append(floor)
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.17,.23,1); world.node_tree.nodes['Background'].inputs[1].default_value=.30
    for name,pos,power,color,size in [('key',(3,-4,6),350,(1,.75,.52),4),('fill',(-1,4,4),200,(.66,.78,1),4),('rim',(-4,-1,4),350,(1,.63,.36),3)]:
        d=bpy.data.lights.new(name,'AREA'); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos; d.energy=power; d.color=color; d.shape='DISK'; d.size=size; o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(cam); scene.camera=cam; cam.data.type='ORTHO'
    views={'ref':(4,8,3.2),'game':(7,7,10),'front':(8,0,2.6),'rear':(-8,0,2.6),'side':(0,8,2.0),'back':(0,-8,2.0)}
    def render(view,path):
        cam.location=views[view]; cam.rotation_euler=(Vector((0,0,.61))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=3.65 if view!='game' else 4.0
        scene.render.engine='BLENDER_EEVEE'
        if hasattr(scene.eevee,'taa_render_samples'): scene.eevee.taa_render_samples=a.samples
        scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG'; scene.view_settings.view_transform='Standard'
        scene.render.filepath=str(path); path.parent.mkdir(exist_ok=True,parents=True); bpy.ops.render.render(write_still=True)
        print('RENDER OK',view,path)
    target=Path(a.render).resolve(); render(a.view,target)
    if a.view=='ref':
        for view in ['game','front','side','rear','back']: render(view,target.with_name('game.png' if view=='game' else f'turntable-{view}.png'))
