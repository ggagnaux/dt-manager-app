import { useState } from "react";
import {
  applyMetadataEdits,
  listPendingDbSync,
  previewWritePlan,
  retryPendingDbSync,
} from "../api";
import type {
  ConnectionState,
  PendingDbSyncJob,
  PendingEdit,
  WritePlanPreview,
} from "../types";

const initialEdit: PendingEdit = {
  mode: "add",
  tags: ["Portfolio"],
  title: "",
  description: "",
  rating: null,
  colorLabel: null,
};

const initialPlanPreviewMessage = "Preview changes before saving.";

export function useLibraryEditState({
  connection,
  selectedIds,
  onRefreshLibraryData,
}: {
  connection: ConnectionState;
  selectedIds: number[];
  onRefreshLibraryData: (libraryDbPath: string, dataDbPath: string) => Promise<void>;
}) {
  const [pendingEdit, setPendingEdit] = useState<PendingEdit>(initialEdit);
  const [planPreview, setPlanPreview] = useState<WritePlanPreview | null>(null);
  const [planPreviewMessage, setPlanPreviewMessage] = useState(initialPlanPreviewMessage);
  const [writeStatus, setWriteStatus] = useState("");
  const [pendingDbSyncJobs, setPendingDbSyncJobs] = useState<PendingDbSyncJob[]>([]);
  const [tagDraft, setTagDraft] = useState("");

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

  async function refreshPendingDbSyncJobs() {
    const response = await listPendingDbSync();
    if (response.ok && response.data) {
      setPendingDbSyncJobs(response.data);
    }
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
      await onRefreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
      await handlePreviewPlan();
      await refreshPendingDbSyncJobs();
      return;
    }

    setWriteStatus(response.error ?? "Failed to apply metadata edits.");
  }

  async function handleRetryPendingDbSync() {
    const response = await retryPendingDbSync();
    if (response.ok && response.data) {
      setWriteStatus(response.data.summary);
      await refreshPendingDbSyncJobs();
      if (connection.libraryDbPath) {
        await onRefreshLibraryData(connection.libraryDbPath, connection.dataDbPath);
      }
      return;
    }
    setWriteStatus(response.error ?? "Failed to retry pending DB sync jobs.");
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

  function resetEditState() {
    setPendingEdit(initialEdit);
    setPlanPreview(null);
    setPlanPreviewMessage(initialPlanPreviewMessage);
    setWriteStatus("");
    setPendingDbSyncJobs([]);
    setTagDraft("");
  }

  return {
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
  };
}
