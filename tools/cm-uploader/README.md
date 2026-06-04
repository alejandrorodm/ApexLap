# 🏁 Subidor de Content Manager — ApexLap

Pequeño programa de escritorio que **vigila la carpeta de resultados de Assetto
Corsa y sube tus vueltas limpias a tu liga de ApexLap automáticamente**. Así no
tienes que meter los tiempos a mano: juegas y aparecen solos en la app.

Funciona en **Windows, Mac y Linux**. Solo necesita **Python 3** — no instala
ninguna librería extra (usa la librería estándar).

> ℹ️ Content Manager / Assetto Corsa no admiten plugins propios, así que esto es
> un acompañante que lee los ficheros de resultados que el juego ya escribe.

---

## 1. Requisitos

- **Python 3** instalado.
  - Windows: descárgalo de https://www.python.org/downloads/ y marca
    *"Add Python to PATH"* durante la instalación.
  - Comprueba en una terminal: `python --version`.
- Tener una **cuenta de ApexLap** (email + contraseña) y estar **dentro de una
  liga**. Si entraste como invitado, crea una cuenta primero en la app (es la
  cuenta que usará el subidor para identificarte).

## 2. Configuración

1. Copia `config.example.json` a **`config.json`** (en esta misma carpeta).
2. Ábrelo con el Bloc de notas y rellena:
   - `email` y `password`: los de tu cuenta de ApexLap.
   - `acResultsPath`: la carpeta `out` de Assetto Corsa. Por defecto en Windows es
     `%USERPROFILE%\Documents\Assetto Corsa\out` (ya viene puesto). Si tienes los
     documentos en otra unidad, pon la ruta completa.
   - `firebaseApiKey` y `projectId` ya vienen rellenos para ApexLap; no los toques.

   El resto son opcionales (ver más abajo).

> 🔒 `config.json` lleva tu contraseña: **no se sube a git** (está en `.gitignore`).

## 3. Arrancar

- **Windows**: doble clic en **`start-windows.bat`** (o `python cm_uploader.py`).
- **Mac/Linux**: `python3 cm_uploader.py`.

Verás algo como:

```
ApexLap · Subidor de Content Manager
  Carpeta AC: C:\Users\tu\Documents\Assetto Corsa\out
  Iniciando sesión en Firebase…
  Piloto: Alex  ·  Liga: 9fA3...
  Vigilando… (Ctrl+C para salir). Juega y tus vueltas limpias subirán solas.
```

Ahora juega (práctica, hotlap, carrera…). Al terminar cada sesión, AC escribe los
resultados y el subidor coge tus vueltas **válidas (sin cortes)** y las sube.

Para una prueba puntual sin quedarse vigilando:

```
python cm_uploader.py --once
```

## 4. Opciones de `config.json`

| Campo | Qué hace | Por defecto |
| --- | --- | --- |
| `pollSeconds` | Cada cuántos segundos mira la carpeta. | `5` |
| `settleSeconds` | Espera a que el fichero de resultados deje de cambiar este tiempo antes de subir, para hacerlo **una vez al terminar la sesión entera** (no vuelta a vuelta). | `8` |
| `minLapTimeMs` | Ignora tiempos por debajo de esto (vueltas de salida/basura), en ms. | `15000` |
| `onlyBest` | Si `true`, sube solo tu **mejor** vuelta limpia por coche+circuito de cada sesión. Si `false`, sube todas las limpias. | `true` |
| `playerName` | Si juegas en multijugador y quieres filtrar solo tus vueltas, pon aquí tu nombre exacto del juego. Vacío = el jugador 0 (tú, en monojugador). | `""` |
| `defaults.conditions` | Condición con la que se guardan (`dry`/`wet`/`mixed`). AC base no distingue mojado, por eso es fijo. | `dry` |
| `defaults.assists` | Si marcas las vueltas como hechas con ayudas. | `false` |
| `defaults.gearbox` | Caja (`auto`/`manual`/`manual-clutch`). | `manual` |
| `carAliases` | Traduce ids internos de AC a nombres bonitos. Ej.: `"ks_mazda_mx5_cup": "Mazda MX-5 Cup"`. | (algunos) |
| `trackAliases` | Igual para circuitos. | (algunos) |

Sin alias, los nombres se "embellecen" automáticamente (p.ej. `ks_toyota_ae86`
→ `Toyota Ae86`). Si quieres que coincidan exactamente con los del selector de la
app, añádelos a `carAliases` / `trackAliases`.

## 5. Cómo evita duplicados

Guarda en `state.json` (local, no se sube) las vueltas ya enviadas, identificadas
por circuito + coche + tiempo en ms. Si repites exactamente el mismo tiempo no se
vuelve a subir; cuando mejoras, el nuevo tiempo sí sube.

Para "olvidar" lo subido y empezar de cero, borra `state.json`.

## 6. Problemas frecuentes

- **`No se pudo iniciar sesión`**: revisa email/contraseña y que en *Firebase
  Console → Authentication → Sign-in method* esté habilitado **Email/Password**.
- **`Tu perfil no tiene liga`**: entra en la app con esa cuenta y únete/crea una
  liga; el subidor usa la liga de tu perfil.
- **No sube nada**: confirma que `acResultsPath` apunta a la carpeta `out` correcta
  y que en Content Manager/AC están activados los resultados JSON. Comprueba que
  ahí se crea/actualiza `race_out.json` al terminar una sesión.
- **Nombres de coche/circuito feos**: añádelos a `carAliases`/`trackAliases`.

## 7. Detalles técnicos

- Login: `identitytoolkit.googleapis.com` (`signInWithPassword`) y refresco de
  token vía `securetoken.googleapis.com`.
- Escritura: Firestore REST `:commit` (un solo `POST` con un array de `writes`),
  así todas las vueltas nuevas de una sesión suben en **una única llamada** en
  vez de una por vuelta. El `userId` de cada vuelta es tu uid, como exigen las
  reglas de seguridad.
- Solo lectura local de los `*.json` de la carpeta `out`; no modifica nada del
  juego.
