# 🏁 ApexLap — Informe del proyecto

App para guardar y competir con los tiempos de vuelta de **Assetto Corsa** entre
colegas. Hecha con **Expo (React Native + TypeScript)** y **Firebase**
(Authentication + Firestore en tiempo real).

- **Web en vivo:** https://laptimersaver.web.app
- **Repositorio:** https://github.com/alejandrorodm/ApexLap

> Nota: el ID del proyecto Firebase es `laptimersaver` (no se puede renombrar), por
> eso la URL y el slug interno conservan ese nombre. El nombre visible de la app es
> **ApexLap**.

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
  screens/      Onboarding, Auth, Setup, Laps, Records, Roulette,
                Standings (Liga), Challenge (detalle), Profile, AddLap
  navigation/   Tabs (Tiempos · Récords · Ruleta · Liga · Perfil) + stack
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
| Desplegar web | `firebase deploy --only hosting` |
| Desplegar reglas | `firebase deploy --only firestore:rules` |
| Build APK (EAS) | `npx eas-cli@latest build -p android --profile preview` |

---

## ✅ Estado actual

- Puntos + apuestas + login real: **implementado y verificado** (`tsc` limpio y
  `expo export` web correcto).
- **Aún NO desplegado**: la web/APK en vivo siguen con la versión anterior.

## ⏳ Pendiente

1. **Desplegar** (requiere tu login interactivo de Firebase/EAS):
   - `firebase deploy --only firestore:rules` ← importante: reglas nuevas de apuestas.
   - `npm run build:web && firebase deploy --only hosting`.
   - Recompilar el APK con EAS.
2. **Firebase Console → Authentication → Sign-in method**: habilitar
   **Email/Password** y **Google** (sin esto el login real falla; el de invitado sí
   funciona).
3. **Pantalla de Participantes** de la liga (no hecha; `getLeagueMembers` ya existe).
4. **Subidor de Content Manager** (script de escritorio que sube las vueltas válidas
   de AC automáticamente) — pendiente de construir.
