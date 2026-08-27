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
