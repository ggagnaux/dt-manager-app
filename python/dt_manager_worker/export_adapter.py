from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
import tempfile


@dataclass(slots=True)
class ExportRequest:
    db_path: str
    data_db_path: str
    output_path: str
    tags: list[str]
    source_paths: list[str] | None = None
    darktable_cli_path: str | None = None
    image_type: str | None = None
    width: int | None = None
    height: int | None = None
    skip_export: bool = False
    rating: int | None = None
    color_label: str | None = None


def build_export_command(request: ExportRequest) -> list[str]:
    command = ["dt-export-meta", "--db", request.db_path, "--output", request.output_path]

    if request.source_paths:
        command = ["dt-export-meta", "--input-list", "<resolved-by-dt-manager>", "--output", request.output_path]

    if request.data_db_path:
        command.extend(["--data-db", request.data_db_path])

    if request.tags:
        command.append("--tags")
        command.extend(request.tags)

    if request.darktable_cli_path:
        command.extend(["--darktable-cli", request.darktable_cli_path])

    if request.image_type:
        command.extend(["--image-type", request.image_type])

    if request.width is not None:
        command.extend(["--width", str(request.width)])

    if request.height is not None:
        command.extend(["--height", str(request.height)])

    if request.rating is not None:
        command.extend(["--rating", str(request.rating)])

    if request.color_label:
        command.extend(["--color-label", request.color_label])

    if request.skip_export:
        command.append("--skip-export")

    return command


def run_export(request: ExportRequest) -> dict[str, object]:
    command, manifest_path = _workspace_export_command(request)
    exporter_root = _exporter_root()
    try:
        completed = subprocess.run(
            command,
            cwd=exporter_root,
            capture_output=True,
            text=True,
            check=False,
        )
    finally:
        if manifest_path and manifest_path.exists():
            manifest_path.unlink(missing_ok=True)
    return {
        "command": command,
        "exitCode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "success": completed.returncode == 0,
    }


def _workspace_export_command(request: ExportRequest) -> tuple[list[str], Path | None]:
    command = ["python", "-m", "src.cli"]
    manifest_path: Path | None = None
    if request.source_paths:
        manifest_path = _write_source_manifest(request.source_paths)
        command.extend(["--input-list", str(manifest_path)])
    else:
        command.extend(["--db", request.db_path])
    command.extend(["--output", request.output_path])
    if request.data_db_path:
        command.extend(["--data-db", request.data_db_path])
    if request.tags:
        command.append("--tags")
        command.extend(request.tags)
    if request.darktable_cli_path:
        command.extend(["--darktable-cli", request.darktable_cli_path])
    if request.image_type:
        command.extend(["--image-type", request.image_type])
    if request.width is not None:
        command.extend(["--width", str(request.width)])
    if request.height is not None:
        command.extend(["--height", str(request.height)])
    if request.rating is not None:
        command.extend(["--rating", str(request.rating)])
    if request.color_label:
        command.extend(["--color-label", request.color_label])
    if request.skip_export:
        command.append("--skip-export")
    return command, manifest_path


def _exporter_root() -> Path:
    return Path(__file__).resolve().parents[3] / "dt-export-meta"


def _write_source_manifest(source_paths: list[str]) -> Path:
    runtime_dir = Path.cwd() / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        suffix=".json",
        prefix="export-source-list-",
        dir=runtime_dir,
        delete=False,
    ) as handle:
        json.dump(source_paths, handle, indent=2)
        return Path(handle.name)
