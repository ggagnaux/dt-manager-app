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
import type {
  ConnectionState,
  ExportSettings,
  ImageRecord,
  LibrarySeriesRecord,
  LibrarySeriesSource,
  LibrarySourceKey,
} from "../types";

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

const COLOR_LABEL_OPTIONS = [
  { value: "", label: "No label marker" },
  { value: "red", label: "ðŸ”´ Red" },
  { value: "yellow", label: "ðŸŸ¡ Yellow" },
  { value: "green", label: "ðŸŸ¢ Green" },
  { value: "blue", label: "ðŸ”µ Blue" },
  { value: "purple", label: "ðŸŸ£ Purple" },
] as const;

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
    theme: "dark" | "light";
    onPickDatabasePath: (field: "libraryDbPath" | "dataDbPath") => Promise<void>;
    onPickExportPath: (field: "outputPath" | "darktableCliPath") => Promise<void>;
    onConnectionChange: Dispatch<SetStateAction<ConnectionState>>;
    onExportSettingsChange: Dispatch<SetStateAction<ExportSettings>>;
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
  const [selectedIds, setSelectedIds] = useState<number[]>([1]);
  const [thumbnailLayout, setThumbnailLayout] = useState<"grid" | "rows">("grid");
  const [activeSource, setActiveSource] = useState<LibrarySourceKey>("all");
  const [activeSeriesSourceKey, setActiveSeriesSourceKey] = useState<string | null>(null);
  const [activeSavedPivotKey, setActiveSavedPivotKey] = useState<string | null>(null);
  const [browserSearchQuery, setBrowserSearchQuery] = useState("");
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
    refreshLibraryData,
    handleRefreshResults,
    handleResetFilters,
    resetSearchState,
  } = useLibrarySearchState({
    initialImages: mockImages,
    onImagesLoaded: (nextImages) => {
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
    const normalizedQuery = browserSearchQuery.trim().toLocaleLowerCase();
    const filteredImages = normalizedQuery
      ? visibleImages.filter((image) => {
        const haystack = [
          image.title,
          image.filename,
          image.folder,
          image.description,
          image.creator,
          image.rights,
          image.tags.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return haystack.includes(normalizedQuery);
      })
      : visibleImages;

    return [...filteredImages].sort((left, right) => {
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
  }, [browserSearchQuery, browserSort, visibleImages]);
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
    (browserVisibleImages[0] ?? visibleImages[0] ?? images[0] ?? null);
  const {
    pendingEdit,
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
    onRefreshLibraryData: refreshLibraryData,
  });
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

  const handleInspectLibrary = useCallback(async () => {
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
  }, [connection.dataDbPath, connection.libraryDbPath, refreshLibraryData]);

  useEffect(() => {
    onActionsChange?.({
      isConnected,
      onConnectOrRefresh: () => void handleInspectLibrary(),
    });
  }, [handleInspectLibrary, isConnected, onActionsChange]);

  useEffect(() => {
    onSettingsBridgeChange?.({
      connection,
      exportSettings,
      theme,
      onPickDatabasePath: pickDatabasePath,
      onPickExportPath: pickExportPath,
      onConnectionChange: setConnection,
      onExportSettingsChange: setExportSettings,
      onThemeChange: setTheme,
    });
  }, [
    connection,
    exportSettings,
    onSettingsBridgeChange,
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
        const rangeIds = visibleImages.slice(start, end + 1).map((image) => image.id);
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

  function handleDisconnect() {
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
        connection={connection}
        workerMessage={workerMessage}
        pendingDbSyncJobs={pendingDbSyncJobs}
        selectedTagPath={selectedTagPath}
        availableTagCount={availableTags.length}
        tagStatus={tagStatus}
        isConnected={isConnected}
        imageCount={browserVisibleImages.length}
        totalImageCount={images.length}
        selectedCount={selectedIds.length}
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
        <section className={`content-grid ${!isConnected ? "panel-locked" : ""}`}>
          <LibraryResults
            images={browserVisibleImages}
            selectedIds={visibleSelectedIds}
            thumbnailLayout={thumbnailLayout}
            isConnected={isConnected}
            title={browserTitle}
            sourceLabel={activeSavedPivotKey ? "Saved Pivot" : activeSource === "series" ? "Series View" : "Library View"}
            searchQuery={browserSearchQuery}
            sortValue={browserSort}
            onSelectAllToggle={() => {
              lastSelectedIndexRef.current = browserVisibleImages.length > 0 ? 0 : null;
              setSelectedIds((current) =>
                browserVisibleImages.length > 0 && browserVisibleImages.every((image) => current.includes(image.id))
                  ? current.filter((id) => !browserVisibleImages.some((image) => image.id === id))
                  : Array.from(new Set([...current, ...browserVisibleImages.map((image) => image.id)])),
              );
            }}
            onSearchQueryChange={setBrowserSearchQuery}
            onClearSearchQuery={() => setBrowserSearchQuery("")}
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
        </section>
      </main>
      <LibraryOverlays
        availableTags={availableTags}
        filtersTags={filters.tags}
        exportDialogOpen={exportDialogOpen}
        searchTagsOpen={searchTagsOpen}
        exportStatus={exportStatus}
        exportLog={exportLog}
        exportInProgress={exportInProgress}
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
