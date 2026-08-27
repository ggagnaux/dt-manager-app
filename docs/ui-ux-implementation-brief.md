# DT Manager UI/UX Refactor Implementation Brief

This brief translates the UI/UX refactor plan into concrete implementation work against the current DT Manager codebase.

Current codebase context:
- Frontend shell: `src/App.tsx`
- Frontend API boundary: `src/api.ts`
- Frontend shared types: `src/types.ts`
- Styling: `src/styles.css`
- Backend boundary: Tauri commands invoking the Python worker
- Worker models and search/edit payloads: `python/dt_manager_worker`

This is a refactor plan for the current stack. It does not assume a framework migration, runtime change, or backend rewrite.

## Progress Notes

### 2026-04-11
- A first-pass app shell has been added in `src/App.tsx`.
- The current working screen now sits behind a real top-level `Library` view selection.
- Placeholder views have been introduced for:
  - `Series`
  - `Tags`
  - `Export Presets`
  - `Settings`
- Shell-level navigation config now lives outside `App.tsx`, and the top bar has been extracted into a dedicated layout component.
- The live Library screen is now consuming extracted helper modules for:
  - shared Library display components
  - Library modal components
  - Library utility functions
- The live Library implementation now lives in `src/views/LibraryView.tsx`.
- `src/App.tsx` has now been reduced to the actual app shell and no longer carries the legacy inline Library implementation.
- The first real `LibraryView` subcomponents have now been extracted:
  - `src/components/library/LibrarySidebar.tsx`
  - `src/components/library/LibraryFilters.tsx`
- The next `LibraryView` extraction pass is now complete:
  - `src/components/library/LibraryResults.tsx`
  - `src/components/library/LibraryInspector.tsx`
- `src/views/LibraryView.tsx` now composes extracted sidebar, filters, results, and inspector regions instead of carrying the workspace markup inline.
- A follow-up extraction pass is also complete:
  - `src/components/library/LibraryOverlays.tsx`
- `src/views/LibraryView.tsx` no longer owns the datalist and modal stack inline.
- A first Library state-boundary extraction is also complete:
  - `src/hooks/useLibraryOverlayState.ts`
- `src/views/LibraryView.tsx` no longer owns all overlay and tag-admin UI state inline.
- A second Library state-boundary extraction is also complete:
  - `src/hooks/useLibraryExportState.ts`
- `src/views/LibraryView.tsx` no longer owns export dialog state, export preset state, or export execution orchestration inline.
- A third Library state-boundary extraction is also complete:
  - `src/hooks/useLibraryEditState.ts`
- `src/views/LibraryView.tsx` no longer owns pending edit state, write-preview flow, or pending DB sync orchestration inline.
- A fourth Library state-boundary extraction is also complete:
  - `src/hooks/useLibrarySearchState.ts`
- `src/views/LibraryView.tsx` no longer owns result loading, available tag loading, or filter/reset orchestration inline.
- A first post-refactor layout pass is also complete:
  - compact Library connection/sync status is now surfaced in the app shell top bar
  - the Library sidebar header has been reduced from a hero block to a smaller workspace header
- A second layout pass is also complete:
  - the Library sidebar now includes a stronger workspace summary section
  - the center pane now has a clearer results header/meta layer above the browser
- A third layout pass is also complete:
  - the previous wide top filter bar has been moved into the sidebar as a filter panel
  - the left side now behaves more like the intended navigation/filter rail
- A fourth layout pass is also complete:
  - the Library sidebar is now grouped into Browse, Refine, and Manage sections
  - the daily workflow reads more clearly from summary to filtering to admin utilities
- A fifth layout pass is also complete:
  - the left rail now includes browse-oriented source states for All Images, Selected, Recent, Unassigned, and client-side series buckets
  - the sidebar connection panel now focuses on status and actions rather than persistent path detail
- A sixth layout pass is also complete:
  - the left rail now includes saved pivots and pinned series above the full client-side series list
  - the browse area reads more like navigation rather than a flat stack of filter controls
- A seventh layout pass is also complete:
  - the left rail is now separated into distinct Browse and Refine zones with a compact footer utility block
  - connection and tag-admin controls now read like secondary workspace utilities instead of peer navigation sections
- An eighth layout pass is also complete:
  - Library setup and admin quick actions now surface from the app shell top bar instead of the sidebar
  - the sidebar utility footer is now summary-oriented instead of action-oriented
