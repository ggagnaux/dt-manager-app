import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import {
  listExportPresets,
  runExport,
  saveExportPreset,
} from "../api";
import { collectExportSourcePaths } from "../components/library/libraryUtils";
import type {
  ConnectionState,
  ExportFilterSettings,
  ExportPreset,
  ExportRunResult,
  ExportSettings,
  ImageRecord,
} from "../types";
import type { Dispatch, SetStateAction } from "react";

const initialExportSettings: ExportSettings = {
  outputPath: "",
  imageType: "jpg",
  width: "",
  height: "",
  skipExport: false,
  clearFolderBeforeExport: false,
  darktableCliPath: "",
};

const initialExportFilters: ExportFilterSettings = {
  tags: [],
  rating: null,
  colorLabel: "",
};

export type ExportPresetBridge = {
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
};

export function useLibraryExportState({
  connection,
  images,
  selectedIds,
}: {
  connection: ConnectionState;
  images: ImageRecord[];
  selectedIds: number[];
}) {
  const [exportSettings, setExportSettings] = useState<ExportSettings>(() => {
    const raw = window.localStorage.getItem("dt-manager-export-settings");
    if (raw) {
      try { return { ...initialExportSettings, ...JSON.parse(raw) }; } catch { return initialExportSettings; }
    }
    return initialExportSettings;
  });
  const [exportFilters, setExportFilters] = useState<ExportFilterSettings>(initialExportFilters);
  const [exportPresets, setExportPresets] = useState<ExportPreset[]>([]);
  const [exportPresetName, setExportPresetName] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportLog, setExportLog] = useState<ExportRunResult | null>(null);
  const [exportTagDraft, setExportTagDraft] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportInProgress, setExportInProgress] = useState(false);
  const exportRunning = useRef(false);

  useEffect(() => {
    window.localStorage.setItem("dt-manager-export-settings", JSON.stringify(exportSettings));
  }, [exportSettings]);

  async function refreshExportPresets() {
    const response = await listExportPresets();
    if (response.ok && response.data) {
      setExportPresets(response.data);
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
    setExportSettings({ ...initialExportSettings, ...preset.settings });
    setExportStatus(`Loaded export preset '${name}'.`);
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

  async function handleRunExport() {
    if (exportRunning.current) return;
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
    exportRunning.current = true;
    setExportInProgress(true);
    setExportLog(null);
    setExportStatus(`Preparing export for ${sourcePaths.length} image(s)...`);

    try {
      const payload = {
        ...exportSettings,
        rating: exportFilters.rating,
        colorLabel: exportFilters.colorLabel,
        tags: exportFilters.tags.filter(Boolean),
        sourcePaths,
      };
      let response = await runExport(connection.libraryDbPath, connection.dataDbPath, payload);
      if (response.ok && response.data?.confirmationRequired) {
        const destination = response.data.destinationPath;
        if (!destination) throw new Error("Unable to verify the export destination.");
        setExportStatus("Waiting for permission to clear the destination folder...");
        const approved = await confirm(
          `The destination folder currently contains files. Do you wish to clear out this folder first?\n\nThis will delete all files directly in the destination folder:\n${destination}\n\nPress Ok to delete the files and export. Press Cancel to abort.`,
          { title: "Clear export folder", kind: "warning", okLabel: "Ok", cancelLabel: "Cancel" },
        );
        if (!approved) {
          setExportStatus("Export cancelled. No destination files were removed.");
          return;
        }
        setExportStatus(`Preparing export for ${sourcePaths.length} image(s)...`);
        response = await runExport(connection.libraryDbPath, connection.dataDbPath, {
          ...payload, outputPath: destination, clearFolderBeforeExport: true,
        });
      }

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
      exportRunning.current = false;
      setExportInProgress(false);
    }
  }

  function resetExportState() {
    setExportStatus("");
    setExportLog(null);
    setExportDialogOpen(false);
    setExportInProgress(false);
  }

  return {
    exportSettings,
    setExportSettings,
    exportFilters,
    setExportFilters,
    exportPresets,
    exportPresetName,
    setExportPresetName,
    exportStatus,
    setExportStatus,
    exportLog,
    exportTagDraft,
    setExportTagDraft,
    exportDialogOpen,
    setExportDialogOpen,
    exportInProgress,
    exportFiltersTags: exportFilters.tags,
    refreshExportPresets,
    handleSaveExportPreset,
    handleLoadExportPreset,
    addExportTag,
    removeExportTag,
    handleRunExport,
    resetExportState,
  };
}
