import { useEffect, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  applyMetadataEdits,
  defaultDarktablePaths,
  inspectLibrary,
  listExportPresets,
  listTags,
  listPendingDbSync,
  manageTag,
  pingWorker,
  previewWritePlan,
  retryPendingDbSync,
  runExport,
  saveExportPreset,
  searchImages,
} from "./api";
import type {
  ConnectionState,
  ExportFilterSettings,
  ExportPreset,
  ExportRunResult,
  ExportSettings,
  ImageRecord,
  PendingEdit,
  PendingDbSyncJob,
  SearchFilters,
  TagNode,
  WritePlanPreview,
} from "./types";

const mockImages: ImageRecord[] = [
  {
    id: 1,
    filename: "HEX-404.jpg",
    folder: "H:\\Images\\2024\\Illustrations\\Orbs",
    title: "HEX-404: Adaptive Shell",
    description: "Specimen metadata preview from XMP.",
    rating: 5,
    colorLabel: "green",
    tags: ["Illustration", "Portfolio", "series|Orbs"],
  },
  {
    id: 2,
    filename: "HEX-298.jpg",
    folder: "H:\\Images\\2024\\Illustrations\\Orbs",
    title: "HEX-298: Night Bloom",
    description: "Secondary mock record for initial UI scaffolding.",
    rating: 4,
    colorLabel: "blue",
    tags: ["Illustration", "Portfolio", "series|Orbs|Blue"],
  },
];

const initialEdit: PendingEdit = {
  mode: "add",
  tags: ["Portfolio"],
  title: "",
  description: "",
  rating: null,
  colorLabel: null,
};

const initialSearchFilters: SearchFilters = {
  text: "",
  folder: "",
  dateFrom: "",
  dateTo: "",
  rating: null,
  colorLabel: "",
  tags: [],
  limit: 120,
};

