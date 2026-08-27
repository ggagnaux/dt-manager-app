import { PreviewThumb } from "./LibraryShared";
import type { ImageRecord } from "../../types";

export function LibraryResults({
  images,
  selectedIds,
  thumbnailLayout,
  isConnected,
  title,
  sourceLabel,
  searchQuery,
  sortValue,
  onSelectAllToggle,
  onSearchQueryChange,
  onClearSearchQuery,
  onSortChange,
  onThumbnailLayoutChange,
  onThumbnailSelection,
}: {
  images: ImageRecord[];
  selectedIds: number[];
  thumbnailLayout: "grid" | "rows";
  isConnected: boolean;
  title: string;
  sourceLabel: string;
  searchQuery: string;
  sortValue: "capture-desc" | "capture-asc" | "title-asc" | "rating-desc";
  onSelectAllToggle: () => void;
  onSearchQueryChange: (value: string) => void;
  onClearSearchQuery: () => void;
  onSortChange: (value: "capture-desc" | "capture-asc" | "title-asc" | "rating-desc") => void;
  onThumbnailLayoutChange: (layout: "grid" | "rows") => void;
  onThumbnailSelection: (imageId: number, index: number, toggleKey: boolean, shiftKey: boolean) => void;
}) {
  const hasImages = images.length > 0;

  return (
    <div className="results-column">
      <div className="results-header">
        <div className="results-header-copy">
          <div className="results-title-row">
            <h2>{title}</h2>
            <span className="muted">{images.length} images</span>
          </div>
          <div className="results-header-subline">
            <span className="results-scope-chip">{sourceLabel}</span>
            <span className="muted">Focused working set</span>
          </div>
        </div>
        <div className="results-header-meta">
          <span>{selectedIds.length} selected</span>
        </div>
      </div>
      <section className={`selection-toolbar ${!isConnected ? "panel-locked" : ""}`}>
        {hasImages ? (
          <>
            <div className="browser-toolbar">
              <div className="selection-toolbar-copy">
                <strong>{selectedIds.length > 0 ? `${selectedIds.length} item(s) selected` : "No items selected"}</strong>
                <span className="muted">
                  {selectedIds.length > 0
                    ? "Use the inspector to review, edit, and export the current selection."
                    : "Select images to unlock edit and export actions."}
                </span>
              </div>
              <div className="browser-toolbar-controls">
                <label className="browser-search-field">
                  <span className="sr-only">Search current results</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    placeholder="Search results"
                  />
                  {searchQuery ? (
                    <button className="ghost browser-search-clear" onClick={onClearSearchQuery} type="button">
                      Clear
                    </button>
                  ) : null}
                </label>
                <label className="browser-sort-field">
                  <span className="muted">Sort</span>
                  <select
                    value={sortValue}
                    onChange={(event) =>
                      onSortChange(event.target.value as "capture-desc" | "capture-asc" | "title-asc" | "rating-desc")
                    }
                  >
                    <option value="capture-desc">Newest first</option>
                    <option value="capture-asc">Oldest first</option>
                    <option value="title-asc">Title A-Z</option>
                    <option value="rating-desc">Highest rated</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="selection-toolbar-actions">
              <button className="ghost" onClick={onSelectAllToggle}>
                {selectedIds.length === images.length ? "Select None" : "Select All"}
              </button>
              <div className="segmented-control" role="group" aria-label="Thumbnail layout">
                <button
                  className={`layout-toggle-button ${thumbnailLayout === "grid" ? "segmented-active" : "ghost"}`}
                  onClick={() => onThumbnailLayoutChange("grid")}
                  aria-label="Grid view"
                >
                  <span className="layout-icon layout-icon-grid" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
                <button
                  className={`layout-toggle-button ${thumbnailLayout === "rows" ? "segmented-active" : "ghost"}`}
                  onClick={() => onThumbnailLayoutChange("rows")}
                  aria-label="Row view"
                >
                  <span className="layout-icon layout-icon-rows" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state-panel selection-empty-state">
            <strong>No thumbnails in the current working set</strong>
            <span className="muted">
              {searchQuery
                ? `No results match "${searchQuery}" in ${title}.`
                : `No images are currently visible in ${title}.`}
            </span>
          </div>
        )}
        {!isConnected ? <div className="panel-lock-overlay">Connect to manage selection and layout.</div> : null}
      </section>

      <div className={`results-browser-surface ${thumbnailLayout === "rows" ? "results-browser-surface-rows" : ""}`}>
        {hasImages ? (
          <div className={`image-grid ${thumbnailLayout === "rows" ? "image-grid-rows" : ""}`}>
            {images.map((image, index) => {
              const selected = selectedIds.includes(image.id);
              return (
                <button
                  key={image.id}
                  className={`thumb-card ${thumbnailLayout === "rows" ? "thumb-card-row" : ""} ${selected ? "selected" : ""}`}
                  onClick={(event) =>
                    onThumbnailSelection(image.id, index, event.ctrlKey || event.metaKey, event.shiftKey)
                  }
                >
                  <div className="thumb-art">
                    <PreviewThumb image={image} />
                  </div>
                  <div className="thumb-meta">
                    <strong>{image.title}</strong>
                    <span>{image.filename}</span>
                    <span>{image.tags.join(" / ")}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state-panel results-empty-state">
            <p className="eyebrow">No Results</p>
            <h3>{searchQuery ? "No images match the current browser search" : "No images in this source yet"}</h3>
            <p className="muted">
              {searchQuery
                ? "Clear the browser search or choose a broader source in the left rail."
                : "Try another source, adjust filters, or connect to a Darktable library with available images."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
