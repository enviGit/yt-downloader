use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn start_download(app: tauri::AppHandle, url: String) -> Result<String, String> {
    Ok(format!("Download started for URL: {}", url))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![start_download])
        .run(tauri::generate_context!())
        .expect("Error while running the application");
}
