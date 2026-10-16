import os,sys,time,signal,subprocess,json
limit=int(sys.argv[1]);cmd=sys.argv[2:];start=time.time()
p=subprocess.Popen(cmd,start_new_session=True)
try: rc=p.wait(timeout=limit)
except subprocess.TimeoutExpired:
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=15)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
 rc=124
print(json.dumps(dict(command=cmd,seconds=round(time.time()-start,2),exit=rc)),flush=True)
sys.exit(rc)
