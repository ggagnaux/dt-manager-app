export type ConnectionState = {
  libraryDbPath: string;
  dataDbPath: string;
  status: "unknown" | "ready" | "read_only" | "write_blocked";
  detail: string;
};

export type ImageRecord = {
  id: number;
  filename: string;
  folder: string;
  sourcePath?: string;
  xmpPath?: string;
  thumbnailUrl?: string;
  captureDate?: string;
  title: string;
  description: string;
  creator?: string;
  rights?: string;
  notes?: string;
  rating: number;
  colorLabel: string;
  tags: string[];
  hierarchicalTags?: string[];
};

export type TagNode = {
  id: string;
  name: string;
  path: string;
  children?: TagNode[];
};

export type PendingEdit = {
  mode: "add" | "remove" | "replace";
  tags: string[];
  title: string;
  description: string;
  rating: number | null;
  colorLabel: string | null;
};

export type WorkerResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type WritePlanPreview = {
  summary: string;
  affectedCount: number;
  imageCount: number;
  xmpMissingCount: number;
  changes: {
    tagsAdded: number;
    tagsRemoved: number;
    titleChanges: number;
    descriptionChanges: number;
    ratingChanges: number;
    colorLabelChanges: number;
  };
  imagePlans: Array<{
    imageId: number;
    filename: string;
    addedTags: string[];
    removedTags: string[];
    fieldChanges: string[];
    willCreateXmp: boolean;
  }>;
};

export type ApplyEditsResult = {
  summary: string;
  writtenCount: number;
  dbSyncStatus: "not_started" | "pending" | "synced";
  pendingJobId?: string;
  items: Array<{
    imageId: number;
    filename: string;
    xmpPath: string;
    dbSyncPending: boolean;
  }>;
};

export type PendingDbSyncJob = {
  jobId: string;
  libraryDbPath: string;
  dataDbPath: string;
  imageIds: number[];
  reason: string;
};

export type RetryPendingDbSyncResult = {
  summary: string;
  retriedCount: number;
  remainingCount: number;
  failures: Array<{
    jobId: string;
    error: string;
  }>;
};

export type ExportSettings = {
  outputPath: string;
  imageType: string;
  width: string;
  height: string;
  skipExport: boolean;
  darktableCliPath: string;
};

export type ExportPreset = {
  name: string;
  settings: ExportSettings;
};

export type ExportFilterSettings = {
  tags: string[];
  rating: number | null;
  colorLabel: string;
};

export type ExportRunResult = {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
};

export type SearchFilters = {
  text: string;
  folder: string;
  dateFrom: string;
  dateTo: string;
  rating: number | null;
  colorLabel: string;
  tags: string[];
  limit: number;
};

export type LibrarySourceKey = "all" | "selected" | "recent" | "unassigned" | "series";

export type LibrarySeriesSource = {
  key: string;
  label: string;
  count: number;
  tagPath: string;
};

export type LibrarySeriesRecord = LibrarySeriesSource & {
  order: number;
  status: "active" | "archived";
  sourceKind: "derived" | "local";
  displayLabel?: string;
  description: string;
  coverFilename: string;
  imageFilenames: string[];
};

export type PersistedLocalSeries = {
  key: string;
  label: string;
  tagPath: string;
  description: string;
  coverFilename: string;
  status: "active" | "archived";
  displayLabel?: string;
};

export type SeriesAdminState = {
  order: string[];
  metadata: Record<string, {
    description?: string;
    coverFilename?: string;
    status?: "active" | "archived";
    displayLabel?: string;
  }>;
  localSeries: PersistedLocalSeries[];
};
