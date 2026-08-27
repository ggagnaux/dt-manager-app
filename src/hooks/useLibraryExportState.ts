import { useEffect, useState } from "react";
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
      return JSON.parse(raw) as ExportSettings;
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
    setExportSettings(preset.settings);
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
