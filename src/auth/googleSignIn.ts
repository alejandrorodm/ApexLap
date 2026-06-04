// Google Sign-In NATIVO (Android/iOS). Solo se incluye en el bundle nativo;
// en web Metro resuelve `googleSignIn.web.ts` (un stub), así que la librería
// nativa no entra en la build web.
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID, isGoogleConfigured } from './googleConfig';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/**
 * Lanza el selector de cuenta de Google y devuelve el idToken para
 * `signInWithCredential` de Firebase. Devuelve null si el usuario cancela.
 */
export async function googleIdToken(): Promise<string | null> {
  if (!isGoogleConfigured) {
    throw new Error(
      'Falta configurar el Web client ID de Google (src/auth/googleConfig.ts) y recompilar.'
    );
  }
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res: any = await GoogleSignin.signIn();
  // v16: { type: 'success', data: { idToken, ... } } | { type: 'cancelled' }
  if (res?.type === 'cancelled') return null;
  const idToken = res?.data?.idToken ?? res?.idToken ?? null;
  if (!idToken) throw new Error('Google no devolvió el token de identidad.');
  return idToken;
}
