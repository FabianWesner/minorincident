"""Fairhaven intact landmarks. Explicit solid recipes at each distance tier.
Fixed local footprints and semantic owners are also the W5 derivation contract.
"""
import argparse
import json
import math
import shutil
from pathlib import Path
import bpy
import bmesh
from .rescue_assets import Scene
from . import sockets, colliders, export, ao, palette

DIMS = {
    'bld.apartment-block-a': (10.3, 12.85, 12.6),
    'bld.apartment-block-b': (9.96, 15.95, 12.6),
    'bld.town-hall': (12.08, 12.4, 16.0),
    'bld.church': (18.0, 13.8, 10.65),
}

class Civic(Scene):
    def __init__(self, asset, lod):
        super().__init__(asset, lod)
        self.roof = self.joint('roof')
        self.interior = self.joint('interior')
        self.door = self.joint('door_front', (4.25 if 'apartment' in asset else 4.65 if asset.endswith('town-hall') else 7.8, -.6, .25))
        self.door['animated'] = True
        sockets.empty('front', ({'bld.apartment-block-a':5.5,'bld.apartment-block-b':5.16,'bld.town-hall':6.93,'bld.church':9}[asset], 0, 1), self.root)
        sockets.empty('doorway', (self.door.location.x+.25, 0, .25), self.root)
        sockets.empty('nav_entry', (DIMS[asset][0]/2, 0, .25), self.root)
        sockets.empty('roof_cutaway', (0, 0, DIMS[asset][1]*.7), self.root)
        sockets.empty('stairwell', (2.5, 0, .35), self.root)
        self.physics()
        self.root['footprint'] = [DIMS[asset][0], DIMS[asset][2]]
        self.root['foundationFootprint'] = [9.6 if 'apartment' in asset else 10 if asset.endswith('town-hall') else 18, 10.6 if asset.endswith('church') else DIMS[asset][2]]
        self.root['forward'] = '+X'
    def box(self, name, pos, size, token='picketWhite', parent=None, angle=0):
        obj = super().box(name, pos, size, token, parent, angle)
        # Retain bevels on structural corners; fine detail stays closed and cheap.
        if max(size)<2 or min(size)<.09:
            mod = obj.modifiers.get('bevel')
            if mod: obj.modifiers.remove(mod)
        return obj
    def prism(self, name, yz, x0, x1, token, parent=None):
        n=len(yz)
        obj=self.mesh(name, [(x,y,z) for x in (x0,x1) for y,z in yz],
                      [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],token)
        obj.parent=parent or self.body
        return obj
    def window(self, x, y, z, w=1.0, h=1.6, side=False, arch=False):
        def piece(name, a,b,c, sx,sy,sz, token):
            a=x+(a-x)*(1 if x>0 else -1)
            return self.box(name,(b,a,c) if side else (a,b,c),(sy,sx,sz) if side else (sx,sy,sz),token)
        if self.lod==2 and not arch:
            piece('glazing',x,y,z,.10,w,h,'blueTrim')
            outer=[(y-w/2-.12,z-h/2-.12),(y+w/2+.12,z-h/2-.12),(y+w/2+.12,z+h/2+.12),(y-w/2-.12,z+h/2+.12)]
            inner=[(y-w/2,z-h/2),(y+w/2,z-h/2),(y+w/2,z+h/2),(y-w/2,z+h/2)]
            vs=[(x+off,yy,zz) for off in (0,.16) for yy,zz in outer+inner]
            fs=[]
            for i in range(4):
                j=(i+1)%4
                fs.extend([(i,j,j+4,i+4),(i+8,i+12,j+12,j+8),(i,i+8,j+8,j),(i+4,j+4,j+12,i+12)])
            o=self.mesh('distanceWindowBorder',vs,fs,'backpackTeal' if self.asset.endswith('-b') else 'picketWhite')
            for v in o.data.vertices:
                if x<0:v.co.x=x-(v.co.x-x)
                if side:v.co.x,v.co.y=v.co.y,v.co.x
            return
        if arch:
            seg=[12,8,6][self.lod]
            r=w/2; spring=z+h/2-r
            profile=[(y-r,z-h/2),(y+r,z-h/2)]+[(y+math.cos(i*math.pi/seg)*r,spring+math.sin(i*math.pi/seg)*r) for i in range(seg+1)]
            o=self.prism('archedGlazing',profile,x-.07,x+.025,'blueTrim')
            if side:
                # Rotate the +X-facing profile onto the long nave side.
                for v in o.data.vertices: v.co.x,v.co.y=v.co.y,v.co.x
            for i in range(seg):
                a=math.pi*i/seg; b=math.pi*(i+1)/seg
                yz=[(y+math.cos(t)*rr,spring+math.sin(t)*rr) for rr,t in ((r,a),(r,b),(r+.16,b),(r+.16,a))]
                o=self.prism('archStone',yz,x-.01,x+.17,'picketWhite')
                if side:
                    for v in o.data.vertices:v.co.x,v.co.y=v.co.y,v.co.x
        else:
            piece('glazing',x,y,z,.10,w,h,'blueTrim')
            piece('windowHead',x+.09,y,z+h/2+.08,.23,w+.3,.16,'picketWhite')
        for sign in (-1,1):piece('windowJamb',x+.07,y+sign*(w/2+.06),z,.18,.12,h,'backpackTeal' if 'apartment' in self.asset else 'picketWhite')
        piece('windowSill',x+.11,y,z-h/2-.08,.30,w+.30,.16,'picketWhite')
        if self.lod<2:
            piece('windowMullion',x+.075,y,z,.04,.055,h,'backpackTeal' if 'apartment' in self.asset else 'woodWarm' if self.asset.endswith('church') else 'uiDark')
            piece('windowCrossbar',x+.075,y,z,.04,w,.055,'backpackTeal' if 'apartment' in self.asset else 'woodWarm' if self.asset.endswith('church') else 'uiDark')
    def rail(self,x,y,z,w):
        self.box('balconyFloor',(x-.15,y,z),(.9,w+.22,.18))
        self.box('balconyTop',(x+.23,y,z+.85),(.07,w,.08),'backpackTeal')
        self.box('balconyLower',(x+.23,y,z+.18),(.07,w,.07),'backpackTeal')
        for i in range([7,5,2][self.lod]):
            yy=y-w/2+i*w/([7,5,2][self.lod]-1)
            self.box('baluster',(x+.23,yy,z+.5),(.065,.065,.72),'backpackTeal')
        for sign in ((-1,1) if self.lod<2 else ()):self.box('balconyReturn',(x-.1,y+sign*w/2,z+.85),(.72,.075,.08),'backpackTeal')
    def lantern(self,x,y,z):
        self.box('lanternFrame',(x,y,z),(.22,.27,.38),'backpackTeal' if 'apartment' in self.asset else 'uiDark')
        obj=self.box('entryGlow',(x+.12,y,z),(.035,.19,.25))
        obj.data.materials.clear();obj.data.materials.append(palette.mat('windowGlow',True))
        anchor=sockets.empty('light:entry', (x+.2,y,z), self.root)
        anchor['ss_light']=json.dumps(dict(type='point',color='light_window_warm',intensity=1.5,range=4,pool=True,beam='none',reflect=True,shadow='none',heroPriority=1,flicker='none',powerGroup='fairhaven-civic',breakable=True,emissiveNodes=['body_emi_windowGlow']))
    def doorpanel(self, token='backpackTeal'):
        width=1.6 if self.asset.endswith('church') else 1.2
        self.box('doorLeaf',(0,width/2,1.15),(.12,width,2.3),token,self.door)
        if self.lod<2:
            for y in (.25,.85):self.box('doorRaisedPanel',(.075,y,1.05),(.04,.43,1.6),token,self.door)
        self.door['hingeAxis']='Y';self.door['openAngle']=105
    def shell(self, depth, width, height, token, entry=1.5):
        self.box('rearWall',(-depth/2+.16,0,height/2),(.32,width,height),token)
        for y in (-width/2+.16,width/2-.16):self.box('sideWall',(0,y,height/2),(depth,.32,height),token)
        for sign in (-1,1):self.box('frontWall',(depth/2-.16,sign*(width+entry)/4,height/2),(.32,(width-entry)/2,height),token)
        self.box('doorLintel',(depth/2-.16,0,(height+2.6)/2),(.32,entry,height-2.6),token)
        self.box('floor',(0,0,.10),(depth,width,.2),'picketWhite',self.interior)
        for name,pos,size in [('rear',(-depth/2+.16,0,height/2),(.32,width,height)),('sideL',(0,-width/2+.16,height/2),(depth,.32,height)),('sideR',(0,width/2-.16,height/2),(depth,.32,height)),('frontL',(depth/2-.16,-(width+entry)/4,height/2),(.32,(width-entry)/2,height)),('frontR',(depth/2-.16,(width+entry)/4,height/2),(.32,(width-entry)/2,height))]:colliders.cuboid(name,size,pos,self.root)


