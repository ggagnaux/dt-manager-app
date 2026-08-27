import type { Dispatch, SetStateAction } from "react";
import type { ConnectionState, ExportSettings } from "../types";

export function SettingsView({
  connection,
  exportSettings,
  theme,
  onPickDatabasePath,
  onPickExportPath,
  onConnectionChange,
  onExportSettingsChange,
  onThemeChange,
}: {
  connection: ConnectionState;
  exportSettings: ExportSettings;
  theme: "dark" | "light";
  onPickDatabasePath: (field: "libraryDbPath" | "dataDbPath") => Promise<void>;
  onPickExportPath: (field: "outputPath" | "darktableCliPath") => Promise<void>;
  onConnectionChange: Dispatch<SetStateAction<ConnectionState>>;
  onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
  onThemeChange: Dispatch<SetStateAction<"dark" | "light">>;
}) {
  return (
    <div className="placeholder-view settings-view">
      <div className="placeholder-card screen-shell settings-card">
        <div className="panel-header screen-shell-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Paths, export tools, and appearance</h2>
            <p className="screen-shell-intro muted">
              Keep connection setup, shared export defaults, and appearance controls in one stable admin surface.
            </p>
          </div>
          <span className={`status-pill status-${connection.status}`}>{connection.status}</span>
        </div>

        <div className="settings-layout-grid">
          <section className="panel settings-section-panel">
            <div className="panel-header">
              <h3>Darktable Paths</h3>
              <span className="muted">Connection setup</span>
            </div>
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
            <div className="pending-sync-bar">
              <span>{connection.detail || "Connection details will appear here after you choose a library."}</span>
            </div>
          </section>

          <section className="panel settings-section-panel">
            <div className="panel-header">
              <h3>Export Tooling</h3>
              <span className="muted">Shared defaults</span>
            </div>
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
              <span>Default export folder</span>
              <div className="input-with-button">
                <input
                  value={exportSettings.outputPath}
                  onChange={(event) =>
                    onExportSettingsChange((current) => ({ ...current, outputPath: event.target.value }))
                  }
                  placeholder="Optional default export folder"
                />
                <button className="ghost" onClick={() => void onPickExportPath("outputPath")}>Browse</button>
              </div>
            </label>
          </section>

          <section className="panel settings-section-panel">
            <div className="panel-header">
              <h3>Appearance</h3>
              <span className="muted">Theme</span>
            </div>
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
          </section>
        </div>
      </div>
    </div>
  );
}
