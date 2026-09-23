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
    clear_folder_before_export: bool = False
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
    destination, files = _export_destination(request)
    request.output_path = str(destination)
    if files and not request.clear_folder_before_export:
        return {
            "command": [], "exitCode": 0, "stdout": "", "stderr": "", "success": False,
            "confirmationRequired": True, "destinationPath": str(destination), "existingFileCount": len(files),
        }
    exporter_root = _exporter_root()
    if not exporter_root.is_dir():
        raise ValueError("The export tool folder is unavailable; no destination files were removed.")
    command, manifest_path = _workspace_export_command(request)
    try:
        # Recheck immediately before deletion, including files created during preparation.
        destination, files = _export_destination(request)
        if files and not request.clear_folder_before_export:
            raise ValueError("The destination changed during export preparation. Run export again to confirm clearing it.")
        for file in files:
            # Only unlink direct file entries. Never recurse into directories or junctions.
            if file.parent.resolve() != destination:
                raise ValueError("The destination folder changed. Export aborted.")
            file.unlink()
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



def _export_destination(request: ExportRequest) -> tuple[Path, list[Path]]:
    if not request.output_path.strip():
        raise ValueError("Choose an export destination folder.")
    destination = Path(request.output_path).expanduser().resolve()
    if request.skip_export:
        return destination, []
    app_root = Path(__file__).resolve().parents[2]
    protected_directories = {
        Path(destination.anchor), Path.home().resolve(), Path.cwd().resolve(),
        app_root, (Path.cwd() / "runtime").resolve(), _exporter_root().resolve(),
    }
    if destination in protected_directories:
        raise ValueError("Choose a dedicated export folder, not a drive root, home, or application folder.")
    protected_files = [request.db_path, request.data_db_path, *(request.source_paths or [])]
    if any(destination in {Path(value).resolve().parent, Path(value).absolute().parent.resolve()} for value in protected_files if value):
        raise ValueError("The destination contains source images or a Darktable database. Choose a separate export folder.")
    if not request.source_paths:
        raise ValueError("Explicit source images are required before preparing the export folder.")
    if any(not Path(value).is_file() for value in request.source_paths):
        raise ValueError("A source image is unavailable; no destination files were removed.")
    if not destination.exists():
        return destination, []
    if not destination.is_dir():
        raise ValueError("The export destination is not a folder.")
    files = [entry for entry in destination.iterdir() if entry.is_file() or (entry.is_symlink() and not entry.is_dir())]
    return destination, files

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
