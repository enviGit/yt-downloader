use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[cfg(target_os = "windows")]
fn remove_zone_identifier(path: &Path) {
    let zone_stream = format!("{}:Zone.Identifier", path.display());
    let _ = std::fs::remove_file(zone_stream);
}

#[cfg(not(target_os = "windows"))]
fn remove_zone_identifier(_path: &Path) {}

#[tauri::command]
async fn start_download(
    app: AppHandle,
    url: String,
    format: String,
    quality: String,
    custom_path: Option<String>,
) -> Result<String, String> {
    let download_dir = match custom_path.filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => app
            .path()
            .download_dir()
            .map_err(|e| format!("Failed to get download dir: {}", e))?
            .to_string_lossy()
            .into_owned(),
    };

    let mut args: Vec<String> = vec![
        "--newline".into(),
        "--no-colors".into(),
        "--no-warnings".into(),
        "--yes-playlist".into(),
        "--extractor-args".into(),
        "youtube:player_client=android,web".into(),
    ];

    if format == "audio" {
        let aq = match quality.as_str() {
            "high" => "2",
            "medium" => "5",
            "low" => "9",
            _ => "0",
        };

        args.extend(vec![
            "-x".into(),
            "--audio-format".into(),
            "mp3".into(),
            "--audio-quality".into(),
            aq.into(),
        ]);
    } else {
        let vq = match quality.as_str() {
            "1080p" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "720p" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
            "480p" => "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best",
            _ => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        };

        args.extend(vec![
            "-f".into(),
            vq.into(),
            "--merge-output-format".into(),
            "mp4".into(),
        ]);
    }

    let possible_dirs = [
        app.path()
            .resource_dir()
            .unwrap_or_default()
            .join("ffmpeg_bin"),
        std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new(""))
            .join("ffmpeg_bin"),
        std::env::current_dir()
            .unwrap_or_default()
            .join("ffmpeg_bin"),
        std::env::current_dir()
            .unwrap_or_default()
            .join("src-tauri")
            .join("ffmpeg_bin"),
    ];

    let mut ffmpeg_debug_path = String::new();

    if let Some(dir) = possible_dirs
        .into_iter()
        .find(|d| d.exists() && !d.as_os_str().is_empty())
    {
        let ffmpeg_exe = dir.join(if cfg!(target_os = "windows") {
            "ffmpeg.exe"
        } else {
            "ffmpeg"
        });
        let ffprobe_exe = dir.join(if cfg!(target_os = "windows") {
            "ffprobe.exe"
        } else {
            "ffprobe"
        });

        remove_zone_identifier(&ffmpeg_exe);
        remove_zone_identifier(&ffprobe_exe);

        let raw_path = dir.to_string_lossy().into_owned();

        let clean_path = raw_path
            .strip_prefix("\\\\?\\")
            .unwrap_or(&raw_path)
            .replace('\\', "/");

        ffmpeg_debug_path = clean_path.clone();

        args.extend(vec!["--ffmpeg-location".into(), clean_path]);
    }

    args.extend(vec![
        "-P".into(),
        download_dir,
        "-o".into(),
        "%(title)s [%(id)s].%(ext)s".into(),
        url,
    ]);

    let (mut rx, _child) = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| format!("Failed to initialize process: {}", e))?
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    let mut last_path = String::new();
    let mut error_output = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line).into_owned();
                let _ = app.emit("ytdlp-stdout", text.clone());

                if text.contains("Destination: ") || text.contains("Merging formats into \"") {
                    if let Some(p) = text
                        .split('"')
                        .nth(1)
                        .or_else(|| text.split("Destination: ").last())
                    {
                        last_path = p.trim().to_string();
                    }
                }
            }
            CommandEvent::Stderr(line) => {
                error_output.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Terminated(payload) => {
                if payload.code == Some(0) {
                    return Ok(last_path);
                } else {
                    return Err(format!(
                        "FFmpeg path: '{}' | Error log: {}",
                        ffmpeg_debug_path, error_output
                    ));
                }
            }
            _ => {}
        }
    }

    Ok(last_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![start_download, file_exists])
        .run(tauri::generate_context!())
        .expect("Error while running the application");
}
