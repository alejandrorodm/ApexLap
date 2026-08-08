# 🏁 ApexLap — Informe del proyecto

App para guardar y competir con los tiempos de vuelta de **Assetto Corsa** entre
colegas. Hecha con **Expo (React Native + TypeScript)** y **Firebase**
(Authentication + Firestore en tiempo real).

- **Web en vivo:** https://apexlap.web.app
- **Repositorio:** https://github.com/alejandrorodm/ApexLap

> Nota: el proyecto de Firebase es `apexlap`. El anterior, `laptimersaver`, sigue
> declarado en `.firebaserc` como `old` por si queda algo que rescatar, pero la app
> ya no lo usa (ver `src/firebase/config.ts`).

---

## ¿Qué hace la app?

- **Ligas privadas**: creas una liga y compartes un código de 5 caracteres (o un
  enlace `…/?join=CÓDIGO`) para que se unan tus colegas.
- **Tiempos**: registras vuelta = coche + circuito + tiempo + condiciones (seco /
  mojado / mixto) + ayudas + caja. Todo en tiempo real para toda la liga.
- **Récords**: mejor vuelta por cada combinación coche+circuito, con su poseedor.
- **Ruleta de piques**: sortea coche + circuito (+ condiciones) tipo tragaperras y
  convoca un "pique" (reto) para la liga. Permite fijar coche o circuito.
- **Notificaciones push** (Android nativo) cuando alguien registra una vuelta.
- **Muro**: actividad de la liga en tiempo real (vueltas, récords robados, piques).
- **Cara a cara, Progreso, Temporada y Habilidad**: comparativas entre dos pilotos
  y evolución propia.
- **Mod de Assetto Corsa** (`tools/ApexLap/`, app de CSP en Lua) que detecta la
  vuelta y la sube sola, más un **subidor de Content Manager**
  (`tools/cm-uploader/`, Python). El `.zip` del mod se descarga desde Perfil.

## 🆕 Puntos y apuestas (nuevo)

Sistema competitivo de liga, decidido contigo:

### Puntos por pique ganado
- Cada pique tiene estado **abierto → cerrado**.
- El **creador del pique** lo cierra cuando toca: se calcula el ganador (la vuelta
  válida más rápida registrada en ese pique) y se reparten los puntos.
- **Ganar un pique = +10 puntos.**

### Apuestas (predecir al ganador)
- Mientras el pique está abierto, cada piloto puede **apostar por quién ganará**
  — incluido **apostar por sí mismo** o por otro.
- Si aciertas el ganador: **+5 puntos**. (Una apuesta por piloto, se puede cambiar
  mientras el pique siga abierto.)

### Clasificación
- Nueva pestaña **Liga 🏆** con la tabla de puntos: posición, piques ganados (🏆),
  apuestas acertadas (🎯) y puntos totales.

> Valores configurables en `src/utils/leaderboard.ts` (`POINTS = { win: 10, correctBet: 5 }`).

## 🔐 Cuentas

- **Email + contraseña**, **Google** (por ahora solo en la versión web) y
  **"Entrar como invitado"** (anónimo, datos solo en ese dispositivo).
- Si entras como invitado y luego creas una cuenta, se conservan tus datos.
- En **Perfil** puedes ver tu cuenta y **cerrar sesión**.

---

## Arquitectura

```
src/
  screens/      Onboarding, Auth, Setup, Laps, Records, Roulette, Feed (Muro),
                Standings (Liga), Challenge, NewChallenge, Participants,
                TrackDetail, Compare, H2H, Progress, Season, Skill,
                Profile, AddLap
  navigation/   Tabs (Tiempos · Récords · Piques · Muro · Liga · Perfil) + stack
  firebase/     config.ts (claves) · db.ts (acceso a Firestore)
  context/      AppContext.tsx (sesión + perfil + liga + vueltas)
  utils/        leaderboard.ts (puntos, récords, clasificación) · time · alerts
  data/         cars.ts · tracks.ts (roster del juego base; admite custom)
```

**Modelo de datos (Firestore):**
```
profiles/{uid}                                   → perfil del piloto
leagues/{id}                                     → liga (code, createdBy…)
leagues/{id}/laps/{lapId}                        → vuelta
leagues/{id}/challenges/{cid}                    → pique (status, winner…)
leagues/{id}/challenges/{cid}/bets/{uid}         → apuesta de un piloto
```

Reglas de seguridad en `firestore.rules` (cada quien gestiona lo suyo; las apuestas
solo las escribe su dueño y solo si el pique no está cerrado).

## Comandos

| Acción | Comando |
| --- | --- |
| Desarrollo (QR) | `npm start` |
| Typecheck | `npx tsc --noEmit` |
| Bundle de prueba (web) | `npx expo export --platform web --output-dir /tmp/x` |
| Build web | `npm run build:web` |
| Desplegar todo (web + mod + reglas) | `npm run deploy:web` |
| Desplegar solo reglas | `npx firebase-tools deploy --only firestore:rules` |
| Build APK (EAS) | `npm run build:apk` |

