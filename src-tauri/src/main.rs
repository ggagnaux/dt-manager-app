#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
struct WorkerResponse<T> {
    ok: bool,
    data: Option<T>,
    error: Option<String>,
}

#[derive(Serialize)]
struct PingPayload {
    message: String,
}

#[derive(Serialize)]
struct DefaultPathsPayload {
    #[serde(rename = "libraryDbPath")]
    library_db_path: String,
    #[serde(rename = "dataDbPath")]
    data_db_path: String,
}

#[derive(Serialize, Deserialize)]
struct ConnectionPayload {
    #[serde(rename = "libraryDbPath")]
    library_db_path: String,
    #[serde(rename = "dataDbPath")]
    data_db_path: String,
    status: String,
    detail: String,
}

#[derive(Serialize, Deserialize)]
struct WritePlanPayload {
    summary: String,
    #[serde(rename = "affectedCount")]
    affected_count: usize,
    #[serde(rename = "imageCount")]
    image_count: usize,
    #[serde(rename = "xmpMissingCount")]
    xmp_missing_count: usize,
    changes: serde_json::Value,
    #[serde(rename = "imagePlans")]
    image_plans: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct ApplyEditsPayload {
    summary: String,
    #[serde(rename = "writtenCount")]
    written_count: usize,
    #[serde(rename = "dbSyncStatus")]
    db_sync_status: String,
    items: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct RetryPendingPayload {
    summary: String,
    #[serde(rename = "retriedCount")]
    retried_count: usize,
    #[serde(rename = "remainingCount")]
    remaining_count: usize,
    failures: Vec<serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct ExportRunPayload {
    command: Vec<String>,
    #[serde(rename = "exitCode")]
    exit_code: i64,
    stdout: String,
    stderr: String,
    success: bool,
}

fn run_worker(arguments: &[&str]) -> Result<String, String> {
    let app_root = worker_app_root();
    let worker_script = app_root.join("python").join("main.py");
    let mut command_arguments: Vec<String> = Vec::with_capacity(arguments.len());
    command_arguments.push(worker_script.to_string_lossy().to_string());
    command_arguments.extend(arguments.iter().skip(1).map(|value| value.to_string()));

    let output = Command::new("python")
        .current_dir(&app_root)
        .args(&command_arguments)
        .output()
        .map_err(|error| format!("Failed to start Python worker: {error}"))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map(|value| value.trim().to_string())
            .map_err(|error| format!("Worker returned invalid UTF-8: {error}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Python worker failed without stderr output.".to_string()
        } else {
            stderr
        })
    }
}

fn worker_app_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|path| path.to_path_buf())
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")))
}

fn run_worker_json<T: DeserializeOwned>(arguments: &[&str]) -> Result<T, String> {
    let output = run_worker(arguments)?;
    serde_json::from_str(&output).map_err(|error| format!("Failed to parse worker JSON: {error}"))
}