- A follow-up regression fix is also complete:
  - the top-bar connect/refresh action now uses current Library connection state instead of a stale callback snapshot
- A ninth layout pass is also complete:
  - the center browser now has a stronger header/subline, clearer selection summary, and a denser results surface
  - the thumbnail browser reads more like the main working canvas and less like another generic card stack
- A tenth layout pass is also complete:
  - the right inspector now operates as real `Details`, `Edit`, and `Export` tabs instead of stacked utility panels
  - export configuration now has a task-oriented home in the inspector using the existing export hook and commands
- An eleventh layout pass is also complete:
  - Settings now lives in a dedicated screen backed by the live Library state instead of a modal-only flow
  - the Library view remains mounted behind navigation so connection, export, and theme state are preserved across screens
- A twelfth layout pass is also complete:
  - Tags now lives in a dedicated screen backed by the live Library tag-management state instead of the old modal flow
  - the Library overlay stack no longer owns a Tag Manager modal, and tag administration now routes through top-level navigation
- A thirteenth layout pass is also complete:
  - Series now lives in a dedicated screen backed by live Library series buckets instead of a placeholder-only route
  - the first pass includes series counts, ordering context, cover placeholder data, assigned-image previews, and `Open in Library` actions wired back into the mounted Library view
- A fourteenth layout pass is also complete:
  - the Series screen now layers app-managed metadata over the derived Library series buckets, including editable display names, descriptions, cover notes, archive state, and persisted reorder controls
  - this keeps the current stack intact by storing Series admin metadata in frontend local storage until a true persistence contract is defined
- A fifteenth layout pass is also complete:
  - the Series screen now supports local-only series creation and deletion, while derived Darktable-backed series buckets remain browseable and can have their local overrides reset
  - `Open in Library` remains limited to derived series buckets so the UI does not imply backend persistence that does not exist yet
- A sixteenth layout pass is also complete:
  - Series admin persistence now lives in the existing worker-backed app-state layer, using new Python and Tauri commands instead of frontend-only local storage
  - this keeps the app-owned Series model inside the current architecture and makes the persistence boundary consistent with export presets and other runtime-managed state
- A seventeenth layout pass is also complete:
  - Export Presets now lives in a dedicated screen backed by the live Library export state and existing worker-backed preset persistence
  - the Library inspector export tab no longer owns preset creation/editing, so it can stay focused on loading a preset, reviewing export scope, and running the current export
- An eighteenth layout pass is also complete:
  - the Library export tab now emphasizes preset summary, scope refinement, output override, and run-state feedback instead of acting like a condensed preset editor
  - detailed recipe editing remains in the dedicated Export Presets screen, which strengthens the intended Browse -> Select -> Inspect/Edit -> Export flow
- A nineteenth layout pass is also complete:
  - export progress and logs now render as a non-blocking job drawer instead of a centered modal, so Library browsing can continue while exports run
  - stdout and stderr are now tucked into collapsible sections, reducing the amount of persistent log noise in the main workflow
- A twentieth layout pass is also complete:
  - the center browser toolbar now combines quick search, sort selection, selection summary, and layout toggles into one deliberate control bar
  - quick search now filters the current working set locally, which helps users narrow a source or pivot without reworking the left-rail filter state
- A twenty-first layout pass is also complete:
  - the app top bar now behaves more like a shell-level status and action surface, with library path/status treated as quieter context instead of a competing browser header
  - quick actions remain available at the shell level, while the Library header and toolbar now carry the browsing-specific context
- A twenty-second layout pass is also complete:
  - the Library browser and inspector now have clearer empty/no-result states, which makes the workspace feel intentional even when a source is empty or nothing is selected
  - several heavier visual treatments were softened so the shell feels less prototype-like and more controlled for public-facing use
- A twenty-third layout pass is also complete:
  - Series, Tags, Settings, and Export Presets now share a more consistent screen-shell header rhythm, intro treatment, and empty-state language
  - the dedicated screens read more like one application family instead of Library plus separate utility views
- A twenty-fourth layout pass is also complete:
  - action labels, helper text, and status wording have been normalized further across the shell, Library workflow, and dedicated screens
  - the UI voice is now more consistent about when it uses product-facing language versus low-level technical terminology
- A twenty-fifth layout pass is also complete:
  - the shared theme tokens and shell density have been pushed toward the supplied dark mockup, with flatter graphite surfaces, tighter spacing, and a calmer teal accent treatment
