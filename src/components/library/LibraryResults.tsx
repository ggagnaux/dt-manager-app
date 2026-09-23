import { memo, useEffect, useMemo, useRef, useState } from "react";
import { PreviewThumb } from "./LibraryShared";
import type { ImageRecord } from "../../types";

const GRID_CARD_MIN_WIDTH = 152;
const GRID_CARD_MAX_WIDTH = 176;
const GRID_CARD_HEIGHT = 208;
const ROW_CARD_HEIGHT = 74;
const GRID_GAP = 12;
const VIRTUAL_OVERSCAN_ROWS = 4;

type ResultThumbCardProps = {
  image: ImageRecord;
  index: number;
  selected: boolean;
  hasPendingChanges: boolean;
  thumbnailLayout: "grid" | "rows";
  onThumbnailSelection: (imageId: number, index: number, toggleKey: boolean, shiftKey: boolean) => void;
};

const ResultThumbCard = memo(function ResultThumbCard({
  image,
  index,
  selected,
  hasPendingChanges,
  thumbnailLayout,
  onThumbnailSelection,
}: ResultThumbCardProps) {
  return (
    <button
      className={`thumb-card ${thumbnailLayout === "rows" ? "thumb-card-row" : ""} ${selected ? "selected" : ""}`}
      onClick={(event) =>
        onThumbnailSelection(image.id, index, event.ctrlKey || event.metaKey, event.shiftKey)
      }
    >
      {hasPendingChanges ? (
        <span className="thumb-change-badge" title="Metadata changes pending save or database sync">
          Changed
        </span>
      ) : null}
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
});

export function LibraryResults({
  images,
  selectedIds,
  changedImageIds,
  thumbnailLayout,
  isConnected,
  title,
  sourceLabel,
  sortValue,
  onSelectAllToggle,
  onSortChange,
  onThumbnailLayoutChange,
  onThumbnailSelection,
}: {
  images: ImageRecord[];
  selectedIds: number[];
  changedImageIds: ReadonlySet<number>;
  thumbnailLayout: "grid" | "rows";
  isConnected: boolean;
  title: string;
  sourceLabel: string;
  sortValue: "capture-desc" | "capture-asc" | "title-asc" | "rating-desc";
  onSelectAllToggle: () => void;
  onSortChange: (value: "capture-desc" | "capture-asc" | "title-asc" | "rating-desc") => void;
  onThumbnailLayoutChange: (layout: "grid" | "rows") => void;
  onThumbnailSelection: (imageId: number, index: number, toggleKey: boolean, shiftKey: boolean) => void;
}) {
  const hasImages = images.length > 0;
  const browserSurfaceRef = useRef<HTMLDivElement>(null);
  const [browserSurfaceSize, setBrowserSurfaceSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const singleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const previousLayout = useRef({ images, thumbnailLayout });
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const columnCount = useMemo(() => {
    if (thumbnailLayout === "rows") {
      return 1;
    }

    if (browserSurfaceSize.width <= 0) {
      return 1;
    }

    return Math.max(1, Math.floor((browserSurfaceSize.width + GRID_GAP) / (GRID_CARD_MIN_WIDTH + GRID_GAP)));
  }, [browserSurfaceSize.width, thumbnailLayout]);
  const rowHeight = thumbnailLayout === "rows" ? ROW_CARD_HEIGHT : GRID_CARD_HEIGHT;
  const rowCount = Math.ceil(images.length / columnCount);
  const visibleStartRow = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN_ROWS);
  const visibleEndRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + browserSurfaceSize.height) / rowHeight) + VIRTUAL_OVERSCAN_ROWS,
  );
  const startIndex = visibleStartRow * columnCount;
  const endIndex = Math.min(images.length, visibleEndRow * columnCount);
  const virtualItems = images.slice(startIndex, endIndex);
  const virtualPaddingTop = visibleStartRow * rowHeight;
  const virtualPaddingBottom = Math.max(0, (rowCount - visibleEndRow) * rowHeight);
  const virtualGridStyle = thumbnailLayout === "grid"
    ? { gridTemplateColumns: `repeat(${columnCount}, minmax(${GRID_CARD_MIN_WIDTH}px, ${GRID_CARD_MAX_WIDTH}px))` }
    : undefined;

  useEffect(() => {
    const surface = browserSurfaceRef.current;
    if (!surface) {
      return;
    }
    const measuredSurface = surface;

    function measure() {
      setBrowserSurfaceSize({
        width: measuredSurface.clientWidth,
        height: measuredSurface.clientHeight,
      });
    }

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(measuredSurface);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const surface = browserSurfaceRef.current;
    if (!surface) {
      return;
    }

    const layoutChanged = previousLayout.current.images !== images
      || previousLayout.current.thumbnailLayout !== thumbnailLayout;
    previousLayout.current = { images, thumbnailLayout };
    const index = singleSelectedId === null ? -1 : images.findIndex((image) => image.id === singleSelectedId);
    let nextScrollTop = surface.scrollTop;
    if (index >= 0 && surface.clientHeight > 0) {
      const top = Math.floor(index / columnCount) * rowHeight;
      const bottom = top + rowHeight;
      if (top < nextScrollTop) nextScrollTop = top;
      else if (bottom > nextScrollTop + surface.clientHeight) {
        nextScrollTop = surface.clientHeight < rowHeight ? top : bottom - surface.clientHeight;
      }
    } else if (layoutChanged) {
      nextScrollTop = 0;
    }
    surface.scrollTop = nextScrollTop;
    setScrollTop(surface.scrollTop);
  }, [images, thumbnailLayout, singleSelectedId, columnCount, rowHeight, browserSurfaceSize.height]);

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
            {/* <span className="muted">Focused working set</span> */}
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
              <div className="browser-toolbar-controls">
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
            <span className="muted">{`No images are currently visible in ${title}.`}</span>
          </div>
        )}
        {!isConnected ? <div className="panel-lock-overlay">Connect to manage selection and layout.</div> : null}
      </section>

      <div
        className={`results-browser-surface ${thumbnailLayout === "rows" ? "results-browser-surface-rows" : ""}`}
        ref={browserSurfaceRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {hasImages ? (
          <div className="virtual-image-window">
            <div style={{ height: virtualPaddingTop }} aria-hidden="true" />
            <div
              className={`image-grid ${thumbnailLayout === "rows" ? "image-grid-rows" : ""}`}
              style={virtualGridStyle}
            >
              {virtualItems.map((image, offset) => {
                const index = startIndex + offset;
                return (
                  <ResultThumbCard
                    key={image.id}
                    image={image}
                    index={index}
                    selected={selectedIdSet.has(image.id)}
                    hasPendingChanges={changedImageIds.has(image.id)}
                    thumbnailLayout={thumbnailLayout}
                    onThumbnailSelection={onThumbnailSelection}
                  />
                );
              })}
            </div>
            <div style={{ height: virtualPaddingBottom }} aria-hidden="true" />
          </div>
        ) : (
          <div className="empty-state-panel results-empty-state">
            <p className="eyebrow">No Results</p>
            <h3>No images in this source yet</h3>
            {/* <p className="muted">Try adjusting filters or connect to a Darktable library with available images.</p> */}
          </div>
        )}
      </div>
    </div>
  );
}
