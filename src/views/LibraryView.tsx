import { ResizableInspectorLayout } from "../components/library/ResizableInspectorLayout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  defaultDarktablePaths,
  inspectLibrary,
  manageTag,
  pingWorker,
} from "../api";
import {
  LibraryInspector,
} from "../components/library/LibraryInspector";
import {
  LibraryOverlays,
} from "../components/library/LibraryOverlays";
import {
  LibraryResults,
} from "../components/library/LibraryResults";
import {
  LibrarySidebar,
} from "../components/library/LibrarySidebar";
import {
  imageMatchesTag,
} from "../components/library/libraryUtils";
import {
  useLibraryEditState,
} from "../hooks/useLibraryEditState";
import {
  ExportPresetBridge,
  useLibraryExportState,
} from "../hooks/useLibraryExportState";
import {
  useLibraryOverlayState,
} from "../hooks/useLibraryOverlayState";
import {
  useLibrarySearchState,
} from "../hooks/useLibrarySearchState";
import {
  SEARCH_RESULT_LIMIT_OPTIONS,
} from "../types";
import type {
  ConnectionState,
  ExportSettings,
  ImageRecord,
  LibrarySeriesRecord,
  LibrarySeriesSource,
  LibrarySourceKey,
  SearchSettings,
} from "../types";

const COLOR_LABEL_OPTIONS = [
  { value: "", label: "No label marker" },
  { value: "red", label: "🔴 Red" },
  { value: "yellow", label: "🟡 Yellow" },
  { value: "green", label: "🟢 Green" },
  { value: "blue", label: "🔵 Blue" },
  { value: "purple", label: "🟣 Purple" },
] as const;

function createInitialSearchSettings(): SearchSettings {
  const stored = Number(window.localStorage.getItem("dt-manager-search-result-limit"));
  const resultLimit = SEARCH_RESULT_LIMIT_OPTIONS.includes(stored as typeof SEARCH_RESULT_LIMIT_OPTIONS[number])
    ? stored
    : 500;

  return { resultLimit };
}

function getSeriesTags(image: ImageRecord): string[] {
  return Array.from(
    new Set([
      ...image.tags,
      ...(image.hierarchicalTags ?? []),
    ].filter((tag) => tag.startsWith("series|"))),
  );
}

