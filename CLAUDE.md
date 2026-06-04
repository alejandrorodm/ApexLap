@AGENTS.md

# ApexLap (repo: LapTimerSaver)

App Expo (React Native + TypeScript) para guardar tiempos de vuelta de Assetto
Corsa con colegas. Backend: Firebase (Auth anónima + Firestore en tiempo real).

- Config de Firebase del usuario en `src/firebase/config.ts` (placeholders
  `PEGA_AQUI_*`). `isFirebaseConfigured` controla la pantalla de setup.
- Servicio de datos en `src/firebase/db.ts`. Estado global en
  `src/context/AppContext.tsx`. Reglas en `firestore.rules`.
- Modelo: `leagues/{id}` con subcolecciones `laps` y `challenges`; `profiles/{uid}`.
- Pantallas en `src/screens/`; navegación (tabs + stack) en `src/navigation/`.
- Datos de coches/circuitos en `src/data/` (el selector permite añadir custom).

Comandos: `npm start` (Expo + QR), `npx tsc --noEmit` (typecheck),
`npx expo export --platform android --output-dir /tmp/x` (bundle de prueba).
