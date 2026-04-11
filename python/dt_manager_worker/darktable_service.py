from __future__ import annotations

import sqlite3
from collections import defaultdict
from pathlib import Path

from .xmp_inspector import inspect_xmp_fields

LIBRARY_EXPECTED_TABLES = ("images", "film_rolls", "tagged_images")
DATA_EXPECTED_TABLES = ("tags",)


def inspect_library(library_db_path: Path, data_db_path: Path | None = None) -> dict[str, object]:
    if not library_db_path.exists():
        raise RuntimeError(f"Darktable library not found: {library_db_path}")

    discovered_data_db = data_db_path or _default_data_db_path(library_db_path)

    with sqlite3.connect(library_db_path) as connection:
        connection.row_factory = sqlite3.Row
        table_names = _table_names(connection)
        tag_location = "library.db"

        if "tags" not in table_names:
            if discovered_data_db is None or not discovered_data_db.exists():
                raise RuntimeError(
                    "No tags table found in library.db and no usable data.db was found."
                )
            connection.execute("ATTACH DATABASE ? AS data", (str(discovered_data_db),))
            if not _table_exists(connection, "data.tags"):
                raise RuntimeError("Darktable tags table was not found in either library.db or data.db.")
            tag_location = "data.db"

        return {
            "libraryDbPath": str(library_db_path),
            "dataDbPath": str(discovered_data_db) if discovered_data_db else "",
            "status": "ready",
            "detail": f"Connected to Darktable library. Tags are stored in {tag_location}.",
            "libraryTables": table_names,
        }


def list_tags(library_db_path: Path, data_db_path: Path | None = None) -> list[str]:
    with _connect(library_db_path, data_db_path) as connection:
        query = """
            SELECT name
            FROM {tag_table}
            ORDER BY lower(name)
        """.format(tag_table=_tag_table_name(connection))
        rows = connection.execute(query).fetchall()
        return [str(row["name"]) for row in rows]


def manage_tag(
    library_db_path: Path,
    data_db_path: Path | None,
    *,
    action: str,
    tag_path: str,
    value: str = "",
) -> dict[str, object]:
    normalized_tag_path = tag_path.strip()
    normalized_value = value.strip()
    if not normalized_tag_path and action != "create_root":
        raise RuntimeError("A tag path is required for this action.")

    with _connect(library_db_path, data_db_path) as connection:
        tag_table = _tag_table_name(connection)

        if action == "create_root":
            if not normalized_value:
                raise RuntimeError("Enter a tag name to create.")
            _insert_tag(connection, tag_table, normalized_value)
            connection.commit()
            return {"summary": f"Created tag '{normalized_value}'."}

        if action == "create_child":
            if not normalized_value:
                raise RuntimeError("Enter a child tag name to create.")
            new_path = f"{normalized_tag_path}|{normalized_value}"
            _insert_tag(connection, tag_table, new_path)
            connection.commit()
            return {"summary": f"Created child tag '{new_path}'."}

        if action == "rename":
            if not normalized_value:
                raise RuntimeError("Enter a new tag name.")
            parent_prefix = normalized_tag_path.rsplit("|", 1)[0] if "|" in normalized_tag_path else ""
            new_base = f"{parent_prefix}|{normalized_value}" if parent_prefix else normalized_value
            _rename_tag_branch(connection, tag_table, normalized_tag_path, new_base)
            connection.commit()
            return {"summary": f"Renamed tag '{normalized_tag_path}' to '{new_base}'."}

        if action == "move":
            current_name = normalized_tag_path.split("|")[-1]
            new_parent = normalized_value
            new_base = f"{new_parent}|{current_name}" if new_parent else current_name
            _rename_tag_branch(connection, tag_table, normalized_tag_path, new_base)
            connection.commit()
            return {"summary": f"Moved tag '{normalized_tag_path}' to '{new_base}'."}

        raise RuntimeError(f"Unsupported tag action '{action}'.")


