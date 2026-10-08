"""Standing brick/diner frontage sections with explicit 1500/600/200 tiers."""
import json
import math
from pathlib import Path
import bpy
import bmesh
from .rescue_assets import Scene, finish
from . import palette, export


def recipe(asset,lod):
    s=Scene(asset,lod);s.protected=set();diner=asset.endswith('diner')
    brick='survivorRed' if diner else 'brick'
    # Section is intentionally shallow, with real apertures between masonry piers.
    s.box('pavement',(0,0,.10),(1.25,4.4,.20),'sidewalk')
    for y in (-1.93,1.93):s.box('standingPier',(-.18,y,1.97),(.44,.42,3.70),brick)
    s.box('doorPier',(-.18,.42,1.48),(.44,.25,2.70),brick)
    s.box('sill',(-.18,-.22,.48),(.44,3.46,.55),brick)
    s.box('upperWall',(-.18,0,3.25),(.44,3.45,1.10),brick)
    s.box('cornice',(-.10,0,3.83),(.64,4.22,.18),'sidewalk')
    # Recessed black windows keep storefront proportions; jagged glass stays closed.
    for y,w in [(-.87,1.98),(1.15,1.08)]:
        s.box('charredOpening',(-.35,y,1.89),(.05,w,2.10),'uiDark')
        if lod<2:
            for yy in (y-w/2,y+w/2):s.box('survivingJamb',(.065,yy,1.88),(.07,.08,2.12),'woodWarm')
        for i in range(3 if lod==0 else 2 if lod==1 else 1):
            yy=y-w*.35+i*w*.35;r=.19 if lod<2 else .30
            vs=[(x,yy+dy,z) for x in (.08,.11) for dy,z in [(-r,2.90),(r,2.90),(-r*.3,2.57)]]
            s.mesh('jaggedGlass',vs,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'sidewalk')
    # A solid sloped awning, scorched local panels and a recognizable fascia.
    vs=[(x,y,z) for y in (-1.95,1.95) for x,z in [(.06,3.13),(.65,2.83),(.65,2.76),(.06,3.06)]]
    s.mesh('scorchedAwning',vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'survivorRed' if diner else 'uiDark')
    if diner:
        s.box('dinerFascia',(-.04,0,4.06),(.24,3.28,.40),'survivorRed')
        s.box('dinerCrown',(-.04,0,4.26),(.24,1.10,.26),'survivorRed')
        if lod<2:
            bpy.ops.object.text_add(location=(.113,0,4.04),rotation=(math.pi/2,0,math.pi/2))
            obj=bpy.context.object;obj.data.body='DINER';obj.data.align_x='CENTER';obj.data.align_y='CENTER';obj.data.resolution_u=1
            bpy.ops.object.convert(target='MESH');obj=bpy.context.object;obj.name='dinerLettering';obj.parent=s.root
            obj.data.materials.append(palette.mat('sidewalk'))
            xs=[v.co.x for v in obj.data.vertices];ys=[v.co.y for v in obj.data.vertices]
            for vertex in obj.data.vertices:
                vertex.co.x*=2.48/(max(xs)-min(xs));vertex.co.y*=.24/(max(ys)-min(ys))
        s.box('signScorch',(.09,.64,4.06),(.035,.90,.32),'uiDark')
    else:s.box('brokenCoping',(-.16,-1.45,4.04),(.42,1.0,.26),'brick')
    if lod<2:
        for y,z,w,h in [(-1.71,2.47,.37,.8),(.47,2.70,.29,.8),(1.69,3.45,.54,.45),(-.91,3.58,.82,.28)]:s.box('sootPatch',(.052,y,z),(.04,w,h),'uiDark')
        for i in range(6 if lod==0 else 3):
            s.box('awningStripe',(.35,-1.58+i*.56,2.985),(.61,.25,.025),'sidewalk',angle=0)
            # Rotate the whole strip along the awning slope, with a proud surface.
            o=bpy.context.object;o.rotation_euler.y=.47
        s.box('crookedTrim',(.13,.90,1.02),(.08,.88,.09),'woodWarm',angle=.16)
    if lod==0:
        for row in range(7):
            for y in (-1.94,1.94):s.box('brickCourse',(.06,y,.72+row*.40),(.06,.38,.045),'woodWarm')
        for i in range(4):s.box('fallenGlass',(.40,-1.15+i*.54,.22),(.16,.25,.035),'sidewalk',angle=i*.4)
    for obj in s.root.children_recursive:
        if obj.type=='MESH' and any(word in obj.name for word in ('Course','Stripe','Patch','Trim','Glass','Opening','Scorch')):
            for mod in list(obj.modifiers):obj.modifiers.remove(mod)
    s.physics();return s


def build_set(asset,directory,output=None):
    directory=Path(directory);stats={}
    for lod in (0,1,2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        path=directory/('model'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        scene=recipe(asset,lod)
        for obj in scene.root.children_recursive:
            if obj.type=='MESH':
                bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
        stats['lod'+str(lod)]=finish(scene,path)
        for obj in scene.root.children_recursive:
            if obj.type=='MESH':
                for value in obj.data.color_attributes['ao'].data:
                    shade=max(.65,value.color[0]);value.color=(shade,shade,shade,1)
        export.glb(scene.root,path)
        if stats['lod'+str(lod)]['triangles']>(1500,600,200)[lod]:raise ValueError(stats)
    (directory/'lod-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    if output:
        import shutil
        if Path(output).resolve()!=(directory/'model.glb').resolve():shutil.copyfile(directory/'model.glb',output)
