import subprocess,os,time,urllib.request,json,signal,sys
phase=sys.argv[1];head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();logpath=f'/tmp/2228-828-menu-padding-{phase}-preview.log';log=open(logpath,'w');p=subprocess.Popen(['pnpm','exec','vite','preview','--config','vue/packages/demo-app/vite.config.ts','--outDir',os.path.abspath('.tmp/visual-runtime/demo-dist'),'--host','127.0.0.1','--port','5380','--strictPort'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
try:
 ready=False
 for n in range(100):
  if p.poll() is not None:raise RuntimeError('owned preview refused')
  try:urllib.request.urlopen('http://127.0.0.1:5380',timeout=1);ready=True;break
  except Exception:time.sleep(.1)
 if not ready:raise RuntimeError('owned preview not ready')
 env=os.environ.copy();env.pop('CI',None);env.update(FSUS_PLAYWRIGHT_EXTERNAL_SERVER='http://127.0.0.1:5380',FSUS_VISUAL_EVIDENCE='1');cmd=['pnpm','exec','playwright','test','--config=vue/playwright.config.ts',*sys.argv[2:],'--workers=1','--trace=on',f'--output=/tmp/2228-828-menu-padding-{phase}'];path=f'/tmp/2228-828-menu-padding-{phase}.log'
 with open(path,'w') as f:q=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,env=env)
 json.dump({'candidate':head,'command':cmd,'exitCode':q.returncode,'log':path,'previewLog':logpath,'CI':'unset; zero original retries'},open(f'/tmp/2228-828-menu-padding-{phase}-result.json','w'),indent=2);print(phase,head,q.returncode,flush=True)
finally:
 if p.poll() is None:os.killpg(p.pid,signal.SIGTERM);p.wait()
 log.close()
