# DT Manager UI/UX Refactor Task List

This document turns the UI/UX redesign audit into an execution-ready refactor plan for the existing DT Manager application.

Constraints:
- Keep the existing Tauri + React + TypeScript frontend.
- Keep the existing Python worker/service boundary.
- Keep the existing desktop application model.
- Treat this as a refactor and restructuring effort, not a rewrite or migration.

## Progress Updates

### 2026-04-11
- [x] Added a first-pass app shell with top-level view navigation.
- [x] Wrapped the current working application flow as the live `Library` view.
- [x] Added placeholder top-level views for `Series`, `Tags`, `Export Presets`, and `Settings`.
- [x] Added top-level shell styling to support the phased split.
- [x] Extracted shell navigation config and top-bar rendering into dedicated frontend files.
- [x] Extracted active Library helper components, modal components, and utility functions into dedicated files.
- [x] Moved the live Library screen into a dedicated `src/views/LibraryView.tsx` module.
- [x] Deleted the legacy inline `LegacyLibraryView` copy and reduced `App.tsx` to the app shell.
- [x] Removed the remaining legacy inline helper copies from `App.tsx` by replacing the file with the clean shell version.
- [x] Split the first real `LibraryView` subcomponents out into `LibrarySidebar` and `LibraryFilters`.
- [x] Split the results browser and the selection/batch-edit stack into dedicated `LibraryResults` and `LibraryInspector` components.
- [x] Rewired `src/views/LibraryView.tsx` so it now composes extracted Library shell, filter, results, and inspector components.
- [x] Extracted the bottom-of-view datalist and modal/dialog wiring into a dedicated `LibraryOverlays` component.
- [x] Moved Library overlay and tag-admin UI state into a dedicated `useLibraryOverlayState` hook.
- [x] Moved Library export state and export execution/preset orchestration into a dedicated `useLibraryExportState` hook.
- [x] Moved Library edit state, write-preview flow, and pending DB sync handling into a dedicated `useLibraryEditState` hook.
- [x] Moved Library search/loading state and filter-driven result loading into a dedicated `useLibrarySearchState` hook.
- [x] Promoted compact Library connection/sync status into the app shell top bar.
- [x] Reduced the Library sidebar header from a hero-style intro to a smaller workspace header and utility panels.
- [x] Added a stronger workspace summary section in the Library sidebar and a clearer results header/meta treatment in the center pane.
- [x] Replaced the wide top filter bar with a sidebar filter panel so the left side now behaves more like a navigation/filter rail.
- [x] Split the sidebar into clearer Browse, Refine, and Manage groups so the Library screen reads more like a workflow rail.
- [x] Added browse-oriented left-rail source states for All Images, Selected, Recent, Unassigned, and client-side series buckets.
- [x] Further demoted path details out of the Library sidebar so the connection panel is now status-focused.
- [x] Added stronger browse structures in the left rail with saved pivots and pinned series above the full series list.
- [x] Split the left rail into harder Browse, Refine, and footer-level utility zones so navigation is no longer one continuous sidebar stack.
- [x] Moved the remaining connection/setup quick actions out of the sidebar and into top-bar/Settings-triggered flows.
- [x] Fixed a regression in the new top-bar Library action wiring so connect/refresh now uses current connection paths instead of stale closure state.
- [x] Polished the center pane header, selection toolbar, and thumbnail surface so the browser reads more like the dominant working area.
- [x] Tightened the right inspector hierarchy into real `Details`, `Edit`, and `Export` work modes backed by the current app state.
- [x] Promoted Settings out of the modal and into the staged dedicated screen while keeping the live Library state mounted.
- [x] Promoted Tags out of the modal and into a dedicated screen backed by the live Library tag-management state.
- [x] Removed the old Tag Manager modal from the Library overlay stack and moved tag administration into top-level navigation.
- [x] Replaced the staged `Series` placeholder with a dedicated screen backed by live Library series buckets and `Open in Library` actions.
- [x] Added a first-pass Series detail workspace with ordering, counts, cover placeholder, and assigned-image preview driven from current Library state.
- [x] Added app-managed Series editing for display name, description, cover note, archive state, and reorder controls persisted in local frontend state.
- [x] Added realistic local create/delete semantics for Series, distinguishing local-only DT Manager entries from derived Darktable-backed series buckets.
- [x] Moved Series persistence into the existing worker-backed app-state layer instead of frontend-only local storage.
- [x] Added Tauri and Python worker commands for loading and saving app-owned Series admin state.
- [x] Wired a dedicated `Export Presets` screen using the live Library export state and worker-backed preset persistence.
- [x] Moved export preset creation/editing out of the Library inspector so the inspector export tab is now execution-focused.
- [x] Simplified the Library export tab around preset summary, scope refinement, output override, and run-state feedback.
- [x] Replaced the blocking export status modal with a non-blocking export job drawer that keeps progress and logs available while browsing continues.
- [x] Reduced the remaining export feedback UI to a compact status summary plus collapsible stdout/stderr details.
- [x] Tightened the center-pane browser controls with a unified quick-search, sort selector, and selection/layout toolbar.
- [x] Added local browser-level result search so users can refine the current working set without changing left-rail filters.
- [x] Simplified the app top bar so it now carries quieter app-level context, compact library status, and quick actions instead of competing with the Library browser header.
- [x] Added clearer empty and no-result states to the Library browser and inspector so the workspace feels intentional even when nothing is selected or visible.
- [x] Softened some of the heavier visual treatments across the Library shell so panels and selected thumbnails feel more controlled and release-ready.
- [x] Added shared screen-shell header rhythm and intro treatment across Series, Tags, Settings, and Export Presets.
- [x] Added stronger empty and no-selection states to dedicated screens so the admin surfaces feel more intentional and consistent with Library.
- [x] Normalized the final round of action labels, helper text, and status wording across the shell, Library workflow, and dedicated admin screens.
- [x] Started aligning the live application theme and layout density to the supplied dark mockup, with flatter graphite surfaces, tighter chrome, and a more restrained teal accent.
- [x] Continued the mockup-alignment pass in Library, Series, and Tags with denser browser cards, slimmer chrome, and more reference-like management panes.
- [x] Polished control sizing, row density, and admin-screen detail styling so the live app more closely matches the supplied reference image.
- [x] Cleaned up the remaining Library metadata separator issue and added lightweight icon-like markers to navigation and tag rows for closer reference alignment.
- [x] Consolidated the top-bar buttons so primary view navigation only appears once and Library actions no longer duplicate the same destinations.
- [x] Moved all top-row buttons into the same top header panel so navigation and Library actions live in one unified surface.
- [x] Expanded the dedicated Series, Tags, Export Presets, and Settings screens to use the full content width instead of fixed-width admin-page caps.
- [x] Rebalanced the internal pane proportions on Series, Tags, Export Presets, and Settings so the primary content areas claim more of the available width.
- [x] Added stronger desktop behavior to the dedicated screens with stickier support columns and a wider two-column Settings layout.
- [ ] The next layout target is a final review pass against the supplied mockup to spot any remaining screen-specific mismatches worth closing.

