import base64
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError

from dt_manager_worker import ai_service as ai


class AiServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path_patch = patch.object(ai, "settings_path", return_value=self.root / "settings.json")
        self.path_patch.start()
        self.addCleanup(self.path_patch.stop)
        self.image = self.root / "image.png"
        self.image.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9sAAAAASUVORK5CYII="))

    def settings(self, **changes):
        return {**ai.DEFAULTS, "model": "test-vision-model", "apiKey": "test-secret", **changes}

    def mock_config(self):
        config = {**ai.DEFAULTS, "model": "test-vision-model", "encryptedKey": "YWJj"}
        return patch.object(ai, "_read_settings", return_value=config)

    def test_immediate_tags_setting_defaults_and_persists_as_boolean(self):
        self.assertIs(ai.load_settings()["applyAiGeneratedTagsImmediately"], False)
        legacy = {key: value for key, value in ai.DEFAULTS.items() if key != "applyAiGeneratedTagsImmediately"}
        ai.settings_path().write_text(json.dumps(legacy), encoding="utf-8")
        self.assertIs(ai.load_settings()["applyAiGeneratedTagsImmediately"], False)
        for value in [True, False]:
            saved = ai.save_settings(self.settings(apiKey="", applyAiGeneratedTagsImmediately=value))
            self.assertIs(saved["applyAiGeneratedTagsImmediately"], value)
            self.assertIs(ai.load_settings()["applyAiGeneratedTagsImmediately"], value)
            self.assertIs(json.loads(ai.settings_path().read_text())["applyAiGeneratedTagsImmediately"], value)
        with self.assertRaisesRegex(ValueError, "boolean"):
            ai.save_settings(self.settings(apiKey="", applyAiGeneratedTagsImmediately="false"))

    def test_defaults_have_no_secret(self):
        self.assertFalse(ai.load_settings()["hasApiKey"])
        self.assertNotIn("apiKey", ai.load_settings())

    @unittest.skipUnless(os.name == "nt", "Windows DPAPI")
    def test_key_encryption_roundtrip_keep_remove_and_endpoint_change(self):
        result = ai.save_settings(self.settings())
        self.assertTrue(result["hasApiKey"])
        saved = json.loads(ai.settings_path().read_text())
        self.assertNotIn("test-secret", ai.settings_path().read_text())
        self.assertNotIn("encryptedKey", result)
        self.assertEqual(ai._crypt(base64.b64decode(saved["encryptedKey"]), True), b"test-secret")
        kept = ai.save_settings(self.settings(apiKey="", model="other-model"))
        self.assertTrue(kept["hasApiKey"])
        with self.assertRaisesRegex(ValueError, "Re-enter"):
            ai.save_settings(self.settings(apiKey="", endpoint="https://other.example/v1/chat/completions"))
        removed = ai.save_settings(self.settings(apiKey="", clearApiKey=True))
        self.assertFalse(removed["hasApiKey"])

    def test_endpoint_validation(self):
        for endpoint in ["http://example.com", "https://user:secret@example.com", "https://example.com?key=secret", "https://example.com/#key"]:
            with self.assertRaises(ValueError):
                ai.validate_endpoint(endpoint)

    def test_image_validation(self):
        self.assertTrue(ai.image_data_url(str(self.image)).startswith("data:image/png;base64,"))
        with self.assertRaisesRegex(ValueError, "unavailable"):
            ai.image_data_url(str(self.root / "missing.jpg"))
        raw = self.root / "photo.cr3"
        raw.write_bytes(b"RAW")
        with self.assertRaisesRegex(ValueError, "Export RAW"):
            ai.image_data_url(str(raw))
        self.image.write_bytes(b"not an image")
        with self.assertRaisesRegex(ValueError, "not a supported"):
            ai.image_data_url(str(self.image))
        with patch.object(ai, "MAX_IMAGE_BYTES", 2):
            with self.assertRaisesRegex(ValueError, "20 MB"):
                ai.image_data_url(str(self.image))

    def test_generate_request_and_response(self):
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value = io.BytesIO(json.dumps({"choices": [{"message": {"content": "  A blue landscape. "}, "finish_reason": "stop"}]}).encode())
        with self.mock_config(), patch.object(ai, "_crypt", return_value=b"secret"), patch.object(ai, "build_opener", return_value=opener):
            result = ai.generate_description(str(self.image))
        self.assertEqual(result["description"], "A blue landscape.")
        request = opener.open.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.get_header("Authorization"), "Bearer secret")
        self.assertEqual(body["model"], "test-vision-model")
        self.assertTrue(body["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,"))
        self.assertNotIn(str(self.image), request.data.decode())
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 90)

    def test_errors_do_not_echo_provider_secrets(self):
        for failure, expected in [(HTTPError("https://example.com", 401, "secret", {}, None), "Authentication"), (HTTPError("https://example.com", 429, "secret", {}, None), "quota"), (URLError("secret"), "Unable to reach"), (TimeoutError("secret"), "timed out")]:
            opener = MagicMock()
            opener.open.side_effect = failure
            with self.mock_config(), patch.object(ai, "_crypt", return_value=b"secret"), patch.object(ai, "build_opener", return_value=opener):
                with self.assertRaisesRegex(ValueError, expected) as error:
                    ai.generate_description(str(self.image))
                self.assertNotIn("secret", str(error.exception))

    def test_missing_config_and_malformed_response(self):
        with self.assertRaisesRegex(ValueError, "Configure"):
            ai.generate_description(str(self.image))
        for response in [b"not-json", b'{"choices": []}', b'{"choices": [{"message": {"content": null}}]}']:
            opener = MagicMock()
            opener.open.return_value.__enter__.return_value = io.BytesIO(response)
            with self.mock_config(), patch.object(ai, "_crypt", return_value=b"secret"), patch.object(ai, "build_opener", return_value=opener):
                with self.assertRaises(ValueError):
                    ai.generate_description(str(self.image))

    def test_palette_generation_uses_separate_instructions_and_image(self):
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value = io.BytesIO(json.dumps({"choices": [{"message": {"content": '{"colors":[" Blue ","cream","blue"]}'}, "finish_reason": "stop"}]}).encode())
        with self.mock_config(), patch.object(ai, "_crypt", return_value=b"secret"), patch.object(ai, "build_opener", return_value=opener):
            self.assertEqual(ai.generate_tags(str(self.image)), {"tags": ["palette|blue", "palette|cream"]})
        body = json.loads(opener.open.call_args.args[0].data)
        self.assertEqual(body["messages"][0]["content"][0]["text"], ai.PALETTE_PROMPT)
        self.assertTrue(body["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,"))

    def test_palette_rejects_malformed_or_unexpected_colors(self):
        for content in ['not-json', '[]', '{"colors":"blue"}', '{"colors":[null]}', '{"colors":["blue|other"]}', '{"colors":["landscape"]}', json.dumps({"colors": ["blue"] * 9})]:
            with self.subTest(content=content), patch.object(ai, "_generate_text", return_value=content):
                with self.assertRaises(ValueError):
                    ai.generate_tags(str(self.image))
        with patch.object(ai, "_generate_text", return_value='{"colors":[]}'):
            self.assertEqual(ai.generate_tags(str(self.image)), {"tags": []})

    def test_existing_palette_tag_is_reused_on_repeated_saves(self):
        import sqlite3
        from dt_manager_worker.db_sync import _ensure_tag
        with sqlite3.connect(":memory:") as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)")
            connection.execute("INSERT INTO tags (name) VALUES ('palette|Blue')")
            self.assertEqual(_ensure_tag(connection, "tags", "palette|blue"), 1)
            second = _ensure_tag(connection, "tags", "palette|cream")
            self.assertEqual(_ensure_tag(connection, "tags", "palette|cream"), second)
            self.assertEqual(connection.execute("SELECT count(*) FROM tags").fetchone()[0], 2)

    def test_redirect_is_not_followed(self):
        self.assertIsNone(ai.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.example"))


if __name__ == "__main__":
    unittest.main()
