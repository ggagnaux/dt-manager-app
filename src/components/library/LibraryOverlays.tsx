import {
  ExportStatusModal,
  SearchTagsModal,
} from "./LibraryModals";
import type {
  ExportRunResult,
} from "../../types";

export function LibraryOverlays({
  availableTags,
  filtersTags,
  exportDialogOpen,
  searchTagsOpen,
  exportStatus,
  exportLog,
  exportInProgress,
  onCloseExportDialog,
  onCloseSearchTags,
  onSearchTagsChange,
  onClearSearchTags,
}: {
  availableTags: string[];
  filtersTags: string[];
  exportDialogOpen: boolean;
  searchTagsOpen: boolean;
  exportStatus: string;
  exportLog: ExportRunResult | null;
  exportInProgress: boolean;
  onCloseExportDialog: () => void;
  onCloseSearchTags: () => void;
  onSearchTagsChange: (nextTags: string[]) => void;
  onClearSearchTags: () => void;
}) {
  return (
    <>
      <datalist id="available-tags">
        {availableTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      {exportDialogOpen ? (
        <ExportStatusModal
          exportStatus={exportStatus}
          exportLog={exportLog}
          inProgress={exportInProgress}
          onClose={onCloseExportDialog}
        />
      ) : null}

      {searchTagsOpen ? (
        <SearchTagsModal
          availableTags={availableTags}
          selectedTags={filtersTags}
          onClose={onCloseSearchTags}
          onChange={onSearchTagsChange}
          onClear={onClearSearchTags}
        />
      ) : null}
    </>
  );
}
