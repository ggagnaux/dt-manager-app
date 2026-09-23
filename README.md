# dt-manager-app

Cross-platform desktop manager for Darktable metadata and exports.

This app is intended to:

- browse images from a Darktable library in a searchable thumbnail grid
- edit tags, hierarchical tags, ratings, color labels, title, and description
- write metadata to XMP sidecars first, then sync Darktable databases
- export filtered images through `dt-export-meta`
- produce per-image JSON beside exported files

The initial product and architecture decisions live in [`docs/architecture.md`](E:/Sync/Projects/Darktable-Utilities/dt-manager-app/docs/architecture.md) and [`docs/v1-spec.md`](E:/Sync/Projects/Darktable-Utilities/dt-manager-app/docs/v1-spec.md).

## Run locally

From [`dt-manager-app`](E:/Sync/Projects/Darktable-Utilities/dt-manager-app), start the desktop app with:

```powershell
#npm run tauri dev
run.bat
```


## AI image descriptions

In the desktop app, open **Settings > AI Description**. Set the full HTTPS Chat
Completions endpoint (OpenAI default: `https://api.openai.com/v1/chat/completions`),
a vision-capable model ID available from your provider, API key, and description
instructions, then choose **Save AI Settings**. No model is selected automatically.

Select a JPEG, PNG, or WebP image (maximum 20 MB), open **Inspector > Edit**, and
choose **Generate Description > Ok**. The selected file and instructions are sent
to the configured service; provider usage charges may apply. Cancel sends nothing.
Review the returned draft and choose **Save Changes** to write metadata. Changing
the selection or editing the description while a request is running prevents the
response from replacing the current draft. RAW and other image formats must first
be exported to a supported format. Requests time out after 90 seconds.

AI configuration is stored in `%LOCALAPPDATA%/DT Manager/ai-settings.json`, outside
the repository. The key is encrypted using Windows DPAPI for the current Windows
account, never returned to the frontend, and passed to the worker via stdin when
saved (not process arguments). Key storage currently requires Windows. Leave the
key field blank to retain it; use **Remove stored key on save** to clear it. Changing
the endpoint requires re-entering or clearing the key. HTTPS redirects are rejected.

The request format follows the [OpenAI image input documentation](https://developers.openai.com/api/docs/guides/images-vision).
Compatible providers must accept Chat Completions image data URLs and
`max_completion_tokens`.

Regression checks:

```text
python -m unittest discover -s python -p test_ai_service.py -v
node --test tests/ai-description.test.cjs
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Run Cargo in a Visual Studio developer shell on Windows. Tests use fake credentials
and mocked HTTP responses; they do not upload images or call a paid provider.


## Clear export destination

**Clear folder before export** is available under Settings > Export Tooling,
Export Presets, and Inspector > Export. It defaults to off and is saved with
export settings and presets. When enabled, a normal image export deletes existing
files directly inside the destination folder before starting. When disabled, a
nonempty folder prompts with **Ok / Cancel**: Ok clears those files for this run;
Cancel aborts without deleting or exporting. Subfolders and their contents are
preserved. Metadata-only runs do not clear files. The app rejects destinations
containing the selected source images or Darktable databases, drive roots, and
home/application folders. A deletion error aborts export; files already deleted
before that error cannot be restored by the app.

Checks: `python -m unittest discover -s python -p test_export_cleanup.py -v`
and `node --test tests/export-cleanup.test.cjs`.
