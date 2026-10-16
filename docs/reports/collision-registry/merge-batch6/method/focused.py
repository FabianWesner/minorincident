import os,subprocess,pathlib,json,time,signal
out='docs/reports/collision-registry/merge-batch6/evidence'
scenes='collision-alpha-charge-registry,alphas-at-the-tank,collision-l5-metro-ingress,collision-l7-courier-queue,collision-zoo-s2-mixed-query,corgi-firestation-apron,corgi-follow,corgi-behaviour,l10-e3b-mega-arrival,l10-mega-close-contact'
results=[]
for backend,port in [('webgl2','3491'),('webgpu','3492')]:
 env=os.environ.copy();env.update(SCENE_SERVER='preview',SCENE_PORT=port,E2E_UNITS='2')
 cmd=['npm','run','scene:catalog','--','--matrix','--backend',backend,'--filter',scenes,'--out',out+'/final-'+backend]
 print('START',backend,flush=True);p=subprocess.Popen(cmd,env=env,start_new_session=True)
 try:rc=p.wait(timeout=1800)
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  rc=124
 results.append({'backend':backend,'exit':rc});print('END',backend,rc,flush=True)
 if backend=='webgl2':time.sleep(60)
pathlib.Path(out+'/focused-command.json').write_text(json.dumps(results,indent=2)+'\n')
raise SystemExit(any(r['exit'] for r in results))
