import { translations } from './i18n.js';

const { invoke } = window.__TAURI__.core;
const { convertFileSrc } = window.__TAURI__.core;
const { getVersion } = window.__TAURI__.app;
const { listen } = window.__TAURI__.event;

const downloadBtn = document.getElementById('download-btn');
const urlInput = document.getElementById('url-input');
const statusMessage = document.getElementById('status-message');
const updateStatus = document.getElementById('update-status');
const checkUpdateBtn = document.getElementById('check-update-btn');

const selectFolderBtn = document.getElementById('select-folder-btn');
const resetFolderBtn = document.getElementById('reset-folder-btn');
const selectedFolderPathSpan = document.getElementById('selected-folder-path');
const radioFormatInputs = document.querySelectorAll('input[name="format"]');

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStats = document.getElementById('progress-stats');
const mediaPreviewBlock = document.getElementById('media-preview');
const videoPlayer = document.getElementById('video-player');
const audioPlayer = document.getElementById('audio-player');

const savedLang = localStorage.getItem('appLang') || 'en';
const savedTheme = localStorage.getItem('appTheme') || 'theme-orchid-plum';
const savedFormat = localStorage.getItem('appFormat') || 'video';
let customDownloadPath = localStorage.getItem('appDownloadPath') || null;

let currentLang = savedLang;
let isDownloading = false;
let downloadPhase = 1;
let lastPercentage = 0;
let selectedFormat = savedFormat;
let currentFilePath = "";
let fileCheckInterval = null;
let targetPercent = 0;
let currentPercent = 0;
let animationFrameId = null;

const formatVideoRadio = document.getElementById('format-video');
const formatAudioRadio = document.getElementById('format-audio');
if (savedFormat === 'audio') {
  formatAudioRadio.checked = true;
} else {
  formatVideoRadio.checked = true;
}

radioFormatInputs.forEach(input => {
  input.addEventListener('change', (e) => {
    selectedFormat = e.target.value;
    localStorage.setItem('appFormat', selectedFormat);
  });
});

function updateFolderUI() {
  if (customDownloadPath) {
    selectedFolderPathSpan.textContent = customDownloadPath.length > 30 ? "..." + customDownloadPath.slice(-27) : customDownloadPath;
    selectedFolderPathSpan.title = customDownloadPath;
    selectedFolderPathSpan.removeAttribute('data-i18n');
    resetFolderBtn.classList.remove('hidden');
  } else {
    selectedFolderPathSpan.setAttribute('data-i18n', 'defaultFolder');
    selectedFolderPathSpan.textContent = translations[currentLang]?.defaultFolder || translations['en'].defaultFolder;
    selectedFolderPathSpan.title = "";
    resetFolderBtn.classList.add('hidden');
  }
}

if (customDownloadPath) {
  invoke('file_exists', { path: customDownloadPath }).then(exists => {
    if (!exists) {
      customDownloadPath = null;
      localStorage.removeItem('appDownloadPath');
    }
    updateFolderUI();
  });
} else {
  updateFolderUI();
}

const ytRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|playlist\?list=)|youtu\.be\/).+$/;

function validateUrl() {
  const isValid = ytRegex.test(urlInput.value.trim());
  downloadBtn.disabled = !isValid;
}

urlInput.addEventListener('input', validateUrl);
downloadBtn.disabled = true;

selectFolderBtn.addEventListener('click', async () => {
  try {
    const selected = await window.__TAURI__.dialog.open({
      directory: true,
      multiple: false,
      title: "Select Download Directory"
    });
    if (selected) {
      customDownloadPath = selected;
      localStorage.setItem('appDownloadPath', selected);
      updateFolderUI();
    }
  } catch (error) {
    console.error("Folder selection failed:", error);
  }
});

resetFolderBtn.addEventListener('click', () => {
  customDownloadPath = null;
  localStorage.removeItem('appDownloadPath');
  updateFolderUI();
});

function updateLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
  if (translations[lang]) {
    urlInput.placeholder = translations[lang].placeholder;
  }
}

document.body.className = savedTheme;
updateLanguage(savedLang);

window.addEventListener('DOMContentLoaded', () => {
  const activeLangOpt = document.querySelector(`.lang-option[data-value="${savedLang}"]`);
  if (activeLangOpt) {
    document.getElementById('language-trigger').innerHTML = activeLangOpt.innerHTML;
  }

  const activeThemeOpt = document.querySelector(`.theme-option[data-value="${savedTheme}"]`);
  if (activeThemeOpt) {
    document.getElementById('theme-trigger').innerHTML = activeThemeOpt.innerHTML;
  }
});

