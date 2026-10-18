import subprocess,sys,os,signal,time,json
seconds=int(sys.argv[1]);command=sys.argv[2:];start=time.monotonic()
p=subprocess.Popen(command,start_new_session=True)
try: result=p.wait(timeout=seconds)
except subprocess.TimeoutExpired:
 print(json.dumps({'timeoutSeconds':seconds,'command':command}),flush=True)
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=15)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
 result=124
print(json.dumps({'exit':result,'seconds':round(time.monotonic()-start,2)}),flush=True)
sys.exit(result)