- A twenty-sixth layout pass is also complete:
  - Library now uses a denser browser presentation with a tighter header, slimmer card treatment, and a more reference-like selection and inspector rhythm
  - Series and Tags now use more mockup-like management layouts, including compact tabs, clearer pane separation, and denser list/detail styling
- A twenty-seventh layout pass is also complete:
  - control sizing, list-row density, and secondary-action styling have been tightened further across Library, Series, and Tags
  - the app now tracks the supplied reference more closely at the smaller interaction-detail level, not just at the broad layout level
  - this begins the shift from “polished current UI” toward “visually aligned with the new reference direction” without changing the architecture

- A twenty-eighth layout pass is also complete:
  - the remaining Library metadata separator issue has been removed and lightweight icon-like markers now reinforce left-rail navigation and tag rows
  - this closes most of the small visual rough edges that were still keeping the app from feeling directly modeled on the supplied reference
- A twenty-ninth layout pass is also complete:
  - duplicate top-bar destinations have been consolidated so the primary navigation only appears once
  - Library-specific connection control remains available without repeating the same view-routing buttons in a second row
- A thirtieth layout pass is also complete:
  - all remaining top-row buttons now live inside the same header panel, so the shell reads as one unified top surface instead of a stacked title panel plus separate nav strip
  - responsive top-bar behavior has been updated so the consolidated header still reflows cleanly on narrower widths
- A thirty-first layout pass is also complete:
  - the dedicated Settings, Series, Tags, and Export Presets screens no longer stop at fixed admin-page widths and now use the full available content frame
  - this brings those screens closer to the wider desktop-tool proportions shown in the target reference
- A thirty-second layout pass is also complete:
  - internal pane proportions have been rebalanced so the primary detail and editor areas in Series, Tags, Export Presets, and Settings use more of the available width
  - the supporting side columns remain present, but they no longer dominate the newly expanded screen frame
- A thirty-third layout pass is also complete:
  - Settings now uses a stronger desktop two-column grid, with Appearance spanning full width instead of floating as a small third card
  - Series, Tags, and Export Presets now keep their supporting side columns sticky on desktop so the main content can use width without losing nearby controls
- The next structural milestone is a final review pass against the supplied mockup to spot any remaining screen-specific mismatches worth closing.

## 1. Current Code Reality

### Frontend Structure
- The current UI is concentrated in one large `src/App.tsx`.
- The app already contains the core building blocks for:
  - library connection
  - image search
  - image selection
  - single-image inspection
  - batch metadata editing
  - write preview
  - pending DB sync handling
  - export execution
  - tag management
- The main UI is currently structured as:
  - left sidebar
  - top-of-main export panel
  - filter row
  - image browser
  - right-side selection and batch-edit stack
  - modal overlays for settings, tags, export status, and search tags

### Architectural Constraint
- The backend service boundary is already reasonable.
- The primary frontend problem is not missing infrastructure. It is that too much UI responsibility lives in a single screen and a single component.
- The implementation should therefore focus first on:
  - component extraction
  - view composition
  - state boundary cleanup
  - layout restructuring

## 2. Recommended Frontend File Direction

These are suggested files and folders, not mandatory names.

### App Shell
- `src/App.tsx`
  - reduce to shell, routing/view selection, and top-level state wiring
- `src/views/LibraryView.tsx`
- `src/views/SeriesView.tsx`
- `src/views/TagsView.tsx`
- `src/views/ExportPresetsView.tsx`
- `src/views/SettingsView.tsx`

### Shared Layout
- `src/components/layout/TopBar.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/InspectorPanel.tsx`
- `src/components/layout/ViewFrame.tsx`

### Library Components
- `src/components/library/SourceNav.tsx`
- `src/components/library/SeriesRail.tsx`
- `src/components/library/FilterRail.tsx`
- `src/components/library/LibraryToolbar.tsx`
- `src/components/library/ImageGrid.tsx`
- `src/components/library/ImageList.tsx`
- `src/components/library/SelectionSummary.tsx`
- `src/components/library/DetailsInspector.tsx`
- `src/components/library/EditInspector.tsx`
- `src/components/library/ExportInspector.tsx`
- `src/components/library/WritePreviewPanel.tsx`

### Admin Components
- `src/components/series/SeriesList.tsx`
- `src/components/series/SeriesEditor.tsx`
- `src/components/tags/TagTreePanel.tsx`
- `src/components/tags/TagDetailPanel.tsx`
- `src/components/tags/TagActionsPanel.tsx`
- `src/components/presets/PresetList.tsx`
- `src/components/presets/PresetEditor.tsx`

