from __future__ import annotations

from pathlib import Path

from .app_state import clear_pending_db_sync_jobs, enqueue_pending_db_sync, list_pending_db_sync_jobs
from .db_sync import retry_pending_jobs, sync_darktable_database
from .darktable_service import load_images_by_ids
from .models import MetadataEdit
from .xmp_writer import apply_edit_to_xmp


def apply_metadata_edits(
    library_db_path: Path,
    data_db_path: Path | None,
    image_ids: list[int],
    edit: MetadataEdit,
) -> dict[str, object]:
    images = load_images_by_ids(library_db_path, data_db_path, image_ids)
    if not images:
        return {
            "summary": "No matching images were found for the requested write.",
            "writtenCount": 0,
            "dbSyncStatus": "not_started",
            "items": [],
        }

    results: list[dict[str, object]] = []
    written_count = 0

    for image in images:
        source_path = Path(str(image.get("sourcePath", "") or ""))
        if not source_path:
            continue

        xmp_path_raw = str(image.get("xmpPath", "") or "")
        xmp_path = Path(xmp_path_raw) if xmp_path_raw else None
        written_path = apply_edit_to_xmp(source_path, xmp_path, image, edit)
        written_count += 1
        results.append(
            {
                "imageId": int(image["id"]),
                "filename": str(image["filename"]),
                "xmpPath": str(written_path),
                "dbSyncPending": False,
            }
        )

    pending_job_id = ""
    db_sync_status = "synced"
    summary_suffix = "Darktable database sync completed."
    try:
        sync_darktable_database(library_db_path, data_db_path, image_ids, edit)
    except Exception as exc:
        pending_job = enqueue_pending_db_sync(library_db_path, data_db_path, image_ids, edit, str(exc))
        pending_job_id = str(pending_job["jobId"])
        db_sync_status = "pending"
        summary_suffix = (
            "Darktable database sync failed and was queued for retry."
        )
        for item in results:
            item["dbSyncPending"] = True

    return {
        "summary": (
            f"Wrote XMP updates for {written_count} image(s). {summary_suffix}"
        ),
        "writtenCount": written_count,
        "dbSyncStatus": db_sync_status,
        "pendingJobId": pending_job_id,
        "items": results,
    }


def retry_pending_db_sync() -> dict[str, object]:
    jobs = list_pending_db_sync_jobs()
    if not jobs:
        return {
            "summary": "No pending DB sync jobs were found.",
            "retriedCount": 0,
            "remainingCount": 0,
            "failures": [],
        }

    result = retry_pending_jobs(jobs)
    clear_pending_db_sync_jobs(set(result["completedJobIds"]))
    remaining_count = len(list_pending_db_sync_jobs())
    summary = f"Retried {result['retriedCount']} pending DB sync job(s)."
    if result["failures"]:
        summary += f" {len(result['failures'])} job(s) still failed."

    return {
        "summary": summary,
        "retriedCount": result["retriedCount"],
        "remainingCount": remaining_count,
        "failures": result["failures"],
    }
