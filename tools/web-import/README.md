# 🏁 Importador web — ApexLap

Página estática autocontenida (`index.html`) que sube tu **histórico de Content
Manager** a tu liga de ApexLap **sin instalar nada**:

1. El usuario abre la URL en su navegador.
2. Inicia sesión con su cuenta de ApexLap (email/password de Firebase).
3. Arrastra (o elige) la carpeta `Progress\Sessions` de CM.
4. La página parsea los `.json` **en local**, agrega el mejor tiempo por
   coche+circuito, descuenta lo que ya tiene en la liga y muestra una vista previa.
5. El usuario pulsa **Subir PBs nuevos** → escritura en Firestore (REST `:commit`).

No depende de Python ni de CSP. Funciona en Windows, Mac y Linux.

## Cómo se sirve

Los ficheros de la web viven aquí en el repo. Para hospedarlos, súbelos a
**Firebase Hosting** del proyecto (`laptimersaver`).

### Opción rápida (mismo deploy que la app)

`firebase.json` despliega `dist/` como sitio único. Antes de `firebase deploy`:

```bash
mkdir -p dist/import
cp tools/web-import/index.html dist/import/index.html
firebase deploy --only hosting
```

Quedará en `https://<tu-dominio-firebase>.web.app/import/`. Los ficheros estáticos
ganan al rewrite SPA de la app, así que no choca con `dist/index.html`.

### Opción limpia (sitio independiente)

Si prefieres una URL aparte (`apexlap-import.web.app`):

1. En Firebase Console › Hosting, **Añadir otro sitio** y nómbralo `apexlap-import`.
2. Asocia un target:
   ```bash
   firebase target:apply hosting import apexlap-import
   firebase target:apply hosting app laptimersaver
   ```
3. Cambia `firebase.json` a un array con dos entradas (uno por target) y apunta
   el target `import` a `tools/web-import/`.

## Cómo funciona por dentro

- **Auth**: `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` con el
  `apiKey` público del proyecto. Mismo que `cm_uploader.py` y la app móvil.
- **Perfil**: lee `profiles/{uid}` por REST para sacar `leagueId` y `driverName`.
- **Parseo**: cada `.json` de `Progress\Sessions` trae `players[]`, `sessions[].laps[]`
  con `time`, `cuts`, `car` (índice). Mismo esquema que `race_out.json`. Se filtran
  cuts ≠ 0, tiempos < 15s o > 1h, y se queda con la mejor por `(carId, trackId)`
  cruzando todos los ficheros.
- **Dedup vs liga**: antes del preview, lanza una `:runQuery` filtrando por
  `userId == uid` y construye un set de claves `track|car|timeMs` para marcar lo
  que ya está y solo subir lo nuevo.
- **Subida**: una llamada a `:commit` con todos los `writes` (genera ids de
  documento estilo Firestore en cliente). Igual que el Python.
- **Prettify**: mismos prefijos (`ks_`, `rss_`…) que el subidor Python, para que
  los nombres queden idénticos a los que ve la app móvil.

## Privacidad

- El email/contraseña viaja solo a Google Identity Toolkit para autenticarte.
- Los ficheros `.json` se leen con `FileReader` **en tu navegador**; no se suben
  a ningún backend. Solo se suben a Firestore las vueltas que tú apruebes.
- No hay cookies ni analítica.
