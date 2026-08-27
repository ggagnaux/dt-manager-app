import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AppTopBar } from "./components/layout/AppTopBar";
import type { AppView } from "./app-shell";
import type { ExportPresetBridge } from "./hooks/useLibraryExportState";
import { LibraryView } from "./views/LibraryView";
import { ExportPresetsView } from "./views/ExportPresetsView";
import { PlaceholderView } from "./views/PlaceholderView";
import { SeriesView } from "./views/SeriesView";
import { SettingsView } from "./views/SettingsView";
import { TagsView } from "./views/TagsView";
import type { ConnectionState, ExportSettings, LibrarySeriesRecord } from "./types";

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("library");
  const [libraryStatus, setLibraryStatus] = useState<{
    connectionStatus: "unknown" | "ready" | "read_only" | "write_blocked";
    connectionDetail: string;
    libraryPath: string;
    pendingSyncCount: number;
    workerMessage: string;
  } | null>(null);
  const [libraryActions, setLibraryActions] = useState<{
    isConnected: boolean;
    onConnectOrRefresh: () => void;
  } | null>(null);
  const [librarySettingsBridge, setLibrarySettingsBridge] = useState<{
    connection: ConnectionState;
    exportSettings: ExportSettings;
    theme: "dark" | "light";
    onPickDatabasePath: (field: "libraryDbPath" | "dataDbPath") => Promise<void>;
    onPickExportPath: (field: "outputPath" | "darktableCliPath") => Promise<void>;
    onConnectionChange: Dispatch<SetStateAction<ConnectionState>>;
    onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
    onThemeChange: Dispatch<SetStateAction<"dark" | "light">>;
  } | null>(null);
  const [libraryTagsBridge, setLibraryTagsBridge] = useState<{
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
  } | null>(null);
  const [librarySeriesBridge, setLibrarySeriesBridge] = useState<{
    series: LibrarySeriesRecord[];
    activeSeriesKey: string | null;
    onOpenSeries: (seriesKey: string) => void;
  } | null>(null);
  const [libraryExportPresetsBridge, setLibraryExportPresetsBridge] = useState<ExportPresetBridge | null>(null);

  return (
    <div className="app-root">
      <AppTopBar
        activeView={activeView}
        onChangeView={setActiveView}
        libraryStatus={libraryStatus ?? undefined}
        libraryActions={libraryActions ?? undefined}
      />

      <section className="app-view-frame">
        <div className={activeView === "library" ? "" : "app-view-hidden"}>
          <LibraryView
            onStatusChange={setLibraryStatus}
            onActionsChange={setLibraryActions}
            onSettingsBridgeChange={setLibrarySettingsBridge}
            onTagsBridgeChange={setLibraryTagsBridge}
            onSeriesBridgeChange={setLibrarySeriesBridge}
            onExportPresetsBridgeChange={setLibraryExportPresetsBridge}
          />
        </div>
        {activeView === "series" ? (
          librarySeriesBridge ? (
            <SeriesView
              series={librarySeriesBridge.series}
              activeSeriesKey={librarySeriesBridge.activeSeriesKey}
              onOpenSeries={(seriesKey) => {
                librarySeriesBridge.onOpenSeries(seriesKey);
                setActiveView("library");
              }}
            />
          ) : (
            <PlaceholderView
              title="Series"
              description="Series are loading from the live Library workspace."
            />
          )
        ) : null}
        {activeView === "tags" ? (
          libraryTagsBridge ? (
            <TagsView
              availableTags={libraryTagsBridge.availableTags}
              selectedTagPath={libraryTagsBridge.selectedTagPath}
              newRootTagName={libraryTagsBridge.newRootTagName}
              tagChildName={libraryTagsBridge.tagChildName}
              tagRenameValue={libraryTagsBridge.tagRenameValue}
              tagMoveParent={libraryTagsBridge.tagMoveParent}
              tagStatus={libraryTagsBridge.tagStatus}
              onSelectTag={libraryTagsBridge.onSelectTag}
              onNewRootTagNameChange={libraryTagsBridge.onNewRootTagNameChange}
              onTagChildNameChange={libraryTagsBridge.onTagChildNameChange}
              onTagRenameValueChange={libraryTagsBridge.onTagRenameValueChange}
              onTagMoveParentChange={libraryTagsBridge.onTagMoveParentChange}
              onTagAction={libraryTagsBridge.onTagAction}
            />
          ) : (
            <PlaceholderView
              title="Tags"
              description="Tags are loading from the live Library workspace."
            />
          )
        ) : null}
        {activeView === "export-presets" ? (
          libraryExportPresetsBridge ? (
            <ExportPresetsView
              exportPresets={libraryExportPresetsBridge.exportPresets}
              exportPresetName={libraryExportPresetsBridge.exportPresetName}
              exportSettings={libraryExportPresetsBridge.exportSettings}
              exportStatus={libraryExportPresetsBridge.exportStatus}
              onExportPresetNameChange={libraryExportPresetsBridge.onExportPresetNameChange}
              onExportSettingsChange={libraryExportPresetsBridge.onExportSettingsChange}
              onLoadExportPreset={libraryExportPresetsBridge.onLoadExportPreset}
              onSaveExportPreset={libraryExportPresetsBridge.onSaveExportPreset}
              onPickExportPath={libraryExportPresetsBridge.onPickExportPath}
              onRefreshExportPresets={libraryExportPresetsBridge.onRefreshExportPresets}
            />
          ) : (
            <PlaceholderView
              title="Export Presets"
              description="Export presets are loading from the live Library workspace."
            />
          )
        ) : null}
        {activeView === "settings" ? (
          librarySettingsBridge ? (
            <SettingsView
              connection={librarySettingsBridge.connection}
              exportSettings={librarySettingsBridge.exportSettings}
              theme={librarySettingsBridge.theme}
              onPickDatabasePath={librarySettingsBridge.onPickDatabasePath}
              onPickExportPath={librarySettingsBridge.onPickExportPath}
              onConnectionChange={librarySettingsBridge.onConnectionChange}
              onExportSettingsChange={librarySettingsBridge.onExportSettingsChange}
              onThemeChange={librarySettingsBridge.onThemeChange}
            />
          ) : (
            <PlaceholderView
              title="Settings"
              description="Settings are loading from the live Library workspace."
            />
          )
        ) : null}
      </section>
    </div>
  );
}
