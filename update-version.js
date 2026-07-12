const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// 1. Update package.json and package-lock.json
updateJSON('package.json', ['version'], newVersion);
updateJSON('package-lock.json', ['version'], newVersion);
if (fs.existsSync(path.join(__dirname, 'package-lock.json'))) {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'package-lock.json'), 'utf8'));
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
    fs.writeFileSync(path.join(__dirname, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  }
}

// 2. Update tauri.conf.json
updateJSON('src-tauri/tauri.conf.json', ['package', 'version'], newVersion);

// 3. Update Cargo.toml
const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(/(^version\s*=\s*")[^"]+(")/m, `$1${newVersion}$2`);
  fs.writeFileSync(cargoTomlPath, cargoContent);
  console.log('Updated src-tauri/Cargo.toml');
}

// 4. Update Cargo.lock using Cargo check
try {
  console.log('Updating Cargo.lock...');
  execSync('cd src-tauri && cargo check', { stdio: 'ignore' });
  console.log('Updated src-tauri/Cargo.lock');
} catch (error) {
  console.error('Failed to update Cargo.lock. Make sure Rust is installed.');
}

console.log(`\nVersion successfully changed to: ${newVersion}`);
