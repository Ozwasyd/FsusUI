"""Reproduce fixture TTFs from the integrity-locked Fontsource packages.

Requires Python 3.12, fonttools==4.61.1 and brotli==1.2.0. No font editing,
merging, subsetting, instancing, renaming or weight synthesis is performed.
Usage: python derive.py /path/to/downloaded/tarballs /path/to/FsusUI
"""
import base64
import hashlib
import io
import json
import re
import sys
import tarfile
from pathlib import Path

from fontTools import __version__
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

PACKAGES = {
    "google-sans": ("5.2.1", "FteXH18YS0288Bcrjefwyyp7hLwxd8yQBEcmjU/P0BED9c8n8kxwgna3gtMtYyFQx/wIkpyrzj8RaYQyl/4quw=="),
    "noto-sans-sc": ("5.2.9", "bTUIWGBgJDpwi5qAr+x0/lcgv80IHTB9vl6s2f6EymZEa7qYV99yNRBZuKFT+SYDKVunZrjCEhWtpxqmbXWl5Q=="),
}
FONTS = {"google-sans": {"latin": "GoogleSans/Latin", "symbols": "GoogleSans/Symbols"},
         "noto-sans-sc": {"chinese-simplified": "NotoSansSC"}}
RELEASE = "728f5ac019b578b42808c3672378dad2d327fe87"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalized(tag, data):
    # The SFNT checksum depends on its container, unlike WOFF2's checksum.
    return data[:8] + bytes(4) + data[12:] if tag == "head" else data


def font(data):
    return TTFont(io.BytesIO(data), recalcTimestamp=False)


def glyph_signature(face, code):
    name = face.getBestCmap()[code]
    glyphs = face.getGlyphSet()
    pen = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(pen)
    return (pen.value, face["hmtx"][name], face["vmtx"][name])


def in_range(code, ranges):
    for token in ranges.split(','):
        limits = token.strip()[2:].split('-')
        if int(limits[0], 16) <= code <= int(limits[-1], 16):
            return True
    return False