def apartments(s):
    b=s.asset.endswith('-b'); floors=5 if b else 4; top=15.3 if b else 12.5
    token='picketWhite' if b else 'brick'
    s.shell(8.8,12,top,token)
    # Recesses on B are actual empty balcony volumes in front of the back wall.
    for z in ([.3,3.1,6.15,9.2,12.25,15.35] if b else [.3,3.15,12.55]):
        s.box('frontCornice',(4.49,0,z),(.30,12.35,.20))
        for sign in (-1,1):s.box('sideCornice',(0,sign*6.06,z),(9.02,.24,.20))
        s.box('rearCornice',(-4.46,0,z),(.25,12.35,.20))
    for floor in range(1,floors):
        z=1.7+floor*3.03
        for y in (-4.25,-1.45,1.45,4.25):
            recessed=b and abs(y)>3
            x=4.42
            if recessed:
                # Projecting piers and floor slabs make the recessed glazing readable.
                for dy in (-1.38,1.38):s.box('balconyPier',(4.65,y+dy,z),(.3,.26,2.86),token)
                s.box('balconyCeiling',(4.65,y,z+1.35),(.65,2.9,.20))
            s.window(x,y,z,1.55 if recessed or (not b and abs(y)<2) else .94,1.92)
            if recessed or (not b and abs(y)<2):s.rail(4.78 if b else 5.2,y,z-1.05,2.35 if b else 1.8)
        for side in (-1,1):
            for x in (-2.5,.4,2.8):s.window(side*6.015,x,z,.95,1.72,side=True)
        for y in (-4.25,-1.45,1.45,4.25):s.window(-4.46,y,z,.95,1.7)
    for y in (-3.6,3.6):
        s.window(4.46,y,1.55,3.8,2.22)
        s.box('shopBase',(4.54,y,.38),(.2,4,.35),'backpackTeal')
        canopy=s.box('shopAwning',(4.81,y,2.94),(.7,4.1,.32),'backpackTeal')
        if not b:canopy.rotation_euler.y=.25
        if s.lod<2:
            for yy in (y-1.28,y,y+1.28):s.box('shopMullion',(4.54,yy,1.54),(.10,.085,2.1),'backpackTeal')
    for y in (-.85,.85):s.box('entryPier',(4.54,y,1.55),(.34,.32,2.8))
    s.box('entryHead',(4.59,0,2.83),(.44,2,.3))
    s.doorpanel();s.lantern(4.57,0,3.35)
    s.box('roofDeck',(0,0,top-.13),(8.8,12,.22),'asphalt',s.roof)
    # Parapet remains structural body geometry, so hiding roof exposes the shell.
    for x in (-4.4,4.4):s.box('parapet',(x,0,top+.17),(.22,12.2,.36),'backpackTeal' if b else token)
    for y in (-6,6):s.box('parapet',(0,y,top+.17),(8.8,.22,.36),'backpackTeal' if b else token)
    if b:
        s.box('HVAC',(-2,2,top+.36),(1.1,1.1,.58),'asphalt',s.roof)
        if s.lod<2:
            for i in range(4):s.box('HVACGrille',(-1.44,2,top+.15+i*.13),(.02,.8,.045),'asphalt',s.roof)
    # A few warm occupied windows remain visible in every tier, sharing the
    # entry lantern batch. Broad navy glazing remains the dominant region.
    for floor in range(1,floors):
        glow=s.box('occupiedWindow',(4.493,-1.45 if floor%2 else 1.45,1.40+floor*3.03),(.028,.25,.42))
        glow.data.materials.clear();glow.data.materials.append(palette.mat('windowGlow',True))
    if s.lod==0 and not b:
        # Physical masonry relief is coarse enough to survive a near turntable;
        # the distance shells deliberately omit it without perforating walls.
        for row in range(24):
            z=.55+row*.49
            for col in range(16):
                y=-5.66+col*.73+(row%2)*.17
                if y>5.8:continue
                for x in (-4.42,4.42):s.box('masonryBrick',(x,y,z),(.04,.68,.43),'brick')
            for col in range(10):
                x=-4.0+col*.85+(row%2)*.18
                for sign in (-1,1):s.box('masonryBrick',(x,sign*6.015,z),(.79,.04,.43),'brick')
        # Sparse recessed-tone brick accents, rather than a mesh for every brick.
        for row in range(24):
            z=.55+row*.48
            for col in range(10):
                y=-5.6+col*1.14+(row%2)*.3
                if any(abs(y-w)<.7 for w in (-4.25,-1.45,1.45,4.25)):continue
                s.box('brickAccent',(4.414,y,z),(.012,.65,.025),'brick')
    # Continuous foundation fixes the ground lot; balcony projections are recorded separately.
    s.box('foundation',(0,0,.13),(9.6,12.6,.26))


