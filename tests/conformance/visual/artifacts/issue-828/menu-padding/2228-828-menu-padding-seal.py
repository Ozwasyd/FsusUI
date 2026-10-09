from pathlib import Path
import shutil,zipfile,hashlib,json,subprocess
root=Path('tests/conformance/visual/artifacts/issue-828/menu-padding');root.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=[]
def archive(name,src):
 src=Path(src)
 with zipfile.ZipFile(root/name,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(src.rglob('*')):
   if p.is_file():
    arc=str(p.relative_to(src));z.write(p,arc);raw.append({'archive':str(root/name),'entry':arc,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
archive('before-contract-first-raw.zip','/tmp/2228-828-menu-padding-before-contract-first')
archive('after-contract-first-raw.zip','/tmp/2228-828-menu-padding-after-contract-first')
archive('native-readonly-first-raw.zip','.tmp/issue-828-menu-padding')
for p in Path('/tmp').glob('2228-828-menu-padding-*'):
 if p.is_file() and p.suffix in ['.log','.json','.py']:shutil.copy2(p,root/p.name)
for p in Path('/tmp/2228-828-menu-padding-issue-readback').glob('*.json'):shutil.copy2(p,root/('current-issue-'+p.name))
shutil.copy2('.tmp/visual-runtime/manifest.json',root/'current-runtime-manifest.json')
for phase in ['after-native-labels','after-native-locales']:
 for name in ['labels.json','native-target-result.json']:shutil.copy2(Path('.tmp/issue-828-menu-padding')/phase/name,root/(phase+'-'+name))
shutil.copy2('.tmp/issue-828-menu-padding/current-budget-observations.json',root/'current-budget-observations.json')
css={name:sha(Path('vue/packages/theme-chalk/dist/'+name).read_bytes()) for name in ['el-public-shell.css','el-public-shell-critical.css']}
old=[]
for namespace in ['geometry','explicit-modes','label-visibility','native-end-buffer']:
 p=Path('tests/conformance/visual/artifacts/issue-828')/namespace/'artifact-custody-manifest.json'
 if p.exists():
  disk=p.read_bytes();git=subprocess.check_output(['git','show','16e98a88:'+str(p)]);assert disk==git;old.append({'path':str(p),'sha256':sha(disk),'diskMatchesFrozenGit':True})
x={'testedCandidate':'543879f08ca17959e2c2116bcc057d26f6545f86','baselineProductCandidate':'e30778563d2271acd924f65ded814bfb0c972076','classificationCommit':'f83e502385c21d11507d1408d22f91caff0dbad3','beforeCandidate':'eeb4a9778bb59e13b9582c713d53ea6de5e68817','qualificationEligible':False,'independentReviewerThread':'01a11b52-ec77-7602-9d9e-3f040157403f','newFullProfile':'not run','retainedOldFullProfile':{'candidate':'e30778563d2271acd924f65ded814bfb0c972076','exitCode':1,'passed':656,'failed':51,'waived':False},'newRegression':{'before':{'passed':24,'failed':24,'exitCode':1},'after':{'passed':48,'failed':0,'exitCode':0}},'originalBrowserTests':{'passed':42,'failed':0,'exitCode':0},'native':{'default':144,'locale':432,'failures':0,'minVisibleLogicalWidth':44,'minHeight':44,'epsilon':False},'unit':{'passed':27,'exitCode':0},'fullCssSHA256':css['el-public-shell.css'],'criticalCssSHA256':css['el-public-shell-critical.css'],'runtimeSourceFingerprint':json.loads((root/'current-runtime-manifest.json').read_text())['sourceFingerprint'],'frozenManifests':old}
x['classificationCommit']='f83e502385c21d11507d1408d22f91caff0dbad3'
(root/'result-summary.json').write_text(json.dumps(x,indent=2)+'\n')
(root/'raw-entry-custody.json').write_text(json.dumps({'testedCandidate':x['testedCandidate'],'entries':raw},indent=2)+'\n')
print(json.dumps({'files':len(list(root.glob('*'))),'rawEntries':len(raw),'css':css,'frozen':old},indent=2))
