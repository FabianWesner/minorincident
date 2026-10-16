import subprocess,os,signal,time,sys,pathlib
wrapper=pathlib.Path('/tmp/merge-collision-lockbin');wrapper.mkdir(exist_ok=True)
lock=wrapper/'lockf';lock.write_text('#!/bin/sh\nexec /usr/bin/lockf -t 0 "$@"\n');lock.chmod(0o755)
env=os.environ.copy();env['PATH']=str(wrapper)+':'+env['PATH']
deadline=time.monotonic()+1800
while time.monotonic()<deadline:
 p=subprocess.Popen(['sh','tools/perf/quiet-run.sh',*sys.argv[1:]],env=env,start_new_session=True)
 try: rc=p.wait(timeout=min(1140,deadline-time.monotonic()))
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  print('Bounded batch stopped at reservation deadline',flush=True);sys.exit(124)
 if rc!=75:sys.exit(rc)
 time.sleep(10)
print('Slot admission exceeded 30 minutes; unmeasured',flush=True);sys.exit(75)
