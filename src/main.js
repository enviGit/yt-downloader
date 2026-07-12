import { translations } from './i18n.js';
const { invoke } = window.__TAURI__.core;
const { getVersion } = window.__TAURI__.app;

const downloadBtn = document.getElementById('download-btn');
const urlInput = document.getElementById('url-input');
const statusMessage = document.getElementById('status-message');
const updateStatus = document.getElementById('update-status');

let currentLang = 'en';

function updateLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
  urlInput.placeholder = translations[lang].placeholder;
}

document.querySelectorAll('.custom-select').forEach(select => {
  const trigger = select.querySelector('.select-trigger');
  const optionsContainer = select.querySelector('.select-options');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();

    document.querySelectorAll('.select-options').forEach(opt => {
      if (opt !== optionsContainer) opt.classList.remove('open');
    });
    optionsContainer.classList.toggle('open');
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.select-options').forEach(opt => {
    opt.classList.remove('open');
  });
});

document.querySelectorAll('.lang-option').forEach(option => {
  option.addEventListener('click', () => {
    const langValue = option.getAttribute('data-value');
    document.getElementById('language-trigger').textContent = option.textContent;
    updateLanguage(langValue);
  });
});

document.querySelectorAll('.theme-option').forEach(option => {
  option.addEventListener('click', () => {
    const themeValue = option.getAttribute('data-value');
    document.body.className = themeValue;
    document.getElementById('theme-trigger').innerHTML = option.innerHTML;
  });
});

downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value;
  if (!url) return;

  const selectedFormat = document.querySelector('input[name="format"]:checked').value;
  statusMessage.textContent = translations[currentLang].downloading;

  try {
    const response = await invoke('start_download', { url: url });
    statusMessage.textContent = response;
  } catch (error) {
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

    updateLanguage('en');
    checkForUpdates();
