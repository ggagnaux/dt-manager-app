import type { Dispatch, SetStateAction } from "react";
import type { SearchFilters } from "../../types";

export function LibraryFilters({
  filters,
  isConnected,
  resultCount,
  selectedCount,
  variant = "panel",
  colorLabelOptions,
  onFiltersChange,
  onOpenSearchTags,
  onReset,
  onSearch,
}: {
  filters: SearchFilters;
  isConnected: boolean;
  resultCount: number;
  selectedCount: number;
  variant?: "panel" | "sidebar";
  colorLabelOptions: ReadonlyArray<{ value: string; label: string }>;
  onFiltersChange: Dispatch<SetStateAction<SearchFilters>>;
  onOpenSearchTags: () => void;
  onReset: () => void;
  onSearch: () => void;
}) {
  const activeFilterCount = [
    filters.text,
    filters.folder,
    filters.dateFrom,
    filters.dateTo,
    filters.rating,
    filters.colorLabel,
    filters.tags.length > 0 ? "tags" : "",
  ].filter(Boolean).length;
  const isSidebar = variant === "sidebar";

  return (
    <section className={`filter-row ${isSidebar ? "filter-row-sidebar" : ""} ${!isConnected ? "panel-locked" : ""}`}>
      <div className="filter-row-header">
        <div>
          <p className="eyebrow">{isSidebar ? "Refine" : "Search"}</p>
          <h2>{isSidebar ? "Filters" : "Library Filters"}</h2>
        </div>
        <div className="filter-row-meta">
          <span className="topbar-status-item">{resultCount} results</span>
          <span className="topbar-status-item">{selectedCount} selected</span>
          <span className="topbar-status-item topbar-status-item-muted">{activeFilterCount} active filters</span>
        </div>
      </div>
      <div className={`filter-row-top ${isSidebar ? "filter-row-top-sidebar" : ""}`}>
        <input
          placeholder="Search filename or folder..."
          value={filters.text}
          onChange={(event) =>
            onFiltersChange((current) => ({ ...current, text: event.target.value }))
          }
        />
        <select
          value={filters.rating ?? ""}
          onChange={(event) =>
            onFiltersChange((current) => ({
              ...current,
              rating: event.target.value ? Number(event.target.value) : null,
            }))
          }
        >
          <option value="">All ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
        </select>
        <select
          value={filters.colorLabel}
          onChange={(event) =>
            onFiltersChange((current) => ({ ...current, colorLabel: event.target.value }))
          }
        >
          <option value="">All labels</option>
          {colorLabelOptions.filter((option) => option.value).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(event) =>
            onFiltersChange((current) => ({ ...current, dateFrom: event.target.value }))
          }
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(event) =>
            onFiltersChange((current) => ({ ...current, dateTo: event.target.value }))
          }
        />
        <input
          placeholder="Folder filter"
          value={filters.folder}
          onChange={(event) =>
            onFiltersChange((current) => ({ ...current, folder: event.target.value }))
          }
        />
      </div>
      <div className="filter-row-divider" />
      <div className="filter-row-tags">
        <div className={`tag-filter-control ${isSidebar ? "tag-filter-control-sidebar" : "tag-filter-control-wide"}`}>
          <button className="ghost" onClick={onOpenSearchTags}>
            Tags
          </button>
          <div className="search-tag-pill-box">
            {filters.tags.length > 0 ? (
              <div className="tag-chip-row">
                {filters.tags.map((tag) => (
                  <span className="tag-chip" key={tag}>{tag}</span>
                ))}
              </div>
            ) : (
              <span className="muted">No tag filters</span>
            )}
          </div>
        </div>
      </div>
      <div className="filter-row-bottom">
        <button className="ghost" onClick={onReset}>
          Reset
        </button>
        <button className={isSidebar ? "" : "ghost"} onClick={onSearch}>
          Search
        </button>
      </div>
      {!isConnected ? <div className="panel-lock-overlay">Connect to search and select images.</div> : null}
    </section>
  );
}