def hip(s,name,cx,cy,w,d,z,h,token):
    vs=[(cx+x,cy+y,z) for x,y in ((-w/2,-d/2),(-w/2,d/2),(w/2,d/2),(w/2,-d/2))]+[(cx-w*.17,cy,z+h),(cx+w*.17,cy,z+h)]
    o=s.mesh(name,vs,[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5),(3,2,1,0)],token);o.parent=s.roof


def town_hall(s):
    s.shell(9.6,15.4,7.7,'brick',2.1)
    s.box('foundation',(0,0,.3),(10,16,.6))
    for sign in (-1,1):
        for x in (-4.68,4.68):
            for i in range(12 if s.lod==0 else 6 if s.lod==1 else 3):
                n=12 if s.lod==0 else 6 if s.lod==1 else 3
                s.box('stoneQuoin',(x,sign*7.64,.7+(i+.5)*6.7/n),(.48,.48,6.7/n-.025))
    for z in (.7,7.7):
        s.box('frontCornice',(4.8,0,z),(.45,15.8,.25))
        s.box('rearCornice',(-4.8,0,z),(.45,15.8,.25))
        for sign in (-1,1):s.box('sideCornice',(0,sign*7.75,z),(9.9,.4,.25))
    for z in (2.0,5.65):
        for y in (-5.05,0,5.05):
            if y==0 and z<3:continue
            s.window(4.82,y,z,1.4,2.25)
            s.window(-4.83,y,z,1.4,2.25)
        for sign in (-1,1):
            for x in (-2.7,0,2.7):s.window(sign*7.72,x,z,1.3,2.25,True)
    for y in (-1.35,1.35):s.box('entranceColumn',(5.0,y,1.9),(.5,.4,2.9))
    s.box('entryEntablature',(5.05,0,3.43),(.58,3.25,.35))
    s.prism('entryPediment',[(-1.8,3.6),(1.8,3.6),(0,4.65)],4.85,5.30,'picketWhite')
    s.prism('pedimentInset',[(-1.28,3.76),(1.28,3.76),(0,4.39)],5.303,5.32,'brick')
    for i in range(4):s.box('wideStep',(5.45+i*.26,0,.48-i*.12),(1.4,4.8+i*.35,.24))
    s.doorpanel('woodWarm');s.lantern(5.06,-1.8,2.9)
    hip(s,'hipRoof',0,0,10.3,16,7.85,2,'denim')
    if s.lod<2:
        for i in range(1,18 if s.lod==0 else 10):
            n=18 if s.lod==0 else 10
            y=-8+i*16/n
            extent=1.75+3.4*abs(y)/8
            s.box('slateCourse',(0,y,7.885+2*(1-abs(y)/8)),(extent*2,.035,.028),'denim',s.roof)
    # Clock tower body remains with the landmark, roof is independently cut away.
    s.box('clockTower',(0,0,10.0),(2.75,3,3.25),'brick')
    for z in (8.6,11.58):s.box('towerStoneBand',(0,0,z),(3.05,3.35,.24))
    hip(s,'towerRoof',0,0,3.3,3.6,11.7,.65,'denim')
    s.box('towerFinial',(0,0,12.36),(.12,.12,.08),'denim',s.roof)
    for side in (False,True):
        o=s.tube('clockRim',(1.44,0,10.45),.89,.12,'uiDark',(0,math.pi/2,0))
        o2=s.tube('clockFace',(1.514,0,10.45),.79,.035,'picketWhite',(0,math.pi/2,0))
        parts=[o,o2]
        for a,l in ((-.6,.60),(.85,.46)):
            obj=s.box('clockHand',(1.543,math.sin(a)*l/2,10.45+math.cos(a)*l/2),(.03,.055,l),'uiDark');obj.rotation_euler.x=-a;parts.append(obj)
        if s.lod<2:
            for i in range(12):
                a=i*math.tau/12
                obj=s.box('clockTick',(1.54,math.sin(a)*.66,10.45+math.cos(a)*.66),(.025,.045,.1),'uiDark');obj.rotation_euler.x=-a;parts.append(obj)
        if side:
            for obj in parts:
                x,y,z=obj.location;obj.location=(-y,x+.17,z);obj.rotation_euler.z+=math.pi/2
    if s.lod<2:
        for y in range(-7,8):s.box('corniceDentil',(4.88,y,7.42),(.36,.30,.26))


