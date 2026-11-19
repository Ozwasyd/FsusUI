"""Summarize authenticated capture files from the four-arm diagnostic, not a CI gate."""

import hashlib
import json
import math
import sys
from pathlib import Path

SCENARIO = "virtual-list-variable-100k-sustained"
ARMS = ("A-isolated", "B-prefix", "B-isolated", "A-prefix")
PRODUCTS = {"A": "f2d929a5d045439c35e93b4771f912ce50ec2337",
            "B": "4923ba3e148efc84792bef0c5c7593a706b5efc7"}
PREFIX = [
    "virtual-list-fixed-100k", "virtual-list-variable-100k", "table-v2-two-axis-100k",
    "data-table-sort-select-replace", "tree-expand-scroll", "input-continuous",
    "theme-switch", SCENARIO,
]
PHASES = (
    "sample-start", "action-end", "layout-start", "measure-end", "layout-end",
    "draw-start", "bitmap-create-start", "bitmap-create-end",
    "bitmap-render-start", "bitmap-render-end", "bitmap-dispose-start",
    "bitmap-dispose-end", "draw-end", "dispatch-start", "dispatch-end", "sample-end",
)
SPANS = {
    key: (f"{key}-start", f"{key}-end")
    for key in ("layout", "draw", "bitmap-create", "bitmap-render", "bitmap-dispose", "dispatch")
}
SPANS["action"] = ("sample-start", "action-end")


def require(ok, why):
    if not ok:
        raise ValueError(why)


def q95(values):
    return sorted(values)[math.ceil(0.95 * len(values)) - 1]


def overlap(start, end, pauses):
    return sum(max(0.0, min(end, right) - max(start, left)) for left, right in pauses)


def read_events(path):
    events = [json.loads(line) for line in path.read_text().splitlines() if line]
    require(events and events[-1] == {"eventsLost": 0}, f"missing or lossy EventPipe trace: {path}")
    return sorted(events[:-1], key=lambda event: event["ms"])


def analyze(events, raw, summary, prefixed):
    marks = {i: {} for i in range(21)}
    heap = {}
    phase_pids = set()
    for event in events:
        if event["provider"] != "FsusUI-RenderPhases":
            continue
        p = event["payload"]
        if "sample" in p:
            require(p["scenario"] == SCENARIO, "unexpected marked scenario")
            phase_pids.add(event["pid"])
            sample, phase = int(p["sample"]), p["phase"]
            require(sample in marks and phase not in marks[sample], "duplicate or invalid frame marker")
            marks[sample][phase] = event["ms"]
        elif p.get("scenario") == SCENARIO and "data" in p:
            require(p["phase"] not in heap, "duplicate sustained heap marker")
            heap[p["phase"]] = json.loads(p["data"])
    require(len(phase_pids) == 1, "ambiguous application PID")
    require(set(heap) == {"scenario-start", "before-measured", "after-measured", "scenario-complete"},
            "missing heap boundary")
    require(all(tuple(row) == PHASES for row in marks.values()), "incomplete or disordered frame markers")
    require(all(marks[i]["sample-end"] <= marks[i+1]["sample-start"] for i in range(20)),
            "overlapping frame markers")
    pid, = phase_pids
    window_begin, window_end = marks[0]["sample-start"], marks[20]["sample-end"]
    pauses, suspension, gc = [], None, []
    for event in events:
        if event["pid"] != pid or not event["name"].startswith("GC/"):
            continue
        kind = event["name"].lower()
        at = event["ms"]
        require(math.isfinite(at), "invalid timestamp")
        if kind.endswith(("suspendeestop", "suspendeeend")):
            require(suspension is None, "unpaired suspend boundary")
            suspension = at
        elif kind.endswith("restarteestart"):
            if suspension is None:
                require(not window_begin <= at <= window_end, "unpaired restart inside measured frames")
            else:
                require(suspension <= at, "negative managed pause")
                pauses.append((suspension, at))
                suspension = None
        if window_begin <= at <= window_end and kind == "gc/start":
            gc.append({"ms": at, "payload": event["payload"]})
    require(suspension is None or suspension > window_end, "unclosed measured GC pause")

    scenarios = [row["Id"] for row in summary["Results"]]
    require(scenarios == (PREFIX if prefixed else [SCENARIO]), "wrong benchmark workload")
    require(summary["Environment"]["RequestedBackend"] == "auto"
            and summary["Environment"]["WindowPlatform"] == "XID", "wrong display protocol")
    require(summary["Runner"]["Samples"] == 21 and summary["Runner"]["Warmups"] == 1
            and summary["Runner"]["LongScrollIterations"] == 256, "wrong benchmark settings")
    require(summary["Environment"]["DotNet"] == ".NET 10.0.15", "wrong application runtime")
    require(raw["Id"] == SCENARIO and len(raw["FrameMs"]) == 21 and not raw["RemountPerSample"],
            "malformed or wrong raw scenario")
    frames = []
    for sample, times in marks.items():
        durations = {}
        for key, (begin, end) in SPANS.items():
            a, b = times[begin], times[end]
            durations[key] = {"wallMs": b - a, "gcPauseOverlapMs": overlap(a, b, pauses)}
        frames.append({"index": sample, "frameMs": raw["FrameMs"][sample],
                       "managedPauseThroughDispatchMs": overlap(times["sample-start"], times["dispatch-end"], pauses),
                       "spans": durations})
    return {
        "pid": pid, "frameP95Ms": q95(raw["FrameMs"]), "gcCounts": raw["Gc"],
        "gcStarts": gc, "heap": heap, "frames": frames,
        "phases": {key: {
            "wallP95Ms": q95([row["spans"][key]["wallMs"] for row in frames]),
            "gcPauseTotalMs": sum(row["spans"][key]["gcPauseOverlapMs"] for row in frames),
        } for key in SPANS},
    }


def main(evidence):
    arms, common_environment = {}, None
    manifest = json.loads((evidence / "manifest.json").read_text())
    require(manifest["status"] == "captured-not-yet-decoded" and len(manifest["arms"]) == 4,
            "capture manifest is incomplete")
    for arm in ARMS:
        folder = evidence / arm
        def read(name):
            return json.loads((folder / name).read_text())
        receipt = read("receipt.json")
        require(receipt["overlaySha256"] == manifest["overlaySha256"]
                and receipt["productSha"] == PRODUCTS[arm[0]], f"{arm} provenance mismatch")
        sustained_file = f"raw/{SCENARIO}.raw.json"
        for name in ("summary.json", "gc.nettrace", sustained_file):
            file_hash = hashlib.sha256((folder / name).read_bytes()).hexdigest()
            require(receipt["hashes"][name] == file_hash, f"{arm}/{name} digest mismatch")
        summary = read("summary.json")
        require(summary["GitSha"] == PRODUCTS[arm[0]], f"{arm} wrong product identity")
        if common_environment is None:
            common_environment = summary["Environment"]
        require(summary["Environment"] == common_environment, f"{arm} environment diverged")
        arm_result = analyze(read_events(folder / "gc.events.jsonl"),
                             read(sustained_file), summary, arm.endswith("-prefix"))
        arms[arm] = arm_result
    result = {
        "formalAcceptance": False,
        "limitation": "One diagnostic process per condition; phase markers perturb timing and do not establish the sole cause.",
        "environment": common_environment, "arms": arms,
    }
    (evidence / "gc-bitmap-report.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: {field: arm[field] for field in ("frameP95Ms", "gcCounts", "phases")}
                      for key, arm in arms.items()}, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