---

## ✅ Estado actual (8 de agosto de 2026)

- **Web desplegada y al día**: el bundle en vivo en https://apexlap.web.app coincide
  con el de `dist/`, e incluye todo lo del 7-8 de agosto (muro navegable, cara a
  cara, acuse de recibo al guardar vuelta, piques con líder y delta).
- **Reglas de Firestore desplegadas**: comprobado el 8 de agosto; el despliegue
  respondió *"already up to date"*, así que la versión en producción es la de
  `firestore.rules`.
- **`ApexLap-mod.zip` publicado** y descargable desde Perfil.
- **Authentication**: Email/Password activo (verificado contra la API). El acceso
  como invitado y el de Google (web) están en uso.
- `git`: rama `main` limpia y sincronizada con `origin/main`.

## 🆕 Mejoras de la web (hechas, **sin desplegar** todavía)

- **Compartir el enlace ya se ve**: `tools/web-assets.js` inyecta tras el export
  el idioma, la descripción, Open Graph/Twitter con una tarjeta 1200×630
  generada desde el icono (`dist/og.png`), `theme-color` y un **manifiesto PWA**
  con sus iconos, así que también se puede instalar desde el navegador.
- **URLs de verdad**: `/pique/:id`, `/circuito/:nombre`, `/liga`, `/muro`… Se
  puede compartir una pantalla concreta, recargar sin perderse y usar el botón
  Atrás del navegador. El mapa vive en `src/navigation/routes.ts` y
  `npm run check:routes` comprueba que todas las rutas van y vuelven.
- **Caché**: el bundle con hash de `_expo/` se cachea un año; `index.html` y el
  manifiesto se revalidan siempre.
- **Escritorio**: el contenido se acota y se centra en todas las pantallas
  (`withContentWidth` en el navegador raíz), no solo en tres.
- **Accesibilidad**: foco visible al navegar con teclado, y contraste AA en los
  placeholders (`textFaint`) y en los botones rojos (relleno `primaryFill`).
  `readableTextOn` ahora elige el texto por contraste real, no por brillo.
- **Piques con fecha límite**: al convocar se elige plazo (1 h, 6 h, 24 h,
  3 días o sin límite); las tarjetas muestran la cuenta atrás, que **late en la
  última hora**. Cumplido el plazo, el pique avisa y quien puede cerrarlo (su
  creador o el anfitrión) lo cierra con un botón.
- **Avisos del navegador**: con la pestaña detrás (jugando a AC) salta un aviso
  cuando alguien te quita un récord, marca vuelta o convoca un pique. Se activan
  desde Perfil. Ver el límite en Pendiente.
- **Una sola suscripción a los piques** en `AppContext` en lugar de seis con
  límites distintos: los "piques ganados" del Perfil ya cuadran con la Liga.

## ⏳ Pendiente

1. **APK de Android — roto**. El botón *"Descargar app (.apk)"* del Perfil apunta a
   `expo.dev/artifacts/eas/q3HANVGfPU8X9pAUmCNJVC.apk`, un artefacto de EAS que ya
   **ha caducado y devuelve 404**; además era el build del 8 de junio, sin nada de
   julio ni agosto. Hay que `npm run build:apk` y actualizar `APK_URL` en
   `src/screens/ProfileScreen.tsx`. Como los artefactos de EAS expiran, para una URL
   estable habría que alojarlo en Firebase Storage (Hosting en plan Spark no sirve
   `.apk`: la ruta `/ApexLap.apk` cae en el rewrite y devuelve el `index.html`).
2. **Push con el navegador cerrado: no se puede sin backend.** Mandar push web
   exige FCM, y FCM solo acepta envíos firmados con una cuenta de servicio (la
   API antigua de `server_key` está apagada); esa clave no puede ir en un
   cliente. Haría falta una Cloud Function, que pide **plan Blaze**. Lo que hay
   hoy son avisos con la pestaña abierta (aunque esté detrás) y push a móviles
   Android vía Expo, que sigue funcionando igual.
3. **Backlog de la auditoría del 7-8 de agosto** (detectado y verificado, sin
   arreglar): una sola suscripción a `challenges` en `AppContext` (hoy son seis con
   límites distintos y descuadran los "piques ganados"), `profiles` legible por
   cualquier autenticado, `challenges/create` sin validar `status`/`winnerId`, fotos
   de circuito como dataURL base64 dentro del documento, `subscribeLaps` sin
   `limit()`, contraste por debajo de AA en placeholders y botones, y `index.html`
   sin descripción ni Open Graph (compartir el enlace no muestra nada).
