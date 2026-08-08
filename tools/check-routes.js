// Comprueba que las URLs de la web (src/navigation/routes.ts) van y vuelven:
// cada ruta se convierte en estado de navegación y ese estado reconstruye la
// misma URL. Pilla erratas y rutas ambiguas sin tener que abrir el navegador.
//
//   node tools/check-routes.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const {
  getStateFromPath,
  getPathFromState,
} = require('@react-navigation/core');

const rootDir = path.resolve(__dirname, '..');

// Compila routes.ts a JS (no importa nada, así que sale un módulo limpio).
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apexlap-routes-'));
execFileSync(
  path.join(rootDir, 'node_modules', '.bin', 'tsc'),
  [
    path.join(rootDir, 'src', 'navigation', 'routes.ts'),
    '--ignoreConfig',
    '--outDir',
    outDir,
    '--module',
    'commonjs',
    '--target',
    'es2019',
  ],
  { stdio: 'inherit' }
);
const { ROUTE_CONFIG } = require(path.join(outDir, 'routes.js'));

// Rutas que tienen que funcionar al pegarlas en la barra de direcciones.
const CASES = [
  '/',
  '/records',
  '/piques',
  '/muro',
  '/liga',
  '/perfil',
  '/nueva-vuelta',
  '/pique/abc123',
  '/pilotos',
  '/circuito/Spa-Francorchamps',
  '/nuevo-pique',
  '/comparar/Monza',
  '/cara-a-cara/uid-a/uid-b',
  '/progreso',
  '/temporada',
  '/habilidad',
];

let failures = 0;
for (const url of CASES) {
  const state = getStateFromPath(url, ROUTE_CONFIG);
  if (!state) {
    console.error(`✗ ${url} → no casa con ninguna pantalla`);
    failures++;
    continue;
  }
  const back = getPathFromState(state, ROUTE_CONFIG);
  // getPathFromState normaliza la raíz a '/' y no añade query si no hay params.
  const same = back === url || back === `${url}/` || `${back}/` === url;
  if (!same) {
    console.error(`✗ ${url} → vuelve como ${back}`);
    failures++;
  } else {
    console.log(`✓ ${url}`);
  }
}

// Una ruta inventada no debe reventar ni colarse como otra pantalla.
const bogus = getStateFromPath('/no-existe-esta-ruta', ROUTE_CONFIG);
console.log(
  bogus
    ? `· /no-existe-esta-ruta cae en: ${JSON.stringify(bogus.routes?.[0]?.name)}`
    : '· /no-existe-esta-ruta no casa con nada (la app abrirá la portada)'
);

fs.rmSync(outDir, { recursive: true, force: true });

if (failures) {
  console.error(`\n${failures} ruta(s) mal.`);
  process.exit(1);
}
console.log('\nTodas las rutas van y vuelven.');
