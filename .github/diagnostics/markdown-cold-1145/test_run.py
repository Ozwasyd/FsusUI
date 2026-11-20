import os
import tempfile
from pathlib import Path
import subprocess
import unittest

import run as r


class DiagnosticTests(unittest.TestCase):
    def test_archived_transform_is_symmetric_and_sensitive(self):
        src = Path(os.environ.get('FSUSUI_MARKDOWN_COLD_DIAGNOSTIC_ARCHIVE', '../1145-perf-evidence')).joinpath('performance-current/web/measurement-effective.mjs').read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            result = r.adapt(src,p/'base',p/'scripts',p/'pw.mjs')
            duplicate = r.adapt(src,p/'candidate',p/'scripts',p/'pw.mjs')
            self.assertEqual(result.replace(str(p/'base'),str(p/'candidate')),duplicate)
            self.assertIn("const matrix = [['markdown-cold', 24 * 1024, 60, 1, 'enabled']]",result)
            self.assertIn('chromiumSandbox: true',result)
            self.assertIn('phaseAnchor: { iteration, previousRaf, started, actionCompleted, frameCompleted, rafTimestamp }',result)
            f=p/'driver.mjs'
            f.write_text(result)
            subprocess.run(['node','--check',str(f)],check=True)
            with self.assertRaises(ValueError):
                r.adapt(src+b' ',p,p,p)

    def test_predeclared_blocks_balance(self):
        p=r.plan(6,1144)
        self.assertEqual(p,r.plan(6,1144))
        self.assertEqual(len(p),12)
        self.assertEqual([order for kind,i,order in sorted(p) if kind=='AB'],
                         ['ABBA','BAAB']*3)
        self.assertEqual([order for kind,i,order in sorted(p) if kind=='AA'],
                         ['AXXA','XAAX']*3)

    def test_summary_fails_closed_and_separates_next_frame(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)
            digest={'schema':'test'}
            e=[8]*19+[12,18]
            anchors=[dict(iteration=i+1, previousRaf=99, started=100,
                          actionCompleted=102, frameCompleted=100+n,rafTimestamp=100+n)
                     for i,n in enumerate(e)]
            raw=dict(id=r.CASE,measurementProtocol=digest,
                     idleCadence={'cadence':{'status':'consistent-with-request'}},
                     size=24576,refreshHz=60,dpr=1,motion='enabled',
                     navigationMs=14,firstCold=dict(readySinceNavigationStartMs=12,coldInitAt=2,readyAt=12,initToReadyMs=10,query='?performance=markdown-cold&size=24576&motion=enabled',renderer='wasm',fixtureError=None,phases=dict(parseMs=1,transferMs=2,commitMs=1,activationMs=0)),inputToFrame=e,frameWork=[2]*21,phaseAnchors=anchors,domNodes=50,droppedFrameRate=0)
            summary=dict(gitSha='abc',measurementProtocol=digest,
                        results=[dict(id=r.CASE,inputToNextFrameMs={'p95':12})],
                        environment=dict(browser='Chromium '+r.BROWSER,node='v'+r.NODE),
                        runner=dict(warmups=1,samples=21,matrixSize=1))
            r.write(p/(r.CASE+'.raw.json'),raw)
            r.write(p/'summary.json',summary)
            m=r.summarize(p,'abc',digest)
            self.assertNotEqual(raw['firstCold']['initToReadyMs'],e[-1])
            self.assertEqual((m['coldInitToReadyMs'],m['coldNavigationToReadyMs']),(10,14))
            self.assertEqual((m['p95'],m['actionP95'],m['waitP95'],m['waitOver10']),(12,2,10,1))
            with self.assertRaises(ValueError):
                r.summarize(p,'stale',digest)
            raw['firstCold']['renderer']='fallback'
            r.write(p/(r.CASE+'.raw.json'),raw)
            with self.assertRaisesRegex(ValueError, 'Invalid first cold ready'):
                r.summarize(p,'abc',digest)
            raw['firstCold']['renderer']='wasm'
            raw['firstCold']['fixtureError']='fallback occurred'
            r.write(p/(r.CASE+'.raw.json'),raw)
            with self.assertRaisesRegex(ValueError, 'Invalid first cold ready'):
                r.summarize(p,'abc',digest)
            raw['firstCold']['fixtureError']=None
            raw['firstCold']['phases'].pop('transferMs')
            r.write(p/(r.CASE+'.raw.json'),raw)
            with self.assertRaisesRegex(ValueError, 'Missing cold stage'):
                r.summarize(p,'abc',digest)
            raw['firstCold']['phases']['transferMs']=2
            raw['phaseAnchors'][2]['frameCompleted']=170
            r.write(p/(r.CASE+'.raw.json'),raw)
            with self.assertRaises(ValueError):
                r.summarize(p,'abc',digest)

    def test_score_does_not_issue_formal_acceptance(self):
        def rows(order, vals):
            return list(zip(order, ({'p95':v,'coldNavigationToReadyMs':v,'coldInitToReadyMs':v} for v in vals)))
        x=r.score([('AA',rows('AXXA',[10]*4)),('AB',rows('ABBA',[10,12,12,10]))])
        self.assertFalse(x['formalAcceptance'])
        self.assertEqual(x['p95']['ABBlocksOver15Percent'],1)
        self.assertEqual(x['p95']['AAMaxAbs'],0)
        with self.assertRaises(ValueError):
            r.score([('AB',rows('ABBA',[10,12,12]))])


if __name__=='__main__':
    unittest.main()
