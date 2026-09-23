import type { Dispatch, SetStateAction } from "react";
import type { ExportPreset, ExportSettings } from "../types";

export function ExportPresetsView({
  exportPresets,
  exportPresetName,
  exportSettings,
  exportStatus,
  onExportPresetNameChange,
  onExportSettingsChange,
  onLoadExportPreset,
  onSaveExportPreset,
  onPickExportPath,
  onRefreshExportPresets,
}: {
  exportPresets: ExportPreset[];
  exportPresetName: string;
  exportSettings: ExportSettings;
  exportStatus: string;
  onExportPresetNameChange: Dispatch<SetStateAction<string>>;
  onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
  onLoadExportPreset: (name: string) => void;
  onSaveExportPreset: () => void;
  onPickExportPath: (field: "outputPath" | "darktableCliPath") => Promise<void>;
  onRefreshExportPresets: () => Promise<void>;
}) {
  return (
    <div className="placeholder-view export-presets-view">
      <div className="placeholder-card screen-shell export-presets-card">
        <div className="panel-header screen-shell-header">
          <div>
            <p className="eyebrow">Export Presets</p>
            <h2>Manage reusable export recipes</h2>
            <p className="screen-shell-intro muted">
              Keep preset maintenance here so the Library export tab can stay focused on final-step execution.
            </p>
          </div>
          <span className="screen-shell-count muted">{exportPresets.length} saved</span>
        </div>

        <div className="export-presets-layout">
          <div className="panel export-presets-list-panel">
            <div className="panel-header">
              <h3>Saved Presets</h3>
              <button type="button" className="ghost" onClick={() => void onRefreshExportPresets()}>Refresh</button>
            </div>
            {exportPresets.length > 0 ? (
              <div className="export-presets-list" role="list" aria-label="Export presets">
                {exportPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    className={`series-list-item ${exportPresetName === preset.name ? "series-list-item-active" : "ghost"}`}
                    onClick={() => {
                      onExportPresetNameChange(preset.name);
                      onLoadExportPreset(preset.name);
                    }}
                  >
                    <div className="series-list-meta">
                      <strong>{preset.name}</strong>
                      <span className="muted">
                        {preset.settings.imageType || "image"} / {preset.settings.width || "auto"} x {preset.settings.height || "auto"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state-panel screen-empty-state">
                <p className="eyebrow">No Presets</p>
                <h3>No export presets have been saved yet</h3>
                <p className="muted">Create a preset on the right to reuse export recipes across Library runs.</p>
              </div>
            )}
          </div>

          <div className="panel export-presets-editor-panel">
            <div className="panel-header">
              <h3>Preset Details</h3>
              <span className="muted">{exportPresetName.trim() || "Unsaved preset"}</span>
            </div>

            <label>
              <span>Preset Name</span>
              <input
                value={exportPresetName}
                onChange={(event) => onExportPresetNameChange(event.target.value)}
                placeholder="Preset name"
              />
            </label>

            <label>
              <span>Output Folder</span>
              <div className="input-with-button">
                <input
                  value={exportSettings.outputPath}
                  onChange={(event) => onExportSettingsChange((current) => ({ ...current, outputPath: event.target.value }))}
                  placeholder="Choose an export output folder"
                />
                <button type="button" className="ghost" onClick={() => void onPickExportPath("outputPath")}>Browse</button>
              </div>
            </label>

            <div className="split-fields">
              <label>
                <span>Image Type</span>
                <input
                  value={exportSettings.imageType}
                  onChange={(event) => onExportSettingsChange((current) => ({ ...current, imageType: event.target.value }))}
                  placeholder="jpg"
                />
              </label>
              <label>
                <span>Darktable CLI Path</span>
                <div className="input-with-button">
                  <input
                    value={exportSettings.darktableCliPath}
                    onChange={(event) => onExportSettingsChange((current) => ({ ...current, darktableCliPath: event.target.value }))}
                    placeholder="darktable-cli"
                  />
                  <button type="button" className="ghost" onClick={() => void onPickExportPath("darktableCliPath")}>Browse</button>
                </div>
              </label>
            </div>

            <div className="split-fields">
              <label>
                <span>Width</span>
                <input
                  value={exportSettings.width}
                  onChange={(event) => onExportSettingsChange((current) => ({ ...current, width: event.target.value }))}
                  placeholder="Auto"
                />
              </label>
              <label>
                <span>Height</span>
                <input
                  value={exportSettings.height}
                  onChange={(event) => onExportSettingsChange((current) => ({ ...current, height: event.target.value }))}
                  placeholder="Auto"
                />
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={exportSettings.skipExport}
                onChange={(event) => onExportSettingsChange((current) => ({ ...current, skipExport: event.target.checked }))}
              />
              <span>Metadata only (skip image export)</span>
            </label>

            <label className="checkbox-row">
              <span>Clear folder before export</span>
              <input
                type="checkbox"
                checked={exportSettings.clearFolderBeforeExport ?? false}
                onChange={(event) => onExportSettingsChange((current) => ({ ...current, clearFolderBeforeExport: event.target.checked }))}
              />
            </label>

            <div className="series-action-row">
              <button type="button" onClick={onSaveExportPreset}>Save Preset</button>
            </div>

            {exportStatus ? <p className="write-status">{exportStatus}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
