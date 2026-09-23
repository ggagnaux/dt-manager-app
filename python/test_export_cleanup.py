import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from dt_manager_worker import export_adapter as export


class ExportCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.destination = self.root / "exports"
        self.destination.mkdir()
        self.source = self.root / "original.jpg"
        self.source.write_bytes(b"original")
        self.existing = self.destination / "old.jpg"
        self.existing.write_bytes(b"old export")
        self.request = export.ExportRequest("library.db", "", str(self.destination), [], source_paths=[str(self.source)])
        self.run = self.enterContext(patch.object(export.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="", stderr="")))
        self.enterContext(patch.object(export, "_exporter_root", return_value=self.root / "tool"))
        (self.root / "tool").mkdir()
        self.enterContext(patch.object(export, "_workspace_export_command", return_value=(["export"], None)))

    def test_nonempty_requires_confirmation_without_deleting_or_exporting(self):
        response = export.run_export(self.request)
        self.assertTrue(response["confirmationRequired"])
        self.assertEqual(response["existingFileCount"], 1)
        self.assertTrue(self.existing.exists())
        self.run.assert_not_called()

    def test_approved_or_automatic_cleanup_happens_before_export(self):
        nested = self.destination / "subfolder"
        nested.mkdir()
        (nested / "keep.jpg").write_bytes(b"keep")
        self.request.clear_folder_before_export = True
        def run(*args, **kwargs):
            self.assertFalse(self.existing.exists())
            self.assertTrue(self.source.exists())
            self.assertTrue((nested / "keep.jpg").exists())
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        self.run.side_effect = run
        self.assertTrue(export.run_export(self.request)["success"])
        self.run.assert_called_once()

    def test_empty_folder_exports_without_confirmation(self):
        self.existing.unlink()
        self.assertTrue(export.run_export(self.request)["success"])
        self.run.assert_called_once()

    def test_metadata_only_does_not_clear(self):
        self.request.skip_export = True
        self.request.clear_folder_before_export = True
        self.assertTrue(export.run_export(self.request)["success"])
        self.assertTrue(self.existing.exists())

    def test_source_folder_is_never_cleared(self):
        self.request.output_path = str(self.root)
        self.request.clear_folder_before_export = True
        with self.assertRaisesRegex(ValueError, "source images"):
            export.run_export(self.request)
        self.assertTrue(self.source.exists())
        self.run.assert_not_called()

    def test_missing_source_prevents_deletion(self):
        self.source.unlink()
        self.request.clear_folder_before_export = True
        with self.assertRaisesRegex(ValueError, "unavailable"):
            export.run_export(self.request)
        self.assertTrue(self.existing.exists())
        self.run.assert_not_called()

    def test_deletion_failure_aborts_export(self):
        self.request.clear_folder_before_export = True
        with patch.object(Path, "unlink", side_effect=PermissionError("File locked")):
            with self.assertRaises(PermissionError):
                export.run_export(self.request)
        self.run.assert_not_called()

    def test_root_folder_is_rejected(self):
        self.request.output_path = self.root.anchor
        with self.assertRaisesRegex(ValueError, "dedicated export folder"):
            export.run_export(self.request)
        self.run.assert_not_called()

    def test_runtime_manifest_folder_is_rejected(self):
        self.request.output_path = str(Path.cwd() / "runtime")
        self.request.clear_folder_before_export = True
        with self.assertRaisesRegex(ValueError, "dedicated export folder"):
            export.run_export(self.request)
        self.run.assert_not_called()

    def test_database_folder_is_rejected(self):
        self.request.db_path = str(self.destination / "library.db")
        with self.assertRaisesRegex(ValueError, "database"):
            export.run_export(self.request)
        self.assertTrue(self.existing.exists())


if __name__ == "__main__":
    unittest.main()
