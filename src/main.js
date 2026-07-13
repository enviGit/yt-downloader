import { translations } from './i18n.js';

const { invoke } = window.__TAURI__.core;
const { convertFileSrc } = window.__TAURI__.core;
const { getVersion } = window.__TAURI__.app;
const { listen } = window.__TAURI__.event;

const downloadBtn = document.getElementById('download-btn');
const urlInput = document.getElementById('url-input');
const statusMessage = document.getElementById('status-message');
const updateStatus = document.getElementById('update-status');

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStats = document.getElementById('progress-stats');
const mediaPreviewBlock = document.getElementById('media-preview');
const videoPlayer = document.getElementById('video-player');
const audioPlayer = document.getElementById('audio-player');

const savedLang = localStorage.getItem('appLang') || 'en';
const savedTheme = localStorage.getItem('appTheme') || 'theme-orchid-plum';
let currentLang = savedLang;

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
  [videoPlayer, audioPlayer].forEach(p => {
    p.pause();
    p.currentTime = 0;
    p.src = "";
    p.load();
    p.classList.add('hidden');
  });
  mediaPreviewBlock.classList.add('hidden');
};

const handleMediaError = (e) => {
  e.target.pause();
  e.target.removeAttribute('src');
  e.target.load();

  mediaPreviewBlock.classList.add('hidden');
  videoPlayer.classList.add('hidden');
  audioPlayer.classList.add('hidden');
  statusMessage.textContent = "Preview error: Could not load media.";
};

videoPlayer.addEventListener('error', handleMediaError);
audioPlayer.addEventListener('error', handleMediaError);

let lastPercentage = 0;
listen('ytdlp-stdout', (event) => {
  const line = event.payload;

  if (line.includes('[download]') && line.includes('%')) {
    const percentMatch = line.match(/(\d+\.\d+)%/);
    if (percentMatch) {
      const p = parseFloat(percentMatch[1]);

      if (p >= lastPercentage) {
          lastPercentage = p;
          progressBar.style.width = p + '%';
          document.getElementById('progress-percent').textContent = p + '%';
      }
    }

    const speedMatch = line.match(/at\s+~?\s*([0-9.]+[a-zA-Z]+\/s)/);
    const etaMatch = line.match(/ETA\s+([\d:]+)/);

    if (speedMatch) document.getElementById('progress-speed').textContent = speedMatch[1];
    if (etaMatch) document.getElementById('progress-eta').textContent = 'ETA: ' + etaMatch[1];
  }
});

downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value;
  if (!url) return;

  const selectedFormat = document.querySelector('input[name="format"]:checked').value;
  const t = translations[currentLang] || translations['en'];
  statusMessage.textContent = t.downloading || "Starting download...";

  stopAndResetPlayers();

  mediaPreviewBlock.classList.add('hidden');
  videoPlayer.classList.add('hidden');
  audioPlayer.classList.add('hidden');

  progressBar.style.width = '0%';
  document.getElementById('progress-percent').textContent = '0%';
  document.getElementById('progress-speed').textContent = '0 KB/s';
  document.getElementById('progress-eta').textContent = 'ETA: --:--';

  progressContainer.classList.add('active');
  progressStats.classList.remove('hidden');

  try {
    const downloadedFilePath = await invoke('start_download', {
      url: url,
      format: selectedFormat
    });

    progressContainer.classList.remove('active');
    progressStats.classList.add('hidden');
    lastPercentage = 0;

    statusMessage.textContent = "Download complete!";

    setTimeout(() => {
      const secureUrl = convertFileSrc(downloadedFilePath) + '?t=' + Date.now();
      mediaPreviewBlock.classList.remove('hidden');

      if (selectedFormat === 'video') {
        videoPlayer.src = secureUrl;
        videoPlayer.classList.remove('hidden');
      } else {
        audioPlayer.src = secureUrl;
        audioPlayer.classList.remove('hidden');
      }
    }, 200);

  } catch (error) {
    progressContainer.classList.remove('active');
    progressStats.classList.add('hidden');
    statusMessage.textContent = "Error: " + error;
  }
});

async function checkForUpdates() {
  try {
    const currentVersion = await getVersion();
    const repoUrl = 'https://api.github.com/repos/enviGit/yt-downloader/releases/latest';

    const response = await fetch(repoUrl);
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');

    if (latestVersion !== currentVersion) {
      updateStatus.textContent = translations[currentLang].updateAvailable + data.tag_name;
      updateStatus.style.color = 'var(--primary)';
    } else {
      updateStatus.textContent = translations[currentLang].upToDate;
    }
  } catch (error) {
    updateStatus.textContent = '';
  }
}

checkForUpdates();
