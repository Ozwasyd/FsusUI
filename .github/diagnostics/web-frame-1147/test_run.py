import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import run as r


class DiagnosticTests(unittest.TestCase):
    def test_archived_driver_symmetry_with_exact_cases(self):
        archive = Path(os.environ.get('FSUSUI_WEB_FRAME_DIAGNOSTIC_ARCHIVE', 'archive'))
        source = (archive / 'performance-current/web/measurement-effective.mjs').read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            a = r.adapt(source,p/'base',p/'helpers',p/'pw.mjs')
            b = r.adapt(source,p/'candidate',p/'helpers',p/'pw.mjs')
            self.assertEqual(a.replace(str(p/'base'),str(p/'candidate')),b)
            self.assertIn('const matrix = '+json.dumps(list(r.CASES.values())), a)
            self.assertIn('chromiumSandbox: true',a)
            self.assertIn('const probe = await window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe()',a)
            self.assertIn('iteration, previousRaf, started, actionRaf, actionCompleted, frameCompleted, rafTimestamp, previousProbeCompleted',a)
            f=p/'driver.mjs'
            f.write_text(a)
            subprocess.run(['node','--check',str(f)],check=True)
            with self.assertRaises(ValueError):
                r.adapt(source+b' ',p,p,p)

    def test_summary_verifies_raw_phase_and_keeps_original_probe(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)
            protocol={'schema':'test'}
            idle={'cadence':{'status':'consistent-with-request'}}
            cases=[]
            for case,config in r.CASES.items():
                table=config[0]=='data-pipeline-table'
                delays=[8]*19+[12,18]
                anchors=[dict(iteration=i+1, previousRaf=i*100+99, started=i*100+100,
                              actionRaf=i*100+99, actionCompleted=i*100+102,
                              frameCompleted=i*100+100+elapsed,rafTimestamp=i*100+100+elapsed,
                              previousProbeCompleted=i*100+98 if table and i else None)
                         for i,elapsed in enumerate(delays)]
                common=dict(id=case,measurementProtocol=protocol,**dict(zip(
                    ('scenario','size','refreshHz','dpr','motion'),config)))
                raw=dict(**common,idleCadence=idle,inputToFrame=delays,frameWork=[2]*21,
                         phaseAnchors=anchors,domNodes=50,droppedFrameRate=0,
                         dataPipeline=[dict(legacyBlockMs=25,workerEndToEndMs=6,workerSubmitBlockMs=1)]*21 if table else [])
                r.write(p/(case+'.raw.json'),raw)
                cases.append((case,raw,dict(inputToNextFrameMs={'p95':12},**common)))
            summary=dict(gitSha='abc',measurementProtocol=protocol,idleCadence=idle,
                         results=[c[2] for c in cases],
                         environment=dict(browser='Chromium '+r.BROWSER,node='v'+r.NODE,
                                          os='Linux',cpu='test',logicalCores=4,totalMemoryBytes=4096),
                         runner=dict(warmups=1,samples=21,matrixSize=2))
            r.write(p/'summary.json',summary)
            data=r.summarize(p,'abc',protocol)
            self.assertEqual(list(data['cases']),list(r.CASES))
            row=data['cases'][cases[1][0]]
            self.assertEqual((row['p95'],row['actionP95'],row['waitP95'],row['waitOver10']),(12,2,10,1))
            self.assertEqual(row['priorTableProbeToStartMedian'],2)
            self.assertEqual(row['tableAuxiliaryP95']['legacyBlockMs'],25)
            with self.assertRaises(ValueError):
                r.summarize(p,'stale',protocol)
            case,raw,_ = cases[1]
            raw['phaseAnchors'][2]['previousProbeCompleted']=None
            r.write(p/(case+'.raw.json'),raw)
            with self.assertRaisesRegex(ValueError,'previous table probe'):
                r.summarize(p,'abc',protocol)

    def test_plan_and_score_require_matched_same_host_controls(self):
        n,seed=4,1147
        plan=r.plan(n,seed)
        self.assertEqual(plan,r.plan(n,seed))
        self.assertEqual([o for k,i,o in sorted(plan) if k=='AA'],['AXXA','XAAX']*2)
        self.assertEqual([o for k,i,o in sorted(plan) if k=='AB'],['ABBA','BAAB']*2)
        def material(t):
            return {'host': {'cpu':'fixed'},'cases':{case: {'p95':12 if t=='B' else 10,
                 'actionP95':2,'waitP95':10 if t=='B' else 8,
                 'submissionPhaseMedian':4,'priorTableProbeToStartMedian':None} for case in r.CASES}}
        blocks=[(k,i,[(t,material(t)) for t in order]) for k,i,order in plan]
        result=r.summarize_blocks(blocks,plan)
        self.assertFalse(result['formalAcceptance'])
        for case in r.CASES:
            self.assertEqual(result['cases'][case]['ABBlocksOver15Percent'],4)
            self.assertEqual(result['cases'][case]['AAMaxAbs'],0)
            self.assertEqual(result['cases'][case]['phaseDifferencesMs']['waitP95']['AB'],[2]*4)
            self.assertEqual(result['cases'][case]['phaseDifferencesMs']['actionP95']['AA'],[0]*4)
        with self.assertRaisesRegex(ValueError,'Incomplete predeclared'):
            r.summarize_blocks(blocks[:-1],plan)
        with self.assertRaisesRegex(ValueError,'Unexpected block'):
            r.summarize_blocks(list(reversed(blocks)),plan)
        blocks[0][2][0][1]['host']['cpu']='wrong'
        with self.assertRaisesRegex(ValueError,'Mixed CPUs'):
            r.summarize_blocks(blocks,plan)
