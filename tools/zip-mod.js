const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipFile = path.join(distDir, 'ApexLap-mod.zip');

fs.mkdirSync(distDir, { recursive: true });

if (fs.existsSync(zipFile)) {
  try {
    fs.unlinkSync(zipFile);
  } catch {}
}

try {
  if (process.platform === 'win32') {
    const srcPath = path.join(rootDir, 'tools', 'ApexLap', '*');
    execSync(`powershell -Command "Compress-Archive -Path '${srcPath}' -DestinationPath '${zipFile}' -Force"`, { stdio: 'inherit' });
  } else {
    const toolsDir = path.join(rootDir, 'tools');
    execSync(`cd "${toolsDir}" && zip -rq "${zipFile}" ApexLap -x '*/.DS_Store'`, { stdio: 'inherit' });
  }
  console.log('✓ ApexLap-mod.zip creado en dist/');
} catch (e) {
  console.log('Aviso: Se omite compresión del mod (.zip):', e.message);
}
