# ApexLap Mod v1.2 — Calibrado en el juego ✅

App de Custom Shaders Patch (CSP) que sube automáticamente tus vueltas limpias de
Assetto Corsa a tu liga de ApexLap.

## ✨ Novedades

- **Verificado en el juego**: probado en CSP real (carga, login, perfil, escaneo de
  sectores, detección y subida de la vuelta). Campos de tu versión de CSP
  confirmados con el modo calibración v1.1.
- **Ayudas más fiables**: el flag "Sin/Con ayudas" ahora **respeta tu perfil** y el
  mod ya **no intenta adivinarlo** desde el juego. La calibración mostró que la
  autodetección daba falsos positivos (autoembrague/autocambio dependen del
  mando/volante, y ABS/TC no son una "ayuda" como tal).
- **ABS/TC descriptivos**: el mod lee del juego el estado real de **ABS y TC** y lo
  sube por vuelta como campos `abs`/`tc` (no como "ayuda"). En la app se muestran
  como chips y se puede filtrar por "Sin ABS" / "Sin TC".

## 🎯 Compatibilidad

Las vueltas que suba este mod incluyen los nuevos campos `abs`/`tc`; las vueltas
antiguas siguen funcionando igual (simplemente no los traen).

## 📦 Instalación

Descomprime `ApexLap-v1.2.zip` dentro de `assettocorsa/apps/lua/` (queda
`assettocorsa/apps/lua/ApexLap/`). Requiere CSP con soporte de apps Lua y acceso
web. Activa **ApexLap** en la barra lateral y verifica que la app muestra **v1.2**.

**Changelog completo**: `v1.1...v1.2`
