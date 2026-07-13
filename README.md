# YT Downloader

Desktop application for downloading video and audio files from YouTube. Built with Tauri, Rust, and JavaScript using modern user interface standards.

## Features

- **Asynchronous Processing:** Downloads and conversions run entirely in background threads, keeping the user interface smooth.
- **Format Options:** Supports high-quality MP4 video downloads and direct MP3 audio extraction.
- **Real-time Progress Tracking:** Live data display including progress bar percentage, download speed, and estimated time (ETA).
- **Media Preview:** Instant video and audio playback directly inside the app container after successful download.
- **Theme Customization:** Saved interface configurations including light and dark modes (Orchid & Plum, Neon & Violet, Mint & Graphite, Lime & Olive).
- **Internationalization:** Multi-language menu support with automatic choice memory (EN, ES, FR, DE, IT, PT, PL, ZH, JA, KO).

## Prerequisites

The application uses external binaries under the hood. You need to prepare them manually before running the development server.

### 1. yt-dlp (Sidecars)
Place native binaries in `src-tauri/binaries/` named strictly after target architectures:
- Mac Apple Silicon: `yt-dlp-aarch64-apple-darwin`
- Mac Intel: `yt-dlp-x86_64-apple-darwin`
- Windows 64-bit: `yt-dlp-x86_64-pc-windows-msvc.exe`

### 2. FFmpeg & FFprobe (Resources)
Create `src-tauri/ffmpeg_bin/` folder and drop static executions inside:
- For macOS: `ffmpeg` and `ffprobe` (Unpacked binary files, no extension)
- For Windows: `ffmpeg.exe` and `ffprobe.exe`

### 3. Clear OS Quarantine (macOS only)
If your operating system blocks execution of these tools, run this inside project root directory:

```bash
# Give execution rights
chmod +x src-tauri/binaries/yt-dlp-* src-tauri/ffmpeg_bin/*

# Remove quarantine flags
xattr -d com.apple.quarantine src-tauri/binaries/* src-tauri/ffmpeg_bin/* 2>/dev/null || true
```

## Development and Setup

Install dependencies:
```bash
npm install
```

Run application in development mode:
```bash
npm run tauri dev
```

Build standalone installer:
```bash
npm run tauri build
```

## License

This project is open-source and available under the terms of the [MIT License](LICENSE).
