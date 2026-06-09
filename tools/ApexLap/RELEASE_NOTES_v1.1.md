# ApexLap Mod v1.1 — Modo calibración 🔧

App de Custom Shaders Patch (CSP) que sube automáticamente tus vueltas limpias de
Assetto Corsa a tu liga de ApexLap.

## ✨ Novedades

- **Modo calibración**: nuevo diagnóstico que vuelca al log de CSP el estado
  completo del coche y la sesión, para descubrir qué campos expone tu versión
  concreta de CSP (los nombres varían entre builds).
  - Sondea y registra **solo los campos que existen**, con valor y tipo: tiempos
    de vuelta (`lapTimeMs`, `bestLapTimeMs`, `previousLapTimeMs`…), **ayudas**
    (`absMode`, `tractionControlMode`, `autoShift`, `autoClutch`,
    `stabilityControl`…), clima (`rainIntensity`) y resolución de pista
    (`getTrackID`/`getTrackLayout`/`getCarID`).
  - Se dispara **al cerrar cada vuelta** (antes de cualquier descarte, así también
    captura las vueltas que el mod rechaza) y mediante **botón manual** (útil
    parado en boxes para comparar ayudas con distintos ajustes).
  - Desactivado por defecto para no llenar el log en uso normal; toggle
    persistente desde la ventana de la app.

## 🎯 Para qué sirve

Permite afinar la **autodetección de ayudas** y la captura de tiempos sin tener
que adivinar la API: ruedas con el modo activado, copias los bloques
`=== CALIB ===` del log y se calibra el mod a tu CSP.

## 📦 Instalación

Copia la carpeta `tools/ApexLap/` a `assettocorsa/apps/lua/`. Requiere CSP con
soporte de apps Lua y acceso web. Activa **ApexLap** en la barra lateral y
verifica que la app muestra **v1.1**.

**Changelog completo**: `v1.0...v1.1`
