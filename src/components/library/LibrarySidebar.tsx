import type { Dispatch, SetStateAction } from "react";
import { LibraryFilters } from "./LibraryFilters";
import { DetailRow } from "./LibraryShared";
import type {
  ConnectionState,
  LibrarySeriesSource,
  LibrarySourceKey,
  PendingDbSyncJob,
  SearchFilters,
} from "../../types";

export function LibrarySidebar({
  connection,
  workerMessage,
  pendingDbSyncJobs,
  selectedTagPath,
  availableTagCount,
  tagStatus,
  isConnected,
  imageCount,
  totalImageCount,
  selectedCount,
  activeSource,
  activeSeriesSourceKey,
  sourceCounts,
  seriesSources,
  savedPivotCount,
  activeSavedPivotKey,
  pinnedSeriesSources,
  filters,
  colorLabelOptions,
  onSourceChange,
  onSeriesSourceChange,
  onSavedPivotChange,
  onFiltersChange,
  onOpenSearchTags,
  onResetFilters,
  onSearch,
}: {
  connection: ConnectionState;
  workerMessage: string;
  pendingDbSyncJobs: PendingDbSyncJob[];
  selectedTagPath: string;
  availableTagCount: number;
  tagStatus: string;
  isConnected: boolean;
  imageCount: number;
  totalImageCount: number;
  selectedCount: number;
  activeSource: LibrarySourceKey;
  activeSeriesSourceKey: string | null;
  sourceCounts: Record<Exclude<LibrarySourceKey, "series">, number>;
  seriesSources: LibrarySeriesSource[];
  savedPivotCount: number;
  activeSavedPivotKey: string | null;
  pinnedSeriesSources: LibrarySeriesSource[];
  filters: SearchFilters;
  colorLabelOptions: ReadonlyArray<{ value: string; label: string }>;
  onSourceChange: (source: Exclude<LibrarySourceKey, "series">) => void;
  onSeriesSourceChange: (seriesKey: string) => void;
  onSavedPivotChange: (pivotKey: string) => void;
  onFiltersChange: Dispatch<SetStateAction<SearchFilters>>;
  onOpenSearchTags: () => void;
  onResetFilters: () => void;
  onSearch: () => void;
}) {
  const browseSources: Array<{
    key: Exclude<LibrarySourceKey, "series">;
    label: string;
    count: number;
  }> = [
    { key: "all", label: "All Images", count: sourceCounts.all },
    { key: "selected", label: "Selected", count: sourceCounts.selected },
    { key: "recent", label: "Recent", count: sourceCounts.recent },
    { key: "unassigned", label: "Unassigned", count: sourceCounts.unassigned },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-zone sidebar-zone-browse">
        <div className="brand-block library-sidebar-header">
          <p className="eyebrow">Library</p>
          <div className="library-sidebar-title-row">
            <h1>DT Manager</h1>
            <span className="status-pill sidebar-mini-pill">{isConnected ? "Online" : "Offline"}</span>
          </div>
        </div>

        <div className="sidebar-section-heading">
          <span>Browse</span>
        </div>

        <div className="sidebar-group">
          <section className="panel sidebar-summary-panel">
            <div className="panel-header">
              <h2>Current Set</h2>
              <span className="muted">{imageCount} / {totalImageCount}</span>
            </div>
            <div className="sidebar-metric-grid">
              <div className="sidebar-metric-card">
                <span className="sidebar-metric-label">Visible</span>
                <strong>{imageCount}</strong>
              </div>
              <div className="sidebar-metric-card">
                <span className="sidebar-metric-label">Selected</span>
                <strong>{selectedCount}</strong>
              </div>
              <div className="sidebar-metric-card">
                <span className="sidebar-metric-label">Pending Sync</span>
                <strong>{pendingDbSyncJobs.length}</strong>
              </div>
            </div>
          </section>

          <section className="panel sidebar-source-panel">
            <div className="sidebar-series-header">
              <div>
                <h2>Sources</h2>
                <p className="muted sidebar-panel-note">Library pivots and quick browse states</p>
              </div>
              <span className="muted">{browseSources.length}</span>
            </div>
            <div className="sidebar-source-list" role="list" aria-label="Library sources">
              {browseSources.map((source) => (
                <button
                  key={source.key}
                  className={`sidebar-source-button ${activeSource === source.key ? "sidebar-source-active" : "ghost"}`}
                  onClick={() => onSourceChange(source.key)}
                >
                  <span>{source.label}</span>
                  <strong>{source.count}</strong>
                </button>
              ))}
            </div>

            <div className="sidebar-browse-subsection">
              <div className="sidebar-series-header">
                <span>Saved Pivots</span>
                <span className="muted">{savedPivotCount}</span>
              </div>
              <div className="sidebar-source-list" role="list" aria-label="Saved pivots">
                <button
                  className={`sidebar-source-button ${activeSavedPivotKey === "five-stars" ? "sidebar-source-active" : "ghost"}`}
                  onClick={() => onSavedPivotChange("five-stars")}
                >
                  <span>Five Stars</span>
                  <strong>5★</strong>
                </button>
                <button
                  className={`sidebar-source-button ${activeSavedPivotKey === "blue-label" ? "sidebar-source-active" : "ghost"}`}
                  onClick={() => onSavedPivotChange("blue-label")}
                >
                  <span>Blue Label</span>
                  <strong>Label</strong>
                </button>
                <button
                  className={`sidebar-source-button ${activeSavedPivotKey === "tagged" ? "sidebar-source-active" : "ghost"}`}
                  onClick={() => onSavedPivotChange("tagged")}
                >
                  <span>Tagged Work</span>
                  <strong>Tags</strong>
                </button>
              </div>
            </div>

            <div className="sidebar-browse-subsection">
              <div className="sidebar-series-header">
                <span>Pinned Series</span>
                <span className="muted">{pinnedSeriesSources.length}</span>
              </div>
              {pinnedSeriesSources.length > 0 ? (
                <div className="sidebar-source-list" role="list" aria-label="Pinned series sources">
                  {pinnedSeriesSources.map((series) => (
                    <button
                      key={series.key}
                      className={`sidebar-source-button ${activeSource === "series" && activeSeriesSourceKey === series.key ? "sidebar-source-active" : "ghost"}`}
                      onClick={() => onSeriesSourceChange(series.key)}
                      title={series.tagPath}
                    >
                      <span>{series.label}</span>
                      <strong>{series.count}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted sidebar-series-empty">Pinned series will appear here when series tags are present.</p>
              )}
            </div>

            <div className="sidebar-browse-subsection">
              <div className="sidebar-series-header">
                <span>All Series</span>
                <span className="muted">{seriesSources.length}</span>
              </div>
              {seriesSources.length > 0 ? (
                <div className="sidebar-source-list sidebar-source-list-compact" role="list" aria-label="All series sources">
                  {seriesSources.map((series) => (
                    <button
                      key={series.key}
                      className={`sidebar-source-button ${activeSource === "series" && activeSeriesSourceKey === series.key ? "sidebar-source-active" : "ghost"}`}
                      onClick={() => onSeriesSourceChange(series.key)}
                      title={series.tagPath}
                    >
                      <span>{series.label}</span>
                      <strong>{series.count}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted sidebar-series-empty">Series buckets will appear here when series tags are present.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="sidebar-zone sidebar-zone-refine">
        <div className="sidebar-section-heading">
          <span>Refine</span>
        </div>
        <LibraryFilters
          filters={filters}
          isConnected={isConnected}
          resultCount={imageCount}
          selectedCount={selectedCount}
          variant="sidebar"
          colorLabelOptions={colorLabelOptions}
          onFiltersChange={onFiltersChange}
          onOpenSearchTags={onOpenSearchTags}
          onReset={onResetFilters}
          onSearch={onSearch}
        />
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-header">
          <span className="sidebar-footer-title">Status</span>
          <span className={`status-pill status-${connection.status}`}>
            {connection.status === "ready"
              ? "Connected"
              : connection.status === "read_only"
                ? "Read Only"
                : connection.status === "write_blocked"
                  ? "Write Blocked"
                  : "Not Connected"}
          </span>
        </div>
        <div className="sidebar-footer-meta">
          <span className="worker-state">{workerMessage}</span>
          <span className="muted">{connection.detail}</span>
        </div>
        <div className={`sidebar-footer-summary ${!isConnected ? "panel-locked" : ""}`}>
          <div className="settings-summary">
            <DetailRow label="Selected Tag" value={selectedTagPath || "No tag selected"} />
            <DetailRow label="Available Tags" value={String(availableTagCount)} />
          </div>
          <div className="pending-sync-bar sidebar-footer-sync">
            <span>{pendingDbSyncJobs.length} pending sync items</span>
          </div>
          {tagStatus ? <p className="write-status">{tagStatus}</p> : null}
          {!isConnected ? <div className="panel-lock-overlay">Connect to Darktable to browse and manage tags.</div> : null}
        </div>
      </div>
    </aside>
  );
}
