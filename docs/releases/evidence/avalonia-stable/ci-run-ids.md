# CI run ids

| Workflow | Run id | Commit | Status at bundle creation | Artifact role |
| --- | --- | --- | --- | --- |
| Quality Gates | `28569496683` | `d10d5e8c2913a846f96ba93d4b4361416514a288` | In progress on 2026-07-02 | Source for `avalonia-stable-evidence`, `avalonia-generated-artifacts`, NuGet packages, screenshots, and unit artifacts after completion. |
| Quality Gates | `28569084274` | `e50d61eed406d00f2033da9d17a55c8e4e76226c` | Completed failure on 2026-07-02 | Superseded by the stable NuGet package gate commit. |

Final publish must use a completed successful Quality Gates run for the commit
that contains this bundle. The regeneration instructions deliberately reference
artifact names instead of local paths so CI evidence can replace local output.