#[tauri::command]
fn worker_ping() -> WorkerResponse<PingPayload> {
    match run_worker(&["python/main.py", "ping"]) {
        Ok(message) => WorkerResponse {
            ok: true,
            data: Some(PingPayload { message }),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn default_darktable_paths() -> WorkerResponse<DefaultPathsPayload> {
    let base_dir = darktable_config_dir();
    let data = DefaultPathsPayload {
        library_db_path: base_dir.join("library.db").to_string_lossy().to_string(),
        data_db_path: base_dir.join("data.db").to_string_lossy().to_string(),
    };

    WorkerResponse {
        ok: true,
        data: Some(data),
        error: None,
    }
}

#[tauri::command]
fn worker_inspect_library(library_db_path: String, data_db_path: String) -> WorkerResponse<ConnectionPayload> {
    match run_worker_json(&[
        "python/main.py",
        "inspect-library",
        "--library-db",
        &library_db_path,
        "--data-db",
        &data_db_path,
    ]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_list_tags(library_db_path: String, data_db_path: String) -> WorkerResponse<Vec<String>> {
    match run_worker_json(&[
        "python/main.py",
        "list-tags",
        "--library-db",
        &library_db_path,
        "--data-db",
        &data_db_path,
    ]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_search_images(
    library_db_path: String,
    data_db_path: String,
    filters: serde_json::Value,
) -> WorkerResponse<Vec<serde_json::Value>> {
    let text = filters.get("text").and_then(|value| value.as_str()).unwrap_or("");
    let folder = filters.get("folder").and_then(|value| value.as_str()).unwrap_or("");
    let date_from = filters.get("dateFrom").and_then(|value| value.as_str()).unwrap_or("");
    let date_to = filters.get("dateTo").and_then(|value| value.as_str()).unwrap_or("");
    let color_label = filters
        .get("colorLabel")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let limit = filters.get("limit").and_then(|value| value.as_i64()).unwrap_or(120);
    let rating = filters.get("rating").and_then(|value| value.as_i64());
    let tags = filters
        .get("tags")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let limit_string = limit.to_string();

    let mut arguments = vec![
        "python/main.py",
        "search-images",
        "--library-db",
        &library_db_path,
        "--data-db",
        &data_db_path,
        "--text",
        text,
        "--folder",
        folder,
        "--date-from",
        date_from,
        "--date-to",
        date_to,
        "--color-label",
        color_label,
        "--limit",
        &limit_string,
    ];

    let rating_string;
    if let Some(value) = rating {
        rating_string = value.to_string();
        arguments.push("--rating");
        arguments.push(&rating_string);
    }

    let tag_strings: Vec<String> = tags
        .iter()
        .filter_map(|value| value.as_str().map(|item| item.to_string()))
        .collect();
    if !tag_strings.is_empty() {
        arguments.push("--tags");
        for value in &tag_strings {
            arguments.push(value.as_str());
        }
    }

    match run_worker_json(&arguments) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_preview_write_plan(
    library_db_path: String,
    data_db_path: String,
    image_ids: Vec<i64>,
    edit: serde_json::Value,
) -> WorkerResponse<WritePlanPayload> {
    let edit_json = match serde_json::to_string(&edit) {
        Ok(value) => value,
        Err(error) => {
            return WorkerResponse {
                ok: false,
                data: None,
                error: Some(format!("Failed to serialize edit payload: {error}")),
            }
        }
    };

    let mut arguments = vec![
        "python/main.py",
        "preview-write-plan",
        "--library-db",
        &library_db_path,
        "--data-db",
        &data_db_path,
        "--image-ids",
    ];

    let image_id_strings: Vec<String> = image_ids.iter().map(|value| value.to_string()).collect();
    for value in &image_id_strings {
        arguments.push(value.as_str());
    }
    arguments.push("--edit-json");
    arguments.push(&edit_json);

    match run_worker_json(&arguments) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_apply_metadata_edits(
    library_db_path: String,
    data_db_path: String,
    image_ids: Vec<i64>,
    edit: serde_json::Value,
) -> WorkerResponse<ApplyEditsPayload> {
    let edit_json = match serde_json::to_string(&edit) {
        Ok(value) => value,
        Err(error) => {
            return WorkerResponse {
                ok: false,
                data: None,
                error: Some(format!("Failed to serialize edit payload: {error}")),
            }
        }
    };

    let mut arguments = vec![
        "python/main.py",
        "apply-metadata-edits",
        "--library-db",
        &library_db_path,
        "--data-db",
        &data_db_path,
        "--image-ids",
    ];

    let image_id_strings: Vec<String> = image_ids.iter().map(|value| value.to_string()).collect();
    for value in &image_id_strings {
        arguments.push(value.as_str());
    }
    arguments.push("--edit-json");
    arguments.push(&edit_json);

    match run_worker_json(&arguments) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_list_pending_db_sync() -> WorkerResponse<Vec<serde_json::Value>> {
    match run_worker_json(&["python/main.py", "list-pending-db-sync"]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_retry_pending_db_sync() -> WorkerResponse<RetryPendingPayload> {
    match run_worker_json(&["python/main.py", "retry-pending-db-sync"]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_run_export(
    library_db_path: String,
    data_db_path: String,
    payload: serde_json::Value,
) -> WorkerResponse<ExportRunPayload> {
    let output_path = payload
        .get("outputPath")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let image_type = payload
        .get("imageType")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let width = payload.get("width").and_then(|value| value.as_str()).unwrap_or("");
    let height = payload.get("height").and_then(|value| value.as_str()).unwrap_or("");
    let darktable_cli = payload
        .get("darktableCliPath")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let skip_export = payload
        .get("skipExport")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let rating = payload.get("rating").and_then(|value| value.as_i64());
    let color_label = payload
        .get("colorLabel")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let tags = payload
        .get("tags")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let source_paths = payload
        .get("sourcePaths")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    let mut arguments = vec![
        "python/main.py",
        "run-export",
        "--db",
        &library_db_path,
        "--data-db",
        &data_db_path,
        "--output",
        output_path,
        "--darktable-cli",
        darktable_cli,
        "--image-type",
        image_type,
    ];

    let width_string;
    if !width.is_empty() {
        width_string = width.to_string();
        arguments.push("--width");
        arguments.push(&width_string);
    }

    let height_string;
    if !height.is_empty() {
        height_string = height.to_string();
        arguments.push("--height");
        arguments.push(&height_string);
    }

    if skip_export {
        arguments.push("--skip-export");
    }

    let rating_string;
    if let Some(value) = rating {
        rating_string = value.to_string();
        arguments.push("--rating");
        arguments.push(&rating_string);
    }

    if !color_label.is_empty() {
        arguments.push("--color-label");
        arguments.push(color_label);
    }

    let tag_strings: Vec<String> = tags
        .iter()
        .filter_map(|value| value.as_str().map(|item| item.to_string()))
        .collect();
    if !tag_strings.is_empty() {
        arguments.push("--tags");
        for value in &tag_strings {
            arguments.push(value.as_str());
        }
    }

    let source_path_strings: Vec<String> = source_paths
        .iter()
        .filter_map(|value| value.as_str().map(|item| item.to_string()))
        .collect();
    let source_paths_json;
    if !source_path_strings.is_empty() {
        source_paths_json = match serde_json::to_string(&source_path_strings) {
            Ok(value) => value,
            Err(error) => {
                return WorkerResponse {
                    ok: false,
                    data: None,
                    error: Some(format!("Failed to serialize export source paths: {error}")),
                };
            }
        };
        arguments.push("--source-paths-json");
        arguments.push(&source_paths_json);
    }

    match run_worker_json(&arguments) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_list_export_presets() -> WorkerResponse<Vec<serde_json::Value>> {
    match run_worker_json(&["python/main.py", "list-export-presets"]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_save_export_preset(
    name: String,
    settings: serde_json::Value,
) -> WorkerResponse<Vec<serde_json::Value>> {
    let settings_json = match serde_json::to_string(&settings) {
        Ok(value) => value,
        Err(error) => {
            return WorkerResponse {
                ok: false,
                data: None,
                error: Some(format!("Failed to serialize export preset settings: {error}")),
            }
        }
    };

    match run_worker_json(&[
        "python/main.py",
        "save-export-preset",
        "--name",
        &name,
        "--settings-json",
        &settings_json,
    ]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn worker_manage_tag(
    library_db_path: String,
    data_db_path: String,
    action: String,
    tag_path: String,
    value: String,
) -> WorkerResponse<serde_json::Value> {
    match run_worker_json(&[
        "python/main.py",
        "manage-tag",
        "--library-db",
        &library_db_path,
        "--data-db",
        &data_db_path,
        "--action",
        &action,
        "--tag-path",
        &tag_path,
        "--value",
        &value,
    ]) {
        Ok(payload) => WorkerResponse {
            ok: true,
            data: Some(payload),
            error: None,
        },
        Err(error) => WorkerResponse {
            ok: false,
            data: None,
            error: Some(error),
        },
    }
}

fn darktable_config_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
            return PathBuf::from(local_app_data).join("darktable");
        }
    }

    if cfg!(target_os = "macos") {
        if let Some(home_dir) = env::var_os("HOME") {
            return PathBuf::from(home_dir)
                .join("Library")
                .join("Application Support")
                .join("darktable");
        }
    }

    if let Some(xdg_config_home) = env::var_os("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg_config_home).join("darktable");
    }

    if let Some(home_dir) = env::var_os("HOME") {
        return PathBuf::from(home_dir).join(".config").join("darktable");
    }

    PathBuf::from("darktable")
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            default_darktable_paths,
            worker_ping,
            worker_inspect_library,
            worker_list_tags,
            worker_search_images,
            worker_preview_write_plan,
            worker_apply_metadata_edits,
            worker_list_pending_db_sync,
            worker_retry_pending_db_sync,
            worker_run_export,
            worker_list_export_presets,
            worker_save_export_preset,
            worker_manage_tag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
