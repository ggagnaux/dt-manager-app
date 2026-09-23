import sqlite3
import gc
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from dt_manager_worker.darktable_service import _build_image_payload
from dt_manager_worker.models import MetadataEdit
from dt_manager_worker.tags import resolve_xmp_tags
from dt_manager_worker.write_executor import apply_metadata_edits
from dt_manager_worker.write_planner import build_write_preview
from dt_manager_worker.xmp_inspector import inspect_xmp_fields
from dt_manager_worker.xmp_writer import apply_edit_to_xmp


class AtomicTagsTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.addCleanup(gc.collect)
        self.root = Path(temporary.name)
        self.source = self.root / "photo.jpg"
        self.source.write_bytes(b"image")
        self.xmp = self.root / "photo.jpg.xmp"
        self.db = self.root / "library.db"
        with sqlite3.connect(self.db) as connection:
            connection.executescript("CREATE TABLE images(id INTEGER PRIMARY KEY, flags INTEGER);"
                                     "INSERT INTO images VALUES(1, 0);"
                                     "CREATE TABLE tags(id INTEGER PRIMARY KEY, name TEXT);"
                                     "CREATE TABLE tagged_images(imgid INTEGER, tagid INTEGER);")
        self.row = {"image_id": 1, "filename": "photo.jpg", "folder": str(self.root), "rating": 0}

    def assigned(self):
        with sqlite3.connect(self.db) as connection:
            return [row[0] for row in connection.execute(
                "SELECT name FROM tags JOIN tagged_images ON tags.id = tagid WHERE imgid=1")]

    def load(self):
        return _build_image_payload(self.row, self.source, self.xmp if self.xmp.exists() else None,
                                    inspect_xmp_fields(self.xmp) if self.xmp.exists() else {}, self.assigned())

    def save(self, edit):
        with patch("dt_manager_worker.write_executor.load_images_by_ids", return_value=[self.load()]):
            result = apply_metadata_edits(self.db, None, [1], edit)
        self.assertEqual(result["dbSyncStatus"], "synced")

    def assert_tags(self, expected):
        data = inspect_xmp_fields(self.xmp)
        self.assertEqual({tag.casefold() for tag in data["flatSubjects"]}, {tag.casefold() for tag in expected})
        self.assertEqual({tag.casefold() for tag in data["hierarchicalSubjects"]}, {tag.casefold() for tag in expected})
        self.assertEqual({tag.casefold() for tag in self.assigned()}, {tag.casefold() for tag in expected})
        self.assertEqual({tag.casefold() for tag in self.load()["tags"]}, {tag.casefold() for tag in expected})

    def test_repeated_inspector_save_and_metadata_only_save_keep_atomic_values(self):
        expected = ["palette|blue", "location|Canada|Vancouver", "Portfolio"]
        self.save(MetadataEdit(mode="replace", tags=expected))
        self.assert_tags(expected)
        image = self.load()
        draft = list(set(image["tags"] + image["hierarchicalTags"]))
        self.save(MetadataEdit(mode="replace", tags=draft, title="New title"))
        self.assert_tags(expected)
        self.save(MetadataEdit(mode="add", title="Title only"))
        self.assert_tags(expected)
        with sqlite3.connect(self.db) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM tags").fetchone()[0], 3)

    def test_add_remove_replace_and_preview_match_whole_tags(self):
        self.save(MetadataEdit(mode="replace", tags=["palette|blue", "blue", "Portfolio"]))
        self.save(MetadataEdit(mode="add", tags=["palette|red"]))
        edit = MetadataEdit(mode="remove", tags=["palette|blue"])
        with patch("dt_manager_worker.write_planner.load_images_by_ids", return_value=[self.load()]):
            plan = build_write_preview(self.db, None, [1], edit)
        self.assertEqual(plan["imagePlans"][0]["removedTags"], ["palette|blue"])
        self.save(edit)
        self.assert_tags(["blue", "Portfolio", "palette|red"])
        self.save(MetadataEdit(mode="replace", tags=["series|Orbs"]))
        self.assert_tags(["series|Orbs"])
        self.save(MetadataEdit(mode="remove", tags=["series|Orbs"]))
        self.assert_tags([])

    def test_empty_replacement_removes_final_tag_in_preview_xmp_and_database(self):
        self.save(MetadataEdit(mode="replace", tags=["palette|blue"]))
        edit = MetadataEdit(mode="replace", tags=[])
        with patch("dt_manager_worker.write_planner.load_images_by_ids", return_value=[self.load()]):
            plan = build_write_preview(self.db, None, [1], edit)
        self.assertEqual(plan["imagePlans"][0]["removedTags"], ["palette|blue"])
        self.save(edit)
        self.assert_tags([])

    def test_legacy_flattened_copies_do_not_enter_inspector_draft(self):
        image = _build_image_payload(self.row, self.source, self.xmp,
            {"flatSubjects": ["palette", "blue", "Portfolio"], "hierarchicalSubjects": ["palette|blue"]},
            ["palette|blue", "Portfolio"])
        self.assertEqual(set(image["tags"]), {"palette|blue", "Portfolio"})
        apply_edit_to_xmp(self.source, self.xmp, image, MetadataEdit(mode="replace", tags=image["tags"]))
        data = inspect_xmp_fields(self.xmp)
        self.assertEqual(set(data["flatSubjects"]), {"palette|blue", "Portfolio"})

    def test_explicit_standalone_tags_are_preserved(self):
        for hierarchy, assigned in [(["palette|blue", "blue"], []), (["palette|blue"], ["blue"])]:
            with self.subTest(hierarchy=hierarchy):
                self.assertEqual(set(resolve_xmp_tags(["palette", "blue", "Portfolio"], hierarchy, assigned)),
                                 {"palette|blue", "blue", "Portfolio"})
        self.assertEqual(resolve_xmp_tags(["palette|blue", "blue"], [], []), ["blue", "palette|blue"])

    def test_flat_only_tags_survive_add_and_metadata_only_edits(self):
        for edit in [MetadataEdit(mode="add", title="Title"), MetadataEdit(mode="add", tags=["palette|red"])]:
            with self.subTest(edit=edit):
                apply_edit_to_xmp(self.source, self.xmp, {"tags": ["palette|blue", "Portfolio"]}, edit)
                expected = {"palette|blue", "Portfolio", *edit.tags}
                data = inspect_xmp_fields(self.xmp)
                self.assertEqual(set(data["flatSubjects"]), expected)
                self.assertEqual(set(data["hierarchicalSubjects"]), expected)

    def test_duplicate_full_tags_are_reused_and_preview_ignores_case(self):
        self.save(MetadataEdit(mode="replace", tags=["palette|blue"]))
        edit = MetadataEdit(mode="add", tags=["PALETTE|BLUE", "palette|blue"])
        with patch("dt_manager_worker.write_planner.load_images_by_ids", return_value=[self.load()]):
            plan = build_write_preview(self.db, None, [1], edit)
        self.assertEqual(plan["changes"]["tagsAdded"], 0)
        self.assertEqual(plan["changes"]["tagsRemoved"], 0)
        self.save(edit)
        self.assert_tags(["palette|blue"])


if __name__ == "__main__":
    unittest.main()