def main():
    assert __version__ == "4.61.1", __version__
    archives, repository = map(Path, sys.argv[1:])
    target = Path(__file__).resolve().parent
    fixture = repository / "dotnet/FsusUI.Avalonia.HeadlessTests/FsusVueParityBatch3EvidenceTests.cs"
    baseline = repository / "spec/typography/baseline.json"
    chinese = sorted({ord(c) for c in fixture.read_text() + baseline.read_text()
                      if 0x3400 <= ord(c) <= 0x9fff})
    report = {"fontsourceReleaseCommit": RELEASE, "conversion": "fontTools.ttLib.TTFont; flavor=None; recalcTimestamp=False",
              "fontTools": __version__, "brotli": "1.2.0", "packages": [], "assets": [],
              "scope": "Batch3 Latin, symbols and Simplified Chinese; not the complete multilingual Web repertoire",
              "chineseCodepoints": [f"U+{c:04X}" for c in chinese], "webSubsetChecks": []}
    for package, (version, integrity) in PACKAGES.items():
        archive = (archives / f"{package}.tgz").read_bytes()
        assert base64.b64encode(hashlib.sha512(archive).digest()).decode() == integrity
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            contents = {m.name.removeprefix("package/"): tar.extractfile(m).read()
                        for m in tar.getmembers() if m.isfile()}
        source = target / "Source" / package
        source.mkdir(parents=True, exist_ok=True)
        for name in ["LICENSE", "package.json", "metadata.json", "400.css", "500.css", "700.css"]:
            (source / name).write_bytes(contents[name])
        meta = json.loads(contents["metadata.json"])
        assert json.loads(contents["package.json"])["version"] == version
        assert meta["license"]["type"] == "OFL-1.1"
        report["packages"].append({"name": f"@fontsource/{package}", "version": version,
            "fontRelease": meta["version"], "registryUrl": f"https://registry.npmjs.org/@fontsource/{package}/-/{package}-{version}.tgz",
            "integrity": "sha512-" + integrity, "archiveSha256": sha(archive),
            "licenseSha256": sha(contents["LICENSE"]),
            "officialLicense": f"https://github.com/fontsource/font-files/blob/{RELEASE}/fonts/google/{package}/LICENSE"})
        for subset, directory in FONTS[package].items():
            for weight in [400, 500, 700]:
                asset = f"files/{package}-{subset}-{weight}-normal.woff2"
                original = contents[asset]
                face = font(original)
                assert face["OS/2"].usWeightClass == weight
                assert "fvar" not in face
                tables = {tag: face.getTableData(tag) for tag in face.reader.keys()}
                destination = target / directory / f"{weight}.ttf"
                destination.parent.mkdir(parents=True, exist_ok=True)
                face.flavor = None
                face.save(destination)
                derived = font(destination.read_bytes())
                assert set(tables) == set(derived.reader.keys())
                table_hashes = {}
                for tag, data in tables.items():
                    encoded = derived.getTableData(tag)
                    assert normalized(tag, data) == normalized(tag, encoded), (asset, tag)
                    table_hashes[tag] = {"source": sha(data), "derived": sha(encoded)}
                report["assets"].append({"source": asset, "package": f"@fontsource/{package}@{version}",
                    "sourceSha256": sha(original), "derived": destination.relative_to(target).as_posix(),
                    "derivedSha256": sha(destination.read_bytes()), "weight": weight,
                    "nativeFamily": derived["name"].getDebugName(16) or derived["name"].getDebugName(1),
                    "glyphCount": derived["maxp"].numGlyphs, "cmapCount": len(derived.getBestCmap()), "tables": table_hashes})
                copyright_notice = derived["name"].getDebugName(0)
                assert copyright_notice
                notice = source / "COPYRIGHT.txt"
                if notice.exists():
                    assert notice.read_text() == copyright_notice + "\n"
                else:
                    notice.write_text(copyright_notice + "\n")
                if package == "noto-sans-sc":
                    # The full named SC asset is in the same locked package, but
                    # the demo uses numbered CSS shards. Prove fixture glyph and
                    # metric equivalence to those shards, respecting unicode-range.
                    checked = set()
                    for block in re.findall(r'@font-face\s*\{(.*?)\}', contents[f"{weight}.css"].decode(), re.S):
                        web_asset = re.search(r'url\(./(.*?\.woff2)\)', block).group(1)
                        ranges = re.search(r'unicode-range:\s*(.*?);', block).group(1)
                        codes = [c for c in chinese if in_range(c, ranges)]
                        if not codes:
                            continue
                        web = font(contents[web_asset])
                        for code in codes:
                            assert code in web.getBestCmap() and code in derived.getBestCmap()
                            assert glyph_signature(web, code) == glyph_signature(derived, code), (web_asset, code)
                            checked.add(code)
                        for tag in ["hhea", "vhea"]:
                            a, b = web[tag], derived[tag]
                            assert (a.ascent, a.descent, a.lineGap) == (b.ascent, b.descent, b.lineGap)
                        assert web["head"].unitsPerEm == derived["head"].unitsPerEm
                        assert web["OS/2"].usWeightClass == weight
                        report["webSubsetChecks"].append({"source": web_asset, "sourceSha256": sha(contents[web_asset]),
                            "weight": weight, "unicodeRange": ranges, "codepoints": [f"U+{c:04X}" for c in codes],
                            "outlinesAndHorizontalVerticalMetrics": "identical"})
                    assert checked == set(chinese), (weight, set(chinese) - checked)
    (target / "provenance.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"PASS: {len(report['assets'])} real static faces, all decoded tables preserved (head checksum normalized); "
          f"{len(chinese)} CJK codepoints verified against Web unicode-range shards at each weight")


if __name__ == "__main__":
    main()
