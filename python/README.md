# Python Worker

This folder holds the local Python worker used by the Tauri shell.

Current responsibilities:

- inspect Darktable sidecars and schema inputs
- define request and response models for metadata workflows
- compose `dt-export-meta` subprocess commands

Planned responsibilities:

- image querying from Darktable SQLite
- XMP write planning and application
- DB sync and retryable resync jobs
- export execution and job history

