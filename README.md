# 🏁 ApexLap

App móvil (iOS + Android) para guardar **tiempos de vuelta** de *Assetto Corsa*
con tus colegas, comparar quién es más rápido y **picaros** con una ruleta que
sortea coche y circuito.

Hecha con **Expo (React Native + TypeScript)** y **Firebase** (nube compartida
en tiempo real). Un código de liga junta a todo el grupo: lo que registra uno,
lo ven todos al instante.

---

## ✨ Funciones

- **Registro de vueltas**: coche, circuito (con trazado), tiempo `m:ss.mmm`,
  condiciones (seco/mojado/mixto), ayudas sí/no, caja de cambios y notas.
- **Ranking en vivo**: lista ordenada por tiempo con podio 🥇🥈🥉 y *delta* al
  líder. Filtros por coche, circuito, "sin ayudas" y "mojado". Modo
  **mejor de cada piloto** o **vueltas recientes**.
- **Récords** 👑: quién tiene la vuelta más rápida en cada combinación
  coche + circuito.
- **Ruleta de piques** 🎰: tragaperras que sortea coche y circuito (y
  opcionalmente condiciones). Puedes **fijar** el coche o el circuito para
  sortear solo lo demás. Convoca un pique que les aparece a todos.
- **Ligas**: crea una y comparte el código de 5 letras; o únete con el de un
  colega.
- **Perfil y estadísticas**: tus vueltas, récords y mejor tiempo, más la
  clasificación de pilotos de la liga.

---

## 🚀 Puesta en marcha

1. Instala dependencias (ya hecho si tienes `node_modules`):
   ```bash
   npm install
   ```
2. **Configura Firebase** (ver abajo) — sin esto la app muestra una pantalla con
   los pasos y no guarda datos.
3. Arranca en local para desarrollar:
   ```bash
   npm run web      # abre en el navegador (lo más rápido para iterar)
   # o   npm start  # y escanea el QR con Expo Go si quieres probar en el móvil
   ```

Para que **tú y tus colegas la uséis de verdad sin instalar nada raro**, hay dos
vías (no necesitáis "Expo Go"):

### 🌐 Web — un enlace, funciona en iPhone y Android

La app corre en el navegador. La despliegas una vez y todos abren la misma URL
(pueden hacer *"Añadir a pantalla de inicio"* y les queda como una app).

Desplegar gratis en **Firebase Hosting** (mismo proyecto que ya usas):
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # elige tu proyecto Firebase (solo la 1ª vez)
npm run deploy:web            # genera /dist y lo sube
```
Te dará una URL tipo `https://TU-PROYECTO.web.app`. ¡Esa es la que pasas al grupo!

> Alternativa: cualquier hosting estático sirve (Vercel, Netlify…). Genera la web
> con `npm run build:web` y sube la carpeta `dist/`. Si **no** usas Firebase
> Hosting, añade tu dominio en *Firebase Console › Authentication › Settings ›
> Authorized domains*, o el login anónimo fallará. (Los dominios `*.web.app` y
> `*.firebaseapp.com` ya vienen autorizados.)

### 📦 APK de Android — app instalable

Genera un `.apk` que se instala como cualquier app (sin Expo Go), con build en la
nube gratis de Expo (**EAS**):
```bash
npm install -g eas-cli
eas login                     # crea una cuenta Expo gratis si no tienes
npm run build:apk             # build en la nube; al acabar te da un enlace de descarga
```
Pasa ese enlace/`.apk` a tus colegas de Android. (En el móvil hay que permitir
"instalar apps de orígenes desconocidos".)

> **iOS instalable** (no web) requiere cuenta Apple Developer (99 €/año) y
> `eas build -p ios`. Para iPhone, la vía gratis es la **web** de arriba.

---

## 🔧 Configurar Firebase (gratis, ~5 min)

1. Entra en <https://console.firebase.google.com> → **Add project**.
2. **Build › Firestore Database** → *Create database* (empieza en *modo test*).
3. **Build › Authentication › Sign-in method** → habilita **Anonymous**.
4. **⚙ Project settings › Tus apps** → añade una app **Web** (`</>`) y copia el
   objeto `firebaseConfig`.
5. Pega esos valores en [`src/firebase/config.ts`](src/firebase/config.ts)
   (sustituye los `PEGA_AQUI_...`).
6. **Reglas de seguridad**: en *Firestore Database › Rules*, pega el contenido
   de [`firestore.rules`](firestore.rules) y pulsa **Publicar**. (El modo test
   caduca a las semanas; estas reglas lo dejan listo para el grupo.)

En cuanto guardes la config, la pantalla de "Conecta Firebase" desaparece sola.

---

## 🗂️ Estructura

```
src/
  data/            catálogo de coches y circuitos de Assetto Corsa
  firebase/        config.ts (tus claves) + db.ts (servicio Firestore)
  context/         AppContext: sesión, perfil, liga y vueltas en vivo
  components/      UI reutilizable (botones, cards, selector con buscador)
  screens/         Tiempos, Récords, Ruleta, Perfil, Onboarding, Setup
  navigation/      tabs inferiores + stack (añadir vuelta)
  utils/           parseo/formato de tiempos y cálculos de ranking
firestore.rules    reglas de seguridad para pegar en la consola
```

Los **coches y circuitos** salen de `src/data/`. No están todos los mods de AC,
pero el selector permite **escribir cualquiera a mano**, así que puedes añadir
los tuyos sobre la marcha.

---

## 💡 Ideas para seguir creciendo

Pensadas para hacerla aún más adictiva (no implementadas todavía):

- **Sectores y telemetría**: guardar S1/S2/S3 y mejor vuelta teórica.
- **Histórico y progreso**: gráfica de tu evolución por circuito.
- **Modo torneo / liga por puntos**: F1-style (25-18-15…) sumando por evento,
  con clasificación de temporada.
- **Retos cronometrados**: un pique con fecha límite y notificación push
  (`expo-notifications`) cuando alguien te quita el récord.
- **Comparador 1 vs 1**: superponer dos vueltas y ver el *delta* acumulado.
- **Validación opcional con captura**: adjuntar foto/replay del tiempo para
  evitar trampas (`expo-image-picker` + Firebase Storage).
- **Importar desde el juego**: parsear los CSV/JSON de tiempos que exporta
  Assetto Corsa o Content Manager.
- **Logros y motes**: "Rey del mojado", "Sin ayudas", rachas de récords.
- **Penalización por ayudas**: ranking separado o handicap configurable.
- **Widget / share card**: imagen compartible del récord para mandar al grupo.

¿Quieres alguna de estas? Dímelo y la añadimos. 🏎️
