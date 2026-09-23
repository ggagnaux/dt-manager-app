from __future__ import annotations

import sqlite3
from pathlib import Path

from .models import MetadataEdit


def sync_darktable_database(
    library_db_path: Path,
    data_db_path: Path | None,
    image_ids: list[int],
    edit: MetadataEdit,
) -> dict[str, object]:
    normalized_ids = sorted({int(image_id) for image_id in image_ids})
    if not normalized_ids:
        return {"syncedCount": 0}

    with sqlite3.connect(library_db_path) as connection:
        connection.row_factory = sqlite3.Row
        tag_table = "tags"
        if not _table_exists(connection, "tags"):
            if data_db_path is None or not data_db_path.exists():
                raise RuntimeError("Darktable DB sync requires a valid data.db for tag writes.")
            connection.execute("ATTACH DATABASE ? AS data", (str(data_db_path),))
            if not _table_exists(connection, "data.tags"):
                raise RuntimeError("Darktable DB sync could not find a tags table.")
            tag_table = "data.tags"

        current_tag_map = _load_current_tags(connection, tag_table, normalized_ids)

        for image_id in normalized_ids:
            if edit.tags or edit.mode == "replace":
                desired_tags = _apply_tag_mode(current_tag_map.get(image_id, []), edit.tags, edit.mode)
                _replace_image_tags(connection, tag_table, image_id, desired_tags)

            if edit.rating is not None:
                connection.execute(
                    "UPDATE images SET flags = ((flags & ~7) | ?) WHERE id = ?",
                    (int(edit.rating), image_id),
                )

            if edit.color_label is not None:
                connection.execute("DELETE FROM color_labels WHERE imgid = ?", (image_id,))
                if edit.color_label:
                    connection.execute(
                        "INSERT INTO color_labels (imgid, color) VALUES (?, ?)",
                        (image_id, _color_label_to_value(edit.color_label)),
                    )

        connection.commit()

    return {"syncedCount": len(normalized_ids)}


def retry_pending_jobs(pending_jobs: list[dict[str, object]]) -> dict[str, object]:
    completed_job_ids: set[str] = set()
    retried = 0
    failures: list[dict[str, str]] = []

    for job in pending_jobs:
        try:
            edit_raw = job["edit"]
            sync_darktable_database(
                Path(str(job["libraryDbPath"])),
                Path(str(job["dataDbPath"])) if str(job.get("dataDbPath", "")) else None,
                [int(value) for value in job.get("imageIds", [])],
                MetadataEdit(
                    mode=str(edit_raw.get("mode", "add")),
                    tags=[str(value) for value in edit_raw.get("tags", [])],
                    title=str(edit_raw.get("title", "")),
                    description=str(edit_raw.get("description", "")),
                    rating=int(edit_raw["rating"]) if edit_raw.get("rating") is not None else None,
                    color_label=str(edit_raw["colorLabel"]) if edit_raw.get("colorLabel") is not None else None,
                ),
            )
            completed_job_ids.add(str(job["jobId"]))
            retried += 1
        except Exception as exc:
            failures.append({"jobId": str(job.get("jobId", "")), "error": str(exc)})

    return {
        "retriedCount": retried,
        "completedJobIds": sorted(completed_job_ids),
        "failures": failures,
    }


def _load_current_tags(
    connection: sqlite3.Connection,
    tag_table: str,
    image_ids: list[int],
) -> dict[int, list[str]]:
    placeholders = ", ".join("?" for _ in image_ids)
    rows = connection.execute(
        f"""
            SELECT ti.imgid AS image_id, t.name AS tag_name
            FROM tagged_images AS ti
            INNER JOIN {tag_table} AS t ON t.id = ti.tagid
            WHERE ti.imgid IN ({placeholders})
            ORDER BY lower(t.name)
        """,
        image_ids,
    ).fetchall()
    result: dict[int, list[str]] = {}
    for row in rows:
        result.setdefault(int(row["image_id"]), []).append(str(row["tag_name"]))
    return result


def _replace_image_tags(
    connection: sqlite3.Connection,
    tag_table: str,
    image_id: int,
    desired_tags: list[str],
) -> None:
    connection.execute("DELETE FROM tagged_images WHERE imgid = ?", (image_id,))
    for tag_name in desired_tags:
        tag_id = _ensure_tag(connection, tag_table, tag_name)
        connection.execute(
            "INSERT INTO tagged_images (imgid, tagid) VALUES (?, ?)",
            (image_id, tag_id),
        )


def _ensure_tag(connection: sqlite3.Connection, tag_table: str, tag_name: str) -> int:
    row = connection.execute(
        f"SELECT id FROM {tag_table} WHERE lower(name) = ?",
        (tag_name.casefold(),),
    ).fetchone()
    if row is not None:
        return int(row["id"])

    connection.execute(f"INSERT INTO {tag_table} (name) VALUES (?)", (tag_name,))
    row = connection.execute(
        f"SELECT id FROM {tag_table} WHERE lower(name) = ?",
        (tag_name.casefold(),),
    ).fetchone()
    if row is None:
        raise RuntimeError(f"Failed to create Darktable tag '{tag_name}'.")
    return int(row["id"])


def _apply_tag_mode(current_tags: list[str], requested_tags: list[str], mode: str) -> list[str]:
    normalized_requested = {tag.casefold(): tag for tag in requested_tags if tag.strip()}
    if not normalized_requested and mode != "replace":
        return sorted(current_tags, key=str.casefold)
    if mode == "replace":
        return sorted(normalized_requested.values(), key=str.casefold)
    if mode == "remove":
        return sorted(
            [tag for tag in current_tags if tag.casefold() not in normalized_requested],
            key=str.casefold,
        )

    merged = {tag.casefold(): tag for tag in current_tags}
    merged.update(normalized_requested)
    return sorted(merged.values(), key=str.casefold)


def _color_label_to_value(label: str) -> int:
    values = {
        "red": 0,
        "yellow": 1,
        "green": 2,
        "blue": 3,
        "purple": 4,
    }
    normalized = label.strip().casefold()
    if normalized not in values:
        raise RuntimeError(f"Unsupported color label '{label}'.")
    return values[normalized]


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    query = "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?"
    params = (table_name,)
    if "." in table_name:
        schema_name, bare_name = table_name.split(".", 1)
        query = f"SELECT 1 FROM {schema_name}.sqlite_master WHERE type='table' AND name = ?"
        params = (bare_name,)
    return connection.execute(query, params).fetchone() is not None
