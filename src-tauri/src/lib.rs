use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
async fn start_download(
    app: AppHandle,
    url: String,
    format: String,
    quality: String,
    custom_path: Option<String>,
) -> Result<String, String> {
    let mut args = vec![];

    let download_dir = match custom_path {
        Some(p) if !p.is_empty() => p,
        _ => {
            let default_dir = app
                .path()
                .download_dir()
                .map_err(|e| format!("Failed to get download dir: {}", e))?;
            default_dir.to_string_lossy().to_string()
        }
    };

    args.push("--newline".to_string());
    args.push("--no-colors".to_string());
    args.push("--no-warnings".to_string());
    args.push("--yes-playlist".to_string());
    args.push("--extractor-args".to_string());
    args.push("youtube:player_client=android,web".to_string());

    if format == "audio" {
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
        args.push("--audio-quality".to_string());

        let aq = match quality.as_str() {
            "high" => "2",
            "medium" => "5",
            "low" => "9",
            _ => "0",
        };
        args.push(aq.to_string());
    } else {
        args.push("-f".to_string());

        let vq = match quality.as_str() {
            "1080p" => "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "720p" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
            "480p" => "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best",
            _ => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        };
        args.push(vq.to_string());

        args.push("--merge-output-format".to_string());
        args.push("mp4".to_string());
    }

    let mut ffmpeg_path_str = String::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        let dir = resource_dir.join("ffmpeg_bin");
        if dir.exists() {
            ffmpeg_path_str = dir.to_string_lossy().to_string();
        }
    }

    if ffmpeg_path_str.is_empty() {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                let dir = parent.join("ffmpeg_bin");
                if dir.exists() {
                    ffmpeg_path_str = dir.to_string_lossy().to_string();
                }
            }
        }
    }

    if ffmpeg_path_str.is_empty() {
        if let Ok(cwd) = std::env::current_dir() {
            let dir = cwd.join("ffmpeg_bin");
            if dir.exists() {
                ffmpeg_path_str = dir.to_string_lossy().to_string();
            }
        }
    }

    if !ffmpeg_path_str.is_empty() {
        if ffmpeg_path_str.starts_with("\\\\?\\") {
            ffmpeg_path_str = ffmpeg_path_str.replace("\\\\?\\", "");
        }
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg_path_str);
    }

    args.push("-P".to_string());
    args.push(download_dir);

    args.push("-o".to_string());
    args.push("%(title)s [%(id)s].%(ext)s".to_string());

    args.push(url.clone());

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
                let text = String::from_utf8_lossy(&line).to_string();

                let _ = app.emit("ytdlp-stdout", text.clone());

                if text.contains("Destination: ") || text.contains("Merging formats into \"") {
                    if let Some(p) = text
                        .split('"')
                        .nth(1)
                        .or(text.split("Destination: ").last())
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
                    return Err(error_output);
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