const COLOR_LABEL_OPTIONS = [
  { value: "", label: "No label marker" },
  { value: "red", label: "🔴 Red" },
  { value: "yellow", label: "🟡 Yellow" },
  { value: "green", label: "🟢 Green" },
  { value: "blue", label: "🔵 Blue" },
  { value: "purple", label: "🟣 Purple" },
] as const;

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("dt-manager-theme");
    return stored === "light" ? "light" : "dark";
  });
  const [workerMessage, setWorkerMessage] = useState("Connecting to worker...");
  const [images, setImages] = useState<ImageRecord[]>(mockImages);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({
    libraryDbPath: "",
    dataDbPath: "",
    status: "unknown",
    detail: "No library selected yet.",
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([1]);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit>(initialEdit);
  const [filters, setFilters] = useState<SearchFilters>(initialSearchFilters);
  const [planPreview, setPlanPreview] = useState<WritePlanPreview | null>(null);
  const [planPreviewMessage, setPlanPreviewMessage] = useState("Preview changes before saving.");
  const [writeStatus, setWriteStatus] = useState("");
  const [pendingDbSyncJobs, setPendingDbSyncJobs] = useState<PendingDbSyncJob[]>([]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(() => {
    const raw = window.localStorage.getItem("dt-manager-export-settings");
    if (raw) {
      return JSON.parse(raw) as ExportSettings;
    }
    return {
      outputPath: "",
      imageType: "jpg",
      width: "",
      height: "",
      skipExport: false,
      darktableCliPath: "",
    };
  });
  const [exportFilters, setExportFilters] = useState<ExportFilterSettings>({
    tags: [],
    rating: null,
    colorLabel: "",
  });
  const [exportPresets, setExportPresets] = useState<ExportPreset[]>([]);
  const [exportPresetName, setExportPresetName] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportLog, setExportLog] = useState<ExportRunResult | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [exportTagDraft, setExportTagDraft] = useState("");
  const [selectedTagPath, setSelectedTagPath] = useState("");
  const [newRootTagName, setNewRootTagName] = useState("");
  const [tagChildName, setTagChildName] = useState("");
  const [tagRenameValue, setTagRenameValue] = useState("");
  const [tagMoveParent, setTagMoveParent] = useState("");
  const [tagStatus, setTagStatus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbnailLayout, setThumbnailLayout] = useState<"grid" | "rows">("grid");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportInProgress, setExportInProgress] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [searchTagsOpen, setSearchTagsOpen] = useState(false);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const shiftPressedRef = useRef(false);
  const isConnected = connection.status === "ready" && Boolean(connection.libraryDbPath);
  const hasImages = images.length > 0;
  const hasSelection = selectedIds.length > 0;
  const selectedImage =
    images.find((image) => image.id === selectedIds[0]) ??
    (images.length > 0 ? images[0] : null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("dt-manager-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("dt-manager-export-settings", JSON.stringify(exportSettings));
  }, [exportSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftPressedRef.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftPressedRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      shiftPressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    defaultDarktablePaths()
      .then((response) => {
        if (!response.ok || !response.data) {
          return;
        }
        const defaults = response.data;
        setConnection((current) => ({
          ...current,
          libraryDbPath: current.libraryDbPath || defaults.libraryDbPath,
          dataDbPath: current.dataDbPath || defaults.dataDbPath,
        }));
      })
      .catch(() => {
        // Leave fields empty if default path discovery fails.
      });

    pingWorker()
      .then((response) => {
        if (response.ok && response.data) {
          setWorkerMessage(response.data.message);
          return;
        }
        setWorkerMessage(response.error ?? "Worker unavailable.");
      })
      .catch((error: unknown) => {
        setWorkerMessage(error instanceof Error ? error.message : "Worker unavailable.");
      });
    void refreshPendingDbSyncJobs();
    void refreshExportPresets();
  }, []);

  async function handleInspectLibrary() {
    const response = await inspectLibrary(connection.libraryDbPath, connection.dataDbPath);
    if (response.ok && response.data) {
      setConnection(response.data);
      void refreshLibraryData(response.data.libraryDbPath, response.data.dataDbPath);
      return;
    }

    setConnection((current) => ({
      ...current,
      status: "write_blocked",
      detail: response.error ?? "Failed to inspect Darktable library.",
    }));
  }

  async function pickDatabasePath(field: "libraryDbPath" | "dataDbPath") {
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [
        {
          name: "SQLite Database",
          extensions: ["db", "sqlite", "sqlite3"],
        },
      ],
    });

    if (typeof selected === "string") {
      setConnection((current) => ({
        ...current,
        [field]: selected,
      }));
    }
  }

  async function handlePreviewPlan() {
    if (!connection.libraryDbPath) {
      setPlanPreview(null);
      setPlanPreviewMessage("Connect to a Darktable library before previewing changes.");
      return;
    }

    const response = await previewWritePlan(
      connection.libraryDbPath,
      connection.dataDbPath,
      selectedIds,
      pendingEdit,
    );
    if (response.ok && response.data) {
      setPlanPreview(response.data);
      setPlanPreviewMessage(
        `${response.data.summary} (${response.data.affectedCount} of ${response.data.imageCount} image(s))`,
      );
      return;
    }
    setPlanPreview(null);
    setPlanPreviewMessage(response.error ?? "Unable to build write preview.");
  }

  async function handleApplyEdits() {
    if (!connection.libraryDbPath) {
      setWriteStatus("Connect to a Darktable library before applying edits.");
      return;
    }

    const response = await applyMetadataEdits(
      connection.libraryDbPath,
      connection.dataDbPath,
      selectedIds,
      pendingEdit,
    );

    if (response.ok && response.data) {
      setWriteStatus(response.data.summary);
      await refreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
      await handlePreviewPlan();
      await refreshPendingDbSyncJobs();
      return;
    }

    setWriteStatus(response.error ?? "Failed to apply metadata edits.");
  }

  async function refreshPendingDbSyncJobs() {
    const response = await listPendingDbSync();
    if (response.ok && response.data) {
      setPendingDbSyncJobs(response.data);
    }
  }

  async function handleRetryPendingDbSync() {
    const response = await retryPendingDbSync();
    if (response.ok && response.data) {
      setWriteStatus(response.data.summary);
      await refreshPendingDbSyncJobs();
      if (connection.libraryDbPath) {
        await refreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
      }
      return;
    }
    setWriteStatus(response.error ?? "Failed to retry pending DB sync jobs.");
  }

  async function pickExportPath(field: "outputPath" | "darktableCliPath") {
    const selected = await open({
      directory: field === "outputPath",
      multiple: false,
    });

    if (typeof selected === "string") {
      setExportSettings((current) => ({
        ...current,
        [field]: selected,
      }));
    }
  }

  function handleSaveExportPreset() {
    const name = exportPresetName.trim();
    if (!name) {
      setExportStatus("Enter a preset name before saving.");
      return;
    }
    void saveExportPreset(name, exportSettings).then((response) => {
      if (response.ok && response.data) {
        setExportPresets(response.data);
        setExportStatus(`Saved export preset '${name}'.`);
        return;
      }
      setExportStatus(response.error ?? "Failed to save export preset.");
    });
  }

  function handleLoadExportPreset(name: string) {
    const preset = exportPresets.find((item) => item.name === name);
    if (!preset) {
      return;
    }
    setExportSettings(preset.settings);
    setExportStatus(`Loaded export preset '${name}'.`);
  }

  async function refreshExportPresets() {
    const response = await listExportPresets();
    if (response.ok && response.data) {
      setExportPresets(response.data);
    }
  }

  async function handleRunExport() {
    if (!connection.libraryDbPath || !exportSettings.outputPath) {
      setExportStatus("Connect to Darktable and choose an export output path first.");
      setExportDialogOpen(true);
      return;
    }

    const sourcePaths = collectExportSourcePaths(images, selectedIds, exportFilters);
    if (sourcePaths.length === 0) {
      setExportStatus("No matching source images are available for export.");
      setExportLog(null);
      setExportDialogOpen(true);
      return;
    }

    setExportDialogOpen(true);
    setExportInProgress(true);
    setExportLog(null);
    setExportStatus(`Preparing export for ${sourcePaths.length} image(s)...`);

    try {
      const response = await runExport(connection.libraryDbPath, connection.dataDbPath, {
        ...exportSettings,
        rating: exportFilters.rating,
        colorLabel: exportFilters.colorLabel,
        tags: exportFilters.tags.filter(Boolean),
        sourcePaths,
      });

      if (response.ok && response.data) {
        setExportLog(response.data);
        setExportStatus(
          `${response.data.success ? "Export completed" : "Export failed"} (exit ${response.data.exitCode}).`,
        );
        return;
      }

      setExportLog(null);
      setExportStatus(response.error ?? "Export failed to start.");
    } catch (error: unknown) {
      setExportLog(null);
      setExportStatus(error instanceof Error ? error.message : "Export failed to start.");
    } finally {
      setExportInProgress(false);
    }
  }

  async function refreshLibraryData(libraryDbPath: string, dataDbPath: string) {
    const [tagResponse, imageResponse] = await Promise.all([
      listTags(libraryDbPath, dataDbPath),
      searchImages(libraryDbPath, dataDbPath, filters),
    ]);

    if (tagResponse.ok && tagResponse.data) {
      setAvailableTags(tagResponse.data);
    }

    if (imageResponse.ok && imageResponse.data) {
      setImages(imageResponse.data);
      setSelectedIds(imageResponse.data[0] ? [imageResponse.data[0].id] : []);
      lastSelectedIndexRef.current = imageResponse.data[0] ? 0 : null;
    }
  }

  async function handleRefreshResults() {
    if (!connection.libraryDbPath) {
      return;
    }
    await refreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
  }

  function handleResetFilters() {
    setFilters(initialSearchFilters);
    setImages([]);
    setSelectedIds([]);
    lastSelectedIndexRef.current = null;
    setPlanPreview(null);
    setPlanPreviewMessage("Preview changes before saving.");
  }

  function handleThumbnailSelection(
    imageId: number,
    index: number,
    modifiers: { shiftKey: boolean; toggleKey: boolean },
  ) {
    setSelectedIds((current) => {
      const anchorIndex = lastSelectedIndexRef.current;
      const shouldRangeSelect = shiftPressedRef.current && anchorIndex !== null;
      if (shouldRangeSelect) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);
        const rangeIds = images.slice(start, end + 1).map((image) => image.id);
        return rangeIds;
      }

      lastSelectedIndexRef.current = index;
      if (modifiers.toggleKey) {
        return current.includes(imageId)
          ? current.filter((id) => id !== imageId)
          : [...current, imageId];
      }

      return [imageId];
    });
  }

  async function handleTagAction(action: "create_root" | "create_child" | "rename" | "move") {
    if (!connection.libraryDbPath) {
      setTagStatus("Connect to a Darktable library before managing tags.");
      return;
    }

    const value =
      action === "create_root" ? newRootTagName :
      action === "create_child" ? tagChildName :
      action === "rename" ? tagRenameValue :
      tagMoveParent;

    const response = await manageTag(
      connection.libraryDbPath,
      connection.dataDbPath,
      action,
      selectedTagPath,
      value,
    );
    if (response.ok && response.data) {
      setTagStatus(response.data.summary);
      setNewRootTagName("");
      setTagChildName("");
      setTagRenameValue("");
      setTagMoveParent("");
      await refreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
      return;
    }
    setTagStatus(response.error ?? "Tag operation failed.");
  }

  function addPendingEditTag(tag: string) {
    const normalized = tag.trim();
    if (!normalized) {
      return;
    }
    setPendingEdit((current) => ({
      ...current,
      tags: Array.from(new Set([...current.tags, normalized])).sort((a, b) => a.localeCompare(b)),
    }));
    setTagDraft("");
  }

  function removePendingEditTag(tag: string) {
    setPendingEdit((current) => ({
      ...current,
      tags: current.tags.filter((value) => value !== tag),
    }));
  }

  function addExportTag(tag: string) {
    const normalized = tag.trim();
    if (!normalized) {
      return;
    }
    setExportFilters((current) => ({
      ...current,
      tags: Array.from(new Set([...current.tags, normalized])).sort((a, b) => a.localeCompare(b)),
    }));
    setExportTagDraft("");
  }

  function removeExportTag(tag: string) {
    setExportFilters((current) => ({
      ...current,
      tags: current.tags.filter((value) => value !== tag),
    }));
  }

  function handleDisconnect() {
    setConnection((current) => ({
      ...current,
      status: "unknown",
      detail: "Disconnected from Darktable library.",
    }));
    setImages([]);
    setAvailableTags([]);
    setSelectedIds([]);
    lastSelectedIndexRef.current = null;
    setSelectedTagPath("");
    setPendingDbSyncJobs([]);
    setPlanPreview(null);
    setPlanPreviewMessage("Preview changes before saving.");
    setWriteStatus("");
    setExportStatus("");
    setExportLog(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="panel-header">
            <div>
              <p className="eyebrow">DT Manager</p>
              <h1>Metadata cockpit for Darktable.</h1>
            </div>
            <button className="ghost" onClick={() => setSettingsOpen(true)}>Settings</button>
          </div>
          <p className="lede">
            Search, tag, batch-edit, and export without fighting the database.
          </p>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2>Connection</h2>
            <span className={`status-pill status-${connection.status}`}>{connection.status}</span>
          </div>
          <div className="settings-summary">
            <DetailRow label="library.db" value={shortenPath(connection.libraryDbPath || "Not configured")} />
            <DetailRow label="data.db" value={shortenPath(connection.dataDbPath || "Not configured")} />
          </div>
          <div className="action-row">
            <button onClick={handleInspectLibrary}>Connect</button>
            <button className="ghost" disabled={!isConnected} onClick={handleDisconnect}>Disconnect</button>
          </div>
          <p className="muted">{connection.detail}</p>
          <p className="worker-state">{workerMessage}</p>
          <div className="pending-sync-bar">
            <span>{pendingDbSyncJobs.length} pending DB sync job(s)</span>
            <button
              className="ghost"
              disabled={pendingDbSyncJobs.length === 0}
              onClick={handleRetryPendingDbSync}
            >
              Retry Pending Sync
            </button>
          </div>
        </section>

        <section className={`panel ${!isConnected ? "panel-locked" : ""}`}>
          <div className="panel-header">
            <h2>Tags</h2>
            <span className="muted">{selectedTagPath || "No tag selected"}</span>
          </div>
          <div className="settings-summary">
            <DetailRow label="Selected Tag" value={selectedTagPath || "None"} />
            <DetailRow label="Available Tags" value={String(availableTags.length)} />
          </div>
          <button className="ghost" onClick={() => setTagManagerOpen(true)}>Open Tag Manager</button>
          {tagStatus ? <p className="write-status">{tagStatus}</p> : null}
          {!isConnected ? <div className="panel-lock-overlay">Connect to Darktable to browse and manage tags.</div> : null}
        </section>
      </aside>

      <main className={`workspace ${!isConnected ? "workspace-locked" : ""}`}>
        <section className={`panel export-panel ${!isConnected ? "panel-locked" : ""}`}>
          <div className="panel-header">
            <h2>Export</h2>
            <span className="muted">Uses `dt-export-meta` from this workspace.</span>
          </div>
          <div className="export-grid">
            <label>
              <span>Preset Name</span>
              <input
                value={exportPresetName}
                onChange={(event) => setExportPresetName(event.target.value)}
                placeholder="Portfolio JPG"
              />
            </label>
            <label>
              <span>Load Preset</span>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    handleLoadExportPreset(event.target.value);
                  }
                }}
              >
                <option value="">Choose preset</option>
                {exportPresets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Export Tags</span>
              <div className="tag-entry-row">
                <input
                  list="available-tags"
                  value={exportTagDraft}
                  onChange={(event) => setExportTagDraft(event.target.value)}
                  placeholder="Portfolio or series|Orbs"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addExportTag(exportTagDraft);
                    }
                  }}
                />
                <button className="ghost" onClick={() => addExportTag(exportTagDraft)}>
                  Add
                </button>
              </div>
              <div className="tag-chip-row">
                {exportFilters.tags.map((tag) => (
                  <button
                    type="button"
                    className="tag-chip tag-chip-button"
                    key={tag}
                    onClick={() => removeExportTag(tag)}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            </label>
            <label>
              <span>Export Rating</span>
              <select
                value={exportFilters.rating ?? ""}
                onChange={(event) =>
                  setExportFilters((current) => ({
                    ...current,
                    rating: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              >
                <option value="">Any rating</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
                <option value="0">0</option>
              </select>
            </label>
            <label>
              <span>Export Color Label</span>
              <select
                value={exportFilters.colorLabel}
                onChange={(event) =>
                  setExportFilters((current) => ({ ...current, colorLabel: event.target.value }))
                }
              >
                <option value="">Any label</option>
                {COLOR_LABEL_OPTIONS.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Output Folder</span>
              <input
                value={exportSettings.outputPath}
                onChange={(event) =>
                  setExportSettings((current) => ({ ...current, outputPath: event.target.value }))
                }
                placeholder="Export output folder"
              />
            </label>
            <label>
              <span>Image Type</span>
              <select
                value={exportSettings.imageType}
                onChange={(event) =>
                  setExportSettings((current) => ({ ...current, imageType: event.target.value }))
                }
              >
                <option value="jpg">jpg</option>
                <option value="png">png</option>
                <option value="webp">webp</option>
                <option value="tif">tif</option>
              </select>
            </label>
            <label>
              <span>Width</span>
              <input
                value={exportSettings.width}
                onChange={(event) =>
                  setExportSettings((current) => ({ ...current, width: event.target.value }))
                }
                placeholder="Optional width"
              />
            </label>
            <label>
              <span>Height</span>
              <input
                value={exportSettings.height}
                onChange={(event) =>
                  setExportSettings((current) => ({ ...current, height: event.target.value }))
                }
                placeholder="Optional height"
              />
            </label>
            <label className="checkbox-row">
              <span>Skip export and rebuild metadata only</span>
              <input
                type="checkbox"
                checked={exportSettings.skipExport}
                onChange={(event) =>
                  setExportSettings((current) => ({ ...current, skipExport: event.target.checked }))
                }
              />
            </label>
          </div>
          <p className="muted">
            Export uses the selected images when you have a selection, otherwise the current result set. Dedicated
            export filters narrow that list before `dt-export-meta` runs.
          </p>
          <div className="inline-actions">
            <span className="muted">
              CLI path: {exportSettings.darktableCliPath || "System PATH"}
            </span>
            <div className="action-row export-actions">
              <button className="ghost" onClick={handleSaveExportPreset}>Save Preset</button>
              <button onClick={handleRunExport}>Run Export</button>
            </div>
          </div>
          {exportStatus ? <p className="write-status">{exportStatus}</p> : null}
          {exportLog ? (
            <div className="export-log">
              <p className="eyebrow">Export Log</p>
              <p className="muted">Command: {exportLog.command.join(" ")}</p>
              <label>
                <span>stdout</span>
                <textarea readOnly value={exportLog.stdout || "(no stdout)"} />
              </label>
              <label>
                <span>stderr</span>
                <textarea readOnly value={exportLog.stderr || "(no stderr)"} />
              </label>
            </div>
          ) : null}
          {!isConnected ? <div className="panel-lock-overlay">Connect to configure and run exports.</div> : null}
        </section>

        <section className={`filter-row ${!isConnected ? "panel-locked" : ""}`}>
          <div className="filter-row-top">
            <input
              placeholder="Search filename or folder..."
              value={filters.text}
              onChange={(event) =>
                setFilters((current) => ({ ...current, text: event.target.value }))
              }
            />
            <select
              value={filters.rating ?? ""}
              onChange={(event) =>
                setFilters((current) => ({
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
                setFilters((current) => ({ ...current, colorLabel: event.target.value }))
              }
            >
              <option value="">All labels</option>
              {COLOR_LABEL_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
                        <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((current) => ({ ...current, dateFrom: event.target.value }))
              }
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((current) => ({ ...current, dateTo: event.target.value }))
              }
            />
            <input
              placeholder="Folder filter"
              value={filters.folder}
              onChange={(event) =>
                setFilters((current) => ({ ...current, folder: event.target.value }))
              }
            />
                      </div>
          <div className="filter-row-divider" />
          <div className="filter-row-tags">
            <div className="tag-filter-control tag-filter-control-wide">
              <button className="ghost" onClick={() => setSearchTagsOpen(true)}>
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
            <button className="ghost" onClick={handleResetFilters}>
              Reset
            </button>
            <button className="ghost" onClick={handleRefreshResults}>
              Search
            </button>
          </div>
          {!isConnected ? <div className="panel-lock-overlay">Connect to search and select images.</div> : null}
        </section>

        <section className={`content-grid ${!isConnected ? "panel-locked" : ""}`}>
          <div className="results-column">
            <section className={`selection-toolbar ${!isConnected ? "panel-locked" : ""}`}>
              {hasImages ? (
                <>
                  <button
                    className="ghost"
                    onClick={() => {
                      lastSelectedIndexRef.current = images.length > 0 ? 0 : null;
                      setSelectedIds((current) =>
                        images.length > 0 && current.length === images.length
                          ? []
                          : images.map((image) => image.id),
                      );
                    }}
                  >
                    {images.length > 0 && selectedIds.length === images.length ? "Select None" : "Select All"}
                  </button>
                  <div className="segmented-control" role="group" aria-label="Thumbnail layout">
                    <button
                      className={`layout-toggle-button ${thumbnailLayout === "grid" ? "segmented-active" : "ghost"}`}
                      onClick={() => setThumbnailLayout("grid")}
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
                      onClick={() => setThumbnailLayout("rows")}
                      aria-label="Row view"
                    >
                      <span className="layout-icon layout-icon-rows" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <span className="muted">No thumbnails available for selection controls.</span>
              )}
              {!isConnected ? <div className="panel-lock-overlay">Connect to manage selection and layout.</div> : null}
            </section>

            <div className={`image-grid ${thumbnailLayout === "rows" ? "image-grid-rows" : ""}`}>
            {images.map((image, index) => {
              const selected = selectedIds.includes(image.id);
              return (
                <button
                  key={image.id}
                  className={`thumb-card ${thumbnailLayout === "rows" ? "thumb-card-row" : ""} ${selected ? "selected" : ""}`}
                  onClick={(event) =>
                    handleThumbnailSelection(image.id, index, {
                      shiftKey: event.shiftKey,
                      toggleKey: event.ctrlKey || event.metaKey,
                    })
                  }
                >
                  <div className="thumb-art">
                    <PreviewThumb image={image} />
                  </div>
                  <div className="thumb-meta">
                    <strong>{image.title}</strong>
                    <span>{image.filename}</span>
                    <span>{image.tags.join(" · ")}</span>
                  </div>
                </button>
              );
            })}
          </div>
          </div>

          <div className="editor-stack">
            <div className={`editor-panel ${!hasSelection ? "panel-locked" : ""}`}>
              <div className="panel-header">
                <h2>Selection</h2>
                <span className="muted">{selectedIds.length} selected</span>
              </div>

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
                <p className="muted">No image selected.</p>
              )}
              {!hasSelection ? <div className="panel-lock-overlay">Select one or more thumbnails to view details.</div> : null}
            </div>

            <div className={`editor-panel ${!hasSelection ? "panel-locked" : ""}`}>
            <div className="panel-header">
              <h2>Batch Edit</h2>
              <span className="muted">{selectedIds.length} selected</span>
            </div>

            <label>
              <span>Tag action</span>
              <select
                value={pendingEdit.mode}
                onChange={(event) =>
                  setPendingEdit((current) => ({
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
                  onChange={(event) => setTagDraft(event.target.value)}
                  placeholder="Portfolio or series|Orbs"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addPendingEditTag(tagDraft);
                    }
                  }}
                />
                <button className="ghost" onClick={() => addPendingEditTag(tagDraft)}>
                  Add
                </button>
              </div>
              <div className="tag-chip-row">
                {pendingEdit.tags.map((tag) => (
                  <button
                    type="button"
                    className="tag-chip tag-chip-button"
                    key={tag}
                    onClick={() => removePendingEditTag(tag)}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            </label>

            <label>
              <span>Title</span>
              <input
                value={pendingEdit.title}
                onChange={(event) =>
                  setPendingEdit((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Leave blank to keep unchanged"
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                value={pendingEdit.description}
                onChange={(event) =>
                  setPendingEdit((current) => ({ ...current, description: event.target.value }))
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
                    setPendingEdit((current) => ({
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
                    setPendingEdit((current) => ({
                      ...current,
                      colorLabel: event.target.value || null,
                    }))
                  }
                >
                  <option value="">Unchanged</option>
                  {COLOR_LABEL_OPTIONS.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="action-row">
              <button className="ghost" onClick={handlePreviewPlan}>
                Preview Changes
              </button>
              <button
                disabled={!connection.libraryDbPath || selectedIds.length === 0}
                onClick={handleApplyEdits}
              >
                Write XMP Then Sync DB
              </button>
            </div>

            <div className="preview-box">
              <p className="eyebrow">Write Preview</p>
              <p>{planPreviewMessage}</p>
              {writeStatus ? <p className="write-status">{writeStatus}</p> : null}
              <div className="sync-scope-panel compact">
                <p className="eyebrow">Current Save Behavior</p>
                <div className="scope-chip-row">
                  <span className="scope-chip scope-chip-full">Tags sync to DB</span>
                  <span className="scope-chip scope-chip-full">Rating syncs to DB</span>
                  <span className="scope-chip scope-chip-full">Color label syncs to DB</span>
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
                      {plan.addedTags.length ? (
                        <span>Adding: {plan.addedTags.join(", ")}</span>
                      ) : null}
                      {plan.removedTags.length ? (
                        <span>Removing: {plan.removedTags.join(", ")}</span>
                      ) : null}
                      {plan.willCreateXmp ? <span>Will create XMP sidecar</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {!hasSelection ? <div className="panel-lock-overlay">Select thumbnails before batch editing metadata.</div> : null}
            </div>
            </div>
          </div>
          {!isConnected ? <div className="panel-lock-overlay">Connect to view thumbnails and edit metadata.</div> : null}
        </section>
      </main>
      <datalist id="available-tags">
        {availableTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      {settingsOpen ? (
        <SettingsModal
          connection={connection}
          exportSettings={exportSettings}
          theme={theme}
          onClose={() => setSettingsOpen(false)}
          onPickDatabasePath={pickDatabasePath}
          onPickExportPath={pickExportPath}
          onConnectionChange={setConnection}
          onExportSettingsChange={setExportSettings}
          onThemeChange={setTheme}
        />
      ) : null}
      {exportDialogOpen ? (
        <ExportStatusModal
          exportStatus={exportStatus}
          exportLog={exportLog}
          inProgress={exportInProgress}
          onClose={() => setExportDialogOpen(false)}
        />
      ) : null}
      {tagManagerOpen ? (
        <TagManagerModal
          availableTags={availableTags}
          selectedTagPath={selectedTagPath}
          newRootTagName={newRootTagName}
          tagChildName={tagChildName}
          tagRenameValue={tagRenameValue}
          tagMoveParent={tagMoveParent}
          tagStatus={tagStatus}
          onClose={() => setTagManagerOpen(false)}
          onSelectTag={setSelectedTagPath}
          onNewRootTagNameChange={setNewRootTagName}
          onTagChildNameChange={setTagChildName}
          onTagRenameValueChange={setTagRenameValue}
          onTagMoveParentChange={setTagMoveParent}
          onTagAction={handleTagAction}
        />
      ) : null}
      {searchTagsOpen ? (
        <SearchTagsModal
          availableTags={availableTags}
          selectedTags={filters.tags}
          onClose={() => setSearchTagsOpen(false)}
          onChange={(nextTags) =>
            setFilters((current) => ({
              ...current,
              tags: nextTags,
            }))
          }
          onClear={() =>
            setFilters((current) => ({
              ...current,
              tags: [],
            }))
          }
        />
      ) : null}
    </div>
  );
}

function TagTree({
  nodes,
  selectedTagPath,
  expandedTagPaths,
  onSelect,
  onToggleExpand,
}: {
  nodes: TagNode[];
  selectedTagPath: string;
  expandedTagPaths: string[];
  onSelect: (value: string) => void;
  onToggleExpand: (value: string) => void;
}) {
  return (
    <ul className="tag-tree">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="tag-tree-row">
            {node.children && node.children.length > 0 ? (
              <button
                type="button"
                className="tag-tree-toggle"
                onClick={() => onToggleExpand(node.path)}
              >
                {expandedTagPaths.includes(node.path) ? "−" : "+"}
              </button>
            ) : (
              <span className="tag-tree-spacer" />
            )}
            <button
              type="button"
              className={`tag-tree-button ${selectedTagPath === node.path ? "selected" : ""}`}
              onClick={() => onSelect(node.path)}
            >
              {node.path}
            </button>
          </div>
          {node.children && node.children.length > 0 && expandedTagPaths.includes(node.path) ? (
            <TagTree
              nodes={node.children}
              selectedTagPath={selectedTagPath}
              expandedTagPaths={expandedTagPaths}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function buildTagTree(tags: string[]): TagNode[] {
  const rootNodes: TagNode[] = [];

  for (const tag of tags) {
    const segments = tag.split("|").filter(Boolean);
    let currentNodes = rootNodes;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}|${segment}` : segment;
      let node = currentNodes.find((candidate) => candidate.name === segment);
      if (!node) {
        node = {
          id: currentPath,
          name: segment,
          path: currentPath,
          children: [],
        };
        currentNodes.push(node);
      }
      if (!node.children) {
        node.children = [];
      }
      currentNodes = node.children;
    }
  }

  return normalizeChildren(rootNodes);
}

function normalizeChildren(nodes: TagNode[]): TagNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children && node.children.length > 0 ? normalizeChildren(node.children) : undefined,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function DetailRow({
  label,
  value,
  scope,
  valueNode,
}: {
  label: string;
  value: string;
  scope?: "db+xmp" | "xmp";
  valueNode?: ReactNode;
}) {
  return (
    <div className="detail-row">
      <span>
        {label}
        {scope ? (
          <em className={`detail-scope detail-scope-${scope === "db+xmp" ? "full" : "xmp"}`}>
            {scope === "db+xmp" ? "XMP + DB" : "XMP only"}
          </em>
        ) : null}
      </span>
      <strong>{valueNode ?? (value || " ")}</strong>
    </div>
  );
}

function ColorLabelValue({ value }: { value: string }) {
  if (!value) {
    return <>None</>;
  }

  return (
    <span className="color-label-value">
      <span className={`color-label-dot color-${value}`} aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}

function PreviewThumb({ image }: { image: ImageRecord }) {
  const previewable = image.sourcePath
    && /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(image.sourcePath);

  if (previewable && image.sourcePath) {
    return (
      <img
        className="thumb-image"
        src={convertFileSrc(image.sourcePath)}
        alt={image.filename}
      />
    );
  }

  const extension = image.filename.includes(".")
    ? image.filename.split(".").pop()?.toUpperCase() ?? "IMG"
    : "IMG";
  const title = image.title?.trim() || image.filename;

  return (
    <div className="raw-preview-card">
      <div className="raw-preview-top">
        <span className="raw-preview-ext">{extension}</span>
        {image.colorLabel ? (
          <span className={`raw-preview-color color-${image.colorLabel}`} aria-hidden="true" />
        ) : null}
      </div>
      <div className="raw-preview-body">
        <strong>{title}</strong>
        <span>{image.filename}</span>
      </div>
      <div className="raw-preview-footer">
        <span>{renderStars(image.rating)}</span>
        <span>{image.xmpPath ? "XMP linked" : "No XMP"}</span>
      </div>
    </div>
  );
}

function renderStars(rating: number) {
  if (!rating) {
    return "Unrated";
  }
  return "★".repeat(Math.max(0, Math.min(5, rating)));
}

function collectExportSourcePaths(
  images: ImageRecord[],
  selectedIds: number[],
  exportFilters: ExportFilterSettings,
): string[] {
  const selectedSet = new Set(selectedIds);
  const baseImages = selectedSet.size > 0
    ? images.filter((image) => selectedSet.has(image.id))
    : images;

  return baseImages
    .filter((image) => matchesExportFilters(image, exportFilters))
    .map((image) => image.sourcePath?.trim() ?? "")
    .filter(Boolean);
}

function matchesExportFilters(image: ImageRecord, exportFilters: ExportFilterSettings): boolean {
  if (exportFilters.rating !== null && image.rating !== exportFilters.rating) {
    return false;
  }

  if (exportFilters.colorLabel && image.colorLabel !== exportFilters.colorLabel) {
    return false;
  }

  if (exportFilters.tags.length === 0) {
    return true;
  }

  return exportFilters.tags.every((tag) => imageMatchesTag(image, tag));
}

function imageMatchesTag(image: ImageRecord, requestedTag: string): boolean {
  const normalized = requestedTag.trim().toLocaleLowerCase();
  if (!normalized) {
    return true;
  }

  const flatTags = image.tags.map((tag) => tag.toLocaleLowerCase());
  if (flatTags.includes(normalized)) {
    return true;
  }

  const hierarchicalTags = (image.hierarchicalTags ?? []).map((tag) => tag.toLocaleLowerCase());
  return hierarchicalTags.some((tag) => tag === normalized || tag.startsWith(`${normalized}|`));
}

function SettingsModal({
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

function ExportStatusModal({
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
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card export-status-modal" role="dialog" aria-modal="true">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Export Status</p>
            <h2>{inProgress ? "Export in progress" : "Export finished"}</h2>
          </div>
          <button className="ghost" disabled={inProgress} onClick={onClose}>Close</button>
        </div>
        <div className="modal-section">
          <div className={`status-banner ${inProgress ? "status-banner-running" : "status-banner-complete"}`}>
            <span className={`status-dot ${inProgress ? "status-dot-running" : "status-dot-complete"}`} />
            <strong>{exportStatus || (inProgress ? "Running export..." : "Waiting for export updates.")}</strong>
          </div>
          {inProgress ? <p className="muted">DT Manager is waiting for `dt-export-meta` to finish.</p> : null}
          {exportLog ? (
            <div className="export-log">
              <p className="muted">Command: {exportLog.command.join(" ")}</p>
              <label>
                <span>stdout</span>
                <textarea readOnly value={exportLog.stdout || "(no stdout)"} />
              </label>
              <label>
                <span>stderr</span>
                <textarea readOnly value={exportLog.stderr || "(no stderr)"} />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TagManagerModal({
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

function SearchTagsModal({
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

function shortenPath(value: string): string {
  if (!value || value === "Not configured" || value.length <= 42) {
    return value;
  }

  const normalized = value.split("\\").join("/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const prefix = normalized.startsWith("/") ? "/" : "";
    return `${prefix}.../${parts.slice(-2).join("/")}`;
  }

  return `${value.slice(0, 18)}...${value.slice(-18)}`;
}
