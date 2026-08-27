import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export function TagsView({
  availableTags,
  selectedTagPath,
  newRootTagName,
  tagChildName,
  tagRenameValue,
  tagMoveParent,
  tagStatus,
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
  onSelectTag: (value: string) => void;
  onNewRootTagNameChange: Dispatch<SetStateAction<string>>;
  onTagChildNameChange: Dispatch<SetStateAction<string>>;
  onTagRenameValueChange: Dispatch<SetStateAction<string>>;
  onTagMoveParentChange: Dispatch<SetStateAction<string>>;
  onTagAction: (action: "create_root" | "create_child" | "rename" | "move") => Promise<void>;
}) {
  const [hierarchyFilter, setHierarchyFilter] = useState("");
  const [standardFilter, setStandardFilter] = useState("");

  const hierarchicalTags = useMemo(
    () =>
      availableTags
        .filter((tag) => tag.includes("|"))
        .filter((tag) => tag.toLocaleLowerCase().includes(hierarchyFilter.trim().toLocaleLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [availableTags, hierarchyFilter],
  );

  const standardTags = useMemo(
    () =>
      availableTags
        .filter((tag) => !tag.includes("|"))
        .filter((tag) => tag.toLocaleLowerCase().includes(standardFilter.trim().toLocaleLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [availableTags, standardFilter],
  );

  const relatedTags = useMemo(
    () =>
      selectedTagPath
        ? availableTags
            .filter((tag) => tag !== selectedTagPath && tag.includes(selectedTagPath.split("|")[0]))
            .slice(0, 8)
        : [],
    [availableTags, selectedTagPath],
  );

  const selectedTagChildren = useMemo(
    () =>
      selectedTagPath
        ? availableTags
            .filter((tag) => tag.startsWith(`${selectedTagPath}|`))
            .slice(0, 8)
        : [],
    [availableTags, selectedTagPath],
  );

  return (
    <div className="placeholder-view tags-view">
      <div className="placeholder-card screen-shell tags-card">
        <div className="panel-header screen-shell-header">
          <div>
            <p className="eyebrow">Tags</p>
            <h2>Tag Management</h2>
            <p className="screen-shell-intro muted">
              Keep tag administration separate from daily Library work while preserving the same data and worker flows.
            </p>
          </div>
          <button className="ghost" type="button" onClick={() => void onTagAction("create_root")}>
            Add Root Tag
          </button>
        </div>

        <div className="tag-screen-layout">
          <div className="panel tag-list-panel">
            <div className="panel-header">
              <h3>Description Tags</h3>
              <span className="muted">{hierarchicalTags.length} shown</span>
            </div>
            <input
              value={hierarchyFilter}
              onChange={(event) => setHierarchyFilter(event.target.value)}
              placeholder="Filter hierarchical tags"
            />
            {hierarchicalTags.length > 0 ? (
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
            ) : (
              <div className="empty-state-panel screen-empty-state">
                <strong>No hierarchical tags match this filter</strong>
                <span className="muted">Adjust the filter or create a new hierarchical root or child tag.</span>
              </div>
            )}

            <div className="panel-header">
              <h3>Standard Tags</h3>
              <span className="muted">{standardTags.length} shown</span>
            </div>
            <input
              value={standardFilter}
              onChange={(event) => setStandardFilter(event.target.value)}
              placeholder="Filter standard tags"
            />
            {standardTags.length > 0 ? (
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
            ) : (
              <div className="empty-state-panel screen-empty-state">
                <strong>No standard tags match this filter</strong>
                <span className="muted">Clear the filter or create a new root tag to add one here.</span>
              </div>
            )}
          </div>

          <div className="tag-manager-screen-center">
            <div className="panel tag-manager-screen-panel">
              <div className="panel-header">
                <h3>{selectedTagPath || "Selected Tag"}</h3>
                <span className="muted">{selectedTagPath ? "Live tag path" : "Nothing selected"}</span>
              </div>
              {selectedTagPath ? (
                <>
                  <div className="series-detail-grid tag-detail-grid">
                    <div className="series-detail-card">
                      <span className="sidebar-metric-label">Tag Type</span>
                      <strong>{selectedTagPath.includes("|") ? "Hierarchical" : "Standard"}</strong>
                    </div>
                    <div className="series-detail-card">
                      <span className="sidebar-metric-label">Depth</span>
                      <strong>{selectedTagPath.split("|").length}</strong>
                    </div>
                    <div className="series-detail-card">
                      <span className="sidebar-metric-label">Related</span>
                      <strong>{relatedTags.length}</strong>
                    </div>
                  </div>
                  <div className="series-note-card">
                    <span className="sidebar-metric-label">Parent Path</span>
                    <strong>{selectedTagPath.includes("|") ? selectedTagPath.split("|").slice(0, -1).join(" | ") : "Root tag"}</strong>
                  </div>
                  <div className="series-preview-panel">
                    <div className="panel-header">
                      <h3>Child Tags</h3>
                      <span className="muted">{selectedTagChildren.length} shown</span>
                    </div>
                    <div className="series-image-preview-list">
                      {selectedTagChildren.length > 0 ? (
                        selectedTagChildren.map((tag) => (
                          <span key={tag} className="tag-chip">{tag}</span>
                        ))
                      ) : (
                        <span className="muted">No direct child tags found.</span>
                      )}
                    </div>
                  </div>
                  <div className="series-preview-panel">
                    <div className="panel-header">
                      <h3>Related Tags</h3>
                      <span className="muted">{relatedTags.length} shown</span>
                    </div>
                    <div className="series-image-preview-list">
                      {relatedTags.length > 0 ? (
                        relatedTags.map((tag) => (
                          <span key={tag} className="tag-chip">{tag}</span>
                        ))
                      ) : (
                        <span className="muted">No nearby tags found.</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state-panel screen-empty-state">
                  <p className="eyebrow">No Selection</p>
                  <h3>Select a tag to inspect it</h3>
                  <p className="muted">Pick a tag from the left column to inspect its path and manage its children.</p>
                </div>
              )}
            </div>

            <div className="panel tag-actions-panel">
              <div className="panel-header">
                <h3>Actions</h3>
                <span className="muted">Create, rename, and move tags</span>
              </div>
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
    </div>
  );
}
