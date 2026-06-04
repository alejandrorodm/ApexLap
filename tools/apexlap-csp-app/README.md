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

1. Copia la carpeta **`apexlap-csp-app`** entera dentro de:
   ```
   <Assetto Corsa>\apps\lua\
   ```
   (normalmente `C:\Program Files (x86)\Steam\steamapps\common\assettocorsa\apps\lua\`).
   Renómbrala si quieres, p.ej. `ApexLap`. Debe quedar:
   ```
   assettocorsa\apps\lua\ApexLap\manifest.ini
   assettocorsa\apps\lua\ApexLap\ApexLapUploader.lua
   ```
2. Arranca Assetto Corsa.
3. En la **barra lateral de apps** (en pista, mueve el ratón al borde derecho),
   activa **"ApexLap"**. Aparecerá la ventanita.

## Uso

1. La primera vez, escribe tu **email y contraseña** de ApexLap y pulsa **Entrar**.
   (Se recuerdan para las próximas; quedan solo en tu PC.)
2. Cuando ponga *"Listo ✓"*, ya está: **deja la ventana abierta** y conduce.
3. Cada vez que **completes una vuelta limpia** (sin cortes), se sube automática a
   tu liga. La ventana muestra el estado y cuántas llevas subidas.

Notas:
- **Solo sube las vueltas que hagas con la app ABIERTA.** No importa tus tiempos
  antiguos ya guardados en Assetto Corsa: la app vigila en vivo, no lee tu
  histórico/récords del juego. Lo de antes de abrirla no se sube.
- Solo sube vueltas **válidas y SIN penalización**: si cortas (el juego invalida
  la vuelta) o tienes un *penalty* activo, la vuelta se descarta.
- **Menos escrituras (recomendado):** con la casilla *"Subir solo tu mejor (PB)
  por coche+circuito"* marcada (por defecto), solo sube cuando **mejoras** tu
  tiempo en ese combo — que es lo único que cuenta para récords y clasificación.
  Desmárcala si quieres subir todas las vueltas limpias.
- **Ayudas y caja configurables:** en la ventana eliges si marcas tus vueltas
  *con ayudas* (ABS/TC) y la *caja* (Manual / Manual+embrague / Automática). Se
  aplica a las vueltas que subas a partir de ese momento y se recuerda.
- No duplica: recuerda lo subido (por circuito + coche + tiempo).
- Mantén la app **abierta/visible** mientras juegas; si la cierras, deja de vigilar.

## ⚙️ Importante: primera prueba (puede necesitar un retoque)

Este mod se ha escrito contra la API documentada de CSP Lua, pero **no se ha podido
probar dentro del juego**. Es posible que algún nombre de campo varíe según tu
versión de CSP. Si das una vuelta limpia y **no sube**:

1. Abre el **log de CSP**: icono de CSP en CM → *Logs*, o el fichero
   `Documents\Assetto Corsa\logs\` más reciente.
2. Busca líneas con **`[ApexLap]`**. Te dirán si detecta la vuelta, si la descarta
   o si hubo error de subida.
3. Pásame esas líneas y ajusto los puntos marcados como **`VERIFICAR`** en
   `ApexLapUploader.lua` (campos como `car.lapCount`, `car.previousLapTimeMs`,
   `car.isLapValid`, `ac.getCarID`, `sim.trackId`).

Mientras tanto, el **subidor de escritorio** (`../cm-uploader/`) funciona seguro y
no depende de CSP.

## Qué hace por dentro

- Login Firebase REST (`signInWithPassword`) y refresco de token ante 401.
- Lee `profiles/{uid}` para tu liga y nombre de piloto.
- Cada frame comprueba el contador de vueltas; al cerrar una vuelta **válida y sin
  penalización** hace `POST` a `leagues/{leagueId}/laps` con tu `idToken` (tu
  `userId` = tu uid, como exigen las reglas de seguridad).
- **Menos escrituras:** en modo PB (por defecto) solo sube si el tiempo mejora tu
  mejor marca de ese coche+circuito; los PBs por combo se guardan en `ac.storage`.
- Persistencia de credenciales, PBs y de lo ya subido con `ac.storage`.
