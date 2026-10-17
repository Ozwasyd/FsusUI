"""Focused regression against the actual locked archives and committed TTFs.

Usage: python test_derive.py /path/to/tarballs
No font files are edited and no application/test host is created.
"""
import base64
import io
import json
import sys
import tarfile
import unittest
from pathlib import Path

import derive


ARCHIVES = Path(sys.argv.pop(1))
ROOT = Path(__file__).resolve().parent
SOURCE_CMAP_SHA = "e45bc35798d276268a8973d8fb052731c7366e9cc1ee50e6831b746e9199ab59"
DERIVED_CMAP_SHA = "cc91e8176e45bda7a35500e532f4342fb758da90b5a03fa29e8c33d8fd111218"


class DerivationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packages = {}
        for package, (_, integrity) in derive.PACKAGES.items():
            data = (ARCHIVES / f"{package}.tgz").read_bytes()
            assert base64.b64encode(derive.hashlib.sha512(data).digest()).decode() == integrity
            with tarfile.open(fileobj=io.BytesIO(data)) as archive:
                cls.packages[package] = {
                    m.name.removeprefix("package/"): archive.extractfile(m).read()
                    for m in archive.getmembers() if m.isfile()
                }

    def noto(self, weight=400):
        original = self.packages["noto-sans-sc"][f"files/noto-sans-sc-chinese-simplified-{weight}-normal.woff2"]
        derived = (ROOT / "NotoSansSC" / f"{weight}.ttf").read_bytes()
        return original, derived

    def test_snapshot_catches_old_false_source_equality(self):
        for weight in [400, 500, 700]:
            with self.subTest(weight=weight):
                original, converted = self.noto(weight)
                face = derive.font(original)
                snapshot = derive.snapshot_tables(face)
                actual_source = snapshot["cmap"]
                actual_derived = derive.snapshot_tables(derive.font(converted))["cmap"]
                self.assertEqual((len(actual_source), derive.sha(actual_source)), (33328, SOURCE_CMAP_SHA))
                self.assertEqual((len(actual_derived), derive.sha(actual_derived)), (33336, DERIVED_CMAP_SHA))
                self.assertNotEqual(actual_source, actual_derived)
                # Reproduce the original faulty loop, including compilation's
                # OS/2 -> cmap dependency. It wrongly reports derived as source.
                face["OS/2"].usWeightClass
                misleading = {tag: face.getTableData(tag) for tag in face.reader.keys()}
                self.assertEqual(misleading["cmap"], actual_derived)
                self.assertNotEqual(misleading["cmap"], actual_source)
                self.assertEqual(derive.snapshot_tables(face)["cmap"], actual_source)

    def test_nine_provenance_entries_match_independent_container_bytes(self):
        report = json.loads((ROOT / "provenance.json").read_text())
        self.assertEqual(len(report["assets"]), 9)
        changes = []
        for asset in report["assets"]:
            with self.subTest(asset=asset["derived"]):
                package = asset["package"].split('/')[1].split('@')[0]
                original = self.packages[package][asset["source"]]
                converted = (ROOT / asset["derived"]).read_bytes()
                source_tables = derive.snapshot_tables(derive.font(original))
                derived_tables = derive.snapshot_tables(derive.font(converted))
                self.assertEqual(derive.sha(original), asset["sourceSha256"])
                self.assertEqual(derive.sha(converted), asset["derivedSha256"])
                for tag, data in source_tables.items():
                    self.assertEqual(derive.sha(data), asset["tables"][tag]["source"])
                    self.assertEqual(derive.sha(derived_tables[tag]), asset["tables"][tag]["derived"])
                    if data != derived_tables[tag]:
                        changes.append((asset["derived"], tag))
                self.assertEqual(derive.compare_tables(source_tables, derived_tables, original, converted), asset["tables"])
        self.assertEqual(sum(tag == "head" for _, tag in changes), 9)
        self.assertEqual([path for path, tag in changes if tag == "cmap"],
                         [f"NotoSansSC/{weight}.ttf" for weight in [400, 500, 700]])
        self.assertTrue(all(tag in {"head", "cmap"} for _, tag in changes))

    def test_non_best_character_map_mutation_is_rejected(self):
        original, converted = self.noto()
        source, derived = derive.font(original), derive.font(converted)
        best = dict(derived.getBestCmap())
        table = derived["cmap"].tables[0]
        # FontTools shares dictionaries for subtables with the same offset.
        # Detach this one so only the non-preferred platform map is altered.
        table.cmap = dict(table.cmap)
        self.assertIsNot(table.cmap, derived.getBestCmap())
        table.cmap[ord('A')] = table.cmap[ord('B')]
        self.assertEqual(derived.getBestCmap(), best)
        with self.assertRaisesRegex(AssertionError, "character maps"):
            derive.compare_cmaps(source, derived)

    def test_variation_selector_mutation_is_rejected(self):
        original, converted = self.noto()
        source, derived = derive.font(original), derive.font(converted)
        table = next(t for t in derived["cmap"].tables if t.format == 14)
        selector = next(iter(table.uvsDict))
        self.assertTrue(table.uvsDict[selector])
        table.uvsDict[selector].pop()
        with self.assertRaisesRegex(AssertionError, "variation selectors"):
            derive.compare_cmaps(source, derived)

    def test_subtable_metadata_mutation_is_rejected(self):
        original, converted = self.noto()
        source, derived = derive.font(original), derive.font(converted)
        derived["cmap"].tables[0].language += 1
        with self.assertRaisesRegex(AssertionError, "subtable metadata"):
            derive.compare_cmaps(source, derived)

    def test_unrelated_table_change_is_rejected(self):
        original, converted = self.noto()
        source_tables = derive.snapshot_tables(derive.font(original))
        derived_tables = derive.snapshot_tables(derive.font(converted))
        derived_tables["hmtx"] = bytes([derived_tables["hmtx"][0] ^ 1]) + derived_tables["hmtx"][1:]
        with self.assertRaisesRegex(AssertionError, "table bytes changed"):
            derive.compare_tables(source_tables, derived_tables, original, converted)


if __name__ == "__main__":
    unittest.main()