### Shared UI Components
- `src/components/ui/StatusBadge.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/TagChipInput.tsx`
- `src/components/ui/PathField.tsx`
- `src/components/ui/RatingSelect.tsx`
- `src/components/ui/ColorLabelSelect.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/ui/JobStatusDialog.tsx`

## 3. Recommended State Boundaries

### Keep At App Shell Level
- active view
- theme
- connection summary
- pending DB sync summary
- global status indicators

### Move Into Library View State
- search filters
- selected image IDs
- thumbnail layout mode
- active source scope
- active series scope
- search tag picker state
- write preview state
- write status state
- export panel state

### Move Into Tags View State
- selected tag path
- tag search/filter text
- tag action input fields
- tag operation status

### Move Into Series View State
- selected series
- series search text
- series editor draft
- ordering state
- series detail pane state

### Move Into Export Presets View State
- preset selection
- preset editor draft
- preset create/update/delete status

## 4. API And Backend Touchpoints

### Existing Frontend APIs Already Available
- `inspectLibrary`
- `searchImages`
- `listTags`
- `previewWritePlan`
- `applyMetadataEdits`
- `listPendingDbSync`
- `retryPendingDbSync`
- `runExport`
- `listExportPresets`
- `saveExportPreset`
- `manageTag`

### Likely Frontend API Additions Needed

#### For Series
- `listSeries`
- `getSeries`
- `createSeries`
- `updateSeries`
- `deleteSeries`
- `reorderSeries`
- `openSeriesInLibrary` is likely frontend-only state behavior, not a backend command

#### For Tag Management Improvements
- `getTagDetails`
  - image count
  - parent path
  - related tags
- `mergeTag`
  - if merge is planned beyond the current `manageTag` actions

#### For Export Presets
- `deleteExportPreset`
- `renameExportPreset`
- optional `duplicateExportPreset`

### Python Worker Implications
- The current worker already supports the Library, export, and tag-edit core flows.
- Series appears to be missing from the live Tauri app boundary and will likely require:
  - app-owned persistence
  - worker or app-side storage model
  - query-to-library filtering bridge
- Recommended approach:
  - introduce Series as app-owned metadata first
  - connect Series to Library filtering without changing the overall worker architecture

## 5. Phase-By-Phase Implementation Mapping

### Phase 1: App Shell Refactor

Goal:
- create an app shell that can host multiple views while preserving the current behavior

Frontend work:
- extract the current sidebar/header behavior from `src/App.tsx`
- add an `activeView` state
- create placeholder views for:
  - Library
  - Series
  - Tags
  - Export Presets
  - Settings
- move connection summary into a compact top-bar status cluster

Primary files:
- `src/App.tsx`
- `src/styles.css`
- new layout components under `src/components/layout`
- new view files under `src/views`

Risk:
- low to medium

Notes:
- this phase should not change backend contracts yet

### Phase 2: Library Three-Pane Refactor

Goal:
- turn the current one-screen workbench into a deliberate Library workspace

Frontend work:
- move export out of the top-of-screen panel
- create left rail for sources, series list, and filters
- create center browser pane
- create right inspector tabs
- move current Selection and Batch Edit sections into inspector tabs

Primary files:
- `src/views/LibraryView.tsx`
- `src/components/library/*`
- `src/styles.css`

State work:
- extract Library-specific state from `App.tsx`
- isolate:
  - filters
  - selection
  - layout mode
  - inspector tab
  - write preview
  - export draft state

Risk:
- medium

Notes:
- this is the highest-value phase for the user experience

### Phase 3: Write Preview And Batch Edit Cleanup

Goal:
- make editing safer, clearer, and more batch-oriented

Frontend work:
- redesign the preview panel into a cleaner summary component
- remove duplicate sync-scope messaging
- improve mixed-selection handling
- clarify save actions and consequences

Primary files:
- `src/components/library/EditInspector.tsx`
- `src/components/library/WritePreviewPanel.tsx`
- `src/types.ts`

Potential backend touchpoints:
- optional enhancement of preview payload if current preview data is not rich enough

Risk:
- medium

### Phase 4: Tags Screen

Goal:
- replace the tag modal with a dedicated management screen

Frontend work:
- build a three-column Tags view
- reuse existing tag tree/building logic where possible
- move tag action forms into the right-side actions panel
- preserve existing tag operations while improving screen structure

