import { useEffect, useMemo, useState } from "react";
import { useSeriesAdminState } from "../hooks/useSeriesAdminState";
import type { LibrarySeriesRecord } from "../types";

export function SeriesView({
  series,
  activeSeriesKey,
  onOpenSeries,
}: {
  series: LibrarySeriesRecord[];
  activeSeriesKey: string | null;
  onOpenSeries: (seriesKey: string) => void;
}) {
  const {
    adminSeries,
    statusMessage,
    setSeriesField,
    moveSeries,
    toggleSeriesStatus,
    createSeries,
    deleteSeries,
  } = useSeriesAdminState(series);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(activeSeriesKey ?? adminSeries[0]?.key ?? null);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesDescription, setNewSeriesDescription] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "edit" | "export">("details");

  useEffect(() => {
    setSelectedSeriesKey((current) => {
      if (activeSeriesKey && adminSeries.some((item) => item.key === activeSeriesKey)) {
        return activeSeriesKey;
      }
      if (current && adminSeries.some((item) => item.key === current)) {
        return current;
      }
      return adminSeries[0]?.key ?? null;
    });
  }, [activeSeriesKey, adminSeries]);

  const selectedSeries = useMemo(
    () => adminSeries.find((item) => item.key === selectedSeriesKey) ?? null,
    [adminSeries, selectedSeriesKey],
  );

  return (
    <div className="placeholder-view series-view">
      <div className="placeholder-card screen-shell series-card">
        <div className="panel-header screen-shell-header">
          <div>
            <p className="eyebrow">Series</p>
            <h2>Series</h2>
            <p className="screen-shell-intro muted">
              Keep ordering, naming, and export-facing notes aligned with the Library browsing workflow.
            </p>
          </div>
          <button type="button" onClick={() => setSelectedSeriesKey(null)}>
            New Series
          </button>
        </div>

        <div className="screen-mode-tabs" role="tablist" aria-label="Series modes">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "details"}
            className={activeTab === "details" ? "screen-mode-tab screen-mode-tab-active" : "screen-mode-tab ghost"}
            onClick={() => setActiveTab("details")}
          >
            Details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "edit"}
            className={activeTab === "edit" ? "screen-mode-tab screen-mode-tab-active" : "screen-mode-tab ghost"}
            onClick={() => setActiveTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "export"}
            className={activeTab === "export" ? "screen-mode-tab screen-mode-tab-active" : "screen-mode-tab ghost"}
            onClick={() => setActiveTab("export")}
          >
            Export
          </button>
        </div>

        <div className="series-screen-layout">
          <div className="panel series-list-panel">
            <div className="panel-header">
              <h3>Series List</h3>
              <span className="muted">{adminSeries.length} series</span>
            </div>

            <div className="series-create-panel">
              <label>
                <span>New Local Series</span>
                <input
                  value={newSeriesName}
                  onChange={(event) => setNewSeriesName(event.target.value)}
                  placeholder="Series name"
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={newSeriesDescription}
                  onChange={(event) => setNewSeriesDescription(event.target.value)}
                  rows={3}
                  placeholder="How this series should be described in DT Manager"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const createdKey = createSeries(newSeriesName, newSeriesDescription);
                  if (createdKey) {
                    setSelectedSeriesKey(createdKey);
                    setNewSeriesName("");
                    setNewSeriesDescription("");
                  }
                }}
              >
                Create Series
              </button>
            </div>

            {adminSeries.length > 0 ? (
              <div className="series-list" role="list" aria-label="Series list">
                {adminSeries.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={`series-list-item ${selectedSeriesKey === item.key ? "series-list-item-active" : "ghost"}`}
                    onClick={() => setSelectedSeriesKey(item.key)}
                  >
                    <span className="series-list-order">{String(item.order).padStart(2, "0")}</span>
                    <span className="series-list-preview" aria-hidden="true">
                      {(item.displayLabel ?? item.label).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="series-list-meta">
                      <strong>{item.displayLabel ?? item.label}</strong>
                      <span className="muted">{item.description}</span>
                    </div>
                    <div className="series-list-trailing">
                      <span className={`status-pill status-${item.status === "archived" ? "read_only" : "ready"}`}>
                        {item.status}
                      </span>
                      <span className="series-list-count">{item.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state-panel screen-empty-state">
                <p className="eyebrow">No Series</p>
                <h3>No series buckets are available yet</h3>
                <p className="muted">Series will appear here when `series|...` tags are present in the connected Library.</p>
              </div>
            )}
          </div>

          <div className="panel series-detail-panel">
            {selectedSeries ? (
              <>
                <div className="panel-header">
                  <div>
                    <h3>{selectedSeries.displayLabel ?? selectedSeries.label}</h3>
                    <p className="muted">{selectedSeries.tagPath}</p>
                  </div>
                  <span className={`status-pill status-${selectedSeries.status === "archived" ? "read_only" : "ready"}`}>
                    {selectedSeries.status}
                  </span>
                </div>

                <div className="series-detail-grid">
                  <div className="series-detail-card">
                    <span className="sidebar-metric-label">Order</span>
                    <strong>{selectedSeries.order}</strong>
                  </div>
                  <div className="series-detail-card">
                    <span className="sidebar-metric-label">Images</span>
                    <strong>{selectedSeries.count}</strong>
                  </div>
                  <div className="series-detail-card">
                    <span className="sidebar-metric-label">Cover</span>
                    <strong>{selectedSeries.coverFilename}</strong>
                  </div>
                </div>

                {activeTab === "details" ? (
                  <>
                    <div className="series-note-card">
                      <span className="sidebar-metric-label">Description</span>
                      <strong>{selectedSeries.description || "No description yet."}</strong>
                    </div>
                    <div className="series-preview-panel">
                      <div className="panel-header">
                        <h3>Assigned Images</h3>
                        <span className="muted">{selectedSeries.imageFilenames.length} previewed</span>
                      </div>
                      <div className="series-image-preview-list">
                        {selectedSeries.imageFilenames.map((filename) => (
                          <span key={filename} className="tag-chip">{filename}</span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {activeTab === "edit" ? (
                  <>
                    <label>
                      <span>Display Name</span>
                      <input
                        value={selectedSeries.displayLabel ?? selectedSeries.label}
                        onChange={(event) => setSeriesField(selectedSeries.key, "displayLabel", event.target.value)}
                        placeholder="Series display name"
                      />
                    </label>

                    <label>
                      <span>Description</span>
                      <textarea
                        value={selectedSeries.description}
                        onChange={(event) => setSeriesField(selectedSeries.key, "description", event.target.value)}
                        rows={4}
                      />
                    </label>

                    <label>
                      <span>Cover Image Note</span>
                      <input
                        value={selectedSeries.coverFilename}
                        onChange={(event) => setSeriesField(selectedSeries.key, "coverFilename", event.target.value)}
                        placeholder="Cover image filename"
                      />
                    </label>
                  </>
                ) : null}

                {activeTab === "export" ? (
                  <div className="series-note-card">
                    <span className="sidebar-metric-label">Library Hand-off</span>
                    <strong>
                      Use this view to prepare the series, then pivot back into Library for batch editing and export.
                    </strong>
                  </div>
                ) : null}

                <div className="series-action-row">
                  <button
                    type="button"
                    className="ghost"
                    disabled={selectedSeries.order <= 1}
                    onClick={() => moveSeries(selectedSeries.key, -1)}
                  >
                    Move Up
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={selectedSeries.order >= adminSeries.length}
                    onClick={() => moveSeries(selectedSeries.key, 1)}
                  >
                    Move Down
                  </button>
                  <button type="button" className="ghost" onClick={() => toggleSeriesStatus(selectedSeries.key)}>
                    {selectedSeries.status === "active" ? "Archive" : "Restore"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenSeries(selectedSeries.key)}
                    disabled={selectedSeries.sourceKind === "local"}
                  >
                    Browse in Library
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      deleteSeries(selectedSeries.key);
                      setSelectedSeriesKey((current) => (current === selectedSeries.key ? null : current));
                    }}
                  >
                    {selectedSeries.sourceKind === "local" ? "Delete Series" : "Clear Local Overrides"}
                  </button>
                </div>
                {statusMessage ? <p className="write-status">{statusMessage}</p> : null}
                {selectedSeries.sourceKind === "local" ? (
                  <p className="muted">
                    This series exists only in DT Manager for now. It is not yet linked to Darktable tags, so browsing it in Library is unavailable.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="empty-state-panel screen-empty-state">
                <p className="eyebrow">No Selection</p>
                <h3>Select a series to inspect it</h3>
                <p className="muted">Choose a series from the list to edit its metadata and open it in the Library workspace.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
