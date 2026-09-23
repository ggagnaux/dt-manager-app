from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from .darktable_service import load_images_by_ids
from .models import MetadataEdit
from .tags import image_tags, normalize_tags


def build_write_preview(
    library_db_path: Path,
    data_db_path: Path | None,
    image_ids: list[int],
    edit: MetadataEdit,
) -> dict[str, object]:
    images = load_images_by_ids(library_db_path, data_db_path, image_ids)
    if not images:
        return {
            "summary": "No matching images were found for the requested preview.",
            "affectedCount": 0,
            "imageCount": 0,
            "xmpMissingCount": 0,
            "changes": {
                "tagsAdded": 0,
                "tagsRemoved": 0,
                "titleChanges": 0,
                "descriptionChanges": 0,
                "ratingChanges": 0,
                "colorLabelChanges": 0,
            },
            "imagePlans": [],
        }

    requested_tags = normalize_tags(edit.tags)
    plans: list[dict[str, object]] = []
    aggregate = {
        "tagsAdded": 0,
        "tagsRemoved": 0,
        "titleChanges": 0,
        "descriptionChanges": 0,
        "ratingChanges": 0,
        "colorLabelChanges": 0,
    }
    xmp_missing_count = 0

    for image in images:
        current_tags = image_tags(image)
        next_tags = _apply_tag_mode(current_tags, requested_tags, edit.mode)
        current_keys = {tag.casefold() for tag in current_tags}
        next_keys = {tag.casefold() for tag in next_tags}
        added_tags = [tag for tag in next_tags if tag.casefold() not in current_keys]
        removed_tags = [tag for tag in current_tags if tag.casefold() not in next_keys]
        field_changes: list[str] = []

        if added_tags:
            aggregate["tagsAdded"] += len(added_tags)
            field_changes.append(f"add {len(added_tags)} tag(s)")
        if removed_tags:
            aggregate["tagsRemoved"] += len(removed_tags)
            field_changes.append(f"remove {len(removed_tags)} tag(s)")

        if edit.title.strip() and edit.title.strip() != str(image.get("title", "")):
            aggregate["titleChanges"] += 1
            field_changes.append("update title")

        if edit.description.strip() and edit.description.strip() != str(image.get("description", "")):
            aggregate["descriptionChanges"] += 1
            field_changes.append("update description")

        if edit.rating is not None and int(edit.rating) != int(image.get("rating", 0)):
            aggregate["ratingChanges"] += 1
            field_changes.append("update rating")

        current_color = str(image.get("colorLabel", "") or "")
        if edit.color_label is not None and edit.color_label != current_color:
            aggregate["colorLabelChanges"] += 1
            field_changes.append("update color label")

        xmp_path = str(image.get("xmpPath", "") or "")
        will_create_xmp = not xmp_path
        if will_create_xmp:
            xmp_missing_count += 1

        plans.append(
            {
                "imageId": int(image["id"]),
                "filename": str(image["filename"]),
                "addedTags": added_tags,
                "removedTags": removed_tags,
                "fieldChanges": field_changes,
                "willCreateXmp": will_create_xmp,
            }
        )

    affected_count = sum(1 for plan in plans if plan["addedTags"] or plan["removedTags"] or plan["fieldChanges"])
    summary_parts: list[str] = []
    if aggregate["tagsAdded"]:
        summary_parts.append(f"{aggregate['tagsAdded']} tag additions")
    if aggregate["tagsRemoved"]:
        summary_parts.append(f"{aggregate['tagsRemoved']} tag removals")
    if aggregate["titleChanges"]:
        summary_parts.append(f"{aggregate['titleChanges']} title updates")
    if aggregate["descriptionChanges"]:
        summary_parts.append(f"{aggregate['descriptionChanges']} description updates")
    if aggregate["ratingChanges"]:
        summary_parts.append(f"{aggregate['ratingChanges']} rating updates")
    if aggregate["colorLabelChanges"]:
        summary_parts.append(f"{aggregate['colorLabelChanges']} color label updates")
    if xmp_missing_count:
        summary_parts.append(f"{xmp_missing_count} new XMP file(s)")

    summary = ", ".join(summary_parts) if summary_parts else "No metadata changes detected."

    return {
        "summary": summary,
        "affectedCount": affected_count,
        "imageCount": len(images),
        "xmpMissingCount": xmp_missing_count,
        "changes": aggregate,
        "imagePlans": plans,
    }


def _apply_tag_mode(current_tags: list[str], requested_tags: list[str], mode: str) -> list[str]:
    if not requested_tags and mode != "replace":
        return list(current_tags)

    current_lookup = {tag.casefold(): tag for tag in current_tags}
    requested_lookup = {tag.casefold(): tag for tag in requested_tags}

    if mode == "replace":
        return list(requested_lookup.values())

    if mode == "remove":
        return [tag for tag in current_tags if tag.casefold() not in requested_lookup]

    merged = dict(current_lookup)
    merged.update(requested_lookup)
    return sorted(merged.values(), key=str.casefold)