document.querySelectorAll('.custom-select').forEach(select => {
  const trigger = select.querySelector('.select-trigger');
  const optionsContainer = select.querySelector('.select-options');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.select-options').forEach(opt => {
      if (opt !== optionsContainer) {
        opt.classList.remove('open');
        opt.previousElementSibling.classList.remove('active');
      }
    });
    optionsContainer.classList.toggle('open');
    trigger.classList.toggle('active');
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.select-options').forEach(opt => {
    opt.classList.remove('open');
  });
  document.querySelectorAll('.select-trigger').forEach(trigger => {
    trigger.classList.remove('active');
  });
});

document.querySelectorAll('.lang-option').forEach(option => {
  option.addEventListener('click', () => {
    const langValue = option.getAttribute('data-value');
    document.getElementById('language-trigger').innerHTML = option.innerHTML;
    updateLanguage(langValue);
    localStorage.setItem('appLang', langValue);
  });
});

document.querySelectorAll('.theme-option').forEach(option => {
  option.addEventListener('click', () => {
    const themeValue = option.getAttribute('data-value');
    document.body.className = themeValue;
    document.getElementById('theme-trigger').innerHTML = option.innerHTML;
    localStorage.setItem('appTheme', themeValue);
  });
});

const stopAndResetPlayers = () => {
  if (fileCheckInterval) {
    clearInterval(fileCheckInterval);
    fileCheckInterval = null;
  }
  currentFilePath = "";

  mediaPreviewBlock.classList.remove('visible');
  videoPlayer.classList.remove('visible');
  audioPlayer.classList.remove('visible');

  setTimeout(() => {
    [videoPlayer, audioPlayer].forEach(p => {
      p.pause();
      p.currentTime = 0;
      p.removeAttribute('src');
      p.load();
    });
  }, 500);
};

const handleMediaError = (e) => {
  if (isDownloading) return;
  const currentSrc = e.target.getAttribute('src');
  if (!currentSrc || currentSrc.trim() === '') return;

  stopAndResetPlayers();
  statusMessage.textContent = "Media file moved, deleted or corrupted.";
};

videoPlayer.addEventListener('error', handleMediaError);
audioPlayer.addEventListener('error', handleMediaError);

function smoothProgressLoop() {
  if (!isDownloading && Math.abs(targetPercent - currentPercent) < 0.1) {
    currentPercent = targetPercent;
    updateProgressBarDOM(currentPercent);
    animationFrameId = null;
    return;
  }

  if (progressBar.classList.contains('indeterminate') && targetPercent >= 95) {
    if (targetPercent < 99.8) {
      targetPercent += 0.01;
    }
  }

  const diff = targetPercent - currentPercent;
  if (diff > 0) {
     currentPercent += diff * 0.08;
  }

  if (currentPercent > 99.9 && isDownloading) {
      currentPercent = 99.9;
  }

  updateProgressBarDOM(currentPercent);
  animationFrameId = requestAnimationFrame(smoothProgressLoop);
}

function updateProgressBarDOM(val) {
  if (!progressBar.classList.contains('indeterminate')) {
    progressBar.style.width = val.toFixed(1) + '%';
    document.getElementById('progress-percent').textContent = Math.floor(val) + '%';
  }
}

listen('ytdlp-stdout', (event) => {
  const line = event.payload;

  if (line.includes('[ExtractAudio]') || line.includes('[Destination]') && selectedFormat === 'audio' && lastPercentage > 90) {
    progressBar.classList.add('indeterminate');
    statusMessage.textContent = "Extracting audio and converting to MP3...";
    document.getElementById('progress-percent').textContent = "99%";
    document.getElementById('progress-speed').textContent = "Processing...";
    targetPercent = 99.5;
    return;
  }

  if (line.includes('[download]') && line.includes('%')) {
    progressBar.classList.remove('indeterminate');

    const percentMatch = line.match(/(\d+\.\d+)%/);
    if (percentMatch) {
      const p = parseFloat(percentMatch[1]);

      if (p < lastPercentage && (lastPercentage - p) > 5) {
         return;
      }

      let displayPercent = p;
      if (selectedFormat === 'video') {
         if (p < lastPercentage || downloadPhase === 2) {
             downloadPhase = 2;
             displayPercent = 85 + (p * 0.14);
         } else {
             displayPercent = p * 0.85;
         }
      } else {
         displayPercent = p * 0.95;
      }

      lastPercentage = p;
      targetPercent = displayPercent;
    }

    const speedMatch = line.match(/at\s+~?\s*([0-9.]+[a-zA-Z]+\/s)/);
    const etaMatch = line.match(/ETA\s+([\d:]+)/);

    if (speedMatch && !speedMatch[1].startsWith("0.0")) {
        document.getElementById('progress-speed').textContent = speedMatch[1];
    }

    if (etaMatch && etaMatch[1] !== "00:00") {
        document.getElementById('progress-eta').textContent = 'ETA: ' + etaMatch[1];
    }
  }
});

downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value;
  if (!url || downloadBtn.disabled) return;

  if (customDownloadPath) {
      const exists = await invoke('file_exists', { path: customDownloadPath });
      if (!exists) {
        customDownloadPath = null;
        localStorage.removeItem('appDownloadPath');
        updateFolderUI();
        const t = translations[currentLang] || translations['en'];
        statusMessage.textContent = t.folderMissingError || "Selected folder no longer exists! Reverted to default. Please click download again.";        return;
      }
    }

  isDownloading = true;
  downloadPhase = 1;
  lastPercentage = 0;
  targetPercent = 0;
  currentPercent = 0;

  selectedFormat = document.querySelector('input[name="format"]:checked').value;

  const t = translations[currentLang] || translations['en'];
  statusMessage.textContent = t.downloading || "Starting download...";

  stopAndResetPlayers();

  progressBar.style.width = '0%';
  progressBar.classList.add('indeterminate');

  document.getElementById('progress-percent').textContent = 'Connecting...';
  document.getElementById('progress-speed').textContent = '0 KB/s';
  document.getElementById('progress-eta').textContent = 'ETA: --:--';

  progressContainer.classList.add('active');
  progressStats.classList.add('visible');

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(smoothProgressLoop);
  }

  try {
    const downloadedFilePath = await invoke('start_download', {
      url: url,
      format: selectedFormat,
      customPath: customDownloadPath
    });

    progressBar.classList.remove('indeterminate');
    targetPercent = 100;

    await new Promise(resolve => setTimeout(resolve, 450));

    isDownloading = false;
    progressContainer.classList.remove('active');
    progressStats.classList.remove('visible');

    if (!downloadedFilePath.includes('/') && !downloadedFilePath.includes('\\')) {
       statusMessage.textContent = downloadedFilePath;
       return;
    }

    statusMessage.textContent = "Download complete!";

    setTimeout(() => {
      currentFilePath = downloadedFilePath;
      const secureUrl = convertFileSrc(downloadedFilePath) + '?t=' + Date.now();

      mediaPreviewBlock.classList.add('visible');

      if (selectedFormat === 'video') {
        videoPlayer.src = secureUrl;
        videoPlayer.classList.add('visible');
      } else {
        audioPlayer.src = secureUrl;
        audioPlayer.classList.add('visible');
      }

      fileCheckInterval = setInterval(async () => {
        if (!currentFilePath) return;
        const exists = await invoke('file_exists', { path: currentFilePath });
        if (!exists) {
          stopAndResetPlayers();
          statusMessage.textContent = "Media file moved or deleted from disk.";
        }
      }, 1000);

    }, 250);

  } catch (error) {
    isDownloading = false;
    progressBar.classList.remove('indeterminate');
    progressContainer.classList.remove('active');
    progressStats.classList.remove('visible');
    statusMessage.textContent = "Error: " + error;
  }
});

checkUpdateBtn.addEventListener('click', async () => {
  try {
    const currentVersion = await getVersion();
    const repoUrl = 'https://github.com/enviGit/yt-downloader/releases/latest';
    const apiUrl = 'https://api.github.com/repos/enviGit/yt-downloader/releases/latest';

    updateStatus.textContent = "Checking...";

    const response = await fetch(apiUrl);
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');

    if (latestVersion !== currentVersion) {
      updateStatus.innerHTML = `Update available: <span class="update-link" id="update-link">${data.tag_name}</span>`;
      document.getElementById('update-link').addEventListener('click', () => {
        invoke('plugin:shell|open', { path: repoUrl });
      });
    } else {
      const t = translations[currentLang] || translations['en'];
      updateStatus.textContent = t.upToDate || "Up to date";
    }
  } catch (error) {
    updateStatus.textContent = 'Error checking for updates';
  }
});
