// Web client ID de OAuth para el login con Google NATIVO (Android).
// Dónde sacarlo: Firebase Console › Authentication › Sign-in method › Google ›
// "Configuración del SDK web" › "ID de cliente web" (acaba en
// .apps.googleusercontent.com). Es el MISMO que usa Firebase para la web.
//
// Mientras esté el placeholder, el botón de Google en el APK avisará de que
// falta configurar. Tras rellenarlo hay que recompilar el APK.
export const GOOGLE_WEB_CLIENT_ID =
  '17800222085-ne7jjtl65cbotfne6bcikr4jjkhdds75.apps.googleusercontent.com';

export const isGoogleConfigured =
  !GOOGLE_WEB_CLIENT_ID.startsWith('PEGA_AQUI');
