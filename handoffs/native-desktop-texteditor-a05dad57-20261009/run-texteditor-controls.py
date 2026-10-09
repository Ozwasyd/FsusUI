from pathlib import Path
import os,json,subprocess,hashlib,xml.etree.ElementTree as ET
from collections import Counter
root=Path('/workspace/native-desktop-texteditor-successor')
out=Path('/workspace/native-desktop-texteditor-evidence')
selection=json.loads((out/'selection.json').read_text())
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert head==selection['head'] and not subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip()
assert not os.environ.get('FSUSUI_UPDATE_VISUAL_ARTIFACTS')
selector=(out/'texteditor-filter.txt').read_text().strip()
common=['dotnet','test','FsusUI.Avalonia.Tests/FsusUI.Avalonia.Tests.csproj','--no-build','--no-restore','-c','Release','--filter',selector]
env=os.environ.copy()
discovery=common+['--list-tests']
r=subprocess.run(discovery,cwd=root/'dotnet',env=env,capture_output=True,text=True)
(out/'discovery.log').write_text(r.stdout+r.stderr)
assert r.returncode==0
names=[line.strip() for line in r.stdout.splitlines() if line.strip().startswith('FsusUI.Avalonia.Tests.Controls.FsusTextEditorPrimitiveTests.')]
assert len(names)==len(set(names))==4 and Counter(names)==Counter(selection['methodCases'])
(out/'admission.json').write_text(json.dumps({'head':head,'command':discovery,'expected':4,'names':names},indent=2)+'\n')
command=common+['--logger','trx;LogFileName=texteditor.trx','--results-directory',str(out/'test-results')]
r=subprocess.run(command,cwd=root/'dotnet',env=env,capture_output=True,text=True)
(out/'test.log').write_text(r.stdout+r.stderr)
trx=out/'test-results/texteditor.trx';ns={'t':'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}
doc=ET.parse(trx);cases=doc.findall('.//t:UnitTestResult',ns);counters=doc.find('.//t:Counters',ns).attrib
assert sorted(c.attrib['testName'] for c in cases)==sorted(names)
assert int(counters['total'])==int(counters['executed'])==4 and int(counters['notExecuted'])==0
(out/'results.json').write_text(json.dumps({'head':head,'command':command,'exit':r.returncode,'counters':counters,'cases':[{'name':c.attrib['testName'],'outcome':c.attrib['outcome']} for c in cases],'trxSha256':hashlib.sha256(trx.read_bytes()).hexdigest()},indent=2)+'\n')
print(json.dumps(counters),flush=True)
assert r.returncode==0 and int(counters['passed'])==4 and int(counters['failed'])==0
