"""Sunset Grove extinguisher: faceted tank, raised curved label and jointed lever."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT = Path(__file__).resolve().parent
ASSET = {'id':'prop.fire-extinguisher','category':'prop'}

def material(token, hexcolor, metallic=0):
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
    rgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.42; bs.inputs['Metallic'].default_value=metallic
    m.diffuse_color=(*rgb,1); return m

def mesh(name,vs,fs,mat):
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); me.materials.append(mat); return ob

def lathe(name,profile,mat,center=(0,0,0),n=64):
    vs=[]
    # Four subdivisions within each of sixteen flat cylinder faces.
    for z,r in profile:
        for i in range(n):
            f,t=divmod(i,n//16); t/=n//16
            a=f*math.tau/16; b=(f+1)*math.tau/16
            vs.append((center[0]+r*((1-t)*math.cos(a)+t*math.cos(b)),center[1]+r*((1-t)*math.sin(a)+t*math.sin(b)),center[2]+z))
    fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
    fs += [tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))]
    return mesh(name,vs,fs,mat)

def box(name,loc,size,mat,bevel=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat)
    b=o.modifiers.new('rounded edges','BEVEL'); b.width=bevel; b.segments=3; bpy.ops.object.modifier_apply(modifier=b.name)
    return o

def rod(name,a,b,r,mat,vertices=24):
    d=Vector(b)-Vector(a); bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.data.materials.append(mat); return o

def curve(name,points,r,mat):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=16; cu.bevel_depth=r; cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for bp,p in zip(sp.bezier_points,points): bp.co=p; bp.handle_left_type='AUTO'; bp.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(ob); cu.materials.append(mat)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False); return bpy.context.object

def surface_x(y):
    a=math.asin(y/.19); mid=(math.floor(a/(math.tau/16))+.5)*math.tau/16
    return .19*math.cos(math.pi/16)*math.cos(a)/math.cos(a-mid)

def patch(name,y0,y1,z0,z1,offset,mat):
    vs=[]; fs=[]
    for z in (z0,z1):
        for i in range(25):
            y=y0+(y1-y0)*i/24
            # Match the faceted tank exactly; every marking is offset in X.
            x=surface_x(y)
            vs.append((x+offset,y,z))
    for i in range(24): fs.append((i,i+1,26+i,25+i))
    return mesh(name,vs,fs,mat)

def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; o.location=loc; return o

def build():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    red=material('survivorRed','d9363e'); black=material('uiDark','25222c'); cream=material('picketWhite','f2e6dc'); metal=material('sidewalk','b9a4a0',.65); darkred=material('blood','b3121f'); green=material('grass','6f8f3a')
    root=empty('root'); root['asset_id']=ASSET['id']
    root['ss_physics']={'class':'light','mass':7,'friction':.65,'restitution':.1,'centerOfMass':[0,.43,0],'pushable':True,'kickable':True,'flammable':False,'explosive':None,'sounds':'prop.metal-light'}
    profile=[(0,.163),(.006,.180),(.015,.188),(.025,.19)]
    profile +=[(.035+i*.70/19,.19) for i in range(20)]
    profile +=[(.75,.187),(.772,.174),(.792,.152),(.811,.121),(.823,.079),(.829,.055)]
    lathe('tank',profile,red)
    lathe('neck',[(.822,.060),(.83,.065),(.863,.065),(.867,.058)],red)
    lathe('retaining band',[(.208,.193),(.211,.201),(.254,.201),(.258,.193)],black)
    box('valve',(0,0,.911),(.105,.11,.085),metal)
    rod('hose coupling',(0,-.048,.92),(0,-.121,.92),.035,metal)
    curve('hose',[(0,-.115,.92),(0,-.23,.875),(0,-.30,.72),(0,-.31,.49),(0,-.285,.27)],.022,black)
    lathe('nozzle',[(.055,.061),(.061,.066),(.075,.064),(.225,.035),(.234,.04),(.242,.035)],black,(0,-.285,0),48)
    rod('nozzle stem',(0,-.285,.232),(0,-.285,.285),.027,black)
    lathe('hose clamp',[(.272,.029),(.278,.034),(.307,.034),(.313,.029)],metal,(0,-.287,0),48)
    rod('clip',(0,-.28,.29),(0,-.16,.29),.014,metal)
    box('lower handle',(0,.14,.978),(.046,.32,.037),red).rotation_euler.x=-.14
    box('upper lever',(0,.135,1.085),(.046,.33,.045),red).rotation_euler.x=.20
    box('lever heel',(0,-.035,1.033),(.065,.10,.047),red)
    rod('hinge pin',(-.04,-.008,1.036),(.043,-.008,1.036),.012,metal)
    rod('lever rivet',(.033,-.055,1.035),(.040,-.055,1.035),.009,metal)
    rod('ferrule lip',(0,-.119,.92),(0,-.126,.92),.038,metal)
    rod('gauge bezel',(.045,0,.921),(.095,0,.921),.051,black,48)
    rod('gauge rim',(.087,0,.921),(.103,0,.921),.045,metal,48)
    rod('gauge face',(.104,0,.921),(.108,0,.921),.037,cream,48)
    for i in range(9):
        a=math.radians(-135+i*33.75); y=math.sin(a)*.028; z=.921+math.cos(a)*.028
        o=box('gauge tick',(.113,y,z),(.004,.003,.009),green if 3<=i<=5 else darkred,.0005); o.rotation_euler.x=-a
    rod('needle',(.118,0,.921),(.118,-.019,.943),.0026,darkred,12)
    rod('dial hub',(.116,0,.921),(.121,0,.921),.005,metal,16)
    patch('label',-.105,.105,.286,.633,.0045,cream)
    patch('label inset',-.094,.094,.299,.620,.0085,darkred)
    patch('label panel',-.085,.085,.31,.600,.0125,cream)
    patch('label divider',-.085,.085,.435,.444,.0165,darkred)
    for z,w in [(.394,.068),(.357,.068),(.324,.043)]: patch('instruction bars',-w,w,z,z+.012,.0165,black)
    # Raised silhouette flame, with a smaller cream inner flame.
    def flame(name,coords,off,mat):
        vs=[(surface_x(y)+off,y,z) for y,z in coords]
        return mesh(name,vs,[tuple(range(len(vs)))],mat)
    flame('flame',[(-.005,.455),(-.040,.467),(-.050,.489),(-.044,.514),(-.029,.501),(-.024,.541),(-.008,.560),(0,.589),(.023,.553),(.029,.520),(.040,.540),(.051,.503),(.044,.479),(.023,.459)],.017,darkred)
    flame('flame cutout',[(-.009,.455),(-.022,.468),(-.019,.488),(-.008,.479),(0,.515),(.010,.498),(.018,.479),(.012,.462)],.021,cream)
    for y,z,w in [(-.07,.03,.012),(.025,.017,.019),(.08,.039,.008),(-.025,.735,.009)]:
        patch('paint chip',y-w,y+w,z,z+.009,.004,metal)
    # Merge all fixed parts by material; the squeeze lever remains jointed.
    lever=bpy.data.objects.get('upper lever'); bpy.context.scene.cursor.location=(0,-.008,1.036)
    bpy.ops.object.select_all(action='DESELECT'); lever.select_set(True); bpy.context.view_layer.objects.active=lever; bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); lever.name='lever'; lever.parent=root
    for mat in (red,black,cream,metal,darkred,green):
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o!=lever and o.data.materials[0]==mat]
        if not obs: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); ob=obs[0]; ob.name='body' if mat==red else 'static_'+mat.name; ob.parent=root
    col=empty('col:body',root,(0,0,.55)); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[.40,1.10,.66]
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=0; scene.render.bake.target='VERTEX_COLORS'
    for ob in meshes:
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
        attr=ob.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); ob.data.color_attributes.active_color=attr; bpy.ops.object.bake(type='AO')
    return meshes

def render(args):
    sc=bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001)); bpy.context.object.data.materials.append(material('asphalt','2a2730'))
    target=Vector((0,-.04,.56)); views={'ref':(3,-1.6,1.9),'game':(2,-3,3.7),'front':(3,0,.8),'side':(0,-3,.8),'rear':(-3,0,.8)}
    bpy.ops.object.camera_add(location=views[args.view]); cam=bpy.context.object; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=2.35; sc.camera=cam
    for loc,power,size,color in [((2,-3,4),230,3,(1,.83,.70)),((1,2,3),180,2,(1,.91,.76)),((-2,-1,2),130,2,(.73,.80,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    sc.world.color=(.09,.09,.09); sc.cycles.samples=args.samples; sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'; sc.render.resolution_x=args.width; sc.render.resolution_y=args.height; sc.render.resolution_percentage=100; sc.render.filepath=args.render; Path(args.render).parent.mkdir(parents=True,exist_ok=True); bpy.ops.render.render(write_still=True)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref',choices=['ref','game','front','side','rear']); p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    meshes=build()
    for o in meshes:o.data.calc_loop_triangles()
    stats={'triangles':sum(len(o.data.loop_triangles) for o in meshes),'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials})}; (OUT/'build-stats.json').write_text(json.dumps(stats,indent=2))
    if args.glb:bpy.ops.export_scene.gltf(filepath=args.glb,export_format='GLB',export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    if args.render:render(args)
    print('OK',json.dumps(stats))
if __name__=='__main__':main()
