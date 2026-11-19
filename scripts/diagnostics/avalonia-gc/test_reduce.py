import unittest

from reduce import PHASES, PREFIX, SCENARIO, analyze


def fixture(prefixed=False):
    provider = "FsusUI-RenderPhases"
    events = []
    for sample in range(21):
        for i, phase in enumerate(PHASES):
            events.append({"provider": provider, "name": "Phase", "pid": 10, "ms": 100 + 100 * sample + i,
                           "payload": {"scenario": SCENARIO, "sample": str(sample), "phase": phase}})
    for phase in ("scenario-start", "before-measured", "after-measured", "scenario-complete"):
        events.append({"provider": provider, "name": "Phase", "pid": 10, "ms": 5,
                       "payload": {"scenario": SCENARIO, "phase": phase, "data": "{}"}})
    raw = {"Id": SCENARIO, "FrameMs": [16] * 21, "RemountPerSample": False, "Gc": {"Gen2": 1}}
    summary = {"Results": [{"Id": id} for id in (PREFIX if prefixed else [SCENARIO])],
               "Runner": {"Samples": 21, "Warmups": 1, "LongScrollIterations": 256},
               "Environment": {"DotNet": ".NET 10.0.15", "RequestedBackend": "auto", "WindowPlatform": "XID"}}
    return events, raw, summary


def gc(name, ms, pid=10):
    return {"provider": ".NET", "pid": pid, "name": "GC/" + name, "ms": ms, "payload": {}}


class AnalysisControls(unittest.TestCase):
    def test_only_full_managed_pause_overlaps_bitmap(self):
        events, raw, summary = fixture()
        # Sample 0 creates at 106..107, renders at 108..109, disposes at 110..111.
        events += [gc("Start", 98), gc("SuspendEEStop", 105.5),
                   gc("RestartEEStart", 107.2), gc("Stop", 130),
                   gc("SuspendEEStop", 108.1, 11), gc("RestartEEStart", 108.9, 11)]
        result = analyze(sorted(events, key=lambda e: e["ms"]), raw, summary, False)
        frame = result["frames"][0]
        self.assertEqual(frame["spans"]["bitmap-create"]["gcPauseOverlapMs"], 1)
        self.assertEqual(frame["spans"]["bitmap-render"]["gcPauseOverlapMs"], 0)
        self.assertEqual(frame["spans"]["bitmap-dispose"]["gcPauseOverlapMs"], 0)
        self.assertAlmostEqual(frame["managedPauseThroughDispatchMs"], 1.7)
        self.assertEqual(result["frameP95Ms"], 16)

    def test_missing_frame_boundary_and_unpaired_measured_pause_rejected(self):
        events, raw, summary = fixture(True)
        with self.assertRaisesRegex(ValueError, "incomplete or disordered"):
            analyze(events[1:], raw, summary, True)
        with self.assertRaisesRegex(ValueError, "unclosed measured"):
            analyze(events + [gc("SuspendEEStop", 115)], raw, summary, True)

    def test_wrong_prefix_rejected_even_with_identical_count(self):
        events, raw, summary = fixture(True)
        summary["Results"][0], summary["Results"][1] = summary["Results"][1], summary["Results"][0]
        with self.assertRaisesRegex(ValueError, "wrong benchmark workload"):
            analyze(events, raw, summary, True)


if __name__ == "__main__":
    unittest.main()