## Now

### 1. Refactor Foundation
- [ ] Confirm the project goal as a UI/UX refactor within the current stack and architecture.
- [x] Define the first-pass navigation model:
  - `Library`
  - `Series`
  - `Tags`
  - `Export Presets`
  - `Settings`
- [ ] Break the current `App.tsx` into view-level and panel-level components.
- [ ] Define state boundaries for:
  - app shell and active view
  - library filters and query state
  - image selection state
  - inspector state
  - export state
  - tag admin state
  - series admin state
- [ ] Create shared layout primitives for:
  - top bar
  - left rail
  - center content pane
  - right inspector
  - dialog shell
  - inline status patterns

### 2. Main Screen Cleanup
- [ ] Remove the current hero/dashboard feel from the main screen.
- [ ] Reduce oversized panel treatments and glass-heavy surfaces.
- [ ] Remove repeated status and sync explanations from multiple areas.
- [ ] Demote connection details from a large panel to compact top-bar status.
- [ ] Remove the giant always-visible export form from the top of the main workspace.
- [ ] Separate daily-use features from occasional admin tasks.

### 3. Library Screen Restructure
- [ ] Refactor the current main workspace into a true three-pane Library screen.
- [ ] Add a top bar that contains:
  - app name
  - active library/path
  - global search
  - connection status
  - DB sync status
  - quick actions for Export, Series, Tags, and Settings
- [ ] Create a left pane for:
  - source navigation
  - series browsing
  - collapsible filters
- [ ] Create a center pane for:
  - current source title
  - result count
  - selection count
  - sort control
  - grid/list toggle
  - main image browser
- [ ] Create a right inspector with tabs:
  - `Details`
  - `Edit`
  - `Export`