def search_images(
    library_db_path: Path,
    data_db_path: Path | None = None,
    *,
    text: str = "",
    folder: str = "",
    date_from: str = "",
    date_to: str = "",
    tags: list[str] | None = None,
    rating: int | None = None,
    color_label: str | None = None,
    limit: int = 120,
) -> list[dict[str, object]]:
    tags = [tag.strip() for tag in (tags or []) if tag.strip()]

    with _connect(library_db_path, data_db_path) as connection:
        tag_table = _tag_table_name(connection)
        query = f"""
            SELECT
                i.id AS image_id,
                fr.folder AS folder,
                i.filename AS filename,
                (i.flags & 7) AS rating
            FROM images AS i
            INNER JOIN film_rolls AS fr ON fr.id = i.film_id
            WHERE 1 = 1
              AND (? = '' OR lower(i.filename) LIKE ? OR lower(fr.folder) LIKE ?)
              AND (? = '' OR lower(fr.folder) LIKE ?)
              AND (? IS NULL OR ((i.flags & 8) = 0 AND (i.flags & 7) = ?))
              AND (? = '' OR EXISTS (
                  SELECT 1
                  FROM color_labels AS cl
                  WHERE cl.imgid = i.id AND cl.color = ?
              ))
            ORDER BY lower(fr.folder), lower(i.filename)
        """

        normalized_text = text.strip().casefold()
        normalized_folder = folder.strip().casefold()
        color_value = _color_label_to_value(color_label) if color_label else ""

        rows = connection.execute(
            query,
            (
                normalized_text,
                f"%{normalized_text}%",
                f"%{normalized_text}%",
                normalized_folder,
                f"%{normalized_folder}%",
                rating,
                rating,
                color_value,
                color_value,
            ),
        ).fetchall()

        if not rows:
            return []

        image_ids = [int(row["image_id"]) for row in rows]
        tag_rows = _load_tags_for_images(connection, tag_table, image_ids)
        tags_by_image = defaultdict(list)
        for row in tag_rows:
            tags_by_image[int(row["image_id"])].append(str(row["tag_name"]))

        results: list[dict[str, object]] = []
        requested_tags = {tag.casefold() for tag in tags}

        for row in rows:
            image_id = int(row["image_id"])
            image_tags = sorted(tags_by_image.get(image_id, []), key=str.casefold)
            if requested_tags and not requested_tags.issubset({tag.casefold() for tag in image_tags}):
                continue

            source_path = Path(str(row["folder"])) / str(row["filename"])
            sidecar_path = locate_sidecar_for_image(source_path)
            xmp_data = inspect_xmp_fields(sidecar_path) if sidecar_path else {}
            capture_date = _normalize_capture_date(str(xmp_data.get("captureDate", "")))
            if not _capture_date_matches(capture_date, date_from, date_to):
                continue

            results.append(_build_image_payload(row, source_path, sidecar_path, xmp_data, image_tags))
            if len(results) >= limit:
                break

        return results


def load_images_by_ids(
    library_db_path: Path,
    data_db_path: Path | None,
    image_ids: list[int],
) -> list[dict[str, object]]:
    normalized_ids = sorted({int(image_id) for image_id in image_ids})
    if not normalized_ids:
        return []

    with _connect(library_db_path, data_db_path) as connection:
        tag_table = _tag_table_name(connection)
        placeholders = ", ".join("?" for _ in normalized_ids)
        rows = connection.execute(
            f"""
                SELECT
                    i.id AS image_id,
                    fr.folder AS folder,
                    i.filename AS filename,
                    (i.flags & 7) AS rating
                FROM images AS i
                INNER JOIN film_rolls AS fr ON fr.id = i.film_id
                WHERE i.id IN ({placeholders})
                ORDER BY lower(fr.folder), lower(i.filename)
            """,
            normalized_ids,
        ).fetchall()

        tag_rows = _load_tags_for_images(connection, tag_table, normalized_ids)
        tags_by_image = defaultdict(list)
        for row in tag_rows:
            tags_by_image[int(row["image_id"])].append(str(row["tag_name"]))

        results: list[dict[str, object]] = []
        for row in rows:
            source_path = Path(str(row["folder"])) / str(row["filename"])
            sidecar_path = locate_sidecar_for_image(source_path)
            xmp_data = inspect_xmp_fields(sidecar_path) if sidecar_path else {}
            image_tags = sorted(tags_by_image.get(int(row["image_id"]), []), key=str.casefold)
            results.append(_build_image_payload(row, source_path, sidecar_path, xmp_data, image_tags))

        return results


def locate_sidecar_for_image(image_path: Path) -> Path | None:
    direct_match = image_path.with_suffix(f"{image_path.suffix}.xmp")
    if direct_match.exists():
        return direct_match

    simple_match = image_path.with_suffix(".xmp")
    if simple_match.exists():
        return simple_match

    matches = sorted(image_path.parent.glob(f"{image_path.stem}_*.xmp"))
    return matches[0] if matches else None


def _connect(library_db_path: Path, data_db_path: Path | None) -> sqlite3.Connection:
    if not library_db_path.exists():
        raise RuntimeError(f"Darktable library not found: {library_db_path}")

    connection = sqlite3.connect(library_db_path)
    connection.row_factory = sqlite3.Row

    if not _table_exists(connection, "tags"):
        discovered_data_db = data_db_path or _default_data_db_path(library_db_path)
        if discovered_data_db is None or not discovered_data_db.exists():
            connection.close()
            raise RuntimeError("Darktable tags were not found in library.db and no valid data.db was available.")
        connection.execute("ATTACH DATABASE ? AS data", (str(discovered_data_db),))

    return connection


def _default_data_db_path(library_db_path: Path) -> Path | None:
    candidate = library_db_path.with_name("data.db")
    return candidate if candidate.exists() else None