def church(s):
    s.shell(15.6,10,5.5,'picketWhite',2.3)
    s.box('foundation',(0,0,.20),(18,10.6,.4),'khaki')
    # Nave gables and solid paired roof slopes, ridge parallel to +X.
    for x in (-7.8,7.8):s.prism('gable',[(-5,5.45),(5,5.45),(0,8.2)],x-.15,x+.15,'picketWhite')
    s.prism('naveRoof',[(-5.3,5.4),(0,8.35),(5.3,5.4),(5.3,5.2),(0,8.15),(-5.3,5.2)],-8.1,8.1,'brick',s.roof)
    s.box('ridge',(0,0,8.33),(16.3,.18,.18),'brick',s.roof)
    if s.lod<2:
        from mathutils import Vector
        for x in [-7.8+i*.65 for i in range(25)] if s.lod==0 else [-7.5+i*1.0 for i in range(16)]:
            for sign in (-1,1):
                a=Vector((x,0,8.35));b=Vector((x,sign*5.25,5.43))
                obj=s.tube('clayTileRoll',(a+b)/2,.07,(b-a).length,'brick',parent=s.roof)
                obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    # Bell chamber is hollow: four piers, arched dark openings and a visible bell.
    # A continuous tower projects past the nave gable; a real entrance runs
    # through front and rear walls, retaining the intact navigation aperture.
    for x in (5.34,8.36):
        for sign in (-1,1):s.box('towerEntryPier',(x,sign*1.30,4.98),(.28,.70,9.45))
        s.box('towerEntryLintel',(x,0,6.03),(.28,1.90,6.7))
    for y in (-1.58,1.58):s.box('towerShaftSide',(6.85,y,5.0),(3.3,.24,9.5))
    for x in (5.27,8.43):
        for y in (-1.62,1.62):s.box('bellPier',(x,y,10.4),(.34,.34,2.6))
    for z in (9.35,11.6):s.box('towerBand',(6.85,0,z),(3.6,3.7,.25),'khaki')
    for x in (5.30,8.40):
        s.prism('bellArch',[(-1.45,10.55),(-1.45,11.5),(1.45,11.5),(1.45,10.55),(.9,11.04),(0,11.3),(-.9,11.04)],x-.13,x+.13,'picketWhite')
    for y in (-1.56,1.56):
        o=s.prism('bellSideArch',[(-1.45,10.55),(-1.45,11.5),(1.45,11.5),(1.45,10.55),(.9,11.04),(0,11.3),(-.9,11.04)],y-.13,y+.13,'picketWhite')
        for v in o.data.vertices:v.co.x,v.co.y=v.co.y+6.85,v.co.x
    # Lathed flared bell profile, closed at top and bottom, all tiers.
    sides=[20,12,8][s.lod];profile=[(.19,10.93),(.3,10.7),(.34,10.15),(.55,9.93),(.57,9.84)]
    vs=[(6.85+r*math.cos(i*math.tau/sides),r*math.sin(i*math.tau/sides),z) for r,z in profile for i in range(sides)]
    fs=[tuple(range(sides-1,-1,-1)),tuple(range((len(profile)-1)*sides,len(profile)*sides))]
    for row in range(len(profile)-1):
        for i in range(sides):fs.append((row*sides+i,row*sides+(i+1)%sides,(row+1)*sides+(i+1)%sides,(row+1)*sides+i))
    s.mesh('bell',vs,fs,'woodWarm');s.tube('bellClapper',(6.85,0,9.78),.10,.30,'woodWarm')
    hip(s,'bellTowerRoof',6.85,0,3.95,4.0,11.74,1.23,'brick')
    s.box('crossUpright',(6.85,0,13.39),(.14,.14,.82),'khaki')
    s.box('crossArms',(6.85,0,13.48),(.14,.65,.14),'khaki')
    for sign in (-1,1):
        for x in (-5,-1,2.9):s.window(sign*5.015,x,3.1,1.15,2.8,True,True)
    s.window(-7.83,0,3.25,1.35,2.9,False,True)
    # Tower-front arched door surround; hinge remains at the public entrance.
    s.window(8.55,0,1.75,2.8,3.1,False,True)
    s.door.location=(8.60,-.8,.25);s.doorpanel('woodWarm')
    bpy.data.objects['doorway'].location=(8.72,0,.25)
    for i in range(2):s.box('entryStep',(8.55+i*.20,0,.28-i*.12),(.5,3.2+i*.35,.24),'khaki')
    # Side vestry access: named visible door and cue attachment, no mission logic.
    s.box('vestryLeaf',(-5.9,-5.18,1.3),(1.25,.14,2.2),'woodWarm')
    for x in (-6.61,-5.19):s.box('vestryJamb',(x,-5.24,1.4),(.16,.22,2.55),'khaki')
    s.box('vestryHead',(-5.9,-5.24,2.67),(1.6,.22,.18),'khaki')
    sockets.empty('vestry_door',(-5.9,-5.35,.25),s.root)
    sockets.empty('vestry_hide',(-5.9,-3.5,.25),s.root)
    sockets.empty('sign_of_life',(-5.9,-5.35,1.7),s.root)
    if s.lod<2:
        for sign in (-1,1):
            for x in (-7.5,-3,1.1,7.5):
                s.box('buttress',(x,sign*5.04,2.6),(.4,.46,5.1),'khaki')
    if s.lod==0:
        for row in range(10):
            for col in range(14):
                x=-7.2+col*1.06+(row%2)*.35
                if x>7.6:continue
                s.box('stoneJoint',(x,-5.171,.55+row*.48),(.85,.055,.40),'picketWhite')


