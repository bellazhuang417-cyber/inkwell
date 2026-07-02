use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use notify::{recommended_watcher, RecursiveMode, Watcher, Event};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    ext: Option<String>,
    children: Option<Vec<FileNode>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    path: String,
    content: String,
    ext: String,
}

struct WatcherState(Mutex<Option<Box<dyn Watcher + Send>>>);

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".cache",
    ".turbo",
    "vendor",
];

#[tauri::command]
fn read_directory(dir_path: String, depth: Option<usize>) -> Result<Vec<FileNode>, String> {
    read_directory_inner(&dir_path, depth.unwrap_or(3))
}

fn read_directory_inner(dir_path: &str, max_depth: usize) -> Result<Vec<FileNode>, String> {
    let path = PathBuf::from(dir_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let mut nodes = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;

    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_is_dir.cmp(&a_is_dir).then_with(|| {
            a.file_name()
                .to_string_lossy()
                .to_lowercase()
                .cmp(&b.file_name().to_string_lossy().to_lowercase())
        })
    });

    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let file_path = entry.path();
        let is_dir = file_path.is_dir();

        if is_dir && SKIP_DIRS.contains(&name.to_lowercase().as_str()) {
            continue;
        }

        let ext = file_path
            .extension()
            .map(|e| e.to_string_lossy().to_string());

        let children = if is_dir && max_depth > 0 {
            Some(read_directory_inner(&file_path.to_string_lossy(), max_depth - 1).unwrap_or_default())
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: file_path.to_string_lossy().to_string(),
            is_dir,
            ext,
            children,
        });
    }

    Ok(nodes)
}

#[tauri::command]
fn read_file(file_path: String) -> Result<FileContent, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    if path.is_dir() {
        return Err(format!("Path is a directory: {}", file_path));
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileContent {
        path: file_path,
        content,
        ext,
    })
}

#[tauri::command]
fn write_file(file_path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

#[tauri::command]
fn watch_directory(path: String, app: AppHandle, state: State<WatcherState>) -> Result<(), String> {
    let app_handle = app.clone();

    let mut watcher = recommended_watcher(move |res: Result<Event, notify::Error>| {
        if res.is_ok() {
            let _ = app_handle.emit("directory-changed", ());
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *state.0.lock().unwrap() = Some(Box::new(watcher));
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file,
            write_file,
            get_home_dir,
            watch_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