- [ ] Reframe the main workflow to read as:
  - Browse
  - Select
  - Inspect/Edit
  - Export

### 4. Filtering And Browse Improvements
- [ ] Move filters out of the current wide top form layout and into collapsible left-rail groups.
- [ ] Keep support for:
  - tags
  - rating
  - color label
  - date range
  - folder
  - text search
- [ ] Add a compact source list with shortcuts such as:
  - `All Images`
  - `By Series`
  - `Recent`
  - `Unassigned`
  - `Selected`
- [ ] Add a compact series list with counts.
- [ ] Add clearer active-filter summaries and easier reset behavior.
- [ ] Separate search/filter tags from edit/assignment tags visually.

### 5. Image Browser Improvements
- [ ] Redesign thumbnail presentation to feel like a library browser rather than a dashboard of cards.
- [ ] Reduce card padding, radius, shadow weight, and decorative styling.
- [ ] Keep both grid and row/list modes.
- [ ] Make list mode denser and more metadata-friendly.
- [ ] Improve scanability for:
  - title
  - filename
  - rating
  - series
  - key tags
- [ ] Keep existing multi-select, range-select, and select-all behavior.
- [ ] Strengthen selected states using cleaner borders and restrained accent color.

### 6. Inspector Refactor
- [ ] Move current single-image detail into the `Details` tab.
- [ ] Move current batch editing into the `Edit` tab.
- [ ] Move export execution into the `Export` tab.
- [ ] Improve mixed-selection handling so multiple selections do not present as one canonical item.
- [ ] Consolidate duplicated sync-scope explanations into one compact reusable pattern.

### 7. Batch Edit Improvements
- [ ] Make batch editing slightly more prominent than single-image inspection.
- [ ] Show selected item count and selection summary at the top of the edit tab.
- [ ] Group edit controls into:
  - tag actions
  - series assignment
  - metadata edits
  - preview and save actions
- [ ] Preserve tag action modes:
  - add
  - remove
  - replace
- [ ] Support metadata edits for:
  - title
  - description
  - rating
  - color label
- [ ] Add explicit series assignment and removal actions.
- [ ] Clarify write actions and save behavior.

### 8. Write Preview And Save Feedback
- [ ] Redesign write preview to be easier to scan and less debug-like.
- [ ] Show:
  - selected count
  - affected count
  - tag additions/removals
  - field changes
  - XMP creation needs
  - partial failure states
- [ ] Keep retryable DB sync visible, but reduce visual noise.
- [ ] Improve partial-sync failure messaging and recovery guidance.

## Next

### 9. Series Screen
- [ ] Create a dedicated `Series` screen instead of relying on implicit `series|...` tag patterns in the UI.
- [ ] Build the screen as a list/detail management view.
- [ ] Add a series list that shows:
  - name
  - description preview
  - order
  - image count
  - optional cover image
  - status
- [ ] Add ordering controls:
  - drag handles if practical
  - move up/down controls as fallback
- [ ] Add a detail/editor panel for:
  - name
  - description
  - order
  - active status
  - optional cover image
  - assigned image count
- [ ] Add quick actions for:
  - create
  - rename
  - reorder
  - duplicate
  - deactivate/archive
  - delete
- [ ] Add `Open in Library` so a selected series can pivot directly into the Library browser.
- [ ] Keep implementation realistic if the first version of Series remains app-owned rather than Darktable-native.

### 10. Tags Screen
- [ ] Replace the current tag modal with a dedicated `Tags` screen.
- [ ] Build it as a three-column admin workspace:
  - left: hierarchical tree
  - center: selected tag details
  - right: actions and utilities
- [ ] Left column tasks:
  - searchable hierarchical tree
  - expand/collapse behavior
  - optional counts
- [ ] Center column tasks:
  - selected tag details
  - parent path
  - tag type
  - image count
  - related or recent tags
  - affected images preview
- [ ] Right column tasks:
  - create root
  - create child
  - rename
  - move
  - merge
  - delete
- [ ] Add impact-aware confirmations for destructive actions.
- [ ] Improve validation and status messaging for tag operations.

### 11. Export Workflow Redesign
- [ ] Make export an end-stage action inside the Library inspector instead of a dominant top-of-screen panel.
- [ ] Keep export focused on:
  - current selection
  - current result set
  - chosen export preset
- [ ] Add export controls for:
  - preset selection
  - output folder
  - image type
  - width and height
  - include JSON
  - metadata transform options
  - skip export / rebuild metadata only
