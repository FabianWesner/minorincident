"""Alpha look variants (PO #23: "alphas could have different looks").

Every variant is the same rig, pose, scale and animation set as inf.alpha; only palette tokens and extra clothing/growth
volumes differ. Tokens are palette.json names, so each variant stays inside the shared palette (no textures, no new shader
variants). `features` runs inside the worker build namespace (world-space coordinates before the lurching pose is baked):
available helpers are ell/box/tube/patch, material keys `v_skin`, `v_upper`, `v_trim`, `blood`. Parent names: head, torso, armL/armR (character right is -Y).
"""

# skin: exposed skin token. upper: jacket/shirt/hoodie token (None = the base's dark clothes). trim: accent token.
# sleeves: long sleeves in the upper colour instead of bare mutated arms. bald: no hair cap. shirt: torn shirt hems use trim.
VARIANTS = {
    'base': dict(skin='purple', upper=None, trim=None, sleeves=False, bald=False, shirt=False, features=''),
    'worker': dict(skin='olive', upper='denimBlue', trim='schoolBusYellow', sleeves=False, bald=True, shirt=False, features='''
# Denim bib overalls, hi-vis stripes, a yellow hard hat with a brim and a swollen tumour on the right shoulder.
ell('hat_dome',(-.012,0,1.48),(.19,.2,.11),'v_trim','head',seg=14,rings=8)
ell('hat_brim',(.05,0,1.44),(.225,.2,.016),'v_trim','head',seg=14,rings=4)
ell('hat_ridge',(-.01,0,1.578),(.13,.028,.022),'v_trim','head',seg=10,rings=5)
for s in (-1,1):
    tube('overall_strap'+str(s),[(.02,s*.075,1.165),(.176,s*.082,1.06),(.2,s*.085,.93)],[(.03,.045),(.03,.05),(.03,.05)],'v_upper','torso',N=8,sub=0)
    tube('hi_vis_leg'+str(s),[(.095,s*.15,.44),(.12,s*.178,.43)],[(.045,.05),(.05,.06)],'v_trim','legL' if s>0 else 'legR',N=8,sub=0)
ell('hi_vis_chest',(.07,0,.82),(.205,.236,.045),'v_trim','torso',seg=14,rings=5)
ell('hi_vis_belly',(.07,0,.7),(.185,.222,.04),'v_trim','torso',seg=14,rings=5)
ell('tumour_a',(-.02,-.285,1.185),(.115,.105,.1),'v_skin','armR',seg=12,rings=8)
ell('tumour_b',(-.07,-.33,1.24),(.075,.07,.07),'v_skin','armR',seg=10,rings=6)
ell('tumour_blood',(-.02,-.34,1.255),(.05,.04,.03),'blood','armR',seg=8,rings=5)
'''),
    'hoodie': dict(skin='argyleGrey', upper='tealDark', trim='bone', sleeves=True, bald=True, shirt=False, features='''
# A hood pulled up around the face, bone spikes pushing through the back, drawstrings and a pocket.
ell('hood_shell',(-.085,0,1.385),(.21,.215,.215),'v_upper','head',seg=16,rings=10)
ell('hood_back',(-.18,0,1.22),(.13,.2,.16),'v_upper','head',seg=12,rings=7)
tube('hood_rim',[(.1,-.165,1.5),(.152,-.1,1.46),(.158,0,1.52),(.152,.1,1.46),(.1,.165,1.5)],[.032]*5,'v_upper','head',N=8,sub=0)
for s in (-1,1):
    tube('drawstring'+str(s),[(.135,s*.045,1.17),(.2,s*.05,1.07),(.225,s*.05,.96)],[.011,.011,.015],'v_trim','torso',N=6,sub=0)
ell('hoodie_pocket',(.15,0,.78),(.075,.19,.085),'v_upper','torso',seg=12,rings=6)
for i,(y,z,l) in enumerate([(-.09,1.13,.12),(.05,1.2,.15),(.14,1.06,.1)]):
    tube('back_spike'+str(i),[(-.15,y,z),(-.23,y*1.1,z+.07),(-.2-l,y*1.2,z+.07+l*.9)],[.05,.032,.004],'v_trim','torso',N=6,sub=0)
'''),
    'fire': dict(skin='leather', upper='orange', trim='silver', sleeves=True, bald=True, shirt=False, features='''
# Turnout jacket with reflective bands, a high collar, a helmet with a long rear brim and a bony plate on the right shoulder.
ell('helmet_dome',(-.015,0,1.485),(.2,.205,.108),'v_upper','head',seg=14,rings=8)
ell('helmet_brim_back',(-.12,0,1.42),(.14,.18,.016),'v_upper','head',seg=14,rings=4)
ell('helmet_brim_front',(.06,0,1.445),(.17,.19,.014),'v_upper','head',seg=12,rings=4)
ell('helmet_band',(-.012,0,1.47),(.207,.212,.026),'v_trim','head',seg=14,rings=5)
ell('helmet_crest',(-.02,0,1.57),(.14,.028,.024),'v_trim','head',seg=10,rings=5)
ell('jacket_collar',(-.065,0,1.15),(.115,.185,.075),'v_upper','torso',seg=12,rings=6)
ell('reflective_chest',(.05,0,.9),(.205,.238,.04),'v_trim','torso',seg=14,rings=5)
ell('reflective_hem',(.04,0,.73),(.19,.226,.04),'v_trim','torso',seg=14,rings=5)
ell('reflective_cuffL',(.045,.368,.855),(.105,.105,.034),'v_trim','foreArmL',seg=12,rings=5)
ell('reflective_cuffR',(.045,-.368,.855),(.105,.105,.034),'v_trim','foreArmR',seg=12,rings=5)
ell('bone_plate',(-.03,-.27,1.19),(.15,.13,.07),'v_trim','armR',seg=12,rings=7)
for i,(dy,dz) in enumerate([(-.04,.02),(.04,.0),(0,.05)]):
    tube('plate_spike'+str(i),[(-.03,-.27+dy,1.2+dz),(-.03,-.28+dy,1.28+dz),(-.04,-.29+dy,1.36+dz)],[.04,.025,.004],'v_trim','armR',N=6,sub=0)
'''),
    'suit': dict(skin='poloDark', upper='pants', trim='bone', sleeves=True, bald=True, shirt=True, features='''
# Torn grey suit: padded shoulders, coat tails, a white shirt front with the remains of a blood-red tie, an exposed growth on the bald skull and a swollen right forearm.
for s in (-1,1):
    ell('shoulder_pad'+str(s),(-.02,s*.28,1.14),(.125,.12,.065),'v_upper','armL' if s>0 else 'armR',seg=12,rings=6)
ell('shirt_front',(.11,0,1.0),(.14,.09,.2),'v_trim','torso',seg=12,rings=7)
ell('shirt_collar_l',(.1,.09,1.1),(.07,.075,.04),'v_trim','torso',seg=10,rings=5)
ell('shirt_collar_r',(.1,-.09,1.1),(.07,.075,.04),'v_trim','torso',seg=10,rings=5)
tube('tie',[(.19,0,1.12),(.205,.012,.95),(.215,-.01,.8)],[(.03,.035),(.035,.05),(.015,.03)],'blood','torso',N=8,sub=0)
for s in (-1,1):
    patch('coat_tail'+str(s),[(-.17,s*.02,.76),(-.19,s*.2,.74),(-.2,s*.23,.43),(-.21,s*.1,.37),(-.2,s*.02,.45)],'v_upper','hip',.03)
ell('skull_growth_a',(-.04,.05,1.54),(.1,.09,.055),'v_skin','head',seg=12,rings=8)
ell('skull_growth_b',(.03,-.07,1.555),(.07,.065,.045),'v_skin','head',seg=10,rings=6)
ell('skull_growth_blood',(-.04,.05,1.585),(.045,.04,.025),'blood','head',seg=8,rings=5)
ell('forearm_swell',(.065,-.385,.82),(.1,.095,.115),'v_skin','foreArmR',seg=12,rings=8)
ell('forearm_swell_blood',(.1,-.385,.84),(.045,.04,.05),'blood','foreArmR',seg=8,rings=5)
'''),
}
