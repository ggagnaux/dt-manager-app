import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  ColorLabelValue,
  DetailRow,
  PreviewThumb,
} from "./LibraryShared";
import type {
  ConnectionState,
  ExportFilterSettings,
  ExportPreset,
  ExportSettings,
  ImageRecord,
  PendingEdit,
  WritePlanPreview,
} from "../../types";

export function LibraryInspector({
  selectedIds,
  selectedImage,
  hasSelection,
  pendingEdit,
  tagDraft,
  planPreview,
  planPreviewMessage,
  writeStatus,
  connection,
  colorLabelOptions,
  exportSettings,
  exportFilters,
  exportPresets,
  exportStatus,
  exportTagDraft,
  exportInProgress,
  onPendingEditChange,
  onTagDraftChange,
  onAddPendingEditTag,
  onRemovePendingEditTag,
  onExportSettingsChange,
  onExportFiltersChange,
  onExportTagDraftChange,
  onLoadExportPreset,
  onAddExportTag,
  onRemoveExportTag,
  onPickExportPath,
  onRunExport,
  onPreviewPlan,
  onApplyEdits,
}: {
  selectedIds: number[];
  selectedImage: ImageRecord | null;
  hasSelection: boolean;
  pendingEdit: PendingEdit;
  tagDraft: string;
  planPreview: WritePlanPreview | null;
  planPreviewMessage: string;
  writeStatus: string;
  connection: ConnectionState;
  colorLabelOptions: ReadonlyArray<{ value: string; label: string }>;
  exportSettings: ExportSettings;
  exportFilters: ExportFilterSettings;
  exportPresets: ExportPreset[];
  exportStatus: string;
  exportTagDraft: string;
  exportInProgress: boolean;
  onPendingEditChange: Dispatch<SetStateAction<PendingEdit>>;
  onTagDraftChange: (value: string) => void;
  onAddPendingEditTag: (tag: string) => void;
  onRemovePendingEditTag: (tag: string) => void;
  onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
  onExportFiltersChange: Dispatch<SetStateAction<ExportFilterSettings>>;
  onExportTagDraftChange: (value: string) => void;
  onLoadExportPreset: (name: string) => void;
  onAddExportTag: (tag: string) => void;
  onRemoveExportTag: (tag: string) => void;
  onPickExportPath: (field: "outputPath" | "darktableCliPath") => void;
  onRunExport: () => void;
  onPreviewPlan: () => void;
  onApplyEdits: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "edit" | "export">("details");

  return (
    <div className="editor-stack">
      <div className="editor-panel inspector-panel">
        <div className="panel-header inspector-header">
          <div>
            <p className="eyebrow">Inspector</p>
            <h2>{activeTab === "details" ? "Details" : activeTab === "edit" ? "Edit" : "Export"}</h2>
          </div>
          <span className="results-scope-chip">{selectedIds.length} selected</span>
        </div>

        <div className="inspector-tab-row" role="tablist" aria-label="Inspector modes">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "details"}
            className={activeTab === "details" ? "inspector-tab inspector-tab-active" : "inspector-tab ghost"}
            onClick={() => setActiveTab("details")}
          >
            Details
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "edit"}
            className={activeTab === "edit" ? "inspector-tab inspector-tab-active" : "inspector-tab ghost"}
            onClick={() => setActiveTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "export"}
            className={activeTab === "export" ? "inspector-tab inspector-tab-active" : "inspector-tab ghost"}
            onClick={() => setActiveTab("export")}
          >
            Export
          </button>
        </div>

        {activeTab === "details" ? (
          <div className={`inspector-tab-panel ${!hasSelection ? "panel-locked" : ""}`}>
            {selectedImage ? (
              <div className="selection-detail">
                <div className="thumb-art detail-art">
                  <PreviewThumb image={selectedImage} />
                </div>
                <div className="detail-grid">
                  <DetailRow label="Title" value={selectedImage.title || "Untitled"} />
                  <DetailRow label="Filename" value={selectedImage.filename} />
                  <DetailRow label="Folder" value={selectedImage.folder} />
                  <DetailRow label="Capture Date" value={selectedImage.captureDate || ""} />
                  <DetailRow label="Rating" value={String(selectedImage.rating)} scope="db+xmp" />
                  <DetailRow
                    label="Color"
                    value={selectedImage.colorLabel || "None"}
                    scope="db+xmp"
                    valueNode={<ColorLabelValue value={selectedImage.colorLabel || ""} />}
                  />
                  <DetailRow label="Creator" value={selectedImage.creator || ""} scope="xmp" />
                  <DetailRow label="Rights" value={selectedImage.rights || ""} scope="xmp" />
                  <DetailRow label="Notes" value={selectedImage.notes || ""} scope="xmp" />
                  <DetailRow label="XMP" value={selectedImage.xmpPath || ""} />
                </div>
                <div className="sync-scope-panel">
                  <p className="eyebrow">Sync Scope</p>
                  <div className="scope-chip-row">
                    <span className="scope-chip scope-chip-full">Tags: XMP + DB</span>
                    <span className="scope-chip scope-chip-full">Rating: XMP + DB</span>
                    <span className="scope-chip scope-chip-full">Color Label: XMP + DB</span>
                    <span className="scope-chip scope-chip-xmp">Title: XMP only</span>
                    <span className="scope-chip scope-chip-xmp">Description: XMP only</span>
                    <span className="scope-chip scope-chip-xmp">Creator: XMP only</span>
                    <span className="scope-chip scope-chip-xmp">Rights: XMP only</span>
                    <span className="scope-chip scope-chip-xmp">Notes: XMP only</span>
                  </div>
                </div>
                <div>
                  <p className="eyebrow">Tags</p>
                  <div className="tag-chip-row">
                    {selectedImage.tags.map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state-panel inspector-empty-state">
                <p className="eyebrow">No Selection</p>
                <h3>Select an image to inspect details</h3>
                <p className="muted">Choose a thumbnail in the browser to review metadata, tags, and file details here.</p>
              </div>
            )}
            {!hasSelection ? <div className="panel-lock-overlay">Select one or more thumbnails to view details.</div> : null}
          </div>
        ) : null}

        {activeTab === "edit" ? (
          <div className={`inspector-tab-panel ${!hasSelection ? "panel-locked" : ""}`}>
            <div className="inspector-section-header">
              <div>
                <h3>Batch Edit</h3>
                <p className="muted">Review the current selection, stage metadata changes, then preview the write plan.</p>
              </div>
              <span className="muted">{selectedIds.length} selected</span>
            </div>

            <label>
              <span>Tag action</span>
              <select
                value={pendingEdit.mode}
                onChange={(event) =>
                  onPendingEditChange((current) => ({
                    ...current,
                    mode: event.target.value as PendingEdit["mode"],
                  }))
                }
              >
                <option value="add">Add tags</option>
                <option value="remove">Remove tags</option>
                <option value="replace">Replace tags</option>
              </select>
            </label>

            <label>
              <span>Tags</span>
              <div className="tag-entry-row">
                <input
                  list="available-tags"
                  value={tagDraft}
                  onChange={(event) => onTagDraftChange(event.target.value)}
                  placeholder="Portfolio or series|Orbs"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddPendingEditTag(tagDraft);
                    }
                  }}
                />
                <button className="ghost" onClick={() => onAddPendingEditTag(tagDraft)}>
                  Add
                </button>
              </div>
              <div className="tag-chip-row">
                {pendingEdit.tags.map((tag) => (
                  <button
                    type="button"
                    className="tag-chip tag-chip-button"
                    key={tag}
                    onClick={() => onRemovePendingEditTag(tag)}
                  >
                    {tag} x
                  </button>
                ))}
              </div>
            </label>

            <label>
              <span>Title</span>
              <input
                value={pendingEdit.title}
                onChange={(event) =>
                  onPendingEditChange((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Leave blank to keep unchanged"
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                value={pendingEdit.description}
                onChange={(event) =>
                  onPendingEditChange((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Leave blank to keep unchanged"
              />
            </label>

            <div className="split-fields">
              <label>
                <span>Rating</span>
                <select
                  value={pendingEdit.rating ?? ""}
                  onChange={(event) =>
                    onPendingEditChange((current) => ({
                      ...current,
                      rating: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                >
                  <option value="">Unchanged</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>

              <label>
                <span>Color label</span>
                <select
                  value={pendingEdit.colorLabel ?? ""}
                  onChange={(event) =>
                    onPendingEditChange((current) => ({
                      ...current,
                      colorLabel: event.target.value || null,
                    }))
                  }
                >
                  <option value="">Unchanged</option>
                  {colorLabelOptions.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="action-row">
                <button className="ghost" onClick={onPreviewPlan}>
                Review Changes
                </button>
              <button
                disabled={!connection.libraryDbPath || selectedIds.length === 0}
                onClick={onApplyEdits}
              >
                Save Changes
              </button>
            </div>

            <div className="preview-box">
              <p className="eyebrow">Write Preview</p>
              <p>{planPreviewMessage}</p>
              {writeStatus ? <p className="write-status">{writeStatus}</p> : null}
              <div className="sync-scope-panel compact">
                <p className="eyebrow">Current Save Behavior</p>
                <div className="scope-chip-row">
                  <span className="scope-chip scope-chip-full">Tags update XMP and DB</span>
                  <span className="scope-chip scope-chip-full">Rating updates XMP and DB</span>
                  <span className="scope-chip scope-chip-full">Color label updates XMP and DB</span>
                  <span className="scope-chip scope-chip-xmp">Title remains XMP-only</span>
                  <span className="scope-chip scope-chip-xmp">Description remains XMP-only</span>
                  <span className="scope-chip scope-chip-xmp">Creator remains XMP-only</span>
                  <span className="scope-chip scope-chip-xmp">Rights remain XMP-only</span>
                  <span className="scope-chip scope-chip-xmp">Notes remain XMP-only</span>
                </div>
              </div>
              {planPreview ? (
                <div className="preview-summary-grid">
                  <DetailRow label="Selected" value={String(planPreview.imageCount)} />
                  <DetailRow label="Affected" value={String(planPreview.affectedCount)} />
                  <DetailRow label="New XMP" value={String(planPreview.xmpMissingCount)} />
                  <DetailRow label="Tag Adds" value={String(planPreview.changes.tagsAdded)} />
                  <DetailRow label="Tag Removes" value={String(planPreview.changes.tagsRemoved)} />
                  <DetailRow label="Title Updates" value={String(planPreview.changes.titleChanges)} />
                  <DetailRow label="Description Updates" value={String(planPreview.changes.descriptionChanges)} />
                  <DetailRow label="Rating Updates" value={String(planPreview.changes.ratingChanges)} />
                  <DetailRow label="Color Updates" value={String(planPreview.changes.colorLabelChanges)} />
                </div>
              ) : null}
              {planPreview?.imagePlans?.length ? (
                <div className="preview-plan-list">
                  {planPreview.imagePlans.slice(0, 8).map((plan) => (
                    <div className="preview-plan-item" key={`${plan.imageId}-${plan.filename}`}>
                      <strong>{plan.filename}</strong>
                      <span>{plan.fieldChanges.join(", ") || "No field changes"}</span>
                      {plan.addedTags.length ? <span>Adding: {plan.addedTags.join(", ")}</span> : null}
                      {plan.removedTags.length ? <span>Removing: {plan.removedTags.join(", ")}</span> : null}
                      {plan.willCreateXmp ? <span>Will create XMP sidecar</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {!hasSelection ? <div className="panel-lock-overlay">Select thumbnails before batch editing metadata.</div> : null}
          </div>
        ) : null}

        {activeTab === "export" ? (
          <div className="inspector-tab-panel">
            <div className="inspector-section-header">
              <div>
                <h3>Export</h3>
                <p className="muted">Choose a preset, confirm scope, and run export from the current Library selection.</p>
              </div>
              <span className="muted">{selectedIds.length} selected</span>
            </div>

            <label>
              <span>Load preset</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    onLoadExportPreset(event.target.value);
                    event.currentTarget.value = "";
                  }
                }}
              >
                <option value="">Choose a saved preset...</option>
                {exportPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
              </select>
            </label>

            <div className="inline-note">
              <span className="muted">
                Create and edit presets in Export Presets. Use this tab to confirm scope and run the current export.
              </span>
            </div>

            <div className="preview-box">
              <p className="eyebrow">Preset Summary</p>
              <div className="preview-summary-grid">
                <DetailRow label="Presets" value={String(exportPresets.length)} />
                <DetailRow label="Type" value={exportSettings.imageType.toUpperCase()} />
                <DetailRow
                  label="Size"
                  value={`${exportSettings.width || "Auto"} x ${exportSettings.height || "Auto"}`}
                />
                <DetailRow
                  label="CLI"
                  value={exportSettings.darktableCliPath ? "Configured" : "Not set"}
                />
              </div>
            </div>

            <label>
              <span>Output folder override</span>
              <div className="input-with-button">
                <input
                  value={exportSettings.outputPath}
                  onChange={(event) =>
                    onExportSettingsChange((current) => ({ ...current, outputPath: event.target.value }))
                  }
                  placeholder="Choose an export output folder"
                />
                <button className="ghost" onClick={() => onPickExportPath("outputPath")}>Browse</button>
              </div>
            </label>

            <label className="checkbox-row">
              <span>Metadata-only run</span>
              <input
                type="checkbox"
                checked={exportSettings.skipExport}
                onChange={(event) =>
                  onExportSettingsChange((current) => ({ ...current, skipExport: event.target.checked }))
                }
              />
            </label>

            <div className="inspector-section-header compact-section-header">
              <div>
                <h3>Export Scope</h3>
                <p className="muted">Refine the current export run without editing the preset itself.</p>
              </div>
            </div>

            <div className="split-fields">
              <label>
                <span>Minimum rating</span>
                <select
                  value={exportFilters.rating ?? ""}
                  onChange={(event) =>
                    onExportFiltersChange((current) => ({
                      ...current,
                      rating: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                >
                  <option value="">Any rating</option>
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                </select>
              </label>

              <label>
                <span>Color label</span>
                <select
                  value={exportFilters.colorLabel}
                  onChange={(event) =>
                    onExportFiltersChange((current) => ({ ...current, colorLabel: event.target.value }))
                  }
                >
                  <option value="">Any label</option>
                  {colorLabelOptions.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Export tags</span>
              <div className="tag-entry-row">
                <input
                  list="available-tags"
                  value={exportTagDraft}
                  onChange={(event) => onExportTagDraftChange(event.target.value)}
                  placeholder="Optional export filter tags"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onAddExportTag(exportTagDraft);
                    }
                  }}
                />
                <button className="ghost" onClick={() => onAddExportTag(exportTagDraft)}>Add</button>
              </div>
              <div className="tag-chip-row">
                {exportFilters.tags.map((tag) => (
                  <button
                    type="button"
                    className="tag-chip tag-chip-button"
                    key={tag}
                    onClick={() => onRemoveExportTag(tag)}
                  >
                    {tag} x
                  </button>
                ))}
              </div>
            </label>

            <div className="preview-box">
              <p className="eyebrow">Export Summary</p>
              <div className="preview-summary-grid">
                <DetailRow label="Selected" value={String(selectedIds.length)} />
                <DetailRow
                  label="Tag Filters"
                  value={exportFilters.tags.length ? String(exportFilters.tags.length) : "None"}
                />
                <DetailRow
                  label="Rating"
                  value={exportFilters.rating ? `${exportFilters.rating}+ stars` : "Any"}
                />
                <DetailRow
                  label="Color"
                  value={exportFilters.colorLabel || "Any"}
                />
              </div>
              {exportStatus ? <p className="write-status">{exportStatus}</p> : null}
            </div>

            <div className="action-row export-actions">
              <button
                disabled={!connection.libraryDbPath || exportInProgress}
                onClick={onRunExport}
              >
                {exportInProgress ? "Exporting..." : "Run Export"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
