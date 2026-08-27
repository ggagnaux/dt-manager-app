import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ConnectionState,
  ExportRunResult,
  ExportSettings,
} from "../../types";

export function SettingsModal({
  connection,
  exportSettings,
  theme,
  onClose,
  onPickDatabasePath,
  onPickExportPath,
  onConnectionChange,
  onExportSettingsChange,
  onThemeChange,
}: {
  connection: ConnectionState;
  exportSettings: ExportSettings;
  theme: "dark" | "light";
  onClose: () => void;
  onPickDatabasePath: (field: "libraryDbPath" | "dataDbPath") => Promise<void>;
  onPickExportPath: (field: "outputPath" | "darktableCliPath") => Promise<void>;
  onConnectionChange: Dispatch<SetStateAction<ConnectionState>>;
  onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
  onThemeChange: Dispatch<SetStateAction<"dark" | "light">>;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Paths and appearance</h2>
          </div>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <div className="modal-section">
          <label>
            <span>library.db</span>
            <div className="input-with-button">
              <input
                value={connection.libraryDbPath}
                onChange={(event) =>
                  onConnectionChange((current) => ({ ...current, libraryDbPath: event.target.value }))
                }
                placeholder="Path to Darktable library.db"
              />
              <button className="ghost" onClick={() => void onPickDatabasePath("libraryDbPath")}>Browse</button>
            </div>
          </label>
          <label>
            <span>data.db</span>
            <div className="input-with-button">
              <input
                value={connection.dataDbPath}
                onChange={(event) =>
                  onConnectionChange((current) => ({ ...current, dataDbPath: event.target.value }))
                }
                placeholder="Optional path to Darktable data.db"
              />
              <button className="ghost" onClick={() => void onPickDatabasePath("dataDbPath")}>Browse</button>
            </div>
          </label>
          <label>
            <span>darktable-cli</span>
            <div className="input-with-button">
              <input
                value={exportSettings.darktableCliPath}
                onChange={(event) =>
                  onExportSettingsChange((current) => ({ ...current, darktableCliPath: event.target.value }))
                }
                placeholder="Optional darktable-cli path"
              />
              <button className="ghost" onClick={() => void onPickExportPath("darktableCliPath")}>Browse</button>
            </div>
          </label>
          <label>
            <span>Theme</span>
            <div className="segmented-control" role="group" aria-label="Theme selector">
              <button
                className={theme === "dark" ? "segmented-active" : "ghost"}
                onClick={() => onThemeChange(() => "dark")}
              >
                Dark
              </button>
              <button
                className={theme === "light" ? "segmented-active" : "ghost"}
                onClick={() => onThemeChange(() => "light")}
              >
                Light
              </button>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

export function ExportStatusModal({
  exportStatus,
  exportLog,
  inProgress,
  onClose,
}: {
  exportStatus: string;
  exportLog: ExportRunResult | null;
  inProgress: boolean;
  onClose: () => void;
}) {
  const statusTitle = inProgress
    ? "Export in progress"
    : exportLog
      ? exportLog.success
        ? "Export complete"
        : "Export finished with issues"
      : "Export status";

  return (
    <aside className="export-job-drawer" role="dialog" aria-modal="false" aria-label="Export job status">
      <div className="export-job-drawer-card">
        <div className="panel-header export-job-header">
          <div>
            <p className="eyebrow">Export Job</p>
            <h2>{statusTitle}</h2>
          </div>
          <button className="ghost" disabled={inProgress} onClick={onClose}>
            Dismiss
          </button>
        </div>
        <div className="modal-section">
          <div className={`status-banner ${inProgress ? "status-banner-running" : "status-banner-complete"}`}>
            <span className={`status-dot ${inProgress ? "status-dot-running" : "status-dot-complete"}`} />
            <strong>{exportStatus || (inProgress ? "Running export..." : "Waiting for export updates.")}</strong>
          </div>
          <div className="export-job-summary">
            <div className="detail-row">
              <span>State</span>
              <strong>{inProgress ? "Running" : exportLog ? (exportLog.success ? "Completed" : "Failed") : "Idle"}</strong>
            </div>
            <div className="detail-row">
              <span>Exit Code</span>
              <strong>{exportLog ? String(exportLog.exitCode) : inProgress ? "Pending" : "n/a"}</strong>
            </div>
          </div>
          {inProgress ? <p className="muted">DT Manager is waiting for `dt-export-meta` to finish. You can keep browsing while this job runs.</p> : null}
          {exportLog ? (
            <div className="export-log">
              <div className="detail-row">
                <span>Command</span>
                <strong>{exportLog.command.join(" ")}</strong>
              </div>
              <details className="export-log-detail" open={Boolean(exportLog.stderr)}>
                <summary>stdout</summary>
                <textarea readOnly value={exportLog.stdout || "(no stdout)"} />
              </details>
              <details className="export-log-detail" open={Boolean(exportLog.stderr)}>
                <summary>stderr</summary>
                <textarea readOnly value={exportLog.stderr || "(no stderr)"} />
              </details>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export function TagManagerModal({
  availableTags,
  selectedTagPath,
  newRootTagName,
  tagChildName,
  tagRenameValue,
  tagMoveParent,
  tagStatus,
  onClose,
  onSelectTag,
  onNewRootTagNameChange,
  onTagChildNameChange,
  onTagRenameValueChange,
  onTagMoveParentChange,
  onTagAction,
}: {
  availableTags: string[];
  selectedTagPath: string;
  newRootTagName: string;
  tagChildName: string;
  tagRenameValue: string;
  tagMoveParent: string;
  tagStatus: string;
  onClose: () => void;
  onSelectTag: (value: string) => void;
  onNewRootTagNameChange: Dispatch<SetStateAction<string>>;
  onTagChildNameChange: Dispatch<SetStateAction<string>>;
  onTagRenameValueChange: Dispatch<SetStateAction<string>>;
  onTagMoveParentChange: Dispatch<SetStateAction<string>>;
  onTagAction: (action: "create_root" | "create_child" | "rename" | "move") => Promise<void>;
}) {
  const [hierarchyFilter, setHierarchyFilter] = useState("");
  const [standardFilter, setStandardFilter] = useState("");
  const hierarchicalTags = availableTags
    .filter((tag) => tag.includes("|"))
    .filter((tag) => tag.toLocaleLowerCase().includes(hierarchyFilter.trim().toLocaleLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  const standardTags = availableTags
    .filter((tag) => !tag.includes("|"))
    .filter((tag) => tag.toLocaleLowerCase().includes(standardFilter.trim().toLocaleLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card tag-manager-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tags</p>
            <h2>Manage standard and hierarchical tags</h2>
          </div>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <div className="tag-manager-layout">
          <div className="tag-list-panel">
            <div className="panel-header">
              <h3>Hierarchical Tags</h3>
              <span className="muted">{hierarchicalTags.length} shown</span>
            </div>
            <input
              value={hierarchyFilter}
              onChange={(event) => setHierarchyFilter(event.target.value)}
              placeholder="Filter hierarchical tags"
            />
            <div className="tag-listbox" role="listbox" aria-label="Hierarchical tags">
              {hierarchicalTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={`tag-listbox-option ${selectedTagPath === tag ? "selected" : ""}`}
                  onClick={() => onSelectTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="panel-header">
              <h3>Standard Tags</h3>
              <span className="muted">{standardTags.length} shown</span>
            </div>
            <input
              value={standardFilter}
              onChange={(event) => setStandardFilter(event.target.value)}
              placeholder="Filter standard tags"
            />
            <div className="tag-listbox" role="listbox" aria-label="Standard tags">
              {standardTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={`tag-listbox-option ${selectedTagPath === tag ? "selected" : ""}`}
                  onClick={() => onSelectTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="tag-manager">
            <label>
              <span>Create Root Tag</span>
              <div className="input-with-button">
                <input
                  value={newRootTagName}
                  onChange={(event) => onNewRootTagNameChange(event.target.value)}
                  placeholder="New root tag"
                />
                <button className="ghost" onClick={() => void onTagAction("create_root")}>Create</button>
              </div>
            </label>
            <label>
              <span>Create Child Tag</span>
              <div className="input-with-button">
                <input
                  value={tagChildName}
                  onChange={(event) => onTagChildNameChange(event.target.value)}
                  placeholder="Child tag name"
                />
                <button className="ghost" disabled={!selectedTagPath} onClick={() => void onTagAction("create_child")}>
                  Add Child
                </button>
              </div>
            </label>
            <label>
              <span>Rename Selected Tag</span>
              <div className="input-with-button">
                <input
                  value={tagRenameValue}
                  onChange={(event) => onTagRenameValueChange(event.target.value)}
                  placeholder="New tag name"
                />
                <button className="ghost" disabled={!selectedTagPath} onClick={() => void onTagAction("rename")}>
                  Rename
                </button>
              </div>
            </label>
            <label>
              <span>Move Selected Tag To Parent</span>
              <div className="input-with-button">
                <input
                  value={tagMoveParent}
                  onChange={(event) => onTagMoveParentChange(event.target.value)}
                  placeholder="Parent path, blank for root"
                />
                <button className="ghost" disabled={!selectedTagPath} onClick={() => void onTagAction("move")}>
                  Move
                </button>
              </div>
            </label>
            {tagStatus ? <p className="write-status">{tagStatus}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchTagsModal({
  availableTags,
  selectedTags,
  onClose,
  onChange,
  onClear,
}: {
  availableTags: string[];
  selectedTags: string[];
  onClose: () => void;
  onChange: (value: string[]) => void;
  onClear: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const visibleTags = availableTags.filter((tag) =>
    tag.toLocaleLowerCase().includes(searchText.trim().toLocaleLowerCase()),
  );

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card tag-picker-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search Tags</p>
            <h2>Filter results by tag</h2>
          </div>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <div className="modal-section">
          <div className="inline-actions">
            <span className="muted">{selectedTags.length} tag filter(s) selected</span>
            <button className="ghost" onClick={onClear}>Clear Tags</button>
          </div>
          <div className="tag-picker-selected">
            <span className="section-label">Selected tags</span>
            {selectedTags.length > 0 ? (
              <div className="tag-chip-row">
                {selectedTags.map((tag) => (
                  <button
                    className="tag-chip tag-chip-button"
                    key={tag}
                    onClick={() => onChange(selectedTags.filter((value) => value !== tag))}
                    type="button"
                  >
                    {tag} x
                  </button>
                ))}
              </div>
            ) : (
              <span className="muted">No tags selected</span>
            )}
          </div>
          <input
            className="tag-picker-search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Filter tags..."
          />
          <div className="tag-picker-list">
            {visibleTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <label key={tag} className={`tag-picker-item ${selected ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange(Array.from(new Set([...selectedTags, tag])).sort((a, b) => a.localeCompare(b)));
                        return;
                      }
                      onChange(selectedTags.filter((value) => value !== tag));
                    }}
                  />
                  <span>{tag}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