def main(asset, directory):
    parser=argparse.ArgumentParser();parser.add_argument('--glb',required=True);parser.add_argument('--quality',default='high');parser.add_argument('--distance-tier',type=int,choices=[0,1,2]);args=parser.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:])
    directory=Path(directory);stats={}
    for lod in ([args.distance_tier] if args.distance_tier is not None else [0,1,2]):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s=Civic(asset,lod)
        if 'apartment' in asset:apartments(s)
        elif asset.endswith('town-hall'):town_hall(s)
        else:church(s)
        # Closed profile meshes (arches, rings, roofs, bell) use explicit faces;
        # orient their normals outwards before batching alongside Blender cubes.
        for obj in s.root.children_recursive:
            if obj.type!='MESH':continue
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data);bm.free()
        export.merge_by_material(s.root,s.protected)
        ao.bake_all(s.root.children_recursive,16)
        # Large shell vertices meet adjacent walls: bound baked occlusion so
        # interpolation cannot turn a complete facade black at game distance.
        for obj in s.root.children_recursive:
            if obj.type!='MESH':continue
            for color in obj.data.color_attributes['ao'].data:
                r,g,b,a=color.color;color.color=(.65+.35*r,.65+.35*g,.65+.35*b,a)
        meshes=[o for o in s.root.children_recursive if o.type=='MESH']
        for o in meshes:o.data.calc_loop_triangles()
        triangles=sum(len(o.data.loop_triangles) for o in meshes);draws=sum(len(o.data.materials) for o in meshes)
        if triangles>[30000,12000,4000][lod] or draws>8:raise ValueError(f'{asset} LOD{lod}: {triangles} triangles, {draws} draws')
        path=directory/('model'+('' if lod==0 else f'.lod{lod}')+'.glb');export.glb(s.root,path)
        stats[f'lod{lod}']={'triangles':triangles,'drawCalls':draws,'bytes':path.stat().st_size,'materials':sorted({m.name for o in meshes for m in o.data.materials})}
    (directory/'geometry.json').write_text(json.dumps(stats,indent=2)+'\n')
    source=directory/('model'+(f'.lod{args.distance_tier}' if args.distance_tier else '')+'.glb')
    output=Path(args.glb).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    if source.resolve()!=output:shutil.copyfile(source,output)
