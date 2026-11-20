import hashlib, tempfile, unittest
from pathlib import Path
from overlay import apply_overlay
from run import DRIVER, F, V, S, cohort, layout_clock, put

class DiagnosticTest(unittest.TestCase):
    def test_schedule(self):
        self.assertEqual([(a["product"],a["ids"]) for a in cohort()], [(p,[F,V,S]) for p in "ABBA"])

    def test_driver(self):
        import os
        original=Path(os.environ["DIAGNOSTIC_DRIVER_TEST"]).read_bytes()
        adapted=apply_overlay(original,DRIVER).decode()
        stock=original.decode()
        with self.assertRaisesRegex(ValueError,"unapproved"):
            apply_overlay(original+b"\n",DRIVER)
        with self.assertRaisesRegex(ValueError,"nonunique"):
            apply_overlay(b"irrelevant",hashlib.sha256(b"irrelevant").hexdigest())
        for token in ("definition.Act(control, index + warmups);","host.Measure(new Size(1120, 700));",
            "host.Arrange(new Rect(0, 0, 1120, 700));","if (layoutReady) EnsureVariableListLayoutReady(host, (FsusVirtualList)control);",
            "using var bitmap = new RenderTargetBitmap", "await WaitForRenderAsync();",
            "host.Children.Remove(control);","host.Children.Add(control);",
            "index < longScrollIterations"):
            self.assertEqual(stock.count(token),adapted.count(token),token)
        body=adapted[adapted.index("var layoutWatch"):adapted.index("var drawWatch")]
        sequence=["diagnostic[diagnosticIndex] =", "host.Measure(", "diagnostic[diagnosticIndex + 1] =",
                  "host.Arrange(", "diagnostic[diagnosticIndex + 2] =","EnsureVariableListLayoutReady(","diagnostic[diagnosticIndex + 3] =", "layoutWatch.Stop();"]
        self.assertEqual([body.index(a) for a in sequence],sorted(body.index(a) for a in sequence))
        self.assertNotIn("WriteAllText",body)
        self.assertIn("const int threadCpuClock = 3",adapted)
        self.assertIn("return new(wall, checked",adapted)

    def test_clock_parser(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"x.json"
            stamp=lambda w,c,g=0: {"Tid":1,"WallTicks":w,"CpuNanoseconds":c,"Gen2":g}
            c={"Scenario":F,"WallFrequency":1000,"PhaseOrder":["start","measure-end","arrange-end","layout-ready-end"],
               "Stamps":[stamp(0,0),stamp(10,5_000_000,1),stamp(12,7_000_000,1),stamp(12,7_000_000,1)]*21}
            put(p,c); self.assertEqual(layout_clock(p,F)["frames"][20]["layout"],
                {"wallMs":12.0,"threadCpuMs":7.0,"wallMinusCpuMs":5.0,"gen2CountDelta":1})
            c["Stamps"][3]=stamp(13,8_000_000,1);put(p,c)
            with self.assertRaisesRegex(ValueError,"unexpectedly"): layout_clock(p,F)
            c["Scenario"]=V;c["Stamps"][3]["Tid"]=34;put(p,c)
            with self.assertRaisesRegex(ValueError,"UI thread changed"): layout_clock(p,V)

if __name__=="__main__": unittest.main()
