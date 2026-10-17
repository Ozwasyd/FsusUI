# Validation and integration handoff

Base: `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`.
Independent branch: `fix/batch3-native-web-typography-20261009`.
The exact source, prerequisite, lock, tool, assembly and TRX hashes are in
`validation-results.json`. No supplier/font-owner test result is inherited.
No supplier branch was cherry-picked. These checks used main's original
TestAppBuilder, project references and locks, plus only the staged include
below. The source increment itself still requires its sole project owner to
integrate that include and rerun the original route.

## Results

| Check | Status | Actual evidence |
| --- | --- | --- |
| Exact archive integrity and official sources | PASS | Both complete locked SHA-512 archives; release license/metadata byte comparisons; package metadata comparison excluding packaging publishHash |
| Derivation | PASS, corrected comparison | 9 faces; untouched decoded tables identical except head checksum and 3 semantically identical Noto cmap reserializations; 45 CJK codepoints × 3 weights match Web shards' outlines and metrics; see CORRECTION.md |
| Original-project locked restore | PASS | Selected SDK 10.0.401, .NET runtime 10.0.12, unchanged matching locks and audit/signature policy |
| Original-project Release build | PASS | With and without staged resources; zero errors; one existing xUnit2013 warning in FsusMarkdownEditorPageAndHistoryHeadlessTests.cs:162 |
| Resource preflight | PASS | Exactly 13 items: 9 TTFs, 2 LICENSEs, 2 COPYRIGHT.txt notices |
| Positive selector discovery | PASS | 7 exact FQNs, exactly 11 cases, independently checked in each flag mode |
| Original native host, GSANS=0 | PASS | Exactly 11 passed, 0 failed, 0 skipped |
| Original native host, GSANS=1 | PASS | Exactly 11 passed, 0 failed, 0 skipped |
| Git whitespace and include patch applicability | PASS | `git diff --check`; `git apply --check` against unchanged base project |
| Committed project-resource integration | UNRUN | Shared csproj remains the TableV2 owner's exclusive path |
| Batch3 capture and visual acceptance | UNRUN | All 8 cases, including alert/tag/progress/breadcrumb; original capture method and RepositoryRoot helper were never invoked |
| Broad suite / platform qualification / publication | UNRUN | Outside the delegated source slice |

The glyph/layout tests explicitly choose the pinned resources in both process
flag modes. GSANS=0 additionally proves the fixture's standalone stack
selection; it does not prove installed system-family rendering on every host.
Glyph/layout success does not establish screenshot parity or visual acceptance.

The original checksum-only derivation claim was inaccurate: `getTableData()`
compiled the already-loaded source cmap before hashing it. Its original
reported PASS is retained as a historical result with that byte-preservation
claim withdrawn. `CORRECTION.md` and `correction-results.json` record the
reader-byte comparison, actual cmap differences, focused verifier regressions
and prior failed native attempts. The original native source, nine binaries,
licenses and notices are unchanged. The native results above remain the
original supplier runs; no new native/committed-candidate run is claimed for
this verifier correction, and no reviewer's pass is inherited.

Early candidate tests exposed Avalonia's normalization of Noto's literal
`Thin` family token, and empty typographic-name values for its 400/700 faces.
The final resource-scoped exact-name collection and empty-name handling fix
those failures without editing any font table. A later regression assertion
was corrected to distinguish the 500 face's legacy `... Medium` name from its
typographic family. The final results above are from the final source hashes,
not any earlier candidate's pass/fail evidence.

## Original setup and cleanup inspected

- `TestAppBuilder.cs`: assembly `AvaloniaTestApplication`; original
  `HeadlessTestApplication`; `UseSkia`; `UseHeadless` with
  `UseHeadlessDrawing=false`; unchanged conditional global GoogleSans setup.
- `TestAssembly.cs`: disables test parallelism. The selected class has no
  extra class/collection fixture or before/after hook that changes admission.
- `TextLayout` and license streams are disposed by their tests. The binding
  regression closes its Window in `finally`. The scoped collection is owned
  by the actual FontManager lifetime. No system-font installation or second
  application/test host was created.
- The capture method's eight-case MemberData, assertions, measurements,
  Directory.CreateDirectory/File.Create path and FindRepositoryRoot helper
  were inspected and explicitly excluded from the selector. No capture,
  helper repair, repository-root creation, output update or golden update
  occurred. No held route or acceptance receipt was used as a test bypass.

## Commands and resource staging

Run from `dotnet/`, with the supported `dotnet` on PATH:

```sh
dotnet --version # 10.0.401
dotnet --list-runtimes # Microsoft.NETCore.App 10.0.12
dotnet restore FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj --locked-mode
dotnet build FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj --no-restore -c Release
```

The shared project was not edited. For this increment's original-project
resource checks only, an external `ResourceInclude.targets` contained:

```xml
<Project>
  <ItemGroup Condition="'$(MSBuildProjectName)' == 'FsusUI.Avalonia.HeadlessTests'">
    <AvaloniaResource Include="Assets/VueParityTypography/**/*.ttf;Assets/VueParityTypography/Source/*/LICENSE;Assets/VueParityTypography/Source/*/COPYRIGHT.txt" />
  </ItemGroup>
</Project>
```

That import adds only the identical portable resource hunk, with no source,
reference, SDK, lock, host, signature, audit or runner override:

```sh
dotnet msbuild FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj \
  -p:CustomBeforeDirectoryBuildTargets=/path/to/ResourceInclude.targets -getItem:AvaloniaResource
dotnet build FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj --no-restore -c Release \
  -p:CustomBeforeDirectoryBuildTargets=/path/to/ResourceInclude.targets
```

`positive-fqns.txt` lists every allowed FQN; `expected-tests.txt` lists all 11
discovered case names. The exact positive filter is each FQN prefixed with
`FullyQualifiedName=` and joined by `|`. There is no substring wildcard,
negative-only selector, empty selection or all-tests fallback. For each
`FSUS_HEADLESS_GSANS=0` and `=1` process:

```sh
dotnet test FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj \
  -c Release --no-build --no-restore --list-tests --filter "$FILTER"
# Verify exact equality with expected-tests.txt and a count of 11; stop on failure.
dotnet test FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj \
  -c Release --no-build --no-restore --filter "$FILTER" \
  --logger 'trx;LogFileName=typography.trx' --results-directory /path/to/external/results
# Verify all 11 exact case names, executed=passed=11, failed=skipped=0.
```

The checks used the original Release DLL and original assembly application
host with the staged real resources. This is conditional resource-integration
evidence, not a claim that this source-only branch already embeds them in its
unmodified project. Raw local build/discovery/test outputs were kept outside
the checkout. The portable JSON records their results and hashes.

The resource owner must apply `ResourceInclude.patch` (or its exact singular
AvaloniaResource line in the owner's current ItemGroup), then the coordinator
must rerun the original project and decide the permitted visual gate route.
Root owns PR creation, review, metadata and integration. This branch creates
none of those, publishes no package, closes no issue and changes no threshold.
