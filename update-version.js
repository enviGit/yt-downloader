import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Please provide a new version, e.g.: node update-version.js 1.0.0');
  process.exit(1);
}

const updateJSON = (filePath, keyPath, value) => {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return;

  const fileContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  let current = fileContent;
  for (let i = 0; i < keyPath.length - 1; i++) {
    current = current[keyPath[i]];
  }
  current[keyPath[keyPath.length - 1]] = value;

  fs.writeFileSync(fullPath, JSON.stringify(fileContent, null, 2) + '\n');
  console.log(`Updated ${filePath}`);
};

updateJSON('package.json', ['version'], newVersion);
updateJSON('package-lock.json', ['version'], newVersion);
const lockPath = path.join(__dirname, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  }
}

const tauriConfPath = path.join(__dirname, 'src-tauri/tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  if (tauriConf.package) {
    tauriConf.package.version = newVersion;
  } else {
    tauriConf.version = newVersion;
  }
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log('Updated src-tauri/tauri.conf.json');
}

const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(/(^version\s*=\s*")[^"]+(")/m, `$1${newVersion}$2`);
  fs.writeFileSync(cargoTomlPath, cargoContent);
  console.log('Updated src-tauri/Cargo.toml');
}

try {
  console.log('Updating Cargo.lock...');
  execSync('cd src-tauri && cargo check', { stdio: 'ignore' });
  console.log('Updated src-tauri/Cargo.lock');
} catch (error) {
  console.error('Failed to update Cargo.lock. Make sure Rust is installed.');
}

console.log(`\nVersion successfully changed to: ${newVersion}`);
