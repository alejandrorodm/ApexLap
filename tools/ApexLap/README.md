# 🏁 ApexLap Uploader — mod (app CSP) para Assetto Corsa

App **dentro del juego** que detecta tus vueltas limpias y las **sube solas** a tu
liga de ApexLap mientras juegas. Es lo más parecido a un "plugin de Content
Manager" que es técnicamente posible (CM no admite plugins propios).

## ⚠️ Requisito imprescindible

Necesitas **Custom Shaders Patch (CSP)** instalado, con soporte de **apps Lua**
(las versiones modernas lo traen). Sin CSP esto **no funciona** — en ese caso usa
el subidor de escritorio en `../cm-uploader/`.

> ¿Por qué CSP? Las apps antiguas de AC (Python) no pueden acceder a internet. Las
> apps Lua de CSP sí, por eso pueden subir las vueltas.

## Instalación

1. Copia la carpeta **`ApexLap`** entera dentro de:
   ```
   <Assetto Corsa>\apps\lua\
   ```
   (normalmente `C:\Program Files (x86)\Steam\steamapps\common\assettocorsa\apps\lua\`).
   **NO la renombres:** CSP exige que el script principal se llame igual que la
   carpeta. Debe quedar exactamente:
   ```
   assettocorsa\apps\lua\ApexLap\manifest.ini
   assettocorsa\apps\lua\ApexLap\ApexLap.lua
   assettocorsa\apps\lua\ApexLap\icon.png
   ```
2. Arranca Assetto Corsa.
3. En la **barra lateral de apps** (en pista, mueve el ratón al borde derecho),
   activa **"ApexLap"**. Aparecerá la ventanita.

## Uso

1. La primera vez, escribe tu **email y contraseña** de ApexLap y pulsa **Entrar**.
   (Se recuerdan para las próximas; quedan solo en tu PC.)
   En las siguientes sesiones **inicia sesión solo** en cuanto actives la app en
   la barra lateral — **no hace falta abrir la ventana**. Si cierras sesión a
   mano, se queda fuera hasta que vuelvas a pulsar "Entrar".
2. Cuando ponga *"Listo ✓"*, ya está. **Basta con que la app esté activa** en la
   barra lateral; puedes cerrar la ventana y conducir.
3. Cada vez que **completes una vuelta limpia** (sin cortes), se sube automática a
   tu liga. La ventana muestra el estado y cuántas llevas subidas si la abres.

Notas:
- **Escaneo al iniciar:** al abrir la app (y cada vez que cambias de coche o
  circuito) sube también el **mejor tiempo que el juego ya conoce** de ese
  coche+circuito cargado — así no pierdes una vuelta buena que hicieras *antes*
  de abrir la app. Solo mira el **combo cargado en ese momento**: para que suba
  el mejor de otro coche/circuito, entra a ese combo con la app abierta.
- A partir de ahí vigila en vivo y sube cada vuelta nueva limpia.
- Solo sube vueltas **válidas y SIN penalización**: si cortas (el juego invalida
  la vuelta) o tienes un *penalty* activo, la vuelta se descarta.
- **Menos escrituras (por defecto):** solo sube cuando **mejoras** tu tiempo en
  ese combo coche+circuito — que es lo único que cuenta para récords y
  clasificación. Editable en `ac.storage` (`onlyBest = false`) si quisieras subir
  todas las vueltas limpias.
- **Ayudas/caja:** las vueltas se suben marcadas como *sin ayudas* y caja
  *Manual* (valores neutros). Si necesitas otra etiqueta, edítala desde la app
  móvil/web después de la subida.
- No duplica: recuerda lo subido (por circuito + coche + tiempo).
- La detección corre en `script.update`, así que **basta con que la app esté
  activa en la barra lateral** — la ventana puede estar cerrada.

## 📊 Sectores (S1/S2/S3) — leídos de Content Manager

La detección en vivo de CSP **no** entrega los tiempos por sector ya cronometrados
(su API solo da el tiempo total fiable). Pero **Content Manager sí los guarda**: al
terminar cada sesión escribe un JSON en
`%LOCALAPPDATA%\AcTools Content Manager\Progress\Sessions\` y cada vuelta de ese
JSON trae su array `sectors`.

Por eso el mod, **al iniciar sesión**, lee esos JSON y añade los sectores:

- Si la vuelta **ya la había subido** (guarda su doc ID de Firestore), hace un
  `PATCH` para añadirle los sectores **sin duplicarla**.
- Si la vuelta la hiciste **con la app cerrada**, la sube nueva ya con sectores
  (respetando el modo "solo mejores", salvo que haya un pique abierto).

Detalles:
- Como CM escribe el JSON **al terminar** la sesión, los sectores de las vueltas
  que acabas de hacer se completan **en el siguiente arranque** del juego. Es
  automático: no hay que tocar nada.
- Empareja tus vueltas por el **nombre de piloto de Assetto Corsa**; en sesiones
  de un solo jugador (hotlap/práctica) te reconoce aunque el nombre no coincida.
- Se puede desactivar con el botón **"Leer sectores de CM"** en la ventana, o
  `readSectors = false` en `ac.storage`.
- **Incremental:** cada arranque solo mira las sesiones **más nuevas** que la
  última vez (marca de agua por fecha de fichero), así nunca re-sube todo el
  historial. En el **primer** arranque mira solo las sesiones de las **últimas
  6 h**. Lo registra: `sectores: N sesiones nuevas (de M, …)`.
- **Requiere lanzar el juego desde Content Manager** (es quien escribe esos JSON).

### Depuración del emparejamiento

Para que el `PATCH` encuentre la vuelta, la clave que calcula la detección en vivo
(`pista|coche|ms`) debe coincidir con la del JSON. El mod loguea ambas:

- `[ApexLap] LIVE key=…` → al cerrar una vuelta en vivo.
- `[ApexLap] JSON key=… -> …` → al escanear los JSON (primeras 5), con su veredicto
  (`PATCH`, `nueva con sectores`, `ya tiene sectores`, etc.).

Si una `LIVE key` y su `JSON key` deberían ser la misma vuelta pero salen distintas
(p. ej. el nombre de pista/coche difiere), pásame esas dos líneas y ajusto cómo se
construye el `combo`.

## ⚙️ Importante: primera prueba (puede necesitar un retoque)

Este mod se ha escrito contra la API documentada de CSP Lua, pero **no se ha podido
probar dentro del juego**. Es posible que algún nombre de campo varíe según tu
versión de CSP. Si das una vuelta limpia y **no sube**:

1. Abre el **log de CSP**: icono de CSP en CM → *Logs*, o el fichero
   `Documents\Assetto Corsa\logs\` más reciente.
2. Busca líneas con **`[ApexLap]`**. Te dirán si detecta la vuelta, si la descarta
   o si hubo error de subida.
3. Pásame esas líneas y ajusto los puntos marcados como **`VERIFICAR`** en
   `ApexLap.lua` (campos como `car.lapCount`, `car.previousLapTimeMs`,
   `car.isLapValid`, `ac.getCarID`, `sim.trackId`).

Mientras tanto, el **subidor de escritorio** (`../cm-uploader/`) funciona seguro y
no depende de CSP.

## Qué hace por dentro

- Login Firebase REST (`signInWithPassword`) y refresco de token ante 401.
- Lee `profiles/{uid}` para tu liga y nombre de piloto.
- Al iniciar / cambiar de combo, escanea el mejor tiempo que el juego ya conoce
  del coche+circuito cargado (`car.bestLapTimeMs`) y lo sube si te falta.
- Cada frame comprueba el contador de vueltas; al cerrar una vuelta **válida y sin
  penalización** hace `POST` a `leagues/{leagueId}/laps` con tu `idToken` (tu
  `userId` = tu uid, como exigen las reglas de seguridad).
- **Menos escrituras:** en modo PB (por defecto) solo sube si el tiempo mejora tu
  mejor marca de ese coche+circuito; los PBs por combo se guardan en `ac.storage`.
- Persistencia de credenciales, PBs y de lo ya subido con `ac.storage`.