export function LibraryView({
  onStatusChange,
  onActionsChange,
  onSettingsBridgeChange,
  onTagsBridgeChange,
  onSeriesBridgeChange,
  onExportPresetsBridgeChange,
}: {
  onStatusChange?: (status: {
    connectionStatus: "unknown" | "ready" | "read_only" | "write_blocked";
    connectionDetail: string;
    libraryPath: string;
    pendingSyncCount: number;
    workerMessage: string;
  }) => void;
  onActionsChange?: (actions: {
    isConnected: boolean;
    onConnectOrRefresh: () => void;
  }) => void;
  onSettingsBridgeChange?: (bridge: {
    connection: ConnectionState;
    exportSettings: ExportSettings;
    searchSettings: SearchSettings;
    theme: "dark" | "light";
    onPickDatabasePath: (field: "libraryDbPath" | "dataDbPath") => Promise<void>;
    onPickExportPath: (field: "outputPath" | "darktableCliPath") => Promise<void>;
    onConnectionChange: Dispatch<SetStateAction<ConnectionState>>;
    onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
    onSearchSettingsChange: Dispatch<SetStateAction<SearchSettings>>;
    onThemeChange: Dispatch<SetStateAction<"dark" | "light">>;
  }) => void;
  onTagsBridgeChange?: (bridge: {
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
  }) => void;
  onSeriesBridgeChange?: (bridge: {
    series: LibrarySeriesRecord[];
    activeSeriesKey: string | null;
    onOpenSeries: (seriesKey: string) => void;
  }) => void;
  onExportPresetsBridgeChange?: (bridge: ExportPresetBridge) => void;
}) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("dt-manager-theme");
    return stored === "light" ? "light" : "dark";
  });
  const [workerMessage, setWorkerMessage] = useState("Connecting to worker...");
  const [connection, setConnection] = useState<ConnectionState>({
    libraryDbPath: "",
    dataDbPath: "",
    status: "unknown",
    detail: "No library selected yet.",
  });
  const [searchSettings, setSearchSettings] = useState<SearchSettings>(createInitialSearchSettings);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [thumbnailLayout, setThumbnailLayout] = useState<"grid" | "rows">("grid");
  const [activeSource, setActiveSource] = useState<LibrarySourceKey>("all");
  const [activeSeriesSourceKey, setActiveSeriesSourceKey] = useState<string | null>(null);
  const [activeSavedPivotKey, setActiveSavedPivotKey] = useState<string | null>(null);
  const [browserSort, setBrowserSort] = useState<"capture-desc" | "capture-asc" | "title-asc" | "rating-desc">("capture-desc");
  const lastSelectedIndexRef = useRef<number | null>(null);
  const shiftPressedRef = useRef(false);
  const {
    searchTagsOpen,
    setSearchTagsOpen,
    selectedTagPath,
    setSelectedTagPath,
    newRootTagName,
    setNewRootTagName,
    tagChildName,
    setTagChildName,
    tagRenameValue,
    setTagRenameValue,
    tagMoveParent,
    setTagMoveParent,
    tagStatus,
    setTagStatus,
    resetTagManagerState,
  } = useLibraryOverlayState();
  const isConnected = connection.status === "ready" && Boolean(connection.libraryDbPath);
  const {
    images,
    availableTags,
    filters,
    setFilters,
    queryInProgress,
    queryProgressMessage,
    refreshLibraryMetadata,
    refreshLibraryData,
    handleRefreshResults,
    handleResetFilters,
    resetSearchState,
  } = useLibrarySearchState({
    resultLimit: searchSettings.resultLimit,
    initialImages: [],
    onImagesLoaded: (nextImages, preserveSelection) => {
      if (preserveSelection) {
        const availableIds = new Set(nextImages.map((image) => image.id));
        setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
        return;
      }
      setSelectedIds(nextImages[0] ? [nextImages[0].id] : []);
      lastSelectedIndexRef.current = nextImages[0] ? 0 : null;
    },
    onResetSelection: () => {
      setSelectedIds([]);
      lastSelectedIndexRef.current = null;
    },
  });
  const hasSelection = selectedIds.length > 0;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const seriesSources = useMemo<LibrarySeriesSource[]>(() => {
    const seriesMap = new Map<string, { label: string; tagPath: string; count: number }>();
    images.forEach((image) => {
      getSeriesTags(image).forEach((tag) => {
        const tagPath = tag.replace(/^series\|/, "");
        const label = tagPath.split("|").join(" / ");
        const current = seriesMap.get(tag);
        if (current) {
          current.count += 1;
          return;
        }
        seriesMap.set(tag, {
          label,
          tagPath,
          count: 1,
        });
      });
    });

    return Array.from(seriesMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
        tagPath: value.tagPath,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [images]);
  const pinnedSeriesSources = useMemo(
    () => [...seriesSources].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 3),
    [seriesSources],
  );
  const seriesRecords = useMemo<LibrarySeriesRecord[]>(() => (
    seriesSources.map((series, index) => {
      const seriesImages = images.filter((image) => imageMatchesTag(image, series.key));
      return {
        ...series,
        order: index + 1,
        status: "active",
        sourceKind: "derived",
        description: `Series bucket derived from Darktable tags for ${series.label}.`,
        coverFilename: seriesImages[0]?.filename ?? "No cover selected",
        imageFilenames: seriesImages.slice(0, 6).map((image) => image.filename),
      };
    })
  ), [images, seriesSources]);
  const sourceCounts = useMemo(() => ({
    all: images.length,
    selected: images.filter((image) => selectedIdSet.has(image.id)).length,
    recent: Math.min(images.length, 24),
    unassigned: images.filter((image) => getSeriesTags(image).length === 0).length,
  }), [images, selectedIdSet]);
  const visibleImages = useMemo(() => {
    if (activeSavedPivotKey === "five-stars") {
      return images.filter((image) => image.rating >= 5);
    }

    if (activeSavedPivotKey === "blue-label") {
      return images.filter((image) => image.colorLabel === "blue");
    }

    if (activeSavedPivotKey === "tagged") {
      return images.filter((image) => image.tags.length > 0);
    }

    if (activeSource === "selected") {
      return images.filter((image) => selectedIdSet.has(image.id));
    }

    if (activeSource === "recent") {
      return [...images]
        .sort((left, right) => {
          const leftTime = left.captureDate ? Date.parse(left.captureDate) : 0;
          const rightTime = right.captureDate ? Date.parse(right.captureDate) : 0;
          return rightTime - leftTime || right.id - left.id;
        })
        .slice(0, 24);
    }

    if (activeSource === "unassigned") {
      return images.filter((image) => getSeriesTags(image).length === 0);
    }

    if (activeSource === "series" && activeSeriesSourceKey) {
      return images.filter((image) => imageMatchesTag(image, activeSeriesSourceKey));
    }

    return images;
  }, [activeSavedPivotKey, activeSeriesSourceKey, activeSource, images, selectedIdSet]);
  const browserVisibleImages = useMemo(() => {
    return [...visibleImages].sort((left, right) => {
      if (browserSort === "capture-asc" || browserSort === "capture-desc") {
        const leftTime = left.captureDate ? Date.parse(left.captureDate) : 0;
        const rightTime = right.captureDate ? Date.parse(right.captureDate) : 0;
        const delta = leftTime - rightTime;
        if (delta !== 0) {
          return browserSort === "capture-asc" ? delta : -delta;
        }
        return left.filename.localeCompare(right.filename);
      }

      if (browserSort === "rating-desc") {
        return right.rating - left.rating || left.title.localeCompare(right.title) || left.filename.localeCompare(right.filename);
      }

      return left.title.localeCompare(right.title) || left.filename.localeCompare(right.filename);
    });
  }, [browserSort, visibleImages]);
  useEffect(() => {
    if (selectedIds.length === 1) {
      const index = browserVisibleImages.findIndex((image) => image.id === selectedIds[0]);
      lastSelectedIndexRef.current = index >= 0 ? index : null;
    }
  }, [browserVisibleImages, selectedIds]);
  const visibleSelectedIds = useMemo(
    () => browserVisibleImages.filter((image) => selectedIdSet.has(image.id)).map((image) => image.id),
    [browserVisibleImages, selectedIdSet],
  );
  const currentSeriesSource = useMemo(
    () => seriesSources.find((series) => series.key === activeSeriesSourceKey) ?? null,
    [activeSeriesSourceKey, seriesSources],
  );
  const browserTitle =
    activeSavedPivotKey === "five-stars" ? "Saved Pivot: Five Stars" :
    activeSavedPivotKey === "blue-label" ? "Saved Pivot: Blue Label" :
    activeSavedPivotKey === "tagged" ? "Saved Pivot: Tagged Work" :
    activeSource === "selected" ? "Selected Images" :
    activeSource === "recent" ? "Recent Images" :
    activeSource === "unassigned" ? "Unassigned Images" :
    activeSource === "series" ? `Series: ${currentSeriesSource?.label ?? "Unknown"}` :
    "All Images";
  const selectedImage =
    browserVisibleImages.find((image) => selectedIdSet.has(image.id)) ??
    visibleImages.find((image) => selectedIdSet.has(image.id)) ??
    images.find((image) => image.id === selectedIds[0]) ??
    null;
  const {
    pendingEdit,
    pendingImageId,
    saveInProgress,
    requestSelectionChange,
    setPendingEdit,
    planPreview,
    planPreviewMessage,
    writeStatus,
    pendingDbSyncJobs,
    tagDraft,
    setTagDraft,
    handlePreviewPlan,
    refreshPendingDbSyncJobs,
    handleApplyEdits,
    handleRetryPendingDbSync,
    addPendingEditTag,
    removePendingEditTag,
    resetEditState,
  } = useLibraryEditState({
    connection,
    selectedIds,
    selectedImage,
    onRefreshLibraryData: refreshLibraryData,
  });
  const changedImageIds = useMemo(() => {
    const normalizePath = (path: string) => path.replace(/\\/g, "/").toLocaleLowerCase();
    const ids = new Set<number>();
    pendingDbSyncJobs.forEach((job) => {
      if (normalizePath(job.libraryDbPath) === normalizePath(connection.libraryDbPath)) {
        job.imageIds.forEach((id) => ids.add(id));
      }
    });
    if (pendingImageId !== null) ids.add(pendingImageId);
    return ids;
  }, [connection.libraryDbPath, pendingDbSyncJobs, pendingImageId]);
  const {
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
    refreshExportPresets,
    handleSaveExportPreset,
    handleLoadExportPreset,
    addExportTag,
    removeExportTag,
    handleRunExport,
    resetExportState,
  } = useLibraryExportState({
    connection,
    images,
    selectedIds,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("dt-manager-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("dt-manager-search-result-limit", String(searchSettings.resultLimit));
  }, [searchSettings.resultLimit]);

  useEffect(() => {
    onStatusChange?.({
      connectionStatus: connection.status,
      connectionDetail: connection.detail,
      libraryPath: connection.libraryDbPath,
      pendingSyncCount: pendingDbSyncJobs.length,
      workerMessage,
    });
  }, [
    connection.detail,
    connection.libraryDbPath,
    connection.status,
    onStatusChange,
    pendingDbSyncJobs.length,
    workerMessage,
  ]);

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

  useEffect(() => {
    if (activeSource === "series" && activeSeriesSourceKey && !seriesSources.some((series) => series.key === activeSeriesSourceKey)) {
      setActiveSeriesSourceKey(null);
      setActiveSource("all");
    }
  }, [activeSeriesSourceKey, activeSource, seriesSources]);

  useEffect(() => {
    if (activeSavedPivotKey === "blue-label" && !images.some((image) => image.colorLabel === "blue")) {
      setActiveSavedPivotKey(null);
    }
    if (activeSavedPivotKey === "five-stars" && !images.some((image) => image.rating >= 5)) {
      setActiveSavedPivotKey(null);
    }
    if (activeSavedPivotKey === "tagged" && !images.some((image) => image.tags.length > 0)) {
      setActiveSavedPivotKey(null);
    }
  }, [activeSavedPivotKey, images]);

  useEffect(() => {
    lastSelectedIndexRef.current = null;
  }, [activeSavedPivotKey, activeSeriesSourceKey, activeSource]);

  const handleConnectLibrary = useCallback(async () => {
    if (!connection.libraryDbPath) {
      setConnection((current) => ({
        ...current,
        status: "write_blocked",
        detail: "Choose a Darktable library before connecting.",
      }));
      return;
    }

    resetSearchState();
    const response = await inspectLibrary(connection.libraryDbPath, connection.dataDbPath);
    if (response.ok && response.data) {
      setConnection(response.data);
      await refreshLibraryMetadata(response.data.libraryDbPath, response.data.dataDbPath);
      return;
    }

    setConnection((current) => ({
      ...current,
      status: "write_blocked",
      detail: response.error ?? "Failed to inspect Darktable library.",
    }));
  }, [
    connection.dataDbPath,
    connection.libraryDbPath,
    refreshLibraryMetadata,
    resetSearchState,
  ]);

  const handleDisconnect = useCallback(() => {
    setConnection((current) => ({
      ...current,
      status: "unknown",
      detail: "Disconnected from Darktable library.",
    }));
    resetSearchState();
    resetTagManagerState();
    resetEditState();
    resetExportState();
    setActiveSource("all");
    setActiveSeriesSourceKey(null);
    setActiveSavedPivotKey(null);
  }, [
    resetEditState,
    resetExportState,
    resetSearchState,
    resetTagManagerState,
  ]);

  useEffect(() => {
    onActionsChange?.({
      isConnected,
      onConnectOrRefresh: () => {
        if (isConnected) {
          handleDisconnect();
          return;
        }
        void handleConnectLibrary();
      },
    });
  }, [handleConnectLibrary, handleDisconnect, isConnected, onActionsChange]);

  useEffect(() => {
    onSettingsBridgeChange?.({
      connection,
      exportSettings,
      searchSettings,
      theme,
      onPickDatabasePath: pickDatabasePath,
      onPickExportPath: pickExportPath,
      onConnectionChange: setConnection,
      onExportSettingsChange: setExportSettings,
      onSearchSettingsChange: setSearchSettings,
      onThemeChange: setTheme,
    });
  }, [
    connection,
    exportSettings,
    onSettingsBridgeChange,
    searchSettings,
    theme,
  ]);

  useEffect(() => {
    onTagsBridgeChange?.({
      availableTags,
      selectedTagPath,
      newRootTagName,
      tagChildName,
      tagRenameValue,
      tagMoveParent,
      tagStatus,
      onSelectTag: setSelectedTagPath,
      onNewRootTagNameChange: setNewRootTagName,
      onTagChildNameChange: setTagChildName,
      onTagRenameValueChange: setTagRenameValue,
      onTagMoveParentChange: setTagMoveParent,
      onTagAction: handleTagAction,
    });
  }, [
    availableTags,
    newRootTagName,
    onTagsBridgeChange,
    selectedTagPath,
    setSelectedTagPath,
    setNewRootTagName,
    setTagChildName,
    setTagMoveParent,
    setTagRenameValue,
    tagChildName,
    tagMoveParent,
    tagRenameValue,
      tagStatus,
    ]);

  useEffect(() => {
    onSeriesBridgeChange?.({
      series: seriesRecords,
      activeSeriesKey: activeSeriesSourceKey,
      onOpenSeries: handleSeriesSourceChange,
    });
  }, [activeSeriesSourceKey, onSeriesBridgeChange, seriesRecords]);

  useEffect(() => {
    onExportPresetsBridgeChange?.({
      exportPresets,
      exportPresetName,
      exportSettings,
      exportStatus,
      onExportPresetNameChange: setExportPresetName,
      onExportSettingsChange: setExportSettings,
      onLoadExportPreset: handleLoadExportPreset,
      onSaveExportPreset: handleSaveExportPreset,
      onPickExportPath: pickExportPath,
      onRefreshExportPresets: refreshExportPresets,
    });
  }, [
    exportPresetName,
    exportPresets,
    exportSettings,
    exportStatus,
    handleLoadExportPreset,
    handleSaveExportPreset,
    onExportPresetsBridgeChange,
    refreshExportPresets,
    setExportPresetName,
    setExportSettings,
  ]);

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

  async function handleThumbnailSelection(
    imageId: number,
    index: number,
    modifiers: { shiftKey: boolean; toggleKey: boolean },
  ) {
    const anchorIndex = lastSelectedIndexRef.current;
    const rangeSelect = (modifiers.shiftKey || shiftPressedRef.current) && anchorIndex !== null;
    const nextIds = rangeSelect
      ? browserVisibleImages.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1).map(image => image.id)
      : modifiers.toggleKey
        ? selectedIds.includes(imageId) ? selectedIds.filter(id => id !== imageId) : [...selectedIds, imageId]
        : [imageId];
    if (await requestSelectionChange(nextIds, setSelectedIds) && !rangeSelect) lastSelectedIndexRef.current = index;
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

  function handleSourceChange(source: Exclude<LibrarySourceKey, "series">) {
    setActiveSource(source);
    setActiveSeriesSourceKey(null);
    setActiveSavedPivotKey(null);
  }

  function handleSeriesSourceChange(seriesKey: string) {
    setActiveSource("series");
    setActiveSeriesSourceKey(seriesKey);
    setActiveSavedPivotKey(null);
  }

  function handleSavedPivotChange(pivotKey: string) {
    setActiveSavedPivotKey(pivotKey);
    setActiveSource("all");
    setActiveSeriesSourceKey(null);
  }

  return (
    <div className="app-shell">
      <LibrarySidebar
        pendingDbSyncJobs={pendingDbSyncJobs}
        isConnected={isConnected}
        imageCount={browserVisibleImages.length}
        totalImageCount={images.length}
        selectedCount={selectedIds.length}
        queryInProgress={queryInProgress}
        activeSource={activeSource}
        activeSeriesSourceKey={activeSeriesSourceKey}
        sourceCounts={sourceCounts}
        seriesSources={seriesSources}
        savedPivotCount={3}
        activeSavedPivotKey={activeSavedPivotKey}
        pinnedSeriesSources={pinnedSeriesSources}
        filters={filters}
        colorLabelOptions={COLOR_LABEL_OPTIONS}
        onSourceChange={handleSourceChange}
        onSeriesSourceChange={handleSeriesSourceChange}
        onSavedPivotChange={handleSavedPivotChange}
        onFiltersChange={setFilters}
        onOpenSearchTags={() => setSearchTagsOpen(true)}
        onResetFilters={() => {
          handleResetFilters();
          resetEditState();
        }}
        onSearch={() => void handleRefreshResults(connection)}
      />

      <main className={`workspace ${!isConnected ? "workspace-locked" : ""}`}>
        <ResizableInspectorLayout className={`content-grid ${!isConnected ? "panel-locked" : ""}`}>
          <LibraryResults
            images={browserVisibleImages}
            selectedIds={visibleSelectedIds}
            changedImageIds={changedImageIds}
            thumbnailLayout={thumbnailLayout}
            isConnected={isConnected}
            title={browserTitle}
            sourceLabel={activeSavedPivotKey ? "Saved Pivot" : activeSource === "series" ? "Series View" : "Library View"}
            sortValue={browserSort}
            onSelectAllToggle={() => {
              const nextIds = browserVisibleImages.length > 0 && browserVisibleImages.every(image => selectedIds.includes(image.id))
                ? selectedIds.filter(id => !browserVisibleImages.some(image => image.id === id))
                : Array.from(new Set([...selectedIds, ...browserVisibleImages.map(image => image.id)]));
              void requestSelectionChange(nextIds, ids => {
                setSelectedIds(ids);
                lastSelectedIndexRef.current = browserVisibleImages.length > 0 ? 0 : null;
              });
            }}
            onSortChange={setBrowserSort}
            onThumbnailLayoutChange={setThumbnailLayout}
            onThumbnailSelection={(imageId, index, toggleKey, shiftKey) =>
              handleThumbnailSelection(imageId, index, {
                shiftKey,
                toggleKey,
              })
            }
          />

          <LibraryInspector
            saveInProgress={saveInProgress}
            selectedIds={selectedIds}
            selectedImage={selectedImage}
            hasSelection={hasSelection}
            pendingEdit={pendingEdit}
            tagDraft={tagDraft}
            planPreview={planPreview}
            planPreviewMessage={planPreviewMessage}
            writeStatus={writeStatus}
            connection={connection}
            colorLabelOptions={COLOR_LABEL_OPTIONS}
            exportSettings={exportSettings}
            exportFilters={exportFilters}
            exportPresets={exportPresets}
            exportStatus={exportStatus}
            exportTagDraft={exportTagDraft}
            exportInProgress={exportInProgress}
            onPendingEditChange={setPendingEdit}
            onTagDraftChange={setTagDraft}
            onAddPendingEditTag={addPendingEditTag}
            onRemovePendingEditTag={removePendingEditTag}
            onExportSettingsChange={setExportSettings}
            onExportFiltersChange={setExportFilters}
            onExportTagDraftChange={setExportTagDraft}
            onLoadExportPreset={handleLoadExportPreset}
            onAddExportTag={addExportTag}
            onRemoveExportTag={removeExportTag}
            onPickExportPath={(field) => void pickExportPath(field)}
            onRunExport={() => void handleRunExport()}
            onPreviewPlan={handlePreviewPlan}
            onApplyEdits={handleApplyEdits}
          />
          {!isConnected ? <div className="panel-lock-overlay">Connect to view thumbnails and edit metadata.</div> : null}
        </ResizableInspectorLayout>
      </main>
      <LibraryOverlays
        saveInProgress={saveInProgress}
        availableTags={availableTags}
        filtersTags={filters.tags}
        exportDialogOpen={exportDialogOpen}
        searchTagsOpen={searchTagsOpen}
        exportStatus={exportStatus}
        exportLog={exportLog}
        exportInProgress={exportInProgress}
        queryInProgress={queryInProgress || saveInProgress}
        queryProgressMessage={saveInProgress ? "Saving changes..." : queryProgressMessage}
        onCloseExportDialog={() => setExportDialogOpen(false)}
        onCloseSearchTags={() => setSearchTagsOpen(false)}
        onSearchTagsChange={(nextTags) =>
          setFilters((current) => ({
            ...current,
            tags: nextTags,
          }))
        }
        onClearSearchTags={() =>
          setFilters((current) => ({
            ...current,
            tags: [],
          }))
        }
      />
    </div>
  );
}
