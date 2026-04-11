# Architecture Decision

## Recommended stack

Recommended UI stack: `Tauri + React + TypeScript`

Recommended metadata engine: `Python worker/service`

Recommended export integration: `dt-export-meta` invoked as a subprocess CLI

## Why this stack

This application has two competing needs:

- a polished dark creative-tool interface with a thumbnail-heavy workflow
- reliable local filesystem, SQLite, XMP, and subprocess integration

`Tauri + React` is the best fit for the interface goal. It gives us more visual freedom than a widget-based desktop UI and keeps the desktop shell lighter than Electron.

Python remains the best fit for the metadata engine because:

- `dt-export-meta` already exists in Python
- SQLite and XML/XMP manipulation are already proven in the current repo
- Darktable-specific logic will be easier to share and test in one Python codebase

## Process model

The app should be split into two layers:

1. Tauri desktop shell and web UI
2. Python worker process for Darktable access, XMP editing, previews, validation, and export orchestration

The Tauri layer should treat the Python worker as an internal local service boundary. The UI sends structured commands and receives structured results and error objects.

## Why not PySide6 first

PySide6 would be the fastest path to a functional desktop app, but the user experience target here is a modern dark creative-tool UI with strong visual affordances and a thumbnail-centric workflow. That is possible in Qt, but more design effort would go into styling and custom widget behavior.

If delivery speed becomes more important than visual ambition, PySide6 remains a valid fallback.

## Why not Electron first

Electron would also support the desired UI, but compared with Tauri it brings a heavier runtime and larger distribution size without giving this project a decisive advantage.

## Darktable concurrency recommendation

Recommended v1 position: support read-only browsing while Darktable is open, but require Darktable to be closed before writes.

Reasoning:

- SQLite lock behavior can vary depending on what Darktable is doing
- writing both XMP and database metadata while Darktable is active increases the chance of partial sync, stale reads, and user confusion
- a read-only browsing mode still keeps the app useful for search, selection, preview, and export preparation

V1 behavior should therefore be:

- allow connecting and browsing when the database is readable
- before any metadata write or tag-tree mutation, perform a write-readiness check
- if the DB appears locked or Darktable is likely active, block the save and show clear recovery guidance

Future versions can loosen this if real-world testing shows Darktable-open writes are safe enough.

## Write pipeline

Metadata save order:

1. Build a preview of the exact proposed changes
2. Confirm with the user
3. Write XMP changes first
4. Sync the same changes into Darktable `library.db` and `data.db`
5. Record the result in the app job/history store

If XMP succeeds but DB sync fails:

- surface a partial-failure state clearly
- persist a retryable DB-sync job
- offer a later `Retry DB Sync` action

This keeps sidecars as the primary metadata layer while still maintaining Darktable compatibility.

## Local data owned by the app

The app should maintain its own local store for:

- connection settings for the currently active Darktable library
- cached thumbnail and query state if useful
- write history and failure logs
- pending DB resync jobs
- saved export presets
- UI preferences

Darktable remains the source of truth for image inventory and current metadata. The app store exists to support workflow, resilience, and recovery.