def _table_names(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [str(row["name"]) for row in rows]


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    query = "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?"
    params = (table_name,)
    if "." in table_name:
        schema_name, bare_name = table_name.split(".", 1)
        query = f"SELECT 1 FROM {schema_name}.sqlite_master WHERE type='table' AND name = ?"
        params = (bare_name,)
    return connection.execute(query, params).fetchone() is not None


def _tag_table_name(connection: sqlite3.Connection) -> str:
    return "tags" if _table_exists(connection, "tags") else "data.tags"


def _load_tags_for_images(
    connection: sqlite3.Connection, tag_table: str, image_ids: list[int]
) -> list[sqlite3.Row]:
    placeholders = ", ".join("?" for _ in image_ids)
    query = f"""
        SELECT ti.imgid AS image_id, t.name AS tag_name
        FROM tagged_images AS ti
        INNER JOIN {tag_table} AS t ON t.id = ti.tagid
        WHERE ti.imgid IN ({placeholders})
        ORDER BY lower(t.name)
    """
    return connection.execute(query, image_ids).fetchall()


def _color_label_to_value(label: str | None) -> int | str:
    if not label:
        return ""
    values = {
        "red": 0,
        "yellow": 1,
        "green": 2,
        "blue": 3,
        "purple": 4,
    }
    normalized = label.strip().casefold()
    if normalized not in values:
        raise RuntimeError(
            f"Unsupported color label '{label}'. Expected one of: red, yellow, green, blue, purple."
        )
    return values[normalized]


def _first_color_label_name(values: object) -> str:
    if not isinstance(values, list) or not values:
        return ""
    mapping = {
        0: "red",
        1: "yellow",
        2: "green",
        3: "blue",
        4: "purple",
    }
    first = values[0]
    return mapping.get(first, "") if isinstance(first, int) else ""


def _build_image_payload(
    row: sqlite3.Row,
    source_path: Path,
    sidecar_path: Path | None,
    xmp_data: dict[str, object],
    image_tags: list[str],
) -> dict[str, object]:
    return {
        "id": int(row["image_id"]),
        "filename": str(row["filename"]),
        "folder": str(row["folder"]),
        "sourcePath": str(source_path),
        "xmpPath": str(sidecar_path) if sidecar_path else "",
        "captureDate": _normalize_capture_date(str(xmp_data.get("captureDate", ""))),
        "title": xmp_data.get("title", ""),
        "description": xmp_data.get("description", ""),
        "creator": xmp_data.get("creator", ""),
        "rights": xmp_data.get("rights", ""),
        "notes": xmp_data.get("notes", ""),
        "rating": int(row["rating"]),
        "colorLabel": _first_color_label_name(xmp_data.get("colorLabels", [])),
        "tags": xmp_data.get("flatSubjects", image_tags),
        "hierarchicalTags": xmp_data.get("hierarchicalSubjects", []),
    }


def _normalize_capture_date(raw_value: str) -> str:
    value = raw_value.strip()
    if not value:
        return ""
    if " " in value:
        value = value.split(" ", 1)[0]
    if "T" in value:
        value = value.split("T", 1)[0]
    parts = value.replace("/", ":").replace("-", ":").split(":")
    if len(parts) < 3:
        return value
    year, month, day = parts[:3]
    if not (year.isdigit() and month.isdigit() and day.isdigit()):
        return value
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def _capture_date_matches(capture_date: str, date_from: str, date_to: str) -> bool:
    normalized_from = date_from.strip()
    normalized_to = date_to.strip()
    if not normalized_from and not normalized_to:
        return True
    if not capture_date:
        return False
    if normalized_from and capture_date < normalized_from:
        return False
    if normalized_to and capture_date > normalized_to:
        return False
    return True


def _insert_tag(connection: sqlite3.Connection, tag_table: str, tag_name: str) -> None:
    existing = connection.execute(
        f"SELECT id FROM {tag_table} WHERE lower(name) = ?",
        (tag_name.casefold(),),
    ).fetchone()
    if existing is not None:
        raise RuntimeError(f"Tag '{tag_name}' already exists.")
    connection.execute(f"INSERT INTO {tag_table} (name) VALUES (?)", (tag_name,))


def _rename_tag_branch(
    connection: sqlite3.Connection,
    tag_table: str,
    current_path: str,
    new_base: str,
) -> None:
    rows = connection.execute(
        f"SELECT id, name FROM {tag_table} WHERE lower(name) = ? OR lower(name) LIKE ? ORDER BY length(name)",
        (current_path.casefold(), f"{current_path.casefold()}|%"),
    ).fetchall()
    if not rows:
        raise RuntimeError(f"Tag '{current_path}' was not found.")

    collision = connection.execute(
        f"SELECT 1 FROM {tag_table} WHERE lower(name) = ? AND lower(name) <> ?",
        (new_base.casefold(), current_path.casefold()),
    ).fetchone()
    if collision is not None:
        raise RuntimeError(f"Tag '{new_base}' already exists.")

    for row in rows:
        existing_name = str(row["name"])
        suffix = existing_name[len(current_path):]
        new_name = f"{new_base}{suffix}"
        connection.execute(
            f"UPDATE {tag_table} SET name = ? WHERE id = ?",
            (new_name, int(row["id"])),
        )