- [ ] Add a compact export summary before execution.
- [ ] Keep full stdout/stderr details available, but move them out of the main workspace by default.
- [ ] Improve export completion feedback with clearer success/failure summaries.

### 12. Export Presets Screen
- [ ] Create a dedicated `Export Presets` screen.
- [ ] Support:
  - list presets
  - create preset
  - edit preset
  - delete preset
  - duplicate preset
- [ ] Preserve storage of:
  - output folder
  - image type
  - width and height
  - JSON options
  - metadata options
  - skip-export behavior
- [ ] Allow presets to load directly into the Library export tab.
- [ ] Separate preset management from one-off export overrides.

### 13. Settings Screen
- [ ] Convert settings from a modal-first flow into a dedicated screen.
- [ ] Move connection and setup configuration here:
  - `library.db`
  - `data.db`
  - `darktable-cli`
  - theme
  - sync behavior
- [ ] Keep only compact connection and sync indicators in the top bar.
- [ ] Improve validation for missing or invalid paths.
- [ ] Improve read-only and write-blocked guidance.

## Later

### 14. Visual Design System Cleanup
- [ ] Replace the current soft, oversized card language with a more restrained desktop-tool visual system.
- [ ] Establish a dark-first palette built around charcoal and slate surfaces.
- [ ] Use accent color sparingly for:
  - selected states
  - primary actions
  - active tabs
  - status highlights
- [ ] Tighten the spacing scale across the application.
- [ ] Reduce control corner radius to a more moderate desktop feel.
- [ ] Improve hierarchy through typography rather than decorative surface styling.
- [ ] Standardize borders, shadows, and panel elevations.

### 15. Reusable Component Inventory
- [ ] Create shared shell components:
  - `TopBar`
  - `PrimaryNav`
  - `StatusCluster`
  - `AppViewFrame`
- [ ] Create shared Library components:
  - `LibrarySidebar`
  - `SourceNav`
  - `SeriesRail`
  - `FilterGroup`
  - `LibraryToolbar`
  - `ImageGrid`
  - `ImageList`
  - `InspectorTabs`
  - `DetailsInspector`
  - `EditInspector`
  - `ExportInspector`
- [ ] Create shared admin components:
  - `SeriesList`
  - `SeriesEditor`
  - `TagTree`
  - `TagDetailPanel`
  - `TagActionsPanel`
  - `PresetList`
  - `PresetEditor`
- [ ] Create shared input and feedback components:
  - `TagChipInput`
  - `RatingControl`
  - `ColorLabelControl`
  - `PathPickerField`
  - `InlineStatus`
  - `EmptyState`
  - `ConfirmDialog`
  - `JobStatusDialog`

### 16. UX Copy And Messaging
- [ ] Remove prototype/thematic language such as "metadata cockpit".
- [ ] Rename sections using direct task-oriented labels.
- [ ] Rewrite empty states to be calm, concise, and informative.
- [ ] Rewrite write/export feedback to be clearer and more human-readable.
- [ ] Keep technical details available without making them the primary message.
- [ ] Clarify DB lock guidance and recovery wording for public users.

### 17. Public Release Polish
- [ ] Audit labels, capitalization, and terminology for consistency.
- [ ] Add stronger empty states for:
  - no library connected
  - no images found
  - no selection
  - no series
  - no tags
  - no presets
- [ ] Improve destructive action confirmations and safety copy.
- [ ] Improve keyboard accessibility and focus visibility.
- [ ] Ensure consistency across:
  - dialogs
  - panes
  - tabs
  - lists
  - status states
- [ ] Make the application feel intentional and release-ready without changing the underlying stack.

## Suggested Delivery Sequence

### Phase 1
- [ ] App shell refactor
- [ ] Navigation structure
- [ ] Shared layout primitives
- [ ] Top-bar status model

### Phase 2
- [ ] Library three-pane layout
- [ ] Filter rail redesign
- [ ] Image browser cleanup
- [ ] Inspector tabs

### Phase 3
- [ ] Batch edit cleanup
- [ ] Write preview redesign
- [ ] Export-in-inspector flow

### Phase 4
- [ ] Dedicated Tags screen

### Phase 5
- [ ] Dedicated Series screen

### Phase 6
- [ ] Dedicated Export Presets screen
- [ ] Dedicated Settings screen

### Phase 7
- [ ] Visual system polish
- [ ] Copy and empty states
- [ ] Public release cleanup pass
