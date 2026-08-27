from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dt_manager_worker.darktable_service import inspect_library, list_tags, manage_tag, search_images
from dt_manager_worker.export_adapter import ExportRequest, build_export_command, run_export
from dt_manager_worker.models import MetadataEdit
from dt_manager_worker.app_state import (
    list_export_presets,
    list_pending_db_sync_jobs,
    list_series_admin_state,
    save_export_preset,
    save_series_admin_state,
)
from dt_manager_worker.write_executor import apply_metadata_edits, retry_pending_db_sync
from dt_manager_worker.write_planner import build_write_preview
from dt_manager_worker.xmp_inspector import inspect_xmp_fields


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dt-manager-worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("ping")

    inspect_parser = subparsers.add_parser("inspect-library")
    inspect_parser.add_argument("--library-db", default="", help="Path to Darktable library.db.")
    inspect_parser.add_argument("--data-db", default="", help="Optional path to Darktable data.db.")

    tags_parser = subparsers.add_parser("list-tags")
    tags_parser.add_argument("--library-db", required=True)
    tags_parser.add_argument("--data-db", default="")

    manage_tag_parser = subparsers.add_parser("manage-tag")
    manage_tag_parser.add_argument("--library-db", required=True)
    manage_tag_parser.add_argument("--data-db", default="")
    manage_tag_parser.add_argument("--action", required=True)
    manage_tag_parser.add_argument("--tag-path", default="")
    manage_tag_parser.add_argument("--value", default="")

    search_parser = subparsers.add_parser("search-images")
    search_parser.add_argument("--library-db", required=True)
    search_parser.add_argument("--data-db", default="")
    search_parser.add_argument("--text", default="")
    search_parser.add_argument("--folder", default="")
    search_parser.add_argument("--date-from", default="")
    search_parser.add_argument("--date-to", default="")
    search_parser.add_argument("--rating", type=int)
    search_parser.add_argument("--color-label", default="")
    search_parser.add_argument("--limit", type=int, default=120)
    search_parser.add_argument("--tags", nargs="*")

    preview_parser = subparsers.add_parser("preview-write-plan")
    preview_parser.add_argument("--library-db", required=True)
    preview_parser.add_argument("--data-db", default="")
    preview_parser.add_argument("--image-ids", nargs="+", type=int, required=True)
    preview_parser.add_argument("--edit-json", required=True)

    apply_parser = subparsers.add_parser("apply-metadata-edits")
    apply_parser.add_argument("--library-db", required=True)
    apply_parser.add_argument("--data-db", default="")
    apply_parser.add_argument("--image-ids", nargs="+", type=int, required=True)
    apply_parser.add_argument("--edit-json", required=True)

    subparsers.add_parser("list-pending-db-sync")
    subparsers.add_parser("retry-pending-db-sync")
    subparsers.add_parser("list-export-presets")
    save_preset_parser = subparsers.add_parser("save-export-preset")
    save_preset_parser.add_argument("--name", required=True)
    save_preset_parser.add_argument("--settings-json", required=True)
    subparsers.add_parser("list-series-admin-state")
    save_series_state_parser = subparsers.add_parser("save-series-admin-state")
    save_series_state_parser.add_argument("--state-json", required=True)

    inspect_xmp_parser = subparsers.add_parser("inspect-xmp")
    inspect_xmp_parser.add_argument("path", help="Path to an XMP sidecar to inspect.")

    export_parser = subparsers.add_parser("build-export-command")
    export_parser.add_argument("--db", required=True)
    export_parser.add_argument("--data-db", default="")
    export_parser.add_argument("--output", required=True)
    export_parser.add_argument("--darktable-cli", default="")
    export_parser.add_argument("--image-type", default="")
    export_parser.add_argument("--width", type=int)
    export_parser.add_argument("--height", type=int)
    export_parser.add_argument("--skip-export", action="store_true")
    export_parser.add_argument("--tags", nargs="*")
    export_parser.add_argument("--rating", type=int)
    export_parser.add_argument("--color-label", default="")
    export_parser.add_argument("--source-paths-json", default="")

    run_export_parser = subparsers.add_parser("run-export")
    run_export_parser.add_argument("--db", required=True)
    run_export_parser.add_argument("--data-db", default="")
    run_export_parser.add_argument("--output", required=True)
    run_export_parser.add_argument("--darktable-cli", default="")
    run_export_parser.add_argument("--image-type", default="")
    run_export_parser.add_argument("--width", type=int)
    run_export_parser.add_argument("--height", type=int)
    run_export_parser.add_argument("--skip-export", action="store_true")
    run_export_parser.add_argument("--tags", nargs="*")
    run_export_parser.add_argument("--rating", type=int)
    run_export_parser.add_argument("--color-label", default="")
    run_export_parser.add_argument("--source-paths-json", default="")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "ping":
        print("Python worker ready for DT Manager.")
        return 0

    if args.command == "inspect-library":
        library_db = Path(args.library_db) if args.library_db else None
        data_db = Path(args.data_db) if args.data_db else None

        if library_db is None:
            print("No library selected yet.")
            return 0

        try:
            payload = inspect_library(library_db, data_db)
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(payload))
        return 0

    if args.command == "list-tags":
        try:
            payload = list_tags(Path(args.library_db), Path(args.data_db) if args.data_db else None)
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(payload))
        return 0

    if args.command == "manage-tag":
        try:
            payload = manage_tag(
                Path(args.library_db),
                Path(args.data_db) if args.data_db else None,
                action=args.action,
                tag_path=args.tag_path,
                value=args.value,
            )
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(payload))
        return 0

    if args.command == "search-images":
        try:
            payload = search_images(
                Path(args.library_db),
                Path(args.data_db) if args.data_db else None,
                text=args.text,
                folder=args.folder,
                date_from=args.date_from,
                date_to=args.date_to,
                tags=args.tags or [],
                rating=args.rating,
                color_label=args.color_label or None,
                limit=args.limit,
            )
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(payload))
        return 0

    if args.command == "inspect-xmp":
        path = Path(args.path)
        if not path.exists():
            print(f"XMP file not found: {path}", file=sys.stderr)
            return 1
        print(json.dumps(inspect_xmp_fields(path), indent=2))
        return 0

    if args.command == "build-export-command":
        request = ExportRequest(
            db_path=args.db,
            data_db_path=args.data_db,
            output_path=args.output,
            tags=args.tags or [],
            source_paths=_parse_json_string_list(args.source_paths_json),
            darktable_cli_path=args.darktable_cli or None,
            image_type=args.image_type or None,
            width=args.width,
            height=args.height,
            skip_export=args.skip_export,
            rating=args.rating,
            color_label=args.color_label or None,
        )
        print(json.dumps(build_export_command(request)))
        return 0

    if args.command == "run-export":
        request = ExportRequest(
            db_path=args.db,
            data_db_path=args.data_db,
            output_path=args.output,
            tags=args.tags or [],
            source_paths=_parse_json_string_list(args.source_paths_json),
            darktable_cli_path=args.darktable_cli or None,
            image_type=args.image_type or None,
            width=args.width,
            height=args.height,
            skip_export=args.skip_export,
            rating=args.rating,
            color_label=args.color_label or None,
        )
        print(json.dumps(run_export(request)))
        return 0

    if args.command == "preview-write-plan":
        try:
            edit = _parse_metadata_edit(args.edit_json)
            payload = build_write_preview(
                Path(args.library_db),
                Path(args.data_db) if args.data_db else None,
                list(args.image_ids),
                edit,
            )
        except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(payload))
        return 0

    if args.command == "apply-metadata-edits":
        try:
            edit = _parse_metadata_edit(args.edit_json)
            payload = apply_metadata_edits(
                Path(args.library_db),
                Path(args.data_db) if args.data_db else None,
                list(args.image_ids),
                edit,
            )
        except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(payload))
        return 0

    if args.command == "list-pending-db-sync":
        print(json.dumps(list_pending_db_sync_jobs()))
        return 0

    if args.command == "retry-pending-db-sync":
        print(json.dumps(retry_pending_db_sync()))
        return 0

    if args.command == "list-export-presets":
        print(json.dumps(list_export_presets()))
        return 0

    if args.command == "save-export-preset":
        settings = json.loads(args.settings_json)
        print(json.dumps(save_export_preset(args.name, settings)))
        return 0

    if args.command == "list-series-admin-state":
        print(json.dumps(list_series_admin_state()))
        return 0

    if args.command == "save-series-admin-state":
        state = json.loads(args.state_json)
        print(json.dumps(save_series_admin_state(state)))
        return 0

    print(f"Unsupported command: {args.command}", file=sys.stderr)
    return 1


def _parse_metadata_edit(raw_json: str) -> MetadataEdit:
    raw_edit = json.loads(raw_json)
    return MetadataEdit(
        mode=str(raw_edit.get("mode", "add")),
        tags=[str(value) for value in raw_edit.get("tags", []) if str(value).strip()],
        title=str(raw_edit.get("title", "")),
        description=str(raw_edit.get("description", "")),
        rating=int(raw_edit["rating"]) if raw_edit.get("rating") is not None else None,
        color_label=str(raw_edit["colorLabel"]) if raw_edit.get("colorLabel") is not None else None,
    )


def _parse_json_string_list(raw_json: str) -> list[str]:
    if not raw_json:
        return []
    payload = json.loads(raw_json)
    if not isinstance(payload, list):
        raise ValueError("Expected a JSON array of strings.")
    return [str(item) for item in payload if str(item).strip()]


if __name__ == "__main__":
    raise SystemExit(main())
