import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { hasMetadataChanges } from "../components/library/libraryUtils";
import {
  applyMetadataEdits,
  listPendingDbSync,
  previewWritePlan,
  retryPendingDbSync,
} from "../api";
import type {
  ConnectionState,
  ImageRecord,
  PendingDbSyncJob,
  PendingEdit,
  WritePlanPreview,
} from "../types";

const initialEdit: PendingEdit = {
  mode: "add",
  tags: [],
  title: "",
  description: "",
  rating: null,
  colorLabel: null,
};

const initialPlanPreviewMessage = "Preview changes before saving.";

export function useLibraryEditState({
  connection,
  selectedIds,
  selectedImage,
  onRefreshLibraryData,
}: {
  connection: ConnectionState;
  selectedIds: number[];
  selectedImage: ImageRecord | null;
  onRefreshLibraryData: (libraryDbPath: string, dataDbPath: string, preserveSelection?: boolean) => Promise<void>;
}) {
  const [pendingEdit, setPendingEditState] = useState<PendingEdit>(initialEdit);
  const [planPreview, setPlanPreview] = useState<WritePlanPreview | null>(null);
  const [planPreviewMessage, setPlanPreviewMessage] = useState(initialPlanPreviewMessage);
  const [writeStatus, setWriteStatus] = useState("");
  const [pendingDbSyncJobs, setPendingDbSyncJobs] = useState<PendingDbSyncJob[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saveInProgress, setSaveInProgress] = useState(false);
  const savePromise = useRef<Promise<boolean> | null>(null);
  const saveBusy = useRef(false);
  const selectionBusy = useRef(false);
  const currentConnection = useRef("");
  currentConnection.current = JSON.stringify([connection.libraryDbPath, connection.dataDbPath]);
  const setPendingEdit: Dispatch<SetStateAction<PendingEdit>> = update => {
    if (!saveBusy.current) setPendingEditState(update);
  };

  const selectionKey = JSON.stringify([connection.libraryDbPath, connection.dataDbPath, selectedIds]);
  const editImage = selectedIds.length === 1 && selectedImage?.id === selectedIds[0]
    ? selectedImage
    : null;
  const requestVersion = useRef(0);
  const [draftImage, setDraftImage] = useState<ImageRecord | null>(null);

  useEffect(() => {
    setDraftImage(editImage);
    setPendingEditState(editImage ? {
      mode: "replace",
      tags: Array.from(new Set([...editImage.tags, ...(editImage.hierarchicalTags ?? [])])),
      title: editImage.title,
      description: editImage.description,
      rating: editImage.rating,
      colorLabel: editImage.colorLabel,
    } : { ...initialEdit, tags: [] });
    setTagDraft("");
  }, [selectionKey, editImage]);

  useEffect(() => {
    requestVersion.current += 1;
    setPlanPreview(null);
    setPlanPreviewMessage(initialPlanPreviewMessage);
    return () => { requestVersion.current += 1; };
  }, [selectionKey, editImage, pendingEdit]);

  async function handlePreviewPlan() {
    const version = ++requestVersion.current;
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
    if (version !== requestVersion.current) return;
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

  function handleApplyEdits(): Promise<boolean> {
    if (savePromise.current) return savePromise.current;
    if (!connection.libraryDbPath || !selectedIds.length) {
      setWriteStatus("Select an image in a connected library before saving.");
      return Promise.resolve(false);
    }
    // Capture the old selection and draft before any asynchronous work.
    const ids = [...selectedIds];
    const edit = { ...pendingEdit, tags: [...pendingEdit.tags] };
    const { libraryDbPath, dataDbPath } = connection;
    const connectionKey = currentConnection.current;
    saveBusy.current = true;
    setSaveInProgress(true);
    setWriteStatus("Saving changes...");
    const operation = (async () => {
      try {
        const response = await applyMetadataEdits(libraryDbPath, dataDbPath, ids, edit);
        if (connectionKey !== currentConnection.current) return false;
        if (!response.ok || !response.data || response.data.writtenCount !== ids.length) {
          setWriteStatus(response.error || "Changes could not be saved. Your edits have been kept; try Save Changes again.");
          return false;
        }
        const message = response.data.dbSyncStatus === "pending"
          ? "Changes saved to XMP. Database sync is queued for retry."
          : response.data.summary;
        try {
          await onRefreshLibraryData(libraryDbPath, dataDbPath, true);
          await refreshPendingDbSyncJobs();
          setWriteStatus(message);
        } catch {
          setWriteStatus(`${message} The library could not be refreshed; refresh it to see the saved changes.`);
        }
        return connectionKey === currentConnection.current;
      } catch (error) {
        setWriteStatus(error instanceof Error ? error.message : "Unable to save changes. Your edits have been kept.");
        return false;
      } finally {
        saveBusy.current = false;
        savePromise.current = null;
        setSaveInProgress(false);
      }
    })();
    savePromise.current = operation;
    return operation;
  }

  async function requestSelectionChange(nextIds: number[], commit: (ids: number[]) => void): Promise<boolean> {
    if (selectionBusy.current) return false;
    if (nextIds.length === selectedIds.length && nextIds.every((id, index) => id === selectedIds[index])) return true;
    selectionBusy.current = true;
    try {
      const dirty = editImage && draftImage === editImage && hasMetadataChanges(editImage, pendingEdit);
      if ((savePromise.current || dirty) && !await handleApplyEdits()) return false;
      commit(nextIds);
      return true;
    } finally {
      selectionBusy.current = false;
    }
  }

  async function handleRetryPendingDbSync() {
    const response = await retryPendingDbSync();
    if (response.ok && response.data) {
      setWriteStatus(response.data.summary);
      await refreshPendingDbSyncJobs();
      if (connection.libraryDbPath) {
        await onRefreshLibraryData(connection.libraryDbPath, connection.dataDbPath, true);
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
    pendingImageId: editImage && draftImage === editImage && hasMetadataChanges(editImage, pendingEdit)
      ? editImage.id
      : null,
    pendingEdit,
    setPendingEdit,
    saveInProgress,
    requestSelectionChange,
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
