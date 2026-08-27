import { useState } from "react";

export function useLibraryOverlayState() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [searchTagsOpen, setSearchTagsOpen] = useState(false);

  const [selectedTagPath, setSelectedTagPath] = useState("");
  const [newRootTagName, setNewRootTagName] = useState("");
  const [tagChildName, setTagChildName] = useState("");
  const [tagRenameValue, setTagRenameValue] = useState("");
  const [tagMoveParent, setTagMoveParent] = useState("");
  const [tagStatus, setTagStatus] = useState("");

  function resetTagManagerState() {
    setSelectedTagPath("");
    setNewRootTagName("");
    setTagChildName("");
    setTagRenameValue("");
    setTagMoveParent("");
    setTagStatus("");
  }

  return {
    settingsOpen,
    setSettingsOpen,
    tagManagerOpen,
    setTagManagerOpen,
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
  };
}
