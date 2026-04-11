# V1 Spec

## Product goal

Build a cross-platform desktop application for managing Darktable image metadata more comfortably than the Darktable UI, while preserving compatibility with Darktable databases and sidecar XMP files.

The app should provide a modern dark creative-tool experience focused on search, selection, batch editing, tag management, and export.

## Confirmed decisions

- Cross-platform target: Windows, macOS, and Linux
- Preferred desktop shell: Tauri
- Preferred UI stack: React + TypeScript
- Metadata and Darktable integration engine: Python
- Export engine: existing `dt-export-meta` CLI invoked as a subprocess
- Primary image selection model: searchable in-app grid populated from Darktable
- V1 metadata editing includes:
  - tags
  - hierarchical tags
  - rating
  - color labels
  - title
  - description
- Batch tag actions support:
  - add
  - remove
  - replace
- Hierarchical tag management supports:
  - create
  - rename
  - move
- Save flow requires a preview/confirm step
- Only one Darktable library is active at a time
- Exports support:
  - current filtered selection
  - saved presets
- Thumbnail display is in scope for v1
- Locked database handling in v1 should show clear recovery guidance
- Save order is XMP first, then database sync
- If DB sync fails after XMP succeeds, the app should support retrying DB sync later
- Visual direction: dark creative-tool style

## V1 workflows

### 1. Connect to Darktable

The user selects:

- `library.db`
- optional `data.db`
- optional Darktable executable paths if needed later

The app validates:

- file existence
- readable schema
- expected Darktable tables
- whether tag data is in `library.db` or `data.db`

### 2. Browse and search images

The main workspace shows a thumbnail grid driven by Darktable records.

V1 filters:

- tags
- rating
- color label
- filename
- folder
- text search
- date

The user can select one or many images from the grid and inspect current metadata in a side panel.

### 3. Batch edit metadata

The editor must support mixed selections gracefully.

For batch edits:

- unchanged fields remain untouched unless explicitly set by the user
- tags can be added, removed, or fully replaced
- title, description, rating, and color label must support explicit set and leave-unchanged modes

### 4. Manage tags

The app should expose both a searchable tag list and a hierarchical tag tree.

V1 tag operations:

- create tag
- create child tag
- rename tag
- move tag within hierarchy
- assign tags to selected images
- remove tags from selected images

The write-preview step should show the exact tag mutations before they are applied.

### 5. Save metadata

Before save, the app presents a preview that includes:

- selected image count
- which tags will be added, removed, or replaced
- rating changes
- color label changes
- title and description changes
- any tag-tree changes if relevant

Save sequence:

1. Update XMP sidecars
2. Sync Darktable database records
3. Mark success or partial failure in app history

If sidecar write fails:

- do not attempt DB sync
- show the failure clearly

If sidecar write succeeds and DB sync fails:

- show a partial-failure state
- keep a retryable DB-sync record

### 6. Export images

Exports can be run from:

- the current filtered selection
- a saved export preset

The app delegates export execution to `dt-export-meta` via subprocess.

V1 export options should include at least:

- output folder
- image type
- width
- height
- skip-export behavior if supported by the current CLI
- filters derived from the active selection or preset

### 7. Write JSON metadata beside exports

Each exported image should have a sibling JSON file.

Required JSON fields:

- title
- description
- creator
- rights
- notes
- tags

The existing `dt-export-meta` output already includes title, description, and hierarchical subjects. Creator, rights, flat tags, rating, color labels, and notes are now grounded by real Darktable sidecar samples.

## XMP mapping notes

Current confirmed mappings:

- `dc:title`
- `dc:description`
- `dc:creator`
- `dc:rights`
- `dc:subject`
- `lr:hierarchicalSubject`
- `xmp:Rating` attribute on `rdf:Description`
- `darktable:colorlabels`
- `exif:DateTimeOriginal`
- `acdsee:notes` attribute on `rdf:Description`

Still to verify against additional real Darktable sidecars:

- whether creator and rights are consistently present across the library
- whether color labels ever contain multiple values in normal workflow

## Data model

### Darktable-backed entities

- image
- tag
- hierarchical tag relationship
- image metadata fields

### App-owned entities

- app settings
- saved export presets
- operation history
- pending DB resync jobs
- cached connection diagnostics

## Service boundaries

### Tauri / UI responsibilities

- navigation and layout
- thumbnail grid and selection UX
- filter controls
- write preview dialogs
- job and error presentation
- saved preset management

### Python worker responsibilities

- Darktable schema inspection
- image queries and filtering
- XMP parsing and writing
- tag tree mutation planning
- database sync execution
- lock detection and friendly diagnostics
- `dt-export-meta` subprocess invocation
- JSON metadata preparation

## Error handling

### Locked database

When writes cannot proceed because the database is locked or Darktable appears active:

- block the write
- explain the probable cause
- instruct the user to close Darktable and retry
- preserve the pending change set until the user dismisses or retries

### Partial sync

If XMP write succeeds and DB sync fails:

- mark the result as `partial_sync_failed`
- show which images were updated in XMP
- store a retryable DB-sync job
- allow a later retry once the lock or DB issue is resolved

### Missing sidecar

If an image has no sidecar, v1 needs an explicit policy. Recommended policy:

- offer to create a new sidecar when saving metadata
- clearly mark which images will get new XMP files in the preview

## Open questions

- Should title and description batch editing support append/replace modes, or replace only?
- Should date filtering in v1 cover capture date, import date, or both?
- Should the tag tree UI allow drag-and-drop reparenting in v1, or use explicit move actions first?
- What thumbnail generation strategy should be used for RAW-heavy libraries if Darktable preview access is inconsistent?

## Recommended implementation order

1. Write a small Python metadata core for read/query/write planning
2. Add Darktable schema diagnostics and image query endpoints
3. Add XMP parsing and writing for confirmed fields
4. Add DB sync and retryable partial-failure handling
5. Scaffold the Tauri + React shell and dark visual system
6. Build the thumbnail grid and filter UX
7. Build batch editing and write preview
8. Integrate `dt-export-meta` subprocess exports
9. Add saved export presets and operation history
