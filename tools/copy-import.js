const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcFile = path.join(rootDir, 'tools', 'web-import', 'index.html');
const distImportDir = path.join(rootDir, 'dist', 'import');
const distFile = path.join(distImportDir, 'index.html');

try {
  if (fs.existsSync(srcFile)) {
    fs.mkdirSync(distImportDir, { recursive: true });
    fs.copyFileSync(srcFile, distFile);
    console.log('✓ Importador web copiado a dist/import/index.html');
  }
} catch (e) {
  console.log('Aviso: No se pudo copiar web-import:', e.message);
}
