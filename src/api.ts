import { invoke } from "@tauri-apps/api/core";
import type {
  ApplyEditsResult,
  ConnectionState,
  ExportPreset,
  ExportRunResult,
  ImageRecord,
  PendingEdit,
  PendingDbSyncJob,
  SeriesAdminState,
  SearchFilters,
  RetryPendingDbSyncResult,
  WritePlanPreview,
  WorkerResponse,
} from "./types";

export async function defaultDarktablePaths(): Promise<
  WorkerResponse<{ libraryDbPath: string; dataDbPath: string }>
> {
  return invoke("default_darktable_paths");
}

export async function pingWorker(): Promise<WorkerResponse<{ message: string }>> {
  return invoke("worker_ping");
}

export async function inspectLibrary(
  libraryDbPath: string,
  dataDbPath: string,
): Promise<WorkerResponse<ConnectionState>> {
  return invoke("worker_inspect_library", { libraryDbPath, dataDbPath });
}

export async function searchImages(
  libraryDbPath: string,
  dataDbPath: string,
  filters: SearchFilters,
): Promise<WorkerResponse<ImageRecord[]>> {
  return invoke("worker_search_images", { libraryDbPath, dataDbPath, filters });
}

export async function previewWritePlan(
  libraryDbPath: string,
  dataDbPath: string,
  imageIds: number[],
  edit: PendingEdit,
): Promise<WorkerResponse<WritePlanPreview>> {
  return invoke("worker_preview_write_plan", { libraryDbPath, dataDbPath, imageIds, edit });
}

export async function listTags(
  libraryDbPath: string,
  dataDbPath: string,
): Promise<WorkerResponse<string[]>> {
  return invoke("worker_list_tags", { libraryDbPath, dataDbPath });
}

export async function applyMetadataEdits(
  libraryDbPath: string,
  dataDbPath: string,
  imageIds: number[],
  edit: PendingEdit,
): Promise<WorkerResponse<ApplyEditsResult>> {
  return invoke("worker_apply_metadata_edits", { libraryDbPath, dataDbPath, imageIds, edit });
}

export async function listPendingDbSync(): Promise<WorkerResponse<PendingDbSyncJob[]>> {
  return invoke("worker_list_pending_db_sync");
}

export async function retryPendingDbSync(): Promise<WorkerResponse<RetryPendingDbSyncResult>> {
  return invoke("worker_retry_pending_db_sync");
}

export async function runExport(
  libraryDbPath: string,
  dataDbPath: string,
  payload: Record<string, unknown>,
): Promise<WorkerResponse<ExportRunResult>> {
  return invoke("worker_run_export", { libraryDbPath, dataDbPath, payload });
}

export async function listExportPresets(): Promise<WorkerResponse<ExportPreset[]>> {
  return invoke("worker_list_export_presets");
}

export async function saveExportPreset(
  name: string,
  settings: Record<string, unknown>,
): Promise<WorkerResponse<ExportPreset[]>> {
  return invoke("worker_save_export_preset", { name, settings });
}

export async function manageTag(
  libraryDbPath: string,
  dataDbPath: string,
  action: string,
  tagPath: string,
  value: string,
): Promise<WorkerResponse<{ summary: string }>> {
  return invoke("worker_manage_tag", { libraryDbPath, dataDbPath, action, tagPath, value });
}

export async function listSeriesAdminState(): Promise<WorkerResponse<SeriesAdminState>> {
  return invoke("worker_list_series_admin_state");
}

export async function saveSeriesAdminState(state: SeriesAdminState): Promise<WorkerResponse<SeriesAdminState>> {
  return invoke("worker_save_series_admin_state", { state });
}