Primary files:
- `src/views/TagsView.tsx`
- `src/components/tags/*`
- `src/styles.css`

API work:
- current `manageTag` can remain
- add richer tag detail API only if the center panel needs more data than the current tag list provides

Risk:
- medium

### Phase 5: Series Screen

Goal:
- make Series a first-class concept in the application

Frontend work:
- add dedicated Series screen with list/detail/edit layout
- add `Open in Library`
- wire series browsing into the Library left rail

Primary files:
- `src/views/SeriesView.tsx`
- `src/components/series/*`
- `src/types.ts`
- `src/api.ts`

Backend work:
- add persistence and CRUD shape for Series
- keep it app-owned if that is the simplest path

Risk:
- medium to high

Notes:
- this is the main functional gap between the current live app and the target product model

### Phase 6: Export Presets And Settings Screens

Goal:
- reduce modal clutter and move utility/admin tasks into dedicated screens

Frontend work:
- create `ExportPresetsView`
- create `SettingsView`
- simplify the Library export panel so it focuses on execution rather than preset administration

Primary files:
- `src/views/ExportPresetsView.tsx`
- `src/views/SettingsView.tsx`
- `src/components/presets/*`
- `src/styles.css`

API work:
- extend export preset management only if delete/rename/duplicate is needed

Risk:
- low to medium

### Phase 7: Visual System And Public-Release Polish

Goal:
- make the app feel intentional and release-ready

Frontend work:
- tighten spacing
- reduce card softness
- standardize surfaces, borders, and corner radii
- improve typography hierarchy
- improve empty states and system messaging
- improve button and field consistency

Primary files:
- `src/styles.css`
- shared UI components
- all view-level layout files

Risk:
- low, but broad

## 6. Recommended Styling Refactor Strategy

### Current Problem
- `src/styles.css` is doing too much at once:
  - app shell
  - panels
  - image grid
  - inspector
  - modals
  - admin tools

### Suggested Approach
- Keep CSS in the same general style system.
- Introduce clearer sectioning in the stylesheet, or split styles by domain if the team prefers.

Suggested structure:
- app shell
- layout primitives
- top bar
- side rails
- browser/grid/list
- inspector
- forms and fields
- status and badges
- dialogs
- tags screen
- series screen
- presets screen

### Design Tokens To Revisit
- background colors
- elevated panel colors
- border colors
- muted text colors
- accent color usage
- spacing scale
- radius scale
- shadow scale

## 7. Suggested Type Additions

### Frontend Types Likely Needed
- `AppView`
- `LibrarySource`
- `SeriesRecord`
- `SeriesDetail`
- `ExportPresetDraft`
- `TagDetail`
- `ConnectionSummary`

### Existing Types To Revisit
- `ImageRecord`
  - may need explicit series information if Series becomes first-class in Library
- `PendingEdit`
  - may need series assignment fields
- `ExportSettings`
  - may need expanded metadata/JSON options
- `ExportPreset`
  - may need ID or richer metadata if presets become fully manageable

## 8. What Should Not Change

- Do not replace Tauri.
- Do not replace React.
- Do not move away from TypeScript.
- Do not replace the Python worker/service model.
- Do not force a routing framework if simple local view state is sufficient.
- Do not rebuild the app around a new design system library unless there is a very narrow reason.
- Do not block the Library redesign on finishing Series first.

## 9. Recommended Order Of Execution For The Team

### Track A: Structural Refactor
- [ ] Extract app shell
- [ ] Extract Library view
- [ ] Extract shared components
- [ ] Shrink `App.tsx`

### Track B: Workflow Refactor
- [ ] Move export into inspector
- [ ] Rebuild Library layout
- [ ] Improve batch edit and write preview
- [ ] Clean up connection/status behavior

### Track C: Admin Surface Refactor
- [ ] Dedicated Tags screen
- [ ] Dedicated Series screen
- [ ] Dedicated Export Presets screen
- [ ] Dedicated Settings screen

### Track D: Polish
- [ ] Visual hierarchy pass
- [ ] UX copy pass
- [ ] Empty/error state pass
- [ ] Release-readiness pass

## 10. Definition Of Success

The refactor is successful when:
- the app clearly reads as `Library` first
- browsing and selecting images feels like the primary activity
- batch editing is clearer and more trustworthy
- export feels like an end-stage action, not the opening task
- admin functions no longer compete with daily-use workflows
- the app feels more like a deliberate Darktable companion and less like a mixed dashboard/workbench
