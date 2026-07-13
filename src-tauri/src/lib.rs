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
    custom_path: Option<String>,
) -> Result<String, String> {
    let mut args = vec![];

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to find resource directory: {}", e))?;

    let ffmpeg_dir = resource_dir.join("ffmpeg_bin");

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

    args.push("--extractor-args".to_string());
    args.push("youtube:player_client=android,web".to_string());

    if format == "audio" {
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
    } else {
        args.push("-f".to_string());
        args.push("bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best".to_string());
        args.push("--merge-output-format".to_string());
        args.push("mp4".to_string());
    }

    args.push("--ffmpeg-location".to_string());
    args.push(ffmpeg_dir.to_string_lossy().to_string());

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

                if text.contains("[download]") && text.contains('%') {
                    let _ = app.emit("ytdlp-stdout", text.clone());
                }

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
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![start_download, file_exists])
        .run(tauri::generate_context!())
        .expect("Error while running the application");
}
