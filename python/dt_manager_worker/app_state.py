from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from .models import MetadataEdit


def enqueue_pending_db_sync(
    library_db_path: Path,
    data_db_path: Path | None,
    image_ids: list[int],
    edit: MetadataEdit,
    reason: str,
) -> dict[str, object]:
    state = _load_state()
    job = {
        "jobId": str(uuid4()),
        "libraryDbPath": str(library_db_path),
        "dataDbPath": str(data_db_path) if data_db_path else "",
        "imageIds": list(image_ids),
        "edit": {
            "mode": edit.mode,
            "tags": list(edit.tags),
            "title": edit.title,
            "description": edit.description,
            "rating": edit.rating,
            "colorLabel": edit.color_label,
        },
        "reason": reason,
    }
    state.append(job)
    _save_state(state)
    return job


def list_pending_db_sync_jobs() -> list[dict[str, object]]:
    return _load_state()


def clear_pending_db_sync_jobs(job_ids: set[str]) -> None:
    if not job_ids:
        return
    state = [job for job in _load_state() if str(job.get("jobId", "")) not in job_ids]
    _save_state(state)


def pending_state_path() -> Path:
    return Path.cwd() / "runtime" / "pending-db-sync.json"


def list_export_presets() -> list[dict[str, object]]:
    return _load_json_list(export_presets_path())


def save_export_preset(name: str, settings: dict[str, object]) -> list[dict[str, object]]:
    presets = [preset for preset in list_export_presets() if str(preset.get("name", "")) != name]
    presets.append({"name": name, "settings": settings})
    presets.sort(key=lambda item: str(item.get("name", "")).casefold())
    _save_json_list(export_presets_path(), presets)
    return presets


def export_presets_path() -> Path:
    return Path.cwd() / "runtime" / "export-presets.json"


def list_series_admin_state() -> dict[str, object]:
    state = _load_json_object(series_admin_state_path())
    return {
        "order": state.get("order", []),
        "metadata": state.get("metadata", {}),
        "localSeries": state.get("localSeries", []),
    }


def save_series_admin_state(state: dict[str, object]) -> dict[str, object]:
    normalized = {
        "order": list(state.get("order", [])),
        "metadata": dict(state.get("metadata", {})),
        "localSeries": list(state.get("localSeries", [])),
    }
    _save_json_object(series_admin_state_path(), normalized)
    return normalized


def series_admin_state_path() -> Path:
    return Path.cwd() / "runtime" / "series-admin-state.json"


def _load_state() -> list[dict[str, object]]:
    return _load_json_list(pending_state_path())


def _save_state(state: list[dict[str, object]]) -> None:
    _save_json_list(pending_state_path(), state)


def _load_json_list(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json_list(path: Path, state: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _load_json_object(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json_object(path: Path, state: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")
