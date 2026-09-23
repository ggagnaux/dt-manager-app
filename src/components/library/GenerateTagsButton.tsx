import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { aiRequest, listTags } from "../../api";
import type { AiSettings } from "../../api";
import type { ConnectionState, ImageRecord, PendingEdit } from "../../types";

export function GenerateTagsButton({ selectedImage, selectedIds, connection, onPendingEditChange }: {
  selectedImage: ImageRecord | null;
  selectedIds: number[];
  connection: ConnectionState;
  onPendingEditChange: Dispatch<SetStateAction<PendingEdit>>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const selectionKey = JSON.stringify([connection.libraryDbPath, connection.dataDbPath, selectedIds, selectedImage?.sourcePath]);
  const enabled = selectedIds.length === 1 && selectedImage?.id === selectedIds[0] && !!connection.libraryDbPath;

  useEffect(() => {
    version.current += 1;
    busy.current = false;
    setGenerating(false);
    setTags([]);
    setChosen([]);
    setStatus("");
    dialog.current?.close();
    return () => { version.current += 1; };
  }, [selectionKey, selectedImage]);

  function dismiss() {
    version.current += 1;
    busy.current = false;
    setGenerating(false);
    dialog.current?.close();
  }

  async function generate() {
    if (!enabled || !selectedImage || busy.current) return;
    dialog.current?.showModal();
    busy.current = true;
    const requestVersion = ++version.current;
    setGenerating(true);
    setFailed(false);
    setTags([]);
    setChosen([]);
    setStatus("Analyzing image colors...");
    try {
      const [result, existing, settings] = await Promise.all([
        aiRequest<{ tags: string[] }>("generate-tags", { sourcePath: selectedImage.sourcePath }),
        listTags(connection.libraryDbPath, connection.dataDbPath),
        aiRequest<AiSettings>("load"),
      ]);
      if (requestVersion !== version.current) return;
      if (!existing.ok || !existing.data) throw new Error(existing.error || "Unable to load existing tags.");
      const known = new Map(existing.data.map(tag => [tag.trim().toLowerCase(), tag]));
      const generated = Array.from(new Set(result.tags.map(tag => known.get(tag.toLowerCase()) ?? tag)));
      setTags(generated);
      setChosen(generated);
      setStatus(generated.length ? "" : "No significant colors were identified.");
      if (settings.applyAiGeneratedTagsImmediately === true && generated.length) {
        applyTags(generated);
      }
    } catch (error) {
      if (requestVersion !== version.current) return;
      setFailed(true);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (requestVersion === version.current) {
        busy.current = false;
        setGenerating(false);
      }
    }
  }

  function apply() {
    if (generating || failed) return;
    applyTags(chosen);
  }

  function applyTags(tagsToApply: string[]) {
    if (!enabled || !selectedImage || !tagsToApply.length) return;
    onPendingEditChange(current => {
      // Preserve the effect of staged removals before adding generated tags.
      const removed = new Set(current.tags.map(tag => tag.trim().toLowerCase()));
      const base = current.mode === "remove"
        ? [...selectedImage.tags, ...(selectedImage.hierarchicalTags ?? [])].filter(tag => !removed.has(tag.trim().toLowerCase()))
        : current.tags;
      const merged = new Map(base.map(tag => [tag.trim().toLowerCase(), tag]));
      tagsToApply.forEach(tag => { if (!merged.has(tag.toLowerCase())) merged.set(tag.toLowerCase(), tag); });
      return { ...current, mode: current.mode === "remove" ? "replace" : current.mode, tags: Array.from(merged.values()) };
    });
    dismiss();
  }

  return <>
    <button type="button" className="ghost inspector-copy-filename" disabled={!enabled || generating} onClick={() => void generate()}>
      Generate Tags
    </button>
    <dialog ref={dialog} className="modal-card generate-description-dialog" aria-labelledby="generate-tags-heading" aria-describedby="generate-tags-status" onCancel={dismiss}>
      <h3 id="generate-tags-heading">Generate Tags</h3>
      <p className="muted">Color palette for {selectedImage?.filename}</p>
      {generating ? <progress aria-label="Analyzing image colors" /> : null}
      <p id="generate-tags-status" role="status" aria-live="polite" hidden={!status}>{status}</p>
      <div className="tag-chip-row">
        {tags.map(tag => <button
          type="button"
          className="tag-chip generated-tag-toggle"
          key={tag}
          aria-pressed={chosen.includes(tag)}
          onClick={() => setChosen(current => current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag])}
        >
          <span className="generated-tag-check" aria-hidden="true">{chosen.includes(tag) ? "\u2713" : ""}</span>
          {tag}
        </button>)}
      </div>
      <div className="action-row generated-tags-actions">
        <button type="button" className="ghost" onClick={dismiss} autoFocus>Cancel</button>
        {failed || (!generating && !tags.length) ? <button type="button" onClick={() => void generate()}>Retry</button> : null}
        <button type="button" disabled={generating || !chosen.length} onClick={apply}>Apply Tags</button>
      </div>
    </dialog>
  </>;
}
